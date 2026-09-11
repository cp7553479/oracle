import chalk from "chalk";
import type { BrowserSessionConfig } from "../sessionStore.js";
import type { ModelName, ThinkingTimeLevel } from "../oracle/types.js";
import { normalizeThinkingTimeLevel } from "../oracle/thinkingTime.js";
import { CHATGPT_URL, DEFAULT_MODEL_STRATEGY, DEFAULT_MODEL_TARGET } from "../browser/constants.js";
import { normalizeChatgptUrl } from "../browser/utils.js";
import { parseDuration } from "../duration.js";
import { resolveBrowserApprovalWait } from "../browser/config.js";
import { normalizeBrowserModelStrategy } from "../browser/modelStrategy.js";
import type {
  BrowserArchiveMode,
  BrowserModelStrategy,
  BrowserResearchMode,
} from "../browser/types.js";

const DEFAULT_BROWSER_TIMEOUT_MS = 1_200_000;
const DEFAULT_BROWSER_INPUT_TIMEOUT_MS = 60_000;
const DEFAULT_BROWSER_ATTACHMENT_TIMEOUT_MS = 45_000;
const DEFAULT_BROWSER_RECHECK_TIMEOUT_MS = 120_000;
const DEFAULT_BROWSER_AUTO_REATTACH_TIMEOUT_MS = 120_000;
const CURRENT_CHATGPT_PRO_ALIASES = new Set([
  "gpt-5-pro",
  "gpt-5.1-pro",
  "gpt-5.2-pro",
  "gpt-5.4-pro",
]);

// Ordered array: most specific models first to ensure correct selection.
// The browser label is passed to the model picker which fuzzy-matches against ChatGPT's UI.
const BROWSER_MODEL_LABELS: [ModelName, string][] = [
  // Most specific first (e.g., "gpt-5.2-thinking" before "gpt-5.2")
  // GPT-6 (Astra) has no entry of its own in the ChatGPT picker: it is the "Latest" radio of the
  // advanced view, and "GPT-6 Pro" is that radio with the power slider at Pro (composer pill "6 Pro").
  ["gpt-6-pro", "Latest"],
  ["gpt-6-astra", "Latest"],
  ["gpt-5.6-sol", "GPT-5.6 Sol"],
  ["gpt-5.6", "GPT-5.6 Sol"],
  ["gpt-5.5-pro", "GPT-5.5"],
  ["gpt-5.5-instant", "GPT-5.5 Instant"],
  ["gpt-5.5", "Thinking 5.5"],
  ["gpt-5.4-pro", "Pro"],
  ["gpt-5.2-thinking", "GPT-5.2 Thinking"],
  ["gpt-5.2-instant", "GPT-5.2 Instant"],
  ["gpt-5.2-pro", "Pro"],
  ["gpt-5.1-pro", "Pro"],
  ["gpt-5-pro", "Pro"],
  // Base models last (least specific)
  ["gpt-5.4", "Thinking 5.4"],
  ["gpt-5.2", "GPT-5.2"], // Selects "Auto" in ChatGPT UI
  ["gpt-5.1", "GPT-5.2"], // Legacy alias → Auto
  ["gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite"],
  ["gemini-3.5-flash", "Gemini 3.5 Flash"],
  ["gemini-3.1-pro", "Gemini 3.1 Pro"],
  ["gemini-3-pro", "Gemini 3.1 Pro"],
  ["gemini-3-pro-deep-think", "gemini-3-deep-think"],
];

export interface BrowserFlagOptions {
  browserChromeProfile?: string;
  browserChromePath?: string;
  browserCookiePath?: string;
  browserAttachRunning?: boolean;
  browserTab?: string;
  chatgptUrl?: string;
  browserUrl?: string;
  browserTimeout?: string;
  browserInputTimeout?: string;
  browserApprovalWait?: string;
  browserAttachmentTimeout?: string;
  browserRecheckDelay?: string;
  browserRecheckTimeout?: string;
  browserReuseWait?: string;
  browserProfileLockTimeout?: string;
  browserMaxConcurrentTabs?: string;
  browserAutoReattachDelay?: string;
  browserAutoReattachInterval?: string;
  browserAutoReattachTimeout?: string;
  browserCookieWait?: string;
  browserCookieSync?: boolean;
  browserNoCookieSync?: boolean;
  browserInlineCookiesFile?: string;
  browserCookieNames?: string;
  browserInlineCookies?: string;
  browserHeadless?: boolean;
  browserHideWindow?: boolean;
  browserKeepBrowser?: boolean;
  browserManualLogin?: boolean;
  browserManualLoginCookieSync?: boolean;
  remoteHost?: string;
  /** Thinking time intensity: 'light', 'standard', 'extended', 'extra-high', 'pro', 'heavy' */
  browserThinkingTime?: ThinkingTimeLevel;
  browserResearch?: BrowserResearchMode;
  browserArchive?: BrowserArchiveMode;
  browserModelLabel?: string;
  /** Original model request before browser alias normalization. */
  browserRequestedModel?: ModelName;
  browserModelStrategy?: BrowserModelStrategy;
  browserAllowCookieErrors?: boolean;
  remoteChrome?: string;
  browserPort?: number;
  browserDebugPort?: number;
  model: ModelName;
  verbose?: boolean;
}

