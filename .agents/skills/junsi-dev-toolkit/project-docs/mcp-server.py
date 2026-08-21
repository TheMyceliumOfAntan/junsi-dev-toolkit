#!/usr/bin/env python3
"""
project-docs MCP Server
项目知识中枢 + 代码感知工具集 — 不仅管文档，还帮你读懂实际项目。
"""

import json
import os
import re
import sys
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.types import Tool, TextContent, Resource, ResourceContents, TextResourceContents
from pydantic import AnyUrl

# ── 项目根检测 ──────────────────────────────────────────────
def detect_project_root() -> Path:
    """从当前目录向上找，直到发现项目标记文件"""
    cwd = Path(os.getcwd()).resolve()
    markers = ["package.json", "AGENTS.md", ".git"]
    for p in [cwd] + list(cwd.parents):
        if any((p / m).exists() for m in markers):
            return p
    return cwd

PROJECT_ROOT = detect_project_root()
DOCS_ROOT = PROJECT_ROOT / "docs" / "junsi-dev-docs"
DOCS_ROOT.mkdir(parents=True, exist_ok=True)

CATEGORIES = {
    "1-决策记录": "ADR 架构决策记录",
    "2-架构设计": "系统架构、模块设计",
    "3-API规范": "RESTful API 设计规范",
    "4-编码规范": "各语言编码规范",
    "5-数据库设计": "表结构、ER 图",
    "6-UI/组件设计": "UI 控件、组件设计规范",
    "7-调用规范": "服务间调用、异常处理、日志规范",
    "8-部署运维": "部署架构、环境配置",
    "9-系统要求": "功能需求、非功能需求",
}

app = Server("project-docs")

# ── 辅助函数 ────────────────────────────────────────────────

def read_file(path: Path) -> str:
    try: return path.read_text("utf-8")
    except Exception: return ""

def write_file(path: Path, content: str) -> bool:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, "utf-8")
        return True
    except Exception: return False

def glob_files(root: Path, pattern: str) -> List[Path]:
    return list(root.rglob(pattern))

def safe_relative(path: Path, base: Path = PROJECT_ROOT) -> str:
    try: return str(path.relative_to(base)).replace("\\", "/")
    except ValueError: return str(path)

SZ = 500  # 单工具最大返回字符数（防止撑爆上下文）

def trunc(text: str, max_chars: int = SZ) -> str:
    return text if len(text) <= max_chars else text[:max_chars] + "\n... (truncated)"

# ── 语言/层识别 ─────────────────────────────────────────────

_LANG_MAP = {
    '.cs': 'C#', '.rs': 'Rust', '.ts': 'TS', '.tsx': 'TSX',
    '.js': 'JS', '.mjs': 'JS', '.cjs': 'JS',
    '.py': 'Python', '.csproj': 'C#', '.sln': 'C#',
    '.json': 'JSON', '.toml': 'TOML', '.yaml': 'YAML', '.yml': 'YAML',
    '.css': 'CSS', '.html': 'HTML', '.xml': 'XML',
    '.md': 'Markdown',
}

def file_lang(path: str) -> str:
    ext = Path(path).suffix.lower()
    return _LANG_MAP.get(ext, '')

def file_layer(path: str) -> str:
    """判断属于哪个项目层（按优先级：Tauri > Backend > Frontend > Docs）"""
    p = path.replace('\\', '/')
    if '/src-tauri/' in p: return 'Tauri(Rust)'
    if '/src-backend/' in p: return 'Backend(C#)'
    if '/src/' in p: return 'Frontend(TS)'
    if '/docs/' in p: return 'Docs'
    return ''

def tag(path: str) -> str:
    """给文件路径加上语言标签"""
    lang = file_lang(path)
    layer = file_layer(path)
    tags = ' '.join(filter(None, [f'[{lang}]' if lang else '', layer]))
    return f"{tags} {path}" if tags else path

# ── 文档工具（原） ─────────────────────────────────────────

def search_docs(keywords: str, category: Optional[str] = None) -> List[Dict[str, str]]:
    results = []
    terms = [k.strip().lower() for k in keywords.split(",") if k.strip()]
    base = DOCS_ROOT / category if category else DOCS_ROOT
    for fp in base.glob("**/*.md"):
        if fp.name == "README.md": continue
        content = read_file(fp)
        if not content: continue
        cl = content.lower()
        if all(t in cl for t in terms):
            title = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
            results.append({
                "path": safe_relative(fp, DOCS_ROOT),
                "title": title.group(1) if title else fp.stem,
                "summary": content[:200].replace("\n", " ") + "..."
            })
    return results[:10]

