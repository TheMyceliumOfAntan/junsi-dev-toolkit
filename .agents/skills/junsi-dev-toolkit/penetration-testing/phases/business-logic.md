---
name: business-logic
description: 业务逻辑测试阶段详细指南 (WSTG-BUSL) - 价格篡改、流程跳过、竞态条件、回调伪造
---

# Phase 7: 业务逻辑测试 (WSTG-BUSL)

业务逻辑漏洞没有通用 payload，依赖对业务流程的理解。测试前必须完整走一遍正常流程，记录每个请求（浏览器 DevTools 或 wsl-curl 复现）。

## 测试目标

1. 数值类参数篡改（价格、数量、金额、积分）
2. 流程跳过与步骤重放
3. 竞态条件
4. 第三方回调（支付）伪造

## 安全约束

- 竞态/重放测试只影响测试账号与测试商品
- 支付链路只做验证级测试，不发起真实退款/提现
- 每类测试后清理产生的测试订单

---

## 7.1 数值与状态篡改

### 检查点

```text
价格/金额：改小、改负、改 0、小数精度（0.001）、单位替换（分/元）
数量：改负（减库存反加钱）、超大值（整数溢出）
优惠券：重复使用、叠加、过期/未领取使用
积分/余额：并发扣成负数
```

### 手工步骤

1. 正常下单，捕获全部请求
2. 在发往服务端的请求里改金额/数量重放（注意区分客户端计算值与服务端信任值）
3. 判定：订单以篡改值成交 → 严重

```powershell
$body = @{ item_id = "SKU001"; quantity = -1; price = 0.01; coupon = "TEST100" }
$resp = Invoke-WebRequest -Uri "$TARGET_URL/api/order" -Method Post -Body ($body | ConvertTo-Json) -ContentType "application/json" -Headers @{ Cookie = "session=VALID" } -UseBasicParsing
$resp.Content
```

### 修复建议

金额/价格服务端计算，不信任客户端传值；数值范围校验；优惠券服务端状态机（一次性、时间窗、叠加规则）。

---

## 7.2 流程跳过与重放

### 检查点

- [ ] 直接请求流程最后一步（支付成功页/接口）而不完成前置步骤
- [ ] 步骤顺序打乱（先确认后下单）
- [ ] 已完成步骤重放（重复提交订单）
- [ ] 前端禁用/隐藏的步骤在接口层仍可调用

### 判定标准

跳过前置步骤完成交易/达到终态 → 高危。

### 修复建议

服务端状态机校验步骤前置条件；幂等键防重复提交。

---

## 7.3 竞态条件

### 测试原理

并发请求在"检查-使用"窗口内同时通过 → 超卖、超额扣减、优惠券复用。

```powershell
# 并发领取同一优惠券 N 次（PS7；PS5 改用 Start-Job 循环）
$n = 10
$TARGET_URL = "https://target"
$Cookie = "session=VALID"

1..$n | ForEach-Object -Parallel {
    try {
        $r = Invoke-WebRequest -Uri "$using:TARGET_URL/api/coupon/claim" -Method Post `
             -Body (@{ coupon_id = "C001" } | ConvertTo-Json) -ContentType "application/json" `
             -Headers @{ Cookie = $using:Cookie } -UseBasicParsing -ErrorAction Stop
        "OK: $($r.StatusCode)"
    } catch { "FAIL: $($_.Exception.Response.StatusCode.value__)" }
} -ThrottleLimit $n

# 判定：成功次数 > 1（或库存/余额异常）→ 存在竞态
```

### 修复建议

数据库唯一约束/行锁/乐观锁（版本号）；关键操作用原子 CAS；令牌桶限流。

---

## 7.4 回调伪造（支付/第三方）

### 检查点

- [ ] 回调接口是否校验签名（HMAC/RSA/MD5）
- [ ] 签名是否覆盖全部业务字段
- [ ] 重放保护（nonce / 订单状态幂等）
- [ ] 金额是否以回调为准（正确做法是以服务端订单为准）

### 手工步骤

1. 捕获一次正常回调请求
2. 分别做：去签名、改签名、改金额、重放
3. 判定：无签名仍受理 / 金额以回调为准 → 严重

### 修复建议

回调强签名且验签覆盖全字段；金额以服务端订单为准；验签前不落单。

## 误报说明

- 限时优惠的时间窗判断要在服务端时区下分析
- "负数量下单"若只是前端报错、后端拒绝，不算漏洞——以后端订单结果为准

## 输出格式

| 漏洞类型 | 位置 | 参数 | Payload | 证据 | 风险 | 修复建议 |

（另附业务流程说明：前置步骤 → 篡改点 → 结果）
