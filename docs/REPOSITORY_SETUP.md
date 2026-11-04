# 原型仓库初始化说明

> 版本：V0.1｜日期：2026-11-04
> 本轮范围：解压初始化文档、创建独立 Git 仓库、完成首次提交和远程同步。
> 本轮不安装前端依赖，也不开始 Stage 00 原型实现。

## 1. 仓库信息与当前状态

| 项目 | 建议值／说明 |
|---|---|
| 初始化包 | `daguanglu-community-prototype-starter-20261104.zip` |
| 包内顶层目录 | `daguanglu-community-prototype` |
| 本地目录 | `D:\git\daguanglu-community-prototype` |
| GitHub 所有者 | `erya1991`，创建时核对页面上的实际选择 |
| 仓库名称 | `daguanglu-community-prototype` |
| 可见性 | `Private` |
| 默认分支 | `main` |
| 远程状态 | 当前交付未创建或确认可用的远程仓库，需完成下面的创建与校验 |
| Git 状态 | 初始化包不包含 `.git`；首次提交及推送结果以你本地实际执行结果为准 |

该目录独立于现有商城项目。首次提交号、推送状态和分支一致性，应在真实执行后记录，不能从这份说明推定为已完成。

## 2. 在 GitHub 创建空仓库

使用浏览器进入 [GitHub 新建仓库页面](https://github.com/new)，逐项确认：

1. Owner 选择 `erya1991`。
2. Repository name 填写 `daguanglu-community-prototype`。
3. Visibility 选择 `Private`。
4. 不勾选 **Add a README file**；`.gitignore` 和 License 均选择不添加。
5. 创建后，复制页面显示的 **HTTPS 仓库地址**，供第 6 节使用。

按上述信息创建时，地址通常为 `https://github.com/erya1991/daguanglu-community-prototype.git`；执行时使用新建仓库页面实际显示的地址。若页面提示同名仓库已存在，先打开并核对所有者、内容和历史，停止按“空仓库”流程继续操作。

GitHub 官方说明要求：导入已有本地项目时，新远程仓库不预先添加 README、许可证或 `.gitignore`，以避免引入额外的初始化提交。参考：[Adding locally hosted code to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)。

## 3. 在 PowerShell 校验并解压

以下示例假定压缩包位于当前 Windows 用户的“下载”目录。若实际位置不同，只修改 `$starterZip` 为压缩包的完整路径。

先执行此段。压缩包不存在，或目标目录已经存在时，命令会停止；不要覆盖已有目录。

```powershell
$ErrorActionPreference = 'Stop'
$starterZip = Join-Path $env:USERPROFILE 'Downloads\daguanglu-community-prototype-starter-20261104.zip'
$repositoryParent = 'D:\git'
$repositoryPath = Join-Path $repositoryParent 'daguanglu-community-prototype'

if (-not (Test-Path -LiteralPath $starterZip -PathType Leaf)) {
    throw "未找到压缩包，请先修正路径：$starterZip"
}
if (Test-Path -LiteralPath $repositoryPath) {
    throw "目标目录已存在，请先核对其内容，不要覆盖：$repositoryPath"
}
if (-not (Test-Path -LiteralPath $repositoryParent -PathType Container)) {
    New-Item -ItemType Directory -Path $repositoryParent | Out-Null
}

Expand-Archive -LiteralPath $starterZip -DestinationPath $repositoryParent
if (-not (Test-Path -LiteralPath (Join-Path $repositoryPath 'AGENTS.md') -PathType Leaf)) {
    throw '解压后的顶层目录或文件不符合预期，请停止并检查压缩包结构。'
}
Set-Location -LiteralPath $repositoryPath
if (Test-Path -LiteralPath '.git') {
    throw '初始化包不应包含 .git，请停止并核对目录来源。'
}
Get-Location
Get-ChildItem
```

成功后，当前目录应为 `D:\git\daguanglu-community-prototype`，可以看到根目录的 `AGENTS.md`、`README.md` 和 `docs` 等初始化文件。

下面各节按顺序、逐段执行。PowerShell 的 `$ErrorActionPreference` 不能保证所有 Git 命令失败后自动中止，因此关键 Git 命令都附有退出码检查；出现错误就停在当前步骤，处理后再继续。

## 4. 初始化 Git 并核对提交身份

```powershell
git init -b main
if ($LASTEXITCODE -ne 0) { throw 'Git 初始化失败，请停止并检查原因。' }

git status
if ($LASTEXITCODE -ne 0) { throw '无法读取当前仓库状态，请停止。' }
```

查看当前有效的提交姓名和邮箱：

```powershell
git config --get user.name
git config --get user.email
```

这两个查询没有输出，通常表示对应值尚未配置。若已有正确的身份，直接进入第 5 节；若缺少或需要为此项目指定身份，仅设置当前仓库的值。

需要设置姓名时执行：

```powershell
$commitName = Read-Host '请输入你实际使用的 Git 提交姓名'
if ([string]::IsNullOrWhiteSpace($commitName)) { throw '提交姓名不能为空。' }
git config --local user.name $commitName
if ($LASTEXITCODE -ne 0) { throw '当前仓库的提交姓名设置失败。' }
```

需要设置邮箱时执行：

```powershell
$commitEmail = Read-Host '请输入你的实际 Git 提交邮箱（可使用已确认的 GitHub noreply 邮箱）'
if ([string]::IsNullOrWhiteSpace($commitEmail)) { throw '提交邮箱不能为空。' }
git config --local user.email $commitEmail
if ($LASTEXITCODE -ne 0) { throw '当前仓库的提交邮箱设置失败。' }
```

上述设置只作用于当前仓库，不修改全局配置。邮箱和姓名由你填写，不使用文档中的虚构身份。

## 5. 核对文件并完成首次提交

先阅读根目录 `README.md`、`AGENTS.md` 及文档目录，确认本次内容是要交付的初始化材料。此时不需要安装 Node、npm、pnpm 或 GitHub CLI。

```powershell
git status --short
if ($LASTEXITCODE -ne 0) { throw '读取文件状态失败，请停止。' }

git add -- .
if ($LASTEXITCODE -ne 0) { throw '暂存文件失败，请停止。' }

git diff --cached --stat
if ($LASTEXITCODE -ne 0) { throw '读取待提交文件清单失败，请停止。' }

```

检查暂存清单与初始化包内容一致后，执行首次提交：

```powershell
git commit -m "docs: initialize community prototype collaboration"
if ($LASTEXITCODE -ne 0) { throw '首次提交失败，请停止并检查提交身份或提示内容。' }
```

若命令提示没有需要提交的内容，先用 `git status` 和 `git log -1 --oneline` 核对是否已经完成过本步骤，不重复制造提交。

## 6. 关联远程仓库并推送

粘贴第 2 节新建仓库页面实际显示的 HTTPS 地址：

```powershell
$repositoryRemoteUrl = Read-Host '请粘贴新建 GitHub 仓库的 HTTPS 地址'
if ([string]::IsNullOrWhiteSpace($repositoryRemoteUrl)) { throw '远程地址不能为空。' }

git remote add origin $repositoryRemoteUrl
if ($LASTEXITCODE -ne 0) { throw '关联 origin 失败，请先核对现有 remote，不要覆盖已有配置。' }

git remote -v
if ($LASTEXITCODE -ne 0) { throw '读取远程配置失败，请停止。' }
```

核对输出确实指向预期所有者和仓库，再检查远程是否为空：

```powershell
$repositoryRemoteRefs = git ls-remote --heads --tags origin
if ($LASTEXITCODE -ne 0) { throw '无法读取远程仓库，请先确认地址、网络和 GitHub 授权。' }
if ($repositoryRemoteRefs) {
    throw '远程仓库已有分支或标签，请停止并核对其内容与历史，不要按空仓库流程推送。'
}
```

远程检查通过后执行：

```powershell
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw '推送失败，请停止并保留错误信息，处理后再继续。' }
```

若出现登录或授权提示，使用现有 GitHub 授权流程。若推送被拒绝、远程已有提交或提示证书错误，先核对原因；不要使用强制推送、关闭 SSL 验证或修改全局 Git 配置来跳过问题。远程已有历史时，需要先确认正确的仓库与保留方式，本说明不提供覆盖远程历史的操作。

## 7. 交付检查

推送成功后逐行执行；任一命令报错就先处理，不把后续输出当作整体通过证据。

```powershell
git status
git branch --show-current
git log -1 --oneline
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count 'HEAD...origin/main'
```

| 检查项 | 预期结果 |
|---|---|
| 当前目录 | `D:\git\daguanglu-community-prototype` |
| `git status` | 工作区干净，`main` 与 `origin/main` 同步 |
| 当前分支 | `main` |
| 最近提交 | 本地真实执行产生的初始化提交 |
| `HEAD` 与 `origin/main` | 两个完整提交号相同 |
| 左右提交差异 | `0 0` |
| GitHub 页面 | 仓库为 Private，能看到本次文档和提交 |

将实际提交号与检查结果留给后续协作使用。上述操作尚未在你的电脑执行时，只能记录“待执行”，不能写“首次提交完成”或“已推送”。

## 8. 给本地 Codex 的首次核查 Prompt

在 Codex 中打开 `D:\git\daguanglu-community-prototype`，粘贴以下内容：

```text
你现在负责 daguanglu-community-prototype 的初始化核查。

本轮只做只读检查：
1. 确认当前工作目录，读取根目录 AGENTS.md、README.md，以及 docs 中的范围、工作流、阶段计划和 REPOSITORY_SETUP.md。
2. 检查初始化文档是否齐全、内部引用是否可找到、范围和分工表述是否一致；发现缺失只报告。
3. 检查 git status、当前分支、remote、最近提交、HEAD 与 origin/main 的差异，仅报告实际结果；无法读取远程或缺少 origin/main 时明确说明。
4. 输出已读文档、当前 Git 状态、阻塞问题，以及进入下一轮前需要处理的事项。

不要开始 Stage 00；不要安装依赖、创建页面、package.json、前端工程、后端、Mock 或启动服务。
不要修改文件、提交、切换分支、改写 remote 或推送。本轮不把初始化检查升级为原型实施。
```

核查通过后，再根据已确认的范围与工作流下达第一批需求及原型任务。