def create_adr_file(title: str, background: str, decision: str,
                    alternatives: Optional[List[Dict]] = None,
                    impacts: Optional[List[str]] = None) -> str:
    adr_dir = DOCS_ROOT / "1-决策记录"
    adr_dir.mkdir(parents=True, exist_ok=True)
    max_n = 0
    for f in adr_dir.glob("ADR-*.md"):
        m = re.search(r"ADR-(\d+)", f.name)
        if m: max_n = max(max_n, int(m.group(1)))
    n = max_n + 1
    safe = re.sub(r"[^\w\-]", "-", title)
    fp = adr_dir / f"ADR-{n:03d}-{safe}.md"

    lines = [
        f"# ADR-{n:03d}：{title}",
        "",
        "| 属性 | 内容 |",
        "|---|---|",
        "| 状态 | 已采纳 |",
        f"| 日期 | {datetime.now().strftime('%Y-%m-%d')} |",
        "| 决策者 | AI Agent |",
        "",
        "## 背景",
        "",
        background,
        "",
        "## 决策",
        "",
        decision,
        "",
        "## 备选方案",
    ]
    if alternatives:
        for a in alternatives:
            lines += ["", f"### 方案 {a.get('name', '未命名')}",
                      f"- 优点：{a.get('pros', '未说明')}",
                      f"- 缺点：{a.get('cons', '未说明')}",
                      f"- 为何不选：{a.get('reason', '未说明')}"]
    else:
        lines += ["", "（未记录备选方案）"]
    if impacts:
        lines += ["", "## 影响"] + [f"- {i}" for i in impacts]
    lines += ["", "## 修订记录",
              "| 日期 | 版本 | 修改内容 | 修改人 |",
              "|---|---|---|---|",
              f"| {datetime.now().strftime('%Y-%m-%d')} | v1.0 | 初版创建 | AI Agent |"]

    if write_file(fp, "\n".join(lines)):
        _update_readme()
        return f"✅ ADR 已创建：`{safe_relative(fp, DOCS_ROOT)}`"
    return "❌ 创建失败"

def _update_readme():
    lines = ["# 项目文档索引",
             f"最后更新：{datetime.now().strftime('%Y-%m-%d %H:%M')}", ""]
    for cat, desc in CATEGORIES.items():
        d = DOCS_ROOT / cat
        lines += [f"## {cat}", "", f"*{desc}*", ""]
        if d.exists():
            for f in d.glob("*.md"):
                if f.name == "README.md": continue
                title = re.search(r"^#\s+(.+)$", read_file(f), re.MULTILINE)
                t = title.group(1) if title else f.stem
                lines.append(f"- [{t}]({cat}/{f.name})")
        else:
            lines.append("（暂无文档）")
        lines.append("")
    write_file(DOCS_ROOT / "README.md", "\n".join(lines))

# ── 新增：代码感知工具 ─────────────────────────────────────

# 备用目录列表（当 glob 很慢时用）
def _safe_listdir(root: Path, max_depth: int = 2) -> List[str]:
    """返回项目树文本，限制深度防爆"""
    out = []
    root_str = str(root.resolve())
    for dirpath, dirnames, filenames in os.walk(str(root)):
        depth = dirpath.replace(root_str, "").count(os.sep)
        if depth > max_depth:
            dirnames.clear()
            continue
        indent = "  " * depth
        rel = os.path.relpath(dirpath, root_str).replace("\\", "/")
        if rel == ".":
            out.append(f"{root.name}/")
        else:
            out.append(f"{indent}{os.path.basename(dirpath)}/")
        for fn in sorted(filenames[:10]):  # 每目录最多 10 文件
            out.append(f"{indent}  {fn}")
    return out[:80]  # 防爆

