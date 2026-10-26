// Password hashing with Node's built-in scrypt (no extra packages). Shared by the app and scripts/claim-user.mjs.
// Stored format: scrypt$N$r$p$salt(base64)$hash(base64)
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384, R = 8, P = 1, KEYLEN = 64;
const run = (pw, salt, n = N, r = R, p = P) =>
  new Promise((res, rej) => scrypt(pw, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await run(pw, salt);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

const DUMMY = randomBytes(16);
// Always does the same amount of work, even for unknown users, so response time doesn't reveal whether an account exists.
export async function verifyPassword(pw, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') { await run(pw, DUMMY); return false; }
  const [, n, r, p, salt, hash] = parts;
  const want = Buffer.from(hash, 'base64');
  const got = await run(pw, Buffer.from(salt, 'base64'), +n, +r, +p);
  return want.length === got.length && timingSafeEqual(want, got);
}
