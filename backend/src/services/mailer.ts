import nodemailer from 'nodemailer';
import { env, isTest } from '../config/env';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } })
  : null;

/** Sends an e-mail, or prints it to the server log when SMTP is not configured (development). */
export async function sendMail(to: string, subject: string, text: string) {
  if (!transporter) {
    if (!isTest) console.log(`\n[mail] To: ${to}\n[mail] Subject: ${subject}\n[mail] ${text}\n`);
    return;
  }
  await transporter.sendMail({ from: env.MAIL_FROM, to, subject, text });
}