def _extract_endpoints() -> List[Dict[str, str]]:
    """扫描后端 C# 文件提取 API 端点"""
    endpoints = []
    backend_dirs = [
        PROJECT_ROOT / "src-backend" / "Qomicex.Launcher.Backend.Neo",
    ]
    # C#:   app.MapGet("/path"), group.MapPost("/path"), [HttpGet("/path")]
    # Java Spring Boot: @GetMapping("/path"), @RequestMapping("/path")
    # Kotlin: 同上（与 Java 共用注解风格）
    http_methods_cs = r'(?i:GET|POST|PUT|DELETE|PATCH|Head|Options|Trace)'  # C# PascalCase: MapGet, HttpGet
    http_methods_java = r'Get|Post|Put|Delete|Patch'                        # Java PascalCase: GetMapping
    patterns = [
        # Minimal API: app.MapGet / group.MapPost
        (rf'(?:app|group)\.Map({http_methods_cs})\("([^"]+)"', 'minimal'),
        # C# controller: [HttpGet], [HttpPost("path")]
        (rf'\[Http({http_methods_cs})\("?([^")\]]*)"?\)?\]', 'controller'),
        # Spring Boot: @GetMapping("/path"), @PostMapping("/path")
        (rf'@({http_methods_java})Mapping\("([^"]*)"\)', 'spring-boot'),
        # Spring Boot: @RequestMapping("/path") (all HTTP methods)
        (r'@RequestMapping\(value\s*=\s*"([^"]+)"', 'spring-boot'),
        (r'@RequestMapping\("([^"]+)"', 'spring-boot'),
    ]
    for bd in backend_dirs:
        for cs in glob_files(bd, "*.cs"):
            content = read_file(cs)
            if not content: continue
            for pat, kind in patterns:
                for m in re.finditer(pat, content):
                    method = m.group(1)
                    route = m.group(2) or "/"
                    endpoints.append({
                        "method": method,
                        "route": route,
                        "file": safe_relative(cs),
                        "kind": kind,
                    })
    # deduplicate
    seen = set()
    uniq = []
    for e in endpoints:
        key = (e["method"], e["route"], e["file"])
        if key not in seen:
            seen.add(key)
            uniq.append(e)
    return uniq

def _extract_routes() -> List[Dict[str, str]]:
    """扫描前端路由定义"""
    routes = []
    src_root = PROJECT_ROOT / "src"
    # Route pattern: <Route path="..." element={...} />
    for tsx in glob_files(src_root, "*.tsx"):
        content = read_file(tsx)
        if not content: continue
        for m in re.finditer(r'<Route\s+path="([^"]*)"\s*element=\{?<(\w+)', content):
            routes.append({"path": m.group(1), "component": m.group(2), "file": safe_relative(tsx)})
        for m in re.finditer(r'path:\s*["\']([^"\']+)["\'],?\s*element', content):
            routes.append({"path": m.group(1), "file": safe_relative(tsx)})
        for m in re.finditer(r'path:\s*["\']([^"\']+)["\'],?\s*lazy', content):
            routes.append({"path": m.group(1), "file": safe_relative(tsx)})
    return routes

def _extract_components() -> List[Dict[str, str]]:
    """扫描 React 组件"""
    comps = []
    src_root = PROJECT_ROOT / "src"
    for tsx in glob_files(src_root, "*.tsx"):
        content = read_file(tsx)
        if not content: continue
        # export default function X / export function X
        for m in re.finditer(r'export\s+(?:default\s+)?function\s+(\w+)', content):
            comps.append({"name": m.group(1), "file": safe_relative(tsx), "type": "function"})
        # export const X = ...
        for m in re.finditer(r'export\s+const\s+(\w+)\s*[:=]', content):
            comps.append({"name": m.group(1), "file": safe_relative(tsx), "type": "const"})
        # interface XProps
        for m in re.finditer(r'interface\s+(\w+Props?\w*)\s*{', content):
            comps.append({"name": m.group(1), "file": safe_relative(tsx), "type": "interface"})
    return comps

def _extract_deps() -> Dict[str, Any]:
    """提取关键依赖摘要"""
    result = {"frontend": {}, "backend": {}, "tauri": {}}
    pkg = PROJECT_ROOT / "package.json"
    if pkg.exists():
        try:
            d = json.loads(read_file(pkg))
            result["project_name"] = d.get("name", "")
            result["version"] = d.get("version", "")
            result["scripts"] = d.get("scripts", {})
            deps = {**d.get("dependencies", {}), **d.get("devDependencies", {})}
            result["frontend"] = {k: v for k, v in sorted(deps.items())[:20]}
        except: pass

    csproj_dir = PROJECT_ROOT / "src-backend" / "Qomicex.Launcher.Backend.Neo"
    for csproj in glob_files(csproj_dir, "*.csproj"):
        content = read_file(csproj)
        if content:
            tf = re.search(r'<TargetFramework>(.*?)<', content)
            if tf: result["backend"]["framework"] = tf.group(1)
            refs = re.findall(r'<PackageReference\s+Include="([^"]+)"', content)
            if refs: result["backend"]["packages"] = refs[:15]
            proj_refs = re.findall(r'<ProjectReference\s+Include="([^"]+)"', content)
            if proj_refs: result["backend"]["project_refs"] = [safe_relative(Path(r)) for r in proj_refs]

    cargo = PROJECT_ROOT / "src-tauri" / "Cargo.toml"
    if cargo.exists():
        content = read_file(cargo)
        deps = re.findall(r'^(\w[\w-]+)\s*=\s*{?\s*version\s*=\s*"([^"]+)"', content, re.MULTILINE)
        if deps: result["tauri"] = {k: v for k, v in deps[:15]}

    return result

