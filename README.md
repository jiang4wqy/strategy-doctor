# Strategy Doctor — AI 策略体检与优化引擎

> **TL;DR (EN):** Others build trading strategies — we build the engine that *stress-tests them to death*. Strategy Doctor uses Bitget's five official analyst Skills to evolve the nastiest market scenarios against any strategy, tells you **when and why** it dies, scores its risk per investor style, prescribes targeted fixes, and honestly reports the **robustness↔return tradeoff** on a held-out scenario set.
>
> Bitget AI Base Camp Hackathon · **Track 2 — Trading Infra** · Stack: Node 24 native TypeScript, zero build, zero runtime deps.

**一句话定位：** 别人造策略，我们造给策略做死亡测试的引擎——基于 Bitget 五大分析师 Skill 自动进化出最毒的市场剧情，告诉你任何策略会在什么时候、为什么死，并按你的风格开出处方，同时诚实给出"稳健性↔收益"的取舍。

---

## 产品闭环

```
策略 ──▶ 红队/对抗层 ──▶ 回测/执行层 ──▶ 评分层 ──▶ 进化/处方 ──▶ held-out 复测
        (5个Skill=5攻击维度)  (复用Bitget        (3风格:稳健/     (定向修补)   (诚实取舍输出)
         自动进化毒剧情)       Agent Hub)         激进/趋势)
```

**最短闭环 MVP**：一个真实策略 → 自动诊断死因 → 3 风格评分 → 单点处方 → 在**未参与治疗的** held-out 场景上复测 → 输出"稳健性↑X% / 收益−Y%"的诚实取舍。

## 快速开始（Node ≥ 24，零构建零运行时依赖）

```bash
npm install        # 仅 dev 依赖（typescript 类型检查用）
npm test           # 全量测试
npm run demo       # 体检示例策略：诊断→评分→处方→held-out 复测
npm run typecheck  # 类型检查
```

> 环境与官方 Skill 安装见 [docs/SETUP.md](docs/SETUP.md)。新人入队先读 [docs/TEAM.md](docs/TEAM.md)。

## 模块一览

| 目录 | 模块 | 干什么 | 负责分支 |
|---|---|---|---|
| `src/backtest` | 回测/执行层 | 给(策略+场景)→标准 metrics；Mock 引擎(主线) + Bitget 适配器(增强) | `feat/backtest` |
| `src/redteam` | 红队/对抗层 | 5 个 Skill = 5 攻击维度，自动进化毒剧情 + 死因诊断 | `feat/redteam` |
| `src/scoring` | 评分层 | 稳健/激进/趋势三套权重阈值，给风险分 | `feat/scoring-prescribe` |
| `src/prescribe` | 进化/处方 | 死因驱动的定向修补 + held-out 复测取舍 | `feat/scoring-prescribe` |
| `src/pipeline` | 总编排 | 串起整条诊断流水线 | `feat/demo` |
| `src/report` | 报告/CLI | markdown 体检报告 + 命令行入口 | `feat/demo` |

每个目录下的 `README.md` 写明了该模块的目标、对外接口和对应任务编号。

## 三条红线（不可触碰）

1. **防自我过拟合**：治疗集与验证集种子强制不同（代码抛错保证），输出永远带"稳健性↔收益"取舍，不做"一键变好"话术。
2. **严禁实盘**：只读 API Key + 子账号，全程不下真实订单，仓库内不出现任何 key。
3. **离线确定性**：一切随机经 seed 驱动，同 seed 同结果，无网络/无 key 时全链路照常跑（demo 不翻车）。

## 致谢与底座

底层复用 [Bitget Agent Hub](https://github.com/Bitget-AI/agent_hub)（五大分析师 Skill + market-data MCP + 交易 API）。我们与 Bitget Playbook 互补——Playbook 负责"生策略"，Strategy Doctor 负责"体检 + 开方 + 加固"。

## 协作

仓库公开，欢迎参赛队友与社区共建。开发分支策略与任务认领见 [docs/TEAM.md](docs/TEAM.md) 和 [Issues](../../issues)。完整开发实施计划（含每个模块的代码与测试）见 [docs/开发实施计划.md](docs/开发实施计划.md)。

## License

MIT — 见 [LICENSE](LICENSE)。
