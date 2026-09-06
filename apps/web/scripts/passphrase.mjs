// Prints a LOGIN_PASSPHRASE_HASH value. Keep the format in step with
// apps/web/lib/passphrase.ts, which verifies against it: scrypt:<salt>:<key>
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

let passphrase = process.argv[2];
if (!passphrase) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  passphrase = await rl.question("Passphrase: ");
  rl.close();
}
if (!passphrase) {
  console.error("No passphrase given");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await scrypt(passphrase.normalize("NFKC"), salt, 64);
console.log(`scrypt:${salt.toString("hex")}:${key.toString("hex")}`);
