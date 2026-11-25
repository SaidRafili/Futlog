// Server-only: sends e-mail through a Gmail account (SMTP + app password). Never import from a 'use client' file.
// Set GMAIL_USER and GMAIL_APP_PASSWORD (see .env.example). Without them sendMail() quietly does nothing.
import nodemailer from 'nodemailer';

const g = globalThis;
let warned = false;

export const mailEnabled = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

function transport() {
  if (!g.__futlogMail) {
    g.__futlogMail = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.GMAIL_USER, pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '') },
    });
  }
  return g.__futlogMail;
}

// Returns true when Gmail accepted the message. Never throws: a mail problem must not break the request that triggered it.
export async function sendMail({ to, subject, text, html }) {
  if (!mailEnabled()) {
    if (!warned) { warned = true; console.warn('[mail] GMAIL_USER / GMAIL_APP_PASSWORD not set: e-mail notifications are off'); }
    return false;
  }
  try {
    await transport().sendMail({ from: `"${process.env.MAIL_FROM_NAME || 'Futlog'}" <${process.env.GMAIL_USER}>`, to, subject, text, html });
    return true;
  } catch (err) {
    console.error('[mail] could not send to', to, '-', err.message);
    return false;
  }
}
