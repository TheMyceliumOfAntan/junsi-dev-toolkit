/**
 * RDD 路由锁 + 阶段门禁回归测试
 *
 * 在临时目录里搭一个最小插件宿主（stub @opencode/plugin + mock ctx），
 * 真实加载 .opencode/plugins/junsi-dev-toolkit.js，断言：
 *   1. 新需求首条消息 → RDD / clarify
 *   2. 用户说「开始」→ implement
 *   3. 干活中补充新需求 → 打回 clarify
 *   4. 补充同类问题（报错关键词）→ 不抢锁
 *   5. 新会话独立匹配
 *   6. 显式「切换路由」→ 解锁重新匹配
 *   7. rdd-phase 状态迁移
 *   8. 旧格式 route-state.json 不生效
 *
 * 用法: node scripts/test-route-state.mjs [repoDir]
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';

const repoDir = path.resolve(process.argv[2] || process.cwd());
const pluginSrc = path.join(repoDir, '.opencode/plugins/junsi-dev-toolkit.js');
const skillsSrc = path.join(repoDir, '.agents/skills/junsi-dev-toolkit');

if (!fs.existsSync(pluginSrc)) {
  console.error(`找不到插件: ${pluginSrc}`);
  process.exit(1);
}

let failed = 0;
const pass = (msg) => console.log(`  [PASS] ${msg}`);
const fail = (msg) => {
  console.log(`  [FAIL] ${msg}`);
  failed += 1;
};
const check = (cond, msg) => (cond ? pass(msg) : fail(msg));

/* ---------- 临时宿主 ---------- */
const harness = fs.mkdtempSync(path.join(os.tmpdir(), 'junsi-rdd-'));
fs.writeFileSync(path.join(harness, 'package.json'), JSON.stringify({ name: 'junsi-rdd-harness', type: 'module' }));
const pluginDir = path.join(harness, '.opencode/plugins');
fs.mkdirSync(pluginDir, { recursive: true });
fs.copyFileSync(pluginSrc, path.join(pluginDir, 'junsi-dev-toolkit.js'));
fs.cpSync(skillsSrc, path.join(harness, '.agents/skills/junsi-dev-toolkit'), { recursive: true });

const stubDir = path.join(harness, 'node_modules/@opencode/plugin');
fs.mkdirSync(stubDir, { recursive: true });
fs.writeFileSync(path.join(stubDir, 'package.json'), JSON.stringify({ name: '@opencode/plugin', type: 'module', main: 'index.js' }));
fs.writeFileSync(path.join(stubDir, 'index.js'), 'export const Plugin = { define: (def) => def };\n');

const projectDir = path.join(harness, 'project');
fs.mkdirSync(projectDir, { recursive: true });

/* 分支纪律依赖真实 git 仓库 */
const git = (...args) => execFileSync('git', args, { cwd: projectDir, stdio: 'ignore' });
git('init', '-q');
git('-c', 'user.email=test@test', '-c', 'user.name=test', 'commit', '--allow-empty', '-m', 'init', '-q');
const branchName = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectDir, encoding: 'utf8' }).trim();

const mod = await import(pathToFileURL(path.join(pluginDir, 'junsi-dev-toolkit.js')).href);
const def = mod.default;

/* ---------- mock ctx ---------- */
const tools = new Map();
const hooks = new Map();
const makeTransform = (sink) => async (cb) => {
  const editor = {
    add: (item) => sink.push(item),
    get: () => undefined,
    update: () => {},
    remove: () => {},
    list: () => [],
  };
  await cb(editor);
  return { dispose: async () => {} };
};

const ctx = {
  location: { directory: projectDir, project: { id: 'test', directory: projectDir, canonical: projectDir } },
  app: {},
  options: {},
  agent: {
    list: async () => ({ data: [] }),
    transform: async (cb) => {
      const editor = { list: () => [], get: () => undefined, update: () => {}, remove: () => {}, default: () => {} };
      await cb(editor);
      return { dispose: async () => {} };
    },
  },
  tool: {
    transform: async (cb) => {
      const editor = {
        add: (item) => tools.set(item.name, item),
        get: () => undefined,
        update: () => {},
        remove: () => {},
        list: () => [...tools.keys()],
      };
      await cb(editor);
      return { dispose: async () => {} };
    },
  },
  skill: { transform: makeTransform([]) },
  session: {
    hook: async (name, cb) => {
      hooks.set(name, cb);
      return { dispose: async () => {} };
    },
    get: async () => ({ agent: '' }),
    prompt: async () => {},
  },
  event: { subscribe: () => (async function* () {})() },
};

await def.setup(ctx);

const promptHook = hooks.get('prompt');
const contextHook = hooks.get('context');
if (!promptHook || !contextHook) {
  console.error('prompt/context 钩子未注册');
  process.exit(1);
}

const stateFile = path.join(projectDir, '.memory/route-state.json');
const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
};
const sessionState = (sid) => {
  const data = readState();
  return data && data.sessions ? data.sessions[sid] || null : null;
};

