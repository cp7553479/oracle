import { afterEach, describe, expect, test, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  collectGeneratedImageArtifacts,
  readAssistantGeneratedImages,
  saveChatGptGeneratedImages,
} from "../../src/browser/chatgptImages.js";
import type { ChromeClient } from "../../src/browser/types.js";
import { setOracleHomeDirOverrideForTest } from "../../src/oracleHome.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  setOracleHomeDirOverrideForTest(null);
  vi.restoreAllMocks();
});

describe("ChatGPT generated images", () => {
  test("reads generated images from the assistant turn", async () => {
    const evaluate = vi.fn().mockResolvedValue({
      result: {
        value: [
          {
            url: "https://chatgpt.com/backend-api/estuary/content?id=file_a",
            alt: "one",
            width: 1024,
            height: 1024,
          },
          {
            url: "https://chatgpt.com/backend-api/estuary/content?id=file_a",
            alt: "",
            width: 1024,
            height: 1024,
          },
        ],
      },
    });
    const runtime = {
      evaluate,
    } as unknown as ChromeClient["Runtime"];

    const images = await readAssistantGeneratedImages(runtime, 1);

    expect(images).toEqual([
      expect.objectContaining({
        url: "https://chatgpt.com/backend-api/estuary/content?id=file_a",
        fileId: "file_a",
      }),
    ]);
    const expression = String(evaluate.mock.calls[0]?.[0]?.expression ?? "");
    expect(expression).toContain("img.currentSrc");
    expect(expression).toContain("srcset");
    expect(expression).toContain("a[href]");
    expect(expression).toContain("if (images.length > 0) return images;");
  });

  test("saves generated images through the browser context when available", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "oracle-chatgpt-browser-images-"));
    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            ok: true,
            finalUrl: "https://chatgpt.com/backend-api/estuary/content?id=file_browser",
            contentType: "image/png",
            base64: Buffer.from([10, 11, 12]).toString("base64"),
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];
    const network = {
      getCookies: vi.fn(),
    } as unknown as ChromeClient["Network"];

    const saved = await saveChatGptGeneratedImages({
      Runtime: runtime,
      Network: network,
      images: [{ url: "https://chatgpt.com/backend-api/estuary/content?id=file_browser" }],
      outputPath: path.join(tmpDir, "browser.png"),
    });

    expect(network.getCookies).not.toHaveBeenCalled();
    expect(saved[0]?.path).toBe(path.join(tmpDir, "browser.png"));
    await expect(fs.readFile(path.join(tmpDir, "browser.png"))).resolves.toEqual(
      Buffer.from([10, 11, 12]),
    );
  });

  test("saves generated image files", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "oracle-chatgpt-images-"));
    const network = {
      getCookies: vi.fn().mockResolvedValue({
        cookies: [{ name: "__Secure-next-auth.session-token", value: "abc" }],
      }),
    } as unknown as ChromeClient["Network"];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://files.local/1",
      headers: { get: (name: string) => (name === "content-type" ? "image/png" : null) },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    } as Response);

    const saved = await saveChatGptGeneratedImages({
      Network: network,
      images: [{ url: "https://chatgpt.com/backend-api/estuary/content?id=file_1" }],
      outputPath: path.join(tmpDir, "generated.png"),
    });

    expect(saved[0]?.path).toBe(path.join(tmpDir, "generated.png"));
    await expect(fs.readFile(path.join(tmpDir, "generated.png"))).resolves.toEqual(
      Buffer.from([1, 2, 3]),
    );
  });

  test("post-processes images after the normal assistant response", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "oracle-chatgpt-artifacts-"));
    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: [{ url: "https://chatgpt.com/backend-api/estuary/content?id=file_done" }],
        },
      }),
    } as unknown as ChromeClient["Runtime"];
    const network = {
      getCookies: vi.fn().mockResolvedValue({
        cookies: [{ name: "__Secure-next-auth.session-token", value: "abc" }],
      }),
    } as unknown as ChromeClient["Network"];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://files.local/done",
      headers: { get: (name: string) => (name === "content-type" ? "image/png" : null) },
      arrayBuffer: async () => Uint8Array.from([4, 5, 6]).buffer,
    } as Response);

    const result = await collectGeneratedImageArtifacts({
      Runtime: runtime,
      Network: network,
      generateImagePath: path.join(tmpDir, "done.png"),
      answerText: "Generated image",
    });

    expect(result.markdownSuffix).toContain("Saved to:");
    expect(result.markdownSuffix).toContain(`Generated image file: ${path.join(tmpDir, "done.png")}`);
    expect(result.savedImages[0]?.path).toBe(path.join(tmpDir, "done.png"));
  });

  test("prints every saved generated image path in plain text", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "oracle-chatgpt-multi-images-"));
    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: [
            { url: "https://chatgpt.com/backend-api/estuary/content?id=file_one" },
            { url: "https://chatgpt.com/backend-api/estuary/content?id=file_two" },
          ],
        },
      }),
    } as unknown as ChromeClient["Runtime"];
    const network = {
      getCookies: vi.fn().mockResolvedValue({
        cookies: [{ name: "__Secure-next-auth.session-token", value: "abc" }],
      }),
    } as unknown as ChromeClient["Network"];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://files.local/image",
      headers: { get: (name: string) => (name === "content-type" ? "image/png" : null) },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    } as Response);

    const result = await collectGeneratedImageArtifacts({
      Runtime: runtime,
      Network: network,
      generateImagePath: path.join(tmpDir, "image.png"),
      answerText: "Generated images",
    });

    expect(result.markdownSuffix).toContain("Generated image files (2):");
    expect(result.markdownSuffix).toContain(`1. ${path.join(tmpDir, "image.png")}`);
    expect(result.markdownSuffix).toContain(`2. ${path.join(tmpDir, "image.2.png")}`);
    await expect(fs.readFile(path.join(tmpDir, "image.png"))).resolves.toEqual(
      Buffer.from([1, 2, 3]),
    );
    await expect(fs.readFile(path.join(tmpDir, "image.2.png"))).resolves.toEqual(
      Buffer.from([1, 2, 3]),
    );
  });

  test("auto-saves returned images when no explicit image path is provided", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "oracle-chatgpt-auto-images-"));
    setOracleHomeDirOverrideForTest(tmpDir);
    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: [{ url: "https://chatgpt.com/backend-api/estuary/content?id=file_auto" }],
        },
      }),
    } as unknown as ChromeClient["Runtime"];
    const network = {
      getCookies: vi.fn().mockResolvedValue({
        cookies: [{ name: "__Secure-next-auth.session-token", value: "abc" }],
      }),
    } as unknown as ChromeClient["Network"];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://files.local/auto",
      headers: { get: (name: string) => (name === "content-type" ? "image/png" : null) },
      arrayBuffer: async () => Uint8Array.from([7, 8, 9]).buffer,
    } as Response);

    const result = await collectGeneratedImageArtifacts({
      Runtime: runtime,
      Network: network,
      answerText: "Generated image",
    });

    expect(result.savedImages[0]?.path).toBe(path.join(tmpDir, ".temp", "file_auto.png"));
    await expect(fs.readFile(path.join(tmpDir, ".temp", "file_auto.png"))).resolves.toEqual(
      Buffer.from([7, 8, 9]),
    );
  });

  test("does not fail a text-only response when only output path is present", async () => {
    const runtime = {
      evaluate: vi.fn().mockResolvedValue({ result: { value: [] } }),
    } as unknown as ChromeClient["Runtime"];
    const network = {
      getCookies: vi.fn(),
    } as unknown as ChromeClient["Network"];

    const result = await collectGeneratedImageArtifacts({
      Runtime: runtime,
      Network: network,
      outputPath: "/tmp/not-used.png",
      answerText: "plain text",
    });

    expect(result.savedImages).toEqual([]);
    expect(result.markdownSuffix).toBe("");
  });
});
