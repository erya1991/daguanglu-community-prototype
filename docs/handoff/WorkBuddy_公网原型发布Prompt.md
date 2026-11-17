# WorkBuddy｜Stage00～Stage02 公网原型发布 Prompt

目标是把固定 Git 版本的 **Web＋住户H5＋商户H5＋管理端H5** 发布到同一个公网 HTTPS 站点，供研发查看及人工复验。发布顺序及核验顺序为 Stage00 → Stage01 → Stage02。

建议使用 WorkBuddy 当前可用的静态站点发布能力，例如账户内的 EdgeOne Pages／Makers 项目。腾讯云官方说明，WorkBuddy 的 Makers 免登录发布先生成临时预览项目，认领后才归入本人账户；本次需要固定交付地址，应使用已登录项目，或完成临时项目认领并核验正式访问地址。[官方发布说明](https://cloud.tencent.com/document/product/1552/137272)

下面代码块可整体复制给 WorkBuddy。仓库若需要认证，使用 WorkBuddy 所在环境已有的 Git 授权或正常登录，不把令牌填进 Prompt。

## 可直接粘贴的完整 Prompt

```text
请将我已有的大光路社区原型部署为可通过公网 HTTPS 访问的固定演示版本，供研发查看 Stage00～Stage02 功能及进行人工复验。请实际完成取码、构建、发布和浏览器验证，再集中给出结果；不是重新生成一个网站，也不是只给部署建议。

一、固定来源与范围

仓库：https://github.com/erya1991/daguanglu-community-prototype.git
来源分支：main
必须部署的完整提交：4ae6acedb871c6ada656ad9662d543f0a54d8592
版本简称：Stage00-02 / 4ae6ace

即使 main 后续前进，本次也使用以上固定提交。先核验远端、提交存在性及实际检出的 HEAD，记录最终完整 SHA。
在你自己的独立部署目录克隆并检出这个提交；已有同名目录先核验，不清空或覆盖其他工作区，不操作我本机正在开发的工作区。
本次不合并分支、不自动提交或推送、不修改仓库可见性，不把 Stage03 或其他分支的代码混入。

读取固定提交的 AGENTS.md、README.md、docs/WORKFLOW.md，以及 docs/stages/stage-00、stage-01、stage-02 的现行需求与结果。阶段文档有历史记录，菜单及主流程使用当前有效规则，Stage02 特别以 REQUIREMENTS 的第5.8、5.9节为准。

二、需要发布的四个应用

同一个域名下发布四个子路径：
1. /web/      Web 管理后台，Vue 2 / View UI / Manager 兼容工程。
2. /resident/ 住户小程序的 H5 产物。
3. /merchant/ 商户小程序的 H5 产物。
4. /staff/    管理端小程序的 H5 产物。

三个移动应用使用 Vue 3 / TypeScript / uni-app / Vite，仍保留为独立应用。
禁止拆成四个不同域名或子域名；当前跨端模拟数据依赖同源 IndexedDB，还必须使用同一浏览器存储分区与同一 session。
只发布 H5 演示，这不是微信小程序提审或生产系统上线。

保留现有页面、角色、菜单、样例、交互与业务校验。不换框架、不套新模板、不重做 UI、不增加生产后端、云数据库、登录服务或支付服务器。为部署确有必要时，只在部署目录增加入口页、静态托管配置及构建适配，并说明差异。

三、构建要求

先检查项目锁文件、脚本和运行环境。已有验证工具版本为 Node 24.14.0、npm 11.9.0、Yarn 1.22.22；优先使用这一组可用版本，保留 Web yarn.lock 和 miniapp package-lock.json。
Web 与移动端依赖分别安装，不升级依赖、不重写锁文件，不把安装失败改成跳过构建。

必须先同步共享源文件：
node miniapp/scripts/sync-shared.mjs

Windows 环境可按仓库 README：
node scripts/setup-tools.mjs
npm.cmd --prefix miniapp ci --no-audit --no-fund
node .runtime/stage00/tools/yarn/bin/yarn.js --cwd web/manager install --frozen-lockfile --non-interactive
npm.cmd run build:preview

注意：scripts/setup-tools.mjs、scripts/build-preview.mjs 以及 miniapp 部分外层脚本包含 npm.cmd，不能原样假设它们在 Linux 可运行。
Linux / 云构建使用等价命令，不修改业务代码。可在临时工具目录安装准确的 yarn@1.22.22，并用 node 调用其 yarn.js：
1. npm install --prefix .runtime/deploy-tools --no-save --package-lock=false --ignore-scripts --no-audit --no-fund yarn@1.22.22
2. node .runtime/deploy-tools/node_modules/yarn/bin/yarn.js --cwd web/manager install --frozen-lockfile --non-interactive
3. npm --prefix miniapp ci --no-audit --no-fund
4. node miniapp/scripts/sync-shared.mjs
5. node .runtime/deploy-tools/node_modules/yarn/bin/yarn.js --cwd web/manager build
6. 在 miniapp 目录依次运行：
   npm run build:h5 --workspace=@daguanglu/resident-miniapp
   npm run build:h5 --workspace=@daguanglu/merchant-miniapp
   npm run build:h5 --workspace=@daguanglu/staff-miniapp

上面第1项的 --package-lock=false 只针对临时 Yarn 工具目录；项目 Web 和移动端锁文件始终保留并严格使用。
移动 App 的底层 run-uni.mjs 已区分系统命令，优先直接调用各 workspace 的 build:h5，不使用含 npm.cmd 的外层聚合入口。
记录实际 Node/npm/Yarn 版本、各构建命令和结果。确有环境不兼容时，报告具体错误，并在不改业务和锁文件的范围内解决部署适配。

四、组装一个干净发布目录

创建仅用于发布的目录，例如 publish/：
publish/
  index.html
  version.json
  web/       ← web/manager/dist 的内容
  resident/  ← miniapp/apps/resident-miniapp/dist/build/h5 的内容
  merchant/  ← miniapp/apps/merchant-miniapp/dist/build/h5 的内容
  staff/     ← miniapp/apps/staff-miniapp/dist/build/h5 的内容

复制的是构建目录“内容”，不要形成 /web/dist/ 或 /resident/h5/ 等错误层级。
保留 /web/、/resident/、/merchant/、/staff/ 的资源 base 和原路由方式。检查实际产物中的 JS、CSS、字体、图片及懒加载引用，确保资源存在，不能把缺失的 .js 请求返回成 HTML 来掩盖 404。

根 index.html 仅作为四端入口，展示项目名、固定版本和四个清晰链接，不改四端业务页面。
所有入口统一使用 session=handoff-0002-4ae6ace，并把 query 放在 # 前面：
/web/?session=handoff-0002-4ae6ace#/dashboard
/resident/?session=handoff-0002-4ae6ace#/pages/home/index
/merchant/?session=handoff-0002-4ae6ace#/pages/workbench/index
/staff/?session=handoff-0002-4ae6ace#/pages/workbench/index
如实际页面注册不同，按固定代码修正并记录；不可凭空造路由。

version.json 只记录项目名、完整 commit SHA、构建时间及四端构建结果，不放本地路径、账户信息或凭据。

本地 preview.mjs 另有 /_shared 和 /_preview.json 开发挂载，不要整仓复制来照搬这些挂载。正式发布以已构建资源为准；若产物确有额外运行时引用，先查清最小文件依赖，只加入实际需要且可公开的文件。
不要上传 .git、node_modules、.runtime、源配置、.env、私钥、访问令牌、运行日志和本机资料。演示只使用仓库已有虚构样例，不导入真实住户或资金数据。
无需把19221端口直接暴露到公网，也不要把本地开发服务器或临时隧道当固定托管版本。

五、发布方式

先检查你当前可用的站点发布工具、技能、账号与项目，优先使用能够托管上述单目录结构的静态站点服务。EdgeOne Pages / Makers 等账户内项目可作为选择，以实际支持的能力为准。
我要可持续访问并能追溯固定 SHA 的版本，不接受只返回一个即将失效的临时预览地址作为最终交付。

如使用 WorkBuddy 的 EdgeOne Makers 免登录部署，按工具返回的时限完成项目认领；未认领时明确标为临时地址，说明剩余人工步骤，不能宣称固定版本交付完成。
如果已有登录授权和适用项目，继续执行已授权的部署；缺少 Git 或托管登录时，完成其余准备后让我在官方页面登录，不索取明文令牌。新增付费资源或覆盖不属于本项目的站点前再说明具体对象与费用，不随意改 DNS 或其他项目。

使用 HTTPS，保留四个路径及必要的 SPA 路由行为。HTML / version.json 要能及时取得当前版本；带内容哈希的静态资源可缓存。不要用旧站点缓存或旧构建目录替代本次产物。
最终保留此次部署 ID、完整 SHA 和可重新发布的方法；不要自动把后续 main 的变化覆盖到本次固定演示版。

六、实际验证，顺序为 Stage00 → Stage01 → Stage02

先做发布验证：
- 根入口、四端入口、样式及图片可加载；深链直接打开、刷新、返回、懒加载页面正常。
- Web 1366×768、移动390×844至少各检查一次；没有整页横向溢出，底部主操作可见。
- 平台管理员可看到全部已授权 Web 服务菜单，物业管理员按实际权限查看；不要把缺菜单误当构建问题。
- 浏览器网络和控制台没有阻断错误；不只用 HTTP 200 声称页面正常。

再按同一浏览器、同一源、同一 session 执行以下简短业务检查，并记录实际数据名称或单号：
1. Stage00：住户查看本人房屋／绑定／车辆；Web 与管理端可在授权范围看到相同档案。验证一项可逆资料操作或新测试绑定流程，检查刷新后仍保留。
2. Stage01：使用界面实际存在的测试账单，住户单账单模拟缴费，Web查看对应结果；新建一笔报修，物业派单、开始、提交处理结果，住户确认和评价。Stage01仍保留住户确认步骤。
3. Stage02上门：林悦（resident-a）选择家庭保洁→单次2小时基础保洁→上门99元；青禾家政服务商（service-merchant-a）接单派工给陈师傅，提交结果；林悦评价。Web订单和资金、商户首页同步更新。
4. Stage02到店：林悦选择台式循环扇清洗→单台可拆洗款→预约到店59元→青禾社区便民服务点，派工后查看到店凭证；商户在结果提交时一并核验，再由住户评价。不要误选同规格89元的上门方式。

派工日期选验证当天，时段选择当前有效范围。新建必要的模拟地址即可，不填真实个人信息。
Stage02当前主线没有居民确认安排、到场、开始、居民确认完成；不得为通过检查补回这些旧步骤。
演示99元商户分账89元、59元商户分账53.04元是本地测试结果，不是真实支付或商业费率。刷新及重复进入不能重复新增资金记录。

发布验证如果发现原型自身问题，只记录复现、页面和证据，不在本发布任务中擅自改业务；若是静态路径、缓存、构建环境问题，直接修正发布配置后复测。
浏览器、登录或设备条件不足时标出未执行项，不把构建成功写成人工验收通过。

七、最终集中交付

按以下内容给出简洁结果：
1. 公网总入口，以及 Web、住户、商户、管理端四个可点击链接，均带同一 session。
2. 实际仓库、完整 SHA、构建时间、托管平台、项目归属和部署 ID；是否已成为账户内固定项目。
3. 四端构建及上述页面／主线检查的实际结果、测试单号或证据；未执行和失败项明确列出。
4. 演示账号及切换方法；说明同浏览器同源可共享模拟数据，不同访问者／电脑各有本地样例，无法跨设备实时协作。
5. 需要我完成的登录、认领等真正剩余事项；没有剩余则不加泛泛待办。
6. 下次按新 SHA 更新或回到本次固定版本的方法，不改变源仓库代码。

最后状态写“Stage00～Stage02公网原型已发布／待人工验证”，或按实际阻塞说明。不要写真实支付通过、微信已上线、Stage01／02 PASS或研发已验收。
```

## 与研发交接的配套关系

- 功能开发范围使用[大光路社区开发交接文档](大光路社区_开发交接文档.md)，其内容按 Stage00 → Stage01 → Stage02 排列。
- 本次远端固定应用代码为 `4ae6acedb871c6ada656ad9662d543f0a54d8592`。两份交接文档统一由 main 的后续文档提交维护；WorkBuddy 不需要从上述应用代码提交找到本文，直接粘贴上面的完整 Prompt 即可执行。
- 当前聊天只提供发布 Prompt，没有执行公网部署、修改域名或启动云端资源。
