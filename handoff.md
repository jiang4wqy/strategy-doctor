# Strategy Doctor Handoff

更新时间：2026-06-14（Asia/Shanghai）

## 当前结论

多策略规格与契约已经冻结。B、C、A 最终接线已分别通过 PR #7、#8、#9 进入
`main`。D 分支已经补齐永久 RSI/Bollinger 示例、双策略 CLI 回归、共享场景
集成验收和最终发布文档，工程工作只剩最终 PR/CI/合并与 `main` 复验。

本轮已经完成：

- 建立独立 integration worktree。
- 验证基线测试与覆盖率。
- 恢复团队协作 Word 文档。
- 落地仓库级多人开发约束。
- 确认多策略正式设计规格。
- 合并 `Strategy` discriminated union 和 adapter contract。
- 合并 MA adapter、不可变 registry 和 registry-backed parser。
- 扩展 RSI/Bollinger 参数契约，加入趋势过滤周期与偏离阈值。
- 实现 SMA、population standard deviation 和 Wilder RSI。
- 实现增强 RSI/Bollinger adapter、定向 mutation policy 和确定性 jitter。
- 证明 MA 与 RSI/Bollinger adapter 可在本地 registry 中共同注册。
- 提取 `src/backtest/engine.ts`，统一持仓、止损、清算和 drawdown 循环。
- 将 Mock 与 Bitget backtester 迁移到 registry + shared engine。
- 将 prescription search 迁移到 adapter-owned patch、fields、jitter 和标签。
- 将 RSI/Bollinger adapter 注册进默认 runtime registry。
- 新增 `examples/rsi-bollinger.json` 并验证第二策略离线 CLI 全链路。
- 增加双策略 CLI 回归和共享场景端到端验收。
- 验证 seed 42 golden JSON 与原基线逐字节一致。

剩余顺序是：推送并合入 D 最终验收 PR，在合并后的 `main` 运行全量验证，然后
创建 `mvp-m3` 标签。录屏、视频上传和提交 URL 仍由账号持有人完成。

## 工作区与分支

### 公共基线

- 远端公共基线：`main`
- 已合入契约提交：
  - `7274a51 refactor: define multi-strategy type contract`
  - `b7db676 feat: register moving-average strategy adapter`
  - `74d06a7 refactor: parse strategies through adapter registry`
  - `5411fd6 Merge pull request #6 from jiang4wqy/feat/ma-adapter-integration`
  - `5ec015d Merge pull request #8 from jiang4wqy/feat/generic-risk-engine`
  - `97b0244 Merge pull request #7 from jiang4wqy/feat/rsi-bollinger-adapter`
  - `494f626 Merge pull request #9 from jiang4wqy/feat/ma-adapter-integration`

### 已合入 A/B/C

- `d9977fc feat: register RSI Bollinger strategy`
- A PR #9 已合入，merge commit：`494f626`。
- B PR #7 已合入，merge commit：`97b0244`。
- C PR #8 已合入，merge commit：`5ec015d`。
- `41f4877 refactor: extract generic strategy execution engine`
- `f6a7045 refactor: dispatch backtests through strategy adapters`
- `8a9b68b refactor: delegate prescription policy to adapters`

### D 最终验收

- `6d2b025 test: accept both strategy CLI workflows`
- `2509988 test: verify multi-strategy doctor acceptance`
- 分支：`test/multi-strategy-acceptance`
- 状态：本地验收与文档已完成，等待最终推送、CI 和合并。

### 组员独立分支

所有角色分支从同一个已验证 `main` 提交创建：

- A：`feat/ma-adapter-integration`
- B：`feat/rsi-bollinger-adapter`
- C：`feat/generic-risk-engine`
- D：`test/multi-strategy-acceptance`

每位组员只在自己的分支提交，并通过 PR 合入 `main`。不要直接向 `main`
提交，也不要切换或推送其他组员的分支。

### 已淘汰的旧分支结构

- `feat/backtest`、`feat/demo`、`feat/redteam` 和
  `feat/scoring-prescribe` 没有独立提交，不再使用。
