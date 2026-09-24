# G8 - Service-backed UI + Local Agent Adapter

G7 established a stable loopback read/status Service Contract. G8 moves local read adapters onto that contract so they stop learning Relay's JSON layout.

## Service-backed UI

Start the service:

    RELAY_STORE=<store> npm run service

Then start the UI in service mode:

    RELAY_SERVICE_URL=http://127.0.0.1:4318 npm run ui

The UI displays `Data source: service-v1`. In this mode it gets task state, evidence, events and packet lineage through `/v1`; it does not read the Relay store directly.

## Local Agent / Skill

A newly installed project Skill supports read-only Service commands:

    node .agents/skills/relay-lab/scripts/relay.mjs service-health
    node .agents/skills/relay-lab/scripts/relay.mjs service-show <task-id>
    node .agents/skills/relay-lab/scripts/relay.mjs service-checkpoint <task-id>

These do not require `--store` or `.relay-lab.json`. State-changing commands keep the existing Core/CLI authority rules.

## Fresh pilot

    node scripts/g8-pilot-prepare.mjs

The pilot intentionally creates no `.relay-lab.json` binding. Start Service + service-backed UI with the printed commands, then let Cursor/Luna execute only `AGENT_TASK.md` as read-only inspection.

Architecture remains explicit: Chat/Work -> GitHub transport -> local import/store -> Relay Service -> UI/local Agent. G8 does not claim Chat/Work can reach localhost.
