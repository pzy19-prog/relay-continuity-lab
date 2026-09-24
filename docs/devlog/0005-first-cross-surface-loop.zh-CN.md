# Devlog 0005：第一条真实 Chat → Work → Codex → Chat 闭环

日期：2026-09-24

G4 使用一个无敏感数据的合成计算器任务，完成了：

`Chat intent -> Work continuation -> WSL Relay import -> local Codex Skill execution -> independent verification -> execution receipt -> Chat review -> human approve -> resume`。

关键观察：

- canonical task ID 全程保持 `R-G4-CHATWORK-CODEX-001`；
- Work 没有扩大 scope；
- Codex 只修改允许的 `calc.mjs`；
- Relay 独立检查 PASS；
- receipt 返回 Chat 后 packet lineage/hash 可再次审查；
- 最终批准仍由人执行；
- post-decision resume 显示 `COMPLETED`、`environment_match=true`、`worktree_clean=true`。

这证明的是**显式 transport 下的跨界面连续性**，不是三个产品共享隐藏 session。G4 仍需要用户主动切换 Chat / Work / Cursor，并运行若干 WSL 命令。

G5 因此转向降低 choreography：确定性 adapter 自动封装/发布 transport packet，并让本地 UI 可视化整条 lineage，而不是扩大权限。
