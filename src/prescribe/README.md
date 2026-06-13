# prescribe

- `mutations.ts`：死因到参数修补的映射和确定性邻域抖动。
- `evolve.ts`：仅搜索死因相关参数，按存活、风险分、清算数、回撤和收益择优。
- `validate.ts`：对原策略和 patched 策略运行独立 held-out 场景。

处方只修改 `Strategy.params`，不会改变 archetype、universe 或 timeframe。
