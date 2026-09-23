# G4 — Chat → Work → Codex explicit transport

G4 uses one GitHub Issue as a temporary cross-surface transport. It does **not** synchronize hidden conversations or call a private local WSL API.

## Packet model

Canonical transport packets carry `task_id`, `packet_id`, `seq`, `parent_packet_id`, source/target surface, human-only authority, payload and a canonical SHA-256.

Flow:

1. Chat publishes a sealed `CHAT_INTENT` packet.
2. Work reads that exact packet and publishes a structured `relay-lab/work-draft-v0` continuation comment. Work is not required to implement Relay's canonical hashing itself.
3. Chat's Relay adapter reads the Work draft, checks task/parent/scope, and publishes the sealed `WORK_CONTINUATION` packet.
4. WSL runs `node scripts/g4-pilot-prepare.mjs --issue <transport-issue>`. It validates the sealed packet chain, creates a fresh synthetic repo, installs the project Skill and creates the **same canonical task ID** locally.
5. Cursor/Codex uses `show` and `resume`, performs the bounded edit, and commits.
6. `g4-pilot-finish.mjs` independently verifies and emits a sealed `EXECUTION_RECEIPT` packet plus a `gh issue comment` command.
7. Chat reads the receipt. Explicit human approval remains the final gate.

## Why Work emits a draft

Hashing and protocol sealing are adapter responsibilities, not reasoning responsibilities. Work must preserve task identity, parent packet, scope and authority; the Relay adapter performs deterministic validation/sealing. This avoids asking a language model to reproduce canonical SHA-256 rules manually.

## Public-safety boundary

Transport packets reject obvious local absolute paths, credential-like values and private transport fields. The G4 pilot uses only a synthetic calculator fixture. No PCT/Nexus/Forge or other private project content belongs in the transport Issue.

## Current non-claims

- no automatic ChatGPT Chat ↔ Work hidden-state sync;
- no direct Work ↔ WSL networking;
- GitHub is a temporary transport, not the final Relay Service;
- actor labels are not cryptographic identity;
- independent tests are not a malicious-code sandbox.
