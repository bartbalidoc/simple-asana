import nodemailer from "nodemailer";

// Simple transactional email. Best-effort: sends never throw.
// NOT HIPAA-hardened — interim non-PHI notifications until a proper setup.
//
// Transports, in priority order (all the API ones work over HTTPS:443, which is
// required because the host blocks outbound SMTP):
//  1. SendGrid HTTP API — set SENDGRID_API_KEY. Supports "single sender
//     verification" (verify just one From address by clicking an email — NO DNS).
//  2. Resend HTTP API — set RESEND_API_KEY (needs a verified domain to send from @balidoc.com).
//  3. SMTP (nodemailer) — set SMTP_USER/SMTP_PASS. Only where SMTP ports are open.
//
// `EMAIL_FROM` is the visible From, e.g. "BaliDoc <info@balidoc.com>" — it must be
// a verified sender in whichever provider you use.

// Parse "Name <email>" or "email" into the parts SendGrid's JSON API needs.
function parseFrom(): { email: string; name?: string } {
  const raw = process.env.EMAIL_FROM || process.env.SMTP_USER || "info@balidoc.com";
  const m = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1] || undefined, email: m[2] };
  return { email: raw.trim() };
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || "info@balidoc.com";
}

export function emailEnabled(): boolean {
  return !!(
    process.env.GAS_EMAIL_URL ||
    process.env.SENDGRID_API_KEY ||
    process.env.RESEND_API_KEY ||
    (process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

// Send through a Google Apps Script web app that calls GmailApp.sendEmail as the
// owning Gmail account (info@balidoc.com). Works over HTTPS (no SMTP needed) and
// can email anyone — no domain DNS, no third-party email service.
// Set GAS_EMAIL_URL (the web-app URL) and GAS_EMAIL_SECRET (shared secret).
async function sendViaGas(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(process.env.GAS_EMAIL_URL as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.GAS_EMAIL_SECRET || "",
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
      redirect: "follow", // Apps Script web apps 302 → googleusercontent before 200
    });
    const body = await res.text();
    if (!res.ok || !body.includes('"ok":true')) {
      console.error("GAS email failed:", res.status, body.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("GAS email error:", err);
    return false;
  }
}

async function sendViaSendgrid(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  try {
    const content: { type: string; value: string }[] = [
      { type: "text/plain", value: opts.text },
    ];
    if (opts.html) content.push({ type: "text/html", value: opts.html });
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }] }],
        from: parseFrom(),
        subject: opts.subject,
        content,
      }),
    });
    if (!res.ok && res.status !== 202) {
      console.error("SendGrid send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("SendGrid send error:", err);
    return false;
  }
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
  if (process.env.GAS_EMAIL_URL) return sendViaGas(opts);
  if (process.env.SENDGRID_API_KEY) return sendViaSendgrid(opts);
  if (process.env.RESEND_API_KEY) return sendViaResend(opts);
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return sendViaSmtp(opts);
  return false;
}
