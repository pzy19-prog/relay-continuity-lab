# G9 - Bounded GitHub transport sync worker

G9 mirrors only validated GitHub transport into a local transport inbox. It never executes code, creates a local task, records a receipt, verifies a repository, or approves work.

## One source only

    node scripts/g9-pilot-prepare.mjs --issue <N>

Run the printed `sync_watch` command. The worker uses authenticated `gh api` only, watches one explicit repo+issue, validates packet hashes/lineage/public-safety, deterministically seals at most one valid Work draft, and stores the accepted chain under the local transport inbox.

Repeated reads of the same chain are idempotent. Task switch, chain rewrite, stale remote chain, duplicate Work draft, bad hash, wrong parent, private path, secret-like content, GitHub read failure, and more than 100 comments fail closed.

## Service/UI

Service v1 exposes:

- `GET /v1/transport-inbox`
- `GET /v1/transport-inbox/:task-id`

The service-backed UI renders Transport Inbox separately from local Task Inbox. A synced GitHub packet does not silently create a local coding task.

## Boundary

G9 reduces the manual GitHub-to-local import step, but it does not automate Work invocation, Codex execution, local task binding, or human approval.
