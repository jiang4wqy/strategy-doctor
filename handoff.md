# Strategy Doctor Handoff

更新时间：2026-06-13（Asia/Shanghai）

## 当前结论

黑客松提交版代码和仓库内材料已经完成。剩余项需要账号持有人参与：录屏、上传、填写视频 URL、推送和提交表单。

## Git

- 分支：`codex/complete-hackathon-submission`
- 基线：`04f4d81`
- 核心实现：`51fcc58`
- CI：`93b45cb`
- 尚未推送、创建 PR 或打 tag。

## 已实现

- 五维快照、候选搜索和最坏场景选择。
- 完整 `ScenarioEvaluation[]`，survivor 可见。
- 策略、价格、场景集合和 seed 校验。
- Mock 与 Bitget 公共 K 线回测。
- 三风格评分、死因定向处方和 held-out 验证。
- Markdown/JSON CLI、文件输出和帮助。
- 可选 Anthropic 叙事与 fallback。
- MCP JSON/SSE、并发初始化和在线快照刷新。
- 覆盖率门槛、CI、README、演示和提交材料。
- 当前正式支持 `ma-cross`；多策略扩展留到下一里程碑的 `StrategyAdapter` 注册表和 RSI 均值回归参考实现。

## 最近验证

`npm.cmd run verify`：

- 116 passed，1 skipped live smoke，0 failed。
- Lines 95.52%，branches 86.47%，functions 98.94%。
- Typecheck 和 offline demo 通过。
- `git diff --check` 通过。

快照时间：`2026-06-13T04:15:45.396Z`。

当前 seed 42：

- conservative 6，aggressive 21，trend 15。
- leverage `10 -> 5`
- stopLossPct `0.5 -> 0.072`
- positionPct `1 -> 0.6`
- held-out 风险分 `+2`
- held-out 平均收益 `+37.1%`

## 最终操作

```powershell
npm.cmd ci
npm.cmd run verify
npm.cmd run demo:json
$env:BITGET_MCP_SMOKE='1'
node --test tests/integration/bitget-live.test.ts
npm.cmd run demo:live
git diff --check
git status --short
```

然后按 `docs/DEMO.md` 录屏，把 URL 填入 `docs/SUBMISSION.md`，推送分支并创建 PR。合并后再打 `mvp-m3`。

## 安全约束

- 不添加账户、持仓或下单功能。
- 不提交 Bitget 或 Anthropic 凭证。
- 默认 demo 和 CI 保持离线。
- 快照更新后允许场景存活，不修改 shock 强制死亡。
