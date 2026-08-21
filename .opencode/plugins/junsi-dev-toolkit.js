/**
 * junsi-dev-toolkit plugin for OpenCode.ai (v3.1)
 *
 * - 代码级意图路由：关键词正则匹配用户消息，命中 → 注入**对应子技能 SKILL.md 全文** + 强制路由宣告
 * - 未匹配到开发意图（纯问答）→ 零注入（省 token）
 * - 新会话检测 .memory/HANDOFF.md → 注入恢复指令
 * - memory 自定义工具：store-decision / save-progress / prepare-handoff / restore-handoff / list-decisions / memory-doctor / save-preference
 * - Cluster 模式：config hook 注入 cluster 主 agent + 5 个专精 subagent（模型按本机可用性动态降级）
 *   + cluster-scan-models / cluster-allocation 工具（动态检测 + 分配方案，需用户确认）
 * - 实用工具：tool-search（工具索引检索）/ cron-create（Windows 计划任务）
 * - 决策顾问路由：advisor（权衡矩阵 + question 确认）
 * - 浏览器自动化路由：computer-use（playwright MCP 操作闭环）
 * - 会话压缩钩子：自动注入 .memory 索引与 HANDOFF 摘要
 * - session.idle 钩子：空闲时自动初始化 .memory 骨架 + 记录会话痕迹
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INJECT_MARK = '<!-- junsi-dev-toolkit:route -->';

const ROUTES = [
  {
    id: 'cluster',
    priority: 6,
    skillPath: '.agents/skills/junsi-dev-toolkit/cluster/SKILL.md',
    summary: 'Cluster 模式：主 Agent 统筹规划，按任务类型派发给不同专精模型 Subagent 并行执行',
    keywords: ['集群', 'cluster', '多agent', '多 agent', 'agent 集群', '并行开发', '分工', '多个模型', '多模型'],
  },
  {
    id: 'code-migrater',
    priority: 5,
    skillPath: '.agents/skills/junsi-dev-toolkit/code-migrater/SKILL.md',
    summary: '跨语言/跨框架代码移植，先可行性评估 → 冲突矩阵 → 原子化移植 → 快照比对验证',
    keywords: ['移植', '迁移', 'migrate', '跨语言', '跨框架', '翻译成'],
  },
  {
    id: 'diagnose-before-fix',
    priority: 4,
    skillPath: '.agents/skills/junsi-dev-toolkit/diagnose-before-fix/SKILL.md',
    summary: 'Bug 修复 8 步：理解 → 枚举原因 → 问方向 → 修复 → Build 验证 → 原始复测',
    keywords: ['报错', '不对', '不工作', '返回错误', '空列表', '崩溃', '白屏', 'bug', '异常', '闪退'],
  },
  {
    id: 'advisor',
    priority: 3.5,
    skillPath: '.agents/skills/junsi-dev-toolkit/advisor/SKILL.md',
    summary: '决策顾问：多方案权衡矩阵 → 明确推荐 + question 确认（复杂决策专用）',
    keywords: ['advisor', '顾问', '权衡', '利弊', '方案对比', '对比方案', '选哪个', '哪个方案', '优缺点', 'compare'],
  },
  {
    id: 'memory-skill',
    priority: 3,
    skillPath: '.agents/skills/junsi-dev-toolkit/memory-skill/SKILL.md',
    summary: '决策记忆 / 进度保存 / HANDOFF 跨会话恢复（.memory/ 目录）',
    keywords: ['记住', '记录', '记一下', '决策', '保存进度', '换会话', '降智', '上下文不够', '恢复进度', '有哪些决策', '决策历史', '回顾决策', '健康审计', '记忆体检'],
  },
  {
    id: 'computer-use',
    priority: 2.5,
    skillPath: '.agents/skills/junsi-dev-toolkit/computer-use/SKILL.md',
    summary: '计算机操作/浏览器自动化：playwright MCP 配置 + 截图→操作→验证闭环',
    keywords: ['computer_use', 'computer use', '操作电脑', '桌面自动化', '模拟鼠标', '模拟键盘', '浏览器自动化', '控制浏览器', '自动操作浏览器'],
  },
  {
    id: 'project-docs',
    priority: 2,
    skillPath: '.agents/skills/junsi-dev-toolkit/project-docs/SKILL.md',
    summary: '项目知识中枢：文档管理 + 代码感知 MCP 工具（架构/API/路由/组件）',
    keywords: ['文档', '规范', 'ADR', '架构', '设计', 'API', '组件', '项目结构', '端点', '路由'],
  },
  {
    id: 'requirements-driven-dev',
    priority: 1,
    skillPath: '.agents/skills/junsi-dev-toolkit/requirements-driven-dev/SKILL.md',
    summary: '新功能/改动开发三阶段：CLARIFY → IMPLEMENT → VERIFY',
    keywords: [
      '添加',
      '新增',
      '实现',
      '加个',
      '做一个',
      '页面',
      '接口',
      '功能',
      '需求',
      '优化',
      '重构',
      'refactor',
      '改进',
      '精简',
      '提速',
      '重写',
      '整理',
      '规范一下',
    ],
  },
];

const matchRoute = (text) => {
  const hits = [];
  for (const route of ROUTES) {
    const count = route.keywords.filter((kw) => text.includes(kw)).length;
    if (count > 0) hits.push({ route, count });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => b.count - a.count || b.route.priority - a.route.priority);
  return hits[0].route;
};

const stripFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  return match ? match[2] : content;
};

const readSkillContent = (skillsDir, route) => {
  try {
    const full = fs.readFileSync(path.join(skillsDir, route.id, 'SKILL.md'), 'utf8');
    return stripFrontmatter(full);
  } catch {
    return `子技能文件读取失败: ${route.id}/SKILL.md`;
  }
};

const buildRouteInjection = (route, skillsDir) => {
  const skillBody = readSkillContent(skillsDir, route);
  return [
    '# junsi-dev-toolkit 路由（代码级匹配）',
    '',
    '## 强制路由宣告',
    `- 路由：\`${route.id}\``,
    '- 要求：',
    `  1. 回复开头必须输出 \`📌 路由宣告: ${route.id}\`，未输出视为违规`,
    `  2. 严格遵守下方子技能流程（全文已注入，无需再读文件）`,
    '  3. 动手实现/修复前先做远程更新预检（Gate 0）：`git fetch` + 查上游提交/CHANGELOG/issue，确认上游未实现/未修复才自研；已实现则提示用户改用上游，不重复造轮子',
    '  4. 涉及 API/架构/UI/行为变更 → 必须调用 project-docs 的 `update_doc`/`create_adr`，不得自己乱写文档',
    '  5. 阶段确认后 → 必须调用 `store-decision`',
    '  6. 任务完成 → 必须调用 `save-progress`',
    '  7. 缺任何一项不得说"完成"',
    '',
    '## 子技能全文（必读必守）',
    '',
    skillBody,
    INJECT_MARK,
  ].join('\n');
};

const buildFullRoutingTable = () => {
  return [
    '# 开发任务路由（junsi-dev-toolkit）',
    '| 优先级 | 用户意图 | 路由到 |',
    '|--------|---------|--------|',
    '| 最高 | 集群/多agent/并行分工/多模型 | `cluster` |',
    '| 次高 | 移植/迁移/migrate/port/跨语言/跨框架 | `code-migrater` |',
    '| 中高 | 报错/不对/不工作/返回错误/空列表/崩溃/白屏 | `diagnose-before-fix` |',
    '| 中 | 记住/记录/记一下/决策/保存进度/换会话/降智 | `memory-skill` |',
    '| 中低 | 文档/规范/ADR/架构/设计/API/组件/决策记录 | `project-docs` |',
    '| 最低 | 添加/新增/实现/优化/重构/改进/加个新功能/页面/接口/组件 | `requirements-driven-dev` |',
    '纯知识问答不触发路由。同时匹配多项取优先级最高。',
    INJECT_MARK,
  ].join('\n');
};

const getLastUserMessage = (messages) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.info && m.info.role === 'user') return m;
  }
  return null;
};

const getText = (parts) => {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('\n');
};

const hasInjection = (parts) => {
  return Array.isArray(parts) && parts.some((p) => p && p.type === 'text' && p.text.includes(INJECT_MARK));
};

const MEMORY_LIMITS = {
  indexLines: 200,
  indexBytes: 25 * 1024,
  handoffBytes: 12 * 1024,
  historyMax: 20,
  compactDecision: 3,
  compactHandoff: 800,
  compactPreference: 800,
  compactIndex: 20 * 1024,
  doctorHandoffStaleDays: 7,
};

const memoryDir = (projectDir) => path.join(projectDir, '.memory');
const userMemoryDir = () => path.join(os.homedir(), '.config', 'opencode', '.memory');
const readOrEmpty = (p) => {
  try {
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  } catch {
    return '';
  }
};

const ensureMemoryDir = (dir) => {
  const mem = memoryDir(dir);
  fs.mkdirSync(path.join(mem, 'decisions'), { recursive: true });
  fs.mkdirSync(path.join(mem, 'progress'), { recursive: true });
  fs.mkdirSync(path.join(mem, 'progress', 'history'), { recursive: true });
  fs.mkdirSync(path.join(mem, 'sessions'), { recursive: true });
  return mem;
};

const ensureUserMemoryDir = () => {
  const dir = userMemoryDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const ensureGitignore = (dir) => {
  const gi = path.join(dir, '.gitignore');
  try {
    const content = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
    if (!content.split('\n').some((l) => l.trim() === '.memory/')) {
      fs.writeFileSync(gi, content.endsWith('\n') || !content ? `${content}.memory/\n` : `${content}\n.memory/\n`);
    }
  } catch {
    // 忽略无 .gitignore 的项目
  }
};

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const slugify = (title = '') =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'untitled';

const decisionFiles = (mem) => {
  const d = path.join(mem, 'decisions');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.md')).sort();
};

const listRecentDecisions = (mem, n = 3) => decisionFiles(mem).reverse().slice(0, n);

const readDecisionTitle = (content, fallback) => {
  const m = content.match(/^## 决策记录：(.+)$/m) || content.match(/^# 决策：(.+)$/m);
  return m ? m[1] : fallback;
};

const measureText = (text) => {
  const lines = text.split('\n').length;
  const bytes = Buffer.byteLength(text, 'utf8');
  return { lines, bytes };
};

const writeIndex = (mem, { task, stage } = {}) => {
  const progress = readOrEmpty(path.join(mem, 'progress', 'current.md'));
  const progressHead = progress.split('\n').slice(0, 6).join('\n').trim();
  const progressTitle = progress.match(/^## 进度：(.+)$/m) || progress.match(/^# 进度：(.+)$/m);
  const recent = listRecentDecisions(mem, 3).map((f) => {
    const c = readOrEmpty(path.join(mem, 'decisions', f));
    return `- ${readDecisionTitle(c, f.slice(0, 40))}（${f.slice(0, 10)}）`;
  });
  const handoffPath = path.join(mem, 'HANDOFF.md');
  const handoff = fs.existsSync(handoffPath);
  const historyCount = fs.existsSync(path.join(mem, 'progress', 'history'))
    ? fs.readdirSync(path.join(mem, 'progress', 'history')).filter((f) => f.endsWith('.md')).length
    : 0;
  const taskLine = (task || (progressTitle ? progressTitle[1] : '（未命名任务）')).slice(0, 120);
  const stageLine = stage || (progress.match(/^- 阶段：(.+)$/m) ? progress.match(/^- 阶段：(.+)$/m)[1] : '未记录');
  const lines = [
    '# 任务索引',
    '',
    `> 自动维护：${new Date().toISOString().slice(0, 10)} ｜ 超 ${MEMORY_LIMITS.indexLines} 行会被拒绝，请精简`,
    '',
    '## 当前任务',
    `- 标题：${taskLine}`,
    `- 阶段：${stageLine}`,
    `- 最后更新：${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    '## 进度摘要',
    progressHead || '（无）',
    '',
    '## 最近决策',
    recent.length ? recent.join('\n') : '（无）',
    '',
    '## 状态',
    `- HANDOFF：${handoff ? `就绪（${new Date(fs.statSync(handoffPath).mtime).toLocaleString()}）` : '无'}`,
    `- 进度历史快照：${historyCount} 条（上限 ${MEMORY_LIMITS.historyMax}）`,
    `- 决策总数：${decisionFiles(mem).length}`,
    '',
    '## 快速链接',
    '- 决策：`.memory/decisions/`',
    '- 进度：`.memory/progress/current.md`',
    '- 历史：`.memory/progress/history/`',
    '- 会话：`.memory/sessions/`',
    '',
  ].join('\n');
  const { lines: nLines, bytes } = measureText(lines);
  if (nLines > MEMORY_LIMITS.indexLines || bytes > MEMORY_LIMITS.indexBytes) {
    return { ok: false, message: `INDEX.md 超限（${nLines} 行 / ${(bytes / 1024).toFixed(1)}KB > ${MEMORY_LIMITS.indexLines} 行 / ${(MEMORY_LIMITS.indexBytes / 1024).toFixed(0)}KB）：已拒绝写入，请精简进度摘要与决策标题后再保存` };
  }
  fs.writeFileSync(path.join(mem, 'INDEX.md'), lines, 'utf8');
  return { ok: true, message: `INDEX.md 已更新（${nLines} 行 / ${(bytes / 1024).toFixed(1)}KB）` };
};

const archiveProgress = (mem) => {
  const current = path.join(mem, 'progress', 'current.md');
  if (!fs.existsSync(current)) return;
  const hist = path.join(mem, 'progress', 'history');
  fs.mkdirSync(hist, { recursive: true });
  const content = readOrEmpty(current);
  const title = (content.match(/^## 进度：(.+)$/m) || content.match(/^# 进度：(.+)$/m) || [])[1] || 'progress';
  fs.writeFileSync(path.join(hist, `${timestamp()}-${slugify(title)}.md`), content, 'utf8');
  const files = fs.readdirSync(hist).filter((f) => f.endsWith('.md')).sort();
  while (files.length > MEMORY_LIMITS.historyMax) {
    fs.unlinkSync(path.join(hist, files.shift()));
  }
};

const appendSessionTrace = (mem, { task, stage, source }) => {
  const dir = path.join(mem, 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${timestamp()}.md`);
  const line = `- ${new Date().toISOString().slice(0, 16).replace('T', ' ')}｜${task}（${stage}）｜${source || 'save-progress'}`;
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, ['# 会话痕迹', line, ''].join('\n'), 'utf8');
  } else {
    fs.appendFileSync(file, `${line}\n`, 'utf8');
  }
};

const archiveHandoff = (mem, prefix = 'handoff-done') => {
  const f = path.join(mem, 'HANDOFF.md');
  if (!fs.existsSync(f)) return false;
  const dir = path.join(mem, 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const content = readOrEmpty(f);
  const title = (content.match(/^## 任务\s*\n(.+)$/m) || [])[1] || 'handoff';
  fs.writeFileSync(path.join(dir, `${prefix}-${timestamp()}-${slugify(title)}.md`), content, 'utf8');
  fs.unlinkSync(f);
  return true;
};

const registerMemoryTools = async (tools) => {
  let tool;
  try {
    ({ tool } = await import('@opencode-ai/plugin'));
  } catch (e) {
    return { ok: false, error: `@opencode-ai/plugin 不可用，跳过自定义工具: ${e.message}` };
  }
  const schema = tool.schema;

  tools['store-decision'] = tool({
    description:
      '记录一条关键决策。默认写入项目 .memory/decisions/；scope=global 时写入用户级 ~/.config/opencode/.memory/decisions/（跨项目生效，适合通用经验/偏好型决策）。当用户说"记住/记录/记一下/方案确认/决策"时调用，或子技能在阶段确认后自动调用。',
    args: {
      title: schema.string().describe('决策标题'),
      scenario: schema.string().describe('场景/上下文'),
      decision: schema.string().describe('选了什么方案，为什么不选其他'),
      impact: schema.string().optional().describe('影响范围（文件/模块）'),
      scope: schema.enum(['project', 'global']).optional().describe('project=写入项目 .memory/decisions/（默认）；global=写入用户级全局记忆，跨项目生效'),
    },
    async execute(args, context) {
      const mem = ensureMemoryDir(context.directory);
      ensureGitignore(context.directory);
      const isGlobal = args.scope === 'global';
      const targetDir = isGlobal ? path.join(ensureUserMemoryDir(), 'decisions') : path.join(mem, 'decisions');
      fs.mkdirSync(targetDir, { recursive: true });
      const file = path.join(targetDir, `${timestamp()}-${slugify(args.title)}.md`);
      const content = [
        '## 决策记录：' + args.title,
        '- 日期：' + new Date().toISOString().slice(0, 10),
        '- 场景：' + args.scenario,
        '- 方案：' + args.decision,
        ...(args.impact ? ['- 影响范围：' + args.impact] : []),
        ...(isGlobal ? ['- 作用域：global（跨项目生效）'] : []),
        '',
      ].join('\n');
      fs.writeFileSync(file, content, 'utf8');
      return `已记录决策: ${file}${isGlobal ? '（全局作用域，跨项目生效）' : ''}`;
    },
  });

  tools['save-progress'] = tool({
    description:
      '保存任务进度到项目 .memory/progress/current.md 并更新 INDEX.md。用户说"保存进度/做到哪了/记进度"，或任务 VERIFY 通过后调用。',
    args: {
      task: schema.string().describe('任务标题'),
      stage: schema.string().describe('阶段：CLARIFY/IMPLEMENT/VERIFY/中断'),
      done: schema.string().describe('完成项（逗号分隔）'),
      todo: schema.string().describe('待办项（逗号分隔）'),
      next: schema.string().optional().describe('建议下一步'),
      files: schema.string().optional().describe('涉及的关键文件（逗号分隔）'),
    },
    async execute(args, context) {
      const mem = ensureMemoryDir(context.directory);
      ensureGitignore(context.directory);
      archiveProgress(mem);
      const file = path.join(mem, 'progress', 'current.md');
      const content = [
        '## 进度：' + args.task,
        '- 阶段：' + args.stage,
        '- 完成项：' + args.done.split(',').map((s) => s.trim()).filter(Boolean).join('、'),
        '- 待办项：' + args.todo.split(',').map((s) => s.trim()).filter(Boolean).join('、'),
        ...(args.next ? ['- 下一步：' + args.next] : []),
        ...(args.files ? ['- 关键文件：' + args.files] : []),
        '- 更新：' + new Date().toISOString(),
        '',
      ].join('\n');
      fs.writeFileSync(file, content, 'utf8');
      const idx = writeIndex(mem, { task: args.task, stage: args.stage });
      appendSessionTrace(mem, { task: args.task, stage: args.stage, source: 'save-progress' });
      return `进度已保存: ${file}\n${idx.message}`;
    },
  });

  tools['prepare-handoff'] = tool({
    description:
      '生成跨会话 HANDOFF.md（自包含恢复包）。用户说"换会话/换窗口/上下文不够/降智/重开"，或感觉到上下文将满时调用。',
    args: {
      task: schema.string().describe('任务标题'),
      status: schema.string().describe('当前状态摘要'),
      done: schema.string().describe('已完成事项'),
      pending: schema.string().describe('待办事项'),
      files: schema.string().describe('关键文件列表'),
      decisions: schema.string().optional().describe('关键决策摘要'),
      next: schema.string().optional().describe('下一步行动'),
    },
    async execute(args, context) {
      const mem = ensureMemoryDir(context.directory);
      const file = path.join(mem, 'HANDOFF.md');
      archiveHandoff(mem, 'handoff-previous');
      const content = [
        '# HANDOFF',
        '',
        '## 任务',
        args.task,
        '',
        '## 状态',
        args.status,
        '',
        '## 已完成',
        args.done,
        '',
        '## 待办',
        args.pending,
        '',
        '## 关键文件',
        args.files,
        '',
        ...(args.decisions ? ['## 关键决策', args.decisions, ''] : []),
        ...(args.next ? ['## 下一步', args.next, ''] : []),
        '> 新会话自动检测本文件并注入恢复指令。恢复完成后调用 `restore-handoff`（complete: true）归档并移除本文件。',
        '',
      ].join('\n');
      const { lines, bytes } = measureText(content);
      if (bytes > MEMORY_LIMITS.handoffBytes) {
        return `HANDOFF 超限（${(bytes / 1024).toFixed(1)}KB > ${(MEMORY_LIMITS.handoffBytes / 1024).toFixed(0)}KB）：已拒绝写入，请压缩状态/待办/决策摘要后再试`;
      }
      fs.writeFileSync(file, content, 'utf8');
      const idx = writeIndex(mem, { task: args.task, stage: '准备换会话' });
      appendSessionTrace(mem, { task: args.task, stage: 'HANDOFF', source: 'prepare-handoff' });
      return `HANDOFF 已生成: ${file}（${lines} 行 / ${(bytes / 1024).toFixed(1)}KB）\n${idx.message}`;
    },
  });

  tools['restore-handoff'] = tool({
    description:
      '读取 .memory/HANDOFF.md 恢复跨会话状态。新会话检测到 HANDOFF 时由路由层自动调用；用户说"恢复进度/接着上次做"时也可调用。complete=true 表示任务确认完成，读后归档 HANDOFF 到 sessions/ 并移除活动文件。',
    args: {
      complete: schema.boolean().optional().describe('任务是否已完成：true=读后归档并移除 HANDOFF（防止过期恢复包误导新会话）；默认 false=仅读取'),
    },
    async execute(args, context) {
      const mem = ensureMemoryDir(context.directory);
      const content = readOrEmpty(path.join(mem, 'HANDOFF.md'));
      if (!content) return '未找到 .memory/HANDOFF.md，无待恢复任务。';
      const result = `HANDOFF.md 内容如下，直接恢复工作状态（无需重新读代码/查结构）：\n\n${content}`;
      if (args.complete) {
        const archived = archiveHandoff(mem, 'handoff-done');
        writeIndex(mem);
        return archived ? `${result}\n\n（任务已确认完成：HANDOFF 已归档到 sessions/ 并移除，新会话不再注入）` : result;
      }
      return result;
    },
  });

  tools['list-decisions'] = tool({
    description:
      '列出决策历史（标题+日期+摘要），按时间倒序，支持分词模糊匹配（空格分词，AND 全命中优先、OR 兜底）。scope=all 时合并项目 + 全局决策（全局标注 🌐）。用户说"有哪些决策/决策历史/回顾决策"时调用。',
    args: {
      keyword: schema.string().optional().describe('关键词过滤（标题或内容包含，留空列出全部）'),
      limit: schema.number().optional().describe('最多返回条数，默认 20，最大 50'),
      scope: schema.enum(['all', 'project', 'global']).optional().describe('all=合并项目+全局决策（默认）；project=仅项目；global=仅全局'),
    },
    async execute(args, context) {
      const mem = ensureMemoryDir(context.directory);
      const scope = args.scope || 'all';
      const globalDecDir = path.join(ensureUserMemoryDir(), 'decisions');
      const sources = [];
      if (scope !== 'global') sources.push({ dir: path.join(mem, 'decisions'), tag: '' });
      if (scope !== 'project') sources.push({ dir: globalDecDir, tag: '🌐 ' });
      const files = [];
      for (const s of sources) {
        if (!fs.existsSync(s.dir)) continue;
        for (const f of fs.readdirSync(s.dir).filter((x) => x.endsWith('.md')).sort().reverse()) {
          files.push({ f, tag: s.tag, dir: s.dir });
        }
      }
      files.sort((a, b) => (a.f < b.f ? 1 : -1));
      if (!files.length) return '尚无决策记录。';
      const limit = Math.min(Math.max(args.limit || 20, 1), 50);
      const tokens = (args.keyword || '').trim().toLowerCase().split(/[\s,，、;；]+/).filter(Boolean);
      const contentOf = (src) => {
        const c = readOrEmpty(path.join(src.dir, src.f));
        return { c, title: readDecisionTitle(c, src.f) };
      };
      const matches = (hay, toks, mode) => (mode === 'or' ? toks.some((t) => hay.includes(t)) : toks.every((t) => hay.includes(t)));
      let matched = [];
      let mode = 'all';
      if (tokens.length) {
        const andHit = files.filter((src) => {
          const { c, title } = contentOf(src);
          return matches(`${title}\n${c}`.toLowerCase(), tokens, 'and');
        });
        if (andHit.length || tokens.length === 1) {
          matched = andHit;
          mode = tokens.length === 1 ? 'single' : 'and';
        } else {
          matched = files.filter((src) => {
            const { c, title } = contentOf(src);
            return matches(`${title}\n${c}`.toLowerCase(), tokens, 'or');
          });
          mode = 'or';
        }
      } else {
        matched = files;
      }
      const out = matched.slice(0, limit).map((src) => {
        const { c, title } = contentOf(src);
        const head = c.split('\n').filter((l) => l.trim()).slice(0, 4).join('\n  ');
        return `- ${src.tag}**${title}**（${src.f.slice(0, 10)}）\n  ${head}`;
      });
      const modeLabel = { all: '全部', single: `单词过滤（词：${tokens[0]}）`, and: `AND 全词匹配（词：${tokens.join(' / ')}）`, or: `OR 任意词匹配（AND 无结果，兜底：${tokens.join(' / ')}）` }[mode];
      const nProject = fs.existsSync(sources[0] ? sources[0].dir : '') ? fs.readdirSync(sources[0].dir).filter((x) => x.endsWith('.md')).length : 0;
      const nGlobal = fs.existsSync(sources[1] ? sources[1].dir : '') ? fs.readdirSync(sources[1].dir).filter((x) => x.endsWith('.md')).length : 0;
      return out.length
        ? `## 决策历史（显示 ${out.length} / 共 ${files.length} 条${args.keyword ? `，${modeLabel}` : ''}${scope === 'all' ? `｜项目 ${nProject} + 全局 🌐 ${nGlobal}` : ''}）\n\n${out.join('\n\n')}\n\n> 想回溯某条全文：读取对应 decisions/ 目录下的文件`
        : `无匹配决策（关键词：${args.keyword || '空'}）。`;
    },
  });

  tools['memory-doctor'] = tool({
    description:
      'memory 健康审计：检查 INDEX 大小/结构、进度文件、HANDOFF 是否过期残留、决策与会话数量、全局记忆层。用户说"健康审计/记忆体检"时调用。',
    args: {},
    async execute(_args, context) {
      const mem = ensureMemoryDir(context.directory);
      const issues = [];
      const notes = [];
      const check = (ok, msg) => (ok ? notes.push(`✅ ${msg}`) : issues.push(`⚠️ ${msg}`));

      const idx = readOrEmpty(path.join(mem, 'INDEX.md'));
      if (!idx) {
        issues.push('INDEX.md 缺失（运行 save-progress 或 prepare-handoff 生成）');
      } else {
        const { lines, bytes } = measureText(idx);
        check(lines <= MEMORY_LIMITS.indexLines && bytes <= MEMORY_LIMITS.indexBytes, `INDEX.md ${lines} 行 / ${(bytes / 1024).toFixed(1)}KB（上限 ${MEMORY_LIMITS.indexLines} 行 / ${(MEMORY_LIMITS.indexBytes / 1024).toFixed(0)}KB）`);
        const hasTask = /^## 当前任务/m.test(idx) && /^- 标题：/m.test(idx);
        check(hasTask, 'INDEX.md 结构完整（含"当前任务"）');
        check(/^## 最近决策/m.test(idx), 'INDEX.md 含"最近决策"区块');
      }

      const progress = path.join(mem, 'progress', 'current.md');
      check(fs.existsSync(progress), `进度文件存在（${fs.existsSync(progress) ? (measureText(readOrEmpty(progress)).bytes / 1024).toFixed(1) + 'KB' : '缺失'}）`);

      const handoff = path.join(mem, 'HANDOFF.md');
      if (fs.existsSync(handoff)) {
        const ageDays = (Date.now() - fs.statSync(handoff).mtimeMs) / 86400000;
        if (ageDays > MEMORY_LIMITS.doctorHandoffStaleDays) {
          issues.push(`HANDOFF.md 已存在 ${ageDays.toFixed(1)} 天，疑似过期残留（>${MEMORY_LIMITS.doctorHandoffStaleDays} 天）：若任务已完成请调用 restore-handoff（complete: true）归档移除`);
        } else {
          notes.push(`HANDOFF.md 存在（${ageDays.toFixed(1)} 天前更新）`);
        }
      } else {
        notes.push('无活动 HANDOFF');
      }

      const nDec = decisionFiles(mem).length;
      notes.push(`决策 ${nDec} 条`);
      const sDir = path.join(mem, 'sessions');
      const nSess = fs.existsSync(sDir) ? fs.readdirSync(sDir).filter((f) => f.endsWith('.md')).length : 0;
      notes.push(`会话记录 ${nSess} 条`);
      const hDir = path.join(mem, 'progress', 'history');
      const nHist = fs.existsSync(hDir) ? fs.readdirSync(hDir).filter((f) => f.endsWith('.md')).length : 0;
      check(nHist <= MEMORY_LIMITS.historyMax, `进度历史 ${nHist} 条（上限 ${MEMORY_LIMITS.historyMax}，超出自动裁剪）`);

      const up = readOrEmpty(path.join(userMemoryDir(), 'preferences.md'));
      check(Boolean(up.trim()), `全局用户偏好 ${up.trim() ? '已初始化' : '未初始化（用 save-preference 写入全局偏好）'}（~/.config/opencode/.memory/）`);
      const gDecDir = path.join(userMemoryDir(), 'decisions');
      const nGDec = fs.existsSync(gDecDir) ? fs.readdirSync(gDecDir).filter((f) => f.endsWith('.md')).length : 0;
      notes.push(`全局决策 ${nGDec} 条（scope=global 的 store-decision 写入）`);

      const head = ['# memory 健康审计', '', `- 时间：${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, `- 项目：.memory/`, '- 状态：' + (issues.length ? `${issues.length} 个问题` : '全部健康'), ''];
      return head.concat(notes.map((n) => n + '\n'), issues.map((i) => i + '\n'), issues.length ? ['', '> 修复建议见各问题说明。'] : []).join('\n');
    },
  });

  tools['save-preference'] = tool({
    description:
      '保存跨项目全局偏好到 ~/.config/opencode/.memory/preferences.md（用户级记忆，所有项目生效）。用户说"记住我的偏好/以后都用XX/默认XX"时调用。',
    args: {
      preference: schema.string().describe('偏好内容（一句话，可验证，如"前端项目一律用 pnpm，不用 npm"）'),
    },
    async execute(args, _context) {
      const dir = ensureUserMemoryDir();
      const file = path.join(dir, 'preferences.md');
      const existing = readOrEmpty(file);
      const line = `- ${new Date().toISOString().slice(0, 10)}：${args.preference.trim()}`;
      const content = existing.trim() ? `${existing.trimEnd()}\n${line}\n` : `# 全局用户偏好\n\n> 跨项目生效，会话压缩时自动注入。避免重复条目，语义相同请合并。\n\n${line}\n`;
      const { bytes } = measureText(content);
      if (bytes > MEMORY_LIMITS.compactPreference * 3) {
        return `preferences.md 已偏大（${(bytes / 1024).toFixed(1)}KB）：请合并重复条目后再追加`;
      }
      fs.writeFileSync(file, content, 'utf8');
      return `已保存全局偏好: ${file}`;
    },
  });

  return { ok: true };
};

/* ---------- Cluster 模式：动态模型检测 + Agent 注入 ---------- */

