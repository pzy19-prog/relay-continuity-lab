# Devlog 0008：G8 Service-backed 本地适配器验收

日期：2026-09-24

G8 的目标是把本地“读状态”的客户端从 Relay 内部 JSON 结构中解耦出来，统一依赖 G7 已验证的 Service v1。

## fresh pilot

Canonical task：

`R-G8-SERVICE-ADAPTER-001`

观察到：

- Node tests: 36/36 PASS
- smoke assertions: 10/10 PASS
- project binding present: false
- Service: `127.0.0.1:4318`
- UI data source: `service-v1`
- Skill service-health/show/checkpoint: PASS
- Skill used `--store`: no
- direct Relay JSON read: no
- files changed: no
- commit created: no
- restart durability: PASS
- state drift: no
- environment_match: true
- worktree_clean: true
- lineage: `chat-001 -> work-001`

## Human-visible UI gate

人工截图确认 Web UI 显示：

- `Data source: service-v1`
- task `R-G8-SERVICE-ADAPTER-001`
- state `HANDED_OFF`
- current surface `codex`
- `chat-001 -> work-001` lineage
- task timeline

因此 UI 与 Luna/Skill 均通过稳定 Service Contract 查看同一任务，而不是各自理解 JSON store。

## Architecture result

本地 read clients 的依赖关系已从：

`UI / Skill -> Relay JSON layout`

转为：

`Relay Store -> Service v1 -> UI / Skill`

这为后续 adapter 保留了一个稳定的 provider-neutral boundary。

## Remaining friction

G8 没有解决的最大人工环节已经不再是本地状态读取，而是：

`Chat / Work -> GitHub transport -> local Relay`

云端 surface 仍不能直接访问 localhost；GitHub 仍是显式 transport。下一阶段更值得优先验证一个受限、fail-closed 的 GitHub transport sync worker，而不是先扩大本地 Service 的写权限。