export function normalizeChatGptModelForBrowser(model: ModelName): ModelName {
  const normalized = model.toLowerCase() as ModelName;
  // Browser-only alias: gpt-6-pro keeps its name so the Pro tier default survives (label "Latest").
  if (isGpt6ProAlias(normalized)) {
    return "gpt-6-pro" as ModelName;
  }
  if (isGpt6Alias(normalized)) {
    return "gpt-6-astra";
  }
  if (!normalized.startsWith("gpt-") || normalized.includes("codex")) {
    return model;
  }

  if (
    normalized === "gpt-5.6-sol" ||
    normalized === "gpt-5.6" ||
    normalized === "gpt-5.5-pro" ||
    normalized === "gpt-5.5-instant" ||
    normalized === "gpt-5.5" ||
    normalized === "gpt-5.4"
  ) {
    return normalized;
  }

  // Pro variants: resolve to the latest Pro model in ChatGPT.
  if (isCurrentChatGptProAlias(normalized)) {
    return "gpt-5.6-sol";
  }

  // Explicit model variants: keep as-is (they have their own browser labels)
  if (normalized === "gpt-5.2-thinking" || normalized === "gpt-5.2-instant") {
    return normalized;
  }

  // Legacy aliases: map to base GPT-5.2 (Auto)
  if (normalized === "gpt-5.1") {
    return "gpt-5.2";
  }

  return model;
}

// Documented spellings only: gpt-6, gpt-6-astra, gpt-6-pro (plus their label forms such as
// "GPT-6 Pro") and "latest" map to ChatGPT's "Latest" model. Any other gpt-6-* id (gpt-6-codex,
// gpt-6-custom, ...) is not an alias and must pass through unchanged for custom/OpenRouter use.
const GPT6_ALIAS_PATTERN = /^gpt[-_ ]?6(?:[-_ ](?:astra|pro))?$/;
const GPT6_PRO_ALIAS_PATTERN = /^gpt[-_ ]?6[-_ ]pro$/;

export function isGpt6Alias(model: string | undefined): boolean {
  const normalized = model?.trim().toLowerCase() ?? "";
  return normalized === "latest" || GPT6_ALIAS_PATTERN.test(normalized);
}

export function isGpt6ProAlias(model: string | undefined): boolean {
  return GPT6_PRO_ALIAS_PATTERN.test(model?.trim().toLowerCase() ?? "");
}

export function isCurrentChatGptProAlias(model: string | undefined): boolean {
  return CURRENT_CHATGPT_PRO_ALIASES.has(model?.trim().toLowerCase() ?? "");
}

export function resolveDefaultBrowserThinkingTime({
  model,
  requestedModel,
  modelStrategy,
}: {
  model: string;
  requestedModel?: string;
  modelStrategy?: BrowserModelStrategy;
}): ThinkingTimeLevel | undefined {
  const strategy = normalizeBrowserModelStrategy(modelStrategy) ?? DEFAULT_MODEL_STRATEGY;
  if (strategy !== "select") return undefined;
  const normalizedModel = normalizeChatGptModelForBrowser(model as ModelName);
  return isCurrentChatGptProAlias(requestedModel ?? model) ||
    isGpt6ProAlias(requestedModel ?? model) ||
    normalizedModel === "gpt-6-pro" ||
    normalizedModel === "gpt-5.5-pro"
    ? "pro"
    : undefined;
}

