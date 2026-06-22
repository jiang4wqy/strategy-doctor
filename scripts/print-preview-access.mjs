#!/usr/bin/env node
/*
脚本作用：
打印 Strategy Doctor 评审预览的访问地址、SSH 隧道命令和健康检查命令。

执行逻辑：
1. 从环境变量读取服务端口、本地转发端口和可选 SSH 登录信息。
2. 输出本机访问、远程 SSH 隧道、API 健康检查和公开隧道的最小命令。
3. 不读取密钥、不调用外部 API，只生成可复制的操作提示。

运行示例：
    STRATEGY_DOCTOR_SSH_HOST=<server-ip> STRATEGY_DOCTOR_SSH_PORT=<ssh-port> npm run preview:access
*/

const servicePort = process.env.DOCTOR_PORT ?? '8080';
const localTunnelPort = process.env.STRATEGY_DOCTOR_TUNNEL_PORT ?? '18080';
const sshUser = process.env.STRATEGY_DOCTOR_SSH_USER
  ?? process.env.USER
  ?? '<ssh-user>';
const sshHost = process.env.STRATEGY_DOCTOR_SSH_HOST ?? '<server-ip-or-domain>';
const sshPort = process.env.STRATEGY_DOCTOR_SSH_PORT ?? '<ssh-port>';
const publicUrl = process.env.STRATEGY_DOCTOR_PUBLIC_URL;

const localBase = `http://127.0.0.1:${servicePort}`;
const tunnelBase = `http://127.0.0.1:${localTunnelPort}`;
const sshTarget = `${sshUser}@${sshHost}`;
const sshPortArg = sshPort === '<ssh-port>' ? '-p <ssh-port>' : `-p ${sshPort}`;

function printBlock(title, value) {
  console.log(`\n${title}`);
  console.log(value);
}

console.log('Strategy Doctor preview access');
console.log('================================');

printBlock('Server-local URLs:', [
  `${localBase}/showcase`,
  `${localBase}/`,
  `${localBase}/api/v1/health`,
].join('\n'));

printBlock('SSH tunnel command from your laptop:', [
  `ssh ${sshPortArg} -L ${localTunnelPort}:127.0.0.1:${servicePort} ${sshTarget}`,
  `Then open: ${tunnelBase}/showcase`,
].join('\n'));

printBlock('Health checks:', [
  `curl -i ${localBase}/api/v1/health`,
  `curl -I ${localBase}/showcase`,
].join('\n'));

printBlock('Temporary public share option:', [
  `cloudflared tunnel --url ${localBase}`,
  'Use only for short demos; send the URL, access code, and API key separately.',
].join('\n'));

if (publicUrl) {
  printBlock('Configured public URL:', [
    `${publicUrl.replace(/\/$/, '')}/showcase`,
    `${publicUrl.replace(/\/$/, '')}/`,
  ].join('\n'));
}
