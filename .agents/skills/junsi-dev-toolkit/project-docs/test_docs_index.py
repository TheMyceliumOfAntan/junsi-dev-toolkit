#!/usr/bin/env python3
"""Self-check for project-docs 的扫描 / 标签 / 归档逻辑。

运行：python test_docs_index.py
覆盖：路径派生标签、slug、i18n 三件套合并、显式标签叠加、分类参数解析。
"""

import importlib.util
import tempfile
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("mcp_server", _HERE / "mcp-server.py")
m = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m)


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
    assert m._parse_assignments([{"path": "docs/a.md", "category": "2-架构设计"}]) == {"docs/a.md": "2-架构设计"}
    assert m._parse_assignments([{"path": "docs/a.md", "category": "bogus"}]) == {}


def test_scan_grouping():
    with tempfile.TemporaryDirectory() as td:
        docs = Path(td) / "docs"
        (docs / "cookbook").mkdir(parents=True)
        (docs / "cookbook" / "adding.md").write_text("# Adding\n", "utf-8")
        (docs / "cookbook" / "adding.zh.md").write_text("# 添加\n", "utf-8")
        (docs / "cookbook" / "adding.i18n.yaml").write_text("x: y\n", "utf-8")
        (docs / "architecture.md").write_text("# Arch\n", "utf-8")
        (docs / "architecture.zh.md").write_text("# 架构\n", "utf-8")

        old = m.DOCS_SCAN_ROOT
        try:
            m.DOCS_SCAN_ROOT = docs
            units = m._scan_units(include_root=False)
        finally:
            m.DOCS_SCAN_ROOT = old

        by_name = {Path(u["path"]).name: u for u in units}
        assert set(by_name) == {"adding.md", "architecture.md"}, by_name.keys()
        assert by_name["adding.md"]["zh"] and by_name["adding.md"]["i18n"]
        assert by_name["architecture.md"]["zh"] and not by_name["architecture.md"]["i18n"]


if __name__ == "__main__":
    test_pure()
    test_scan_grouping()
    print("OK: docs index/tag self-check passed")
