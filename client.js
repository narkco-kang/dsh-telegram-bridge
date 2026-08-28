// Client half: a settings page for the Telegram bridge.
export const name = 'telegram-bridge-settings'

function TelegramBridgePage() {
  const [ids, setIds] = React.useState('')
  const [workdir, setWorkdir] = React.useState('')
  const [token, setToken] = React.useState('')
  const [enabled, setEnabled] = React.useState(false)
  const [tokenSet, setTokenSet] = React.useState(false)
  const [running, setRunning] = React.useState(false)
  const [pid, setPid] = React.useState(null)
  const [msg, setMsg] = React.useState('')

  const refresh = () => {
    host.call('telegram-bridge:get').then((c) => {
      setIds(c.allowedUserIds || ''); setWorkdir(c.workdir || '')
      setEnabled(!!c.enabled); setTokenSet(!!c.tokenSet)
      setRunning(!!c.running); setPid(c.pid)
    }).catch((e) => setMsg('读取配置失败：' + String(e)))
  }

  React.useEffect(() => { refresh() }, [])

  const save = () => {
    const patch = { enabled, allowedUserIds: ids, workdir }
    if (token.trim() !== '') patch.botToken = token.trim()
    host.call('telegram-bridge:set', { patch }).then(() => {
      setToken(''); setMsg('已保存'); refresh()
    }).catch((e) => setMsg('保存失败：' + String(e)))
  }

  const input = React.createElement
  return input('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 } },
    input('h3', null, 'Telegram 桥'),
    input('p', null, '填一个 Telegram bot：把这个 bot 加进群后，你在 Telegram 里给它发消息，它就用 Harness Agent（带工具）回答你。'),
    input('label', null, 'Bot Token（留空则保持当前已保存的）'),
    input('input', { type: 'password', value: token, placeholder: tokenSet ? '已设置（输入新值以更换）' : '粘贴 bot token', onChange: (e) => setToken(e.target.value) }),
    input('label', null, '允许使用的用户 ID（逗号分隔，只填你自己）'),
    input('input', { value: ids, placeholder: '如 5588635088', onChange: (e) => setIds(e.target.value) }),
    input('label', null, 'Agent 工作目录（可选；留空用桥目录）'),
    input('input', { value: workdir, placeholder: '如 D:\\telegramTran', onChange: (e) => setWorkdir(e.target.value) }),
    input('label', null, '启用'),
    input('input', { type: 'checkbox', checked: enabled, onChange: (e) => setEnabled(e.target.checked) }),
    input('div', null, '状态：' + (running ? ('运行中（PID ' + pid + '）') : '已停止')),
    input('div', null, input('button', { onClick: save }, '保存'),
      ' ', input('button', { onClick: refresh }, '刷新')),
    input('div', { style: { color: '#888' } }, msg),
  )
}

export function apply(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return
  slots.inject('settings.section', () => slots.register(
    { name: 'settings.section', id: 'telegram-bridge', label: 'Telegram 桥', order: 60 },
    () => React.createElement(TelegramBridgePage, {}),
  ))
}

// Auto-register for dsh web
if (window.__ModuleLoader__) {
  window.__ModuleLoader__.load('@local/dsh-telegram-bridge', {
    setup(ctx) {
      apply(ctx);
    }
  });
}