export async function buildBrowserConfig(
  options: BrowserFlagOptions,
): Promise<BrowserSessionConfig> {
  const desiredModelOverride = options.browserModelLabel?.trim();
  const normalizedOverride = desiredModelOverride?.toLowerCase() ?? "";
  const baseModel = options.model.toLowerCase();
  const isChatGptModel = baseModel.startsWith("gpt-") && !baseModel.includes("codex");
  const shouldUseOverride =
    !isChatGptModel && normalizedOverride.length > 0 && normalizedOverride !== baseModel;
  const modelStrategy =
    normalizeBrowserModelStrategy(options.browserModelStrategy) ?? DEFAULT_MODEL_STRATEGY;
  const thinkingTime =
    normalizeThinkingTimeLevel(options.browserThinkingTime) ??
    resolveDefaultBrowserThinkingTime({
      model: options.model,
      requestedModel: options.browserRequestedModel,
      modelStrategy,
    });
  assertBrowserModelAvailable(options.model, modelStrategy);
  const rawUrl = options.chatgptUrl ?? options.browserUrl;
  const url = rawUrl ? normalizeChatgptUrl(rawUrl, CHATGPT_URL) : undefined;

  const desiredModel = isChatGptModel
    ? mapModelToBrowserLabel(options.model)
    : shouldUseOverride
      ? desiredModelOverride
      : mapModelToBrowserLabel(options.model);

  return {
    chromeProfile: null,
    chromePath: options.browserChromePath ?? null,
    chromeCookiePath: null,
    attachRunning: false,
    url,
    debugPort: selectBrowserPort(options),
    timeoutMs: options.browserTimeout
      ? parseBrowserDuration(
          options.browserTimeout,
          "--browser-timeout",
          DEFAULT_BROWSER_TIMEOUT_MS,
        )
      : undefined,
    inputTimeoutMs: options.browserInputTimeout
      ? parseBrowserDuration(
          options.browserInputTimeout,
          "--browser-input-timeout",
          DEFAULT_BROWSER_INPUT_TIMEOUT_MS,
        )
      : undefined,
    approvalWaitMs: resolveBrowserApprovalWait(options.browserApprovalWait),
    attachmentTimeoutMs: options.browserAttachmentTimeout
      ? parseBrowserDuration(
          options.browserAttachmentTimeout,
          "--browser-attachment-timeout",
          DEFAULT_BROWSER_ATTACHMENT_TIMEOUT_MS,
        )
      : undefined,
    assistantRecheckDelayMs: options.browserRecheckDelay
      ? parseBrowserDuration(options.browserRecheckDelay, "--browser-recheck-delay", 0)
      : undefined,
    assistantRecheckTimeoutMs: options.browserRecheckTimeout
      ? parseBrowserDuration(
          options.browserRecheckTimeout,
          "--browser-recheck-timeout",
          DEFAULT_BROWSER_RECHECK_TIMEOUT_MS,
        )
      : undefined,
    reuseChromeWaitMs: options.browserReuseWait
      ? parseBrowserDuration(options.browserReuseWait, "--browser-reuse-wait", 0)
      : undefined,
    profileLockTimeoutMs: options.browserProfileLockTimeout
      ? parseBrowserDuration(options.browserProfileLockTimeout, "--browser-profile-lock-timeout", 0)
      : undefined,
    maxConcurrentTabs: parseMaxConcurrentTabs(options.browserMaxConcurrentTabs),
    autoReattachDelayMs: options.browserAutoReattachDelay
      ? parseBrowserDuration(options.browserAutoReattachDelay, "--browser-auto-reattach-delay", 0)
      : undefined,
    autoReattachIntervalMs: options.browserAutoReattachInterval
      ? parseBrowserDuration(
          options.browserAutoReattachInterval,
          "--browser-auto-reattach-interval",
          0,
        )
      : undefined,
    autoReattachTimeoutMs: options.browserAutoReattachTimeout
      ? parseBrowserDuration(
          options.browserAutoReattachTimeout,
          "--browser-auto-reattach-timeout",
          DEFAULT_BROWSER_AUTO_REATTACH_TIMEOUT_MS,
        )
      : undefined,
    cookieSyncWaitMs: 0,
    cookieSync: false,
    cookieNames: undefined,
    inlineCookies: null,
    inlineCookiesSource: null,
    headless: options.browserHeadless === true ? true : undefined,
    keepBrowser: options.browserKeepBrowser ? true : undefined,
    manualLogin: true,
    manualLoginProfileDir: undefined,
    manualLoginCookieSync: false,
    copyProfileSource: undefined,
    hideWindow: options.browserHideWindow ? true : undefined,
    desiredModel,
    modelStrategy,
    debug: options.verbose ? true : undefined,
    // Allow cookie failures by default so runs can continue without Chrome/Keychain secrets.
    allowCookieErrors: options.browserAllowCookieErrors ?? true,
    remoteChrome: null,
    browserTabRef: null,
    thinkingTime,
    researchMode:
      options.browserResearch === "deep" || options.browserResearch === "search"
        ? options.browserResearch
        : "off",
    archiveConversations: options.browserArchive,
  };
}