const AUTH_PATHS = [
  path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json'),
  path.join(os.homedir(), '.config', 'opencode', 'auth.json'),
  path.join(os.homedir(), '.opencode', 'auth.json'),
];

const MODELS_CACHE = path.join(os.homedir(), '.cache', 'opencode', 'models.json');

const detectAuthedProviders = () => {
  const authed = new Set();
  for (const p of AUTH_PATHS) {
    try {
      if (!fs.existsSync(p)) continue;
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const [provider, v] of Object.entries(data)) {
        if (v && (v.type === 'api' || v.key || v.token)) authed.add(provider);
      }
    } catch {
      // 忽略不可读的 auth 文件
    }
  }
  return authed;
};

const detectEnvProviders = () => {
  const available = new Set();
  try {
    const models = JSON.parse(fs.readFileSync(MODELS_CACHE, 'utf8'));
    for (const [provider, meta] of Object.entries(models)) {
      const envs = meta && Array.isArray(meta.env) ? meta.env : [];
      if (envs.some((e) => process.env[e])) available.add(provider);
    }
  } catch {
    // models.json 不可读
  }
  return available;
};

const isMultimodalModel = (m) => {
  const id = String(m.id).toLowerCase();
  if (/vision|multimodal|omni|-vl-|-vl$|(^|-)v($|-)/.test(id)) return true;
  if (m.attachment !== true) return false;
  if (/deepseek|llama|gemma|mistral|ministral|gpt-(oss|[0-9]|-|$)|grok-|codestral|devstral/.test(id)) return false;
  return true;
};

