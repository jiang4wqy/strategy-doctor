# Strategy Doctor 多人协作规范

本规范是仓库内当前有效的协作基线。扩展说明见
`docs/Strategy-Doctor-团队协同分工方案.docx`，但其中旧分支命令仅作历史参考；
实际分支操作以本文件为准。多策略接口以
`docs/superpowers/specs/2026-06-13-multi-strategy-design.md` 为准。

## 1. 分支与 worktree

- `main`：唯一公共基线和 PR 目标，不直接开发。
- P0 只保留四个成员分支：
  - A：`feat/ma-adapter-integration`
  - B：`feat/rsi-bollinger-adapter`
  - C：`feat/generic-risk-engine`
  - D：`test/multi-strategy-acceptance`
- 每位成员只在分配给自己的一个分支中修改和提交。
- 除非 A 明确批准，不再创建额外长期分支。
- 所有成员 PR 都直接合入 `main`。
- 禁止多人共享同一个工作目录，禁止在他人的 checkout 中切分支。
- 共享分支禁止 force-push、rebase 和历史重写。

新成员首次开始时只需：

```powershell
git clone https://github.com/jiang4wqy/strategy-doctor.git
cd strategy-doctor
git switch <分配给自己的分支>
git pull
```

不要执行 `git switch main` 后直接修改。需要同步公共进展时，在自己的分支执行
`git fetch origin`，再执行 `git merge origin/main`。

## 2. 文件 ownership

| 角色 | 独占范围 | 交付 |
|---|---|---|
| A 架构/集成 | `src/contracts.ts`、`src/strategy/parse.ts`、`src/strategy/registry.ts`、`src/cli.ts`、`package.json` | 契约、registry、MA 迁移、最终集成 |
| B 策略算法 | `src/strategy/indicators.ts`、`src/strategy/adapters/rsi-bollinger.ts`、对应策略测试 | 指标、增强均值回归 adapter |
| C 执行/风险 | `src/backtest/*`、`src/prescribe/*`、对应测试 | 公共执行引擎、策略专属 mutation |
| D QA/材料 | `tests/integration/*`、`tests/cli.test.ts`、`examples/*`、`docs/*`、`README.md` | 双策略验收、CLI 回归、演示材料 |

一个文件同一时间只能有一个 owner。跨 ownership 修改必须在 PR 的
“跨模块依赖”中写明，并由文件 owner 与 A 共同解决冲突。

集成边界：

- B 负责提交 RSI/Bollinger adapter，但不直接修改
  `src/strategy/registry.ts`；adapter 通过审查后由 A 完成注册。
- C 负责将 `src/prescribe/evolve.ts` 迁移为调用 adapter 的 mutation
  policy，不在 `src/strategy/adapters/*` 中实现公共搜索流程。
- A 不提前实现 C 的公共 engine，也不提前实现 B 的指标和决策算法。

当前 A/B/C 状态：

- C 的 shared execution engine 和 adapter-driven prescription 已通过 PR #8
  合入 `main`。
- B 的 Wilder RSI、Bollinger、趋势过滤器和均值回归 adapter 已通过 PR #7
  合入 `main`。
- 趋势过滤器只过滤新开仓，已有仓位仍按中轨或 RSI 50 退出。
- A 已完成默认 registry 注册和第二策略离线 CLI 验证。
- 下一步合入 A 最终接线，再由 D 补正式示例、验收和发布材料。

## 3. 契约冻结规则

以下内容已经冻结并进入 `main`：

1. `Strategy` discriminated union。
2. 公共风险参数。
3. `StrategyAdapter` 方法与决策语义。
4. adapter registry。
5. prescription changes 的跨策略表达。
6. `ma-cross` 基线兼容条件。

如确需修改这些契约，必须由 A 发起或明确批准，并补齐 runtime parser、
契约测试、示例 JSON 和迁移说明。

## 4. 合并顺序

公共契约和 MA adapter 基线已经进入 `main`。剩余建议分阶段合并：

1. A 基础收口：类型缩窄、通用 registry parser、MA policy ownership。
2. C：公共执行引擎和 adapter-driven 处方框架。
3. B：RSI/Bollinger adapter。
4. A 最终接线：注册 RSI adapter、CLI 和 MA 兼容性复核。
5. D：双策略集成测试、示例和文档。

后序 PR 必须明确前置 commit 或 PR。不得通过同时修改共享文件绕过顺序。

## 5. PR 规则

- 一个 PR 只解决一个模块目标。
- 标题使用 `feat:`、`fix:`、`test:`、`docs:` 或 `refactor:` 前缀。
- 列出 changed files、未包含范围、接口变化、验证命令和已知限制。
- 修改共享契约时，必须由 A 和受影响模块 owner 审查。
- 普通模块 PR 至少由 A 和相邻模块 owner 审查。
- 冲突由文件 owner 与 A 共同解决，禁止直接选择整文件 ours/theirs。
- PR 的 base branch 必须是 `main`。
- 合并前在个人分支合并最新 `origin/main`，禁止对已共享分支 rebase。

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
