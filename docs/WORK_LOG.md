# Work Log

更新时间：2026-06-18（Asia/Shanghai）

## 当前分支

| 角色 | 本地目录 | 分支 | 最新提交 | 状态 |
|---|---|---|---|---|
| C 执行/风险 | `D:\github\strategy-doctor` | `feat/generic-risk-engine` | `15199e3 fix: harden generic risk engine inputs` | 已提交并与远端分支一致 |
| D 多策略验收 | `D:\github\strategy-doctor-d-acceptance` | `test/multi-strategy-acceptance` | `95d7af5 test: lock release artifact workflows` | 已补完整环境并通过 verify，日志更新待提交 |

## 这次补强了什么

### C：Generic Risk Engine

- 在 `src/backtest/engine.ts` 增加公共风险参数运行时防线：
  - `leverage >= 1`
  - `0 < stopLossPct <= 0.99`
  - `0 < positionPct <= 1`
  - 拒绝 `NaN` 和 `Infinity`
- 在 `src/prescribe/evolve.ts` 增加 prescription seed 校验，要求 safe integer。
- 在 `tests/backtest/engine.test.ts` 和 `tests/prescribe/evolve.test.ts` 补齐对应失败用例。

### D：Multi-Strategy Acceptance

- 在 `README.md`、`docs/DEMO.md`、`docs/SUBMISSION.md` 明确列出两条可执行 CLI：
  - `examples/trend-follower.json`
  - `examples/rsi-bollinger.json`
- 新增 `tests/integration/release-artifacts.test.ts`：
  - 检查公开文档同时引用两个策略示例。
  - 检查两个示例都能通过 `parseStrategy`。
  - 检查两个示例都能跑出完整离线 JSON scorecard。
  - 检查五维 evaluations、三风格评分、prescription、held-out tradeoff 都存在且数值有限。

## 已跑验证

系统 PATH 原本没有 `npm.cmd`，已按要求把 Node/npm 放在 D 盘：

- Node/npm：`D:\tools\node-v24.14.0-win-x64`
- 依赖目录：`D:\github\strategy-doctor-d-acceptance\node_modules`

随后运行了完整项目验证。

| 验证项 | 结果 |
|---|---|
| C 范围测试 | 33 passed |
| D 目标测试 | 9 passed |
| 核心可运行测试集 | 193 tests，192 passed，1 skipped |
| 核心覆盖率 | Lines 96.52%，Branches 88.54%，Functions 99.27% |
| 完整 `npm.cmd run verify` | 229 tests，228 passed，1 skipped；typecheck 通过；demo 通过 |
| 完整覆盖率 | Lines 96.35%，Branches 89.35%，Functions 99.10% |
| MA CLI | 跑通，输出五维高杠杆趋势跟随诊断 |
| RSI/Bollinger CLI | 跑通，输出五维均值回归诊断 |
| `git diff --check` | 通过 |

## 当前 CLI 效果

### MA 趋势跟随

- 策略：`examples/trend-follower.json`
- 场景集：`tx42/ho100042`
- seed 42 下暴露高杠杆策略的回撤和清算问题。
- news 与 technical 维度触发强制清算。
- macro、market-intel、sentiment 维度触发回撤击穿。

### RSI/Bollinger 均值回归

- 策略：`examples/rsi-bollinger.json`
- 场景集：`tx42/ho100042`
- 五个维度都有交易。
- technical whipsaw 触发 `stop-loss-bleed`。
- 相比 MA，风险表现和死因不同，能展示双策略共享诊断框架但保留各自策略行为。

## 完整 verify 状态

已在 D 盘补齐 Node/npm 和项目依赖，并成功运行：

```powershell
cd D:\github\strategy-doctor-d-acceptance
D:\tools\node-v24.14.0-win-x64\npm.cmd ci
$env:PATH='D:\tools\node-v24.14.0-win-x64;' + $env:PATH
D:\tools\node-v24.14.0-win-x64\npm.cmd run verify
```

完整 verify 包含：

- `npm run test:coverage`
- `npm run typecheck:core`
- `npm run typecheck:web`
- `npm run demo`

## 待上传

GitHub 连接当前不稳定，`git push` 曾因 `github.com:443` 连接超时失败。
网络恢复后执行：

```powershell
cd D:\github\strategy-doctor-d-acceptance
git push origin test/multi-strategy-acceptance
```

如果需要重新推 C 分支：

```powershell
cd D:\github\strategy-doctor
git push origin feat/generic-risk-engine
```
