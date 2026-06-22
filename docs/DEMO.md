# Strategy Doctor 三分钟演示

这份脚本以 Web 为主，CLI 与开发者接口作为可信度证明。主演示使用离线 `MockBacktester`，不展示任何密钥。

## 演示前

```powershell
npm.cmd ci
npm.cmd run verify
npm.cmd run build:web
```

启动受保护页面：

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='demo-code-change-me'
$env:DOCTOR_SESSION_SECRET='demo-session-secret-at-least-32-chars'
$env:DOCTOR_API_KEYS='demo-private-agent-key'
npm.cmd run web
```

打开：

```text
http://127.0.0.1:8080/showcase
http://127.0.0.1:8080/developer
http://127.0.0.1:8080
```

提前准备以下描述：

```text
BTCUSDT 4h ATR breakout, ATR period 14, breakout lookback 20, ATR stop 2.5, trend MA 50
```

评委无需登录的展示页：

```text
http://127.0.0.1:8080/showcase
```

Reviewer evidence index:

- `docs/SUBMISSION_EVIDENCE.md`
- `docs/DEPLOYMENT.md`
- `docs/PLAYBOOK_EVIDENCE.md`

## 0:00-0:20 问题

> 大多数工具帮助用户生成策略，却很少回答策略会在哪种陌生行情中失败、为什么失败、应该改哪个参数，以及修改能否在独立场景中继续成立。Strategy Doctor 是策略生成器和执行系统之间的诊断层。

## 0:20-0:45 Agent 接入面

展示 `/developer` 与 README 的工作流。

> 同一套能力可以从 Web、REST、TypeScript Client 或 CLI 使用。Agent 先读取 capabilities，再把自然语言解析为结构化草稿，经过用户或 Agent 显式确认后才运行诊断。

强调：

- `/api/v1/capabilities` 是参数契约的唯一来源。
- `/api/v1/openapi.json` 和示例降低接入成本。
- `npm run healthcheck` 与 `npm run submission:usage-record` 证明服务和记录可复现。
- 自然语言解析不会绕过结构化校验与确认边界。

## 0:45-1:20 自然语言到可确认策略

1. 输入 Web access code。
2. 点击 `ATR Trend Breakout` 模板，或粘贴上面的 ATR 描述。
3. 提交解析。
4. 展示识别出的 `atr-trend-breakout`、参数、assumptions 和 warnings。
5. 说明参数仍可编辑，解析不会自动执行诊断。

> P1 只映射四个经过验证的 archetype。无法可靠识别时会明确报错，不会假装支持任意策略。

## 1:20-2:20 五维诊断与可视化

点击 `Confirm and diagnose`，依次展示：

- 五个维度的最坏场景与 damage；
- 风险分、死因与处方；
- 原始策略和修补策略的 held-out 对比；
- 四个图表区域；
- request ID 与开发者面板。

> 每个维度生成确定性 seed 候选并选择伤害最大的场景。处方只修改与死因相关的参数，再使用未参与处方搜索的 held-out 场景复测。系统原样展示收益与风险权衡，不承诺修改后一定更赚钱。

刷新页面，从本地历史重新打开结果，证明浏览器端最近记录可恢复。

## 2:20-2:45 第二种策略与 CLI

```powershell
npm.cmd run demo
node src/cli.ts examples/trend-follower.json `
  --style conservative `
  --seed 42 `
  --candidates 6
node src/cli.ts examples/rsi-bollinger.json `
  --style conservative `
  --seed 42 `
  --candidates 6
node src/cli.ts examples/breakout-confirmation.json `
  --style conservative `
  --seed 42 `
  --candidates 6
node src/cli.ts examples/atr-trend-breakout.json `
  --style conservative `
  --seed 42 `
  --candidates 6
```

> MA、RSI+Bollinger、confirmed breakout 与 ATR trend breakout 共用诊断基础设施，但保留各自的交易决策、参数契约和处方逻辑。

## 2:45-3:00 Track 2 总结

> Strategy Doctor 不是另一个策略生成器，而是 Agent 开发中缺失的可解释诊断层。REST、TypeScript、OpenAPI 和能力发现让现有 Agent 可以直接接入；封闭 capability definitions 让后续策略和薄 MCP adapter 能在不复制核心逻辑的情况下扩展。

如果展示 Playbook 闭环，打开 `docs/PLAYBOOK_EVIDENCE.md`，说明
`examples/playbook/strategy-doctor-adaptive-playbook` 已通过官方 GetAgent
validator，发布阶段只需要使用参赛账户的 Playbook API key 走上传、回测和发布。

最后说明安全边界：

- Web/API 使用离线 `MockBacktester`。
- 不读取账户、余额、持仓或 Bitget 私有凭证。
- 不包含下单能力。

## 可选团队远程演示

保持服务运行，另开终端：

```powershell
cloudflared tunnel --url http://localhost:8080
```

Quick Tunnel URL 会在重启后变化，只用于临时 demo。通过私密渠道单独分享 access code。

服务器端口不方便直接打开时，先生成 SSH 隧道命令：

```powershell
npm.cmd run preview:access
```

## 录屏检查

- 总时长不超过 3 分钟。
- 不显示 access code、session secret、API key 或 Anthropic key。
- 页面中能够看到策略确认边界、五维结果、处方、held-out 对比和 request ID。
- 明确说出 `MockBacktester`、无账户数据、无订单。
- 不把 Quick Tunnel 描述为永久部署。
