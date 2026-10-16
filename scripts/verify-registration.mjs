/**
 * 深度注册验证（OpenCode V2）：真实加载插件定义，用 mock ctx 触发 setup，
 * 断言全部工具/子技能/Agent 注册，并冒烟 memory-doctor 与路由/压缩注入。
 * 由 verify-install.ps1（-Full）调用。
 *
 * 用法: node verify-registration.mjs <pkgDir> <projectDir>
 * 前置：pkgDir/node_modules/@opencode 已指向可用安装（junction）。
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const [pkgDir, projectDir] = process.argv.slice(2);
if (!pkgDir || !projectDir) {
  console.error('用法: node verify-registration.mjs <pkgDir> <projectDir>');
  process.exit(2);
}

const fail = (msg) => {
  console.log(`  [FAIL] ${msg}`);
  process.exitCode = 1;
};
const pass = (msg) => console.log(`  [PASS] ${msg}`);

const pluginFile = path.join(pkgDir, '.opencode/plugins/junsi-dev-toolkit.js');
if (!fs.existsSync(pluginFile)) {
  fail(`插件文件不存在: ${pluginFile}`);
  process.exit(1);
}

const expectedTools = [
  'store-decision', 'save-progress', 'prepare-handoff', 'restore-handoff',
  'list-decisions', 'memory-doctor', 'save-preference',
  'cluster-task-prompt', 'cluster-scan-models', 'cluster-allocation',
  'goal-set', 'goal-check', 'goal-close',
  'tool-search', 'cron-create',
];

let def;
const dir = path.dirname(pluginFile);
const isEsm = (file) => {
  let d = path.dirname(file);
  for (;;) {
    const pj = path.join(d, 'package.json');
    if (fs.existsSync(pj)) {
      try {
        const t = JSON.parse(fs.readFileSync(pj, 'utf8')).type;
        if (t === 'module') return true;
      } catch {
        /* ignore */
      }
      return false;
    }
    const parent = path.dirname(d);
    if (parent === d) return false;
    d = parent;
  }
};
const tmpPlugin = path.join(dir, `.verify-${process.pid}.mjs`);
const loadedFrom = pluginFile.endsWith('.js') && !isEsm(pluginFile) ? tmpPlugin : pluginFile;
try {
  if (loadedFrom !== pluginFile) fs.copyFileSync(pluginFile, loadedFrom);
  const mod = await import(pathToFileURL(loadedFrom).href);
  def = mod.default;
} catch (e) {
  fail(`插件加载失败: ${e && e.message ? e.message : e}`);
  process.exit(1);
} finally {
  if (loadedFrom !== pluginFile) fs.rmSync(loadedFrom, { force: true });
}

if (!def || def.id !== 'junsi-dev-toolkit' || typeof def.setup !== 'function') {
  fail('默认导出不是合法的 V2 插件定义（需 Plugin.define({ id, setup })）');
  process.exit(1);
}
pass(`插件定义合法 (id=${def.id})`);

// ---------- mock OpenCode V2 ctx ----------
const tools = [];
const skills = [];
const agents = [];
const hooks = new Map();

const makeTransform = (sink) => async (cb) => {
  const editor = {
    add: (item) => sink.push(item),
    get: () => undefined,
    update: () => {},
    remove: () => {},
    list: () => [],
    namespace: () => {},
    default: () => {},
  };
  await cb(editor);
  return { dispose: async () => {} };
};

fs.mkdirSync(projectDir, { recursive: true });

