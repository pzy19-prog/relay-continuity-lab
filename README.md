# Relay Lab — local continuity prototype

**English** | [简体中文](README.zh-CN.md)

**Status: public development preview / pre-alpha. The repository slug is a temporary engineering name; no final product brand or public release. G2–G6 have completed progressively stronger local/cross-surface continuity pilots. G6 completed one fresh unified-operator run with recovery guidance, cwd-safe pilot launcher, measured actions, a sanitized report, explicit human approval and post-decision resume.**

Relay Lab explores evidence-bound task continuity across specialized AI surfaces. It now implements a local single-user Core, CLI, explicit transport packets, independent Git/file/test checks, persisted checkpoint/resume, a locally installable project-scoped Skill, guarded GitHub transport helpers, and a *read-only* Web timeline that can render cross-surface lineage. It still **does not** provide hidden-session synchronization or direct Chat/Work-to-WSL control. G4 demonstrated one real synthetic Chat → Work → Codex → Chat loop through explicit GitHub transport and human approval.

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


## Offline quickstart (Node >=22, Git)

```bash
npm test
npm run relay -- list
node scripts/skill-pilot-prepare.mjs
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

The latest user-observed G6 WSL baseline passed **33/33 Node tests + 10/10 synthetic assertions**. The fresh G6 run then reached `COMPLETED` with canonical task identity preserved, `INDEPENDENT_CHECKS_PASS`, explicit human approval, `environment_match=true`, `worktree_clean=true`, three transport packets, **6 recorded unified demo CLI commands**, and **0 manual JSON-copy actions**. Tests execute trusted local repository code, not an untrusted-code sandbox.

## Research / public development

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

## G4 — Chat → Work → Codex explicit transport

G4 uses a dedicated GitHub Issue as a temporary, auditable transport. Chat publishes a sealed intent packet; Work emits a structured continuation draft; Chat validates/seals it; WSL then imports the packet chain and creates the same canonical task ID locally. See [G4 guide](docs/g4-chat-work-codex.md). This is not hidden-session synchronization or direct Work-to-WSL networking.

## G5 — reduce manual transport steps

G5 added and validated a local transport adapter that checks Work drafts, seals `WORK_CONTINUATION`, publishes only with explicit authenticated `gh` flags, stores a transport snapshot beside Relay state, and renders the packet lineage in the read-only UI. One real synthetic G5 run completed through human approval and post-decision resume. See [G5 guide](docs/g5-transport-ui.md).

## G6 — unified demo operator

G6 validated `npm run demo -- ...` plus a pilot-local `relay-demo` launcher as the unified operator path for `prepare`, `status`, `finish`, explicit `approve`, sanitized `report`, and recovery guidance. The accepted fresh run recorded 6 unified demo CLI commands and 0 manual JSON-copy actions. G4/G5 historical user-action counts are not retroactively invented. See [G6 guide](docs/g6-unified-demo.md).
