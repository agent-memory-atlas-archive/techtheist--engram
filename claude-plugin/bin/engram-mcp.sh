#!/usr/bin/env bash
# The plugin's MCP server: an `engram-alpha mcp --wired-only` bridge.
#
# Claude Code starts plugin MCP servers in every project, so the bridge binds
# only folders that are already Engram projects (a `.engram/` directory, or a
# folder inside a registered project) — it never turns a folder into a new
# project. Anywhere else the session reads the home graph and refuses project
# writes with a teaching error until the folder is wired (`/engram:setup`).
#
# Claude Code launches MCP servers with its own PATH, which often carries
# neither install dir — the same probe the session-brief hook uses finds the
# binary. stderr reaches Claude Code's MCP log, so failures explain themselves.
set -u
BIN="$(command -v engram-alpha 2>/dev/null || true)"
for CANDIDATE in "$HOME/.cargo/bin/engram-alpha" "$HOME/.local/bin/engram-alpha" \
    /usr/local/bin/engram-alpha /opt/homebrew/bin/engram-alpha; do
    [ -n "$BIN" ] && break
    [ -x "$CANDIDATE" ] && BIN="$CANDIDATE"
done
if [ -z "$BIN" ]; then
    echo "engram: the engram-alpha binary is not installed — run /engram:setup (it installs it), then reconnect with /mcp" >&2
    exit 1
fi
# --wired-only arrived in 0.9.9; an older binary would turn every folder
# Claude Code opens into a project, so refuse to start it instead.
if ! "$BIN" mcp --help 2>/dev/null | grep -q -- '--wired-only'; then
    echo "engram: $BIN is older than 0.9.9 — run \`engram-alpha update\`, then reconnect with /mcp" >&2
    exit 1
fi
exec "$BIN" mcp --wired-only
