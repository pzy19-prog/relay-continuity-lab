---
name: relay-lab
summary: Human-mediated task handoff and checkpoint continuity using the local Relay Lab CLI.
compatibility: Node.js 22+, Git. No cloud APIs required.
---

# Relay Lab Skill — local prototype

This skill is a thin CLI interface, **not an autonomous Agent-to-Agent transport**. It does not read proprietary ChatGPT, Work, Codex or Claude sessions.

When the user asks to hand off a task:

1. Confirm goal, constraints, authorized local Git repo, base commit, allowed paths and independent test file.
2. Create the task with the local CLI.
3. Generate an explicit handoff packet. Share only the minimum relevant context.
4. An explicitly authorized executor acts in its own runtime and returns a structured receipt.
5. Record the receipt and run independent verification locally.
6. Only after verification and explicit human approval may the task be marked complete.
7. After interruption, resume from persisted state and re-check environment match.

Never claim another Agent was invoked unless separately observed. Never promote self-reported PASS to verified evidence.
