import { describe, expect, test } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { formatClaudeMcpConfig } from "../../src/cli/bridge/claudeConfig.ts";

const execFileAsync = promisify(execFile);
const CLI_ENTRY = path.join(process.cwd(), "bin", "oracle-cli.ts");

describe("formatClaudeMcpConfig", () => {
  test("prints a remote Claude Code MCP config without exposing tokens by default", () => {
    const parsed = JSON.parse(
      formatClaudeMcpConfig({
        oracleHomeDir: "/Users/test/.oracle-local",
        remoteHost: "127.0.0.1:9473",
        remoteToken: "secret-token",
        includeToken: false,
      }),
    );

    expect(parsed.mcpServers.oracle).toMatchObject({
      type: "stdio",
      command: "oracle-mcp",
      args: [],
    });
    expect(parsed.mcpServers.oracle.env).toMatchObject({
      ORACLE_ENGINE: "browser",
      ORACLE_HOME_DIR: "/Users/test/.oracle-local",
      ORACLE_REMOTE_HOST: "127.0.0.1:9473",
      ORACLE_REMOTE_TOKEN: "<YOUR_TOKEN>",
    });
  });

  test("prints a local-browser Claude Code MCP config without remote bridge env", () => {
    const parsed = JSON.parse(
      formatClaudeMcpConfig({
        oracleHomeDir: "/Users/test/.oracle",
        remoteHost: "127.0.0.1:9473",
        remoteToken: "secret-token",
        includeToken: true,
        localBrowser: true,
      }),
    );

    expect(parsed.mcpServers.oracle.env).toEqual({
      ORACLE_ENGINE: "browser",
      ORACLE_HOME_DIR: "/Users/test/.oracle",
    });
  });

  test("prints local-browser CLI config as parseable stdout JSON", async () => {
    const oracleHome = await mkdtemp(path.join(os.tmpdir(), "oracle-claude-config-"));
    try {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        ["--import", "tsx", CLI_ENTRY, "bridge", "claude-config", "--local-browser"],
        {
          env: {
            ...process.env,
            NODE_OPTIONS: [process.env.NODE_OPTIONS, "--disable-warning=DEP0205"]
              .filter(Boolean)
              .join(" "),
            // biome-ignore lint/style/useNamingConvention: env var name
            ORACLE_HOME_DIR: oracleHome,
          },
        },
      );

      const parsed = JSON.parse(stdout);
      expect(stderr.trim()).toBe("");
      expect(parsed.mcpServers.oracle.env).toEqual({
        ORACLE_ENGINE: "browser",
        ORACLE_HOME_DIR: oracleHome,
      });
    } finally {
      await rm(oracleHome, { recursive: true, force: true });
    }
  }, 15_000);
});
