# Strategy Doctor Handoff

更新时间：2026-06-13（Asia/Shanghai）

## 当前结论

多策略规格已经确认，公共契约与 adapter registry 基线已经完成。`main` 作为
唯一公共基线，在保持原 `ma-cross` 输出不变的前提下，已经具备第二种策略接入
所需的类型和注册边界。

本轮已经完成：

- 建立独立 integration worktree。
- 验证基线测试与覆盖率。
- 恢复团队协作 Word 文档。
- 落地仓库级多人开发约束。
- 确认多策略正式设计规格。
- 合并 `Strategy` discriminated union 和 adapter contract。
- 合并 MA adapter、不可变 registry 和 registry-backed parser。
- 验证 seed 42 golden JSON 与原基线逐字节一致。

RSI/Bollinger adapter、公共执行引擎、通用处方流程和双策略验收尚未实现，应由
各 owner 在四个固定成员分支完成后通过 PR 合入 `main`。

## 工作区与分支

### 公共基线

- 远端公共基线：`main`
- 已合入契约提交：
  - `7274a51 refactor: define multi-strategy type contract`
  - `b7db676 feat: register moving-average strategy adapter`
  - `74d06a7 refactor: parse strategies through adapter registry`

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
- 实施计划位于
  `docs/superpowers/plans/2026-06-13-contract-registry-plan.md`。
- A 角色收口计划位于
  `docs/superpowers/plans/2026-06-13-role-a-integration-plan.md`。
- 尚未创建 RSI/Bollinger 实现或 `examples/rsi-bollinger.json`。

### A 角色后续依赖

- 等待 C 提交公共执行引擎，并让 `src/prescribe/evolve.ts` 调用 adapter
  mutation policy。
- 等待 B 提交指标与 `rsi-bollinger.ts`；B 不直接修改 registry，A 在审查后
  完成 adapter 注册。
- C/B 合入后，A 负责 CLI 接线、MA golden 兼容复核和共享类型问题收口。
- D 最后负责双策略 CLI、示例和文档验收。

## 最近验证

在当前 contract/registry 基线执行：

```powershell
npm.cmd ci
npm.cmd run verify
```

结果：

- 125 tests。
- 124 passed。
- 1 skipped（默认跳过真实 Bitget smoke）。
- 0 failed。
- Lines 95.50%。
- Branches 86.58%。
- Functions 99.00%。
- TypeScript typecheck 通过。
- 离线 demo 通过。
- seed 42 / 6 candidates 输出与 `examples/demo-scorecard.json` 逐字节一致。
- 两份 JSON 的 SHA-256 均为
  `60745EB1377E3B2160311C8101E72E1731329AA3DF173D75C4672616DD455E90`。

## 下一步

1. 每位组员阅读：
   - `AGENTS.md`
   - `CONTRIBUTING.md`
   - `docs/superpowers/specs/2026-06-13-multi-strategy-design.md`
   - 本文件中自己的分支与 ownership
2. 各 owner 只在分配的角色分支开发并发起 PR。
3. A 按建议顺序将 PR 合入 `main`：
   - C：公共执行/处方。
   - B：RSI/Bollinger adapter。
   - A：注册 RSI adapter、跨模块接线、CLI 和 MA 兼容性收口。
   - D：双策略集成测试和材料。
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
- 四个成员分支通过 PR 合入 `main`。
- 最终验收后再打 `mvp-m3` tag。
