// Server-only: 6-digit e-mail verification codes for sign-up and sign-in.
//
// A "challenge" is created after the password step. The browser only gets a random challenge id; the 6-digit code
// goes to the user's e-mail. Only hashes are stored (auth_codes table). Codes expire, can be tried a few times,
// and can be used once.
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { query } from './db';
import { sendVerificationCode } from './mail';

export const CODE_MINUTES = 10;       // how long a code is valid
export const MAX_TRIES = 5;           // wrong guesses allowed per code
const RESEND_SECONDS = 45;            // minimum gap between e-mails for one challenge
const MAX_SENDS = 5;                  // e-mails per challenge (first + resends)
const SEND_WINDOW_MIN = 15, SEND_LIMIT_EMAIL = 5, SEND_LIMIT_IP = 15;   // e-mail bombing protection

const sha = s => createHash('sha256').update(s).digest('hex');
const codeHash = (challenge, code) => sha(`${challenge}:${code}`);
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const maskEmail = e => {
  const [name, host] = String(e).split('@');
  return `${name.slice(0, Math.min(2, name.length))}${'*'.repeat(Math.max(1, Math.min(name.length - 2, 6)))}@${host}`;
};

// Too many verification e-mails requested for this address / IP recently?
async function mailLimited(email, ip) {
  const { rows } = await query(
    `SELECT key, count(*)::int AS n FROM auth_attempts WHERE key = ANY($1) AND at > now() - $2 * interval '1 minute' GROUP BY key`,
    [['mail:' + email, 'mailip:' + ip], SEND_WINDOW_MIN]);
  return rows.some(r => r.n >= (r.key.startsWith('mailip:') ? SEND_LIMIT_IP : SEND_LIMIT_EMAIL));
}
const noteSend = (email, ip) => query(`INSERT INTO auth_attempts (key) VALUES ($1), ($2)`, ['mail:' + email, 'mailip:' + ip]);

// Creates a challenge and e-mails the code. Returns { challenge, email } or { error, status }.
//   purpose 'signup'  -> payload = { name, handle, password_hash } (the account is only created after the code is right)
//   purpose 'signin'  -> userId = the user who gave the right password
export async function startChallenge({ purpose, email, userId = null, payload = null, ip }) {
  if (await mailLimited(email, ip)) return { status: 429, error: 'Too many codes requested. Wait a few minutes and try again.' };
  const challenge = randomBytes(24).toString('base64url');
  const code = newCode();
  await query(`DELETE FROM auth_codes WHERE expires_at < now() - interval '1 hour'`);
  await query(
    `INSERT INTO auth_codes (challenge_hash, purpose, email, user_id, payload, code_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + $7 * interval '1 minute')`,
    [sha(challenge), purpose, email, userId, payload, codeHash(challenge, code), CODE_MINUTES]);
  try { await sendVerificationCode(email, code, purpose, CODE_MINUTES); }
  catch (err) {
    await query('DELETE FROM auth_codes WHERE challenge_hash = $1', [sha(challenge)]);
    console.error('could not send verification e-mail:', err);
    return { status: 502, error: "We couldn't send the verification email. Check the address and try again in a moment." };
  }
  await noteSend(email, ip);
  return { challenge, email };
}

// Sends a fresh code for an existing challenge.
export async function resendChallenge(challenge, ip) {
  const h = sha(challenge);
  const { rows } = await query(`SELECT * FROM auth_codes WHERE challenge_hash = $1`, [h]);
  const c = rows[0];
  if (!c) return { status: 410, error: 'This code has expired. Start again.' };
  if (c.sends >= MAX_SENDS) return { status: 429, error: 'Too many codes sent. Start again in a few minutes.' };
  const wait = RESEND_SECONDS - (Date.now() - new Date(c.last_sent_at).getTime()) / 1000;
  if (wait > 0) return { status: 429, error: `Please wait ${Math.ceil(wait)} seconds before asking for another code.` };
  if (await mailLimited(c.email, ip)) return { status: 429, error: 'Too many codes requested. Wait a few minutes and try again.' };
  const code = newCode();
  try { await sendVerificationCode(c.email, code, c.purpose, CODE_MINUTES); }
  catch (err) { console.error('could not send verification e-mail:', err); return { status: 502, error: "We couldn't send the verification email. Try again in a moment." }; }
  await query(
    `UPDATE auth_codes SET code_hash = $2, attempts = 0, sends = sends + 1, last_sent_at = now(), expires_at = now() + $3 * interval '1 minute' WHERE challenge_hash = $1`,
    [h, codeHash(challenge, code), CODE_MINUTES]);
  await noteSend(c.email, ip);
  return { ok: true, email: c.email };
}

// Checks a code. Returns { row } (the challenge, now consumed) or { error, status }.
export async function consumeChallenge(challenge, code) {
  const h = sha(challenge);
  // Count this guess first (atomically), so parallel requests can't get extra tries.
  const { rows } = await query(
    `UPDATE auth_codes SET attempts = attempts + 1 WHERE challenge_hash = $1 AND expires_at > now() AND attempts < $2 RETURNING *`, [h, MAX_TRIES]);
  const c = rows[0];
  if (!c) {
    await query('DELETE FROM auth_codes WHERE challenge_hash = $1 AND (expires_at <= now() OR attempts >= $2)', [h, MAX_TRIES]);
    return { status: 410, error: 'This code has expired or was tried too many times. Start again.' };
  }
  const want = Buffer.from(c.code_hash, 'hex'), got = Buffer.from(codeHash(challenge, code), 'hex');
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    const left = MAX_TRIES - c.attempts;
    if (left <= 0) await query('DELETE FROM auth_codes WHERE challenge_hash = $1', [h]);
    return { status: 401, error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Start again.' };
  }
  const used = await query('DELETE FROM auth_codes WHERE challenge_hash = $1 RETURNING challenge_hash', [h]);   // single use
  if (!used.rowCount) return { status: 410, error: 'This code has already been used. Start again.' };
  return { row: c };
}
