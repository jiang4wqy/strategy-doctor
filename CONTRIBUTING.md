# Strategy Doctor 多人协作规范

本规范是仓库内当前有效的协作基线。扩展说明见
`docs/Strategy-Doctor-团队协同分工方案.docx`，但其中旧分支命令仅作历史参考；
实际分支操作以本文件为准。`docs/superpowers/**` 记录 P0/P1 历史计划和
当时的两策略边界；当前 `main` 已进入 Track 2 提交收口状态，实际功能以
README、API capabilities 和当前测试为准。

## 1. 分支与 worktree

- `main`：当前唯一公共基线和提交目标。
- 已合并的历史实现分支已删除，远端当前只保留 `main`。
- 小修可以直接在 `main` 上完成并立即验证；多人并行或高风险改动应从
  `main` 创建短生命周期分支，完成后通过 PR 合回 `main`。
- 每位成员只在自己的分支和 worktree 中修改和提交。
- 禁止多人共享同一个工作目录，禁止在他人的 checkout 中切分支。
- 共享分支禁止 force-push、rebase 和历史重写。

新成员首次开始时只需：

```powershell
git clone https://github.com/jiang4wqy/strategy-doctor.git
cd strategy-doctor
git switch main
git pull
```

需要同步公共进展时执行 `git pull origin main`。需要创建短分支时使用
`git switch -c <topic-branch>`。

## 2. 文件 ownership

| 角色 | 独占范围 | 交付 |
|---|---|---|
| Foundation | `AGENTS.md`、`CONTRIBUTING.md`、根 package/TypeScript 配置、`src/contracts.ts`、`src/platform/**`、`src/strategy/**`、`src/prescribe/validate.ts`、`src/pipeline/doctor.ts`、`src/application/**`、`src/cli.ts`、对应测试 | P1 公共契约、能力定义、共享诊断服务、P0 兼容 |
| API | `src/server/**`、`tests/server/**` | Fastify、安全、REST、OpenAPI、静态服务基础 |
| 自然语言 | `src/natural-language/**`、`tests/natural-language/**` | 本地规则解析与可选 Anthropic fallback |
| Web | `web/**` | React 参考客户端、ECharts、history、导出 |
| Client/文档 | `src/client/**`、`tests/client/**`、Agent 示例、`docs/API.md` | TypeScript client 与开发者接入材料 |
| Integration/QA | parse route/default wiring、`tests/e2e/**`、CI、README、SETUP、DEMO、SUBMISSION、handoff | 合并、真实 API 联调、浏览器验收、Quick Tunnel |
| MCP | `src/mcp/**`、`tests/mcp/**`、MCP 专属依赖 | stdio MCP adapter |

一个文件同一时间只能有一个 owner。跨 ownership 修改必须在 PR 的
“跨模块依赖”中写明，并由文件 owner 与 Foundation/集成 owner 共同解决冲突。

集成边界：

- 历史 P1 并行分支只能作为参考，不再作为当前分支流程。
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

当前仓库已完成 P1 和 Track 2 提交强化，不再使用历史 Wave 1/Wave 2 合并
顺序。后续改动按风险排序：

1. 文档、提交材料、部署说明等低风险改动可以直接验证后提交。
2. Web/API 行为改动必须先补测试，再运行 Web、typecheck、build 和相关 API
   检查。
3. 策略契约或 registry 改动必须补 runtime parser、capability、自然语言、
   示例和诊断测试，再运行完整覆盖率门槛。

## 5. PR 规则

- 一个 PR 只解决一个模块目标。
- 标题使用 `feat:`、`fix:`、`test:`、`docs:` 或 `refactor:` 前缀。
- 列出 changed files、未包含范围、接口变化、验证命令和已知限制。
- 修改共享契约时，必须由 Foundation/集成 owner 和受影响模块 owner 审查。
- 普通模块 PR 至少由集成 owner 和相邻模块 owner 审查。
- 冲突由文件 owner 与集成 owner 共同解决，禁止直接选择整文件
  ours/theirs。
- PR 的 base branch 是 `main`。
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

当前最终验收还必须满足：

- 原 155-test 基线继续通过，MA golden JSON 保持逐字节一致。
- Web、REST、TypeScript client 和 CLI 使用同一个 application service。
- API capabilities 暴露四个已注册策略和参数 bounds。
- 本地中文/英文描述只映射四个已注册策略；不支持时返回稳定错误。
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
