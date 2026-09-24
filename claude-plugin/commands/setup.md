---
description: Wire this repository to Engram — install the binary if missing, git-ignore the local graph, mark the repo as an Engram project.
allowed-tools: Bash
---

Wire the current repository to Engram. The plugin already provides the capture skill, the session-brief hook and the MCP server globally — the server only binds repositories that are wired, so the per-repo work is the binary and marking this repo as a project. Never install a project-level skill, hook, or `.mcp.json` entry here.

1. **Binary.** Check `command -v engram-alpha` (also `~/.local/bin/engram-alpha` and `~/.cargo/bin/engram-alpha`). If missing, ask the user once for consent to install, then run:
   ```sh
   curl -fsSL https://raw.githubusercontent.com/techtheist/engram/main/install.sh | sh -s -- --bin-only
   ```
   If they decline, stop and point them at https://github.com/techtheist/engram#install. If `engram-alpha --version` is older than 0.9.9, run `engram-alpha update` — the plugin's server needs `mcp --wired-only`.

2. **Wire the repo.** From the repository root:
   ```sh
   engram-alpha setup --cli claude --mcp-only
   ```
   This git-ignores `.engram/` and creates it — the directory is what tells the plugin's server this repo is a project. With the plugin installed it writes no `.mcp.json` entry (that would load every engram tool twice); if it reports an existing `engram` entry in `.mcp.json`, remove that entry.

3. **Connect.** Tell the user to run `/mcp` and reconnect the `engram` server (or start a new session) so it binds this repo. The next session opens pre-briefed via the plugin's SessionStart hook.

4. **Cold start.** If this created a brand-new graph, mention that once connected, the skill offers a one-time seeding pass from the project's existing docs/history — and that `/engram:pane` opens the graph UI.

If anything fails, report the exact error — never pretend the repo is wired.
