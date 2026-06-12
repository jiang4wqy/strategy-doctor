# backtest — 回测/执行层

**目标：** 把"策略 + 攻击场景"翻译成标准化的回测指标，是红队和评分共同依赖的度量底座。

**对外接口（见 [`../contracts.ts`](../contracts.ts)）：** `BacktestAdapter.run(strategy, scenario) → Promise<Metrics>`

**要建的文件：**
- `path.ts` — 种子 RNG（`mulberry32`）+ 场景→价格路径生成器（确定性）
- `mock.ts` — 确定性 Mock 回测引擎（MVP 主线，必交）：MA 交叉、杠杆、止损、爆仓
- `bitget.ts` — Bitget Agent Hub 适配器（增强，spike 验证后再实现）

**对应开发计划任务：** Task 3、4、15　|　**负责人：** P2　|　**分支：** `feat/backtest`

**红线：** Mock 引擎必须确定性（同输入同输出）；Bitget 适配器只读、无下单。
