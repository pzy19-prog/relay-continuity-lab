# G7 — Minimal Local Relay Service/API

G6 proved that the explicit transport path can be packaged without manual JSON copying. G7 tests whether a thin, provider-neutral local API is a better substrate for future adapters than having each adapter understand Relay's JSON files and CLI internals.

## Boundary

The G7 service is intentionally small:

- loopback-only: `127.0.0.1`
- read/status API only
- no CORS
- no remote bind
- no cloud tunnel
- no provider credentials
- no automatic APPROVE/REJECT
- existing local JSON store remains the persistence format for this spike

This is **not** automatic Chat/Work-to-WSL connectivity.

## Start against an existing store

For the accepted G6 pilot:

```bash
cd ~/relay-continuity-lab
git pull --ff-only
npm test

RELAY_STORE=/tmp/relay-g5-pilot-SqSj4a/relay-store \
npm run service
```

Expected listener: `http://127.0.0.1:4318`.

In another shell:

```bash
cd ~/relay-continuity-lab
npm run service:query -- health
npm run service:query -- show R-G6-CHATWORK-CODEX-001
npm run service:query -- checkpoint R-G6-CHATWORK-CODEX-001
```

The service response intentionally omits the task's local repository path.

## Restart durability check

1. Stop the service with Ctrl+C.
2. Start the same command again with the same `RELAY_STORE`.
3. Run the same `show` and `checkpoint` queries.
4. Canonical task ID, task state, checkpoint and transport lineage must remain unchanged.

## API v1

- `GET /v1/health`
- `GET /v1/tasks`
- `GET /v1/tasks/:id`
- `GET /v1/tasks/:id/checkpoint`

All non-GET methods are rejected in G7.

If this viability gate passes, future provider/client adapters should talk to this stable service contract rather than Relay's file layout.
