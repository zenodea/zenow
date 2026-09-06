import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  passphrase: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

export async function hashPassphrase(passphrase: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(passphrase.normalize("NFKC"), salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassphrase(passphrase: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(passphrase.normalize("NFKC"), Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
