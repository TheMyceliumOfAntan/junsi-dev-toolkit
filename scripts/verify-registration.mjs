/**
 * 深度注册验证：真实加载插件，断言全部工具注册 + memory-doctor 冒烟。
 * 由 verify-install.ps1（-Full）调用。
 *
 * 用法: node verify-registration.mjs <pkgDir> <projectDir>
 * 前置：pkgDir/node_modules/@opencode-ai 已指向可用安装（junction）。
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

const pluginFile = path.join(pkgDir, '.opencode/plugins/junsi-dev-toolkit.js');
if (!fs.existsSync(pluginFile)) {
  fail(`插件文件不存在: ${pluginFile}`);
  process.exit(1);
}

const expected = [
  'store-decision', 'save-progress', 'prepare-handoff', 'restore-handoff',
  'list-decisions', 'memory-doctor', 'save-preference',
  'cluster-task-prompt', 'cluster-scan-models', 'cluster-allocation',
  'tool-search', 'cron-create',
];

let JunsiDevToolkitPlugin;
try {
  ({ JunsiDevToolkitPlugin } = await import(pathToFileURL(pluginFile).href));
} catch (e) {
  fail(`插件加载失败: ${e.message}`);
  process.exit(1);
}

const client = { app: { log: () => {} } };
fs.mkdirSync(projectDir, { recursive: true });
const instance = await JunsiDevToolkitPlugin({ client, directory: projectDir });
const registered = Object.keys(instance.tool || {});

const missing = expected.filter((t) => !registered.includes(t));
if (missing.length) {
  fail(`工具未注册: ${missing.join(', ')}`);
} else {
  console.log(`  [PASS] 工具注册完整 (${registered.length} 个: ${expected.join(', ')})`);
}

for (const t of expected) {
  if (!registered.includes(t)) continue;
  if (instance.tool[t] && typeof instance.tool[t].execute !== 'function') {
    fail(`工具 ${t} 缺少 execute`);
  }
}

try {
  const doc = await instance.tool['memory-doctor'].execute({}, { directory: projectDir });
  if (String(doc).includes('memory 健康审计')) {
    console.log('  [PASS] memory-doctor 冒烟执行');
  } else {
    fail('memory-doctor 输出异常');
  }
} catch (e) {
  fail(`memory-doctor 冒烟失败: ${e.message}`);
}

console.log(process.exitCode ? '== 深度验证失败 ==' : '== 深度验证通过 ==');
