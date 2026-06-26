import nodemailer from "nodemailer";

// Simple transactional email. Best-effort: sends never throw.
// NOT HIPAA-hardened — interim non-PHI notifications until a proper setup.
//
// Two transports, in priority order:
//  1. Resend HTTP API (works over HTTPS:443) — set RESEND_API_KEY. This is the
//     option that works on hosts that block outbound SMTP (e.g. DigitalOcean).
//  2. SMTP (nodemailer) — set SMTP_USER/SMTP_PASS (e.g. Gmail App Password).
//     Only works where outbound SMTP ports (587/465) are open.
//
// `EMAIL_FROM` is the visible From (e.g. "BaliDoc <notifications@balidoc.com>").
// For Resend the From domain must be verified in Resend (or use onboarding@resend.dev).

function fromAddress(): string {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    "BaliDoc <onboarding@resend.dev>"
  );
}

export function emailEnabled(): boolean {
  return !!(
    process.env.RESEND_API_KEY ||
    (process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      console.error("Resend send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend send error:", err);
    return false;
  }
}

let transporter: nodemailer.Transporter | null = null;
let smtpResolved = false;
function getTransporter(): nodemailer.Transporter | null {
  if (smtpResolved) return transporter;
  smtpResolved = true;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return (transporter = null);
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

async function sendViaSmtp(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({ from: fromAddress(), ...opts });
    return true;
  } catch (err) {
    console.error("SMTP send failed:", err);
    return false;
  }
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  if (process.env.RESEND_API_KEY) return sendViaResend(opts);
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return sendViaSmtp(opts);
  return false;
}