const send = async (sid, text) => {
  const ev = { sessionID: sid, prompt: { text }, delivery: 'queue' };
  await promptHook(ev);
  const ctxEv = { sessionID: sid, system: [] };
  await contextHook(ctxEv);
  const injected = ctxEv.system.map((s) => s.text || '').join('\n');
  return { ev, injected };
};

const hasPhase = (injected, phase) => injected.includes(`阶段门禁：${phase.toUpperCase()}`);

console.log('\n== 1. 新需求首条 → RDD / clarify ==');
{
  const { injected, ev } = await send('s1', '帮我加个登录页，要支持记住密码');
  check(ev.prompt.text === '帮我加个登录页，要支持记住密码', 'prompt 未被改写');
  check(injected.includes('路由：`requirements-driven-dev`'), '命中 RDD 路由');
  check(hasPhase(injected, 'clarify'), '注入 CLARIFY 门禁横幅');
  check(injected.includes('禁止'), '横幅含禁止改代码');
  check(sessionState('s1')?.phase === 'clarify', '状态文件 phase=clarify');
}

console.log('\n== 2. 用户说「开始」→ implement ==');
{
  const { injected } = await send('s1', '开始');
  check(hasPhase(injected, 'implement'), '注入 IMPLEMENT 门禁横幅');
  check(injected.includes('git -c commit.gpgsign=false commit'), '横幅提示 checkpoint 命令');
  check(sessionState('s1')?.phase === 'implement', '状态文件 phase=implement');
  check(sessionState('s1')?.baseBranch === branchName, `记录基线分支 ${branchName}`);
  check(injected.includes('禁止为备份新建/切换分支'), '横幅提示 checkpoint 不建分支');
}

console.log('\n== 3. 干活中补充同类问题（报错）→ 不抢锁 ==');
{
  const { injected } = await send('s1', '这个按钮点了报错，显示异常');
  check(sessionState('s1')?.route === 'requirements-driven-dev', '路由仍锁定 RDD');
  check(injected.includes('路由：`requirements-driven-dev`'), '仍注入 RDD 流程');
  check(!injected.includes('路由：`diagnose-before-fix`'), '未被 diagnose 抢走');
  check(injected.includes('已锁定'), '提示疑似意图但沿用当前流程');
}

console.log('\n== 4. 补充新需求 → 打回 clarify ==');
{
  const { injected } = await send('s1', '再加个注册页，顺便支持邮箱验证');
  check(hasPhase(injected, 'clarify'), '阶段回到 CLARIFY');
  check(injected.includes('范围变更'), '提示范围变更需重新确认');
  check(sessionState('s1')?.phase === 'clarify', '状态文件 phase=clarify');
}

console.log('\n== 5. 疑问句不算确认 ==');
{
  const { injected } = await send('s1', '可以吗？');
  check(hasPhase(injected, 'clarify'), '「可以吗？」不触发放行');
  check(sessionState('s1')?.phase === 'clarify', 'phase 仍为 clarify');
}

console.log('\n== 6. 新会话独立匹配 ==');
{
  const { injected } = await send('s2', '这个接口报错 500 了');
  check(injected.includes('路由：`diagnose-before-fix`'), '新会话命中 diagnose');
  check(sessionState('s2')?.route === 'diagnose-before-fix', '新会话独立记录路由');
  check(sessionState('s1')?.route === 'requirements-driven-dev', '旧会话状态不受影响');
}

console.log('\n== 7. 显式「切换路由」→ 解锁 ==');
{
  await send('s1', '切换路由');
  check(sessionState('s1') === null, '本会话锁已清除');
  const { injected } = await send('s1', '帮我修一下这个报错');
  check(injected.includes('路由：`diagnose-before-fix`'), '重新匹配到 diagnose');
}

console.log('\n== 8. rdd-phase 状态迁移 ==');
{
  await send('s3', '加个搜索功能');
  const tool = tools.get('rdd-phase');
  check(Boolean(tool), 'rdd-phase 工具已注册');
  const run = async (action) => {
    const out = await tool.execute({ action }, { sessionID: 's3', directory: projectDir });
    return typeof out === 'string' ? out : out?.content || '';
  };
  check(sessionState('s3')?.phase === 'clarify', '初始 clarify');
  const planOut = await run('plan');
  check(sessionState('s3')?.phase === 'plan-pending', 'plan → plan-pending');
  check(planOut.includes('等用户'), 'plan 返回等待确认提示');
  const startOut = await run('start');
  check(sessionState('s3')?.phase === 'implement', 'start → implement');
  check(sessionState('s3')?.baseBranch === branchName, 'start 记录基线分支');
  check(startOut.includes('不要为备份新建分支'), 'start 返回分支纪律');
  const doneOut = await run('done');
  check(sessionState('s3')?.phase === 'verify', 'done → verify');
  check(doneOut.includes('收尾必须回基线分支'), 'done 返回收尾分支指令');
  const status = await run('status');
  check(status.includes('verify'), 'status 返回当前阶段');
  const { injected } = await send('s3', '继续');
  check(injected.includes('收尾分支纪律'), 'VERIFY 横幅含收尾分支纪律');
  check(injected.includes(`当前分支：\`${branchName}\``), 'VERIFY 横幅显示当前分支');
}

