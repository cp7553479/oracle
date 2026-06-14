import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import path from "node:path";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { getOracleHomeDir } from "../oracleHome.js";
import {
  getDevToolsActivePortPaths,
  readDevToolsPort,
  verifyDevToolsReachable,
} from "../browser/profileState.js";
import { isManualLoginProfileInitialized } from "../browser/manualLoginProfile.js";
import { CHATGPT_URL } from "../browser/constants.js";

const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const DEFAULT_PROFILE_NAME = "default";
export interface NamedProfileInfo {
  name: string;
  path: string;
  initialized: boolean;
  devToolsPort: number | null;
  devToolsReachable: boolean;
  modifiedAt: string | null;
}

export interface OpenNamedProfileOptions {
  name: string;
  url?: string;
  browserChromePath?: string;
  create?: boolean;
  spawnProcess?: typeof spawn;
  log?: (line: string) => void;
}

export interface OpenNamedProfileResult {
  profileDir: string;
  url: string;
  command: string;
  args: string[];
  pid: number | null;
}

export function validateNamedProfileName(name: string): string {
  const normalized = name.trim();
  if (!PROFILE_NAME_PATTERN.test(normalized) || normalized.includes("..")) {
    throw new Error(
      "Invalid profile name. Use 1-80 letters, numbers, dots, underscores, or hyphens; the first character must be a letter or number.",
    );
  }
  return normalized;
}

export function getNamedProfilesRoot(): string {
  return path.join(getOracleHomeDir(), "browser-profiles");
}

export function getDefaultNamedProfileDir(): string {
  return path.join(getOracleHomeDir(), "browser-profile");
}

export function resolveNamedProfileDir(name: string): string {
  const normalized = validateNamedProfileName(name);
  if (normalized === DEFAULT_PROFILE_NAME) {
    return getDefaultNamedProfileDir();
  }
  return path.join(getNamedProfilesRoot(), normalized);
}

export function applyNamedProfileToBrowserOptions<
  T extends {
    profile?: string;
    browserAttachRunning?: boolean;
    browserManualLogin?: boolean;
    browserManualLoginProfileDir?: string | null;
  },
>(options: T, getSource: (key: keyof T) => string | undefined): string | null {
  const profile = options.profile?.trim();
  if (!profile) {
    return null;
  }
  if (options.browserAttachRunning) {
    throw new Error("--profile cannot be combined with --browser-attach-running.");
  }
  const explicitProfileDirSource = getSource("browserManualLoginProfileDir");
  if (explicitProfileDirSource && explicitProfileDirSource !== "default") {
    throw new Error("--profile cannot be combined with --browser-manual-login-profile-dir.");
  }
  const profileDir = resolveNamedProfileDir(profile);
  options.browserManualLogin = true;
  options.browserManualLoginProfileDir = profileDir;
  return profileDir;
}

export async function ensureNamedProfileDir(name: string): Promise<string> {
  const profileDir = resolveNamedProfileDir(name);
  await mkdir(profileDir, { recursive: true });
  return profileDir;
}

export async function listNamedProfiles(): Promise<NamedProfileInfo[]> {
  const root = getNamedProfilesRoot();
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const defaultProfile = await readNamedProfileInfo(
    DEFAULT_PROFILE_NAME,
    getDefaultNamedProfileDir(),
  );
  const namedProfiles = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .filter((entry) => entry.name !== DEFAULT_PROFILE_NAME)
      .map(async (entry): Promise<NamedProfileInfo | null> => {
        try {
          const name = validateNamedProfileName(entry.name);
          const profilePath = path.join(root, name);
          return await readNamedProfileInfo(name, profilePath);
        } catch {
          return null;
        }
      }),
  );
  return [defaultProfile, ...namedProfiles]
    .filter((entry): entry is NamedProfileInfo => entry !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function readNamedProfileInfo(
  name: string,
  profilePath: string,
): Promise<NamedProfileInfo | null> {
  const profileStat = await stat(profilePath).catch(() => null);
  if (!profileStat) {
    return null;
  }
  const [initialized, devToolsPort] = await Promise.all([
    isManualLoginProfileInitialized(profilePath),
    readDevToolsPort(profilePath),
  ]);
  const devToolsReachable = devToolsPort
    ? (await verifyDevToolsReachable({ port: devToolsPort })).ok
    : false;
  return {
    name,
    path: profilePath,
    initialized,
    devToolsPort,
    devToolsReachable,
    modifiedAt: profileStat.mtime ? profileStat.mtime.toISOString() : null,
  };
}

export async function openNamedProfileBrowser({
  name,
  url,
  browserChromePath,
  create = false,
  spawnProcess = spawn,
  log = console.log,
}: OpenNamedProfileOptions): Promise<OpenNamedProfileResult> {
  const profileDir = create ? await ensureNamedProfileDir(name) : resolveNamedProfileDir(name);
  if (!create) {
    await stat(profileDir).catch(() => {
      throw new Error(
        `Profile ${JSON.stringify(name)} does not exist. Run "oracle profile add ${name}" first.`,
      );
    });
  }
  const targetUrl = normalizeProfileUrl(url);
  await clearDevToolsPortFiles(profileDir);
  const launch = buildChromeProfileLaunchCommand({
    profileDir,
    url: targetUrl,
    chromePath: browserChromePath,
  });
  log(`Opening Oracle profile ${name} at ${profileDir}`);
  log(`Sign in at ${targetUrl}; close this Chrome before running oracle --profile ${name}.`);
  const child = await spawnDetachedBrowser(spawnProcess, launch.command, launch.args);
  return { ...launch, profileDir, url: targetUrl, pid: child.pid ?? null };
}

function normalizeProfileUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : CHATGPT_URL;
}

async function clearDevToolsPortFiles(profileDir: string): Promise<void> {
  await Promise.all(
    getDevToolsActivePortPaths(profileDir).map((candidate) => rm(candidate, { force: true })),
  );
}

function buildChromeProfileLaunchCommand({
  profileDir,
  url,
  chromePath,
}: {
  profileDir: string;
  url: string;
  chromePath?: string;
}): { command: string; args: string[] } {
  const chromeArgs = [`--user-data-dir=${profileDir}`, "--no-first-run", "--new-window", url];
  const explicitChromePath = chromePath?.trim();
  if (explicitChromePath) {
    return { command: explicitChromePath, args: chromeArgs };
  }
  if (process.platform === "darwin") {
    return { command: "open", args: ["-na", "Google Chrome", "--args", ...chromeArgs] };
  }
  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", "chrome", ...chromeArgs] };
  }
  return { command: "google-chrome", args: chromeArgs };
}

function spawnDetachedBrowser(
  spawnProcess: typeof spawn,
  command: string,
  args: string[],
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const options: SpawnOptions = {
      detached: true,
      stdio: "ignore",
      env: process.env,
    };
    const child = spawnProcess(command, args, options);
    const finish = () => {
      child.removeListener("error", onError);
      child.unref?.();
      resolve(child);
    };
    const onError = (error: Error) => {
      child.removeListener("spawn", finish);
      reject(error);
    };
    child.once("error", onError);
    child.once("spawn", finish);
  });
}

export function formatProfileSwitchHint(profileName = "<other>"): string {
  return `Retry with another profile: oracle --profile ${profileName} ...`;
}
