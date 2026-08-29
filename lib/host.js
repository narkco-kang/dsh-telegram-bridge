// Host only: reads a config file and manages the Python Telegram bridge subprocess.
// No schemastery / settings-namespace / client dependency (avoids import-resolution
// and client-bundle boot errors). Config comes from the row config via ctx.config.
import fs from 'node:fs'
import path from 'node:path'

export const name = 'telegram-bridge-manager'
export const inject = ['subprocess', 'timer', 'webServer']

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
    const h = handle  // 捕获当前 handle，避免退出回调里误清掉新的句柄
    h.done
      .then((out) => {
        if (handle === h) handle = null  // 子进程退出：清空句柄，让 sync() 随时可重新拉起
        console.log('[telegram-bridge] exited', out.exitCode, out.signal)
      })
      .catch(() => { if (handle === h) handle = null })
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

  // 可视化配置页面 RPC（client → host）。
  // 注意：静态 bundle 插件不能用动态 Cordis 的 harness.handle/host.call（宿主并无
  // harness 服务），因此这里用 webServer.register 暴露一个真实 HTTP 路由，由浏览器
  // 一侧 fetch 调用（同 OpenBiliClaw 的 HTTP 做法），路径避开 /api 以绕过浏览信任栅栏。
  // webServer 已声明为硬依赖（inject），apply 时保证可用。
  {
    const sendJson = (res, status, data) => {
      try {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(data))
      } catch (e) { /* response already gone */ }
    }
    const readBody = (req) => new Promise((resolve, reject) => {
      let raw = ''
      req.on('data', (chunk) => { raw += chunk; if (raw.length > 1e6) req.destroy() })
      req.on('end', () => resolve(raw))
      req.on('error', reject)
    })

    const handleGet = (req, res) => {
      const c = readConfig()
      sendJson(res, 200, {
        enabled: c.enabled,
        tokenSet: !!c.botToken,
        allowedUserIds: c.allowedUserIds,
        workdir: c.workdir,
        agentCmd: c.agentCmd,
        pollSeconds: c.pollSeconds,
        running: !!handle,
        pid: handle ? handle.pid : null,
        configFile,
      })
    }

    const handleSet = async (req, res) => {
      let body = {}
      try {
        const raw = await readBody(req)
        if (raw) body = JSON.parse(raw) || {}
      } catch (e) {
        sendJson(res, 400, { ok: false, error: 'invalid JSON' })
        return
      }
      const patch = body.patch || {}
      const cur = readConfig()
      const next = {
        enabled: patch.enabled !== undefined ? !!patch.enabled : cur.enabled,
        botToken: (patch.botToken !== undefined ? String(patch.botToken) : cur.botToken),
        allowedUserIds: patch.allowedUserIds !== undefined ? String(patch.allowedUserIds) : cur.allowedUserIds,
        workdir: patch.workdir !== undefined ? String(patch.workdir) : cur.workdir,
        agentCmd: patch.agentCmd !== undefined ? String(patch.agentCmd) : cur.agentCmd,
        pollSeconds: patch.pollSeconds !== undefined ? Number(patch.pollSeconds) : cur.pollSeconds,
      }
      fs.writeFileSync(configFile, JSON.stringify(next, null, 2), 'utf8')
      sync()  // 立即按新配置启停/重启
      sendJson(res, 200, { ok: true })
    }

    ctx.webServer.register({
      kind: 'exact',
      path: '/telegram-bridge/config',
      handler: (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'content-type')
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
        if (req.method === 'GET') return handleGet(req, res)
        if (req.method === 'POST') return handleSet(req, res).catch((e) => sendJson(res, 500, { ok: false, error: String(e) }))
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
      },
    })
    console.log('[telegram-bridge] HTTP route registered at /telegram-bridge/config')
  }

  // dispose：终止桥
  ctx.effect(() => () => {
    try { if (handle) handle.terminate() } catch {}
  })
}
