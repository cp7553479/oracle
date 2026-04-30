import fs from "node:fs/promises";
import path from "node:path";
import type { BrowserLogger, ChromeClient } from "./types.js";
import { getOracleHomeDir } from "../oracleHome.js";

const GENERATED_IMAGE_URL_FRAGMENT = "/backend-api/estuary/content?id=file_";

interface BrowserGeneratedImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  fileId?: string;
}

interface SavedBrowserImage extends BrowserGeneratedImage {
  path: string;
  finalUrl?: string;
  contentType?: string;
  sizeBytes?: number;
}

function extractFileId(url: string): string | undefined {
  try {
    return new URL(url).searchParams.get("id") ?? undefined;
  } catch {
    return undefined;
  }
}

function contentTypeToExtension(contentType: string | null): string {
  const value = String(contentType ?? "").toLowerCase();
  if (value.includes("png")) return "png";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("webp")) return "webp";
  return "bin";
}

function siblingPath(basePath: string, index: number, extension: string): string {
  const resolved = path.resolve(basePath);
  const ext = path.extname(resolved);
  const dir = path.dirname(resolved);
  const stem = ext ? path.basename(resolved, ext) : path.basename(resolved);
  if (index === 0) return ext ? resolved : path.join(dir, `${stem}.${extension}`);
  return ext
    ? path.join(dir, `${stem}.${index + 1}${ext}`)
    : path.join(dir, `${stem}.${index + 1}.${extension}`);
}

