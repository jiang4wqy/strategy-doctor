# pipeline — 总编排

**目标：** 把红队、回测、评分、处方、复测串成一条 `runDoctor` 流水线——体检的入口。

**对外接口（见 [`../contracts.ts`](../contracts.ts)）：** `runDoctor(strategy, backtest, options) → Promise<Scorecard>`

**要建的文件：**
- `doctor.ts` — 诊断→评分→处方→held-out 复测的总编排（含"治疗集=验证集种子则抛错"的红线校验）

**对应开发计划任务：** Task 12　|　**负责人：** P1　|　**分支：** `feat/demo`
