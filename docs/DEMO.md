# Strategy Doctor 三分钟演示

## 演示前

```powershell
npm.cmd ci
npm.cmd run verify
```

关闭 Anthropic 环境变量，保证主演示离线。终端定位到仓库根目录。

## 0:00-0:20 问题

> 大多数交易工具帮助用户生成策略，但漂亮回测不能回答策略在陌生行情中会不会归零。Strategy Doctor 是策略的红队体检层：寻找最致命剧情，解释死因，给出处方，再用未参与治疗的场景诚实复测。

## 0:20-0:50 架构

展示 README Mermaid 图。

> 五份可审计快照对应 Bitget 五个官方分析 Skill。每维生成 6 个 seed 候选，统一回测后按 damage score 选择最坏场景。默认 Mock 离线；Bitget K 线和 Anthropic 是可选增强。

强调：

- treatment 与 held-out 根 seed 强制分离。
- held-out 不参与处方搜索。
- survivor 也进入 scorecard，不强制制造死亡。

## 0:50-2:00 运行

```powershell
npm.cmd run demo
```

依次指出五维覆盖表、快照时间、shock、damage、三风格评分和 death 叙事。

当前 seed 42：

- conservative 6，aggressive 21，trend 15。
- news 与 technical 为 liquidation。
- macro、market-intel、sentiment 为 drawdown breach。

## 2:00-2:40 处方与 held-out

```text
leverage 10 -> 5
stopLossPct 0.5 -> 0.072
positionPct 1 -> 0.6
```

> 清算只触发杠杆和止损修补，回撤只触发仓位修补。处方在 seed 100042 的 held-out 上复测。当前风险分变化 +2、平均收益变化 +37.1%。系统原样展示结果，不承诺一键变好。

## 2:40-3:00 可信度

> 项目使用 Node 24 原生 TypeScript，零运行时依赖。默认断网可运行；CI 强制 90/80/95 覆盖率门槛。系统没有交易账户和下单代码。

## 可选在线证明

主演示完成后再运行：

```powershell
npm.cmd run demo:live
```

这一步只读取 Bitget 公开 K 线。网络失败不影响离线结果。

## 录屏检查

- 总时长不超过 3 分钟。
- 不显示 key、登录信息或环境变量值。
- 数字与 `examples/demo-report.md` 一致。