function sanitizeImageStem(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function defaultImagePath(images: BrowserGeneratedImage[]): string {
  const first = images[0];
  const stem = sanitizeImageStem(first?.fileId || first?.alt || "generated-image");
  return path.join(getOracleHomeDir(), ".temp", `${stem || "generated-image"}.png`);
}

function dedupeImages(images: BrowserGeneratedImage[]): BrowserGeneratedImage[] {
  const seen = new Set<string>();
  const result: BrowserGeneratedImage[] = [];
  for (const image of images) {
    const key = image.fileId ?? image.url;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(image);
  }
  return result;
}

function imageMarkdown(images: SavedBrowserImage[]): string {
  if (images.length === 0) return "";
  const links = images
    .map((image, index) => {
      const alt = images.length > 1 ? `Generated image ${index + 1}` : "Generated image";
      return `![${alt}](${image.path})`;
    })
    .join("\n");
  const savedPaths =
    images.length === 1
      ? `Generated image file: ${images[0]?.path}`
      : [
          `Generated image files (${images.length}):`,
          ...images.map((image, index) => `${index + 1}. ${image.path}`),
        ].join("\n");
  const summary =
    images.length > 1
      ? `Generated ${images.length} image(s).`
      : `Generated 1 image(s). Saved to: ${images[0]?.path}`;
  return `\n\n${links}\n\n*${summary}*\n${savedPaths}`;
}

export async function readAssistantGeneratedImages(
  Runtime: ChromeClient["Runtime"],
  minTurnIndex?: number,
): Promise<BrowserGeneratedImage[]> {
  const minTurnLiteral =
    typeof minTurnIndex === "number" && Number.isFinite(minTurnIndex) && minTurnIndex >= 0
      ? Math.max(0, Math.floor(minTurnIndex) - 1)
      : -1;
  const { result } = await Runtime.evaluate({
    expression: `(() => {
      const turns = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn"], div[data-testid^="conversation-turn"], section[data-testid^="conversation-turn"], article[data-message-author-role], div[data-message-author-role], section[data-message-author-role], article[data-turn], div[data-turn], section[data-turn]'));
      for (let index = turns.length - 1; index >= 0; index -= 1) {
        if (${minTurnLiteral} >= 0 && index < ${minTurnLiteral}) continue;
        const turn = turns[index];
        const role = String(turn.getAttribute('data-message-author-role') || turn.getAttribute('data-turn') || '').toLowerCase();
        const testId = String(turn.getAttribute('data-testid') || '').toLowerCase();
        const isAssistant = role === 'assistant' || testId.includes('assistant') || Boolean(turn.querySelector('[data-message-author-role="assistant"], [data-turn="assistant"], [data-testid*="assistant"]'));
        if (!isAssistant) continue;
        const candidates = [];
        const push = (url, source, meta = {}) => {
          if (!url || typeof url !== 'string') return;
          if (!url.includes(${JSON.stringify(GENERATED_IMAGE_URL_FRAGMENT)})) return;
          candidates.push({ url, source, ...meta });
        };
        for (const img of Array.from(turn.querySelectorAll('img'))) {
          const meta = {
            alt: img.alt || '',
            width: img.naturalWidth || 0,
            height: img.naturalHeight || 0,
          };
          push(img.currentSrc || '', 'currentSrc', meta);
          push(img.src || '', 'src', meta);
          const srcset = img.getAttribute('srcset') || '';
          for (const entry of srcset.split(',')) {
            push(entry.trim().split(/\\s+/)[0] || '', 'srcset', meta);
          }
        }
        for (const anchor of Array.from(turn.querySelectorAll('a[href]'))) {
          push(anchor.href || anchor.getAttribute('href') || '', 'href', {
            alt: anchor.getAttribute('aria-label') || anchor.textContent || '',
            width: 0,
            height: 0,
          });
        }
        const images = candidates.map(({ url, alt, width, height }) => ({ url, alt, width, height }));
        if (images.length > 0) return images;
      }
      return [];
    })()`,
    returnByValue: true,
  });
  const raw = Array.isArray(result?.value) ? result.value : [];
  return dedupeImages(
    raw
      .map((item) => ({
        url: typeof item?.url === "string" ? item.url : "",
        alt: typeof item?.alt === "string" ? item.alt : undefined,
        width: typeof item?.width === "number" ? item.width : undefined,
        height: typeof item?.height === "number" ? item.height : undefined,
        fileId: typeof item?.url === "string" ? extractFileId(item.url) : undefined,
      }))
      .filter((item) => item.url.length > 0),
  );
}

async function downloadImageInBrowser(
  Runtime: ChromeClient["Runtime"],
  url: string,
): Promise<{
  buffer: Buffer;
  finalUrl?: string;
  contentType?: string;
} | null> {
  const { result } = await Runtime.evaluate({
    expression: `(async () => {
      const response = await fetch(${JSON.stringify(url)}, { credentials: 'include' });
      if (!response.ok) {
        return { ok: false, status: response.status, statusText: response.statusText };
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      return {
        ok: true,
        finalUrl: response.url,
        contentType: response.headers.get('content-type') || undefined,
        base64: btoa(binary),
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const value = result?.value as
    | { ok?: unknown; base64?: unknown; finalUrl?: unknown; contentType?: unknown }
    | undefined;
  if (!value?.ok || typeof value.base64 !== "string") {
    return null;
  }
  return {
    buffer: Buffer.from(value.base64, "base64"),
    finalUrl: typeof value.finalUrl === "string" ? value.finalUrl : undefined,
    contentType: typeof value.contentType === "string" ? value.contentType : undefined,
  };
}

async function downloadImageWithCookies(
  Network: ChromeClient["Network"],
  image: BrowserGeneratedImage,
): Promise<{
  buffer: Buffer;
  finalUrl?: string;
  contentType?: string;
}> {
  const header = await cookieHeader(Network);
  if (!header) throw new Error("Missing ChatGPT cookies for image download.");

  const response = await fetch(image.url, {
    headers: { cookie: header, "user-agent": "Mozilla/5.0" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`download failed: ${response.status} ${response.statusText}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    finalUrl: response.url,
    contentType: response.headers.get("content-type") ?? undefined,
  };
}

async function downloadImage(params: {
  Runtime?: ChromeClient["Runtime"];
  Network: ChromeClient["Network"];
  image: BrowserGeneratedImage;
}): Promise<{
  buffer: Buffer;
  finalUrl?: string;
  contentType?: string;
}> {
  if (params.Runtime) {
    const browserDownload = await downloadImageInBrowser(params.Runtime, params.image.url).catch(
      () => null,
    );
    if (browserDownload) {
      return browserDownload;
    }
  }
  return downloadImageWithCookies(params.Network, params.image);
}

export async function saveChatGptGeneratedImages(params: {
  Runtime?: ChromeClient["Runtime"];
  Network: ChromeClient["Network"];
  images: BrowserGeneratedImage[];
  outputPath: string;
  logger?: BrowserLogger;
}): Promise<SavedBrowserImage[]> {
  await fs.mkdir(path.dirname(path.resolve(params.outputPath)), { recursive: true });
  const saved: SavedBrowserImage[] = [];
  for (let index = 0; index < params.images.length; index += 1) {
    const image = params.images[index];
    const downloaded = await downloadImage({
      Runtime: params.Runtime,
      Network: params.Network,
      image,
    });
    const targetPath = siblingPath(
      params.outputPath,
      index,
      contentTypeToExtension(downloaded.contentType ?? null),
    );
    await fs.writeFile(targetPath, downloaded.buffer);
    saved.push({
      ...image,
      path: targetPath,
      finalUrl: downloaded.finalUrl,
      contentType: downloaded.contentType,
      sizeBytes: downloaded.buffer.length,
    });
  }
  return saved;
}

async function cookieHeader(Network: ChromeClient["Network"]): Promise<string> {
  const response = await Network.getCookies({ urls: ["https://chatgpt.com/"] });
  return (response.cookies ?? [])
    .filter((cookie) => cookie.name && typeof cookie.value === "string")
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export async function collectGeneratedImageArtifacts(params: {
  Runtime: ChromeClient["Runtime"];
  Network: ChromeClient["Network"];
  logger?: BrowserLogger;
  minTurnIndex?: number | null;
  generateImagePath?: string;
  outputPath?: string;
  answerText: string;
}): Promise<{
  generatedImages: BrowserGeneratedImage[];
  savedImages: SavedBrowserImage[];
  markdownSuffix: string;
}> {
  const generatedImages = await readAssistantGeneratedImages(
    params.Runtime,
    params.minTurnIndex ?? undefined,
  );
  if (generatedImages.length === 0) {
    if (params.generateImagePath) {
      throw new Error(
        `No images generated. Response text:\n${params.answerText || "(empty response)"}`,
      );
    }
    return { generatedImages: [], savedImages: [], markdownSuffix: "" };
  }

  const targetPath =
    params.generateImagePath ?? params.outputPath ?? defaultImagePath(generatedImages);
  const savedImages = await saveChatGptGeneratedImages({
    Runtime: params.Runtime,
    Network: params.Network,
    images: generatedImages,
    outputPath: targetPath,
    logger: params.logger,
  });
  return { generatedImages, savedImages, markdownSuffix: imageMarkdown(savedImages) };
}
