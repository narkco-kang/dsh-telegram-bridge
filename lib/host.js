// Host only: reads a config file and manages the Python Telegram bridge subprocess.
// No schemastery / settings-namespace / client dependency (avoids import-resolution
// and client-bundle boot errors). Config comes from the row config via ctx.config.
import fs from 'node:fs'
import path from 'node:path'

export const name = 'telegram-bridge-manager'
export const inject = ['subprocess', 'timer']

export function apply(ctx) {
  const cfg0 = {
  bridgeDir: process.env.DSH_TELEGRAM_BRIDGE_DIR || 'D:/dsh-telegram-full',
  pyCommand: process.env.DSH_TELEGRAM_PY_COMMAND || 'pythonw',
  configFile: process.env.DSH_TELEGRAM_CONFIG_FILE || 'D:/dsh-telegram-full/bridge.config.json'
}
  const bridgeDir = cfg0.bridgeDir || 'D:/dsh-telegram-full'
  const pyCommand = cfg0.pyCommand || 'pythonw'
  const configFile = cfg0.configFile || path.join(bridgeDir, 'bridge.config.json')
  const sub = ctx.subprocess
  let handle = null

  const DEFAULTS = {
    enabled: false,
    botToken: '',
    allowedUserIds: '',
    workdir: bridgeDir,
    agentCmd: 'npx --yes @deepseek-ai/dsh --profile headless',
    pollSeconds: 30,
  }

  function readConfig() {
    try {
      const raw = fs.readFileSync(configFile, 'utf8').replace(/^\uFEFF/, '')  // 剥掉可能的 BOM
      const c = JSON.parse(raw)
      return {
        enabled: !!c.enabled,
        botToken: (c.botToken || '').trim(),
        allowedUserIds: (c.allowedUserIds || '').trim(),
        workdir: (c.workdir || '').trim() || bridgeDir,
        agentCmd: (c.agentCmd || '').trim() || DEFAULTS.agentCmd,
        pollSeconds: c.pollSeconds || 30,
      }
    } catch (e) {
      console.error('[telegram-bridge] config read failed (using defaults):', String(e), 'file:', configFile)
      return DEFAULTS
    }
  }

  async function start() {
    const c = readConfig()
    let py = pyCommand
    try { py = await sub.resolveExecutable(pyCommand) } catch {}
    handle = sub.spawn({
      argv: [py, 'bot.py'],
      cwd: bridgeDir,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } },
        stderr: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } },
      },
      graceMs: 2000,
      env: {
        TELEGRAM_BOT_TOKEN: c.botToken,
        ALLOWED_USER_IDS: c.allowedUserIds,
        AGENT_WORKDIR: c.workdir,
        AGENT_CMD: c.agentCmd,
      },
    })
    console.log('[telegram-bridge] started PID', handle.pid)
    handle.done
      .then((out) => console.log('[telegram-bridge] exited', out.exitCode, out.signal))
      .catch(() => {})
  }

  function stop() {
    if (handle) {
      try { handle.terminate() } catch {}
      handle = null
    }
  }

  function sync() {
    const c = readConfig()
    if (c.enabled && c.botToken) {
      if (!handle) start().catch((e) => console.error('[telegram-bridge] start error', String(e)))
    } else if (handle) {
      stop()
    }
  }

  sync()
  // 每 5s 重读配置，改 bridge.config.json 即自动启停/重启
  ctx.interval(() => sync(), 5000)

  // dispose：终止桥
  ctx.effect(() => () => {
    try { if (handle) handle.terminate() } catch {}
  })
}
