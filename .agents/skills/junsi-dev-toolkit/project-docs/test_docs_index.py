#!/usr/bin/env python3
"""Self-check for project-docs 的扫描 / 归档 / paths[] / 标签逻辑。

运行：python test_docs_index.py
覆盖：
- 路径派生标签、slug、i18n 三件套合并、分类参数解析（纯函数）
- 归档移动（organize_docs）+ 回滚（revert_docs）
- paths[] 外部文档接入、id 打标签、按 tag 检索
"""

import importlib.util
import shutil
import tempfile
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("mcp_server", _HERE / "mcp-server.py")
m = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m)

_KEYS = ("PROJECT_ROOT", "DOCS_ROOT", "DOCS_SCAN_ROOT", "INDEX_FILE",
         "safe_relative", "_external_paths")


def _patch(tmp):
    old = tuple(getattr(m, k) for k in _KEYS)
    m.PROJECT_ROOT = tmp
    m.DOCS_ROOT = tmp / "docs" / "junsi-dev-docs"
    m.DOCS_SCAN_ROOT = tmp / "docs"
    m.INDEX_FILE = m.DOCS_ROOT / "docs-index.json"
    m.safe_relative = lambda p, base=None: str(Path(p).resolve().relative_to(tmp)).replace("\\", "/")
    return old


def _restore(old):
    for k, v in zip(_KEYS, old):
        setattr(m, k, v)


def test_pure():
    assert m._path_tags("docs/cookbook/adding-a-package.md") == ["cookbook"]
    assert m._path_tags("docs/persistence-changes/releases/x.md") == ["persistence-changes", "releases"]
    assert m._path_tags("docs/junsi-dev-docs/2-架构设计/a.md") == ["2-架构设计"]
    assert m._path_tags("README.md") == []
    assert m._slug_of("docs/cookbook/adding-a-package.md") == "cookbook--adding-a-package"
    assert m._slug_of("notes/design.md") == "notes--design"
    assert m._companion_base_name("x.zh.md") == "x.md"
    assert m._companion_base_name("x.i18n.yaml") == "x.md"
    assert m._companion_base_name("x.schema.json") == "x.md"
    assert m._doc_tags({"path": "docs/junsi-dev-docs/2-架构设计/a.md",
                        "original_path": "docs/cookbook/a.md",
                        "explicit_tags": ["Core"]}) == ["cookbook", "core"]
    assert m._is_root_meta("README.md") and m._is_root_meta("LICENSE.txt")
    assert not m._is_root_meta("UPDATE.md")
    assert m._as_list("a, b\nc") == ["a", "b", "c"]
    assert m._parse_assignments([{"path": "docs/a.md", "category": "2-架构设计"}]) == {"docs/a.md": "2-架构设计"}
    assert m._parse_assignments([{"path": "docs/a.md", "category": "bogus"}]) == {}


def test_archive_and_revert():
    tmp = Path(tempfile.mkdtemp(prefix="docs_arch_"))
    try:
        (tmp / "docs" / "cookbook").mkdir(parents=True)
        (tmp / "docs" / "architecture.md").write_text("# Arch\n", "utf-8")
        (tmp / "docs" / "cookbook" / "adding.md").write_text("# Adding\n", "utf-8")
        (tmp / "docs" / "cookbook" / "adding.zh.md").write_text("# 添加\n", "utf-8")
        old = _patch(tmp)
        m._external_paths = lambda: []
        try:
            m.run_organize(dry_run=False, include_root=False, assignments=[
                {"path": "docs/architecture.md", "category": "2-架构设计"},
                {"path": "docs/cookbook/adding.md", "category": "4-编码规范"},
            ])
            assert (tmp / "docs/junsi-dev-docs/2-架构设计/architecture.md").exists()
            assert (tmp / "docs/junsi-dev-docs/4-编码规范/cookbook--adding.md").exists()
            assert (tmp / "docs/junsi-dev-docs/4-编码规范/cookbook--adding.zh.md").exists()
            assert not (tmp / "docs/architecture.md").exists()
            entry = {d["path"]: d for d in m.load_index()["docs"]}
            e = entry["docs/junsi-dev-docs/2-架构设计/architecture.md"]
            assert e["original_path"] == "docs/architecture.md", e
            assert e["tags"] == [], e  # 顶层文档无目录段，标签来自原功能结构

            m.run_revert(dry_run=False)
            assert (tmp / "docs/architecture.md").exists()
            assert (tmp / "docs/cookbook/adding.md").exists()
            assert not (tmp / "docs/junsi-dev-docs/2-架构设计/architecture.md").exists()
            assert not any(d.get("original_path") for d in m.load_index()["docs"])
        finally:
            _restore(old)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_external_paths():
    tmp = Path(tempfile.mkdtemp(prefix="docs_ext_"))
    try:
        (tmp / "docs" / "junsi-dev-docs" / "2-架构设计").mkdir(parents=True)
        (tmp / "docs" / "junsi-dev-docs" / "2-架构设计" / "a.md").write_text("# A\n", "utf-8")
        (tmp / "docs" / "cookbook").mkdir(parents=True)
        (tmp / "docs" / "cookbook" / "adding.md").write_text("# Adding\n", "utf-8")
        (tmp / "docs" / "cookbook" / "adding.zh.md").write_text("# 添加\n", "utf-8")
        (tmp / "docs" / "cookbook" / "adding.i18n.yaml").write_text("x: y\n", "utf-8")
        (tmp / "notes").mkdir()
        (tmp / "notes" / "design.md").write_text("# Design\n", "utf-8")

        old = _patch(tmp)
        try:
            m.run_index_docs(paths=["docs/cookbook", "notes"])
            idx = m.load_index()
            assert len(idx["paths"]) == 2, idx["paths"]

            units = {u["path"]: u for u in m._scan_units()}
            assert not units["docs/junsi-dev-docs/2-架构设计/a.md"]["external"]
            ext = units["docs/cookbook/adding.md"]
            assert ext["external"] and ext["id"] == "cookbook--adding", ext
            assert ext["zh"] and ext["i18n"]
            nd = units["notes/design.md"]
            assert nd["external"] and nd["id"] == "notes--design", nd

            m.run_tag_docs(ids=["cookbook--adding"], tags=["core"])
            entry = {d["id"]: d for d in m.load_index()["docs"] if d.get("id")}["cookbook--adding"]
            assert entry["explicit_tags"] == ["core"], entry
            hits = m.search_docs(tags=["core"])
            assert any(h["path"] == "docs/cookbook/adding.md" for h in hits), hits
        finally:
            _restore(old)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    test_pure()
    test_archive_and_revert()
    test_external_paths()
    print("OK: docs archive/paths/tag self-check passed")
