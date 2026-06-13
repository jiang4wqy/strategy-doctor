# Strategy Doctor Handoff

更新时间：2026-06-13（Asia/Shanghai）

## 我们的目标

构建一个可离线、确定性复现的 Strategy Doctor MVP：

1. 使用 Bitget 官方分析师 Skill 采集真实市场数据。
2. 将实时结果固化为带采集时间的标准化 JSON 快照。
3. 把快照确定性转换为红队攻击场景。
4. 使用 Mock 回测诊断策略死因并生成三风格评分。
5. 根据死因只修改相关策略参数，生成可解释处方。
6. 在未参与处方搜索的 held-out seed 上复测。
7. 通过 `npm run demo` 输出诊断、评分、处方和诚实取舍报告。

当前扩展目标是补齐以下三个维度，使 CLI 从两维升级为五维：

- `macro-analyst` → `macro`
- `market-intel` → `market-intel`
- `news-briefing` → `news`

## 代码当前状态

### 已实现

- `sentiment-analyst` 真实快照、校验和确定性 squeeze 场景。
- `technical-analysis` 真实快照、校验和确定性 whipsaw 场景。
- 确定性价格路径和 Mock 均线策略回测。
- 清算、回撤击穿、震荡止损放血死因分类。
- 稳健型、激进型、趋势型三风格评分。
- 死因定向参数修补与确定性邻域搜索。
- treatment 与 held-out seed 重叠检查。
- `runDoctor` 总流水线。
- Markdown 报告和 CLI。
- `npm run demo` 可离线运行。
- 冻结的 `src/contracts.ts` 没有修改。

### 最近一次完整验证

- `npm.cmd test`：60/60 通过。
- `npm.cmd run typecheck`：通过。
- `npm.cmd run demo`：通过。
- `git diff --check`：通过，仅有 `docs/SETUP.md` 的 Windows 换行符提示。

### 当前 Demo 结果

- 治疗集：`tx42`
- held-out：`ho100042`
- 稳健型风险分：6
- 激进型风险分：21
- 趋势型风险分：15
- 处方：杠杆 `10→5`、止损 `0.5→0.072`、仓位 `1→0.6`
- held-out 风险分变化：`+4`
- held-out 平均收益变化：`+24.9%`
- 报告明确声明不承诺“一键变好”。

### Git 状态

工作区位于 `main`，当前功能改动尚未提交。仓库最初只有脚手架提交，因此大量本次新增文件显示为未跟踪文件。不要使用 `git reset --hard` 或其他方式清除这些文件。

## 正在积极编辑的文件

### 已完成但尚未提交

- `examples/sentiment-btc.snapshot.json`
- `examples/technical-btc-4h.snapshot.json`
- `src/backtest/path.ts`
- `src/backtest/mock.ts`
- `src/redteam/sentiment.ts`
- `src/redteam/technical.ts`
- `src/redteam/diagnose.ts`
- `src/scoring/styles.ts`
- `src/scoring/scorecard.ts`
- `src/prescribe/mutations.ts`
- `src/prescribe/evolve.ts`
- `src/prescribe/validate.ts`
- `src/pipeline/doctor.ts`
- `src/report/render.ts`
- `src/cli.ts`
- `tests/backtest/*`
- `tests/redteam/*`
- `tests/scoring/*`
- `tests/prescribe/*`
- `tests/pipeline/doctor.test.ts`
- `tests/report/render.test.ts`
- `tests/integration/*`
- `tests/cli.test.ts`
- `docs/SETUP.md`

### 下一阶段预计新增或修改

- `examples/macro-btc.snapshot.json`
- `examples/market-intel-btc.snapshot.json`
- `examples/news-btc.snapshot.json`
- `src/redteam/macro.ts`
- `src/redteam/market-intel.ts`
- `src/redteam/news.ts`
- `tests/redteam/macro.test.ts`
- `tests/redteam/market-intel.test.ts`
- `tests/redteam/news.test.ts`
- `src/cli.ts`
- `tests/cli.test.ts`
- 五维端到端集成测试

三份新快照和三个转换模块尚未创建。

## 已采集的三维真实数据

Bitget Skill Hub `1.0.2` 已部署到 Codex，并配置官方公开 market-data MCP：

- MCP：`https://datahub.noxiaohao.com/mcp`
- MCP server version：`1.26.0`
- 不使用私有 API Key。
- 不执行交易操作。

本次采集试跑时间约为：

- UTC：`2026-06-12T15:17:31Z`
- 北京时间：`2026-06-12 23:17:31`

### Macro

- Fed Funds 上限：3.75%
- Fed Funds 下限：3.50%
- 2Y Treasury：4.13%
- 10Y Treasury：4.55%
- 10Y-2Y spread：0.40%
- 10Y breakeven：2.29%
- High Yield spread：2.80%
- DXY：99.739
- VIX：18.73
- BTC 90 日滚动相关性：
  - DXY：-0.3013
  - Nasdaq 100：0.5730
  - VIX：-0.4707

### Market Intel

- 加密总市值：约 2.2836 万亿美元
- BTC dominance：56.422%
- 市值 24h 变化：+2.338%
- 美元稳定币总供给：约 3142.24 亿美元
- 稳定币供给变化：
  - 1 日：+0.0589%
  - 7 日：-0.4298%
  - 30 日：-1.9823%
