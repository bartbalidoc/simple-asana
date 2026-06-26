import nodemailer from "nodemailer";

// Simple transactional email via SMTP (defaults are Gmail-friendly).
// NOT HIPAA-hardened — intended for non-PHI notifications until a proper
// email provider is wired up. Sends are best-effort and never throw.
//
// Env:
//   SMTP_HOST   (default smtp.gmail.com)
//   SMTP_PORT   (default 587)
//   SMTP_USER   the sending account (e.g. a Gmail address)
//   SMTP_PASS   the password / Gmail App Password
//   EMAIL_FROM  (default SMTP_USER) — the visible From address
// If SMTP_USER/SMTP_PASS are unset, email is silently disabled.

let transporter: nodemailer.Transporter | null = null;
let resolved = false;

function getTransporter(): nodemailer.Transporter | null {
  if (resolved) return transporter;
  resolved = true;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    transporter = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user, pass },
  });
  return transporter;
}

export function emailEnabled(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error("sendMail failed:", err);
    return false;
  }
}
