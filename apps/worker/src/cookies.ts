import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "./env.js";
import { log } from "./logger.js";

/**
 * yt-dlp wants cookies as a file. Carrying them as an environment variable
 * keeps them out of the image and lets a Fly secret hold them, so they are
 * written to a private temp file once at boot.
 */
export function writeYoutubeCookies(): string | undefined {
  if (!env.youtubeCookies.trim()) return undefined;

  try {
    const path = join(mkdtempSync(join(tmpdir(), "zenow-")), "youtube-cookies.txt");
    // Netscape format needs real newlines; a secret usually arrives escaped.
    writeFileSync(path, env.youtubeCookies.replace(/\\n/g, "\n"), { mode: 0o600 });
    log.info("youtube cookies loaded");
    return path;
  } catch (error) {
    log.warn("could not write youtube cookies", { error: String(error) });
    return undefined;
  }
}
