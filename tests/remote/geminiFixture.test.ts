import { afterEach, expect, test, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createRemoteServer } from "../../src/remote/server.js";
import { resolveBrowserExecutor } from "../../src/browser/executor.js";

const {
  launchChrome,
  connectWithNewTab,
  closeTab,
  killChrome,
  resolveBrowserConfig,
  readDevToolsPort,
  writeDevToolsActivePort,
  writeChromePid,
  cleanupStaleProfileState,
  verifyDevToolsReachable,
  delay,
} = vi.hoisted(() => ({
  launchChrome: vi.fn(),
  connectWithNewTab: vi.fn(),
  closeTab: vi.fn(async () => undefined),
  killChrome: vi.fn(async () => undefined),
  resolveBrowserConfig: vi.fn((input: unknown) => input),
  readDevToolsPort: vi.fn(async () => null),
  writeDevToolsActivePort: vi.fn(async () => undefined),
  writeChromePid: vi.fn(async () => undefined),
  cleanupStaleProfileState: vi.fn(async () => undefined),
  verifyDevToolsReachable: vi.fn(async () => ({ ok: false, error: "unreachable" })),
  delay: vi.fn(async () => undefined),
}));

vi.mock("../../src/browser/chromeLifecycle.js", () => ({
  launchChrome,
  connectWithNewTab,
  closeTab,
}));
vi.mock("../../src/browser/config.js", () => ({
  resolveBrowserConfig,
}));
vi.mock("../../src/browser/profileState.js", () => ({
  readDevToolsPort,
  writeDevToolsActivePort,
  writeChromePid,
  cleanupStaleProfileState,
  verifyDevToolsReachable,
}));
vi.mock("../../src/browser/utils.js", () => ({
  delay,
  normalizeChatgptUrl: (url?: string, fallback?: string) =>
    url ?? fallback ?? "https://chatgpt.com",
}));

function hostProfileCookies() {
  return [
    {
      name: "__Secure-1PSID",
      value: "synthetic-host-session",
      domain: ".google.com",
      path: "/",
      secure: true,
      httpOnly: true,
    },
    {
      name: "__Secure-1PSIDTS",
      value: "synthetic-host-timestamp",
      domain: ".google.com",
      path: "/",
      secure: true,
      httpOnly: true,
    },
  ];
}

afterEach(() => vi.restoreAllMocks());

test("remote Gemini executes the real web client against a recorded protocol fixture with the host persistent profile", async () => {
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

  launchChrome.mockResolvedValue({ port: 9333, pid: 4242, kill: killChrome });
  connectWithNewTab.mockResolvedValue({
    targetId: "gemini-fixture-tab",
    client: {
      Network: {
        enable: vi.fn(async () => undefined),
        getCookies: vi.fn(async () => ({ cookies: hostProfileCookies() })),
      },
      Page: {
        enable: vi.fn(async () => undefined),
        navigate: vi.fn(async () => ({ frameId: "f-1" })),
      },
      close: vi.fn(async () => undefined),
    },
  });

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
    expect(connectWithNewTab).toHaveBeenCalled();
    expect(requests).toHaveLength(2);
    expect(requests.every((url) => url.startsWith("https://gemini.google.com/"))).toBe(true);
  } finally {
    await server.close();
  }
});
