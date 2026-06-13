# Strategy Doctor 多人协作规范

本规范是仓库内可执行的协作基线。扩展说明见
`docs/Strategy-Doctor-团队协同分工方案.docx`，多策略接口以
`docs/superpowers/specs/2026-06-13-multi-strategy-design.md` 为准。

## 1. 分支与 worktree

- `main`：稳定分支，不直接开发。
- `codex/complete-hackathon-submission`：黑客松提交版冻结基线。
- `feat/multi-strategy-integration`：P0 多策略集成分支，只由 A 合并。
- 每位成员必须使用独立功能分支和独立 worktree。
- 禁止多人共享同一个工作目录，禁止在他人的 checkout 中切分支。
- 共享分支禁止 force-push、rebase 和历史重写。

Windows PowerShell 示例：

```powershell
# A：契约与集成
git worktree add ..\strategy-doctor-contract `
  -b feat/strategy-adapter-contract `
  feat/multi-strategy-integration

# B：RSI + Bollinger
git worktree add ..\strategy-doctor-rsi `
  -b feat/rsi-bollinger-adapter `
  feat/multi-strategy-integration

# C：公共执行与处方
git worktree add ..\strategy-doctor-risk `
  -b feat/generic-risk-engine `
  feat/multi-strategy-integration

# D：双策略验收与材料
git worktree add ..\strategy-doctor-qa `
  -b test/multi-strategy-acceptance `
  feat/multi-strategy-integration
```

## 2. 文件 ownership

| 角色 | 独占范围 | 交付 |
|---|---|---|
| A 架构/集成 | `src/contracts.ts`、`src/strategy/parse.ts`、`src/strategy/registry.ts`、`src/cli.ts`、`package.json` | 契约、registry、MA 迁移、最终集成 |
| B 策略算法 | `src/strategy/indicators.ts`、`src/strategy/adapters/rsi-bollinger.ts`、对应策略测试 | 指标、均值回归 adapter、示例参数 |
| C 执行/风险 | `src/backtest/*`、`src/prescribe/*`、对应测试 | 公共执行引擎、策略专属 mutation |
| D QA/材料 | `tests/integration/*`、`tests/cli.test.ts`、`examples/*`、`docs/*`、`README.md` | 双策略验收、CLI 回归、演示材料 |

一个文件同一时间只能有一个 owner。跨 ownership 修改必须在 PR 的
“跨模块依赖”中写明，并由文件 owner 与 A 共同解决冲突。

## 3. 契约冻结规则

以下内容先于并行实现合并：

1. `Strategy` discriminated union。
2. 公共风险参数。
3. `StrategyAdapter` 方法与决策语义。
4. adapter registry。
5. prescription changes 的跨策略表达。
6. `ma-cross` 基线兼容条件。

契约 PR 必须包含类型、runtime parser、契约测试、示例 JSON 和迁移说明。
契约合并前，B/C/D 不得依赖未冻结字段。

## 4. 合并顺序

固定顺序如下：

1. 契约和 registry。
2. MA adapter 迁移。
3. 公共执行引擎和处方框架。
4. RSI/Bollinger adapter。
5. 双策略集成测试、CLI、示例和文档。

后序 PR 必须明确前置 commit 或 PR。不得通过同时修改共享文件绕过顺序。

## 5. PR 规则

- 一个 PR 只解决一个模块目标。
- 标题使用 `feat:`、`fix:`、`test:`、`docs:` 或 `refactor:` 前缀。
- 列出 changed files、未包含范围、接口变化、验证命令和已知限制。
- 修改共享契约时，必须由 A 和受影响模块 owner 审查。
- 普通模块 PR 至少由 A 和相邻模块 owner 审查。
- 冲突由文件 owner 与 A 共同解决，禁止直接选择整文件 ours/theirs。
- 合并前同步 integration；只允许在个人分支 rebase。

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

P0 最终验收还必须满足：

- 原 `ma-cross` seed 42 结果无意外变化。
- 同一 CLI 可运行 `ma-cross` 和 `rsi-bollinger-mean-reversion`。
- 两种策略均输出五维 evaluations、deaths/survivors、prescription 和 held-out trade-off。
- `examples/rsi-bollinger.json` 存在并通过 parser。
- 两种策略对相同压力场景产生可解释的不同诊断。

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