console.log('\n== 9. 旧格式 route-state.json 不生效 ==');
{
  fs.writeFileSync(
    stateFile,
    JSON.stringify({ activeRoute: 'project-docs', activatedAt: new Date().toISOString(), locked: true }),
    'utf8'
  );
  const { injected } = await send('s4', '新增一个导出接口');
  check(injected.includes('路由：`requirements-driven-dev`'), '旧锁不影响新匹配');
  const data = readState();
  check(data && data.version === 2, '状态文件已升级为 v2');
}

console.log('\n== 10. 破坏性操作护栏 ==');
{
  const { injected } = await send('s5', '今天天气怎么样');
  check(injected.includes('破坏性操作硬规则'), '纯问答也注入安全硬规则');
  check(injected.includes('大小写不敏感'), '安全规则写明 PowerShell 变量名不区分大小写');
  const again = await send('s5', '再问一句');
  check(again.injected.includes('破坏性操作硬规则'), '第二轮仍注入安全硬规则');

  const guard = hooks.get('tool.execute.before');
  check(Boolean(guard), 'tool.execute.before 护栏已注册');
  const blocked = async (cmd) => {
    try {
      await guard({ tool: 'bash', sessionID: 's5', callID: 'c1' }, { args: { command: cmd } });
      return false;
    } catch {
      return true;
    }
  };
  check(await blocked('Remove-Item $HOME -Recurse -Force'), '拦截 Remove-Item $HOME -Recurse');
  check(await blocked('rm -rf ~'), '拦截 rm -rf ~');
  check(await blocked('rm -rf %USERPROFILE%\\*'), '拦截 %USERPROFILE% 通配符');
  check(await blocked('Remove-Item C:\\Users\\tmoam -Recurse'), '拦截用户目录根');
  check(await blocked('Remove-Item ~/.ssh -Recurse -Force'), '拦截 .ssh');
  check(await blocked('Remove-Item ~/.cargo -Recurse'), '拦截 .cargo');
  check(await blocked('Remove-Item -Recurse -Force C:\\Users'), '拦截裸写的 C:\\Users');
  check(await blocked('Remove-Item C:\\Users -Recurse -Force'), '拦截 C:\\Users（-Recurse 在后）');
  check(await blocked('Remove-Item -Recurse -Force "C:\\Users"'), '拦截带引号的 C:\\Users');
  check(
    await blocked('$h = Join-Path $env:TEMP "qml-shot\\home"\nRemove-Item -Recurse -Force (Split-Path $h)'),
    '拦截 Split-Path 算出的删除目标'
  );
  check(await blocked('Remove-Item -Recurse -Force "$env:TEMP\\..\\..\\"'), '拦截 .. 上跳的删除目标');
  check(!(await blocked('Remove-Item -Recurse -Force -Confirm:$false .\\dist')), '放行 -Confirm:$false 的项目内删除');
  check(!(await blocked('Remove-Item -Recurse -WhatIf $target')), '放行 -WhatIf 演练');
  check(!(await blocked('Remove-Item -Recurse -Force .\\dist -ErrorAction $pref')), '放行目标之外的变量');
  check(!(await blocked('Remove-Item -Recurse -Force .\\dist   # 不要碰 $HOME')), '放行行尾注释里的变量');
  check(
    !(await blocked(
      '$d = Get-ChildItem C:\\ -Directory\nforeach ($x in $d) { if ($x.FullName -eq (Split-Path $env:USERPROFILE)) { "危险" } }'
    )),
    '放行只检测不删除的脚本'
  );
  check(await blocked('Remove-Item -Recurse -Force $HoMe'), '拦截 $HoMe（变量名大小写不敏感）');
  check(!(await blocked('Remove-Item -Recurse -Force "$env:TEMP\\qml-shot"')), '放行 $env:TEMP 下的清理');
  check(await blocked('$temp = "D:\\evil"; Remove-Item -Recurse -Force "$temp\\x"'), '拦截 $temp 拼出的目标（不是 $env:TEMP）');
  check(await blocked('Remove-Item -Recurse -Force "$env:USERPROFILE\\x"'), '拦截 $env:USERPROFILE 下的删除');
  check(!(await blocked('Remove-Item .\\node_modules -Recurse -Force')), '放行项目内 node_modules');
  check(!(await blocked('rm -rf ./dist')), '放行项目内 dist');
  check(!(await blocked('ls ~/.cargo')), '普通读取不拦截');
}

fs.rmSync(harness, { recursive: true, force: true });

console.log(failed ? `\n== 失败 ${failed} 项 ==` : '\n== 全部通过 ==');
process.exit(failed ? 1 : 0);
