# Stage00 来源及适用声明

移动端框架提取自 Smart-Community-miniapp，Manager 布局和构建提取自 LiLiShop UI；精确版本及逐文件摘要见 docs/stages/stage-00/evidence/source-manifest.json。Manager 原许可保留于 web/manager/LICENSE。仅限本次获准原型工作区使用；本轮无源码公开或发布授权。

页面已移除源项目业务初始化、登录、Token、请求、上传与消息逻辑。此原型的 Mock、演示身份、复位和本地存储不构成生产鉴权或后端实现。

## Stage02 二维码编码器

Stage02仅复用移动端现有锁文件内 `qrcode-terminal@0.12.0` 的 `vendor/QRCode` 纯JavaScript编码器，未新增依赖，未使用其Node终端入口。该vendor源码头部标注“QRCode for JavaScript”，Copyright (c) 2009 Kazuhiko Arase，MIT许可；包根的Apache 2.0许可证属于包级声明，两者不混同。原依赖及vendor声明保持在安装包内，正式研发交接/再分发时一并保留适用声明。

二维码在本原型中编码同一服务凭证内容；编码/解码自测不等于微信扫码、真实核验接口或跨App同步已验证。本工作区没有公开或发布这些源码。
