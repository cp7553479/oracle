import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

const MAX_RSYNC_STDERR_BYTES = 16 * 1024;

/**
 * Cache/derived subdirectories that bloat the copy and carry no signed-in-session
 * signal, so they are skipped when seeding a copied Chrome profile.
 */
const RSYNC_EXCLUDES = [
  "Cache/",
  "Code Cache/",
  "GPUCache/",
  "DawnGraphiteCache/",
  "DawnWebGPUCache/",
  "GrShaderCache/",
  "ShaderCache/",
  "Service Worker/CacheStorage/",
  "Service Worker/ScriptCache/",
  "Service Worker/Database/",
];

/**
 * Copy a signed-in Chrome user-data directory into `destDir` so a throwaway
 * Chrome can launch on the copy and reuse the live session WITHOUT a manual
 * sign-in. Copies the `Default/` profile (minus cache dirs) plus the top-level
 * `Local State` file.
 *
 * `Local State` is required: on macOS it holds the Keychain-wrapped
 * "Chrome Safe Storage" key that decrypts the profile's cookies — a cookies-only
 * copy fails the logged-in check. Decryption only succeeds when the copy is
 * launched by the real Chrome binary (the one on the Keychain ACL).
 *
 * Uses rsync (present on macOS/Linux) so a live, in-use source profile copies
 * cleanly — rsync exit 24 ("source files vanished") is tolerated.
 */
export async function copyChromeProfile(
  srcUserDataDir: string,
  destDir: string,
  requestedProfile?: string | null,
): Promise<string> {
  try {
    const localStatePath = path.join(srcUserDataDir, "Local State");
    const copiedLocalStatePath = path.join(destDir, "Local State");
    await cp(localStatePath, copiedLocalStatePath).catch((err: unknown) => {
      throw new Error(
        `--copy-profile: could not copy required "Local State" from ${srcUserDataDir} ` +
          `(needed to select and decrypt the signed-in profile): ${(err as Error).message}`,
      );
    });
    const localState = await readFile(copiedLocalStatePath, "utf8");
    const profileDirectory = resolveChromeProfileDirectory(
      srcUserDataDir,
      localState,
      requestedProfile,
    );
    const srcProfile = path.join(srcUserDataDir, profileDirectory);
    const destProfile = path.join(destDir, profileDirectory);
    const srcProfileStat = await stat(srcProfile).catch((err: unknown) => {
      throw new Error(
        `--copy-profile: could not access selected Chrome profile source ${JSON.stringify(srcProfile)}: ${(err as Error).message}`,
      );
    });
    if (!srcProfileStat.isDirectory()) {
      throw new Error(
        `--copy-profile: selected Chrome profile source is not a directory: ${JSON.stringify(srcProfile)}`,
      );
    }
    await mkdir(destProfile, { recursive: true });
    // `Local State` is required (holds the Keychain-wrapped key that decrypts the
    // cookies), so a copy failure must fail fast — otherwise the run continues with
    // a profile that silently looks logged-out.
    const args = ["-a"];
    for (const exclude of RSYNC_EXCLUDES) {
      args.push("--exclude", exclude);
    }
    args.push(`${srcProfile}/`, `${destProfile}/`);
    await new Promise<void>((resolve, reject) => {
      const child = spawn("rsync", args, { stdio: ["ignore", "ignore", "pipe"] });
      const stderrChunks: Buffer[] = [];
      let stderrBytes = 0;
      let stderrTruncated = false;
      child.stderr.on("data", (chunk: Buffer) => {
        const remaining = MAX_RSYNC_STDERR_BYTES - stderrBytes;
        if (remaining > 0) {
          stderrChunks.push(chunk.subarray(0, remaining));
          stderrBytes += Math.min(chunk.length, remaining);
        }
        if (chunk.length > remaining) {
          stderrTruncated = true;
        }
      });
      child.on("error", (err) =>
        reject(
          new Error(
            `--copy-profile requires rsync on PATH (spawn failed): ${(err as Error).message}`,
          ),
        ),
      );
      child.on("close", (code) =>
        code === 0 || code === 24
          ? resolve()
          : reject(
              new Error(
                `rsync failed copying Chrome profile (exit ${code})${formatRsyncStderr(stderrChunks, stderrTruncated)}`,
              ),
            ),
      );
    });
    return profileDirectory;
  } catch (error) {
    // The destination is always a newly-created throwaway profile. Remove partial
    // session-bearing copies before surfacing setup failures.
    await rm(destDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function formatRsyncStderr(chunks: Buffer[], truncated: boolean): string {
  const stderr = Buffer.concat(chunks).toString("utf8").trim();
  if (!stderr) {
    return "";
  }
  return `: ${stderr}${truncated ? "\n[stderr truncated]" : ""}`;
}

function resolveChromeProfileDirectory(
  srcUserDataDir: string,
  localState: string,
  requestedProfile?: string | null,
): string {
  let profile = requestedProfile?.trim();
  if (!profile) {
    try {
      const parsed = JSON.parse(localState) as { profile?: { last_used?: unknown } };
      profile =
        typeof parsed.profile?.last_used === "string" ? parsed.profile.last_used.trim() : "";
    } catch (error) {
      throw new Error(
        `--copy-profile: could not parse "Local State" to select the active Chrome profile: ${(error as Error).message}`,
      );
    }
  }
  profile ||= "Default";

  const root = path.resolve(srcUserDataDir);
  const resolved = path.resolve(root, profile);
  if (path.dirname(resolved) !== root) {
    throw new Error(
      `--copy-profile: Chrome profile must be a direct child of the user-data directory; received ${JSON.stringify(profile)}.`,
    );
  }
  return path.basename(resolved);
}

export function resolveChromeProfileDirectoryForTest(
  srcUserDataDir: string,
  localState: string,
  requestedProfile?: string | null,
): string {
  return resolveChromeProfileDirectory(srcUserDataDir, localState, requestedProfile);
}
