# Linux Notes

- Browser engine now works on Linux (Chrome/Chromium/Edge) without the old `DISPLAY` guard. Oracle will launch whatever `chrome-launcher` finds or what you pass via `CHROME_PATH`.
- This fork disables cookie sync and profile selection. Use `--manual-login --engine browser`; Oracle
  always reuses `~/.oracle/browser-profile`. Legacy cookie flags are silently ignored. Common
  upstream cookie DB paths below are retained only as background reference:
  - `~/snap/chromium/common/chromium/Default/Cookies`
- If you use a non-default profile or a custom install, point Oracle at the correct paths:
  - `--browser-chrome-path /path/to/chrome`
  - `--browser-cookie-path /path/to/profile/Default/Cookies`
- Browser runs are headful (Cloudflare blocks headless). Keep a compositor/virtual display running if you don’t have a desktop session.
- If cookie sync still can’t find your DB, use `--browser-manual-login` and sign in to the dedicated profile, or dump the session cookies with `--browser-inline-cookies-file`.
