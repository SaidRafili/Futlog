// Server-only: sends the verification e-mails through Gmail SMTP (sender: futlogcom@gmail.com).
//
// Needs two environment variables (see .env.example):
//   GMAIL_USER          the sender address (defaults to futlogcom@gmail.com)
//   GMAIL_APP_PASSWORD  a Google "App password" for that account (NOT the normal Gmail password)
//
// In development (NODE_ENV !== 'production') with no GMAIL_APP_PASSWORD set, the code is printed in the
// server console instead of being e-mailed, so you can test the flow locally. In production it fails loudly.
import nodemailer from 'nodemailer';

export const MAIL_FROM = process.env.GMAIL_USER || 'futlogcom@gmail.com';

const g = globalThis;
function transport() {
  if (!process.env.GMAIL_APP_PASSWORD) return null;
  return g.__futlogMail ?? (g.__futlogMail = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: MAIL_FROM, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') },   // app passwords are shown with spaces
  }));
}

export class MailNotConfigured extends Error {}

export async function sendVerificationCode(to, code, purpose, minutes) {
  const t = transport();
  if (!t) {
    if (process.env.NODE_ENV !== 'production') { console.warn(`[futlog] GMAIL_APP_PASSWORD not set - verification code for ${to}: ${code}`); return; }
    throw new MailNotConfigured('GMAIL_APP_PASSWORD is not set');
  }
  const action = purpose === 'signup' ? 'create your Futlog account' : 'sign in to Futlog';
  await t.sendMail({
    from: `"Futlog" <${MAIL_FROM}>`,
    to,
    subject: `${code} is your Futlog verification code`,
    text: `Your Futlog verification code is ${code}\n\nEnter it to ${action}. It expires in ${minutes} minutes.\n\nIf you didn't try to ${action}, you can ignore this email - nobody can get in without this code.`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 12px;color:#5b3df5">Futlog</h2>
  <p style="margin:0 0 16px">Use this code to ${action}:</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:6px;margin:0 0 16px;font-family:'Courier New',monospace">${code}</p>
  <p style="margin:0 0 8px;color:#555">It expires in ${minutes} minutes.</p>
  <p style="margin:0;color:#888;font-size:12px">If you didn't try to ${action}, you can ignore this email - nobody can get in without this code.</p>
</div>`,
  });
}
