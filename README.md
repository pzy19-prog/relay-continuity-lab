# Relay Lab — local continuity prototype

**English** | [简体中文](README.zh-CN.md)

**Status: public development preview / pre-alpha. The repository slug is a temporary engineering name; no final product brand, public release or actual cross-Agent E2E is claimed.**

Relay Lab explores evidence-bound task continuity across specialized AI surfaces. This starter **actually implements** a local single-user Core, CLI, manual handoff packet, explicit receipt + independent Git/file/test checks, persisted checkpoint/resume, a locally installable project-scoped Skill, and a *read-only* thin Web timeline. It **does not** integrate automatically with ChatGPT Chat, Work, Codex, Claude, or Gemini. The included demo substitutes a synthetic executor and a recorded synthetic approval; do not represent it as a live Agent run.

> Product thesis (to be tested): preserve the right task state, constraints and evidence across AI surfaces without repeatedly restating the full conversation — and fail visibly when evidence or environment is inconsistent.

## First pilot on Ubuntu WSL

Clone this public working repository. In your WSL shell:

```bash
git clone https://github.com/pzy19-prog/relay-continuity-lab.git
cd relay-continuity-lab
npm test
node scripts/pilot-prepare.mjs
```

Only give the generated synthetic `demo-repo` and `handoff.json` to an **authorized local coding Agent**. After it commits `calc.mjs` and no other file, run `node scripts/pilot-finish.mjs <printed-pilot_dir>` to create a candidate receipt, independently test, and stop at explicit human review. No actual Agent was used to produce this package. See [WSL guide (Chinese)](docs/wsl-pilot.zh-CN.md).

For **network-enabled WSL** environment-only competitor installation/command checks, run `bash scripts/competitor-smoke-wsl.sh` (disposable synthetic HOME; Handoff `--dry-run` avoids external upload). Run `bash scripts/brand-audit-wsl.sh` to collect public registry observations; **manual trademark clearance remains mandatory**. Neither script has been successfully run against upstream packages inside the current offline artifact container.

## Offline quickstart (Node >=22, Git)

```bash
npm test
npm run relay -- list
node scripts/demo.mjs
# Read the demo_dir / store from the printed output, then:
RELAY_STORE=/tmp/<actual-demo-dir>/state npm run ui
# Open http://127.0.0.1:4317 in your local browser
```

Demo creates a temporary synthetic Git repo. On real data, use the CLI **only for repos and tests you already trust**; independent tests execute repository code, so this is not a malicious-code sandbox. No cloud provider or account is required.

CLI commands:

```bash
node src/cli.mjs create --goal 'Fix a known bug' --repo /absolute/trusted/repo --actor local-executor --allowed src/calc.mjs --test src/calc.test.mjs
node src/cli.mjs handoff <task-id>             # prints explicit HandoffPacket; does NOT dispatch
node src/cli.mjs receipt <task-id> --file receipt.json
node src/cli.mjs verify <task-id>              # Git/head/path/hash + locally executed declared test
node src/cli.mjs decide <task-id> --decision APPROVE  # explicit human action only
node src/cli.mjs resume <task-id>
node src/cli.mjs list
```

State defaults to `~/.relay-lab-local/tasks/*.json`. Set `RELAY_STORE` or pass `--store <path>` to isolate it. For a public demo do not commit your local state directory; packet output includes absolute local paths, so redact before external sharing.

## Architecture

```text
Skill / CLI (manual adapter)       Read-only Web Timeline
             \                      /
              Local Relay Core
              | Task + State + Events
              | Handoff / Receipt / Independent Checks
              | Human Decision / Resume
              v
         Local JSON state
              |
      Trusted local Git fixture
```

Why JSON instead of SQLite today: a tiny zero-dependency, transparent *single-process research prototype* can be tested offline. SQLite, concurrency controls, authorization, TypeScript contracts, real adapters, PWA distribution and installation remain later work. This is **not** secure for concurrent writes or untrusted repo execution. UI listens on loopback (`127.0.0.1`) only and is read-only.

## Observed local checks

In the isolated artifact container the packaged prototype passed **18 integration tests and 10 design assertions**. The four new regressions reject post-receipt dirty worktrees, untracked file changes, symlink replacement of evidence and symlink test inputs. Tests execute trusted local repository code, not an untrusted-code sandbox. The actual Chat/Work/Codex handoff and upstream competitor tests remain unverified.

## Research / public development

- [Second devlog / four additional gates](docs/devlog/0002-proof-gates-before-agent-integration.zh-CN.md) — synthetic tests, not a real Agent run.
- [Competitor bench plan](docs/benchmark-plan.md), [clean WSL runbook](docs/competitor-runbook.md) — **not yet run against competitors** due unavailable network in this runtime.
- [Naming audit](docs/naming-audit-2026-09-23.md) — TaskContinuum name collision; no chosen product brand.
- [Public devlog](docs/0000-why-we-are-building.md) — claim/evidence separation required.
- [Skill](skills/relay/SKILL.md) — instructions for an AI assistant that can run this local CLI. Not an autonomous adapter.
- [Roadmap](docs/roadmap-v0.1.md) — prior plan; current implementation status is this README.

**Working name only — brand unverified.** An Apache/MIT-style open source license is not a product readiness claim. **Incubated by PZY Nexus** (provenance only; independently usable, not a runtime dependency).
## G3 — Try the installable Skill on a fresh synthetic fixture

```bash
git pull --ff-only
npm test
node scripts/skill-pilot-prepare.mjs
```

This prepares a **new** isolated repository with a committed project-level `.agents/skills/relay-lab/` Skill and a generated `AGENT_TASK.md`. Open only that generated repo in Cursor WSL and ask an authorized Agent to discover **and actually invoke** the project Skill before performing the constrained calculator fix. After its commit, run `node scripts/skill-pilot-finish.mjs <pilot_dir>` back in the Relay source checkout. Explicit human approval is still mandatory. See [中文操作说明](docs/skill-pilot.zh-CN.md).