- `codex/complete-hackathon-submission` 的有效提交已经被 `main` 吸收。
- `feat/multi-strategy-integration` 的有效提交已经被 `main` 吸收。
- 以上旧远端分支应删除，避免新成员误选。

## 多人开发规范状态

仓库级规范已经写好：

- `AGENTS.md`
  - 约束代理范围、worktree 隔离、ownership、TDD、验证和安全边界。
- `CONTRIBUTING.md`
  - 定义 A/B/C/D 分工、文件 owner、分支命名、固定合并顺序、PR 规则和 DoD。
- `.github/CODEOWNERS`
  - 当前使用已验证的仓库 owner `@jiang4wqy` 作为中央集成 owner。
- `.github/pull_request_template.md`
  - 强制记录范围、接口变化、依赖顺序、测试数量、coverage 和安全检查。
- `docs/Strategy-Doctor-团队协同分工方案.docx`
  - 详细 4 人方案、3/5 人调整、worktree 命令、P0-P4 清单和策略路线。
  - 其中旧分支命令仅作历史参考，当前分支操作以 `CONTRIBUTING.md` 为准。

当前本地约束已完整。GitHub 远端是否启用 branch protection、required review 和
required CODEOWNERS review 尚未配置或验证，需要仓库账号持有人在 push 后设置。

## Word 文档恢复与 QA

文件：

- `docs/Strategy-Doctor-团队协同分工方案.docx`
- 大小：50,066 bytes

恢复方式：

- 从 `2026-06-13` Codex 会话日志提取原始生成脚本。
- 在内存中重放，不保留临时生成脚本。
- 应用原会话最后一次表格 indent 修订。

结构审计结果：

- 69 个正文段落。
- 14 张表。
- Letter 页面和 1 英寸页边距。
- Heading 1/2/3 字号与段距符合原 preset。
- 必需章节完整。
- 无 `TODO`、`TBD`、`<填写>` 或“待补充”。
- 真实 bullet/decimal numbering 存在。
- 多页表头 repeat 属性存在。
- 无固定表格行高。
- 14 张表的 `tblW`、`tblInd`、`tblGrid` 和 `tcW` 全部一致。

视觉 QA 未完成：

- 标准 `render_docx.py` 仍因本机没有 LibreOffice/`soffice` 报
  `FileNotFoundError: [WinError 2]`。
- 因此不能声称逐页 PNG 已检查。

## 多策略设计规格

文件：

- `docs/superpowers/specs/2026-06-13-multi-strategy-design.md`

已冻结的设计：

- 闭合的两策略 registry，不做动态插件或 DSL。
- `Strategy` discriminated union。
- 公共风险参数与策略专属信号参数分离。
- adapter 负责 parser、decision、mutation 和参数标签。
- 公共 engine 负责持仓、止损、清算、equity 和 drawdown。
- 保留 `runOnPrices(MaCrossParams, prices)` 兼容入口。
- MA 决策语义保持现状。
- RSI 使用 Wilder RSI；Bollinger 使用 SMA 和 population standard deviation。
- RSI/Bollinger 明确多空入场和中轨/RSI 50 退出规则。
- 趋势过滤器只阻止强趋势中的逆势新开仓，不强制关闭已有仓位。
- prescription `changes` 保持 JSON key/value object 兼容。
- 固定合并顺序和完整测试矩阵。

当前状态：

- 规格已确认。
- 公共契约、MA adapter、registry 和 parser 接入已完成。
- A 分支已经进一步完成：
  - `StrategyByArchetype` 保持真正的 discriminated union 缩窄。
  - parser 不再按 archetype 写硬编码分支，只调用 registry。
  - MA adapter 自己拥有 decision、targeted patch、jitter 和参数标签。
  - adapter 目录通过架构测试禁止反向依赖 `src/prescribe/*`。
- B 分支已经完成：
  - `RsiBollingerParams` 新增 `trendFilterPeriod` 和
    `trendFilterThreshold`。
  - 指标实现为纯函数，Wilder RSI 的初始平均和递归平滑均有测试。
  - adapter 拥有参数解析、决策、定向 patch、targeted fields、jitter 和标签。
  - 清算只收紧杠杆/止损，回撤只降低仓位，反复止损才调整信号参数。
  - 没有修改全局 registry、公共 engine、`src/prescribe/*`、CLI 或示例。
