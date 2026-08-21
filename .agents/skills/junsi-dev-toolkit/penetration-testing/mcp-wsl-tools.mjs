#!/usr/bin/env node
// wsl-pentest MCP Server — 运行 Linux 渗透测试工具（nmap/sqlmap/nikto 等）
// 自 dsh-penetration-testing-toolkit/preset/plugins/wsl-tools.mjs 移植，零依赖。
//
// 执行后端自动适配：
//   - Windows → 通过 WSL 执行（wsl -e bash -c）
//   - Linux 等已带 bash 的系统 → 直接调用本机 bash（功能一致）
//
// 协议：MCP stdio（换行分隔 JSON-RPC 2.0），仅实现 initialize / ping /
// tools/list / tools/call；日志一律走 stderr，stdout 只输出协议消息。
//
// opencode.json 注册：
//   "mcp": { "wsl-pentest": { "type": "local",
//     "command": ["node", "<本文件路径>"], "enabled": true } }

import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline';

const SERVER_INFO = { name: 'wsl-pentest', version: '1.1.0' };
const PROTOCOL_VERSION = '2024-11-05';

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const replyError = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

/* ---------- 执行后端与 WSL 执行核心 ---------- */

const isWindows = process.platform === 'win32';

/* 后端探测并缓存：Windows→'wsl'（需可用 WSL）；其余平台→'bash'（需存在 bash）；都不可用→null */
let _backend;
async function getBackend() {
  if (_backend !== undefined) return _backend;
  if (isWindows) {
    _backend = await new Promise((resolve) => {
      execFile('wsl', ['--status'], { encoding: 'utf8', timeout: 8000, windowsHide: true }, (e) => resolve(!e ? 'wsl' : null));
    });
    return _backend;
  }
  _backend = await new Promise((resolve) => {
    execFile('bash', ['-c', 'true'], { encoding: 'utf8', timeout: 5000 }, (e) => resolve(e && e.code === 'ENOENT' ? null : 'bash'));
  });
  return _backend;
}

const envMissing = () => ({
  code: isWindows ? 'WSL_NOT_AVAILABLE' : 'BASH_NOT_AVAILABLE',
  error: isWindows ? '未检测到可用的 WSL 环境' : '未找到可用的 bash 环境',
  hint: isWindows
    ? '请先安装 WSL（管理员 PowerShell 执行 wsl --install 后重启），或征得用户同意后回退使用 pwsh 同类工具（Test-NetConnection / Invoke-WebRequest 等）'
    : '请确认系统已安装 bash 并在 PATH 中，或征得用户同意后回退其他可用 shell 工具',
});

async function runWsl(command, timeout = 60000, maxBuffer = 10 * 1024 * 1024) {
  const backend = await getBackend();
  if (!backend) {
    const m = envMissing();
    return { ok: false, code: m.code, error: m.error };
  }
  const args = backend === 'wsl' ? ['wsl', ['-e', 'bash', '-c', String(command)]] : ['bash', ['-c', String(command)]];
  return new Promise((resolve) => {
    execFile(
      args[0],
      args[1],
      { encoding: 'utf8', timeout, maxBuffer, windowsHide: isWindows, killSignal: 'SIGKILL' },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ ok: true, output: String(stdout).trim(), exitCode: 0 });
          return;
        }
        resolve({
          ok: false,
          command,
          error: error.killed ? `命令执行超时（${timeout}ms）` : error.message,
          output: stdout ? String(stdout).trim() : '',
          stderr: stderr ? String(stderr).trim() : '',
          exitCode: typeof error.code === 'number' ? error.code : 1,
        });
      }
    );
  });
}

const fail = (extra, r) =>
  JSON.stringify({
    success: false,
    ...(r.code ? { code: r.code } : {}),
    ...extra,
    error: r.error,
    output: (r.output || '').trim(),
    ...(r.stderr ? { stderr: r.stderr.trim() } : {}),
    ...(r.code ? { hint: envMissing().hint } : {}),
  });

/* ---------- 工具定义（与源 wsl-tools.mjs 一一对应） ---------- */

