import { afterEach, expect, test, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createRemoteServer } from "../../src/remote/server.js";
import { resolveBrowserExecutor } from "../../src/browser/executor.js";

// Fork policy: host-side Gemini cookies come from the persistent manual-login
// profile via CDP instead of the host keychain, so the fixture mocks the CDP
// session used by loadGeminiCookiesFromCDP.
const openGeminiBrowserSession = vi.hoisted(() => vi.fn());
vi.mock("../../src/gemini-web/browserSessionManager.js", () => ({
  openGeminiBrowserSession,
}));

function cdpSessionWithHostCookies() {
  return {
    client: {
      Network: {
        enable: vi.fn(async () => undefined),
        getCookies: vi.fn(async () => ({
          cookies: [
            { name: "__Secure-1PSID", value: "synthetic-host-session", domain: ".google.com" },
            { name: "__Secure-1PSIDTS", value: "synthetic-host-timestamp", domain: ".google.com" },
          ],
        })),
      },
      Page: {
        enable: vi.fn(async () => undefined),
        navigate: vi.fn(async () => undefined),
      },
    },
    close: vi.fn(async () => undefined),
  };
}

afterEach(() => vi.restoreAllMocks());

test("remote Gemini executes the real web client against a recorded protocol fixture with host cookies", async () => {
  // Synthetic content in the same wire envelope used by the Gemini parser fixtures.
  const response = await readFile(
    new URL("../fixtures/gemini-web/remote-response.txt", import.meta.url),
    "utf8",
  );
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    requests.push(url);
    const cookies = new Headers(init?.headers).get("cookie");
    expect(cookies).toContain("synthetic-host-session");
    expect(cookies).not.toContain("synthetic-client-session");
    if (url === "https://gemini.google.com/app")
      return new Response('<html>"SNlM0e":"synthetic-access-token"</html>');
    if (url.includes("/StreamGenerate")) {
      expect(String(init?.body)).toContain("fixture");
      return new Response(response);
    }
    throw new Error(`Unexpected fixture request: ${url}`);
  });
  openGeminiBrowserSession.mockResolvedValue(cdpSessionWithHostCookies());
  const server = await createRemoteServer({
    host: "127.0.0.1",
    logger: () => {},
  });
  try {
    const execute = await resolveBrowserExecutor(
      { model: "gemini-3.5-flash", geminiAllowModelFallback: false },
      { host: `127.0.0.1:${server.port}`, token: server.token },
    );
    const result = await execute({
      prompt: "fixture",
      model: "gemini-3.5-flash",
      config: {
        inlineCookies: [
          { name: "__Secure-1PSID", value: "synthetic-client-session", domain: ".google.com" },
        ],
      },
    });
    expect(result.answerText).toBe("ORACLE_REMOTE_GEMINI_392_OK");
    expect(openGeminiBrowserSession).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(2);
    expect(requests.every((url) => url.startsWith("https://gemini.google.com/"))).toBe(true);
  } finally {
    await server.close();
  }
});
