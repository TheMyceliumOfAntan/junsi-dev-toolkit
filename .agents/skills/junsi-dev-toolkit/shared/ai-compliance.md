# AI 服从性指引

通用规则，补充各子技能的具体流程。

## 用户提意见时

用户对你的方案/计划说"改一下"时：先停 → 更新方案 → 问确认 → 再改。跳过 = 违规。

## 验证输出规范

说"验证通过"时，必须：
1. 实际执行了命令（不是肉眼检查/grep）
2. 粘贴了命令输出（至少关键行）
3. 明确说"符合预期"或"不符合预期"

## 文件编辑禁忌（硬性规定，适用于所有语言/框架）

**不要用 PowerShell `Set-Content` / `-replace` / `Out-File` 修改源码文件**（曾致 UTF-8 编码损坏、文件无法编译/运行）。原因：
- PowerShell 的 `-replace` 是正则且 `\n` 会被当字面量，改写会破坏换行与转义
- `Set-Content` 默认编码可能不是 UTF-8（中文注释会乱码）
- 桥接/生成类文件（如 `jni.rs`、plugin JS、`package.json`）可能 untracked 或不在 git 管理内，损坏后 `git checkout` 无法恢复，必须整文件重写

**必须用编辑工具（Read + Edit/Write）修改源码**。涉及临时脚本、测试数据等非源码文件时，若确需 PowerShell 写文件，用 `[System.IO.File]::WriteAllText(path, content, [System.Text.UTF8Encoding]::new($false))` 明确指定 UTF-8 无 BOM。

违规 = 损坏文件后无法 `git checkout` 恢复的，一律按违规处理。
