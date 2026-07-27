# 移植决策日志（ADR）模板

移植完成后必须输出此文档，记录关键决策供未来维护者参考。

## 模板

```markdown
# ADR：{源项目} → {目标项目} 移植决策日志

**日期：** {date}
**源：** {source_lang} / {source_framework}
**目标：** {target_lang} / {target_framework}

## 关键决策

### 决策 1：{decision_title}

- **源项目做法：** {what_source_does}
- **目标项目做法：** {what_target_does}
- **变更原因：** {why_changed}
- **权衡：** {tradeoffs}

### 决策 2：{decision_title}
...

## 显式保留的 Bad Smell

以下源项目的非最佳实践在移植中被**显式保留**（业务逻辑要求，非疏忽）：

| 位置 | 问题描述 | 保留原因 |
|---|---|---|
| `src/order/calculate.go:42` | 嵌套 if 7 层 | 业务公式复杂，拆分风险高 |
| `src/payment/check.go:15` | 硬编码费率 | 需求明确要求硬编码 |

## 移植方法
- **方法：** {逐字翻译/适配新架构/混合}
- **原因：** {why_this_approach}

## 移植范围
- **总量：** {total_files} 个文件，{total_lines} 行
- **新增：** {new_files} 个文件
- **修改：** {modified_files} 个文件
- **跳过：** {skipped_files} 个文件（{reason}）

# [PATCH] 强制新增「遗留技术债」章节
## 遗留技术债（待人工决策的优化点）

以下为移植过程中发现的源项目 Bad Smell，**移植时未做修改**，需人工后续决策是否优化：

| 发现位置 | 问题描述 | 潜在影响 |
|---|---|---|
| `src/order/calculate.go:42` | 同步锁粒度过大，阻塞整个订单计算流程 | 高并发下性能瓶颈 |
| `src/payment/check.go:15` | 直接使用 `SELECT *` 查询全表 | 数据量大时内存溢出风险 |
| `src/api/middleware.go:30` | 废弃的 v1 鉴权方式仍在调用 | 安全合规风险 |

## 已识别风险
- {risk_1}
- {risk_2}
```
