# 环境准备 & 官方 Skill 接入

## 1. 基础环境

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | **≥ 24** | 直接原生运行 TypeScript（类型擦除），零构建。本项目唯一硬依赖 |
| Python | **≥ 3.10** + `pandas` `numpy` | **仅** Bitget `technical-analysis` Skill 需要；其类型标注语法不兼容 Python 3.9 |

```bash
git clone https://github.com/jiang4wqy/strategy-doctor.git
cd strategy-doctor
npm install        # 仅装 dev 依赖（typescript / @types/node）
npm test           # 验证环境
```

Windows 若安装了多个 Python 版本，显式选择 3.10+：

```powershell
py -3.12 -c "import pandas, numpy; print('OK')"
```

> TS 原生运行的两条约束（写代码时注意）：相对 import **必须带 `.ts` 后缀**；不要用 `enum` / `namespace`（不可擦除语法，会报错）。

## 2. Bitget 官方五大分析师 Skill —— 五个攻击维度的来源

来自 [Bitget-AI/agent_hub](https://github.com/Bitget-AI/agent_hub)。一键安装到 Claude Code：

```bash
npx bitget-skill-hub --target claude
# 或装到所有 AI 工具： npx bitget-skill-hub --target all
# 交互式选择：       npx bitget-skill-hub --interactive
```

> 这五个 Skill 走**公开 market-data MCP，无需任何 API key**（行情数据都是公开的）。安装脚本会自动配好 MCP。

### Skill ↔ 攻击维度 ↔ 评分轴 映射

| 官方 Skill | `Dimension` | 能制造的杀招 |
|---|---|---|
| `sentiment-analyst` | `sentiment` | 资金费率突刺、极端贪婪后反转、多头拥挤踩踏 |
| `macro-analyst` | `macro` | 美联储鹰派意外、DXY 飙升、跨资产相关性翻转 |
| `market-intel` | `market-intel` | ETF 大额流出 + 巨鲸砸盘 + DeFi TVL 抽干 |
| `news-briefing` | `news` | 检索历史黑天鹅（暴雷/黑客/监管）做事件冲击复盘 |
| `technical-analysis` | `technical` | 识别策略适配形态，构造相反形态（趋势↔震荡、波动率切换） |

> ⚠️ 代码里 `Scenario.sourceSkill` 一律写**官方真名**（如 `news-briefing` 而非 `news-analyst`）。`Dimension` 类型用上表第二列的短名。

## 3. 交易所数据 / 回测底座（Task 15 才需要）

五大分析师 Skill 之外，访问交易所数据走 `bitget-client` 提供的 `bgc` CLI：

```bash
npm install -g bitget-client
bgc --version
```

私有端点（账户/持仓）才需要凭证——**红线：只读 API Key + 子账号，绝不接入实盘真钱自动下单**：

```bash
# 放进本地 .env（已被 .gitignore 忽略，永远不要提交）
export BITGET_API_KEY="your-READONLY-key"
export BITGET_SECRET_KEY="..."
export BITGET_PASSPHRASE="..."
```

> 主线 MVP 用确定性 Mock 回测引擎（`src/backtest/mock.ts`），**不依赖** Bitget 在线接入；`bgc` 接入是增强项，spike 验证命令面后再决定怎么用（见开发实施计划 Task 15）。

## 4. （可选）LLM 死亡报告增强

死亡报告默认走模板（离线、确定性）。想要 LLM 生成更生动的版本，演示时临时开启：

```powershell
$env:DOCTOR_LLM_NARRATE='1'; $env:ANTHROPIC_API_KEY='sk-...'; npm run demo
```

> 正式 3 分钟 demo 建议**不开**，守住离线确定性红线（防现场断网翻车）。
