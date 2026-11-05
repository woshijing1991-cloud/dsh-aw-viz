// lib/client.template.js —— client.js 的模板（不要直接挂载它）
//
// 构建：node tools/build-client.mjs
//   把 lib/page.css 的内容注入下面那行 CSS 变量的占位符，写出 lib/client.js。
// 这样 CSS 只有 page.css 一份真相：本地预览页和线上页面看到的是同一套样式。
// 注意：占位符只允许出现在代码里，注释里写它会让 replace 打错位置（踩过）。
window.__ModuleLoader__.load({
  id: 'dsh-aw-viz',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useCallback = React.useCallback

    var PANEL_ID = 'aw-viz'
    var API = '/dsh-aw-viz/api/summary'
    var CSS = "/* page.css —— 「使用习惯」看板样式表（Magpie / WinUI 3 风格）\n *\n * 【设计参考】GitHub: Blinue/Magpie（A general-purpose window upscaler for\n * Windows 10/11）。README 明确写 \"WinUI-based user interface with support for\n * light and dark themes\"；官方截图 img/main-window.png 里可直接量到的做法：\n *   1. 设置页范式：页面标题(~28px 半粗) → 区块小标题 + 一行 muted 描述 → 单列卡片流\n *   2. SettingsCard：白底、8px 圆角、1px 浅描边、约 20px 内边距\n *   3. 单一强调色（蓝）+ 其余全中性灰，界面里几乎没有第三种颜色\n *   4. 无阴影：深度只靠 1px 描边与背景明度差\n *   5. 圆角两档：卡片 8px / 控件 4px\n *   6. 字体 Segoe UI Variable，标题/正文/说明三档\n *\n * 本次只替换视觉：HTML 结构与全部功能（区间切换、用途分类、微信拆解、死区、\n * 时间轴、趋势、周环比）一行未改。\n */\n\n.aw-page {\n  /* 明暗两套，数值对齐 WinUI 3 的 Light / Dark 资源 */\n  --aw-fg: light-dark(#1a1a1a, #ffffff);\n  --aw-fg-2: light-dark(#3d3d3d, #d6d6d6);\n  --aw-fg-3: light-dark(#5d5d5d, #c5c5c5);    /* TextFillColorSecondary */\n  --aw-fg-4: light-dark(#8a8a8a, #9a9a9a);    /* TextFillColorTertiary */\n  --aw-line: light-dark(#e5e5e5, #3d3d3d);    /* ControlStrokeColorDefault */\n  --aw-card: light-dark(#ffffff, #2c2c2c);    /* CardBackgroundDefault */\n  --aw-page-bg: light-dark(#f3f3f3, #202020);\n  --aw-track: light-dark(#e6e6e6, #3a3a3a);\n  --aw-hover: light-dark(#f5f5f5, #333333);\n  --aw-accent: light-dark(#0067c0, #60cdff);  /* AccentFillColorDefault */\n\n  /* Fluent 语义色：Magpie 界面本身只有单一强调色，这里保留多色仅为数据可读，\n     但全部压到 WinUI SystemFill 的低饱和档 */\n  --aw-s1: light-dark(#0067c0, #60cdff);\n  --aw-s2: light-dark(#0f7b6c, #4cc2b4);\n  --aw-s3: light-dark(#9d5d00, #f0b060);\n  --aw-s4: light-dark(#6b4fbb, #a695e8);\n  --aw-s5: light-dark(#c42b1c, #ff9a8f);\n  --aw-s6: light-dark(#0e7a0d, #6ccb6a);\n\n  flex: 1 1 auto;\n  min-height: 0;\n  height: 100%;\n  overflow-y: auto;\n  overflow-x: hidden;\n  overscroll-behavior: contain;\n  scrollbar-gutter: stable;\n  background: var(--aw-page-bg);\n  color: var(--aw-fg);\n  /* 关键：必须 inherit，不能写 `light dark`。\n     写 `light dark` 会把祖先（宿主按主题强制）的 color-scheme 覆盖掉，\n     结果 light-dark() 退回按系统偏好解析，深色主题下整页仍是浅色。 */\n  color-scheme: inherit;\n  font-family: \"Segoe UI Variable Text\", \"Segoe UI Variable\", \"Segoe UI\",\n    \"Microsoft YaHei UI\", system-ui, sans-serif;\n  font-size: 14px;\n  line-height: 1.5;\n}\n\n/* 深色：不依赖 color-scheme/light-dark 的可用性，显式覆盖全部变量。\n   宿主（dsh-client-ui-theme）只用 prefers-color-scheme 做探测，并未在根节点声明\n   color-scheme，因此 light-dark() 拿不到主题；client.js 探测后加 .aw-dark 类兜底。 */\n.aw-page.aw-dark {\n  --aw-fg: #ffffff;\n  --aw-fg-2: #d6d6d6;\n  --aw-fg-3: #c5c5c5;\n  --aw-fg-4: #9a9a9a;\n  --aw-line: #3d3d3d;\n  --aw-card: #2c2c2c;\n  --aw-page-bg: #202020;\n  --aw-track: #3a3a3a;\n  --aw-hover: #333333;\n  --aw-accent: #60cdff;\n  --aw-s1: #60cdff;\n  --aw-s2: #4cc2b4;\n  --aw-s3: #f0b060;\n  --aw-s4: #a695e8;\n  --aw-s5: #ff9a8f;\n  --aw-s6: #6ccb6a;\n  color-scheme: dark;\n}\n.aw-page.aw-dark .aw-seg { background: #2c2c2c; }\n.aw-page.aw-dark .aw-seg button[aria-pressed=\"true\"] { color: #000000; }\n.aw-page.aw-dark .aw-btn:active { background: #2a2a2a; }\n.aw-page.aw-dark .aw-state code { background: #333333; }\n.aw-page.aw-dark .aw-warn { border-left-color: #ff9a8f; }\n.aw-page.aw-dark .aw-up { color: #ff9a8f; }\n.aw-page.aw-dark .aw-down { color: #6ccb6a; }\n\n/* 样式生效探针（client.js 用），必须保留 */\n.aw-probe { display: none; }\n\n.aw-inner { max-width: 1000px; margin: 0 auto; padding: 30px 36px 60px; }\n.aw-page *, .aw-page *::before, .aw-page *::after { box-sizing: border-box; }\n.aw-num { font-variant-numeric: tabular-nums; font-feature-settings: \"tnum\" 1; }\n\n/* ── 页头：WinUI 页面标题范式（大标题 + 下方 muted 说明）── */\n.aw-top { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; }\n.aw-top h1 {\n  margin: 0;\n  font-family: \"Segoe UI Variable Display\", \"Segoe UI Variable\", \"Segoe UI\", sans-serif;\n  font-size: 28px;\n  font-weight: 600;\n  line-height: 1.2;\n  letter-spacing: -0.01em;\n}\n.aw-lede { margin: 6px 0 0; color: var(--aw-fg-3); font-size: 13px; }\n.aw-tools { margin-left: auto; display: flex; align-items: center; gap: 8px; }\n\n/* 分段控件：Magpie 截图里 keycap 的「实心强调色」做法 */\n.aw-seg {\n  display: inline-flex;\n  padding: 2px;\n  gap: 2px;\n  background: light-dark(#ededed, #2c2c2c);\n  border: 1px solid var(--aw-line);\n  border-radius: 8px;\n}\n.aw-seg button {\n  font: inherit;\n  font-size: 13px;\n  padding: 5px 14px;\n  border: 0;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--aw-fg-2);\n  cursor: pointer;\n  transition: background 90ms linear;\n}\n.aw-seg button:hover { background: var(--aw-hover); }\n.aw-seg button[aria-pressed=\"true\"] {\n  background: var(--aw-accent);\n  color: light-dark(#ffffff, #000000);\n  font-weight: 600;\n}\n\n/* WinUI 标准按钮：白底 + 1px 描边 + 4px 圆角（对应截图里的 \"Change\"） */\n.aw-btn {\n  font: inherit;\n  font-size: 13px;\n  height: 32px;\n  padding: 0 14px;\n  border-radius: 4px;\n  border: 1px solid var(--aw-line);\n  background: var(--aw-card);\n  color: var(--aw-fg-2);\n  cursor: pointer;\n  transition: background 90ms linear;\n}\n.aw-btn:hover { background: var(--aw-hover); }\n.aw-btn:active { background: light-dark(#f0f0f0, #2a2a2a); }\n.aw-btn[disabled] { opacity: 0.45; cursor: default; }\n\n/* ── 主视觉：总量 + 一周形状，整块是一张 SettingsCard ── */\n.aw-hero {\n  display: grid;\n  grid-template-columns: 220px minmax(0, 1fr);\n  gap: 32px;\n  align-items: start;\n  padding: 20px 22px;\n  margin-bottom: 12px;\n  background: var(--aw-card);\n  border: 1px solid var(--aw-line);\n  border-radius: 8px;\n}\n@media (max-width: 860px) { .aw-hero { grid-template-columns: 1fr; gap: 18px; } }\n\n.aw-kicker { display: block; font-size: 12px; color: var(--aw-fg-3); margin-bottom: 4px; }\n.aw-total {\n  font-family: \"Segoe UI Variable Display\", \"Segoe UI Variable\", \"Segoe UI\", sans-serif;\n  font-size: 44px;\n  font-weight: 600;\n  line-height: 1.05;\n  letter-spacing: -0.02em;\n}\n.aw-total-unit { font-size: 13px; font-weight: 500; color: var(--aw-fg-3); margin-left: 6px; }\n.aw-total-note { margin: 12px 0 0; font-size: 12.5px; color: var(--aw-fg-3); line-height: 1.75; }\n.aw-total-note b { color: var(--aw-fg); font-weight: 600; }\n\n.aw-heat { margin: 0; max-width: 620px; }\n.aw-heat figcaption { font-size: 12px; color: var(--aw-fg-3); margin-bottom: 8px; }\n.aw-heat-grid {\n  display: grid;\n  grid-template-columns: 20px repeat(24, minmax(0, 1fr));\n  gap: 3px;\n  align-items: center;\n}\n.aw-heat-grid .wd { font-size: 10px; color: var(--aw-fg-4); text-align: center; }\n.aw-heat-grid .c { height: 14px; border-radius: 2px; background: var(--aw-track); }\n.aw-heat-grid .c.on { background: var(--aw-accent); }\n.aw-heat-axis {\n  display: grid;\n  grid-template-columns: 20px repeat(24, minmax(0, 1fr));\n  gap: 3px;\n  margin-top: 5px;\n}\n.aw-heat-axis span { font-size: 9.5px; color: var(--aw-fg-4); font-variant-numeric: tabular-nums; }\n\n/* ── KPI：四张独立卡片（不再用 1px 缝隙假装分隔线）── */\n.aw-kpis {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));\n  gap: 10px;\n  margin-bottom: 12px;\n}\n.aw-kpi {\n  background: var(--aw-card);\n  border: 1px solid var(--aw-line);\n  border-radius: 8px;\n  padding: 14px 16px;\n}\n.aw-kpi-k { font-size: 12px; color: var(--aw-fg-3); margin-bottom: 6px; }\n.aw-kpi-v {\n  font-family: \"Segoe UI Variable Display\", \"Segoe UI Variable\", \"Segoe UI\", sans-serif;\n  font-size: 22px;\n  font-weight: 600;\n  line-height: 1.15;\n  letter-spacing: -0.01em;\n}\n.aw-kpi-v small { font-size: 12px; font-weight: 500; color: var(--aw-fg-3); margin-left: 3px; }\n.aw-kpi-s { margin-top: 5px; font-size: 11.5px; color: var(--aw-fg-4); }\n\n/* ── 两列区块：每列一张卡 ──────────────────────────── */\n.aw-cols { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 12px; margin-bottom: 12px; }\n@media (max-width: 860px) { .aw-cols { grid-template-columns: 1fr; } }\n.aw-cols > section {\n  background: var(--aw-card);\n  border: 1px solid var(--aw-line);\n  border-radius: 8px;\n  padding: 18px 20px 20px;\n  min-width: 0;\n}\n\n/* 区块标题：小标题 + 一行 muted 描述，无分割线（Magpie 的 Activation / Toolbar 就是这形态） */\n.aw-h { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }\n.aw-h h2 { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.005em; }\n.aw-h span { font-size: 12px; color: var(--aw-fg-3); }\n\n/* ── 分类条：贴近 WinUI ProgressBar 的细条 ─────────── */\n.aw-cat { padding: 5px 0; }\n.aw-cat-head { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; margin-bottom: 6px; }\n.aw-cat-name { color: var(--aw-fg-2); }\n.aw-cat-val { color: var(--aw-fg-3); font-variant-numeric: tabular-nums; font-size: 12px; }\n.aw-cat-track { height: 6px; border-radius: 3px; background: var(--aw-track); overflow: hidden; }\n.aw-cat-fill { height: 100%; border-radius: 3px; }\n\n/* ── Top 应用：行式，去掉虚线分隔，靠行距 ──────────── */\n.aw-app {\n  display: grid;\n  grid-template-columns: 20px minmax(0, 1fr) 66px;\n  align-items: center;\n  gap: 10px;\n  padding: 7px 0;\n}\n.aw-app-i { font-size: 12px; color: var(--aw-fg-4); font-variant-numeric: tabular-nums; }\n.aw-app-n { display: flex; align-items: center; gap: 7px; min-width: 0; }\n.aw-app-n b {\n  font-weight: 400;\n  font-size: 13.5px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.aw-tag {\n  flex: none;\n  font-size: 10.5px;\n  padding: 1px 6px;\n  border-radius: 4px;\n  border: 1px solid var(--aw-line);\n  color: var(--aw-fg-3);\n}\n.aw-app-t { height: 5px; border-radius: 3px; background: var(--aw-track); overflow: hidden; margin-top: 5px; }\n.aw-app-f { height: 100%; background: var(--aw-accent); border-radius: 3px; }\n.aw-app-v { text-align: right; font-size: 12.5px; color: var(--aw-fg-3); font-variant-numeric: tabular-nums; }\n.aw-app-wrap { min-width: 0; }\n\n/* ── 一天的用途时间轴 ──────────────────────────────── */\n.aw-tl {\n  display: grid;\n  grid-template-columns: repeat(24, minmax(0, 1fr));\n  gap: 3px;\n  height: 140px;\n  align-items: end;\n  margin-top: 6px;\n}\n.aw-tl .col { display: flex; flex-direction: column-reverse; height: 100%; gap: 1px; }\n.aw-tl .seg { border-radius: 2px; }\n.aw-tl-axis {\n  display: grid;\n  grid-template-columns: repeat(24, minmax(0, 1fr));\n  gap: 3px;\n  margin-top: 6px;\n  font-size: 9.5px;\n  color: var(--aw-fg-4);\n  font-variant-numeric: tabular-nums;\n}\n.aw-tl-legend { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 10px; font-size: 12px; color: var(--aw-fg-3); }\n.aw-tl-legend span { display: inline-flex; align-items: center; gap: 6px; }\n.aw-tl-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; }\n\n/* ── 用途行：名称 + 细条 + 数值 + 周环比 ───────────── */\n.aw-dp {\n  display: grid;\n  grid-template-columns: 78px minmax(0, 1fr) 128px;\n  align-items: center;\n  gap: 12px;\n  padding: 7px 0;\n  font-size: 13px;\n}\n.aw-dp .n { color: var(--aw-fg-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.aw-dp .t { height: 6px; border-radius: 3px; background: var(--aw-track); overflow: hidden; }\n/* 必须 display:block —— 它是 span，行内元素吃不到 height:100%，背景会整条消失 */\n.aw-dp .f { display: block; height: 100%; border-radius: 3px; }\n.aw-dp .v { text-align: right; color: var(--aw-fg-3); font-variant-numeric: tabular-nums; font-size: 12px; }\n.aw-delta { font-variant-numeric: tabular-nums; margin-left: 6px; }\n.aw-up { color: light-dark(#c42b1c, #ff9a8f); }\n.aw-down { color: light-dark(#0e7a0d, #6ccb6a); }\n.aw-flat { color: var(--aw-fg-4); }\n\n/* ── 趋势图 ────────────────────────────────────────── */\n.aw-trend {\n  background: var(--aw-card);\n  border: 1px solid var(--aw-line);\n  border-radius: 8px;\n  padding: 18px 20px 16px;\n  margin-bottom: 12px;\n}\n.aw-chart { width: 100%; height: 150px; display: block; overflow: visible; }\n.aw-chart .grid { stroke: var(--aw-line); stroke-width: 1; }\n.aw-chart .area { fill: color-mix(in srgb, var(--aw-accent) 18%, transparent); }\n.aw-chart .line {\n  fill: none;\n  stroke: var(--aw-accent);\n  stroke-width: 2;\n  stroke-linejoin: round;\n  vector-effect: non-scaling-stroke;\n}\n.aw-chart .dot { fill: var(--aw-accent); }\n.aw-chart .grid-label { fill: var(--aw-fg-4); font-size: 10px; font-variant-numeric: tabular-nums; }\n.aw-axis-x { display: flex; justify-content: space-between; font-size: 11px; color: var(--aw-fg-4); margin-top: 6px; }\n\n/* ── 页脚 ──────────────────────────────────────────── */\n.aw-foot {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 12px 30px;\n  align-items: center;\n  font-size: 12px;\n  color: var(--aw-fg-3);\n  padding: 2px 2px 0;\n}\n.aw-split { display: inline-flex; align-items: center; gap: 10px; }\n.aw-split-bar {\n  display: inline-flex;\n  height: 6px;\n  width: 130px;\n  border-radius: 3px;\n  overflow: hidden;\n  background: var(--aw-track);\n}\n.aw-split-bar i { display: block; height: 100%; }\n.aw-split-bar .pc { background: var(--aw-accent); }\n.aw-split-bar .ph { background: var(--aw-accent); opacity: 0.35; }\n.aw-legend { display: inline-flex; gap: 14px; }\n.aw-legend span { display: inline-flex; align-items: center; gap: 6px; }\n.aw-legend em { width: 9px; height: 9px; border-radius: 2px; background: var(--aw-accent); display: inline-block; }\n.aw-legend em.ph { opacity: 0.35; }\n\n.aw-note { margin: 14px 0 0; font-size: 11.5px; line-height: 1.7; color: var(--aw-fg-4); }\n\n/* ── 状态与兜底 ────────────────────────────────────── */\n.aw-state { padding: 36px 0; max-width: 560px; font-size: 13px; line-height: 1.9; color: var(--aw-fg-2); }\n.aw-state code {\n  font: inherit;\n  font-size: 12.5px;\n  padding: 1px 6px;\n  border-radius: 4px;\n  background: light-dark(#ededed, #333333);\n}\n.aw-warn {\n  margin: 14px 0 0;\n  padding: 10px 14px;\n  border-radius: 8px;\n  border: 1px solid var(--aw-line);\n  border-left: 3px solid light-dark(#c42b1c, #ff9a8f);\n  font-size: 12.5px;\n  color: var(--aw-fg-2);\n  background: var(--aw-card);\n}\n.aw-skel { display: grid; gap: 10px; padding: 30px 0; }\n.aw-skel i {\n  display: block;\n  height: 12px;\n  border-radius: 4px;\n  background: var(--aw-track);\n  animation: aw-pulse 1.4s ease-in-out infinite;\n}\n.aw-skel i:nth-child(1) { width: 40%; }\n.aw-skel i:nth-child(2) { width: 72%; }\n.aw-skel i:nth-child(3) { width: 55%; }\n@keyframes aw-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }\n.aw-empty { color: var(--aw-fg-4); font-size: 13px; padding: 8px 0; }\n.aw-sp { flex: 1; }\n"

    var SERIES = ['var(--aw-s1)', 'var(--aw-s2)', 'var(--aw-s3)', 'var(--aw-s4)', 'var(--aw-s5)', 'var(--aw-s6)']

    // 样式是否真的生效。注入 <style> 不等于生效（可能被 CSP 拦），用探针实测。
    var STYLE_OK = true

    function ensureStyle() {
      try {
        if (typeof document === 'undefined') return
        if (!document.getElementById('dsh-aw-viz-style')) {
          var s = document.createElement('style')
          s.id = 'dsh-aw-viz-style'
          s.textContent = CSS
          ;(document.head || document.documentElement).appendChild(s)
        }
        // 探针：.aw-probe 的规则是 display:none。量不到 none 就说明样式没吃上。
        if (typeof getComputedStyle === 'function' && document.body) {
          var probe = document.createElement('div')
          probe.className = 'aw-probe'
          document.body.appendChild(probe)
          var d = getComputedStyle(probe).display
          document.body.removeChild(probe)
          STYLE_OK = d === 'none'
        }
      } catch (e) { STYLE_OK = false }
    }

    function fmtDur(m) {
      var v = Number(m) || 0
      return v >= 60 ? (v / 60).toFixed(1) + ' 小时' : Math.round(v) + ' 分钟'
    }
    function fmtNum(m) {
      var v = Number(m) || 0
      return v >= 600 ? (v / 60).toFixed(1) : String(Math.round(v))
    }
    function unitOf(m) { return (Number(m) || 0) >= 600 ? '小时' : '分钟' }

    // 侧栏图标：16 viewBox、currentColor、选中态略加粗，与同栏图标同规格
    function AwIcon(props) {
      var size = (props && props.size) || 16
      var active = props && props.active
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: active ? 1.7 : 1.4,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true', focusable: 'false',
      },
        h('path', { d: 'M2 13.2V8.6' }),
        h('path', { d: 'M6 13.2V4.4' }),
        h('path', { d: 'M10 13.2V6.6' }),
        h('path', { d: 'M14 13.2V9.4' }),
        h('path', { d: 'M1.4 13.8h13.2' })
      )
    }

    // 一周形状：7 行 × 24 格
    function WeekHeat(props) {
      var heat = props.heatmap || []
      var labels = ['一', '二', '三', '四', '五', '六', '日']
      var max = 1
      for (var r = 0; r < heat.length; r++) {
        for (var c = 0; c < (heat[r] || []).length; c++) max = Math.max(max, heat[r][c])
      }
      var cells = []
      for (var d = 0; d < 7; d++) {
        cells.push(h('div', { className: 'wd', key: 'w' + d }, labels[d]))
        for (var hh = 0; hh < 24; hh++) {
          var v = (heat[d] && heat[d][hh]) || 0
          var t = v <= 0 ? 0 : Math.min(1, v / max)
          cells.push(h('div', {
            key: 'c' + d + '_' + hh,
            className: 'c' + (t > 0 ? ' on' : ''),
            title: '周' + labels[d] + ' ' + hh + ':00 · ' + Math.round(v) + ' 分钟',
            style: t > 0 ? { opacity: (0.25 + t * 0.75).toFixed(2) } : null,
          }))
        }
      }
      var axis = [h('span', { key: 'a0' }, '')]
      for (var k = 0; k < 24; k++) axis.push(h('span', { key: 'a' + k }, k % 6 === 0 ? String(k) : ''))
      return h('figure', { className: 'aw-heat' },
        h('figcaption', null, '一周的时间形状 · 行为星期，列为小时，越亮用得越多'),
        h('div', { className: 'aw-heat-grid' }, cells),
        h('div', { className: 'aw-heat-axis' }, axis)
      )
    }

    function CatBar(props) {
      var it = props.item
      var i = props.index
      var max = props.max || 1
      var w = Math.max(2, Math.round(((it.minutes || 0) / max) * 100))
      return h('div', { className: 'aw-cat' },
        h('div', { className: 'aw-cat-head' },
          h('span', { className: 'aw-cat-name' }, it.name),
          h('span', { className: 'aw-cat-val' },
            fmtDur(it.minutes) + (it.share != null ? ' · ' + it.share + '%' : ''))
        ),
        h('div', { className: 'aw-cat-track' },
          h('div', { className: 'aw-cat-fill', style: { width: w + '%', background: SERIES[i % SERIES.length] } })
        )
      )
    }

    function AppRow(props) {
      var a = props.item
      var i = props.index
      var max = props.max || 1
      var w = Math.max(2, Math.round(((a.minutes || 0) / max) * 100))
      return h('div', { className: 'aw-app' },
        h('span', { className: 'aw-app-i' }, String(i + 1).padStart ? String(i + 1).padStart(2, '0') : ('0' + (i + 1)).slice(-2)),
        h('div', { className: 'aw-app-wrap' },
          h('div', { className: 'aw-app-n' },
            h('b', { title: a.app }, a.app),
            a.device === 'phone' ? h('span', { className: 'aw-tag' }, '手机') : null
          ),
          h('div', { className: 'aw-app-t' }, h('div', { className: 'aw-app-f', style: { width: w + '%' } }))
        ),
        h('span', { className: 'aw-app-v' }, fmtDur(a.minutes))
      )
    }

    // 趋势：SVG 折线 + 面积 + 峰值标注
    function Trend(props) {
      var byDay = props.byDay || []
      if (byDay.length < 2) return null
      var W = 1000, H = 124, pad = 8
      var max = 1
      for (var i = 0; i < byDay.length; i++) max = Math.max(max, byDay[i].activeMinutes || 0)
      var step = (W - pad * 2) / (byDay.length - 1)
      var pts = byDay.map(function (d, idx) {
        var y = H - pad - ((d.activeMinutes || 0) / max) * (H - pad * 2 - 14)
        return [pad + idx * step, y]
      })
      var line = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1) }).join(' ')
      var areaPts = pad + ',' + (H - pad) + ' ' + line + ' ' + (pad + step * (byDay.length - 1)).toFixed(1) + ',' + (H - pad)
      var peakIdx = 0
      for (var k = 0; k < byDay.length; k++) if ((byDay[k].activeMinutes || 0) > (byDay[peakIdx].activeMinutes || 0)) peakIdx = k
      var peak = pts[peakIdx]

      var grid = [0.33, 0.66].map(function (t, gi) {
        var y = pad + (H - pad * 2 - 14) * t
        return h('line', { key: 'g' + gi, className: 'grid', x1: pad, x2: W - pad, y1: y.toFixed(1), y2: y.toFixed(1) })
      })
      var dots = pts.map(function (p, di) {
        return h('circle', { key: 'd' + di, className: 'dot', cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 2.4 })
      })
      var tickIdx = [0, Math.round((byDay.length - 1) / 4), Math.round((byDay.length - 1) / 2), Math.round((byDay.length - 1) * 3 / 4), byDay.length - 1]
      var seen = {}
      var ticks = []
      tickIdx.forEach(function (idx) {
        if (seen[idx]) return
        seen[idx] = 1
        ticks.push(h('span', { key: 't' + idx }, String(byDay[idx].date).slice(5)))
      })

      return h(React.Fragment, null,
        h('svg', { className: 'aw-chart', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' },
          grid,
          h('polygon', { className: 'area', points: areaPts }),
          h('polyline', { className: 'line', points: line }),
          dots,
          h('text', {
            className: 'grid-label',
            x: Math.min(peak[0], W - 34).toFixed(1),
            y: Math.max(11, peak[1] - 7).toFixed(1),
          }, Math.round(byDay[peakIdx].activeMinutes) + "'")
        ),
        h('div', { className: 'aw-axis-x' }, ticks)
      )
    }

    // 用途行：名称 + 占比条 + 日均/占比 + 周环比（升红降绿按"越少越好/越多越好"取义）
    var GOOD_PURPOSES = { '学习': 1, '办公': 1 }
    function PurposeRow(props) {
      var p = props.item
      var wow = props.wow || {}
      var max = props.max || 1
      var w = Math.max(2, Math.round(((p.minutes || 0) / max) * 100))
      var isGood = GOOD_PURPOSES[p.purpose] === 1
      var d = wow.deltaPerDay
      var arrow = ''
      var cls = 'aw-delta aw-flat'
      if (typeof d === 'number' && Math.abs(d) >= 0.5) {
        arrow = (d > 0 ? '↑' : '↓') + Math.abs(d).toFixed(1)
        // 学习/办公上涨是好事，娱乐/空转上涨是坏事
        cls = 'aw-delta ' + ((d > 0) === isGood ? 'aw-down' : 'aw-up')
      }
      return h('div', { className: 'aw-dp' },
        h('span', { className: 'n' }, p.purpose),
        h('span', { className: 't' },
          h('span', { className: 'f', style: { width: w + '%', background: props.color } })),
        h('span', { className: 'v' },
          fmtDur(p.minutes),
          h('span', { className: cls, title: '本周 ' + wow.thisWeek + ' → 上周 ' + wow.lastWeek + ' 分/天' }, arrow))
      )
    }

    // 一天的用途时间轴：24 列堆叠（娱乐/学习/办公/其他）
    var TL_SERIES = [
      ['娱乐消遣', 'var(--aw-s1)'],
      ['学习', 'var(--aw-s2)'],
      ['办公', 'var(--aw-s3)'],
    ]
    function HourTimeline(props) {
      var hourly = props.hourly || []
      if (!hourly.length) return null
      var cols = []
      var max = 1
      for (var hour = 0; hour < 24; hour++) {
        var row = hourly[hour] || {}
        var ent = row['娱乐消遣'] || 0
        var stu = row['学习'] || 0
        var wrk = row['办公'] || 0
        var all = 0
        for (var k in row) all += row[k] || 0
        var other = Math.max(0, all - ent - stu - wrk)
        var total = ent + stu + wrk + other
        if (total > max) max = total
        cols.push({ ent: ent, stu: stu, wrk: wrk, other: other, total: total })
      }
      var bars = cols.map(function (c, hh) {
        var segs = []
        function seg(key, val, color) {
          if (val <= 0) return
          segs.push(h('span', {
            key: key,
            className: 'seg',
            style: { height: ((val / max) * 100).toFixed(1) + '%', background: color },
            title: hhLabel(hh) + ' ' + key + ' ' + Math.round(val) + ' 分钟',
          }))
        }
        seg('其他', c.other, 'var(--aw-track)')
        seg('办公', c.wrk, 'var(--aw-s3)')
        seg('学习', c.stu, 'var(--aw-s2)')
        seg('娱乐消遣', c.ent, 'var(--aw-s1)')
        return h('div', { className: 'col', key: 'h' + hh, title: hhLabel(hh) }, segs)
      })
      var axis = []
      for (var a = 0; a < 24; a++) axis.push(h('span', { key: 'a' + a }, a % 3 === 0 ? String(a) : ''))

      return h('div', null,
        h('div', { className: 'aw-tl' }, bars),
        h('div', { className: 'aw-tl-axis' }, axis),
        h('div', { className: 'aw-tl-legend' },
          TL_SERIES.map(function (s) {
            return h('span', { key: s[0] }, h('i', { style: { background: s[1] } }), s[0])
          }),
          h('span', { key: 'other' }, h('i', { style: { background: 'var(--aw-track)' } }), '其他用途')
        )
      )
    }
    function hhLabel(h) {
      return (h < 10 ? '0' + h : String(h)) + ':00'
    }

    // 错误边界：任何渲染异常都显示在页面上，绝不再交出一个空白面板。
    // 空白面板的排查成本极高：宿主正常、路由 200、代码也同步了，却完全看不到线索。
    // 必须用 class 语法：React.Component 是 ES class，用 prototype 继承 +
    // React.Component.call() 会抛 "Class constructor cannot be invoked without 'new'"。
    var ErrorBoundary = null
    try {
      ErrorBoundary = class extends React.Component {
        constructor(props) {
          super(props)
          this.state = { err: null }
        }
        static getDerivedStateFromError(e) {
          return { err: e }
        }
        render() {
          if (this.state.err) {
            var msg = String((this.state.err && this.state.err.message) || this.state.err)
            return h('div', { className: 'aw-page' + (detectDark() ? ' aw-dark' : '') },
              h('div', { className: 'aw-inner' },
                h('div', { className: 'aw-state' },
                  h('div', null, '看板渲染出错：' + msg),
                  h('div', null, '把这段文字发我即可定位；宿主接口本身是正常的。')
                )
              )
            )
          }
          return this.props.children
        }
      }
    } catch (e) { ErrorBoundary = null }
    function wrapBoundary(node) {
      return ErrorBoundary ? h(ErrorBoundary, null, node) : node
    }

    // 主题探测：宿主的 theme 包只用 prefers-color-scheme 探测环境，并没有在根节点
    // 声明 color-scheme，所以纯 CSS 的 light-dark() 拿不到主题。这里显式判定，
    // 命中就给根节点加 .aw-dark（样式表里有对应的整套变量覆盖）。
    function detectDark() {
      try {
        var de = document.documentElement
        var ds = de.dataset || {}
        var signal = [ds.theme, ds.colorScheme, ds.mode, de.className, de.style.colorScheme].join(' ')
        if (/(^|[\s_-])dark($|[\s_-])/i.test(signal)) return true
        if (/(^|[\s_-])light($|[\s_-])/i.test(signal)) return false
        var body = document.body || de
        var bg = getComputedStyle(body).backgroundColor || ''
        var m = bg.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
        if (m) {
          var lum = (0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])) / 255
          return lum < 0.5
        }
        if (window.matchMedia) return window.matchMedia('(prefers-color-scheme: dark)').matches
      } catch (e) { /* 探测失败按浅色 */ }
      return false
    }

    function DataPage() {
      var daysState = useState(7)
      var days = daysState[0]
      var setDays = daysState[1]
      var dataState = useState(null)
      var data = dataState[0]
      var setData = dataState[1]
      var errState = useState('')
      var err = errState[0]
      var setErr = errState[1]
      var busyState = useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]

      var load = useCallback(function (d) {
        setBusy(true)
        setErr('')
        fetch(API + '?days=' + encodeURIComponent(d || days), { cache: 'no-store' })
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status)
            return r.json()
          })
          .then(function (j) {
            if (!j || j.ok !== true) throw new Error((j && j.error) || '返回格式不对')
            setData(j)
          })
          .catch(function (e) { setErr(String((e && e.message) || e)) })
          .then(function () { setBusy(false) })
      }, [days])

      useEffect(function () { load(days) }, [days])

      var body
      if (err) {
        body = h('div', { className: 'aw-state' },
          h('div', null, '没读到数据：' + err),
          h('div', { style: { marginTop: 10 } }, '这个面板只读本机 ActivityWatch，自己不采集任何东西——没装它就没有数据。'),
          h('ol', { style: { margin: '8px 0 0 18px', padding: 0, lineHeight: 2 } },
            h('li', null, '装 ActivityWatch：', h('code', null, 'https://activitywatch.net/downloads/'),
              '（Windows 装完会常驻托盘，开机自启）'),
            h('li', null, '确认它在跑：浏览器打开 ', h('code', null, 'http://localhost:5600'),
              '，能看到时间线就对了'),
            h('li', null, '回到这里点右上角「刷新」')
          ),
          h('div', { style: { marginTop: 10, color: 'var(--aw-fg-4)' } },
            '已经装了还是这样？检查 aw-server 的端口是不是 5600，不是的话在插件配置里改 ',
            h('code', null, 'activityWatchBase'), '。')
        )
      } else if (!data) {
        body = h('div', { className: 'aw-skel' }, h('i', null), h('i', null), h('i', null))
      } else {
        var t = data.totals || {}
        var f = data.focus || {}
        var c = data.completeness || {}
        var cats = data.categories || []
        var apps = data.apps || []
        var daysArr = data.byDay || []
        var maxCat = cats.reduce(function (a, b) { return Math.max(a, b.minutes || 0) }, 1)
        var maxApp = apps.reduce(function (a, b) { return Math.max(a, b.minutes || 0) }, 1)
        var pcPct = t.pcShare || 0
        var phPct = 100 - pcPct
        var peakDay = daysArr.reduce(function (a, b) { return Math.max(a, b.activeMinutes || 0) }, 0)
        // 用途视图（主图）：六类 + 周环比
        var purp = (data.purpose && data.purpose.purposes) || []
        var conf = (data.purpose && data.purpose.confidence) || {}
        var wowList = (data.purpose && data.purpose.wow) || []
        var wowMap = {}
        for (var wj = 0; wj < wowList.length; wj++) wowMap[wowList[wj].purpose] = wowList[wj]
        var maxPurp = purp.reduce(function (a, b) { return Math.max(a, b.minutes || 0) }, 1)

        body = h(React.Fragment, null,
          h('section', { className: 'aw-hero' },
            h('div', null,
              h('span', { className: 'aw-kicker' }, '活跃时长'),
              h('div', { className: 'aw-total aw-num' },
                fmtNum(t.activeMinutes),
                h('span', { className: 'aw-total-unit' }, unitOf(t.activeMinutes))
              ),
              h('p', { className: 'aw-total-note' },
                '单段中位 ', h('b', null, (f.medianSegmentSec || 0) + ' 秒'),
                '，每小时切换 ', h('b', null, (f.switchesPerHour || 0) + ' 次'),
                h('br'),
                '最长专注块 ', h('b', null, fmtDur(f.longestBlockMin)),
                '，≥25 分钟共 ', h('b', null, String(f.deepBlocks || 0)), ' 个'
              )
            ),
            h(WeekHeat, { heatmap: data.heatmap })
          ),

          h('section', { className: 'aw-kpis' },
            h('div', { className: 'aw-kpi a' },
              h('div', { className: 'aw-kpi-k' }, '电脑'),
              h('div', { className: 'aw-kpi-v aw-num' }, fmtDur(t.pcMinutes)),
              h('div', { className: 'aw-kpi-s' }, '占 ' + pcPct + '%')
            ),
            h('div', { className: 'aw-kpi b' },
              h('div', { className: 'aw-kpi-k' }, '手机'),
              h('div', { className: 'aw-kpi-v aw-num' }, fmtDur(t.phoneMinutes)),
              h('div', { className: 'aw-kpi-s' }, '占 ' + phPct + '%')
            ),
            h('div', { className: 'aw-kpi c' },
              h('div', { className: 'aw-kpi-k' }, '碎片化'),
              h('div', { className: 'aw-kpi-v aw-num' }, String(f.fragmentation || 0), h('small', null, '%')),
              h('div', { className: 'aw-kpi-s' }, '短于 30 秒的片段')
            ),
            h('div', { className: 'aw-kpi d' },
              h('div', { className: 'aw-kpi-k' }, '手机解锁'),
              h('div', { className: 'aw-kpi-v aw-num' }, String(t.unlocks || 0), h('small', null, '次')),
              h('div', { className: 'aw-kpi-s' }, '区间内累计')
            )
          ),

          h('div', { className: 'aw-cols' },
            h('section', null,
              h('div', { className: 'aw-h' },
                h('h2', null, '时间花在哪'),
                h('span', null, '按用途' + (conf.high ? ' · 高置信 ' + conf.high.share + '%' : ''))),
              purp.length
                ? purp.map(function (p, i) {
                    return h(PurposeRow, {
                      key: p.purpose, item: p, wow: wowMap[p.purpose] || {},
                      max: maxPurp, color: SERIES[i % SERIES.length],
                    })
                  })
                : h('div', { className: 'aw-state' }, '还没有用途数据'),
              h('div', { className: 'aw-note' },
                '用途是推断值：界面类名 > 包名 > 应用名 > 窗口标题 依次判定，每条都带证据强度；'
                + '右侧箭头是最近 7 天 vs 前 7 天的日均变化。')
            ),
            h('section', null,
              h('div', { className: 'aw-h' },
                h('h2', null, '具体在哪个应用'),
                h('span', null, 'Top ' + Math.min(8, apps.length))),
              apps.length
                ? apps.slice(0, 8).map(function (a, i) { return h(AppRow, { key: a.app, item: a, index: i, max: maxApp }) })
                : h('div', { className: 'aw-state' }, '还没有应用数据')
            )
          ),

          // 微信内部拆解 + 死区：只看 App 名会把「微信」误读成沟通
          (function () {
            var det = data.detail || {}
            var wx = (det.wechat && det.wechat.items) || []
            var dead = det.deadzone || {}
            if (!wx.length && !dead.totalMinutes) return null
            var wxMax = wx.reduce(function (a, b) { return Math.max(a, b.minutes || 0) }, 1)
            var wxIdle = 0
            for (var wi = 0; wi < wx.length; wi++) if (wx[wi].name === '微信主界面') wxIdle = wx[wi].perDay
            return h('div', { className: 'aw-cols' },
              h('section', null,
                h('div', { className: 'aw-h' },
                  h('h2', null, '微信内部在干什么'),
                  h('span', null, '日均 ' + (det.wechat ? det.wechat.perDay : 0) + ' 分钟，按界面拆')),
                wx.map(function (it, i) {
                  return h(CatBar, {
                    key: it.name,
                    item: { name: it.name, minutes: it.minutes, share: it.share },
                    index: i,
                    max: wxMax,
                  })
                }),
                h('div', { className: 'aw-note' },
                  '「微信」是个容器，不是一种行为：视频号、小程序、公众号都在里面，真正聊天只占 2%。')
              ),
              h('section', null,
                h('div', { className: 'aw-h' },
                  h('h2', null, '死区'),
                  h('span', null, '亮屏但没有实际用途')),
                h('div', { className: 'aw-kpis', style: { gridTemplateColumns: '1fr 1fr', marginTop: 0 } },
                  h('div', { className: 'aw-kpi c' },
                    h('div', { className: 'aw-kpi-k' }, '桌面空转'),
                    h('div', { className: 'aw-kpi-v aw-num' }, String(dead.perDay || 0), h('small', null, '分/天')),
                    h('div', { className: 'aw-kpi-s' }, '占全部活跃 ' + (dead.share || 0) + '%')
                  ),
                  h('div', { className: 'aw-kpi d' },
                    h('div', { className: 'aw-kpi-k' }, '微信内空转'),
                    h('div', { className: 'aw-kpi-v aw-num' }, String(wxIdle), h('small', null, '分/天')),
                    h('div', { className: 'aw-kpi-s' }, '停在会话列表没点进聊天')
                  )
                ),
                h('div', { className: 'aw-note' },
                  '死区 = 手机亮着、时间在走，但没有任何目的性产出。它不会被「少玩手机」这种决心覆盖，'
                  + '因为它发生在你还没决定要干什么的那几秒。')
              )
            )
          })(),

          h('section', { className: 'aw-trend' },
            h('div', { className: 'aw-h' },
              h('h2', null, '一天的用途分布'),
              h('span', null, '24 小时堆叠 · 娱乐/学习/办公')),
            h(HourTimeline, { hourly: (data.purpose && data.purpose.hourly) || [] })
          ),

          h('section', { className: 'aw-trend' },
            h('div', { className: 'aw-h' },
              h('h2', null, '每日活跃趋势'),
              h('span', null, '峰值 ' + Math.round(peakDay) + ' 分钟/天')),
            h(Trend, { byDay: daysArr })
          ),

          h('footer', { className: 'aw-foot' },
            h('span', { className: 'aw-split' },
              h('span', { className: 'aw-split-bar' },
                h('i', { className: 'pc', style: { width: pcPct + '%' } }),
                h('i', { className: 'ph', style: { width: phPct + '%' } })
              ),
              h('span', { className: 'aw-legend' },
                h('span', null, h('em', null), '电脑'),
                h('span', null, h('em', { className: 'ph' }), '手机')
              )
            ),
            c.offlineBlocks
              ? h('span', null, '电脑关机 ' + c.offlineBlocks + ' 段 · ' + fmtDur(c.offlineMinutes) + '（已显式标记，不是「没活动」）')
              : h('span', null, '本次区间内无关机空档'),
            h('span', null, '活跃时长 = 窗口事件 ∩ 非 AFK 区间；手机为 App 级、按事件时长直计')
          )
        )
      }

      return wrapBoundary(h('div', {
        className: 'aw-page' + (detectDark() ? ' aw-dark' : ''),
        // 内联兜底：样式表万一没生效，这一层仍然可滚动，不会被 centerCol 的 overflow:hidden 裁死
        style: { height: '100%', overflowY: 'auto', minHeight: 0 },
      },
        h('div', { className: 'aw-inner' },
          STYLE_OK ? null : h('div', { className: 'aw-warn' },
            '样式表未生效（<style> 被拦截）：当前只能保证内容可滚动。把这句话发给我。'),
          h('header', { className: 'aw-top' },
          h('div', null,
            h('h1', null, '使用习惯'),
            h('p', { className: 'aw-lede' },
              '本机 ActivityWatch' + (data && data.range ? ' · 最近 ' + data.range.days + ' 天 · 电脑与手机合并' : ''))
          ),
          h('div', { className: 'aw-tools' },
            h('div', { className: 'aw-seg', role: 'group', 'aria-label': '统计区间' },
              [1, 7, 30].map(function (d) {
                return h('button', {
                  key: d,
                  'aria-pressed': days === d ? 'true' : 'false',
                  onClick: function () { setDays(d) },
                }, d === 1 ? '今日' : d + ' 天')
              })
            ),
            h('button', {
              className: 'aw-btn',
              onClick: function () { load(days) },
              disabled: busy,
            }, busy ? '刷新中' : '刷新')
          )
        ),
          body
        )
      ))
    }

    var inject = ['slots']

    function apply(ctx) {
      ensureStyle()
      // 与同栏的 dsh-mnemon / schedule / plugin-manager 同一套嵌套注册：
      // main 放正文，sidebar.panellist 放入口；任一步失败则释放已挂部分。
      return ctx.slots.inject('main', function () {
        return ctx.slots.inject('sidebar.panellist', function () {
          var stopMain = ctx.slots.register({ name: 'main', key: PANEL_ID }, DataPage)
          var stopIcon
          try {
            stopIcon = ctx.slots.register({
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 20,
              label: function () { return '使用习惯' },
            }, AwIcon)
          } catch (e) {
            if (typeof stopMain === 'function') stopMain()
            throw e
          }
          return function () {
            if (typeof stopIcon === 'function') stopIcon()
            if (typeof stopMain === 'function') stopMain()
          }
        })
      })
    }

    exports.apply = apply
    exports.inject = inject
    exports.name = 'dsh-aw-viz'
    exports.DataPage = DataPage
    exports.AwIcon = AwIcon
    return module.exports
  },
})
