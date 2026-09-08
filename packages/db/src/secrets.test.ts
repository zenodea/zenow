import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hint } from "./secrets.js";

beforeAll(() => {
  process.env.CREDENTIALS_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("encryptSecret", () => {
  it("round-trips", () => {
    const secret = "sk-or-v1-abcdef0123456789";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("produces a different ciphertext every time", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("refuses to decrypt tampered data", () => {
    const stored = Buffer.from(encryptSecret("secret"), "base64");
    const last = stored.length - 1;
    stored.writeUInt8(stored.readUInt8(last) ^ 0xff, last);
    expect(() => decryptSecret(stored.toString("base64"))).toThrow();
  });

  it("rejects a key that is not 32 bytes", () => {
    const previous = process.env.CREDENTIALS_KEY;
    process.env.CREDENTIALS_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
    process.env.CREDENTIALS_KEY = previous;
  });
});

describe("hint", () => {
  it("shows enough to recognise a key without revealing it", () => {
    expect(hint("sk-or-v1-abcdef0123456789")).toBe("sk-…6789");
    expect(hint("short")).toBe("•••••");
  });
});
