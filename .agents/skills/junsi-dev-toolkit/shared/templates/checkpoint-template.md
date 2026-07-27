# CHECKPOINT_n 模板

每完成一个原子包后，生成 `CHECKPOINT_n.md` 文件。此文件是 AI 上下文刷新后的续传锚点。

## 模板

```markdown
# CHECKPOINT_{n}

**时间：** {timestamp}
**原子包：** {package_number}/{total_packages}

## 本包完成了什么

- [x] 移植了 {file_list}，共 {line_count} 行
- [x] 映射了 {mapping_description}
- [x] 编译通过 / 静态检查通过

## 关键映射决策

| 源 | 目标 | 原因 |
|---|---|---|
| `sync.Mutex` | `threading.Lock` | 语义等价 |
| `error` 返回值 | `raise Exception` | Go→Python 惯用法 |

## 遗留 TODO

- [ ] {file}:{line} — {unresolved_issue}
- [ ] 待处理 {manual_review_item}

## 下一包预览

- 文件：{next_files}
- 预估行数：{estimated_lines}
- 依赖关系：{dependencies}
```

## 命名与提交规范

- 文件名：`CHECKPOINT_{n}.md`（n 从 1 开始递增）
- 对应 git commit：`migrate: checkpoint_{n}`
- 文件放在项目根目录或 `.migrate/` 目录下
