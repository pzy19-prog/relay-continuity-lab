# Why we are building Relay Lab

> Public build log 0000 — 2026-09-23  
> Status: public repository created; product brand remains unsettled.

A single work item can span several AI interfaces and executors. Switching surfaces often means reconstructing task state: what was agreed, what changed, which evidence is current, and who can authorize the next step.

A conversation transcript is not an authoritative task record. Relay Lab tests a local-first, evidence-bound continuation workflow:

1. capture one task and explicit constraints;
2. produce a bounded handoff packet;
3. collect an executor receipt without trusting self-reported PASS;
4. independently verify Git state, file scope and declared tests;
5. expose ownership, stop conditions and next action;
6. resume after interruption without silently changing task identity.

The first public implementation is deliberately small. Existing projects already provide handoffs, skills, persisted sessions, GUIs and decision logs, so none of those words are treated as novel.

The project may be narrowed, integrated with another tool, or stopped if same-fixture comparison fails to show a useful gap.

Build-in-public rule: publish sanitized experiments, failures and changed decisions; never publish private Nexus/PCT/Forge content or raw personal transcripts.

Working relationship: independently usable product, **incubated by PZY Nexus**. Repository slug is an engineering name, not the final brand.
