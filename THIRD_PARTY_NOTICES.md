# Stage00 来源及适用声明

移动端框架提取自 Smart-Community-miniapp，Manager 布局和构建提取自 LiLiShop UI；精确版本及逐文件摘要见 docs/stages/stage-00/evidence/source-manifest.json。Manager 原许可保留于 web/manager/LICENSE。仅限本次获准原型工作区使用；本轮无源码公开或发布授权。

页面已移除源项目业务初始化、登录、Token、请求、上传与消息逻辑。此原型的 Mock、演示身份、复位和本地存储不构成生产鉴权或后端实现。

2026-11-09 R3：对锁定的 Apache-2.0 包 @dcloudio/uni-h5 3.0.0-5020420260813003 应用仓内可复现的选择器卸载保护补丁，仅为260ms关闭计时器补空引用判断。原依赖与许可保持，摘要及原因见[补丁记录](docs/stages/stage-00/evidence/r3-h5-picker-patch.json)，实现见[应用脚本](miniapp/scripts/apply-h5-picker-fix.mjs)；不修改商城源工程或全局依赖。
