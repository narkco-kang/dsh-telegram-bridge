// Client module bundle (dsh `__ModuleLoader__` format) — OpenBiliClaw-style right-side panel.
// `sidebar.footer.action` button toggles a DOM-mounted `aside` panel with the config form.
// Host RPC: telegram-bridge:get-config / set-config / status
window.__ModuleLoader__.load({
  id: "@local/dsh-telegram-bridge",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");
    var ReactDOM = require("react-dom/client");

    var OPEN_KEY = "dsh-telegram-bridge:panel-open";

    function createLayout() {
      var open = false;
      try { open = localStorage.getItem(OPEN_KEY) === "1"; } catch (e) {}
      var listeners = [];
      function emit() { for (var i = 0; i < listeners.length; i++) listeners[i](open); }
      return {
        isOpen: function () { return open; },
        setOpen: function (v) { open = !!v; try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch (e) {} emit(); },
        toggle: function () { this.setOpen(!open); },
        subscribe: function (l) { listeners.push(l); return function () { var i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; },
      };
    }

    function PanelContent(props) {
      var layout = props.layout;
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
      return el("div", { style: { fontFamily: "inherit", fontSize: 14 } },
        el("h3", null, "Telegram 桥"),
        el("p", { style: { color: "#888" } }, "给 bot 发消息，它会用 Harness Agent（带工具）回答。"),
        el("label", null, "Bot Token（留空保持当前）"),
        el("input", { type: "password", value: token, placeholder: tokenSet ? "已设置（输入新值更换）" : "粘贴 bot token", onChange: function (e) { setToken(e.target.value); }, style: { width: "100%", marginBottom: 8 } }),
        el("label", null, "允许的用户 ID（只填自己）"),
        el("input", { value: ids, placeholder: "如 5588635088", onChange: function (e) { setIds(e.target.value); }, style: { width: "100%", marginBottom: 8 } }),
        el("label", null, "Agent 工作目录（可选）"),
        el("input", { value: workdir, placeholder: "如 D:\\telegramTran", onChange: function (e) { setWorkdir(e.target.value); }, style: { width: "100%", marginBottom: 8 } }),
        el("div", null,
          el("label", null, "启用 "),
          el("input", { type: "checkbox", checked: enabled, onChange: function (e) { setEnabled(e.target.checked); } })
        ),
        el("div", { style: { marginTop: 10 } }, "状态: " + (running ? ("运行中（PID " + pid + "）") : "已停止")),
        el("div", { style: { marginTop: 10 } },
          el("button", { onClick: save, style: { marginRight: 8 } }, "保存"),
          el("button", { onClick: refresh }, "刷新")
        ),
        el("div", { style: { color: "#888", marginTop: 8 } }, msg)
      );
    }

    function mountPanel(layout) {
      var el = document.createElement("aside");
      el.id = "dsh-telegram-bridge-panel";
      el.style.cssText = "position:fixed;top:0;right:0;bottom:0;width:360px;background:var(--bg,#fff);border-left:1px solid var(--border,#e5e5e5);z-index:1000;padding:16px;overflow:auto;";
      document.body.appendChild(el);
      var root = ReactDOM.createRoot(el);
      root.render(React.createElement(PanelContent, { layout: layout }));
      function render() { el.style.display = layout.isOpen() ? "block" : "none"; }
      render();
      var unsub = layout.subscribe(render);
      return function () { unsub(); root.unmount(); if (el.parentNode) el.parentNode.removeChild(el); };
    }

    function SidebarButton(props) {
      return React.createElement("button", { onClick: function () { props.inject.togglePanel(); } }, "Telegram 桥");
    }

    function apply(ctx) {
      var layout = createLayout();
      ctx.effect(function () {
        var disposers = [];
        try { disposers.push(mountPanel(layout)); } catch (e) { console.error("[telegram-bridge] panel mount failed:", e); }
        return function () { for (var i = 0; i < disposers.length; i++) disposers[i](); };
      }, "telegram-bridge: panel");
      var slots = ctx.get && ctx.get("slots");
      if (slots === undefined) return;
      ctx.effect(function () {
        return slots.inject("sidebar.footer.action", function () {
          return slots.register(
            { name: "sidebar.footer.action", id: "telegram-bridge", order: 60, inject: function () { return { togglePanel: function () { layout.toggle(); } }; } },
            function (props) { return React.createElement(SidebarButton, props); }
          );
        });
      }, "telegram-bridge: sidebar button");
    }

    exports.apply = apply;
    return module.exports;
  }
});
