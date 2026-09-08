import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Tenant credentials are other people's secrets: an LLM key that costs them
 * money and a Fly token that can act on their infrastructure. They are stored
 * encrypted, and the key never lives in the database.
 */
function key(): Buffer {
  const raw = process.env.CREDENTIALS_KEY;
  if (!raw) throw new Error("CREDENTIALS_KEY is not set");

  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 32) {
    throw new Error("CREDENTIALS_KEY must be 32 bytes of base64 (openssl rand -base64 32)");
  }
  return bytes;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const enciphered = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enciphered]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const raw = Buffer.from(stored, "base64");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = raw.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

/** What the UI is allowed to show once a secret has been stored. */
export function hint(plaintext: string): string {
  return plaintext.length <= 8 ? "•".repeat(plaintext.length) : `${plaintext.slice(0, 3)}…${plaintext.slice(-4)}`;
}
