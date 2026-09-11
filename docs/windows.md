# Windows compatibility notes

Keep this in sync as we learn more. Read this before doing browser runs on Windows.

- Browser engine is mandatory in this fork. All callers use the fixed persistent Oracle profile.
- Cookies: live-profile cookie sync is disabled by default on every platform, and Windows ChatGPT cookies are additionally often app-bound (`v20`) and fail decryption. Use `--browser-manual-login` to reuse a persistent automation profile and sign in once (skips cookie copy entirely). Inline cookies remain available (`--browser-inline-cookies(-file)` / `ORACLE_BROWSER_COOKIES_JSON`).
- Manual login flow: run with `--manual-login --engine browser` and sign into chatgpt.com in the opened Chrome. Oracle preserves `~/.oracle/browser-profile`; profile, cookie, attach-running, remote-Chrome, and browser-tab overrides are silently ignored.
- mcporter chrome-devtools: requires a valid `CHROME_DEVTOOLS_URL` from a live session; otherwise calls will fail.
- The agent-scripts `runner` helper is bash-based and may fail under PowerShell/CMD; run commands directly if it misbehaves.
