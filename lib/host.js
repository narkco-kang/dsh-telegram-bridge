// Host half: manages the Python Telegram bridge from a settings namespace.
import z from '@deepseek-ai/schemastery'

export const name = 'telegram-bridge-manager'
export const inject = ['settings', 'subprocess']

// 插件自身配置：可用 cordis 组合覆盖（config.bridgeDir / config.pyCommand）。
export const config = z.object({
  bridgeDir: z.string().default('D:/dsh-telegram-full'),
  pyCommand: z.string().default('pythonw'),
})

const NAMESPACE = 'telegramBridge'

const schema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().default(''),
  allowedUserIds: z.string().default(''),
  workdir: z.string().default(''),
  agentCmd: z.string().default('npx --yes @deepseek-ai/dsh --profile headless'),
  pollSeconds: z.number().default(30),
})

export function apply(ctx, config) {
  const settings = ctx.settings
  const sub = ctx.subprocess

  settings.register(NAMESPACE, schema)
  const read = () => settings.get(NAMESPACE) || {}

  function cfg() {
    const c = read()
    return {
      enabled: !!c.enabled,
      botToken: (c.botToken || '').trim(),
      allowedUserIds: (c.allowedUserIds || '').trim(),
      workdir: (c.workdir || '').trim() || config.bridgeDir,
      agentCmd: (c.agentCmd || '').trim() || 'npx --yes @deepseek-ai/dsh --profile headless',
      pollSeconds: c.pollSeconds || 30,
    }
  }

  let handle = null

  function wantsRunning() {
    const c = cfg()
    return c.enabled && !!c.botToken
  }

  async function start() {
    const c = cfg()
    let py = config.pyCommand
    try { py = await sub.resolveExecutable(config.pyCommand) } catch {}
    // 把配置通过 env 注入给 Python 桥（桥读取 os.getenv；load_dotenv 不覆盖已有 env）
    const env = {
      TELEGRAM_BOT_TOKEN: c.botToken,
      ALLOWED_USER_IDS: c.allowedUserIds,
      AGENT_WORKDIR: c.workdir,
      AGENT_CMD: c.agentCmd,
    }
    handle = sub.spawn({
      argv: [py, 'bot.py'],
      cwd: config.bridgeDir,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } },
        stderr: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } },
      },
      graceMs: 2000,
      env,
    })
    console.log('[telegram-bridge] started PID', handle.pid)
    handle.done
      .then((out) => console.log('[telegram-bridge] exited', out.exitCode, out.signal))
      .catch(() => {})
  }

  async function stop() {
    if (handle) {
      try { handle.terminate() } catch {}
      handle = null
    }
  }

  function sync() {
    if (wantsRunning()) {
      if (!handle) start().catch((e) => console.error('[telegram-bridge] start error', String(e)))
    } else {
      stop()
    }
  }

  sync()

  // 配置变化时同步（重启/停止）
  ctx.on('settings/updated', (ns) => {
    if (ns === NAMESPACE) sync()
  })

  // 配置页 RPC（脱敏：不回传 token）
  const harness = ctx.get('harness')
  if (harness) {
    harness.handle('telegram-bridge:get', () => {
      const c = cfg()
      return {
        enabled: c.enabled,
        tokenSet: !!c.botToken,
        allowedUserIds: c.allowedUserIds,
        workdir: c.workdir,
        agentCmd: c.agentCmd,
        pollSeconds: c.pollSeconds,
        running: !!handle,
        pid: handle ? handle.pid : null,
      }
    })
    harness.handle('telegram-bridge:set', async (args) => {
      const patch = (args && args.patch) || {}
      // 空 token 视为“不改”，避免把已存 token 清空
      if (typeof patch.botToken === 'string' && patch.botToken.trim() === '') delete patch.botToken
      await settings.update(NAMESPACE, patch)
      return { ok: true }
    })
    harness.handle('telegram-bridge:status', () => ({
      running: !!handle,
      pid: handle ? handle.pid : null,
    }))
  }

  // dispose：终止桥
  ctx.effect(() => () => {
    try { if (handle) handle.terminate() } catch {}
  })
}
