# Changelog

`dsh-telegram-bridge` 的版本历史。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.1.0] - 2026-08-28

### Added

- Host 插件（`lib/host.js`）：
  - 注册 `telegramBridge` 配置命名空间（`enabled` / `botToken` / `allowedUserIds` / `workdir` / `agentCmd` / `pollSeconds`）。
  - 用 `subprocess` 按配置启动/停止/重启 Python 桥，并通过**环境变量**注入 token / 允许用户 / 工作目录 / Agent 命令。
  - 监听 `settings/updated` 自动同步；暴露 `telegram-bridge:get/set/status` RPC（token 脱敏）。
- Client 插件（`lib/client.js`）：在 `settings.section` 渲染“Telegram 桥”配置页（填 bot token、允许用户 ID、工作目录、开关）。
- 一键安装脚本 `install-web-profile.ps1`：备份 → 装包 → 检查依赖 → 检查 insert → 分离进程自动重启 `dsh web`；支持 `-NoRestart`。
- 重启脚本 `restart-dsh-web.ps1`：杀掉占用 3080 的 dsh web 并分离重启。
- 文档：`README.md`（功能/安装/使用/配置/排查）、`CONTRIBUTING.md`、`LICENSE`(MIT)。

### Notes

- 插件是“壳”：真正执行 Agent 的是外部 **Python 桥项目**，路径通过 `config.bridgeDir` 配置（默认值是示例）。
