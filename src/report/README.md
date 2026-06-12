# report — 报告渲染

**目标：** 把 `Scorecard` 渲染成 markdown 体检报告（三风格评分表 / 死因清单 / 处方 / held-out 取舍 + 诚实声明）。CLI 入口 `src/cli.ts` 调用它。

**对外接口（见 [`../contracts.ts`](../contracts.ts)）：** `renderScorecard(card, strategy) → string`

**要建的文件：**
- `render.ts` — Scorecard → markdown

**对应开发计划任务：** Task 13　|　**负责人：** P1/P5　|　**分支：** `feat/demo`

**红线：** 报告必含"本报告不承诺一键变好"与量化代价。
