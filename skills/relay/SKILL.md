---
name: relay-lab
description: Create bounded local tasks, generate explicit handoff packets, collect receipts, verify Git evidence, and resume across coding Agent sessions. Use for evidence-aware handoff; manual consent required.
---

# Relay Lab — bounded task handoff (pre-alpha)

This Skill uses an installed local Relay CLI. It does **not** connect ChatGPT Chat/Work/Codex automatically and it has **no authority** to act on repositories the user did not explicitly approve. Follow the user's task and the exact state returned by the CLI; do not infer state or authority from chat history.

## Invocation

Locate this SKILL.md and its sibling `scripts/relay.mjs`. **Run the sibling from its absolute path** with Node 22+ while your working directory is the authorized Git project. For example, if installed in `.agents/skills/relay-lab/`, use:

```bash
node .agents/skills/relay-lab/scripts/relay.mjs --store /path/to/isolated/relay-store list
```

For global installations use the actual absolute skill directory (such as `~/.cursor/skills/relay-lab`). Keep the same `--store` across sessions. Use the project-specific store supplied by the user; never silently select another task's store.

## Workflow

1. **Start by inspecting state:** `show <task-id>` and `resume <task-id>` for an existing task. Check `environment_match`; if false, **stop** and ask for explicit reconciliation. Treat a returned `HANDED_OFF` task as assigned to the declared `actor`, not general permission to run arbitrary commands.
2. **Create a task only with user authorization:** `create --goal "..." --repo /trusted/isolated/repo --actor local-agent --allowed calc.mjs --test calc.test.mjs --constraints '...'`, then `handoff <task-id>`. A `handoff` command changes ownership; do not run it twice.
3. **Execute only if explicitly appointed:** If the user asked this Agent to act as executor for the named task, work solely in the named repo and declared paths, run the specified independent test, and produce a commit. Never modify the verifier or tests to make a failed change pass. Never `push`, contact a provider, delete a repo or open secret files without separate authorization.
4. **Record observed evidence rather than self-assessed success:** The trusted controller may create a receipt JSON with exact task, actor, base/head commit, and file hashes. After submission, run `receipt <task-id> --file <file>` then `verify <task-id>`. Missing evidence/stale head/out-of-scope changes block. A self-reported actor label is not authenticated proof.
5. **Human decision gate:** Stop at `VERIFIED_PENDING_DECISION` until the human reviews the observed run and issues `decide <task-id> --decision APPROVE` or `REJECT`. Never auto-approve.
6. **Resume:** `resume <task-id>` after an actual process restart; if the environment differs, ask the human before doing any more work. `UNKNOWN` means reconcile the original outcome, not retry automatically.

### Privacy and provenance

Handoff packets can contain local paths; share only inside the authorized environment. Do not export private workspace state or call private-provider APIs. Never describe the synthetic fixture as an independently benchmarked external product. A safe isolated demonstration is documented in the public repository's `docs/skill-pilot.zh-CN.md`.