# ── Rust / Tauri 层 ──────────────────────────────────────────

def _extract_tauri_commands() -> List[Dict[str, str]]:
    """扫描 #[tauri::command] 函数"""
    cmds = []
    tauri_root = PROJECT_ROOT / "src-tauri" / "src"
    for rs in glob_files(tauri_root, "*.rs"):
        content = read_file(rs)
        if not content: continue
        for m in re.finditer(r'#\[tauri::command\]\s*\n\s*(?:pub\s+)?(?:unsafe\s+)?fn\s+(\w+)', content):
            cmds.append({"name": m.group(1), "file": safe_relative(rs)})
    return cmds

def _extract_tauri_capabilities() -> List[Dict[str, Any]]:
    """解析 src-tauri/capabilities/*.json 权限清单"""
    caps = []
    cap_dir = PROJECT_ROOT / "src-tauri" / "capabilities"
    for jf in glob_files(cap_dir, "*.json"):
        content = read_file(jf)
        if not content: continue
        try:
            d = json.loads(content)
            caps.append({
                "file": safe_relative(jf),
                "identifier": d.get("identifier", ""),
                "windows": d.get("windows", []),
                "permissions": d.get("permissions", [])[:20],  # 防爆
            })
        except json.JSONDecodeError:
            caps.append({"file": safe_relative(jf), "error": "JSON parse failed"})
    return caps

# ── TypeScript 层 ──────────────────────────────────────────

def _extract_api_client() -> List[Dict[str, str]]:
    """扫描 src/api/ 前端调用后端的请求"""
    calls = []
    api_dir = PROJECT_ROOT / "src" / "api"
    for ts in list(glob_files(api_dir, "*.ts")) + list(glob_files(api_dir, "*.tsx")):
        content = read_file(ts)
        if not content: continue
        for m in re.finditer(r"""(get|post|put|delete|patch|request)\s*\(\s*['"]([^'"]+)['"]""", content, re.IGNORECASE):
            calls.append({"call": m.group(1).lower(), "url": m.group(2), "file": safe_relative(ts)})
    return calls

def _extract_stores() -> List[Dict[str, str]]:
    """扫描 src/stores/ 状态管理"""
    stores = []
    store_dir = PROJECT_ROOT / "src" / "stores"
    for ts in list(glob_files(store_dir, "*.ts")) + list(glob_files(store_dir, "*.tsx")):
        content = read_file(ts)
        if not content: continue
        for m in re.finditer(r'(?:export\s+)?(?:const|function)\s+(\w+(?:Store|State)?)\s*[=:]', content):
            stores.append({"name": m.group(1), "file": safe_relative(ts)})
    return stores

def _extract_hooks() -> List[Dict[str, str]]:
    """扫描 src/hooks/ 自定义 Hook"""
    hooks = []
    hook_dir = PROJECT_ROOT / "src" / "hooks"
    for ts in list(glob_files(hook_dir, "*.ts")) + list(glob_files(hook_dir, "*.tsx")):
        content = read_file(ts)
        if not content: continue
        for m in re.finditer(r'(?:export\s+)?(?:const|function)\s+(use\w+)', content):
            hooks.append({"name": m.group(1), "file": safe_relative(ts)})
    return hooks

