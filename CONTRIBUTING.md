# Strategy Doctor 多人协作规范

本规范是仓库内当前有效的协作基线。扩展说明见
`docs/Strategy-Doctor-团队协同分工方案.docx`，但其中旧分支命令仅作历史参考；
实际分支操作以本文件为准。P1 接口以
`docs/superpowers/specs/2026-06-14-developer-platform-design.md` 为准，执行
顺序以 `docs/superpowers/plans/2026-06-14-developer-platform-master-plan.md`
为准。

## 1. 分支与 worktree

- `main`：唯一公共基线和 PR 目标，不直接开发。
- P1 集成分支：`codex/p1-developer-platform`。
- Foundation 分支：`codex/p1-foundation`，必须最先完成。
- Foundation 合并后，从同一提交创建四个并行分支：
  - API：`codex/p1-api`
  - 自然语言：`codex/p1-natural-language`
  - Web：`codex/p1-web`
  - Client/文档：`codex/p1-client-docs`
- P1.1 MCP 使用 `codex/p1-mcp`，只能在 P1 REST 契约稳定后开始。
- 每位成员只在分配给自己的一个分支和 worktree 中修改和提交。
- Wave 2 分支先合入 `codex/p1-developer-platform`，完整验收后再由集成人
  创建 PR 合入 `main`。
- 禁止多人共享同一个工作目录，禁止在他人的 checkout 中切分支。
- 共享分支禁止 force-push、rebase 和历史重写。

新成员首次开始时只需：

```powershell
git clone https://github.com/jiang4wqy/strategy-doctor.git
cd strategy-doctor
git switch <分配给自己的 codex/p1-* 分支>
git pull
```

不要执行 `git switch main` 后直接修改。需要同步公共进展时，在自己的分支执行
`git fetch origin`，再执行 `git merge origin/main`。

## 2. 文件 ownership

| 角色 | 独占范围 | 交付 |
|---|---|---|
| Foundation | `AGENTS.md`、`CONTRIBUTING.md`、根 package/TypeScript 配置、`src/contracts.ts`、`src/platform/**`、`src/strategy/**`、`src/prescribe/validate.ts`、`src/pipeline/doctor.ts`、`src/application/**`、`src/cli.ts`、对应测试 | P1 公共契约、能力定义、共享诊断服务、P0 兼容 |
| API | `src/server/**`、`tests/server/**` | Fastify、安全、REST、OpenAPI、静态服务基础 |
| 自然语言 | `src/natural-language/**`、`tests/natural-language/**` | 本地规则解析与可选 Anthropic fallback |
| Web | `web/**` | React 参考客户端、ECharts、history、导出 |
| Client/文档 | `src/client/**`、`tests/client/**`、Agent 示例、`docs/API.md` | TypeScript client 与开发者接入材料 |
| Integration/QA | parse route/default wiring、`tests/e2e/**`、CI、README、SETUP、DEMO、SUBMISSION、handoff | 合并、真实 API 联调、浏览器验收、Quick Tunnel |
| MCP | `src/mcp/**`、`tests/mcp/**`、MCP 专属依赖 | P1.1 stdio MCP adapter |

一个文件同一时间只能有一个 owner。跨 ownership 修改必须在 PR 的
“跨模块依赖”中写明，并由文件 owner 与 A 共同解决冲突。

集成边界：

- Wave 2 只能从同一个已验证 Foundation commit 创建。
- API 不修改 application、registry、平台 DTO 或 Web。
- 自然语言只导出 parser，不注册 Fastify route。
- Web 只通过 `import type` 消费 `src/platform/contracts.ts`，不导入 server、
  application、registry 或 backtester。
- Client 不依赖 React/Fastify，Web 不复用 Bearer-only Client。
- Integration 只处理有意保留的 parse route、default services、static
  serving、真实联调和发布材料。
- `package.json`、`package-lock.json` 和共享 contracts 同一时间只有一个
  owner。

## 3. 契约冻结规则

以下 P0 内容已经冻结并进入 `main`：

1. `Strategy` discriminated union。
2. 公共风险参数。
3. `StrategyAdapter` 方法与决策语义。
4. adapter registry。
5. prescription changes 的跨策略表达。
6. `ma-cross` 基线兼容条件。

P1 新增的 `src/platform/contracts.ts` 在 Foundation 合并后同样冻结。确需
修改共享契约时，必须由 Foundation/集成人发起，并补齐 runtime parser、
契约测试、示例 JSON 和迁移说明。

## 4. 合并顺序

P1 固定顺序：

1. Foundation：治理、依赖、能力定义、共享 DTO、detailed held-out、
   application service、CLI 兼容。
2. 从同一 Foundation commit 同时启动 API、自然语言、Web、Client/文档。
3. 各支线完成规格审查和代码质量审查。
4. 按 API → 自然语言 → Client/文档 → Web 顺序合入集成分支。
5. Integration：parse route、default services、static serving、真实 Client
   联调、Playwright、CI、Quick Tunnel 文档。
6. P1 完整验收后合入 `main`。
7. MCP 从已合入 P1 的稳定 REST 契约开始。

## 5. PR 规则

- 一个 PR 只解决一个模块目标。
- 标题使用 `feat:`、`fix:`、`test:`、`docs:` 或 `refactor:` 前缀。
- 列出 changed files、未包含范围、接口变化、验证命令和已知限制。
- 修改共享契约时，必须由 A 和受影响模块 owner 审查。
- 普通模块 PR 至少由 A 和相邻模块 owner 审查。
- 冲突由文件 owner 与 A 共同解决，禁止直接选择整文件 ours/theirs。
- Wave 2 PR 的 base branch 是 `codex/p1-developer-platform`；最终 P1 PR 的
  base branch 才是 `main`。
- 合并前在个人分支合并最新目标分支，禁止对已共享分支 rebase。

仓库当前使用 `@jiang4wqy` 作为集成 owner。其他成员的 GitHub 用户名确认后，
再追加到 `.github/CODEOWNERS` 对应路径，不以虚构账号占位。

## 6. Definition of Done

每个 PR 必须满足：

- 行为变化有先失败后通过的测试。
- `npm.cmd run verify` 通过。
- `git diff --check` 通过。
- 未降低 coverage 门槛。
- 未改变默认离线、安全和确定性边界。
- 未提交 secret、临时文件、缓存或 `node_modules`。
- PR 描述记录测试数量、coverage、skip 和已知限制。

P1 最终验收还必须满足：

- 原 155-test 基线继续通过，MA golden JSON 保持逐字节一致。
- Web、REST、TypeScript client 和 CLI 使用同一个 application service。
- API capabilities 暴露两个已注册策略和参数 bounds。
- 本地中文/英文描述只映射 MA 或 RSI/Bollinger；不支持时返回稳定错误。
- Web 必须显式确认参数后才诊断，并显示四类图表。
- browser history 仅保存在本地，最多十条。
- 公共预览必须有 access code/Bearer key、rate limit 和并发限制。
- OpenAPI、REST 与 TypeScript 示例无需阅读源码即可运行。

## 7. 每日交接

每位成员只需报告：

1. 完成内容与验证命令。
2. 下一步只修改哪些文件。
3. 是否需要共享接口变化。
4. 阻塞项、依赖人和合并顺序。

分支交接必须附上：

```text
目标：
修改文件：
未修改/不在范围：
公共接口变化：
验证命令与结果：
需要集成人注意的合并顺序：
已知限制：
```
