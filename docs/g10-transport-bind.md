# G10 - Explicit Transport Inbox -> Local Task binding gate

G10 keeps cloud transport and local execution as separate authority domains.

A validated Transport Inbox item becomes a local Relay task only when a human explicitly names:

- the canonical task ID,
- the target local Git repository,
- the reviewed last packet ID,
- the reviewed packet SHA-256.

Example:

    npm run bind -- \
      --store <relay-store> \
      --task <task-id> \
      --repo <trusted-clean-local-repo> \
      --expected-packet work-001 \
      --expected-hash <sha256>

The bind operation:

1. re-reads the validated inbox item;
2. requires a Work continuation as the reviewed last packet;
3. requires exact goal / allowed paths / test file / constraints continuity;
4. requires human-only scope/final-approval authority;
5. requires a clean Git repo root and records its exact base commit;
6. creates exactly one local task in `CREATED` state;
7. records immutable transport provenance on the task;
8. copies the validated packet chain into the local task transport snapshot for read-only lineage display.

It does **not** call handoff, execute code, record a receipt, verify a repo, decide, or approve.

Repeated identical binding is idempotent while the task remains at the initial `CREATED` gate. A changed packet/hash, dirty repo, different repo/base, conflicting provenance, or already-advanced task fails closed.

## Fresh pilot

G10 may reuse the accepted public-safe G9 Issue #13:

    node scripts/g10-pilot-prepare.mjs --issue 13

The script creates a fresh synthetic local repo and fresh Relay store, syncs Issue #13 into Transport Inbox, verifies Task Inbox is still empty, and prints the exact explicit bind command.

This reuses transport evidence; it does not rerun Work.
