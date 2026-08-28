// Client module bundle (dsh `__ModuleLoader__` format) — 可视化配置页。
// Host RPC: telegram-bridge:get-config / set-config / status
window.__ModuleLoader__.load({
  id: "@local/dsh-telegram-bridge",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");

    function TelegramBridgePanel() {
      var _ids = React.useState(""), ids = _ids[0], setIds = _ids[1];
      var _w = React.useState(""), workdir = _w[0], setWorkdir = _w[1];
      var _t = React.useState(""), token = _t[0], setToken = _t[1];
      var _e = React.useState(false), enabled = _e[0], setEnabled = _e[1];
      var _tk = React.useState(false), tokenSet = _tk[0], setTokenSet = _tk[1];
      var _r = React.useState(false), running = _r[0], setRunning = _r[1];
      var _p = React.useState(null), pid = _p[0], setPid = _p[1];
      var _m = React.useState(""), msg = _m[0], setMsg = _m[1];

      function refresh() {
        host.call("telegram-bridge:get-config").then(function (c) {
          setIds(c.allowedUserIds || ""); setWorkdir(c.workdir || "");
          setEnabled(!!c.enabled); setTokenSet(!!c.tokenSet);
          setRunning(!!c.running); setPid(c.pid);
        }).catch(function (e) { setMsg("读取配置失败: " + String(e)); });
      }

      React.useEffect(function () { refresh(); }, []);

      function save() {
        var patch = { enabled: enabled, allowedUserIds: ids, workdir: workdir };
        if (token.trim() !== "") patch.botToken = token.trim();
        host.call("telegram-bridge:set-config", { patch: patch }).then(function () {
          setToken(""); setMsg("已保存"); refresh();
        }).catch(function (e) { setMsg("保存失败: " + String(e)); });
      }

      var el = React.createElement;
      return el("div", { style: { display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 } },
        el("h3", null, "Telegram 桥"),
        el("p", null, "填一个 Telegram bot：给 bot 发消息，它会用 Harness Agent（带工具）回答你。"),
        el("label", null, "Bot Token（留空保持当前）"),
        el("input", { type: "password", value: token, placeholder: tokenSet ? "已设置（输入新值更换）" : "粘贴 bot token", onChange: function (e) { setToken(e.target.value); } }),
        el("label", null, "允许的用户 ID（逗号分隔，只填自己）"),
        el("input", { value: ids, placeholder: "如 5588635088", onChange: function (e) { setIds(e.target.value); } }),
        el("label", null, "Agent 工作目录（可选）"),
        el("input", { value: workdir, placeholder: "如 D:\\telegramTran", onChange: function (e) { setWorkdir(e.target.value); } }),
        el("label", null, "启用"),
        el("input", { type: "checkbox", checked: enabled, onChange: function (e) { setEnabled(e.target.checked); } }),
        el("div", null, "状态: " + (running ? ("运行中（PID " + pid + "）") : "已停止")),
        el("div", null,
          el("button", { onClick: save }, "保存"),
          " ",
          el("button", { onClick: refresh }, "刷新")
        ),
        el("div", { style: { color: "#888" } }, msg)
      );
    }

    function apply(ctx) {
      var slots = ctx.get && ctx.get("slots");
      if (slots === undefined) return;
      ctx.effect(function () {
        var disposers = [];
        disposers.push(slots.inject("settings.section", function () {
          return slots.register(
            { name: "settings.section", id: "telegram-bridge", label: "Telegram 桥", order: 60 },
            function () { return React.createElement(TelegramBridgePanel, {}); }
          );
        }));
        return function () { for (var i = 0; i < disposers.length; i++) disposers[i](); };
      }, "telegram-bridge: settings page");
    }

    exports.apply = apply;
    return module.exports;
  }
});