const TOOLS = [
  {
    name: 'wsl-run',
    description: '执行 Linux 命令（渗透测试工具如 nmap, sqlmap, nikto 等）。Windows 经 WSL，Linux 等自带 bash 的系统直接本机执行，功能一致。',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要在 WSL 中执行的 Linux 命令，例如: "nmap -sV target.com"' },
        timeout: { type: 'number', description: '超时时间（毫秒），默认 60000' },
      },
      required: ['command'],
    },
    async call(params) {
      const command = params.command;
      const timeout = Number(params.timeout) || 60000;
      if (!command) return JSON.stringify({ success: false, error: '请提供要执行的命令' });
      const r = await runWsl(command, timeout);
      if (r.ok) return JSON.stringify({ success: true, command, output: r.output, exitCode: 0 });
      return fail({ command }, r);
    },
  },
  {
    name: 'wsl-tool-check',
    description: '检查渗透测试工具是否已安装（nmap, sqlmap, nikto 等）。Windows 查 WSL，Linux 等查本机。',
    inputSchema: {
      type: 'object',
      properties: {
        tools: { type: 'string', description: '要检查的工具列表，逗号分隔，例如: "nmap,sqlmap,nikto"', default: 'nmap,sqlmap,nikto,gobuster,whatweb,hydra' },
      },
    },
    async call(params) {
      if (!(await getBackend())) return JSON.stringify(envMissing());
      const list = String(params.tools || 'nmap,sqlmap,nikto,gobuster,whatweb,hydra').split(',');
      const results = {};
      let installed = 0;
      for (const raw of list) {
        const t = raw.trim();
        if (!t) continue;
        const r = await runWsl(`command -v ${t} 2>/dev/null`, 10000);
        results[t] = r.ok && r.output ? { installed: true, path: r.output } : { installed: false };
        if (results[t].installed) installed++;
      }
      return JSON.stringify({ success: true, tools: results, summary: { installed, missing: Object.keys(results).length - installed } });
    },
  },
  {
    name: 'wsl-install',
    description: '安装渗透测试工具（需要 sudo/apt，可能耗时较长）。Windows 在 WSL 内安装，Linux 等直接本机安装。',
    inputSchema: {
      type: 'object',
      properties: {
        tools: { type: 'string', description: '要安装的工具，逗号分隔，例如: "nmap,sqlmap,nikto"', default: 'nmap,sqlmap,nikto,gobuster,whatweb,hydra,dirsearch' },
      },
    },
    async call(params) {
      if (!(await getBackend())) return JSON.stringify(envMissing());
      const toolsArg = String(params.tools || 'nmap,sqlmap,nikto,gobuster,whatweb,hydra,dirsearch').trim();
      const r = await runWsl(`sudo apt update && sudo apt install -y ${toolsArg}`, 300000);
      if (r.ok) return JSON.stringify({ success: true, tools: toolsArg, message: '工具安装完成', output: r.output.slice(-500) });
      return fail({ tools: toolsArg }, { ...r, output: (r.output || '').slice(-500), stderr: (r.stderr || '').slice(-500) });
    },
  },
  {
    name: 'wsl-nmap',
    description: '使用 nmap 扫描目标（端口、服务、OS）。',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '目标域名或 IP' },
        scanType: { type: 'string', enum: ['quick', 'standard', 'full', 'vuln'], description: '扫描类型: quick=快速, standard=标准, full=全端口, vuln=漏洞脚本', default: 'standard' },
      },
      required: ['target'],
    },
    async call(params) {
      const { target, scanType = 'standard' } = params;
      const argsByType = { quick: '-T4 -F', full: '-p- -T4 -sV -sC', vuln: '--script vuln -T4', standard: '-sV -sC -T4' };
      const command = `nmap ${argsByType[scanType] || argsByType.standard} ${target}`;
      const r = await runWsl(command, 120000);
      if (r.ok) return JSON.stringify({ success: true, target, scanType, command, output: r.output });
      return fail({ target }, r);
    },
  },
  {
    name: 'wsl-sqlmap',
    description: '使用 sqlmap 测试 SQL 注入。',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '测试 URL，例如: "http://target.com/page?id=1"' },
        level: { type: 'number', description: '测试等级 (1-5)，默认 3', default: 3 },
        risk: { type: 'number', description: '风险等级 (1-3)，默认 1', default: 1 },
        dump: { type: 'boolean', description: '是否 dump 数据', default: false },
      },
      required: ['url'],
    },
    async call(params) {
      const { url, level = 3, risk = 1, dump = false } = params;
      let command = `sqlmap -u "${url}" --batch --level=${level} --risk=${risk}`;
      if (dump) command += ' --dump';
      const r = await runWsl(command, 300000);
      if (r.ok) {
        const vulnerable = r.output.includes('is vulnerable') || r.output.includes('injection point');
        return JSON.stringify({ success: true, url, command, output: r.output, vulnerable });
      }
      return fail({ url }, r);
    },
  },
  {
    name: 'wsl-nikto',
    description: '使用 nikto 扫描 Web 漏洞。',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '目标 URL' },
        port: { type: 'number', description: '目标端口', default: 80 },
      },
      required: ['target'],
    },
    async call(params) {
      const { target, port = 80 } = params;
      const command = `nikto -h ${target} -p ${port}`;
      const r = await runWsl(command, 300000);
      if (r.ok) return JSON.stringify({ success: true, target, command, output: r.output });
      return fail({ target }, r);
    },
  },
];

/* ---------- MCP 协议处理 ---------- */

async function handleMessage(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: (params && params.protocolVersion) || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return reply(id, { content: [{ type: 'text', text: `未知工具: ${params.name}` }], isError: true });
      try {
        const text = await tool.call(params.arguments || {});
        return reply(id, { content: [{ type: 'text', text }] });
      } catch (e) {
        return reply(id, { content: [{ type: 'text', text: JSON.stringify({ success: false, error: e.message }) }], isError: true });
      }
    }
    default:
      if (id !== undefined) replyError(id, -32601, `方法不存在: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON 解析失败' } });
    return;
  }
  handleMessage(msg).catch((e) => {
    console.error('[wsl-pentest] 处理失败:', e.message);
    if (msg && msg.id !== undefined) replyError(msg.id, -32603, e.message);
  });
});
rl.on('close', () => process.exit(0));

console.error(`[wsl-pentest] MCP server ready (${SERVER_INFO.version}, ${TOOLS.length} tools, platform=${process.platform}, backend=${await getBackend() ?? 'none'})`);
