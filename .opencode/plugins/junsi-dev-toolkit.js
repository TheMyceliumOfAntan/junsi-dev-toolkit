/**
 * junsi-dev-toolkit plugin for OpenCode.ai (v2.2)
 *
 * - 代码级意图路由：关键词正则匹配用户消息，命中 → 注入**对应子技能 SKILL.md 全文** + 强制路由宣告
 * - 未匹配到开发意图（纯问答）→ 零注入（省 token）
 * - 新会话检测 .memory/HANDOFF.md → 注入恢复指令
 * - memory 自定义工具：store-decision / save-progress / prepare-handoff / restore-handoff
 * - Cluster 模式：config hook 注入 cluster 主 agent + 5 个专精 subagent（模型按本机可用性动态降级）
 *   + cluster-scan-models / cluster-allocation 工具（动态检测 + 分配方案，需用户确认）
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
    keywords: ['移植', '迁移', 'migrate', 'port', '跨语言', '跨框架', '翻译成'],
  },
  {
    id: 'diagnose-before-fix',
    priority: 4,
    skillPath: '.agents/skills/junsi-dev-toolkit/diagnose-before-fix/SKILL.md',
    summary: 'Bug 修复 8 步：理解 → 枚举原因 → 问方向 → 修复 → Build 验证 → 原始复测',
    keywords: ['报错', '不对', '不工作', '返回错误', '空列表', '崩溃', '白屏', 'bug', '异常', '闪退'],
  },
  {
    id: 'memory-skill',
    priority: 3,
    skillPath: '.agents/skills/junsi-dev-toolkit/memory-skill/SKILL.md',
    summary: '决策记忆 / 进度保存 / HANDOFF 跨会话恢复（.memory/ 目录）',
    keywords: ['记住', '记录', '记一下', '决策', '保存进度', '换会话', '降智', '上下文不够', '恢复进度'],
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
    '  3. 涉及 API/架构/UI/行为变更 → 必须调用 project-docs 的 `update_doc`/`create_adr`，不得自己乱写文档',
    '  4. 阶段确认后 → 必须调用 `store-decision`',
    '  5. 任务完成 → 必须调用 `save-progress`',
    '  6. 缺任何一项不得说"完成"',
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

const memoryDir = (projectDir) => path.join(projectDir, '.memory');
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
  fs.mkdirSync(path.join(mem, 'sessions'), { recursive: true });
  return mem;
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

const writeIndex = (mem, summaryLines) => {
  const lines = [
    '# 任务索引',
    '',
    `> 自动维护：${new Date().toISOString().slice(0, 10)}`,
    '',
    ...summaryLines,
  ];
  fs.writeFileSync(path.join(mem, 'INDEX.md'), lines.join('\n'), 'utf8');
};

const loadIndexSummary = (mem) => {
  const progress = readOrEmpty(path.join(mem, 'progress', 'current.md'));
  const decisionCount = fs.existsSync(path.join(mem, 'decisions'))
    ? fs.readdirSync(path.join(mem, 'decisions')).filter((f) => f.endsWith('.md')).length
    : 0;
  const first = progress.split('\n').slice(0, 8).join('\n');
  return `## 当前进度\n${first || '（无）'}\n\n## 决策记录\n${decisionCount} 条`;
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
      '记录一条关键决策到项目 .memory/decisions/。当用户说"记住/记录/记一下/方案确认/决策"时调用，或子技能在阶段确认后自动调用。',
    args: {
      title: schema.string().describe('决策标题'),
      scenario: schema.string().describe('场景/上下文'),
      decision: schema.string().describe('选了什么方案，为什么不选其他'),
      impact: schema.string().optional().describe('影响范围（文件/模块）'),
    },
    async execute(args, context) {
      const mem = ensureMemoryDir(context.directory);
      ensureGitignore(context.directory);
      const file = path.join(mem, 'decisions', `${timestamp()}-${slugify(args.title)}.md`);
      const content = [
        '## 决策记录：' + args.title,
        '- 日期：' + new Date().toISOString().slice(0, 10),
        '- 场景：' + args.scenario,
        '- 方案：' + args.decision,
        ...(args.impact ? ['- 影响范围：' + args.impact] : []),
        '',
      ].join('\n');
      fs.writeFileSync(file, content, 'utf8');
      return `已记录决策: ${file}`;
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
      writeIndex(mem, [`- **当前任务**：${args.task}（${args.stage}）`, `- 进度文件：\`progress/current.md\``]);
      return `进度已保存: ${file}`;
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
        '> 新会话自动检测本文件并注入恢复指令。完成后更新或删除。',
        '',
      ].join('\n');
      fs.writeFileSync(file, content, 'utf8');
      writeIndex(mem, [`- **HANDOFF 就绪**：${args.task}`]);
      return `HANDOFF 已生成: ${file}`;
    },
  });

  tools['restore-handoff'] = tool({
    description:
      '读取 .memory/HANDOFF.md 恢复跨会话状态。新会话检测到 HANDOFF 时由路由层自动调用；用户说"恢复进度/接着上次做"时也可调用。',
    args: {},
    async execute(_args, context) {
      const content = readOrEmpty(path.join(memoryDir(context.directory), 'HANDOFF.md'));
      if (!content) return '未找到 .memory/HANDOFF.md，无待恢复任务。';
      return `HANDOFF.md 内容如下，直接恢复工作状态（无需重新读代码/查结构）：\n\n${content}`;
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

      if (isFirstUserMessage && fs.existsSync(path.join(memoryDir(directory), 'HANDOFF.md'))) {
        injections.push([
          '# junsi-dev-toolkit：检测到 HANDOFF',
          `存在 \`.memory/HANDOFF.md\`（${new Date(fs.statSync(path.join(memoryDir(directory), 'HANDOFF.md')).mtime).toLocaleString()}）`,
          '1. 调用 `restore-handoff` 工具读取完整恢复包',
          '2. 按恢复包继续任务，不要重新扫描项目',
          INJECT_MARK,
        ].join('\n'));
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
        const mem = memoryDir(directory);
        if (!fs.existsSync(mem)) return;
        const summary = loadIndexSummary(mem);
        const handoff = readOrEmpty(path.join(mem, 'HANDOFF.md'));
        const parts = ['## junsi-dev-toolkit 记忆上下文', summary];
        if (handoff) {
          parts.push('', '### HANDOFF（自包含恢复包）', handoff.slice(0, 1500));
        }
        output.context.push(parts.join('\n'));
      } catch {
        // 压缩注入失败不阻塞
      }
    },

    event: async ({ event }) => {
      if (!event || event.type !== 'session.idle') return;
      try {
        const mem = ensureMemoryDir(directory);
        const sessionFile = path.join(mem, 'sessions', `${timestamp()}.md`);
        if (!fs.existsSync(sessionFile)) {
          fs.writeFileSync(
            sessionFile,
            ['# 会话痕迹', `- 时间：${new Date().toISOString()}`, '- 类型：session.idle 自动记录', ''].join('\n'),
            'utf8'
          );
        }
      } catch {
        // idle 记录失败不阻塞
      }
    },
  };
};

