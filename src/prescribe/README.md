# prescribe — 进化/处方层

**目标：** 由红队死因驱动的"定向进化"——每个变异都对应一条死因，而非盲目 GA；再在分离的 held-out 场景集上复测，诚实输出"稳健性↔收益"取舍。

**对外接口（见 [`../contracts.ts`](../contracts.ts)）：** `prescribe(...) → Prescription`；`validateOnHeldOut(...) → Tradeoff`

**要建的文件：**
- `mutations.ts` — 死因→定向修补映射 + 邻域抖动
- `evolve.ts` — 处方：定向修补为基准 + 邻域搜索择优
- `validate.ts` — held-out 复测：原版 vs 处方版的诚实对比

**对应开发计划任务：** Task 9、10、11　|　**负责人：** P4　|　**分支：** `feat/scoring-prescribe`

**红线：** 治疗集与验证集种子必须不同（防自我过拟合）；输出永远带收益代价。