function assertBrowserModelAvailable(model: ModelName, modelStrategy: BrowserModelStrategy): void {
  if (modelStrategy !== "select") return;
  const normalized = normalizeChatGptModelForBrowser(model);
  if (
    normalized !== "gpt-5.2" &&
    normalized !== "gpt-5.2-instant" &&
    normalized !== "gpt-5.2-thinking"
  ) {
    return;
  }
  throw new Error(
    `Browser model "${model}" is retired because ChatGPT no longer offers GPT-5.2 base, Instant, or Thinking. Choose a current GPT-5.5/GPT-5.6 browser model, use --browser-model-strategy current to keep ChatGPT's active model, or use --engine api to retain the GPT-5.2 API alias.`,
  );
}

function selectBrowserPort(options: BrowserFlagOptions): number | null {
  const candidate = options.browserPort ?? options.browserDebugPort;
  if (candidate === undefined || candidate === null) return null;
  if (!Number.isFinite(candidate) || candidate <= 0 || candidate > 65_535) {
    throw new Error(`Invalid browser port: ${candidate}. Expected a number between 1 and 65535.`);
  }
  return candidate;
}

function parseMaxConcurrentTabs(raw?: string): number | undefined {
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid browser max concurrent tabs: ${raw}. Expected a positive integer.`);
  }
  return Math.trunc(value);
}

function parseBrowserDuration(raw: string, optionName: string, fallbackMs: number): number {
  const parsed = parseDuration(raw, Number.NaN);
  if (Number.isFinite(parsed)) return parsed;
  console.log(
    chalk.yellow(
      `Warning: invalid ${optionName} duration "${raw}"; using fallback ${fallbackMs}ms.`,
    ),
  );
  return fallbackMs;
}

export function mapModelToBrowserLabel(model: ModelName): string {
  const normalized = normalizeChatGptModelForBrowser(model);
  // Iterate ordered array to find first match (most specific first)
  for (const [key, label] of BROWSER_MODEL_LABELS) {
    if (key === normalized) {
      return label;
    }
  }
  return DEFAULT_MODEL_TARGET;
}

export function resolveBrowserModelLabel(input: string | undefined, model: ModelName): string {
  const trimmed = input?.trim?.() ?? "";
  if (!trimmed) {
    return mapModelToBrowserLabel(model);
  }
  const normalizedInput = trimmed.toLowerCase();
  if (
    normalizedInput === model.toLowerCase() ||
    (isGpt6Alias(normalizedInput) && (model === "gpt-6-astra" || model === "gpt-6-pro")) ||
    (isGpt6ProAlias(normalizedInput) && model === "gpt-6-pro")
  ) {
    return mapModelToBrowserLabel(model);
  }
  return trimmed;
}

export function parseRemoteChromeTarget(raw: string): { host: string; port: number } {
  const target = raw.trim();
  if (!target) {
    throw new Error(
      "Invalid remote-chrome value: expected host:port but received an empty string.",
    );
  }

  const ipv6Match = target.match(/^\[(.+)]:(\d+)$/);
  let host: string | undefined;
  let portSegment: string | undefined;

  if (ipv6Match) {
    host = ipv6Match[1]?.trim();
    portSegment = ipv6Match[2]?.trim();
  } else {
    const lastColon = target.lastIndexOf(":");
    if (lastColon === -1) {
      throw new Error(
        `Invalid remote-chrome format: ${target}. Expected host:port (IPv6 must use [host]:port notation).`,
      );
    }
    host = target.slice(0, lastColon).trim();
    portSegment = target.slice(lastColon + 1).trim();
    if (host.includes(":")) {
      throw new Error(
        `Invalid remote-chrome format: ${target}. Wrap IPv6 addresses in brackets, e.g. --remote-chrome "[2001:db8::1]:9222".`,
      );
    }
  }

  if (!host) {
    throw new Error(
      `Invalid remote-chrome format: ${target}. Host portion is missing; expected host:port.`,
    );
  }
  const port = Number.parseInt(portSegment ?? "", 10);
  if (!Number.isFinite(port) || port <= 0 || port > 65_535) {
    throw new Error(
      `Invalid remote-chrome port: "${portSegment ?? ""}". Expected a number between 1 and 65535.`,
    );
  }
  return { host, port };
}
