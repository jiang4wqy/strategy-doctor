# 团队协作与发布状态

## 当前状态

截至 2026-06-13，仓库已完成五维离线闭环、候选搜索、Bitget 公共数据、可选 LLM、CLI、CI 和提交材料。当前开发分支为 `codex/complete-hackathon-submission`。

| 里程碑 | 状态 |
|---|---|
| 五维离线闭环 | 完成 |
| 对抗搜索与在线增强 | 完成 |
| 文档和 demo 产物 | 完成 |
| 录屏、上传、提交链接 | 需要账号持有人完成 |

## 协作规则

1. 不直接改 `main`，使用短分支和有意义的提交。
2. 行为变化先写失败测试，再写最小实现。
3. 不修改与任务无关的代码。
4. 提交前运行 `npm.cmd run verify` 和 `git diff --check`。
5. 不提交 key、secret、passphrase 或账户数据。
6. 不加入实盘、下单、账户或持仓能力。
7. 快照更新后测试不得假设某个实时场景一定致死。

## 模块职责

| 模块 | 路径 | 公共入口 |
|---|---|---|
| 契约 | `src/contracts.ts` | `Strategy`、`ScenarioEvaluation`、`Scorecard` |
| 数据 | `src/data` | `loadDefaultSnapshotBundle`、`refreshSnapshots` |
| 红队 | `src/redteam` | `buildAdversarialScenarioSet` |
| 回测 | `src/backtest` | `MockBacktester`、`BitgetBacktester` |
| 评分 | `src/scoring` | `scoreStyle` |
| 处方 | `src/prescribe` | `prescribe`、`validateOnHeldOut` |
| 编排 | `src/pipeline` | `runDoctor` |
| 报告 | `src/report` | `renderScorecard` |

## 发布前检查

```powershell
npm.cmd ci
npm.cmd run verify
npm.cmd run demo:json
$env:BITGET_MCP_SMOKE='1'
node --test tests/integration/bitget-live.test.ts
git diff --check
git status --short
```

人工步骤：

1. 按 [DEMO.md](DEMO.md) 录制不超过 3 分钟的视频。
2. 上传视频并把 URL 填入 [SUBMISSION.md](SUBMISSION.md)。
3. 复核 README、提交表单和视频数字来自同一次冻结快照。
4. 合并分支后打 `mvp-m3` 标签。