- C 分支已经完成：
  - shared engine 实现 `hold`、`flat`、方向切换和止损后方向阻塞。
  - `runOnPrices(MaCrossParams, prices)` 保持兼容包装入口。
  - Mock 与 Bitget backtester 均通过 registry 选择 adapter。
  - `evolve.ts` 不再包含 `fastMA` 或 `slowMA` 策略专属 policy。
  - candidate 排序和公共 liquidation/drawdown 风险边界保持不变。
- A 最终接线已经完成：
  - 默认 registry 同时注册 MA 和 RSI/Bollinger adapter。
  - `parseStrategy` 接受并保留完整趋势过滤参数。
  - RSI 示例通过完整离线 CLI，产生 5 个 evaluations、3 个 style
    scores、prescription 和 held-out trade-off。
  - 无需在 `src/cli.ts` 增加 archetype 分支。
- D 最终验收已经完成：
  - 永久示例 `examples/rsi-bollinger.json` 已加入。
  - 同一 CLI 已验证两个 archetype。
  - 两种策略在相同 treatment/held-out 场景上均产生完整且确定性的 scorecard。
  - RSI 示例通过正式 CLI 候选搜索后在五个维度均有交易，共 27 次；technical
    场景触发
    `stop-loss-bleed`。
  - adapter 定向处方只修改对应死因允许的字段。
- 实施计划位于
  `docs/superpowers/plans/2026-06-13-contract-registry-plan.md`。
- A 角色收口计划位于
  `docs/superpowers/plans/2026-06-13-role-a-integration-plan.md`。
- A 基础收口 PR #6 已合入。
- C 公共执行/处方 PR #8 已合入。
- B PR #7 已合入。
- A 最终接线 PR #9 已合入。
- D 最终验收等待 PR 合入。

## 最近验证

在 D 最终验收分支已完成针对性验证；最终测试数量和 coverage 以合并前运行的
`npm.cmd run verify` 结果为准。

```powershell
npm.cmd run verify
```

- 155 tests：154 passed、1 skipped、0 failed。
- Lines 96.27%、branches 89.24%、functions 99.07%。
- 双策略 CLI、共享场景验收、TypeScript typecheck 和离线 demo 均通过。
- 两种策略均有 5 evaluations、conservative/aggressive/trend 三风格、
  prescription 和 held-out trade-off。
- RSI/Bollinger CLI：五维共 27 次交易，1 个 `stop-loss-bleed`，处方修改
  `rsiOversold`、`rsiOverbought`、`bollingerStdDev` 和
  `trendFilterThreshold`；held-out `robustnessGain=50`、
  `returnCost=0.0027`。
- seed 42 / 6 candidates 输出与 `examples/demo-scorecard.json` 逐字节一致。
- 两份 JSON 的 SHA-256 均为
  `60745EB1377E3B2160311C8101E72E1731329AA3DF173D75C4672616DD455E90`。

## 下一步

1. 推送 D 分支并创建最终 PR，等待 CI 后合入 `main`。
2. 在合并后的 `main` 运行 `npm.cmd run verify` 和双策略 CLI 验收。
3. 确认 `mvp-m3` 不存在后创建并推送 annotated tag。
4. 人工用 Word 打开协作方案，检查：
   - 分页和跨页表头。
   - 长路径换行。
   - P0-P4 大表密度。

## P0 验收标准

- 原 `ma-cross` seed 42 结果无意外变化。
- 新增 `examples/rsi-bollinger.json`。
- 同一 CLI 可以运行两个 archetype。
- 两种策略均输出五维 evaluations、deaths/survivors、prescription 和 held-out trade-off。
- 两种策略对相同压力场景产生可解释的不同诊断。
- `npm.cmd run verify` 全部通过且不降低 coverage 门槛。
- 默认仍离线，不连接账户或下单。

## 黑客松发布仍需账号持有人完成

- 按 `docs/DEMO.md` 录屏。
- 上传视频。
- 将 URL 填入 `docs/SUBMISSION.md`。
- 在 2026-06-24 前完成黑客松平台提交。
