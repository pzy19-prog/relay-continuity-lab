# Relay Lab — local continuity prototype

**English** | [简体中文](README.zh-CN.md)

Switching AI tools often means explaining the task again, reconstructing its state, and checking whether “done” matches the result. Relay Lab saves task identity, constraints and delivery evidence in explicit handoff packets and local checkpoints, so the next participant can inspect them and stop when evidence or environment disagrees.

**Public development preview / pre-alpha: a local, single-user, single-process experiment.** The repository slug is a temporary engineering name, not a final product brand or stable release. The latest recorded milestone is [G10 explicit binding](docs/devlog/0010-g10-explicit-bind-accepted.zh-CN.md), accepted on 2026-09-24.

## What works, and where it stops

| Implemented | Not implemented here |
| --- | --- |
| Local Core/CLI, structured handoff/receipt, project-scoped Skill and persisted checkpoints | Hidden Chat/Work/Codex session sync, direct Chat/Work control of WSL, or a general autonomous executor |
| Independent Git, task/actor/base/head, changed-path, file-hash and declared-test checks | Semantic correctness guarantees, strong actor/human authentication, signed evidence, or an untrusted-code sandbox |
| Read-only loopback Web timeline and Relay Service API | Remote Service access, service-side approval, multi-user authorization or concurrent-write protection |
| Bounded GitHub Issue transport sync into a separate Transport Inbox; explicit local binding | Automatic executor handoff, coding, receipt, verification or approval after G10 binding |

These boundaries describe this public Lab. They do not establish the capabilities of other PZY components. Actor/human fields are workflow conventions; hashes are not signatures. JSON persistence is a single-user, single-process experiment without concurrent-write protection.

## One task, two separate paths

A controlled calculator example makes the execution path concrete: a person hands off a task limited to `calc.mjs`; an authorized local Agent commits a fix; Relay checks the receipt against Git, file evidence and the unchanged test; a person reviews the result and decides; a later process reads the checkpoint. This is a synthetic pilot with explicit human steps.

```text
Optional GitHub transport path (G9/G10):
GitHub Issue -> validated Transport Inbox
             -> explicit human-authorized bind -> local task: CREATED
                                                    [stop before handoff]

Local execution path:
Local task -> explicit handoff -> authorized local Agent -> receipt
           -> independent verify -> VERIFIED_PENDING_DECISION
           -> explicit human APPROVE / REJECT -> checkpoint / resume
```

G10 preserves the canonical task ID, scope, test, constraints and source-packet/local-base provenance. Binding does not start execution. `handoff` produces a packet; it does not dispatch an Agent. `verify` can reach `VERIFIED_PENDING_DECISION`, after which `decide` is a separate human action. An `UNKNOWN` receipt stops at `WAITING_RECONCILIATION` for inspection; this is a safe stop, not an automatic recovery runtime.

## Offline synthetic quickstart

Requirements: **Node >=22 and Git**. The commands below use Bash on Ubuntu/WSL. After obtaining the source, checks run offline with no cloud account, model or Agent; no dependency installation is needed. Only the optional GitHub transport guides require an authenticated `gh`.

**Run tests only in repositories you already trust.** Independent checks execute repository code; Relay is not a malicious-code sandbox.

```bash
git clone https://github.com/pzy19-prog/relay-continuity-lab.git
cd relay-continuity-lab
npm test
```

`npm test` runs the Node test suite and then `benchmark/smoke.mjs` on temporary synthetic Git fixtures. It exercises controlled examples rather than launching a real coding Agent. The smoke script has its own standalone validator; its 10 assertions are not 10 production-Core end-to-end tests.

For a persistent task and a real local coding Agent, follow the separate [WSL pilot](docs/wsl-pilot.zh-CN.md) or [project Skill pilot](docs/skill-pilot.zh-CN.md). The [G6 operator guide](docs/g6-unified-demo.md) covers the explicit transport demo; [G8](docs/g8-service-backed-adapters.md) covers Service-backed UI/Skill reads. Early guides retain their original gate-status wording; use the dated records below for later observations.