/* 套餐计费 provider（名字含 plan/token）：标注 cost=0 但实际扣套餐额度，不比按量便宜 */
const isPlanBillingProvider = (provider) => /plan|token/i.test(provider);

const scanAvailableModels = () => {
  const authed = detectAuthedProviders();
  const envOk = detectEnvProviders();
  const available = new Set([...authed, ...envOk]);
  const result = {};
  try {
    const models = JSON.parse(fs.readFileSync(MODELS_CACHE, 'utf8'));
    for (const provider of available) {
      const meta = models[provider];
      if (!meta || !meta.models) continue;
      const plan = isPlanBillingProvider(provider);
      result[provider] = Object.values(meta.models).map((m) => ({
        id: `${provider}/${m.id}`,
        name: m.name,
        family: m.family,
        cost: m.cost,
        plan,
        context: m.limit && m.limit.context,
        multimodal: isMultimodalModel(m),
        reasoning: m.reasoning_options,
      }));
    }
  } catch {
    // 无 models.json 时返回 provider 名
    for (const provider of available) result[provider] = [];
  }
  return result;
};

/* 真实成本估算：套餐计费视作"贵"（避免被当 $0 免费选），无成本信息视作未知 */
const effectiveCost = (m) => {
  if (!m || m.plan) return 9999;
  if (m.cost && typeof m.cost.input === 'number') return m.cost.input;
  return 999;
};

