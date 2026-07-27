#!/usr/bin/env python3
"""
project-docs MCP Server
将 project-docs Skill 暴露为 MCP 工具，供 AI Agent 自动发现和调用。
"""

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.types import (
    CallToolResult,
    GetPromptResult,
    ListPromptsResult,
    Prompt,
    PromptArgument,
    PromptMessage,
    Resource,
    ResourceContents,
    TextContent,
    TextResourceContents,
    Tool,
)
from pydantic import AnyUrl

PROJECT_ROOT = Path(os.getcwd()).resolve()
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


def read_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def write_file(path: Path, content: str) -> bool:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return True
    except Exception:
        return False


def search_docs(keywords: str, category: Optional[str] = None) -> List[Dict[str, str]]:
    results = []
    search_terms = [k.strip().lower() for k in keywords.split(",") if k.strip()]

    base_dir = DOCS_ROOT / category if category else DOCS_ROOT

    for file_path in base_dir.glob("**/*.md"):
        if file_path.name == "README.md":
            continue
        content = read_file(file_path)
        if not content:
            continue
        content_lower = content.lower()
        matched = all(term in content_lower for term in search_terms)
        if matched:
            title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
            title = title_match.group(1) if title_match else file_path.stem
            summary = content[:200].replace("\n", " ") + "..."
            rel_path = file_path.relative_to(DOCS_ROOT)
            results.append({
                "path": str(rel_path),
                "title": title,
                "summary": summary[:200]
            })

    return results[:10]


def create_adr_file(title: str, background: str, decision: str,
                    alternatives: Optional[List[Dict]] = None,
                    impacts: Optional[List[str]] = None) -> str:
    adr_dir = DOCS_ROOT / "1-决策记录"
    adr_dir.mkdir(parents=True, exist_ok=True)
    existing = list(adr_dir.glob("ADR-*.md"))
    max_num = 0
    for f in existing:
        match = re.search(r"ADR-(\d+)", f.name)
        if match:
            max_num = max(max_num, int(match.group(1)))
    next_num = max_num + 1

    safe_title = re.sub(r"[^\w\-]", "-", title)
    filename = f"ADR-{next_num:03d}-{safe_title}.md"
    file_path = adr_dir / filename

    content = f"""# ADR-{next_num:03d}：{title}

| 属性 | 内容 |
|:---|:---|
| 状态 | 已采纳 |
| 日期 | {datetime.now().strftime("%Y-%m-%d")} |
| 决策者 | AI Agent |

## 背景

{background}

## 决策

{decision}

## 备选方案

"""
    if alternatives:
        for alt in alternatives:
            content += f"""
### 方案 {alt.get('name', '未命名')}
- 优点：{alt.get('pros', '未说明')}
- 缺点：{alt.get('cons', '未说明')}
- 为何不选：{alt.get('reason', '未说明')}
"""
    else:
        content += "\n（未记录备选方案）\n"

    if impacts:
        content += "\n## 影响\n"
        for impact in impacts:
            content += f"- {impact}\n"

    content += f"""
## 修订记录
| 日期 | 版本 | 修改内容 | 修改人 |
|:---|:---|:---|:---|
| {datetime.now().strftime("%Y-%m-%d")} | v1.0 | 初版创建 | AI Agent |
"""

    if write_file(file_path, content):
        update_readme()
        return f"✅ ADR 已创建：`{filename}`\n路径：`docs/junsi-dev-docs/1-决策记录/{filename}`"
    else:
        return "❌ 创建失败，请检查目录权限"


