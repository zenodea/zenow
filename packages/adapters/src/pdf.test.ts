import { describe, expect, it } from "vitest";
import { extractPdf, pdfAdapter } from "./pdf.js";
import { AdapterError } from "./types.js";

/** A one-page PDF, built here so the repository carries no binary fixture. */
function minimalPdf(lines: string[]): Uint8Array {
  const stream = ["BT /F1 12 Tf 72 720 Td 14 TL", ...lines.map((line) => `(${line}) Tj T*`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const startxref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;

  return new TextEncoder().encode(body);
}

const url = new URL("https://example.com/papers/attention-is-all-you-need.pdf");

describe("extractPdf", () => {
  it("reads the text out of a pdf", async () => {
    const lines = Array.from({ length: 8 }, (_, i) => `Line ${i}: the quick brown fox jumps the lazy dog.`);
    const fetched = await extractPdf(minimalPdf(lines), url);

    expect(fetched.text).toContain("Line 7: the quick brown fox");
    expect(fetched.sourceType).toBe("pdf");
    expect(fetched.meta.pages).toBe(1);
  });

  it("falls back to the file name when the pdf carries no title", async () => {
    const lines = Array.from({ length: 8 }, () => "Long enough to clear the minimum length.");
    const fetched = await extractPdf(minimalPdf(lines), url);
    expect(fetched.title).toBe("attention is all you need");
  });

  it("rejects bytes that are not a pdf at all", async () => {
    const html = new TextEncoder().encode("<!doctype html><p>not a pdf</p>");
    await expect(extractPdf(html, url)).rejects.toThrow(AdapterError);
  });

  it("says so rather than summarising nothing when a pdf is scanned images", async () => {
    await expect(extractPdf(minimalPdf(["hi"]), url)).rejects.toThrow(/scanned/);
  });
});

describe("pdfAdapter.match", () => {
  it.each([
    ["https://example.com/a/b.pdf", true],
    ["https://example.com/a/b.PDF", true],
    ["https://arxiv.org/pdf/1706.03762", true],
    ["https://arxiv.org/abs/1706.03762", false],
    ["https://example.com/pdf-viewer", false],
  ])("%s → %s", (href, expected) => {
    expect(pdfAdapter.match(new URL(href))).toBe(expected);
  });
});
