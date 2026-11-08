import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 1024 * 1024;
const EXT: Record<string, string> = { png: "png", jpeg: "jpg", webp: "webp", gif: "gif" };
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
export const PLACEHOLDER_IMAGE = "/images/product-placeholder.svg";

/**
 * Accepts an https URL, an existing local path, or a base64 data URL from the upload field.
 * SVG is deliberately rejected for uploads because it can carry scripts.
 */
export async function resolveImage(input: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const value = input.trim();
  if (!value) return { ok: true, url: PLACEHOLDER_IMAGE };
  if (/^\/(uploads|images)\/[\w.-]+$/.test(value)) return { ok: true, url: value };
  if (value.startsWith("data:")) {
    const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) return { ok: false, error: "Upload a PNG, JPG, WebP or GIF image." };
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > MAX_BYTES) return { ok: false, error: "Choose an image smaller than 1 MB." };
    const name = `${randomUUID()}.${EXT[match[1]]}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), bytes);
    return { ok: true, url: `/uploads/${name}` };
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return { ok: true, url: url.toString() };
  } catch { /* fall through */ }
  return { ok: false, error: "Enter a valid image URL or upload a file." };
}

/** Best-effort cleanup of files we wrote; never throws. */
export async function removeUpload(url: string) {
  const match = /^\/uploads\/([\w.-]+)$/.exec(url);
  if (match) await unlink(path.join(UPLOAD_DIR, match[1])).catch(() => {});
}
