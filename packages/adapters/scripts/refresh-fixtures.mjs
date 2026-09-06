// Re-downloads the pages in fixtures/manifest.json.
// Run after a Readability bump to see what actually changed: pnpm fixtures:refresh
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const manifest = JSON.parse(await readFile(join(fixtures, "manifest.json"), "utf8"));

await mkdir(fixtures, { recursive: true });

for (const { name, url } of manifest) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!response.ok) {
    console.error(`${name}: ${response.status} ${url}`);
    continue;
  }
  const body = await response.text();
  await writeFile(join(fixtures, `${name}.html`), body);
  console.log(`${name}: ${body.length} bytes`);
}
