# dsh-telegram-bridge

[![validate](https://github.com/narkco-kang/dsh-telegram-bridge/actions/workflows/validate.yml/badge.svg)](https://github.com/narkco-kang/dsh-telegram-bridge/actions/workflows/validate.yml)
[![release](https://github.com/narkco-kang/dsh-telegram-bridge/actions/workflows/release.yml/badge.svg)](https://github.com/narkco-kang/dsh-telegram-bridge/actions/workflows/release.yml)

在 **DeepSeek Harness** 里加一个 Telegram 桥：**绑定一个 Telegram bot**，让你在 Telegram 里用 **Harness Agent（带工具）** 对话。自带配置页，填 bot token + 允许的用户 ID + 开关即可。

> 这是一个可安装的 Harness 插件包（Host + Client）。它通过子进程托管一个 Python 桥，复用 Harness Agent 的 headless/工具链路。

---

## 特性

- **Telegram 对话**：给 bot 发消息，它用完整 Harness Agent（能运行命令/读写文件）回答你。
- **配置页**：DSH 网页 → 设置 → **Telegram 桥**，页面上填 token、允许的用户 ID、工作目录、开关。
- **权限控制**：`allowedUserIds` 白名单，只允许指定用户使用。
- **快捷命令**：`/pwd`、`/ls`、`/cat <文件>`、`/reset`、`/help`。
- **可配置**：`bridgeDir` / `pyCommand` 等可通过插件 `config` 覆盖。

---

## 工作原理

```
你(Telegram) → bot → Python 桥(长轮询 getUpdates)
                        ↓
              完整 Harness Agent (dsh --profile headless，带工具)
                        ↓
              bot 把最终回答 sendMessage 回给你
```

- **Host 插件**（`lib/host.js`）：注册 `telegramBridge` 配置命名空间；按配置用 `subprocess` 启动/停止/重启 Python 桥；把 token / 允许ID / 工作目录通过**环境变量**注入给桥；监听 `settings/updated` 自动同步；暴露 `telegram-bridge:get/set/status` RPC。
- **Client 插件**（`lib/client.js`）：在 `settings.section` 渲染配置页。
- **Python 桥**：`<你的桥项目目录>`（一个独立项目，含 `bot.py` + `.env` + 依赖），接收 env 配置并运行 Agent。

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

# 2) 在组合里加一行（编辑 $DSH_HOME\profiles\web\cordis.patch.yml）
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
> ⚠️ 顺序重要：**先装包再重启**；若 `cordis.patch.yml` 已引用该包但包没装，重启会启动失败。

---

## 使用

1. 重启后打开 DSH 网页 → **设置** → **Telegram 桥**。
2. 填 **Bot Token**（可留空保持当前；已存 token 只显示“已设置”）、**允许的用户 ID**（只填你自己）、**工作目录**（可选）、勾选**启用**，点保存。
3. 状态变“运行中”后，用你的 Telegram 账号给该 bot 发消息即可。
   - **快捷命令**（本地处理，很快）：`/pwd` 看工作目录；`/ls`（或 `/dir`）列出目录；`/cat <文件>` 看文件内容；`/reset` 清空上下文；`/help` 帮助。
   - **普通消息**：会启动一个完整 Harness Agent（能运行命令/读写文件）回答。

---

## 配置

**配置页（settings 命名空间 `telegramBridge`）**

| 字段 | 说明 |
| --- | --- |
| `enabled` | 是否启用（`bool`，默认 false） |
| `botToken` | Telegram bot token（脱敏：get 不回传） |
| `allowedUserIds` | 允许使用的用户 ID（逗号分隔字符串） |
| `workdir` | Agent 工作目录（可选；留空用插件 `config.bridgeDir`） |
| `agentCmd` | Agent 命令行，默认 `npx --yes @deepseek-ai/dsh --profile headless` |
| `pollSeconds` | 轮询间隔（默认 30） |

**插件自身 config（在 `cordis.patch.yml` 的 `config:` 里配置）**

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `bridgeDir` | `<你的桥项目目录>` | Python 桥项目目录（可改） |
| `pyCommand` | `pythonw` | Python 解释器（可改） |

---

## 目录结构

```
dsh-telegram-plugin/
├─ lib/
│  ├─ host.js            # Host：settings + 子进程托管桥 + RPC
│  └─ client.js          # Client：settings.section 配置页
├─ package.json          # 插件包（name: @local/dsh-telegram-bridge）
├─ install-web-profile.ps1   # 一键：备份+装+检查+重启
├─ restart-dsh-web.ps1       # 杀 3080 + 分离重启 dsh web
└─ README.md
```

---

## 故障排查

- **配置页没出现**：包没装成功或包名/`cordis.patch.yml` 的 `name:` 对不上；确认 `profiles\web\package.json` 的依赖里有 `@local/dsh-telegram-bridge`，且 `cordis.patch.yml` 的 `name:` 与它一致。
- **装包报 `spawn powershell.exe ENOENT`**：这是受限环境的进程限制，换到正常 Windows 机器执行。
- **bot 没回应**：确认已启用 + token 正确 + `allowedUserIds` 含你的 ID；看桥日志（`<你的桥项目目录>\bot.log`）与 `dsh-web-restart.log`。
- **Agent 工具不执行**：`dsh --profile headless` 需要能 spawn；在正常机器上运行。

---

## 安全

- **`allowedUserIds` 一定要只填你自己**，否则他人能消耗你的模型额度。
- token 是**脱敏**的（不受 `get` 回传），但会持久化在存储里；勿把 `.env`/存储提交到公开仓库。
- 插件/桥的进程生命周期绑定宿主/会话：宿主停止会把桥一并终止；要长期常驻用 `<你的桥项目目录>\start.bat`。

---

## License

MIT（可按需替换）。
