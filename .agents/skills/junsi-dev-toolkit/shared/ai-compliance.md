# AI 服从性指引

通用规则，补充各子技能的具体流程。

## 破坏性操作红线（最高优先级）

- **禁止**对 `$HOME` / `~` / `%USERPROFILE%` / `$env:USERPROFILE` / `$env:LOCALAPPDATA` / `$env:APPDATA` / 盘根（`C:\`、`/`）及其通配符执行递归删除、递归移动或覆盖。
- 删除/覆盖前必须 `Resolve-Path` / `realpath` 打印**解析后的绝对路径**，确认是具体子目录；含通配符、层级 < 3 段、解析为空 → 停手问用户。
- **禁止删除或覆盖**：`.ssh`、`.gnupg`、`.config`、`.cargo`、`.rustup`、`.bun`、`.local`、`AppData`、`Program Files`、`Windows`、`.git`。
- 禁止用变量拼接删除路径；变量可能为空时禁止删除。
- 卸载/重装运行时或全局包前必须用 `question` 问用户。
- 只清理明确的项目内产物（`./dist`、`./build`、`./node_modules`），先列目标再删。
- 违反任一条 = 立即停止并报告，不得自行"修复现场"。

## 用户提意见时

用户对你的方案/计划说"改一下"时：先停 → 更新方案 → 问确认 → 再改。跳过 = 违规。

## 分支纪律（git checkpoint）

- checkpoint 一律提交在**当前工作分支**，禁止为备份新建、切换或 stash 到别的分支。
- 开工前记录基线分支（`git rev-parse --abbrev-ref HEAD`）。
- **收尾必须回到基线分支**，不得把用户留在 `fix/`、`feat/` 工作分支上：
  - 走 PR：合并后 `git checkout <base> && git pull --ff-only && git branch -d <work>`
  - 不走 PR：`git checkout <base> && git merge --ff-only <work> && git branch -d <work>`
  - PR 未合并：明确报告当前分支、PR 链接与合并后如何切回。
- 收尾回复必须报告当前分支与合并结果。

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