const ctx = {
  location: { directory: projectDir, project: { id: 'verify', directory: projectDir, canonical: projectDir } },
  app: {},
  options: {},
  agent: {
    list: async () => ({ data: [] }),
    transform: async (cb) => {
      const editor = {
        list: () => [],
        get: () => undefined,
        default: () => {},
        update: (id, up) => {
          const agent = { id, request: { settings: {}, headers: {}, body: {} } };
          up(agent);
          agents.push(agent);
        },
        remove: () => {},
      };
      await cb(editor);
      return { dispose: async () => {} };
    },
  },
  tool: { transform: makeTransform(tools) },
  skill: { transform: makeTransform(skills) },
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

try {
  await def.setup(ctx);
} catch (e) {
  fail(`setup 执行失败: ${e && e.stack ? e.stack : e}`);
  process.exit(1);
}
pass('setup 执行完成');

// ---------- tools ----------
const toolNames = tools.map((t) => t.name);
const missing = expectedTools.filter((t) => !toolNames.includes(t));
if (missing.length) fail(`工具未注册: ${missing.join(', ')}`);
else pass(`工具注册完整 (${toolNames.length} 个)`);

for (const t of tools) {
  if (typeof t.execute !== 'function') fail(`工具 ${t.name} 缺少 execute`);
  if (!t.input || t.input.type !== 'object') fail(`工具 ${t.name} 缺少 JSON Schema input`);
}

// ---------- skills ----------
if (skills.length >= 9) pass(`子技能注册 (${skills.length} 个: ${skills.map((s) => s.id).join(', ')})`);
else fail(`子技能注册不足 (${skills.length} 个，预期 >= 9)`);

// ---------- agents ----------
const agentIds = agents.map((a) => a.id);
for (const want of ['cluster', 'penetration', 'goal', 'cluster-planner', 'cluster-backend']) {
  if (!agentIds.includes(want)) fail(`Agent 未注册: ${want}`);
}
if (agentIds.length >= 14) pass(`Agent 注册 (${agentIds.length} 个)`);
else fail(`Agent 注册不足 (${agentIds.length} 个，预期 >= 14)`);

// ---------- prompt 钩子（路由判定；不得污染用户消息） ----------
const promptHook = hooks.get('prompt');
const contextHook = hooks.get('context');
if (!promptHook) {
  fail('未注册 prompt 钩子');
} else if (!contextHook) {
  fail('未注册 context 钩子');
} else {
  const original = '帮我把这个 Java 项目 migrate 到 Go';
  const ev = { sessionID: 'verify-session', prompt: { text: original }, delivery: 'queue' };
  try {
    await promptHook(ev);
    if (ev.prompt.text !== original) fail('prompt 钩子污染了用户消息（应只判定、不改写原文）');
    else pass('prompt 钩子未改写用户消息');

    const ctxEv = { sessionID: 'verify-session', system: [] };
    await contextHook(ctxEv);
    const injected = ctxEv.system.map((s) => s.text || '').join('\n');
    if (ctxEv.system.length && injected.includes('code-migrater')) pass('context 钩子把路由注入 system 提示');
    else fail('context 钩子未把路由注入 system 提示');
  } catch (e) {
    fail(`路由钩子执行失败: ${e && e.message ? e.message : e}`);
  }
}

// ---------- compaction 钩子（记忆上下文注入） ----------
const compactionHook = hooks.get('compaction');
if (!compactionHook) {
  fail('未注册 compaction 钩子');
} else {
  const ev = { sessionID: 'verify-session', system: [] };
  try {
    await compactionHook(ev);
    pass(`compaction 钩子生效 (注入 ${ev.system.length} 段)`);
  } catch (e) {
    fail(`compaction 钩子执行失败: ${e && e.message ? e.message : e}`);
  }
}

// ---------- memory-doctor 冒烟 ----------
const doctor = tools.find((t) => t.name === 'memory-doctor');
if (!doctor) {
  fail('缺少 memory-doctor');
} else {
  try {
    const out = await doctor.execute({}, { directory: projectDir });
    const text = typeof out === 'string' ? out : out && out.content ? out.content : String(out);
    if (String(text).includes('memory 健康审计')) pass('memory-doctor 冒烟执行');
    else fail('memory-doctor 输出异常');
  } catch (e) {
    fail(`memory-doctor 冒烟失败: ${e && e.message ? e.message : e}`);
  }
}

console.log(process.exitCode ? '== 深度验证失败 ==' : '== 深度验证通过 ==');
