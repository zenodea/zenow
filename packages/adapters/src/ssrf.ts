import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AdapterError } from "./types.js";

/**
 * Refuses to fetch anything that resolves to an address inside the network the
 * worker is running on.
 *
 * Without this, a url is a way to make the worker talk to things only it can
 * reach: 127.0.0.1, the private ranges, and above all 169.254.169.254, the
 * cloud metadata endpoint that hands out credentials. That was already true
 * for a pasted link; a research agent choosing its own urls makes it worse,
 * because nobody has to be tricked into pasting anything.
 *
 * DNS is resolved here rather than trusting the hostname, since a name under
 * someone else's control can simply point at a private address.
 */
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function toInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const value = toInt(address);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (value & mask) === (toInt(base) & mask);
    });
  }

  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)) return true;
    // IPv4-mapped, e.g. ::ffff:169.254.169.254
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return false;
  }

  return false;
}

export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AdapterError("unsupported", `Refusing to fetch a ${url.protocol} url`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new AdapterError("unsupported", `Refusing to fetch a private address (${host})`);
    }
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new AdapterError("http_error", `Could not resolve ${host}`);
  }

  // Every answer must be public: one private result is enough to be a way in.
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new AdapterError("unsupported", `${host} resolves to a private address (${address})`);
    }
  }
}