/* 根据模型声明的能力计算思考强度配置（agent.options 透传给 provider） */
const reasoningConfigFor = (model) => {
  const raw = model && model.reasoning;
  if (!raw) return {};
  const opts = Array.isArray(raw) ? raw : [raw];
  const effort = opts.find((o) => o && o.type === 'effort');
  if (effort && Array.isArray(effort.values) && effort.values.length) {
    const values = effort.values;
    const rank = { low: 0, medium: 1, high: 2, max: 3 };
    const best = values
      .map((v) => ({ v, r: rank[v] !== undefined ? rank[v] : 0 }))
      .sort((a, b) => b.r - a.r)[0].v;
    return { options: { reasoningEffort: best } };
  }
  if (opts.some((o) => o && o.type === 'toggle')) {
    return { options: { reasoning: true } };
  }
  return {};
};

const findModelByAgent = (models, agentDef) => {
  const id = agentDef.model || '';
  const [provider, ...rest] = id.split('/');
  const modelId = rest.join('/');
  const list = models[provider] || [];
  return list.find((m) => m.id === id) || list.find((m) => m.id.split('/').pop() === modelId) || list[0];
};

/* Arena leaderboard 参考（2026-08 抓取 https://arena.ai/leaderboard，仅覆盖常见可用模型） */
const LEADERBOARD = {
  webdev: ['kimi-k3-max', 'qwen3.8-max', 'glm-5.2-max', 'deepseek-v4-flash-high', 'claude-opus-4-7'],
  vision: ['qwen3.8-max', 'gemini-3.6-flash', 'claude-fable-5', 'claude-opus-4-7'],
  image2web: ['kimi-k3-max', 'qwen3.8-max', 'glm-5.2-max'],
  coding: ['kimi-k3-max', 'qwen3.8-max', 'deepseek-v4-flash', 'glm-5.2-max', 'deepseek-v4-pro'],
  text: ['qwen3.8-max', 'glm-5.2-max', 'deepseek-v4-flash', 'deepseek-v4-pro'],
};

