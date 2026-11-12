# Stage00 来源及适用声明

移动端框架提取自 Smart-Community-miniapp，Manager 布局和构建提取自 LiLiShop UI；精确版本及逐文件摘要见 docs/stages/stage-00/evidence/source-manifest.json。Manager 原许可保留于 web/manager/LICENSE。仅限本次获准原型工作区使用；本轮无源码公开或发布授权。

页面已移除源项目业务初始化、登录、Token、请求、上传与消息逻辑。此原型的 Mock、演示身份、复位和本地存储不构成生产鉴权或后端实现。

2026-11-09 R3：对锁定的 Apache-2.0 包 @dcloudio/uni-h5 3.0.0-5020420260813003 应用仓内可复现的选择器卸载保护补丁，仅为260ms关闭计时器补空引用判断。原依赖与许可保持，摘要及原因见[补丁记录](docs/stages/stage-00/evidence/r3-h5-picker-patch.json)，实现见[应用脚本](miniapp/scripts/apply-h5-picker-fix.mjs)；不修改商城源工程或全局依赖。

## Stage02 二维码编码器
Stage02仅复用移动端现有锁文件内 `qrcode-terminal@0.12.0` 的 `vendor/QRCode` 纯JavaScript编码器，未新增依赖，未使用其Node终端入口。该vendor源码头部标注“QRCode for JavaScript”，Copyright (c) 2009 Kazuhiko Arase，MIT许可；包根的Apache 2.0许可证属于包级声明，两者不混同。原依赖及vendor声明保持在安装包内，正式研发交接/再分发时一并保留适用声明。
二维码在本原型中编码同一服务凭证内容；编码/解码自测不等于微信扫码、真实核验接口或跨App同步已验证。本工作区没有公开或发布这些源码。

2026-11-09移动端整合：参考Smart-Community-miniapp固定版本8f15eed1255222ff9178b529d7a3039bfd67fab6的导航、社区横幅及既有主题与图标。仅在授权本地原型内复用，不引入商城交易、登录或Token，不修改来源仓库。