def _extract_code_context(rel_path: str) -> Dict[str, Any]:
    """分析单个文件：语言、层、关键定义"""
    fp = PROJECT_ROOT / rel_path.replace("/", os.sep).replace("\\", os.sep)
    if not fp.exists() or not fp.is_file():
        return {"error": f"文件不存在: {rel_path}"}
    content = read_file(fp)
    if not content:
        return {"error": "文件为空或无法读取"}
    lines = content.split("\n")
    info = {
        "file": tag(rel_path),
        "language": file_lang(rel_path) or "未知",
        "layer": file_layer(rel_path) or "未知",
        "size": f"{len(lines)} 行",
    }
    # 提取关键定义
    ext = fp.suffix.lower()
    if ext == '.rs':
        info["definitions"] = re.findall(r'(?:pub\s+)?(?:fn|struct|enum|trait|impl|mod|const|static|type)\s+(\w[\w<>]*)', content)[:15]
        info["tauri_commands"] = re.findall(r'#\[tauri::command\]\s*\n\s*(?:pub\s+)?(?:unsafe\s+)?fn\s+(\w+)', content)
    elif ext == '.cs':
        info["definitions"] = re.findall(r'(?:public|private|internal|protected)?\s*(?:static\s+)?(?:class|interface|record|struct|enum|void|Task|IActionResult|string|int|bool|long|Guid)\s+(\w[\w<>]*)', content)[:15]
        info["endpoints"] = [m.group(1) for m in re.finditer(r'(?:app|group)\.Map(GET|POST|PUT|DELETE|PATCH)\(', content, re.IGNORECASE)]
    elif ext in ('.ts', '.tsx'):
        info["exports"] = re.findall(r'export\s+(?:default\s+)?(?:function|const|class|type|interface)\s+(\w+)', content)[:15]
        info["imports"] = re.findall(r"import\s+(?:\{[^}]*\}|\w+)\s+from\s+['\"]([^'\"]+)['\"]", content)[:10]
    elif ext == '.py':
        info["definitions"] = re.findall(r'(?:async\s+)?def\s+(\w+)|class\s+(\w+)', content)[:15]
    return info

# ── 工具注册 ────────────────────────────────────────────────

@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        # ── 原文档工具 ──
        Tool(name="query_docs",
             description="查询项目文档。根据关键词搜索 docs/junsi-dev-docs/ 下的所有文档，返回匹配的文档摘要和路径。",
             inputSchema={"type": "object","properties": {
                 "keywords": {"type": "string", "description": "搜索关键词，如 'API规范'、'架构设计'"},
                 "category": {"type": "string", "enum": list(CATEGORIES.keys()), "description": "限定文档分类（可选）"}
             }, "required": ["keywords"]}),
        Tool(name="create_adr",
             description="创建新的架构决策记录（ADR）。自动编号。",
             inputSchema={"type": "object","properties": {
                 "title": {"type": "string"}, "background": {"type": "string"}, "decision": {"type": "string"},
                 "alternatives": {"type": "array", "items": {"type": "object","properties": {
                     "name": {"type": "string"},"pros": {"type": "string"},"cons": {"type": "string"},"reason": {"type": "string"}}}},
                 "impacts": {"type": "array", "items": {"type": "string"}}
             }, "required": ["title","background","decision"]}),
        Tool(name="update_doc",
             description="更新现有文档。追加内容并记录修订历史。",
             inputSchema={"type": "object","properties": {
                 "doc_path": {"type": "string", "description": "文档相对路径，如 '3-API规范/RESTful-规范.md'"},
                 "content": {"type": "string", "description": "要写入的内容"},
                 "change_description": {"type": "string", "description": "变更说明"}
             }, "required": ["doc_path","content","change_description"]}),
        Tool(name="organize_docs",
             description="整理项目文档。扫描并移动散落的文档到 docs/junsi-dev-docs/ 对应目录。",
             inputSchema={"type": "object","properties": {
                 "dry_run": {"type": "boolean", "description": "仅模拟运行", "default": False}
             }}),
        Tool(name="generate_docs",
             description="生成项目文档。支持任意类型的专题文档。",
             inputSchema={"type": "object","properties": {
                 "doc_type": {"type": "string", "description": "文档类型，如 '启动流程'、'联机流程'"},
                 "content": {"type": "string", "description": "AI 分析好的文档内容（Markdown）"},
                 "target_path": {"type": "string", "description": "保存路径，如 '2-架构设计/启动流程.md'，不填自动生成"},
                 "append_to_existing": {"type": "boolean", "description": "追加到已有文档", "default": False}
             }, "required": ["doc_type","content"]}),

        # ── 新增：代码感知工具 ──
        Tool(name="project_tree",
             description="返回项目目录树（限制深度和条目数），快速了解项目结构。",
             inputSchema={"type": "object","properties": {
                 "subpath": {"type": "string", "description": "限定子目录，如 'src/pages'、'src-backend'（可选）"},
                 "depth": {"type": "integer", "description": "扫描深度，默认 2，最大 4", "default": 2}
             }}),
        Tool(name="api_endpoints",
             description="扫描后端代码文件，返回 API 端点列表。支持 C# Minimal API / Controller、Java Spring Boot、Kotlin（方法 + 路由 + 文件位置）。",
             inputSchema={"type": "object","properties": {}}),
        Tool(name="frontend_routes",
             description="扫描前端 TSX 文件，返回路由定义列表（path + component + 文件位置）。",
             inputSchema={"type": "object","properties": {}}),
        Tool(name="component_inventory",
             description="扫描 React 组件，返回组件名、类型和文件位置。",
             inputSchema={"type": "object","properties": {
                 "dir": {"type": "string", "description": "限定目录，如 'components'、'pages'（可选）"}
             }}),
        Tool(name="project_config",
             description="返回项目关键配置摘要（package.json 脚本、后端框架、Tauri 依赖等）。",
             inputSchema={"type": "object","properties": {}}),

        # ── Rust / Tauri ──
        Tool(name="tauri_commands",
             description="扫描 Rust #[tauri::command] 函数列表（Tauri IPC 入口）。",
             inputSchema={"type": "object","properties": {}}),
        Tool(name="tauri_capabilities",
             description="解析 src-tauri/capabilities/ 权限 JSON 文件。",
             inputSchema={"type": "object","properties": {}}),

        # ── TypeScript 层 ──
        Tool(name="api_client",
             description="扫描 src/api/ 前端请求后端的方法和 URL 列表。",
             inputSchema={"type": "object","properties": {}}),
        Tool(name="stores",
             description="扫描 src/stores/ 状态管理定义。",
             inputSchema={"type": "object","properties": {}}),
        Tool(name="hooks",
             description="扫描 src/hooks/ 自定义 React Hook 列表。",
             inputSchema={"type": "object","properties": {}}),
        Tool(name="code_context",
             description="分析单个文件：语言、所属层、关键定义（函数/类/导出/导入）。迁移或修 bug 时用来确认文件身份。",
             inputSchema={"type": "object","properties": {
                 "path": {"type": "string", "description": "文件相对路径，如 'src-tauri/src/lib.rs'、'src-backend/.../Program.cs'"}
             }, "required": ["path"]}),
    ]

