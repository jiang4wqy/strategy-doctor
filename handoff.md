# Strategy Doctor Handoff

更新时间：2026-06-15（Asia/Shanghai）

## 当前结论

P1 developer platform 已在以下分支完成：

```text
codex/p1-developer-platform
```

已验证的功能包括：

- 两个注册策略：`ma-cross`、`rsi-bollinger-mean-reversion`。
- Fastify REST API v1、OpenAPI、Web access code、Bearer API key。
- 限流、同源 mutation 保护、请求体限制、诊断并发限制。
- 中英文自然语言解析，无法识别、歧义和未支持策略返回稳定错误。
- TypeScript Client、PowerShell/curl 示例和 Agent 接入文档。
- React/Vite Web：登录、自然语言输入、显式参数确认、诊断、四类图表、
  JSON/Markdown 导出、本地最近 10 条历史。
- Fastify 同源托管 React build，并保留 `/api/*` JSON 404。
- 真实 Client/API 集成测试和 Chromium Playwright 验收。

P1.1 的薄 MCP adapter 尚未开始。按现有计划，它应在 P1 合并后单独进入
`codex/p1-mcp`，只调用 REST/TypeScript Client，不复制诊断核心。

## 已验证提交

Foundation 之后的关键提交：

```text
5812887 fix: align P1 capability contracts
f3199f8 feat: define API configuration and error envelopes
452b2b2 feat: authenticate Web sessions and API keys
b39b14a feat: guard API mutations and diagnosis capacity
b950c15 feat: expose capability and diagnosis routes
1f38bc0 feat: assemble documented Fastify API
984bd1f feat: define natural-language strategy drafts
48bebbf feat: parse supported strategies from local language rules
7bee5d3 feat: add constrained Anthropic strategy parsing
b1df345 feat: coordinate local-first strategy parsing
d9c0259 feat: define TypeScript client errors
a69c00b feat: add native TypeScript API client
08efb9e docs: add copy-ready Agent API examples
f1ca447 docs: explain the developer API contract
d90911b..a7f3e7d React Web implementation and responsive workspace
ed18c36 feat: connect natural-language parsing to the API
f844e58 feat: serve the React client from Fastify
eec8a4e docs: publish the developer platform workflow
81a6032 test: exercise the client against the real API
6b8a5a1 test: accept the browser diagnosis workflows
```

## 最终验证

2026-06-15 在 Windows、Node.js 24.14.1 上执行：

```text
npm.cmd ci
PASS

npm.cmd run verify
227 core tests: 226 passed, 1 skipped, 0 failed
coverage: lines 96.35%, branches 89.28%, functions 99.10%
core + Web TypeScript typecheck: PASS
offline CLI demo: PASS

npm.cmd run test:web
11 files, 19 tests passed

npm.cmd run build:web
PASS

npm.cmd run test:e2e
3 Chromium tests passed
```

Playwright 覆盖：

- 中文 RSI/Bollinger 完整输入、确认、诊断、四图表和本地历史恢复。
- 英文 MA 短流程。
- 登录页和完整诊断页的 axe 扫描：0 个 serious/critical violation。

Web build：

```text
4 files
768,698 bytes / 750.68 KiB
initial JS: 204.93 kB / gzip 64.76 kB
lazy diagnosis chunk: 555.38 kB / gzip 187.07 kB
CSS: 7.86 kB / gzip 2.42 kB
```

ECharts 诊断 chunk 仍超过 Vite 500 kB 警告线，但已延迟加载，不阻塞首屏。

MA golden 原始字节完全一致：

```text
SHA-256
60745EB1377E3B2160311C8101E72E1731329AA3DF173D75C4672616DD455E90

output bytes: 70,755
golden bytes: 70,755
```

本机 API 五次测量：

```text
parse: mean 1.37 ms, min 0.93 ms, max 2.40 ms
diagnosis: mean 24.13 ms, min 22.73 ms, max 26.30 ms
```

干净安装到首次完成：

```text
npm ci -> first CLI completion: 32.60 s
npm ci -> Chinese RSI Web diagnosis workflow completion: 46.41 s
```

Codex 应用内浏览器受到企业网络策略限制，不能访问
`127.0.0.1:8080`；没有尝试绕过。独立 Chromium Playwright 的真实服务验收已通过。

## 模块与 Ownership

| 部分 | 主要文件 |
|---|---|
| API | `src/server/**`、`tests/server/**` |
| 自然语言 | `src/natural-language/**`、`tests/natural-language/**` |
| Web | `web/**`、`tests/e2e/**` |
| Client/文档 | `src/client/**`、`examples/agent-*`、`docs/API.md` |
| 集成 | `src/server/default-services.ts`、`tests/integration/**` |

初始四个实现 Agent 因使用额度中断，没有提交代码。后续实现由当前集成线程完成。
最后的 CI/公开文档 Agent 成功提交 `eec8a4e`，改动范围仅为：

```text
.github/workflows/ci.yml
README.md
docs/SETUP.md
docs/DEMO.md
docs/SUBMISSION.md
docs/API.md
```

## 运行方式

离线 CLI 不需要环境变量：

```powershell
npm.cmd run demo
```

受保护 Web：

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='team-preview-code-change-me'
$env:DOCTOR_SESSION_SECRET='replace-this-with-a-random-32-char-secret'
$env:DOCTOR_API_KEYS='replace-this-with-a-private-agent-key'
$env:DOCTOR_HOST='127.0.0.1'
npm.cmd run web
```

环境变量计数：

- Web 必需 2 个：`DOCTOR_WEB_ACCESS_CODE`、`DOCTOR_SESSION_SECRET`。
- Agent/REST 另需 1 个：`DOCTOR_API_KEYS`。
- Server 可选 5 个：host、port、session TTL、body limit、static root。
- 自然语言 AI 可选 3 个，必须一起启用：
  `DOCTOR_NL_AI_ENABLED`、`ANTHROPIC_API_KEY`、`DOCTOR_NL_MODEL`。
- 叙事增强可选 2 个额外变量：
  `DOCTOR_LLM_NARRATE`、`DOCTOR_LLM_MODEL`，并复用 Anthropic key。

## 已知限制

- 公共 Web/API 固定使用离线 `MockBacktester`，不读取账户、余额、持仓或私钥，
  也不会下单。
- 只支持单 symbol、`*USDT`、`1h/4h/1d` 和两个已注册策略。
- Quick Tunnel 仅用于临时演示；URL 重启后变化，终端和本地服务必须持续运行。
- 仓库未自动创建永久云部署。
- GitHub branch protection、required review、CODEOWNERS review 仍需仓库 owner
  在 GitHub Settings 中开启。
- ECharts 延迟 chunk 仍较大，后续可按图表拆分或替换更轻量渲染层。

## 下一步

1. 审查并合并 `codex/p1-developer-platform`。
2. 在 GitHub 开启 `main` branch protection 和 required review。
3. 如需临时团队预览，启动 `npm.cmd run web` 后运行：

```powershell
cloudflared tunnel --url http://localhost:8080
```

4. P1 合并后，从最新 `main` 创建 `codex/p1-mcp`，执行集成计划 Task 8。
