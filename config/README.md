# 配置入口

应用配置采用 `userData/config.json` 为默认持久化位置，`paths.configDir` 非空时配置保存到该目录下的 `config.json`。

- 配置字段与安全/迁移说明：[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- 模板：[`config-template.json`](config-template.json)
- 模板唯一结构来源：`src/shared/config-contract.mjs`
- 从契约重新生成模板：`npm run config:template`
- 检查模板、文档内链和仓库路径引用：`npm run docs:config`

`config/config.json` 是被 Git 忽略的本机运行配置，不纳入发布。不要把个人凭据、Telegram Session、代理密码或绝对个人路径写入提交。
