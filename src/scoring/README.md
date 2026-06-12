# scoring — 评分层

**目标：** 同一组回测结果，用稳健/激进/趋势三套权重+死亡阈值，给出三个不同的风险分——"失败是相对的"。

**对外接口（见 [`../contracts.ts`](../contracts.ts)）：** `scoreStyle(metrics[], profile) → StyleScore`

**要建的文件：**
- `styles.ts` — 三种投资者风格预设（权重 + 回撤阈值 + 清算容忍度）
- `scorecard.ts` — 一组回测结果 → 单风格评分

**对应开发计划任务：** Task 8　|　**负责人：** P4　|　**分支：** `feat/scoring-prescribe`
