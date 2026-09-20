import { CHATGPT_URL } from "../browser/constants.js";
import { normalizeChatgptUrl } from "../browser/utils.js";
import type { UserConfig } from "../config.js";
import { normalizeThinkingTimeLevel } from "../oracle/thinkingTime.js";
import type { ThinkingTimeLevel } from "../oracle/types.js";
import type {
  BrowserArchiveMode,
  BrowserModelStrategy,
  BrowserResearchMode,
} from "../browser/types.js";
import { isGpt6ProAlias } from "./browserConfig.js";

export interface BrowserDefaultsOptions {
  model?: string;
  remoteChrome?: string;
  copyProfile?: string;
  chatgptUrl?: string;
  browserUrl?: string;
  browserChromeProfile?: string;
  browserChromePath?: string;
  browserCookiePath?: string;
  browserAttachRunning?: boolean;
  browserTimeout?: string | number;
  browserInputTimeout?: string | number;
  browserApprovalWait?: string | number;
  browserAttachmentTimeout?: string | number;
  browserRecheckDelay?: string | number;
  browserRecheckTimeout?: string | number;
  browserReuseWait?: string | number;
  browserProfileLockTimeout?: string | number;
  browserMaxConcurrentTabs?: string | number;
  browserAutoReattachDelay?: string | number;
  browserAutoReattachInterval?: string | number;
  browserAutoReattachTimeout?: string | number;
  browserCookieWait?: string | number;
  browserCookieSync?: boolean;
  browserPort?: number;
  browserHeadless?: boolean;
  browserHideWindow?: boolean;
  browserKeepBrowser?: boolean;
  browserModelStrategy?: BrowserModelStrategy;
  browserThinkingTime?: ThinkingTimeLevel;
  browserResearch?: BrowserResearchMode;
  browserCaptureProviderNative?: boolean;
  browserArchive?: BrowserArchiveMode;
  browserManualLogin?: boolean;
  browserManualLoginCookieSync?: boolean;
}

type SourceGetter = (key: keyof BrowserDefaultsOptions) => string | undefined;

export function applyBrowserDefaultsFromConfig(
  options: BrowserDefaultsOptions,
  config: UserConfig,
  getSource: SourceGetter,
): void {
  const browser = config.browser;
  if (!browser) return;

  const isUnset = (key: keyof BrowserDefaultsOptions): boolean => {
    const source = getSource(key);
    return source === undefined || source === "default";
  };
  const currentModelRequestedByCli =
    options.browserModelStrategy === "current" && getSource("browserModelStrategy") === "cli";
  const gpt6ProRequestedByCli = getSource("model") === "cli" && isGpt6ProAlias(options.model);

  const configuredChatgptUrl = browser.chatgptUrl ?? browser.url;
  const cliChatgptSet = options.chatgptUrl !== undefined || options.browserUrl !== undefined;
  if (isUnset("chatgptUrl") && !cliChatgptSet && configuredChatgptUrl !== undefined) {
    options.chatgptUrl = normalizeChatgptUrl(configuredChatgptUrl ?? "", CHATGPT_URL);
  }

  if (isUnset("browserChromePath") && browser.chromePath !== undefined) {
    options.browserChromePath = browser.chromePath ?? undefined;
  }
  if (isUnset("browserUrl") && options.browserUrl === undefined && browser.url !== undefined) {
    options.browserUrl = browser.url;
  }
  if (isUnset("browserTimeout") && typeof browser.timeoutMs === "number") {
    options.browserTimeout = String(browser.timeoutMs);
  }
  if (isUnset("browserPort") && typeof browser.debugPort === "number") {
    options.browserPort = browser.debugPort;
  }
  if (isUnset("browserInputTimeout") && typeof browser.inputTimeoutMs === "number") {
    options.browserInputTimeout = String(browser.inputTimeoutMs);
  }
  if (isUnset("browserApprovalWait") && typeof browser.approvalWaitMs === "number") {
    options.browserApprovalWait = String(browser.approvalWaitMs);
  }
  if (isUnset("browserAttachmentTimeout") && typeof browser.attachmentTimeoutMs === "number") {
    options.browserAttachmentTimeout = String(browser.attachmentTimeoutMs);
  }
  if (isUnset("browserRecheckDelay") && typeof browser.assistantRecheckDelayMs === "number") {
    options.browserRecheckDelay = String(browser.assistantRecheckDelayMs);
  }
  if (isUnset("browserRecheckTimeout") && typeof browser.assistantRecheckTimeoutMs === "number") {
    options.browserRecheckTimeout = String(browser.assistantRecheckTimeoutMs);
  }
  if (isUnset("browserReuseWait") && typeof browser.reuseChromeWaitMs === "number") {
    options.browserReuseWait = String(browser.reuseChromeWaitMs);
  }
  if (isUnset("browserProfileLockTimeout") && typeof browser.profileLockTimeoutMs === "number") {
    options.browserProfileLockTimeout = String(browser.profileLockTimeoutMs);
  }
  if (isUnset("browserMaxConcurrentTabs") && typeof browser.maxConcurrentTabs === "number") {
    options.browserMaxConcurrentTabs = String(browser.maxConcurrentTabs);
  }
  if (isUnset("browserAutoReattachDelay") && typeof browser.autoReattachDelayMs === "number") {
    options.browserAutoReattachDelay = String(browser.autoReattachDelayMs);
  }
  if (
    isUnset("browserAutoReattachInterval") &&
    typeof browser.autoReattachIntervalMs === "number"
  ) {
    options.browserAutoReattachInterval = String(browser.autoReattachIntervalMs);
  }
  if (isUnset("browserAutoReattachTimeout") && typeof browser.autoReattachTimeoutMs === "number") {
    options.browserAutoReattachTimeout = String(browser.autoReattachTimeoutMs);
  }
  if (isUnset("browserCookieWait") && typeof browser.cookieSyncWaitMs === "number") {
    options.browserCookieWait = String(browser.cookieSyncWaitMs);
  }
  if (isUnset("browserHeadless") && browser.headless !== undefined) {
    options.browserHeadless = browser.headless;
  }
  if (isUnset("browserHideWindow") && browser.hideWindow !== undefined) {
    options.browserHideWindow = browser.hideWindow;
  }
  if (isUnset("browserKeepBrowser") && browser.keepBrowser !== undefined) {
    options.browserKeepBrowser = browser.keepBrowser;
  }
  if (isUnset("browserModelStrategy") && browser.modelStrategy !== undefined) {
    options.browserModelStrategy = browser.modelStrategy;
  }
  if (
    !currentModelRequestedByCli &&
    !gpt6ProRequestedByCli &&
    isUnset("browserThinkingTime") &&
    browser.thinkingTime !== undefined
  ) {
    options.browserThinkingTime = normalizeThinkingTimeLevel(browser.thinkingTime) ?? undefined;
  }
  if (
    isUnset("browserCaptureProviderNative") &&
    typeof browser.captureProviderNative === "boolean"
  ) {
    options.browserCaptureProviderNative = browser.captureProviderNative;
  }
  if (isUnset("browserResearch") && browser.researchMode !== undefined) {
    options.browserResearch = browser.researchMode;
  }
  if (isUnset("browserArchive") && browser.archiveConversations !== undefined) {
    options.browserArchive = browser.archiveConversations;
  }
}
