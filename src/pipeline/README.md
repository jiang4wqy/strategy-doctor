# pipeline

`runDoctor(strategy, backtest, options)` 完成：

1. 校验 ID、维度、Skill、shock 和 treatment/held-out seed。
2. 回测选中场景并生成全部 `evaluations`。
3. 生成三风格评分和 deaths 子集。
4. 生成死因定向处方。
5. 在独立 held-out 场景上计算风险分和收益变化。

即使没有 death，也返回零改动处方和零 trade-off。
