import type { UserConfig } from "../config.js";
import { resolveBrowserApprovalWait } from "../browser/config.js";
import type { RemoteHostBrowserConfig } from "../remote/server.js";
import type { BrowserDefaultsOptions } from "./browserDefaults.js";

type ServeBrowserFlags = Pick<
  BrowserDefaultsOptions,
  "browserAttachRunning" | "remoteChrome" | "browserApprovalWait"
>;

export function buildServeBrowserConfig(
  options: ServeBrowserFlags,
  config: UserConfig,
): RemoteHostBrowserConfig {
  const envApprovalWait = process.env.ORACLE_BROWSER_APPROVAL_WAIT?.trim() || undefined;
  const approvalWait =
    options.browserApprovalWait ?? envApprovalWait ?? config.browser?.approvalWaitMs;
  return {
    attachRunning: false,
    remoteChrome: null,
    approvalWaitMs: resolveBrowserApprovalWait(approvalWait),
  };
}
