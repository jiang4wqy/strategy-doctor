# Strategy Doctor Handoff

更新时间：2026-06-15（Asia/Shanghai）

## 当前目标

当前里程碑是 P1 developer platform。集成分支：

```text
codex/p1-developer-platform
```

目标是在保留 P0 双策略 CLI 与 MA golden 输出的前提下，完成：

- Fastify REST API v1、OpenAPI、access code/Bearer 鉴权、限流与并发保护。
- 中英文自然语言描述到 `ma-cross` 或
  `rsi-bollinger-mean-reversion` 的结构化草稿。
- TypeScript client 与可直接运行的 Agent 示例。
- React/Vite/ECharts 参考前端、显式参数确认、四类图表和本地十条历史。
- 单进程静态服务、真实 Client/API 联调、Playwright、CI 与 Quick Tunnel 文档。

P1 仍然只支持单 symbol、两个已注册策略和离线 `MockBacktester`。不包含任意
策略代码、DSL、账户、持仓、下单或永久云部署。

## 已完成

P0 已完成并验证：

- `ma-cross` 与增强 RSI/Bollinger adapter 已注册到同一个 registry。
- 公共回测引擎、处方搜索、双策略 CLI 和离线场景验收已完成。
- MA seed 42 / candidates 6 golden SHA-256：
  `60745EB1377E3B2160311C8101E72E1731329AA3DF173D75C4672616DD455E90`。

P1 Foundation 已合入当前集成分支，merge commit：

```text
0ba5fdb merge: establish P1 foundation
```

Foundation 提供：

- machine-readable `StrategyAdapter.definition`。
- `strategyRegistry.listDefinitions()` 与 `getDefinition()`。
- 单 symbol、`*USDT`、`1h`/`4h`/`1d` runtime 校验和稳定错误码。
- detailed held-out metrics 与保持兼容的旧接口。
- `src/platform/contracts.ts` 共享 API/Web/Client DTO。
- `diagnoseStrategy()` 共享 application service。
- CLI 复用 application service，输出仍保持旧 `Scorecard`。

2026-06-15 Foundation 审查已补充修复：

- RSI capability 用 `exclusiveMaximum` 准确表达 `< 50` 与 `< 100`。
- capability 参数 key 受所属 strategy archetype 的 TypeScript 类型约束。
- definition、参数对象、example params 与 universe 全部深冻结。
- 协作规则不再引用旧 A 角色或让 Wave 2 错误同步 `origin/main`。

## Agent 执行状态

四个 Wave 2 实现 Agent 曾分别分配 API、自然语言、Web、Client/文档，但都在
写入文件前因 Agent 使用额度上限终止，没有可合并的提交，也没有修改对应
worktree。

两个只读审查 Agent 已完成，发现的问题已记录在上节并由集成线程修复。

因此后续不等待已终止 Agent，当前线程按以下顺序继续：

1. Fastify API。
2. 自然语言 parser。
3. TypeScript Client 与 API 文档。
4. React Web。
5. parse route、static serving、真实联调、E2E、CI、发布文档。

## 分支与 Ownership

当前 P1 分支：

```text
codex/p1-developer-platform
codex/p1-foundation
codex/p1-api
codex/p1-natural-language
codex/p1-client-docs
codex/p1-web
```

四个 Wave 2 分支都从 `0ba5fdb` 创建，目前没有独立提交。旧 P0 A/B/C/D
分支只属于历史记录，不再用于 P1。

文件 ownership 与合并顺序以以下文件为准：

- `AGENTS.md`
- `CONTRIBUTING.md`
- `docs/superpowers/plans/2026-06-14-developer-platform-master-plan.md`

Wave 2 的目标分支是 `codex/p1-developer-platform`。只有 P1 完整验收后的最终
PR 才以 `main` 为 base。

## 当前验证

Foundation merge 后的完整验证记录：

- 166 tests：165 passed、1 skipped、0 failed。
- Coverage：lines 96.64%、branches 89.45%、functions 99.15%。
- core + Web TypeScript typecheck 通过。
- 离线 demo 与 MA golden 文本通过。
- dependency audit：0 vulnerabilities。

2026-06-15 审查修复的定向验证：

```text
node --test tests/strategy/registry.test.ts tests/strategy/rsi-bollinger.test.ts
21 passed, 0 failed

npm.cmd run typecheck:core
passed
```

完整 `npm test`、`build:web`、`server` 和 E2E 当前尚不能作为通过项，因为
Wave 2 的 Web 与 Server 文件还未实现。这是当前待完成工作，不是已完成能力。

## 下一步

立即从 API 计划开始，遵循 TDD：

```text
docs/superpowers/plans/2026-06-14-developer-platform-api-plan.md
```

API 完成后依次执行自然语言、Client、Web 和 Integration 计划。每个阶段必须
先运行定向测试，再运行 typecheck 与 `git diff --check`。最终验收还必须运行
完整 coverage、Web build、Playwright、真实 Client/API 联调和 MA golden
字节校验。

## 已知外部事项

- GitHub `main` 的 branch protection、required review 与 required
  CODEOWNERS review 仍需要仓库 owner 在 GitHub Settings 中启用。
- Quick Tunnel 只用于临时团队预览，URL 重启后变化，终端和本地服务必须持续
  运行。
- 黑客松录屏、视频上传和平台提交需要账号持有人完成。