- BTCUSDT 大户仓位多头占比最近值：54.81%
- BTCUSDT OI：
  - 24 小时首值：101359.257 BTC
  - 最新值：98408.778 BTC
  - 约下降 2.91%

### News

已成功获取 `news-briefing` 指定的加密、宏观和监管新闻源。最新新闻包含：

- 加密监管与 MiCA 相关消息。
- FTX/Sam Bankman-Fried 上诉相关消息。
- 机构对加密市场底部的判断。
- 美国 PPI 高于预期。
- 英国 GDP 下滑和地缘冲突影响。
- 美联储压力测试及监管动态。

尚未决定新闻快照是否：

1. 保留最多 12 条标题、发布时间和链接；或
2. 只保存聚合风险指标。

推荐方案是保留最多 12 条新闻元数据，同时保存确定性聚合指标，便于证明 Skill 真实参与并离线复现。

## 尝试过但失败的方法

### 1. 使用聚合安装器

命令：

```powershell
npx.cmd -y bitget-hub install --target codex
```

结果：

```text
spawn npm ENOENT
```

根因：

`bitget-hub@1.0.0` 在 Windows 使用 `child_process.spawn("npm", ..., { shell: false })`。Windows 实际可执行文件是 `npm.cmd`，因此子进程无法解析裸 `npm`。

替代方法：

```powershell
npx.cmd -y bitget-skill-hub --target codex
```

该方法成功安装五个 Skill 并配置 market-data MCP。

### 2. 安装后立即通过 Codex 工具发现 MCP

尝试通过工具发现搜索 `market-data` MCP。当前会话没有动态暴露新安装的 MCP 工具。

原因：

Codex 通常需要重启会话后重新加载 `~/.codex/config.toml` 和新 Skill。

替代方法：

本次使用官方 MCP Streamable HTTP 协议直接调用同一端点进行采集。

### 3. 直接 GET MCP 地址

命令：

```powershell
curl.exe https://datahub.noxiaohao.com/mcp
```

结果：

```text
406 Not Acceptable
Client must accept text/event-stream
```

原因：

该端点要求 MCP Streamable HTTP 请求，必须发送 JSON-RPC POST 并接受 `text/event-stream`。

### 4. PowerShell 中直接内嵌 JSON 给 curl

首次 POST 初始化返回：

```text
Parse error: Expecting property name enclosed in double quotes
```

原因：

PowerShell/curl 参数中的 JSON 引号被错误处理。

替代方法：

通过标准输入把 JSON 作为 `--data-binary '@-'` 发送，成功完成 MCP 初始化。

### 5. 直接 JSON.parse 跨资产相关性结果

`cross_asset` 返回内容中包含非标准 JSON 值：

```text
prior_rolling_corr: NaN
```

结果：

原生 `JSON.parse` 失败。

替代方法：

采集时只提取所需的有限值字段，或在解析前把裸 `NaN` 转为 `null`。不得把非有限数写入项目快照。

### 6. 一次打印完整稳定币响应

`defi_analytics(action="stablecoins")` 返回数百个资产和大量链级数据，终端输出超过 24 万 token 并被截断。

问题：

原始响应不适合直接固化或用于测试。

替代方法：

采集阶段聚合所有 `peggedUSD` 资产，只保留总供给和 1/7/30 日变化。

### 7. 使用实施计划中尚不存在的五维模板系统

原计划依赖：

- `sampleScenarioSet`
- `FAMILIES`
- `pickWorstPerDimension`

这些模块当前不存在。直接照抄会扩大范围并重复当前快照驱动设计。

当前选择：

`runDoctor` 接收标准化 `Scenario[]`，CLI 负责加载快照并构造场景。扩展三维时只增加构造器和 CLI 场景列表。

## 下一步行动

1. 确认新闻快照保留 12 条新闻元数据加聚合指标。
2. 重新执行一次精简的官方 MCP 采集，直接生成三份标准化 JSON，避免复制大型原始响应。
3. 为三个快照定义本地类型，不修改 `src/contracts.ts`：
   - `MacroSnapshot`
   - `MarketIntelSnapshot`
   - `NewsSnapshot`
4. 先写失败测试，覆盖：
   - 必填字段
   - 官方 `sourceSkill`
   - 有效时间
   - 数值有限性和范围
   - 新闻条目时间与数量
   - 场景参数边界
   - 同快照和 seed 完全确定
5. 实现场景映射：
   - Macro → `crash` 或 `grind`
   - Market Intel → `crash`
   - News → `gap`
6. 修改 `src/cli.ts`，让 `buildScenarioSet(seed)` 返回五个维度。
7. 更新 CLI 和集成测试，要求维度集合严格等于：

```text
macro, market-intel, news, sentiment, technical
```

8. 运行：

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run demo
git diff --check
```

9. 检查五维加入后处方是否仍只调整死因相关参数，并诚实报告 held-out 结果。
10. 所有验证通过后再决定提交或创建 PR。

## 关键约束

- 不修改冻结的 `src/contracts.ts`。
- Skill 只负责采集，Demo 只消费固化 JSON。
- 测试和 Demo 不访问网络。
- 快照不保存私有凭证或内部 provider 信息。
- 所有随机性由 seed 控制。
- 新闻摘要不可大量复制受版权保护的正文，只保存短标题、时间、链接和本项目生成的风险标签。
- 不人为提高冲击强度来保证策略死亡，应先检查映射和回测模型。
