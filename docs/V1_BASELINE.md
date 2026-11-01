# KuruHaru v1 基线

> 状态：`current`
> 校验日期：2026-11-01
> 适用平台：Windows 优先的 Electron + Vue 3 应用

## 产品边界

KuruHaru 负责 ASMR 内容发现与整理、音声下载、Whisper 字幕处理、Telegram 登录/上传/搜索、信息缓存、重复检测、自动翻译和本地/云端清理。Aria2、Whisper 可执行文件、Telegram、ASMR.ONE、网络代理和账号凭据属于运行环境依赖。

## 当前架构事实

- Main 进程负责 Electron 生命周期、系统能力、IPC 注册、后台任务启动和退出清理。
- Preload 只暴露能力白名单；Renderer 通过 `src/renderer/src/api/` 访问 Main。
- `src/main/bootstrap/module-assembly.js` 是模块组合根；`src/main/domains/` 提供领域装配边界；`src/main/modules/` 保留业务实现。
- `src/shared/config-contract.mjs` 是配置结构和默认值的唯一来源；模板由命令生成。
- 下载、上传、转写、自动翻译、缓存和删除均有独立的状态或审计持久化边界。

## v1 业务不变量

- Whisper 模型、精度、batch、解码参数和字幕完整性检查不因界面或架构整理而改变。
- Telegram 搜索顺序、命令、权限、黑名单和链接优先级保持不变。
- 已确认成功的上传不得重发；不确定结果必须进入复核，不得自动重发。
- RJ 重复检测默认保留最新匹配项；删除必须经过预览、授权和审计。
- ASMR 指纹、格式优先级、视频兜底、去重和人工复核规则保持不变。
- 自动翻译只有在上传成功且云端队列项清理成功后才算完成。
- 清理操作必须限制在授权路径内，先预览再执行，并保留结果记录。

## 证据边界

| 级别 | 说明 |
| --- | --- |
| S0 | 当前路径、模块归属和文档链接可从源码确认 |
| S1 | 测试、协议检查、文档检查、lint 和构建 |
| S2 | Electron 启动、IPC、退出和重启恢复 |
| S3 | GUI、键盘、焦点、窄窗口和错误状态 |
| S4 | Telegram、ASMR.ONE、Aria2、Whisper 长任务和 Windows 安装包 |

通过 S1 不代表 S2-S4 已交付；各级证据必须单独记录。