const lbScore = (modelId, domain) => {
  const short = modelId.split('/').pop().toLowerCase();
  const list = LEADERBOARD[domain] || [];
  const idx = list.findIndex((m) => short.includes(m.toLowerCase().replace(/-(high|max|thinking)$/, '')) || m.toLowerCase().includes(short));
  return idx === -1 ? 50 : idx + 1;
};

const pickModel = (models, candidates, { preference = 'balanced', domain, multimodal, usePlan = 'auto' } = {}) => {
  let pool = [];
  for (const provider of Object.keys(models)) {
    for (const m of models[provider]) pool.push(m);
  }
  if (!pool.length) return undefined;
  if (multimodal) {
    const vis = pool.filter((m) => m.multimodal);
    if (vis.length) pool = vis;
  }
  const inCandidates = pool.filter((m) => candidates.some((c) => c.split('/').pop() === m.id.split('/').pop() || m.id === c));
  if (inCandidates.length) pool = inCandidates;
  const planModels = pool.filter((m) => m.plan);
  const onDemand = pool.filter((m) => !m.plan);
  if (usePlan === 'no') {
    pool = onDemand;
  } else if (usePlan === 'yes') {
    const chosen = planModels.length
      ? [...planModels, ...onDemand]
      : onDemand;
    const costOf = (m) => (m.plan ? 0 : effectiveCost(m));
    const sortPlan = (arr) => {
      arr.sort((a, b) => {
        if (preference === 'performance') return lbScore(a.id, domain) - lbScore(b.id, domain);
        if (preference === 'cost') return costOf(a) - costOf(b);
        return lbScore(a.id, domain) + costOf(a) * 10 - (lbScore(b.id, domain) + costOf(b) * 10);
      });
    };
    sortPlan(chosen);
    return chosen[0].id;
  }
  pool.sort((a, b) => {
    if (preference === 'performance') {
      const pa = effectiveCost(a) === 9999 ? 1 : 0;
      const pb = effectiveCost(b) === 9999 ? 1 : 0;
      return pb - pa || lbScore(a.id, domain) - lbScore(b.id, domain);
    }
    if (preference === 'cost') {
      return effectiveCost(a) - effectiveCost(b);
    }
    const sa = lbScore(a.id, domain) + effectiveCost(a) * 10;
    const sb = lbScore(b.id, domain) + effectiveCost(b) * 10;
    return sa - sb;
  });
  return pool[0].id;
};

const CLUSTER_COMMON_RULES = `## 通用合规层（所有 Cluster Subagent 必须遵守，缺任何一项不得说"完成"）

### 完成清单（必须项）
- [ ] 动手前已做远程更新预检：git fetch + 查上游提交/CHANGELOG/issue，确认上游未实现/未修复才自研（已实现 → 提示用户改用上游并停止该任务块）
- [ ] 修改前已 checkpoint（git commit 或 stash）
- [ ] Build/测试通过（实际运行命令并粘贴输出）
- [ ] 原始场景复测通过（如适用）
- [ ] 调试日志已清理
- [ ] 涉及 API/架构/UI/行为变更 → 必须调用 project-docs 的 \`update_doc\`/\`create_adr\`，禁止自己乱写文档
- [ ] 方案确认后 → 必须调用 \`store-decision\`
- [ ] 任务完成后 → 必须调用 \`save-progress\`

### Memory 强制
- 阶段确认后必须调用 \`store-decision\`（记录选型理由和舍弃方案）
- 任务完成必须调用 \`save-progress\`
- 上下文将满 → 调用 \`prepare-handoff\`

### AI 服从性（shared/ai-compliance.md）
- 用户对方案说"改一下"：先停 → 更新方案 → 问确认 → 再改。跳过 = 违规
- 说"验证通过"时必须：实际执行命令（不是肉眼检查）、粘贴命令输出（至少关键行）、明确说"符合预期"或"不符合预期"
- **文件编辑禁忌（硬性）**：禁止用 PowerShell \`Set-Content\`/\`-replace\`/\`Out-File\` 修改源码文件（会破坏 UTF-8 编码导致无法编译），一律用编辑工具；损坏后无法 \`git checkout\` 恢复的文件必须整文件重写`;

const SKILL_TYPE_MAP = {
  feature: 'requirements-driven-dev',
  frontend: 'requirements-driven-dev',
  backend: 'requirements-driven-dev',
  bugfix: 'diagnose-before-fix',
  migrate: 'code-migrater',
  qa: 'diagnose-before-fix',
  docs: 'project-docs',
};

const readSkillBody = (skillsDir, name) => {
  try {
    const full = fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8');
    return stripFrontmatter(full);
  } catch {
    return null;
  }
};

const PENTEST_AGENT_PROMPT = `你是专业的渗透测试工程师（Penetration 模式）。本会话专用于 Web 安全渗透测试，按 OWASP WSTG 流程执行。**除渗透测试报告外禁止修改/创建任何文件**（不碰项目源码、.memory、目标机文件）；唯一允许的写入位置是 \`docs/penetration-reports/\`。

## 授权硬门槛
- 仅对用户拥有或已获书面授权的目标测试；用户无法确认授权时停止并要求确认。
- 仅测试授权确认的范围内目标；不做拒绝服务类测试。

## 第一步：question 确认（必须，未确认不得动手）
用 question 工具确认：
1. 测试方式：黑盒（仅 URL）/ 灰盒（有账号）/ 白盒（有源码文档）
2. 测试范围：信息收集/配置/认证/授权/会话/输入验证/业务逻辑/客户端（多选）
3. 是否允许攻击验证（可能产生日志）
4. 时间窗口限制

## 第二步：环境准备
工具优先级：
1. \`wsl-pentest\` MCP 服务器的工具：\`wsl-run\` / \`wsl-tool-check\` / \`wsl-install\` / \`wsl-nmap\` / \`wsl-sqlmap\` / \`wsl-nikto\`（宿主可能以 mcp__ 前缀注册）。后端自动适配：Windows 经 WSL，Linux 等自带 bash 的系统直接本机执行，功能一致
2. MCP 未配置时回退直接执行等价命令：Linux/macOS 本机 bash 直接跑；Windows 用 \`wsl -e bash -c "<命令>"\`
先 \`wsl-tool-check\` 检查缺失工具，经用户同意后再 \`wsl-install\` 安装。

**WSL 缺失处理（硬性流程）**：工具返回 \`code: "WSL_NOT_AVAILABLE"\` 或 bash 报 wsl 不存在时——
1. 用 question 工具向用户警告：「本机未安装/不可用 WSL，渗透工具能力将大幅受限，是否继续？」
2. 用户拒绝 → 建议安装 WSL 后再来，本次终止。
3. 用户同意继续 → 回退 pwsh 同类工具，并在报告与阶段汇报中标注「pwsh 回退执行」：

| 原 WSL 工具 | pwsh 回退 |
|------------|-----------|
| nmap 端口扫描 | \`Test-NetConnection <host> -Port <p>\` 逐端口 TCP 探测 |
| whatweb 指纹 | \`Invoke-WebRequest\` 取响应头/HTML 正则特征（Server、X-Powered-By、generator meta） |
| curl 安全头检查 | \`Invoke-WebRequest -Method Head\` 检查 HSTS/CSP/X-Frame-Options 等 |
| dirb/gobuster 目录探测 | \`Invoke-WebRequest\` 循环小字典（限速 ≤10 req/s） |
| sqlmap / nikto / hydra | **无安全等价实现，跳过该自动化项**，在报告中标注"需 WSL"，不得用 pwsh 盲测注入 |

## 第三步：按阶段执行（OWASP WSTG）
1. WSTG-INFO 信息收集：whatweb/nmap/subfinder/httpx/gobuster
2. WSTG-CONF 配置：nikto/安全响应头/目录列表/备份文件
3. WSTG-ATHN 认证：hydra 弱口令（仅灰盒/白盒且获用户同意）
4. WSTG-ATHZ 授权：隐藏路径/IDOR/路径遍历
5. WSTG-INPV 输入验证（核心）：sqlmap/XSS/SSRF/XXE
6. WSTG-SESS 会话：Cookie 属性/会话固定
7. WSTG-BUSL 业务逻辑：价格篡改/竞态
8. WSTG-CLNT 客户端：点击劫持/DOM XSS

## 第四步：攻击验证
仅对高危漏洞且用户明确允许时验证可利用性（如 sqlmap --dump）。

## 第五步：报告（唯一允许的文件写入）
将完整 Markdown 报告写到 \`docs/penetration-reports/YYYY-MM-DD-<目标slug>.md\`（项目根目录相对路径，日期取测试当日），结构：执行摘要（目标/方式/时间）→ 风险摘要表（严重/高危/中危/低危计数）→ 漏洞详情（位置/Payload/证据/CVSS/影响/**建议解决方案**）→ 工具使用记录表 → 修复优先级。每个漏洞必须给出**建议解决方案**：具体可执行的修复措施（配置修改步骤/代码级修复方向/需升级的依赖及目标版本），不许只写"建议加固"。每条结论必须附带真实工具输出的关键行作为证据，没有证据的项标注"未验证"；回退 pwsh 执行的阶段要注明。回复中输出报告路径 + 风险摘要 + 高危漏洞要点及其建议解决方案。

## 技术注意
- 大规模扫描可能触发 WAF/IDS，建议低峰时段；控制并发与速率。
- 每个阶段结束简要汇报发现，再进入下一阶段。`;

