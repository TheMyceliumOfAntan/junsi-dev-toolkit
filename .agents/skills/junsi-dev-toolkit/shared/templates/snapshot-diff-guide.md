# 快照比对脚本编写指南

移植前后使用快照自动比对，代替人工肉眼对比。

## 第一步：生成源快照

在移植**之前**，编写脚本抓取源项目核心接口的输出。

```python
# snapshot_grabber.py
import json
import requests  # 或其他 HTTP 客户端

ENDPOINTS = [
    {"name": "user_list", "method": "GET", "url": "http://localhost:8080/api/users", "body": None},
    {"name": "create_order", "method": "POST", "url": "http://localhost:8080/api/orders", "body": {"item": "test"}},
]

results = {}
for ep in ENDPOINTS:
    if ep["method"] == "GET":
        resp = requests.get(ep["url"])
    else:
        resp = requests.post(ep["url"], json=ep["body"])
    results[ep["name"]] = {"status": resp.status_code, "body": resp.json()}

with open("source_snapshot.json", "w") as f:
    json.dump(results, f, indent=2)
```

## 第二步：移植后生成目标快照

移植完成后，用**同一脚本**请求目标项目：

```bash
# 修改脚本中的 URL/端口指向目标项目
python snapshot_grabber.py --target > target_snapshot.json
```

## 第三步：编写 diff_checker

自动对比两个 JSON 的结构、字段类型、数值范围。

```python
# diff_checker.py
import json
from deepdiff import DeepDiff  # pip install deepdiff

IGNORE_FIELDS = ["timestamp", "traceId", "requestId", "createdAt", "updatedAt"]

with open("source_snapshot.json") as f:
    source = json.load(f)
with open("target_snapshot.json") as f:
    target = json.load(f)

diff = DeepDiff(source, target, exclude_paths=[f"root.*.{field}" for field in IGNORE_FIELDS])

if diff:
    print("BLOCKING ISSUE — 以下差异必须修复：")
    print(json.dumps(diff, indent=2))
    exit(1)
else:
    print("PASS — 源与目标输出一致")
    exit(0)
```

## 允许忽略的字段

预定义白名单，仅允许以下字段存在差异：

- `timestamp`、`createdAt`、`updatedAt`（时间戳自然不同）
- `traceId`、`requestId`、`spanId`（链路追踪 ID）
- `version`、`buildId`（构建信息）

**其余任何字段差异均视为 Blocking Issue。**

## 结构化比对维度

| 维度 | 检查项 | 工具 |
|---|---|---|
| 字段存在性 | 目标缺少源有的字段 | `DeepDiff` |
| 字段类型 | `int` vs `float` 类型漂移 | `DeepDiff` |
| 数值范围 | 结果数量级是否一致 | 自定义断言 |
| 嵌套结构 | 深层 JSON 结构是否一致 | `DeepDiff(ignore_order=True)` |
