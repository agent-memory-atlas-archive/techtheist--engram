# Engram — context for Claude Code

**What this is:** a graph-based, durable, inspectable long-term project memory for AI coding assistants (Claude Code first). Local-first, user-owned, graph-first UI. The **reasoning/decision memory** layer (why/decided/what-bit-us) — not a code-structure graph; the wedge is the editable IDE-embedded graph pane + conflict surfacing + local. The line since 0.8.0: *the most powerful and feature-rich inspectable graph long-term memory for software development with AI agents, based on reproducible research.*

**THE GRAPH IS THE MEMORY OF RECORD — this file is only rules and a keyword index.** The session brief is auto-injected and opens with the **Current cycle** (open work stamped with the working version); `search` engram before any non-trivial work and follow the write-verdict protocol. Details, rationale, gotchas, and the full history live in this repo's graph (`.engram/graph.tepin`, daemon on 8787) and the eval workbench graph (`eval/.engram`, project `eval`, scientific ontology Claim/Method/Question/Finding/Source/Task). PLAN.md was retired 2026-08-04 (merged here); `PLAN §…` references in code comments point at git history.

## Hard rules (locked — don't relitigate without reason)
- Open-source, MIT; optimize for docs & DX. Product name **"Engram Alpha"**, binary `engram-alpha` (repo/plugin namespaces stay `engram`; JetBrains package `dev.techtheist.engram` — don't rename).
- **Rust** backend (rmcp, rusqlite bundled, sqlite-vec, fastembed, tepindb) — no Node runtime dep. **Vue 3.5 + TS + Vite + Bun**, Pinia, Tailwind 4, Vue Flow; `bun run lint` / `lint:style` in `frontend/`.
- Embeddings/models **local-only**; **no LLM in the daemon, ever** (encoder-only mechanisms); models nominate, people judge.
- **Retrieval changes cite a measured `eval/` run or they don't ship** (since 0.8.0).
- **9 node types (8 + Tombstone since 0.9.0) / 7 sentence-shaped verbs** on the default ontology; no new types, no `relates_to`; durability governs staleness; high-value edges are `replaces`/`conflicts-with`. Per-graph ontology/policy config exists since 0.7.0, but THIS repo's graph stays on the default ontology permanently.
- **Hard delete is user-only** (pane); MCP deliberately has no delete/register/pin tools. Writes are silent; transparency is the pane. One workspace version for every crate, stamped from the tag; `claude-plugin/.claude-plugin/plugin.json` must match (test-enforced).
- Multi-user & repo sync: **out of scope permanently** (future enterprise product). Dogfood on the **aggressive** skill variant (relaxed is the user default). Eval ladder max **1500 notes**.

## Where things go
`crates/engram-core` (engine, Store trait + sqlite/tepin drivers, policy, config, cortex) · `crates/engram-mcp` (rmcp tools) · `crates/engram-http` (axum API + embedded pane) · `crates/engram-cli` (`engram-alpha`: serve/mcp/doctor/setup/migrate/stop) · `frontend/` · `eval/` (engram-eval bench) · `eval/knowledgedrift/` (a pointer README only since 2026-09-16 — **KnowledgeDrift** lives in its own repo **github.com/techtheist/knowledgedrift**, main = v2: generator vendored, worlds frozen, engram-core a rev-pinned git dep behind `--features arms`; a local `.cargo/config.toml` `[patch]` points it at this checkout while a cycle is open; the gate/knob probes are uncommitted `examples/` there; that repo never mentions how the bench changed engram; old receipts `eval/results/*-knowledgedrift-*`) · `engram-jetbrains/`, `engram-vscode/` · `skills/engram/{aggressive,normal,relaxed}` + `claude-plugin/` (verbatim copies, sync-tested).

## Workflows & sharp edges
- **Pane/daemon rebuild: `scripts/deploy-pane.sh` only** (never hand-chain build/install/restart); after any redeploy, `/mcp` reconnect — live stdio sessions keep the OLD binary and stale tool descriptions.
- **Cycle open:** `set_version` in the graph + bump `Cargo.toml` workspace version and `claude-plugin/.claude-plugin/plugin.json` together; record the cycle's plan as an open Intent (it then leads the brief).
- **Release:** CHANGELOG section (one `## v<version>` per release) → push → `gh workflow run draft-release.yml -f version=X.Y.Z` → publish the draft. Bump the graph's working version (`set_version`) when a cycle OPENS, not at release. Sharp edges: `cargo fmt` before the release commit; CI's clippy is newer (`cargo +<CI-version> clippy`); delete stale drafts by release id, never by tag (Caution `00d6s063tpjx`); a `startup_failure` dispatch is re-dispatched, a starved-runner flake gets `gh run rerun --failed` (Caution `00bywotv5tx7`); never `cp -f` over an executed binary on macOS (Caution `00byqnk4w09h`).
- **E2e suites:** `crates/engram-cli/tests/{e2e,e2e_wiring,e2e_encryption}.rs` (harness `e2e_common/`), ride `cargo test --workspace`. Screenshots: `scripts/screenshots.sh` (local only, never CI); a surface missing from `frontend/demo/data/` is missing from the docs too.
- **Eval:** `cargo run -p engram-eval --features fastembed -- --series|--ladder|--sizes N|--tricks|--posttune|--floor|--bench|--chains|--window|--shapes|--longmemeval s` — receipts in `eval/results/`; `--distractors 0` = question-everything mode; `--longmemeval` downloads SHA-pinned into `eval/data/` (gitignored).
- Search-before-write; every write response is a verdict (matched → merge, suspects → judge now, warnings → check canon).

## Chronicle (one line per release — `search` with `during_version` or read CHANGELOG.md for the story)
- **0.9.9** (OPEN 2026-09-24) — contradictions propagate along inheriting edges (`inherits` verb role, hint `inherited`); Laya int4 / multilingual selectable judges (tasksource stays default; exports at huggingface.co/techtheist/laya-onnx); `eval --shapes`; brief gains Current cycle + `bodies` / `canon_order`; numeric MCP args accept strings; the Claude Code plugin ships its MCP server (`mcp --wired-only`, rung `unwired`); sweeps release the engine lock per node (a Laya sweep froze the core); this file slimmed (old chronicle in git history).
- **0.9.8** (released) — unbound sessions refuse writes (issue #11); `GET /guide` operator's manual.
- **0.9.7** — the icon arrives; plugins say "Engram Alpha".
- **0.9.6** — the bench spoke lowercase: subject guard v3, clause read, tombstone title channel, duplicate guard (KnowledgeDrift v2 816 @500).
- **0.9.5** — KnowledgeDrift born (own repo since); title-NLI nomination path.
- **0.9.4** — ForgetEval + rake test; hits carry the tombstone role; knee cliff refuses 0.
- **0.9.3** — the pane fits any width.
- **0.9.2** — tombstones guard the write path.
- **0.9.1** — SelectMenu, Bob hooks, screenshot pipeline, docs sweep.
- **0.9.0** — Tombstone type, custom fields, at-rest encryption.
- **0.8.13** — identity-checked engine cache, honest stop, version handshake; schemas teach.
- **0.8.11** — `brief(project)` binds; Windsurf + Devin wiring. **0.8.10** — session-diverse delivery. **0.8.9** — set_project, NLI scoreboard.
- **0.8.8** — one heavy core, light bridges, binding ladder. **0.8.7** — search learns time. **0.8.6** — dual JetBrains artifacts, update awareness. **0.8.5** — first field reports. **0.8.4** — the history layer. **0.8.3** — batch width 2, fp32 embedder. **0.8.2** — merge_nodes, LongMemEval, chains. **0.8.1** — knee trim, weak line, tasksource NLI. **0.8.0** — measured not promised.
- **0.7.x** — eval harness, customization, timeline. **0.6.x** — TepinDB, hub, federation. **0.5.x** — local cortex. **0.4.x** — trust v2. **0.3.0** — plugin. **Phase 0–1** — core graph.

## Now
The brief's **Current cycle** section is the live worklist; `list_open` has everything, and the consolidated roadmap Intent `00b7jwku2hxm` holds the backlog (user actions, owed benches, unscheduled threads). Machine core on 8787; after `scripts/deploy-pane.sh`, `/mcp` reconnect.