# ── 工具调用分发 ────────────────────────────────────────────

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    result = ""

    # ── 原文档工具 ──
    if name == "query_docs":
        r = search_docs(arguments.get("keywords",""), arguments.get("category"))
        result = json.dumps(r, ensure_ascii=False, indent=2) if r else "📭 未找到匹配文档"
    elif name == "create_adr":
        result = create_adr_file(
            arguments.get("title",""), arguments.get("background",""), arguments.get("decision",""),
            arguments.get("alternatives"), arguments.get("impacts"))
    elif name == "update_doc":
        dp = DOCS_ROOT / arguments.get("doc_path","")
        content = arguments.get("content","")
        desc = arguments.get("change_description","")
        if dp.exists():
            existing = read_file(dp)
            new = existing + f"\n\n### {datetime.now().strftime('%Y-%m-%d')} 更新\n{content}\n"
            result = f"✅ 已更新：`{safe_relative(dp, DOCS_ROOT)}`\n变更：{desc}" if write_file(dp, new) else "❌ 更新失败"
        else:
            # 自动创建
            result = f"✅ 已创建：`{safe_relative(dp, DOCS_ROOT)}`\n变更：{desc}" if write_file(dp, content) else "❌ 创建失败"
    elif name == "organize_docs":
        dry = arguments.get("dry_run", False)
        lines = ["📂 文档整理扫描结果："]
        docs_root = PROJECT_ROOT / "docs"
        if docs_root.exists():
            for f in docs_root.glob("*.md"):
                if "junsi-dev-docs" not in str(f):
                    lines.append(f"  发现：`{f.name}` → 建议移动到 docs/junsi-dev-docs/ 下")
        result = "\n".join(lines) if lines else "没有散落文档。"
        if dry: result += "\n\n（仅模拟，未移动）"
    elif name == "generate_docs":
        doc_type = arguments.get("doc_type","")
        content = arguments.get("content","")
        target = arguments.get("target_path")
        append = arguments.get("append_to_existing", False)
        if not target:
            cat_map = {"启动":"2-架构设计","流程":"2-架构设计","架构":"2-架构设计",
                       "部署":"8-部署运维","API":"3-API规范","接口":"3-API规范",
                       "数据库":"5-数据库设计","UI":"6-UI/组件设计","组件":"6-UI/组件设计",
                       "调用":"7-调用规范","需求":"9-系统要求"}
            cat = next((v for k,v in cat_map.items() if k in doc_type), "2-架构设计")
            target = f"{cat}/{doc_type.replace('/','-').replace('\\','-')}.md"
        fp = DOCS_ROOT / target
        doc = [f"# {doc_type}", f"\n> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}\n", content,
               "\n## 修订记录", "| 日期 | 版本 | 修改内容 | 修改人 |",
               f"| {datetime.now().strftime('%Y-%m-%d')} | v1.0 | 初版创建 | AI Agent |"]
        merged = "\n".join(doc)
        if append and fp.exists():
            existing = read_file(fp)
            merged = existing + "\n\n" + merged
        action = "追加" if (append and fp.exists()) else "创建"
        if write_file(fp, merged):
            result = f"✅ 文档已{action}\n路径：`docs/junsi-dev-docs/{target}`"
        else:
            result = f"❌ 生成失败：{target}"

    # ── 新增：代码感知工具 ──
    elif name == "project_tree":
        sub = arguments.get("subpath", "")
        depth = min(arguments.get("depth", 2), 4)
        base = PROJECT_ROOT
        if sub:
            base = PROJECT_ROOT / sub.replace("/", os.sep).replace("\\", os.sep)
            if not base.exists():
                result = f"❌ 目录不存在：{sub}"
                return [TextContent(type="text", text=result)]
        tree = _safe_listdir(base, depth)
        result = f"📁 项目树：`{safe_relative(base)}` (depth={depth})\n\n" + "\n".join(tree)

    elif name == "api_endpoints":
        eps = _extract_endpoints()
        if not eps:
            result = "📭 未发现 API 端点"
        else:
            lines = [f"📡 共 {len(eps)} 个端点：", ""]
            for e in sorted(eps, key=lambda x: (x["route"], x["method"])):
                lines.append(f"  [{e['method']:>6}]  {e['route']}  ← {tag(e['file'])}")
            result = trunc("\n".join(lines), 3000)

    elif name == "frontend_routes":
        routes = _extract_routes()
        if not routes:
            # fallback: 从 App.tsx 提取导入的页面组件
            app_tsx = PROJECT_ROOT / "src" / "App.tsx"
            if app_tsx.exists():
                content = read_file(app_tsx)
                imports = re.findall(r"import\s+(\w+)\s+from\s+['\"]\./pages/(\w+)['\"]", content)
                routes = [{"path": f"/{name.lower()}", "component": name, "file": "src/App.tsx"} for name, _ in imports]
            else:
                routes = []
        if not routes:
            result = "📭 未发现前端路由"
        else:
            lines = [f"🧭 共 {len(routes)} 个路由：", ""]
            for r in sorted(routes, key=lambda x: x.get("path","")):
                comp = r.get("component", "")
                lines.append(f"  {r['path']:30s} → {comp + '  ' if comp else ''}({tag(r.get('file',''))})")
            result = trunc("\n".join(lines), 2000)

    elif name == "component_inventory":
        comps = _extract_components()
        dir_filter = arguments.get("dir", "")
        if dir_filter:
            comps = [c for c in comps if f"/{dir_filter}/" in c["file"] or c["file"].startswith(f"{dir_filter}/") or f"src/{dir_filter}/" in c["file"]]
        if not comps:
            result = "📭 未发现组件"
        else:
            funcs = [c for c in comps if c["type"] == "function"]
            consts = [c for c in comps if c["type"] == "const"]
            ifaces = [c for c in comps if c["type"] == "interface"]
            lines = [f"🧩 共 {len(comps)} 个条目", ""]
            if funcs:
                lines.append(f"📦 组件 ({len(funcs)})：")
                for c in funcs:
                    lines.append(f"  {c['name']:30s} {tag(c['file'])}")
            if ifaces:
                lines.append(f"📐 Props 接口 ({len(ifaces)})：")
                for c in ifaces:
                    lines.append(f"  {c['name']:30s} {tag(c['file'])}")
            result = trunc("\n".join(lines), 3000)

    elif name == "project_config":
        deps = _extract_deps()
        lines = [f"📋 项目配置：{deps.get('project_name','')} v{deps.get('version','')}", ""]
        scripts = deps.get("scripts", {})
        if scripts:
            lines.append("📜 脚本：")
            for k, v in list(scripts.items())[:10]:
                lines.append(f"  {k:20s} {v}")
        be = deps.get("backend", {})
        if be.get("framework"):
            lines.append(f"\n🔧 后端 (C#)：{be['framework']}")
            if be.get("packages"):
                lines.append(f"  包: {', '.join(be['packages'][:8])}")
        tauri = deps.get("tauri", {})
        if tauri:
            lines.append(f"\n🦀 Tauri (Rust)：")
            for k, v in list(tauri.items())[:8]:
                lines.append(f"  {k:25s} {v}")
        fe = deps.get("frontend", {})
        if fe:
            lines.append(f"\n⚛️ 前端 (TS/TSX)：{len(fe)} 个依赖")
            for k, v in list(fe.items())[:12]:
                lines.append(f"  {k:25s} {v}")
        result = trunc("\n".join(lines), 3000)

    # ── Rust / Tauri ──
    elif name == "tauri_commands":
        cmds = _extract_tauri_commands()
        if not cmds:
            result = "📭 未发现 Tauri command"
        else:
            lines = [f"🦀 共 {len(cmds)} 个 Tauri command：", ""]
            for c in cmds:
                lines.append(f"  {c['name']:30s} {tag(c['file'])}")
            result = trunc("\n".join(lines), 2000)

    elif name == "tauri_capabilities":
        caps = _extract_tauri_capabilities()
        if not caps:
            result = "📭 未发现 capabilities 文件"
        else:
            lines = [f"🔐 共 {len(caps)} 个能力文件：", ""]
            for c in caps:
                perms = c.get("permissions", [])
                lines.append(f"  {tag(c['file'])}  ({len(perms)} permissions)")
                for p in perms[:8]:
                    lines.append(f"    - {p}")
                if len(perms) > 8:
                    lines.append(f"    ... ({len(perms)} total)")
            result = trunc("\n".join(lines), 3000)

    # ── TypeScript 层 ──
    elif name == "api_client":
        calls = _extract_api_client()
        if not calls:
            result = "📭 未发现 API 调用"
        else:
            lines = [f"🌐 共 {len(calls)} 个 API 调用：", ""]
            for c in sorted(calls, key=lambda x: x["file"])[:25]:
                lines.append(f"  {c['call']:>8}  {c['url']:40s}  {tag(c['file'])}")
            if len(calls) > 25:
                lines.append(f"  ... ({len(calls)} total)")
            result = trunc("\n".join(lines), 3000)

    elif name == "stores":
        stores = _extract_stores()
        if not stores:
            result = "📭 未发现状态管理"
        else:
            lines = [f"🗄️ 共 {len(stores)} 个 store/state：", ""]
            for s in stores:
                lines.append(f"  {s['name']:30s} {tag(s['file'])}")
            result = trunc("\n".join(lines), 2000)

    elif name == "hooks":
        hooks = _extract_hooks()
        if not hooks:
            result = "📭 未发现自定义 Hook"
        else:
            lines = [f"🪝 共 {len(hooks)} 个 Hook：", ""]
            for h in hooks:
                lines.append(f"  {h['name']:30s} {tag(h['file'])}")
            result = trunc("\n".join(lines), 2000)

    elif name == "code_context":
        path_arg = arguments.get("path", "")
        if not path_arg:
            result = "❌ 需要 path 参数：文件相对路径"
        else:
            ctx = _extract_code_context(path_arg)
            if "error" in ctx:
                result = f"❌ {ctx['error']}"
            else:
                lines = [
                    f"📄 {ctx['file']}",
                    f"  语言: {ctx['language']}  |  层: {ctx['layer']}  |  {ctx['size']}",
                ]
                for key in ('definitions', 'exports', 'imports', 'tauri_commands', 'endpoints'):
                    vals = ctx.get(key)
                    if vals:
                        label = {'definitions': '定义', 'exports': '导出', 'imports': '导入',
                                 'tauri_commands': 'Tauri command', 'endpoints': '端点'}.get(key, key)
                        lines.append(f"  {label}: {', '.join(vals[:8])}")
                        if len(vals) > 8: lines[-1] += " ..."
                result = "\n".join(lines)

    else:
        result = f"❌ 未知工具：{name}"

    return [TextContent(type="text", text=result)]

# ── 资源（文档文件暴露为资源） ──

@app.list_resources()
async def list_resources() -> list[Resource]:
    res = []
    for cat in CATEGORIES:
        d = DOCS_ROOT / cat
        if d.exists():
            for f in d.glob("*.md"):
                if f.name != "README.md":
                    res.append(Resource(uri=f"docs://{cat}/{f.name}",
                                        name=f"{cat}/{f.name}",
                                        description=f"项目文档：{cat}/{f.name}",
                                        mimeType="text/markdown"))
    return res

@app.read_resource()
async def read_resource(uri: AnyUrl) -> str:
    p = uri.path.lstrip("/")
    fp = DOCS_ROOT / p
    return read_file(fp) if fp.exists() else f"文档不存在：{p}"

# ── 入口 ──

if __name__ == "__main__":
    import asyncio
    from mcp.server.stdio import stdio_server
    async def main():
        async with stdio_server() as (rs, ws):
            await app.run(rs, ws, app.create_initialization_options())
    asyncio.run(main())
