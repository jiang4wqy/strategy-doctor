# 环境、运行与团队分享

## 必需环境

| 依赖 | 版本 | 用途 |
|---|---|---|
| Node.js | 24 或更高 | 原生执行 TypeScript、测试、CLI 和 API |
| npm | Node 随附版本 | 安装依赖并运行脚本 |

项目不需要 Python、数据库、Docker 或 Bitget 私有凭证。

```powershell
git clone https://github.com/jiang4wqy/strategy-doctor.git
Set-Location strategy-doctor
npm.cmd ci
npm.cmd run verify
```

## CLI

默认演示完全离线，读取冻结快照并使用 `MockBacktester`：

```powershell
npm.cmd run demo
npm.cmd run demo:json
```

自定义参数：

```powershell
node src/cli.ts examples/trend-follower.json `
  --style trend `
  --seed 7 `
  --candidates 12 `
  --format markdown `
  --output report.md
```

## 启动 Web 与 API

在 PowerShell 设置三个保护变量：

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='team-preview-code-change-me'
$env:DOCTOR_SESSION_SECRET='replace-this-with-a-random-32-char-secret'
$env:DOCTOR_API_KEYS='replace-this-with-a-private-agent-key'
$env:DOCTOR_HOST='127.0.0.1'
npm.cmd run web
```

打开 `http://127.0.0.1:8080`。`npm.cmd run web` 会先构建 React 客户端，再由同一个 Fastify 进程提供页面和 `/api/v1/*`。

变量说明：

| 变量 | 必需 | 说明 |
|---|---:|---|
| `DOCTOR_WEB_ACCESS_CODE` | Web 必需 | 队友登录页面时输入的 access code |
| `DOCTOR_SESSION_SECRET` | Web 必需 | 至少 32 字符，用于签名 HttpOnly 会话 cookie |
| `DOCTOR_API_KEYS` | Agent/API 必需 | 一个或多个逗号分隔的 Bearer key |
| `DOCTOR_HOST` | 否 | 默认 `127.0.0.1` |
| `DOCTOR_PORT` | 否 | 默认 `8080` |
| `DOCTOR_SESSION_TTL_SECONDS` | 否 | 默认 12 小时 |
| `DOCTOR_BODY_LIMIT` | 否 | 默认 32768 字节 |
| `DOCTOR_STATIC_ROOT` | 否 | 默认 `web/dist` |

不要把 access code、session secret 或 API key 提交到仓库。

## REST 与 TypeScript

服务运行后，另开一个 PowerShell：

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='replace-this-with-a-private-agent-key'
.\examples\agent-curl.ps1
node examples/agent-client.ts
```

OpenAPI 地址：

```text
http://127.0.0.1:8080/api/v1/openapi.json
```

OpenAPI 受认证保护。浏览器已登录时可以直接打开；脚本调用需携带 Bearer key。

## 让队友临时访问

先按上一节启动服务并保持终端运行。再新开一个 PowerShell：

```powershell
cloudflared tunnel --url http://localhost:8080
```

`cloudflared` 会输出一个临时 `https://...trycloudflare.com` URL。

分享规则：

- 终端和 Strategy Doctor 服务必须持续运行；关闭任一进程都会中断访问。
- Quick Tunnel 重启后 URL 会变化，需要重新发送。
- URL、Web access code 和 API key 应通过私密渠道发送。
- 普通 Web 使用者只需要 URL 与 access code。
- Agent/REST/TypeScript 使用者需要 URL 与 API key。
- Quick Tunnel 只用于 demo、测试和短期协作，不是永久生产托管。
- 不要提供 Bitget 私有凭证；系统不需要也不接受这些凭证。

若团队需要长期稳定地址，应改用有访问控制、TLS、日志和密钥轮换的正式部署。

## 可选自然语言 AI fallback

规则解析器默认离线工作。只有显式设置以下变量时，未被本地规则可靠识别的描述才会尝试 Anthropic：

```powershell
$env:DOCTOR_NL_AI_ENABLED='1'
$env:ANTHROPIC_API_KEY='<your-key>'
$env:DOCTOR_NL_MODEL='<available-model-id>'
npm.cmd run web
```

缺少任一变量时不会发起请求。不要把 key 写入仓库。默认 CI 不启用此能力。

## 可选 CLI 叙事增强

```powershell
$env:DOCTOR_LLM_NARRATE='1'
$env:ANTHROPIC_API_KEY='<your-key>'
$env:DOCTOR_LLM_MODEL='<available-model-id>'
npm.cmd run demo
```

配置缺失、超时或响应错误时会回退本地模板。

## 可选 Bitget 公共数据

```powershell
npm.cmd run demo:live
npm.cmd run snapshots:refresh
```

这些命令只读取公开市场数据，不需要 Bitget API key。默认 demo、Web/API、测试和 CI 均不运行在线路径。

## 开发检查

```powershell
npm.cmd run test:coverage
npm.cmd run test:web
npm.cmd run typecheck
npm.cmd run build:web
npm.cmd run test:e2e
npm.cmd run demo
git diff --check
```

首次本地运行 Playwright 前安装 Chromium：

```powershell
npx.cmd playwright install chromium
```

## 常见问题

### PowerShell 阻止 `npm.ps1`

使用本文中的 `npm.cmd` 和 `npx.cmd`。

### 页面无法打开

确认运行 `npm.cmd run web` 的终端仍在工作，并检查 `http://127.0.0.1:8080/api/v1/health`。

### 登录失败

确认输入值与 `DOCTOR_WEB_ACCESS_CODE` 完全一致，并确认 `DOCTOR_SESSION_SECRET` 至少 32 字符。

### API 返回 401

确认请求头为 `Authorization: Bearer <key>`，且 `<key>` 是 `DOCTOR_API_KEYS` 中的一项。

### Quick Tunnel 失效

确认本地服务和 `cloudflared` 都仍在运行。进程重启后使用新生成的 URL。
