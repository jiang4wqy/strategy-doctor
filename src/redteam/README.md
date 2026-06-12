# redteam — 红队/对抗层（项目最不可替代的核心）

**目标：** 用 Bitget 五大分析师 Skill 作为 5 个攻击维度，自动进化出最能搞垮策略的市场剧情，并把死因翻译成自然语言。

**对外接口（见 [`../contracts.ts`](../contracts.ts)）：** 产出 `Scenario[]` 与 `Death[]`

**要建的文件：**
- `templates.ts` — 5 维场景族（每个 `Dimension` ↔ 一个官方 Skill，见 [docs/SETUP.md](../../docs/SETUP.md)）
- `sample.ts` — 确定性场景采样器（治疗集/验证集靠不同 seed 分离）
- `search.ts` — 对抗搜索：挑出每个维度伤害最大的场景
- `diagnose.ts` — 死因分类（清算 / 回撤击穿 / 止损放血）
- `narrate.ts` — LLM 死亡报告（默认模板兜底，离线确定性）

**对应开发计划任务：** Task 5、6、7、14　|　**负责人：** P3　|　**分支：** `feat/redteam`

**红线：** `sourceSkill` 用官方真名；narrate 默认走模板，不打网络。
