#!/usr/bin/env bash
set -euo pipefail

exec oracle --manual-login --engine browser --browser-keep-browser "$@"
