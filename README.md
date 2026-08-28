# dsh-telegram-bridge

[![validate](https://github.com/narkco-kang/dsh-telegram-bridge/actions/workflows/validate.yml/badge.svg)](https://github.com/narkco-kang/dsh-telegram-bridge/actions/workflows/validate.yml)
[![release](https://github.com/narkco-kang/dsh-telegram-bridge/actions/workflows/release.yml/badge.svg)](https://github.com/narkco-kang/dsh-telegram-bridge/actions/workflows/release.yml)

在 **DeepSeek Harness** 里加一个 Telegram 桥：**绑定一个 Telegram bot**，让你在 Telegram 里用 **Harness Agent（带工具）** 对话。用一个**配置文件**（`bridge.config.json`）填入 bot token + 允许的用户 ID + 开关即可（无需浏览器页面）。

> 这是一个可安装的 Harness 插件包（**Host-only**）。它通过子进程托管一个 Python 桥，复用 Harness Agent 的 headless/工具链路。为规避 dsh 客户端 bundle 与本地包解析的限制，配置走**文件**而非设置页。

---

## 特性

- **Telegram 对话**：给 bot 发消息，它用完整 Harness Agent（能运行命令/读写文件）回答你。
- **配置文件配置**：改 `<bridgeDir>/bridge.config.json`（含 `enabled`/`botToken`/`allowedUserIds`/`workdir`/`agentCmd`/`pollSeconds`），插件每 5 秒自动重读并启停/重启桥。
- **权限控制**：`allowedUserIds` 白名单，只允许指定用户使用。
- **快捷命令**：`/pwd`、`/ls`、`/cat <文件>`、`/reset`、`/help`。
- **可配置**：`bridgeDir` / `pyCommand` / `configFile` 可通过插件 `config` 覆盖（`cordis.patch.yml`）。

---

## 工作原理

```
你(Telegram) → bot → Python 桥(长轮询 getUpdates)
                        ↓
              完整 Harness Agent (dsh --profile headless，带工具)
                        ↓
              bot 把最终回答 sendMessage 回给你
```

- **Host 插件**（`lib/host.js`）：读取 `<bridgeDir>/bridge.config.json`，按配置用 `subprocess` 启动/停止/重启 Python 桥；把 token / 允许ID / 工作目录通过**环境变量**注入给桥；每 5 秒重读配置文件自动同步。
- **Python 桥**：`<你的桥项目目录>`（一个独立项目，含 `bot.py` + `.env` + 依赖），接收 env 配置并运行 Agent。
- 无 Client/配置页 —— 规避了 dsh 客户端 bundle 格式要求（`__ModuleLoader__.load`）与本地包依赖解析问题。

---

## 前置要求

- **DeepSeek Harness**（`dsh web`），且你能编辑其 profile 的 `cordis.patch.yml`。
- **Node.js + npm**（`dsh` 已能调用 corepack/pnpm）。
- **Python 3.8+** 与 `pythonw`；以及一个 **Python 桥项目**（含 `bot.py`、`.env`、`requirements` 依赖）。
  插件通过 `config.bridgeDir` 指向它；本仓库**不含**该桥项目，请把你自己的桥项目路径填到 `bridgeDir`。
- 一个 **Telegram bot**（@BotFather 创建）及它的 **bot token**；你的 Telegram **用户 ID**。

> ❗ 重要：本插件是“壳”，负责按配置把桥拉起来；真正执行 Agent 的是那个 **Python 桥项目**。请先准备一个桥项目（可用配套的桥，或按本项目思路自建），并把它的目录填进 `config.bridgeDir`（默认值是示例，不是通用路径）。

---

## 安装（web profile 为例）

`dsh plugin` 会把参数转发给 profile 目录里的 `pnpm`，且必须带 `--profile`。

```sh
# 0)（可选，推荐）先一键备份 + 装 + 检查 + 重启
powershell -ExecutionPolicy Bypass -File "<插件目录>\install-web-profile.ps1"

# 或分步：
# 1) 把本插件包装进 web profile（本地目录按 file: 处理）
dsh plugin --profile web add <插件目录>
#    或 dsh plugin --profile web add file:<插件目录>

# 2) 组合：包自带 dsh.bundle.patch（插件行在包内 cordis.patch.yml），通常无需再改 web 的
#    cordis.patch.yml；如需覆盖 config，可在 $DSH_HOME\profiles\web\cordis.patch.yml 添加
#    - insert:
#        - id: telegram-bridge
#          name: '@local/dsh-telegram-bridge'
#          config:
#            bridgeDir: '<你的桥项目目录>'
#            pyCommand: 'pythonw'

# 3) 确认依赖已进 package.json（install script 会自动检查）
# 4) 重启 dsh web
```

`install-web-profile.ps1` 一脚本完成：**备份 → 装包 → 检查依赖 → 检查 insert → 分离进程自动重启 dsh web**。想跳过自动重启加 `-NoRestart`；想回滚把 `backup-<时间戳>` 里的文件拷回 profile。

> 其它 profile：把 `web` 换成对应 profile 名。
> ⚠️ 顺序重要：**先装包再重启**。
> ⚠️ 若用**本地目录**安装（`add <本地路径>`），`dsh plugin add` 会用 pnpm 处理，可能改写本地包的部分字段；建议用**发布/克隆的目录**安装，或装完确认包结构无误再重启。

---

## 使用

1. 在**桥项目目录**（`<你的桥项目目录>`）下创建 `bridge.config.json`（参考 `bridge.config.example.json`）：
   ```json
   {
     "enabled": true,
     "botToken": "你的 Telegram bot token",
     "allowedUserIds": "你的 Telegram 用户 ID",
     "workdir": "D:/telegramTran",
     "agentCmd": "npx --yes @deepseek-ai/dsh --profile headless",
     "pollSeconds": 30
   }
   ```
   > 文件不要带 BOM（可用 `bridge.config.example.json` 改名，或用 vs code/记事本存为无 BOM UTF-8）。
2. 重启 dsh web；插件读取配置，若 `enabled=true` 且 `botToken` 非空，就自动拉起桥（日志见 `dsh-web` 输出，桥日志见桥目录 `bot.log`）。
3. 用你的 Telegram 账号给该 bot 发消息即可。
   - **快捷命令**（本地处理，很快）：`/pwd` 看工作目录；`/ls`（或 `/dir`）列出目录；`/cat <文件>` 看文件内容；`/reset` 清空上下文；`/help` 帮助。
   - **普通消息**：会启动一个完整 Harness Agent（能运行命令/读写文件）回答。
4. 改 `bridge.config.json` 后**无需重启**：插件每 5 秒自动重读并启停/重启桥。

---

## 配置

**配置文件 `bridge.config.json`（在 `<bridgeDir>/bridge.config.json`）**

| 字段 | 说明 |
| --- | --- |
| `enabled` | 是否启用（`bool`，默认 false） |
| `botToken` | Telegram bot token（必填，否则不启动） |
| `allowedUserIds` | 允许使用的用户 ID（逗号分隔字符串；只填你自己） |
| `workdir` | Agent 工作目录（可选；留空用插件 `config.bridgeDir`） |
| `agentCmd` | Agent 命令行，默认 `npx --yes @deepseek-ai/dsh --profile headless` |
| `pollSeconds` | 轮询间隔（默认 30） |

**插件自身 config（在 `cordis.patch.yml` 的 `config:` 里配置）**

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `bridgeDir` | `<你的桥项目目录>` | Python 桥项目目录（可改） |
| `pyCommand` | `pythonw` | Python 解释器（可改） |
| `configFile` | `<bridgeDir>/bridge.config.json` | 配置文件路径（可改） |

---

## 目录结构

```
dsh-telegram-plugin/
├─ lib/host.js              # Host：读取 bridge.config.json + 子进程托管桥（无 Client）
├─ package.json             # 插件包（name: @local/dsh-telegram-bridge，Host-only）
├─ cordis.patch.yml         # 包内 bundle patch（插件行）
├─ bridge.config.example.json  # 配置模板（去掉 BOM 后复制为 bridge.config.json）
├─ install-web-profile.ps1   # 一键：备份+装+检查+重启
├─ restart-dsh-web.ps1       # 杀 3080 + 分离重启 dsh web
└─ README.md
```

---

## 故障排查

- **dsh web 启动失败，报 `Cannot find package` / `ERR_MODULE_NOT_FOUND`**：本地包安装了外部依赖但解析不到；本插件 Host-only 已去掉 schemastery 依赖，若你改了包结构请保持无外部运行时依赖（只用 `node:fs`/`node:path` 与 `ctx` 服务）。
- **启动报 `loaded without registering @... via __ModuleLoader__.load`**：是给包加了 Client（`./client`/`dsh.client`）但 `client.js` 不是 `__ModuleLoader__` bundle 所致。Host-only 方案不会有此问题；若加 Client，需把 client 打成 `__ModuleLoader__` bundle。
- **`[telegram-bridge] config read failed ... is not valid JSON`**：`bridge.config.json` 带 BOM 或不是合法 JSON。去掉 BOM（如 `bridge.config.example.json` 改名）并确保是有效 JSON；插件已自动剥 BOM（最新版）。
- **bot 没回应**：确认 `bridge.config.json` 的 `enabled=true`、`botToken` 正确、`allowedUserIds` 含你的 ID；看桥日志（`<你的桥项目目录>\bot.log`）与 dsh web 输出，以及是否真的拉起桥（`pythonw bot.py`）。
- **装包报 `spawn powershell.exe ENOENT`**：受限环境进程限制，换到正常 Windows 机器执行。
- **Agent 工具不执行**：`dsh --profile headless` 需要能 spawn；在正常机器上运行。

---

## 安全

- **`allowedUserIds` 一定要只填你自己**，否则他人能消耗你的模型额度。
- `bridge.config.json` 里的 **`botToken` 是敏感信息**，**不要提交到公开仓库**（repo 里的 `bridge.config.example.json` 是占位符）。
- 插件/桥的进程生命周期绑定宿主/会话：宿主停止会把桥一并终止；要长期常驻用 `<你的桥项目目录>\start.bat`。

---

## License

MIT（可按需替换）。