const buildClusterAgents = (models, skillsDir) => {
  const available = Object.keys(models);  const anyModel = () => (available.length ? `${available[0]}/${models[available[0]][0].id.split('/')[1]}` : undefined);

  const makeAgent = (def) => {
    const agent = { ...def };
    if (!agent.model) agent.model = anyModel();
    const model = findModelByAgent(models, agent);
    const reasoning = reasoningConfigFor(model);
    if (reasoning.options) agent.options = { ...(agent.options || {}), ...reasoning.options };
    const common = [
      '你是 junsi-dev-toolkit 的 Cluster 专精 Subagent。',
      `本任务类型对应子技能：\`${SKILL_TYPE_MAP[def.type || 'feature']}\`（派发时主控会注入其 SKILL.md 全文，必须严格遵守其流程）。`,
      '',
      CLUSTER_COMMON_RULES,
    ].join('\n');
    agent.prompt = common;
    return agent;
  };

  const agents = {};

  agents['cluster'] = makeAgent({
    type: 'feature',
    description: 'Cluster 模式主控：总体规划、细化需求、任务分块，派发给专精模型 Subagent 并行执行',
    mode: 'primary',
    model: pickModel(models, ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro', 'zhipuai/glm-5.2']) || anyModel(),
    temperature: 0.2,
    permission: {
      edit: 'allow',
      bash: 'allow',
      task: { '*': 'deny', 'cluster-*': 'allow' },
    },
  });

  agents['cluster-planner'] = makeAgent({
    type: 'feature',
    description: 'Cluster 规划 Subagent：需求细化、任务拆分、技术方案设计（规划专精模型）',
    mode: 'subagent',
    model: pickModel(models, ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro', 'zhipuai/glm-5.2']) || anyModel(),
    temperature: 0.1,
    permission: { edit: 'deny', bash: 'deny' },
  });

  agents['cluster-frontend'] = makeAgent({
    type: 'frontend',
    description: 'Cluster 前端 Subagent：TS/React/Vue 等前端实现（前端专精模型，支持看图）',
    mode: 'subagent',
    model: pickModel(models, ['moonshotai/kimi-k3', 'zhipuai/glm-5v-turbo', 'zhipuai/glm-4.6v', 'deepseek/deepseek-v4-flash'], {
      domain: 'webdev',
      multimodal: true,
    }) || anyModel(),
    temperature: 0.2,
    permission: { edit: 'allow', bash: 'allow' },
  });

  agents['cluster-backend'] = makeAgent({
    type: 'backend',
    description: 'Cluster 后端 Subagent：API/数据库/服务端实现（后端专精模型）',
    mode: 'subagent',
    model: pickModel(models, ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro', 'zhipuai/glm-5.2'], {
      domain: 'coding',
    }) || anyModel(),
    temperature: 0.2,
    permission: { edit: 'allow', bash: 'allow' },
  });

  agents['cluster-qa'] = makeAgent({
    type: 'qa',
    description: 'Cluster 测试 Subagent：测试用例、构建验证、回归（测试专精模型）',
    mode: 'subagent',
    model: pickModel(models, ['zhipuai/glm-5.2', 'deepseek/deepseek-v4-flash'], { domain: 'coding' }) || anyModel(),
    temperature: 0.1,
    permission: { edit: 'allow', bash: 'allow' },
  });

  agents['cluster-docs'] = makeAgent({
    type: 'docs',
    description: 'Cluster 文档 Subagent：ADR/README/API 文档撰写（文档专精模型）',
    mode: 'subagent',
    model: pickModel(models, ['zhipuai/glm-5.2', 'deepseek/deepseek-v4-flash'], { domain: 'text' }) || anyModel(),
    temperature: 0.3,
    permission: { edit: 'allow', bash: 'deny' },
  });

  agents['penetration'] = {
    description: 'Penetration 渗透测试模式：OWASP WSTG 流程 + WSL 工具（wsl-pentest MCP），报告写入 docs/penetration-reports/',
    mode: 'primary',
    model: pickModel(models, ['deepseek/deepseek-v4-flash', 'zhipuai/glm-5.2'], { domain: 'coding' }) || anyModel(),
    temperature: 0.2,
    permission: { edit: 'allow', bash: 'allow' },
    prompt: PENTEST_AGENT_PROMPT,
  };

  return agents;
};

const registerClusterTools = async (tools, skillsDir) => {
  let tool;
  try {
    ({ tool } = await import('@opencode-ai/plugin'));
  } catch (e) {
    return { ok: false, error: `@opencode-ai/plugin 不可用，跳过 cluster 工具: ${e.message}` };
  }
  const schema = tool.schema;

  tools['cluster-task-prompt'] = tool({
    description:
      '生成 Cluster Subagent 的完整派发 prompt：任务描述 + 验收标准 + 通用合规层（memory/docs/完成清单/ai-compliance）+ 任务类型对应的子技能 SKILL.md 全文。派发 Subagent 前必须调用本工具。',
    args: {
      type: schema
        .enum(['feature', 'frontend', 'backend', 'bugfix', 'migrate', 'qa', 'docs'])
        .describe('任务类型：feature/frontend/backend=新功能开发(RDD)；bugfix=Bug修复(diagnose)；migrate=代码移植；qa=测试验证；docs=文档'),
      task: schema.string().describe('任务块描述'),
      acceptance: schema.string().optional().describe('验收标准'),
      files: schema.string().optional().describe('输入/输出文件'),
      constraints: schema.string().optional().describe('约束'),
    },
    async execute(args, _context) {
      const skillName = SKILL_TYPE_MAP[args.type] || 'requirements-driven-dev';
      const skillBody = readSkillBody(skillsDir, skillName);
      const lines = [
        '# Cluster 任务派发',
        '',
        `## 任务块`,
        args.task,
        '',
        ...(args.acceptance ? [`## 验收标准`, args.acceptance, ''] : []),
        ...(args.files ? [`## 输入/输出文件`, args.files, ''] : []),
        ...(args.constraints ? [`## 约束`, args.constraints, ''] : []),
        '',
        '## 通用合规层（必须遵守，缺任何一项不得说"完成"）',
        '',
        CLUSTER_COMMON_RULES,
        '',
        `## 任务类型子技能全文（${skillName}，必须严格遵守其流程）`,
        '',
        skillBody || `（子技能 ${skillName} 读取失败，仍须遵守上方通用合规层）`,
      ];
      return lines.join('\n');
    },
  });

  tools['cluster-scan-models'] = tool({
    description:
      '扫描本机实际可用的 LLM provider 和模型（auth.json + 环境变量），标注多模态（✅ 可看图）与成本。Cluster 模式在分配任务块前必须调用，推荐模型只能从结果中选择。',
    args: {},
    async execute(_args, _context) {
      const models = scanAvailableModels();
      const lines = ['## 本机可用模型', '', '> ✅ = 多模态（可识图，前端/UI 校验用）｜ 单位 $/百万 token ｜ 思考: effort档位或 on/off ｜ ⚠️套餐 = 套餐计费（标注 $0 但扣套餐额度）', ''];
      for (const [provider, modelList] of Object.entries(models)) {
        const planTag = isPlanBillingProvider(provider) ? ' ⚠️套餐' : '';
        lines.push(`### ${provider}（${modelList.length} 个模型）${planTag}`);
        if (!modelList.length) {
          lines.push('（已认证但模型清单不可读）');
          continue;
        }
        for (const m of modelList) {
          const cost = m.plan ? '套餐' : m.cost ? `$${m.cost.input}/$${m.cost.output}` : '?';
          const ctx = m.context ? `${(m.context / 1000).toFixed(0)}K` : '?';
          const vis = m.multimodal ? ' ✅' : '';
          const rc = reasoningConfigFor(m);
          const ro = rc.options || {};
          const reasoning = ro.reasoningEffort ? `，思考:${ro.reasoningEffort}` : ro.reasoning === true ? '，思考:on' : '';
          lines.push(`- \`${m.id}\` — ${m.name}（${m.family || '?'}，ctx ${ctx}，${cost}${reasoning}）${vis}`);
        }
        lines.push('');
      }
      if (!Object.keys(models).length) lines.push('（未检测到任何可用 provider，请先配置 API key）');
      return lines.join('\n');
    },
  });

  tools['cluster-allocation'] = tool({
    description:
      'Cluster 模式：根据本机可用模型和用户倾向（性价比/性能/平衡 + 是否使用套餐额度）生成任务块 → 专精模型分配方案。分配前必须先调用 cluster-scan-models；前端/看图任务自动优先多模态模型；必须用 question 工具问用户偏好与套餐选择并确认。',
    args: {
      tasks: schema
        .string()
        .describe('任务块描述（JSON 数组），如 [{"name":"登录页","type":"frontend"},{"name":"用户API","type":"backend"}]'),
      preference: schema
        .enum(['cost', 'performance', 'balanced'])
        .optional()
        .describe('用户倾向：cost=性价比优先(省钱) / performance=性能优先(贵但强) / balanced=平衡（默认）'),
      usePlan: schema
        .enum(['auto', 'yes', 'no'])
        .optional()
        .describe('是否使用套餐计费模型（如 zhipuai-coding-plan，标注 $0 但扣套餐额度）：auto=需逐项询问用户是否用各套餐（默认）/ yes=用户同意用套餐 / no=用户拒绝，只用按量'),
    },
    async execute(args, _context) {
      const models = scanAvailableModels();
      const preference = args.preference || 'balanced';
      const usePlan = args.usePlan || 'auto';
      const domainOf = (type) => {
        if (type === 'frontend') return 'webdev';
        if (type === 'qa') return 'coding';
        if (type === 'planner') return 'text';
        return 'coding';
      };
      const preferred = {
        planner: ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro', 'zhipuai/glm-5.2'],
        frontend: ['moonshotai/kimi-k3', 'zhipuai/glm-4.6v', 'zhipuai/glm-5v-turbo', 'deepseek/deepseek-v4-flash'],
        backend: ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro', 'zhipuai/glm-5.2'],
        qa: ['zhipuai/glm-5.2', 'deepseek/deepseek-v4-flash'],
        docs: ['zhipuai/glm-5.2', 'deepseek/deepseek-v4-flash'],
      };
      const needsVision = (type, name) =>
        type === 'frontend' || /截图|看图|页面|界面|ui|视觉|样式|布局/i.test(name || '');
      let tasks;
      try {
        tasks = JSON.parse(args.tasks);
      } catch {
        tasks = args.tasks
          .split(',')
          .filter(Boolean)
          .map((s) => ({ name: s.trim() }));
      }
      const prefLabel = { cost: '💰 性价比优先', performance: '🚀 性能优先', balanced: '⚖️ 平衡' }[preference];
      const planProviders = Object.keys(models).filter((p) => isPlanBillingProvider(p) && models[p].length);
      const planLabel =
        usePlan === 'yes'
          ? `✅ 用套餐（${planProviders.join('、')}）`
          : usePlan === 'no'
            ? '🚫 不用套餐，只按量计费'
            : '❓ 待询问用户是否用套餐';
      const lines = [
        '## Cluster 模型分配方案',
        '',
        `**用户倾向：${prefLabel}**（用户可手动调整）｜ **套餐额度：${planLabel}**`,
        '',
        '| 任务块 | 类型 | 需多模态 | 推荐模型 | 思考强度 | Subagent | 成本(入/出 per M) |',
        '|--------|------|---------|---------|---------|----------|------------------|',
      ];
      const pickOne = (cands, type, visionNeeded) => pickModel(models, cands, { preference, domain: domainOf(type), multimodal: visionNeeded, usePlan });
      const priceOf = (id) => {
        const [p] = id.split('/');
        const m = models[p] && models[p].find((x) => x.id === id);
        if (!m) return '?';
        if (m.plan) return '⚠️套餐';
        return m.cost && m.cost.input ? `$${m.cost.input}/${m.cost.output || '?'}` : '?';
      };
      const reasoningOf = (id) => {
        const [p] = id.split('/');
        const m = models[p] && models[p].find((x) => x.id === id);
        const cfg = reasoningConfigFor(m);
        const opt = cfg.options || {};
        if (opt.reasoningEffort) return `effort:${opt.reasoningEffort}`;
        if (opt.reasoning === true) return 'on';
        return '—';
      };
      for (const t of tasks) {
        const type = t.type || (t.name.includes('测试') || t.name.includes('验证') ? 'qa' : t.name.includes('文档') ? 'docs' : t.name.includes('方案') || t.name.includes('规划') ? 'planner' : 'frontend');
        const visionNeeded = needsVision(type, t.name);
        const agentName = `cluster-${type}`;
        const modelId = pickOne(preferred[type] || preferred.frontend, type, visionNeeded);
        lines.push(`| ${t.name} | ${type} | ${visionNeeded ? '✅' : '—'} | \`${modelId || '未检测到可用模型'}\` | ${reasoningOf(modelId) || '—'} | \`${agentName}\` | ${priceOf(modelId) || '?'} |`);
      }
      if (planProviders.length && usePlan === 'auto') {
        lines.push(
          '',
          '## ⚠️ 检测到套餐计费 provider，必须先询问用户',
          `本机可用套餐：\`${planProviders.join('、')}\`（标注 $0 但扣套餐额度；套餐开销与按量比例相当，不是免费）`,
          '用 question 工具逐项询问用户是否使用这些套餐内的模型，例如：',
          `- "是否使用 \`${planProviders[0]}\` 内的模型？"（✅ 使用 / 🚫 不用，只按量计费）`,
          ...(planProviders.length > 1
            ? planProviders.slice(1).map((p) => `- "是否使用 \`${p}\` 内的模型？"（✅ 使用 / 🚫 不用）`)
            : []),
          '用户选择后：同意 → 重新调用本工具传 \`usePlan: "yes"\`；全部拒绝 → 传 \`usePlan: "no"\`。',
          '用户回答前不得派发 Subagent。',
          ''
        );
      }
      lines.push('', '**必须用 question 工具向用户确认此分配方案（或让用户手动指定模型）后再派发 Subagent。**');
      lines.push('', '> 推荐依据：https://arena.ai/leaderboard（WebDev/Image-to-WebDev/Vision/Coding 分榜）。多模态任务必须选 ✅ 模型（能识图确认前端效果）。思考强度按模型能力自动设置（effort 档位或 on/off）。');
      return lines.join('\n');
    },
  });

  return { ok: true };
};

/* ---------- 实用工具：tool-search + cron-create ---------- */

const TOOL_INDEX = [
  { id: 'bash', use: '执行终端命令（构建/测试/git/安装）' },
  { id: 'read/write/edit/apply_patch', use: '读写与修改文件' },
  { id: 'grep/glob', use: '内容正则搜索 / 文件名模式搜索' },
  { id: 'webfetch/websearch', use: '抓取网页 / 网络搜索' },
  { id: 'question', use: '向用户提问澄清需求或确认方案' },
  { id: 'todowrite', use: '多步骤任务待办清单' },
  { id: 'task', use: '派发子代理（独立子任务）' },
  { id: 'skill', use: '加载技能（SKILL.md 工作流）' },
  { id: 'store-decision', use: '阶段确认后记录决策' },
  { id: 'save-progress', use: '任务完成保存进度' },
  { id: 'prepare-handoff/restore-handoff', use: '跨会话恢复（换会话时）' },
  { id: 'list-decisions/memory-doctor/save-preference', use: '决策回顾/记忆体检/全局偏好' },
  { id: 'cluster-task-prompt/cluster-scan-models/cluster-allocation', use: 'Cluster 多模型并行开发' },
  { id: 'tool-search', use: '本工具：按关键词找最合适的工具' },
  { id: 'cron-create', use: '创建/列出/删除 Windows 计划任务' },
  { id: 'MCP project-docs_*', use: '项目文档/代码感知（架构/API/组件/路由）' },
  { id: 'MCP glm-vision_*', use: '图片理解/OCR（视觉分析）' },
];

const registerUtilityTools = async (tools) => {
  let tool;
  try {
    ({ tool } = await import('@opencode-ai/plugin'));
  } catch (e) {
    return { ok: false, error: `@opencode-ai/plugin 不可用，跳过实用工具: ${e.message}` };
  }
  const schema = tool.schema;

  tools['tool-search'] = tool({
    description: '按关键词在工具索引中模糊检索，返回最合适工具 + 使用时机。当不知道用哪个工具完成任务时调用。',
    args: { keyword: schema.string().describe('任务描述或关键词，如"搜索文件""保存进度"') },
    async execute(args) {
      const kw = (args.keyword || '').trim().toLowerCase();
      const all = TOOL_INDEX.map((t) => `- \`${t.id}\`：${t.use}`).join('\n');
      if (!kw) return `## 工具索引\n\n${all}`;
      const hits = TOOL_INDEX.filter((t) => `${t.id} ${t.use}`.toLowerCase().includes(kw));
      return hits.length
        ? `## 匹配工具（${kw}）\n\n${hits.map((t) => `- \`${t.id}\`：${t.use}`).join('\n')}`
        : `无匹配工具（关键词：${kw}）。\n\n## 工具索引\n\n${all}`;
    },
  });

  tools['cron-create'] = tool({
    description: '创建/列出/删除 Windows 计划任务（schtasks 封装）。用户说"定时提醒/每天执行/定时任务"时调用。',
    args: {
      action: schema.enum(['create', 'list', 'delete']).describe('操作：create=创建 / list=列出 / delete=删除'),
      taskName: schema.string().optional().describe('任务名（create/delete 必填）'),
      command: schema.string().optional().describe('要执行的命令（create 必填），如 "node D:\\task.js"'),
      schedule: schema.string().optional().describe('触发计划（create 必填）："频次 时间"，如 "DAILY 09:00" / "ONCE 14:30"'),
      startDate: schema.string().optional().describe('开始日期 YYYY/MM/DD（默认今天）'),
    },
    async execute(args) {
      const { execFileSync } = await import('child_process');
      const { TextDecoder } = await import('util');
      const gbk = new TextDecoder('gbk', { fatal: false });
      const run = (argList) => {
        try {
          const buf = execFileSync('schtasks.exe', argList, { encoding: 'buffer', windowsHide: true });
          return gbk.decode(buf).trim();
        } catch (e) {
          return `执行失败: ${e.message}`;
        }
      };
      if (args.action === 'list') {
        const out = run(['/Query', '/FO', 'LIST', '/V']);
        const lines = out.split(/\r?\n/).filter((l) => /任务名|TaskName|状态|Status|下次运行时间|Next Run Time/i.test(l));
        return lines.length ? lines.join('\n') : out;
      }
      if (args.action === 'delete') {
        if (!args.taskName) return 'delete 需要 taskName';
        return run(['/Delete', '/TN', args.taskName, '/F']);
      }
      if (!args.taskName || !args.command) return 'create 需要 taskName 与 command';
      const [freq, time] = (args.schedule || 'DAILY 09:00').split(/\s+/);
      const argList = ['/Create', '/TN', args.taskName, '/TR', args.command, '/SC', freq, '/ST', time];
      if (args.startDate) argList.push('/SD', args.startDate);
      return run(argList);
    },
  });

  return { ok: true };
};

