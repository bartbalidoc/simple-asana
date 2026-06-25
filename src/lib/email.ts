import nodemailer, { Transporter } from "nodemailer";

// Lazily-built singleton transport. `undefined` = not yet checked,
// `null` = checked and not configured (we degrade to a logging no-op).
let cached: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (cached !== undefined) return cached;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  // Default host to Gmail SMTP when only a user/pass (App Password) is given.
  const host = process.env.SMTP_HOST || (user ? "smtp.gmail.com" : undefined);

  if (!host || !user || !pass) {
    cached = null;
    return null;
  }

  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user, pass },
  });
  return cached;
}

export function emailFrom(): string {
  return (
    process.env.EMAIL_FROM ||
    `BaliDoc <${process.env.SMTP_USER || "no-reply@balidoc.app"}>`
  );
}

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends an email. Never throws — a mail failure must never break the
 * task/comment/project operation that triggered it. Returns true on success,
 * false when skipped (SMTP not configured) or failed.
 */
export async function sendMail(opts: MailOptions): Promise<boolean> {
  const transport = getTransport();

  if (!transport) {
    // Never log opts.subject — in PHI mode a subject can contain a task title.
    console.warn(`[email] SMTP not configured — skipping notification email to ${opts.to}`);
    return false;
  }

  try {
    await transport.sendMail({
      from: emailFrom(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return true;
  } catch (err) {
    console.error(`[email] Failed to send to ${opts.to}:`, err);
    return false;
  }
}
