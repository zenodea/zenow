import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPrivateAddress } from "./ssrf.js";
import { AdapterError } from "./types.js";

describe("isPrivateAddress", () => {
  it("blocks the addresses a url should never reach", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata, the one that hands out credentials
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fe80::1",
      "fd00::1",
      "::ffff:169.254.169.254",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    for (const address of ["1.1.1.1", "8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700::1111"]) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });
});

describe("assertPublicUrl", () => {
  it("rejects a literal private address", async () => {
    await expect(assertPublicUrl(new URL("http://169.254.169.254/latest/meta-data/"))).rejects.toThrow(AdapterError);
    await expect(assertPublicUrl(new URL("http://127.0.0.1:8080/"))).rejects.toThrow(/private address/);
  });

  it("rejects a hostname that resolves to one", async () => {
    // localhost is the honest case: a name someone else controls can do this too.
    await expect(assertPublicUrl(new URL("http://localhost:3000/"))).rejects.toThrow(/private address/);
  });

  it("rejects non-http schemes", async () => {
    await expect(assertPublicUrl(new URL("file:///etc/passwd"))).rejects.toThrow(/Refusing/);
  });

  it("allows a normal public host", async () => {
    await expect(assertPublicUrl(new URL("https://example.com/"))).resolves.toBeUndefined();
  });
});