export const JunsiDevToolkitPlugin = async ({ client, directory }) => {
  const skillsDir = path.resolve(__dirname, '../../.agents/skills/junsi-dev-toolkit');
  const tools = {};
  const toolState = await registerMemoryTools(tools);
  if (!toolState.ok) {
    client.app.log({ service: 'junsi-dev-toolkit', level: 'warn', message: toolState.error });
  }
  const clusterState = await registerClusterTools(tools, skillsDir);
  if (!clusterState.ok) {
    client.app.log({ service: 'junsi-dev-toolkit', level: 'warn', message: clusterState.error });
  }
  const utilityState = await registerUtilityTools(tools);
  if (!utilityState.ok) {
    client.app.log({ service: 'junsi-dev-toolkit', level: 'warn', message: utilityState.error });
  }

  return {
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir);
      }
      config.agent = config.agent || {};
      const clusterAgents = buildClusterAgents(scanAvailableModels(), skillsDir);
      for (const [name, def] of Object.entries(clusterAgents)) {
        if (!config.agent[name]) {
          config.agent[name] = def;
        }
      }
    },

    tool: tools,

    'experimental.chat.messages.transform': async (_input, output) => {
      if (!output.messages || !output.messages.length) return;
      const lastUser = getLastUserMessage(output.messages);
      if (!lastUser || !Array.isArray(lastUser.parts)) return;
      if (hasInjection(lastUser.parts)) return;

      const isFirstUserMessage = output.messages.indexOf(lastUser) <= 1;
      const userText = getText(lastUser.parts).toLowerCase();
      const wantsToolkit = userText.includes('junsi-dev-toolkit') || userText.includes('junsi-dev-tools');
      const route = matchRoute(userText);
      const injections = [];

      if (wantsToolkit) {
        injections.push(buildFullRoutingTable());
      } else if (route) {
        injections.push(buildRouteInjection(route, skillsDir));
      }

      if (isFirstUserMessage) {
        const upref = readOrEmpty(path.join(userMemoryDir(), 'preferences.md'));
        if (upref.trim()) {
          injections.push([
            '# junsi-dev-toolkit：全局用户记忆',
            '以下为跨项目全局偏好（~/.config/opencode/.memory/preferences.md），开工前必须遵守：',
            '',
            upref.slice(0, MEMORY_LIMITS.compactPreference),
            INJECT_MARK,
          ].join('\n'));
        }
        if (fs.existsSync(path.join(memoryDir(directory), 'HANDOFF.md'))) {
          injections.push([
            '# junsi-dev-toolkit：检测到 HANDOFF',
            `存在 \`.memory/HANDOFF.md\`（${new Date(fs.statSync(path.join(memoryDir(directory), 'HANDOFF.md')).mtime).toLocaleString()}）`,
            '1. 调用 `restore-handoff` 工具读取完整恢复包',
            '2. 按恢复包继续任务，不要重新扫描项目',
            INJECT_MARK,
          ].join('\n'));
        }
      }

      if (injections.length) {
        const ref = lastUser.parts[0];
        const texts = injections.reverse();
        for (const text of texts) {
          lastUser.parts.unshift({ ...ref, type: 'text', text });
        }
      }
    },

    'experimental.session.compacting': async (_input, output) => {
      try {
        const parts = ['## junsi-dev-toolkit 记忆上下文'];
        const up = readOrEmpty(path.join(userMemoryDir(), 'preferences.md'));
        if (up.trim()) {
          parts.push('', '### 全局用户偏好（跨项目生效）', up.slice(0, MEMORY_LIMITS.compactPreference));
        }
        const mem = memoryDir(directory);
        if (!fs.existsSync(mem)) {
          if (parts.length > 1) output.context.push(parts.join('\n'));
          return;
        }
        const idx = readOrEmpty(path.join(mem, 'INDEX.md'));
        if (idx) parts.push('', '### 任务索引', idx.slice(0, MEMORY_LIMITS.compactIndex));
        const recent = listRecentDecisions(mem, MEMORY_LIMITS.compactDecision);
        if (recent.length) {
          const cards = recent
            .map((f) => {
              const c = readOrEmpty(path.join(mem, 'decisions', f));
              return `- **${readDecisionTitle(c, f)}**（${f.slice(0, 10)}）\n${c.split('\n').filter((l) => l.trim()).slice(1, 6).join('\n')}`;
            })
            .join('\n---\n');
          parts.push('', '### 关键决策画像（最近 ' + recent.length + ' 条，需决策依据时读取全文）', cards);
        }
        const gDecDir = path.join(userMemoryDir(), 'decisions');
        if (fs.existsSync(gDecDir)) {
          const gRecent = fs.readdirSync(gDecDir).filter((f) => f.endsWith('.md')).sort().reverse().slice(0, MEMORY_LIMITS.compactDecision);
          if (gRecent.length) {
            const cards = gRecent
              .map((f) => {
                const c = readOrEmpty(path.join(gDecDir, f));
                return `- 🌐 **${readDecisionTitle(c, f)}**（${f.slice(0, 10)}）\n${c.split('\n').filter((l) => l.trim()).slice(1, 5).join('\n')}`;
              })
              .join('\n---\n');
            parts.push('', '### 全局决策画像（跨项目，最近 ' + gRecent.length + ' 条）', cards);
          }
        }
        const handoff = readOrEmpty(path.join(mem, 'HANDOFF.md'));
        if (handoff) parts.push('', '### HANDOFF（自包含恢复包，前 ' + MEMORY_LIMITS.compactHandoff + ' 字）', handoff.slice(0, MEMORY_LIMITS.compactHandoff));
        output.context.push(parts.join('\n'));
      } catch {
        // 压缩注入失败不阻塞
      }
    },

    event: async ({ event }) => {
      if (!event || event.type !== 'session.idle') return;
      try {
        const mem = ensureMemoryDir(directory);
        const recent = listRecentDecisions(mem, 3);
        const progress = readOrEmpty(path.join(mem, 'progress', 'current.md'));
        const handoff = fs.existsSync(path.join(mem, 'HANDOFF.md'));
        const sessionFile = path.join(mem, 'sessions', `${timestamp()}.md`);
        fs.writeFileSync(
          sessionFile,
          [
            '# 会话痕迹',
            `- 时间：${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
            `- 类型：session.idle 自动记录`,
            `- 决策：${decisionFiles(mem).length} 条`,
            `- HANDOFF：${handoff ? '就绪' : '无'}`,
            '',
            '## 进度摘要',
            progress ? progress.split('\n').slice(0, 8).join('\n') : '（无）',
            '',
            '## 决策摘要',
            recent.length ? recent.map((f) => `- ${readDecisionTitle(readOrEmpty(path.join(mem, 'decisions', f)), f)}`).join('\n') : '（无）',
            '',
          ].join('\n'),
          'utf8'
        );
      } catch {
        // idle 记录失败不阻塞
      }
    },
  };
};