Local state defaults to `~/.relay-lab-local/tasks/*.json`; isolate it with `RELAY_STORE` or `--store <path>`. Do not commit local state. Packets can contain absolute paths: sanitize them before public sharing.

## Historical acceptance records

These are recorded observations, **not a claim that the checks were rerun for this documentation update**.

| Record and source | Observation and scope |
| --- | --- |
| 2026-09-23 [initial STATUS snapshot](STATUS.md) | 13/13 Node integration tests + 10/10 synthetic assertions in an artifact container; WSL/real-Agent gates were still pending at that time |
| Pre-G10 [Chinese README snapshot](https://github.com/pzy19-prog/relay-continuity-lab/blob/4549783c8573379574ca42df3ed4798bfff7443a/README.zh-CN.md) | Retained an earlier isolated 19/19 + 10/10 result without a separate run date; this is not the later G10 baseline |
| 2026-09-24 [G10-era README record](https://github.com/pzy19-prog/relay-continuity-lab/blob/4549783c8573379574ca42df3ed4798bfff7443a/README.md#observed-local-checks) | User-observed WSL baseline: 43/43 Node tests + 10/10 standalone synthetic smoke assertions |
| 2026-09-24 [G10 pilot devlog](docs/devlog/0010-g10-explicit-bind-accepted.zh-CN.md) | One explicit bind created exactly one `CREATED` task; repeated identical bind was idempotent; no handoff, code execution, receipt, verify or decision occurred |

The G10 count comes from the linked README record; the pilot devlog documents the binding observations. Neither is a production benchmark, adversarial security audit or hands-on competitor comparison.

## Milestones and detailed guides

| Stage | Public record / guide |
| --- | --- |
| G2 — manual local-Agent handoff | [WSL pilot](docs/wsl-pilot.zh-CN.md); the [G3 devlog](docs/devlog/0003-installable-project-skill.zh-CN.md) records the preceding G2 result |
| G3 — project Skill and task-state binding | [Installation](docs/skill-pilot.zh-CN.md), [initial pending gate](docs/devlog/0003-installable-project-skill.zh-CN.md), [first real invocation failed on store binding](docs/devlog/0004-first-skill-binding-failure.zh-CN.md) |
| G4/G5 — explicit cross-surface loop and transport helpers | [G4 guide](docs/g4-chat-work-codex.md), [G5 guide](docs/g5-transport-ui.md), [real local Codex Skill execution recorded in G4](docs/devlog/0005-first-cross-surface-loop.zh-CN.md) |
| G6 — unified demo operator | [Guide](docs/g6-unified-demo.md), [acceptance and measured command counts](docs/devlog/0006-g6-unified-demo-accepted.zh-CN.md) |
| G7/G8 — local Service and read clients | [G7 guide](docs/g7-local-service.md), [G7 acceptance](docs/devlog/0007-g7-local-service-accepted.zh-CN.md), [G8 guide](docs/g8-service-backed-adapters.md), [G8 acceptance](docs/devlog/0008-g8-service-backed-adapters-accepted.zh-CN.md) |
| G9 — bounded transport sync | [Guide](docs/g9-transport-sync-worker.md), [acceptance](docs/devlog/0009-g9-github-sync-worker-accepted.zh-CN.md) |
| G10 — explicit bind, stopping at `CREATED` | [Guide](docs/g10-transport-bind.md), [acceptance](docs/devlog/0010-g10-explicit-bind-accepted.zh-CN.md) |

The early “Skill invocation pending” statements describe those earlier gates. The later G4 record includes real local Codex Skill execution; they should not be read as simultaneous current statuses.

## Research and discussion

Start with [why we are building](docs/0000-why-we-are-building.md), the [Skill instructions](skills/relay/SKILL.md), and the [roadmap](docs/roadmap-v0.1.md) (a prior plan; use this README and dated devlogs for implementation status). Questions and reproducible findings are welcome through [GitHub Issues](https://github.com/pzy19-prog/relay-continuity-lab/issues); share synthetic, sanitized evidence only.

**Working name only — brand unverified. Incubated by PZY Nexus** (provenance only; independently usable, not a runtime dependency). [MIT license](LICENSE); the license is not a product-readiness claim.
