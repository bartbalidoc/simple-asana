import crypto from "crypto";

// Resolve and validate the key lazily so this module can be imported during
// `next build` (page-data collection) without a real key present. Validation
// happens the first time encryption is actually used at runtime.
let keyBuffer: Buffer | null = null;

function getKey(): Buffer {
  if (keyBuffer) return keyBuffer;

  const PHI_ENCRYPTION_KEY = process.env.PHI_ENCRYPTION_KEY;

  if (!PHI_ENCRYPTION_KEY) {
    throw new Error(
      "PHI_ENCRYPTION_KEY environment variable is not set. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  const buf = Buffer.from(PHI_ENCRYPTION_KEY, "hex");

  if (buf.length !== 32) {
    throw new Error(
      "PHI_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)"
    );
  }

  keyBuffer = buf;
  return keyBuffer;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "hex")]);
  return combined.toString("base64");
}

export function decrypt(ciphertext: string): string {
  const combined = Buffer.from(ciphertext, "base64");

  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const encrypted = combined.subarray(28).toString("hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
