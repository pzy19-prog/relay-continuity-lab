# Devlog 0006：G6 统一 Demo 闭环验收

日期：2026-09-24

G6 的目标不是扩大权限，而是把 G5 已经验证的跨界面连续性流程收敛成一个更容易操作、可恢复、可计量、可演示的统一入口。

## 实测闭环

本轮 canonical task 为 `R-G6-CHATWORK-CODEX-001`。

实际链路：

`Chat intent -> Work draft -> unified demo prepare -> work-001 -> local Relay -> Codex -> independent verify -> codex-receipt-001 -> Chat review -> human APPROVE -> resume -> sanitized report`

最终观察：

- final state: `COMPLETED`
- independent review: `INDEPENDENT_CHECKS_PASS`
- `environment_match=true`
- `worktree_clean=true`
- canonical task preserved: `true`
- packet count: 3
- unified demo CLI commands recorded: 6
- manual JSON copy actions: 0

## 本轮发现并修复的问题

1. 从 synthetic demo repo 目录执行 `npm run demo` 会因为没有 `package.json` 而 ENOENT。
2. 因此新增 pilot-local `relay-demo` launcher，使 `status / finish / approve / report` 可以从任意 cwd 运行。
3. launcher 的首个回归测试曾因非 async callback 中使用 `await import(...)` 导致 Node 22 parse-time SyntaxError。
4. 修复后 WSL 基线达到 33/33 Node tests + 10/10 synthetic assertions；对应最新 GitHub Actions run 也恢复为 success。

这些失败均被保留为公开开发证据，不作为成功结果隐藏。

## 计量边界

G4/G5 当时没有前瞻性 action instrumentation，因此不事后编造精确点击数或 surface-switch 数。G6 只报告本轮真实记录的数据。

`manual_json_copy_actions=0` 只描述 G6 packaged path，不等价于“完全自动跨平台同步”。

## 当前边界

G6 仍是 explicit transport：

- GitHub 仍作为临时桥；
- Chat / Work 不直接访问本地 WSL；
- 用户仍主动切换 surface；
- actor identity 尚非 cryptographic；
- human final approval 仍不可自动跳过。

G6 之后的架构决策应以这些剩余摩擦为依据，而不是直接假设需要更重的服务。
