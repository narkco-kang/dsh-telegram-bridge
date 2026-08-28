# Contributing（贡献指南）

感谢你关注本插件！欢迎提 issue、建议、或直接提交 PR。

## 这个项目是什么

一个 DeepSeek Harness 插件：绑定 Telegram bot，让你在 Telegram 里用 Harness Agent。它本身是一个“壳”，负责按配置拉起/托管一个 **Python 桥项目**（真正执行 Agent 的部分，需另行提供，见 `README`）。

## 环境准备

- Node.js 18+ / npm（`dsh` 通过 corepack 调用 pnpm）。
- Python 3.8+ 与 `pythonw`，以及一个可用的桥项目（用于本地测试托管逻辑）。
- `dsh web`（用于本地验证插件挂载、配置页）。

## 如何提交改动

1. **先开 issue**：说明你想修的问题/加的功能，方便对齐。
2. **fork + 分支**：从 `main` 拉一个功能分支，命名如 `feat/xxx`、`fix/xxx`。
3. **提交信息**（Conventional Commits 风格）：
   ```
   feat: add xxx
   fix: fix xxx
   docs: update xxx
   refactor: ...
   ```
4. **写清楚**：改动动机、影响、如何测试。
5. **提 PR** 到 `main`，附简短说明 + 是否经过 `install-web-profile.ps1` / 手动挂载验证。

## 代码约定

- Host 侧（`lib/host.js`）：只做配置 + 子进程托管 + RPC；bridge 的路径/命令通过 `config.bridgeDir` / `config.pyCommand` 暴露，**不要硬编码**本机绝对路径。
- Client 侧（`lib/client.js`）：用 `React.createElement`，注册到 `settings.section`；token 要**脱敏**（`get` 不回传）。
- 配置文件、脚本里的提示文字**避免**会引起 PowerShell 解析报错的满宽标点（如 `（）`、`——`）。
- 敏感信息（token、密钥、`.env`）**绝不**提交进仓库。

## 测试

- 语法：对 `.ps1` 用 PowerShell parser 校验；对 `.js` 用 Node 解析。
- 功能：在 `dsh web` 里挂载插件，看配置页、填 token、启停、发消息。

## License

MIT（见 `LICENSE`）。