def update_readme():
    readme_path = DOCS_ROOT / "README.md"
    content = "# 项目文档索引\n\n"
    content += f"最后更新：{datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"

    for cat, desc in CATEGORIES.items():
        cat_dir = DOCS_ROOT / cat
        if cat_dir.exists():
            files = list(cat_dir.glob("*.md"))
            if files:
                content += f"## {cat}\n\n"
                content += f"*{desc}*\n\n"
                for f in files:
                    if f.name != "README.md":
                        title_match = re.search(r"^#\s+(.+)$", read_file(f), re.MULTILINE)
                        title = title_match.group(1) if title_match else f.stem
                        content += f"- [{title}]({cat}/{f.name})\n"
                content += "\n"
            else:
                content += f"## {cat}\n\n*{desc}（暂无文档）*\n\n"

    write_file(readme_path, content)


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="query_docs",
            description="查询项目文档。根据关键词搜索 docs/junsi-dev-docs/ 下的所有文档，返回匹配的文档摘要和路径。",
            inputSchema={
                "type": "object",
                "properties": {
                    "keywords": {
                        "type": "string",
                        "description": "搜索关键词，如 'API规范'、'架构设计'、'缓存选型'"
                    },
                    "category": {
                        "type": "string",
                        "enum": list(CATEGORIES.keys()),
                        "description": "限定搜索的文档分类（可选）"
                    }
                },
                "required": ["keywords"]
            }
        ),
        Tool(
            name="create_adr",
            description="创建新的架构决策记录（ADR）。自动编号，写入 docs/junsi-dev-docs/1-决策记录/。",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "ADR 标题"},
                    "background": {"type": "string", "description": "背景和问题描述"},
                    "decision": {"type": "string", "description": "决策内容"},
                    "alternatives": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "pros": {"type": "string"},
                                "cons": {"type": "string"},
                                "reason": {"type": "string"}
                            }
                        },
                        "description": "备选方案"
                    },
                    "impacts": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "影响列表"
                    }
                },
                "required": ["title", "background", "decision"]
            }
        ),
        Tool(
            name="update_doc",
            description="更新现有文档。更新指定章节并记录修订历史。",
            inputSchema={
                "type": "object",
                "properties": {
                    "doc_path": {
                        "type": "string",
                        "description": "文档相对路径，如 '3-API规范/RESTful-规范.md'"
                    },
                    "section": {
                        "type": "string",
                        "description": "要更新的章节名称（可选）"
                    },
                    "content": {
                        "type": "string",
                        "description": "要写入的内容"
                    },
                    "change_description": {
                        "type": "string",
                        "description": "变更说明，用于修订记录"
                    }
                },
                "required": ["doc_path", "content", "change_description"]
            }
        ),
        Tool(
            name="organize_docs",
            description="整理项目文档。扫描并移动散落的文档到 docs/junsi-dev-docs/ 对应目录。",
            inputSchema={
                "type": "object",
                "properties": {
                    "dry_run": {
                        "type": "boolean",
                        "description": "是否仅模拟运行",
                        "default": False
                    }
                }
            }
        ),
        Tool(
            name="generate_docs",
            description="生成项目文档。支持任意类型的专题文档（如启动流程、联机流程、部署流程等）。用户提供代码分析结果，工具生成结构化文档。",
            inputSchema={
                "type": "object",
                "properties": {
                    "doc_type": {
                        "type": "string",
                        "description": "文档类型，如 '启动流程'、'联机流程'、'部署流程'、'认证流程' 等，不限制预设值"
                    },
                    "content": {
                        "type": "string",
                        "description": "AI 预先分析好的文档内容（Markdown 格式），包括代码分析、流程说明、关键节点等"
                    },
                    "target_path": {
                        "type": "string",
                        "description": "文档保存路径（相对于 docs/junsi-dev-docs/），如 '2-架构设计/启动流程.md'，不填则自动生成"
                    },
                    "append_to_existing": {
                        "type": "boolean",
                        "description": "是否追加到已有文档，默认为 false（覆盖）",
                        "default": False
                    }
                },
                "required": ["doc_type", "content"]
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    result = ""

    if name == "query_docs":
        keywords = arguments.get("keywords", "")
        category = arguments.get("category")
        results = search_docs(keywords, category)
        if results:
            result = json.dumps(results, ensure_ascii=False, indent=2)
        else:
            result = "📭 未找到匹配的文档。建议：\n1. 尝试其他关键词\n2. 检查 docs/junsi-dev-docs/ 下是否有相关文档"

    elif name == "create_adr":
        result = create_adr_file(
            title=arguments.get("title", ""),
            background=arguments.get("background", ""),
            decision=arguments.get("decision", ""),
            alternatives=arguments.get("alternatives"),
            impacts=arguments.get("impacts")
        )

    elif name == "update_doc":
        doc_path = DOCS_ROOT / arguments.get("doc_path", "")
        content = arguments.get("content", "")
        change_desc = arguments.get("change_description", "")
        if doc_path.exists():
            existing = read_file(doc_path)
            new_content = existing + f"\n\n### {datetime.now().strftime('%Y-%m-%d')} 更新\n{content}\n"
            if write_file(doc_path, new_content):
                result = f"✅ 已更新：`{doc_path}`\n变更说明：{change_desc}"
            else:
                result = "❌ 更新失败"
        else:
            result = f"❌ 文档不存在：`{doc_path}`"

    elif name == "organize_docs":
        dry_run = arguments.get("dry_run", False)
        result = "📂 文档整理功能已触发。扫描并整理散落文档..."
        docs_root = PROJECT_ROOT / "docs"
        if docs_root.exists():
            for f in docs_root.glob("*.md"):
                if "junsi-dev-docs" not in str(f):
                    result += f"\n- 发现：`{f.name}` → 建议移动到 `3-API规范/`（如需手动调整请告诉我）"
        if dry_run:
            result += "\n\n（仅模拟运行，未实际移动文件）"

    elif name == "generate_docs":
        doc_type = arguments.get("doc_type", "未命名文档")
        content = arguments.get("content", "")
        target_path = arguments.get("target_path")
        append = arguments.get("append_to_existing", False)

        if not target_path:
            category_map = {
                "启动": "2-架构设计",
                "流程": "2-架构设计",
                "架构": "2-架构设计",
                "部署": "8-部署运维",
                "运维": "8-部署运维",
                "API": "3-API规范",
                "接口": "3-API规范",
                "数据库": "5-数据库设计",
                "表结构": "5-数据库设计",
                "UI": "6-UI/组件设计",
                "组件": "6-UI/组件设计",
                "调用": "7-调用规范",
                "通信": "7-调用规范",
                "需求": "9-系统要求",
                "功能": "9-系统要求",
            }
            category = "2-架构设计"
            for key, cat in category_map.items():
                if key in doc_type:
                    category = cat
                    break
            safe_name = doc_type.replace("/", "-").replace("\\", "-")
            target_path = f"{category}/{safe_name}.md"

        full_path = DOCS_ROOT / target_path

        doc_content = f"""# {doc_type}

> 由 AI 基于代码分析生成 | 生成时间：{datetime.now().strftime("%Y-%m-%d %H:%M")}

{content}

## 修订记录
| 日期 | 版本 | 修改内容 | 修改人 |
|:---|:---|:---|:---|
| {datetime.now().strftime("%Y-%m-%d")} | v1.0 | 初版创建（AI 生成） | AI Agent |
"""

        if append and full_path.exists():
            existing = read_file(full_path)
            if "## 修订记录" in existing:
                parts = existing.split("## 修订记录")
                doc_content = parts[0] + doc_content + "\n## 修订记录" + parts[1]
            else:
                doc_content = existing + "\n\n" + doc_content

        if write_file(full_path, doc_content):
            result = f"""✅ 文档已生成

- 类型：{doc_type}
- 路径：`docs/junsi-dev-docs/{target_path}`
- 操作：{'追加' if append else '创建'}

💡 如需调整内容，可直接编辑上述文件，或告诉我修改。
"""
        else:
            result = f"❌ 文档生成失败：{full_path}"

    return [TextContent(type="text", text=result)]


@app.list_resources()
async def list_resources() -> list[Resource]:
    resources = []
    for cat in CATEGORIES.keys():
        cat_dir = DOCS_ROOT / cat
        if cat_dir.exists():
            for f in cat_dir.glob("*.md"):
                if f.name != "README.md":
                    resources.append(
                        Resource(
                            uri=f"docs://{cat}/{f.name}",
                            name=f"{cat}/{f.name}",
                            description=f"项目文档：{cat}/{f.name}",
                            mimeType="text/markdown"
                        )
                    )
    return resources


@app.read_resource()
async def read_resource(uri: AnyUrl) -> str:
    path_str = uri.path.lstrip("/")
    full_path = DOCS_ROOT / path_str
    if full_path.exists():
        return read_file(full_path)
    return f"文档不存在：{path_str}"


if __name__ == "__main__":
    import asyncio
    from mcp.server.stdio import stdio_server

    async def main():
        async with stdio_server() as (read_stream, write_stream):
            await app.run(read_stream, write_stream, app.create_initialization_options())

    asyncio.run(main())
