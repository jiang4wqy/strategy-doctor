# redteam

五个 snapshot parser/builder 分别负责 `macro`、`market-intel`、`news`、`sentiment` 和 `technical`。

- `search.ts`：每维生成 1-50 个确定性候选，并按 damage score 选择最坏场景。
- `diagnose.ts`：分类 liquidation、drawdown breach、stop-loss bleed 和 survived。
- `narrate.ts`：默认本地叙事，可选 Anthropic `/v1/messages`，3 秒失败回退。

候选不会突破维度边界，也不会人为保证策略死亡。
