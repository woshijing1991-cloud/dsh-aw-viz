// lib/stats.js — 把 ActivityWatch 的原始事件算成「习惯看板」的指标。
//
// 全部只读：只向 127.0.0.1 的本地 aw-server 发 GET，不写任何数据、不出网。
//
// 指标口径（每一项都对应一个既有框架，不是随手编的）：
//   1. 时间分配 by category —— RescueTime 的 Productivity Pulse / 类别占比
//   2. 碎片化：单段时长中位数、切换频次 —— Mark et al. 2008《The Cost of
//      Interrupted Work》+ Leroy 2009「attention residue」
//   3. 专注块：最长连续同类段、≥25 分钟块数 —— Deep Work（Newport）/ 超日节律
//   4. 时段分布：24h × 7d 热力 —— 睡眠型/晨型（chronotype）与 Digital Wellbeing 的 hourly 视图
//   5. 首次使用 / 最后使用 / 解锁次数 —— Apple Screen Time 的 pickups 口径
//   6. 电脑 vs 手机分账 —— 双设备归因
//   7. 关机空档（本机自建的 aw-offline 标记）—— 数据完整性，避免把"没记录"误读成"没活动"

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { classifyPurpose, summarizePurposes } from './purpose.js'

const CATEGORY_RULES = [
  // 顺序敏感：先匹配先赢
  ['AI/Agent', /deepseek|chatgpt|claude|doubao|豆包|copilot|codebuddy|workbuddy|cursor|trae|kimi|tongyi|qwen|grok|zerostudy|english-study/i],
  ['Work/Dev', /code|devenv|idea|pycharm|webstorm|goland|rider|sublime|notepad|vim|nvim|emacs|zed|terminal|powershell|pwsh|cmd\.exe|python|node|git|docker|postman|insomnia|dbeaver|navicat|ssms|activitywatch/i],
  ['Work/Office', /winword|word|excel|powerpnt|powerpoint|wps|onenote|outlook|acrobat|foxit|typora|obsidian|notion|feishu|lark|dingtalk|wework|tencentdocs|腾讯文档|笔记|telegram/i],
  ['Comms', /wechat|weixin|微信|qq|discord|slack|whatsapp|短信|电话|dialer|gmail|邮件/i],
  ['Media', /youtube|bilibili|iqiyi|youku|tencentvideo|腾讯视频|douyin|抖音|spotify|netease|cloudmusic|qqmusic|potplayer|vlc|mpc|mpv|foobar|jianying|剪映|capcut|obs|照片|相册/i],
  ['Social', /(^|\W)x$|twitter|微博|weibo|reddit|小红书|xiaohongshu|instagram|facebook|threads|贴吧|知乎/i],
  ['Shopping', /taobao|淘宝|jd|京东|pinduoduo|拼多多|xianyu|闲鱼|amazon|购物|kitesim/i],
  ['Browser', /msedge|chrome|firefox|brave|opera|vivaldi|arc|via|浏览器|browser|honorbrowser/i],
  ['Game', /steam|epic|battle\.net|wegame|game|mumu|模拟器/i],
  ['Utilities', /explorer|桌面|launcher|settings|设置|systemsettings|taskmgr|calculator|计算器|snippingtool|截图|everything|7z|winrar|bandizip|bitwarden|clash|huorong|火绒|magpie|input|sogou|搜狗|gboard|键盘/i],
]

// 界面级拆分：只看 App 名会把「微信」当成沟通，而它内部有相当一部分是视频号。
// 规则顺序敏感（先匹配先赢），必须在通用规则之前返回。
// group 用于把「微信内部」和「桌面空转」这类死区分开统计。
const DETAIL_RULES = [
  ['视频号', 'wechat', /^com\.tencent\.mm\.plugin\.finder\./],
  ['小程序', 'wechat', /^com\.tencent\.mm\.plugin\.(appbrand|lite)\./],
  ['公众号/网页', 'wechat', /^com\.tencent\.mm\.plugin\.(brandservice|webview)\./],
  ['朋友圈', 'wechat', /^com\.tencent\.mm\.plugin\.sns\./],
  ['聊天', 'wechat', /^com\.tencent\.mm\.ui\.chatting\./],
  ['微信主界面', 'wechat', /^com\.tencent\.mm\.(ui\.LauncherUI|ui\.conversation\.)/],
  ['桌面空转', 'deadzone', /^(com\.hihonor\.android\.launcher|com\.hihonor\.edulauncher|com\.hihonor\.hnofficelauncher|com\.android\.launcher3)/],
]

// 界面级 → 类别。微信的 66% 是视频号，若按 App 名归进「沟通」，结论正好相反。
const DETAIL_CATEGORY = {
  '视频号': '短视频',
  '小程序': '小程序',
  '公众号/网页': '内容阅读',
  '朋友圈': '社交',
  '聊天': '沟通',
  '微信主界面': '空转',
  '桌面空转': '空转',
}

export function detailOf(pkg, cls) {
  const hay = cls || pkg || ''
  if (!hay) return null
  for (const [name, group, re] of DETAIL_RULES) {
    if (re.test(hay)) return { name, group }
  }
  return null
}

const AFK_ACTIVE = 'not-afk'

// 分时段必须按「用户所在时区」算，不能按电脑 local。
// 当系统时区与用户真实所在地不一致时，直接用 new Date(ms).getHours()
// 会把作息整体错位几个小时（"凌晨高峰"其实是下午）。
// 时区：按「用户所在时区」算，不按电脑 local。
// 偏移量来源优先级：环境变量 > tools/tz-normalize.mjs 写出的配置文件 > 默认 +8。
// 配置文件位置不再写死：AW_TZ_CONFIG 优先，其次 $AW_DATA_DIR/user-tz.json。
// 注意：**不改系统时区**，只在统计时换算。
// 默认值取运行环境的本地时区；写死 +8 会让海外用户整张时段图偏移（EST 用户会错 13 小时）。
function systemOffsetHours() {
  const off = -new Date().getTimezoneOffset() / 60
  return Number.isFinite(off) ? off : 0
}
function resolveTzOffsetHours() {
  const raw = process.env.AW_TZ_OFFSET_HOURS
  if (raw !== undefined && raw !== '' && Number.isFinite(Number(raw))) return Number(raw)
  const p = process.env.AW_TZ_CONFIG
    || (process.env.AW_DATA_DIR ? join(process.env.AW_DATA_DIR, 'user-tz.json') : '')
  if (!p) return systemOffsetHours()
  try {
    const cfg = JSON.parse(readFileSync(p, 'utf8'))
    if (Number.isFinite(Number(cfg.offsetHours))) return Number(cfg.offsetHours)
  } catch { /* 没有配置文件就走默认 */ }
  return systemOffsetHours()
}
const TZ_OFFSET_HOURS = resolveTzOffsetHours()
const TZ_OFFSET_MS = TZ_OFFSET_HOURS * 3600000
const shift = (ms) => ms + TZ_OFFSET_MS
const hourOf = (ms) => new Date(shift(ms)).getUTCHours()
const dayKeyOf = (ms) => new Date(shift(ms)).toISOString().slice(0, 10)
const weekdayOf = (ms) => (new Date(shift(ms)).getUTCDay() + 6) % 7 // 周一=0
const nextHourEdge = (ms) => (Math.floor(shift(ms) / 3600000) + 1) * 3600000 - TZ_OFFSET_MS

export function categorize(appName, extra) {
  const s = `${appName || ''} ${extra || ''}`
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(s)) return cat
  }
  return 'Uncategorized'
}

export async function probe(base) {
  const r = await fetchJson(`${base}/api/0/info`)
  const b = await fetchJson(`${base}/api/0/buckets/`)
  const names = b ? Object.keys(b) : []
  return {
    version: r && r.version,
    hostname: r && r.hostname,
    buckets: names.length,
    hasPhone: names.some((n) => n.endsWith('-phone')),
    hasOffline: names.some((n) => n.startsWith('aw-offline')),
  }
}

async function fetchJson(url, timeoutMs = 20000) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ac.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

function iso(d) {
  return d.toISOString()
}

// 把窗口事件与 not-afk 区间求交，得到"真的在用"的活跃秒数
function computeActive(winEvents, afkActive) {
  // afkActive: [[startMs, endMs], ...] 已排序
  const out = []
  for (const ev of winEvents) {
    const s = ev.startMs
    const e = ev.endMs
    if (e <= s) continue
    let acc = 0
    // 二分找起点，再线性扫，避免 O(n*m)
    let lo = 0
    let hi = afkActive.length - 1
    let idx = afkActive.length
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (afkActive[mid][1] <= s) lo = mid + 1
      else { idx = mid; hi = mid - 1 }
    }
    for (let i = Math.max(0, idx); i < afkActive.length; i++) {
      const [as, ae] = afkActive[i]
      if (as >= e) break
      const from = Math.max(as, s)
      const to = Math.min(ae, e)
      if (to > from) acc += (to - from) / 1000
    }
    if (acc > 0) out.push({ ...ev, activeSec: acc })
  }
  return out
}

function median(nums) {
  if (!nums.length) return 0
  const a = nums.slice().sort((x, y) => x - y)
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

export async function buildSummary({ base, days }) {
  const now = Date.now()
  const end = new Date(now)
  const start = new Date(now - days * 86400000)
  const buckets = await fetchJson(`${base}/api/0/buckets/`)
  const names = Object.keys(buckets || {})

  const isAfk = (n) => n.startsWith('aw-watcher-afk_')
  const isWindow = (n) => (n.startsWith('aw-watcher-window_') || n === 'aw-watcher-android-phone' || /-phone$/.test(n)) && !n.includes('unlock')
  const isWeb = (n) => n.startsWith('aw-watcher-web')
  const isOffline = (n) => n.startsWith('aw-offline')
  const isUnlock = (n) => n.includes('unlock')

  const fetchEventsFor = async (bid) => {
    const url = `${base}/api/0/buckets/${encodeURIComponent(bid)}/events?start=${encodeURIComponent(iso(start))}&end=${encodeURIComponent(iso(end))}`
    try {
      const raw = await fetchJson(url, 60000)
      const arr = Array.isArray(raw) ? raw : []
      return arr.map((e) => {
        const s = new Date(e.timestamp).getTime()
        const dur = Number(e.duration) || 0
        const dev = bid.endsWith('-phone') ? 'phone' : (bid.includes('android') ? 'phone' : 'pc')
        return { startMs: s, endMs: s + dur * 1000, durSec: dur, data: e.data || {}, device: dev, bucket: bid }
      }).filter((e) => e.endMs > e.startMs || e.durSec >= 0)
    } catch {
      return []
    }
  }

  // AFK 活跃区间（全局，跨设备共用：手机没有 afk watcher，按"有事件即活跃"处理）
  const afkIntervals = []
  for (const n of names.filter(isAfk)) {
    const evs = await fetchEventsFor(n)
    for (const e of evs) {
      if ((e.data.status || '') === AFK_ACTIVE) afkIntervals.push([e.startMs, e.endMs])
    }
  }
  afkIntervals.sort((a, b) => a[0] - b[0])
  // 合并重叠
  const mergedAfk = []
  for (const iv of afkIntervals) {
    const last = mergedAfk[mergedAfk.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else mergedAfk.push([iv[0], iv[1]])
  }
  const afkTotalSec = mergedAfk.reduce((a, [s, e]) => a + (e - s) / 1000, 0)

  // 窗口事件（电脑 + 手机）
  const winBuckets = names.filter(isWindow)
  const winAll = []
  for (const b of winBuckets) {
    const evs = await fetchEventsFor(b)
    for (const e of evs) winAll.push(e)
  }
  winAll.sort((a, b) => a.startMs - b.startMs)

  // 电脑事件用 AFK 求交；手机事件没有 afk，按 durSec 计
  const pcEvents = winAll.filter((e) => e.device === 'pc')
  const phoneEvents = winAll.filter((e) => e.device === 'phone')
  const pcActive = mergedAfk.length ? computeActive(pcEvents, mergedAfk) : pcEvents.map((e) => ({ ...e, activeSec: e.durSec }))
  const phoneActive = phoneEvents.map((e) => ({ ...e, activeSec: Math.max(0, e.durSec) }))
  const activeAll = pcActive.concat(phoneActive)

  const totalActiveSec = activeAll.reduce((a, e) => a + e.activeSec, 0)

  // 分类 / 应用 / 设备 / 界面级细项
  const byCat = new Map()
  const byApp = new Map()
  const byDetail = new Map()
  const byDevice = { pc: 0, phone: 0 }
  for (const e of activeAll) {
    const app = String(e.data.app || e.data.title || 'unknown')
    const pkg = String(e.data.package || '')
    const cls = String(e.data.classname || '')
    const d = detailOf(pkg, cls)
    // 界面级分类优先于 App 级
    const cat = (d && DETAIL_CATEGORY[d.name]) || categorize(app, pkg)
    byCat.set(cat, (byCat.get(cat) || 0) + e.activeSec)
    const cur = byApp.get(app) || { app, minutes: 0, device: e.device, segments: 0 }
    cur.minutes += e.activeSec / 60
    cur.segments += 1
    byApp.set(app, cur)
    byDevice[e.device] += e.activeSec
    if (d) {
      const k = d.group + ':' + d.name
      const rec = byDetail.get(k) || { name: d.name, group: d.group, sec: 0, segments: 0, pkg, cls }
      rec.sec += e.activeSec
      rec.segments += 1
      byDetail.set(k, rec)
    }
  }

  // 界面级汇总：微信内部拆解 + 死区
  // 注意：这里用局部 r1，不能借用后面的 pick —— 那会踩 const 的 TDZ。
  const r1 = (v) => Math.round(v * 10) / 10
  const detailItems = Array.from(byDetail.values())
    .map((r) => ({ name: r.name, group: r.group, minutes: r1(r.sec / 60), segments: r.segments, package: r.pkg }))
    .sort((a, b) => b.minutes - a.minutes)
  const wechatItems = detailItems.filter((i) => i.group === 'wechat')
  const wechatTotal = wechatItems.reduce((a, i) => a + i.minutes, 0)
  const deadItems = detailItems.filter((i) => i.group === 'deadzone')
  const deadzoneMinutes = deadItems.reduce((a, i) => a + i.minutes, 0)
  const detailSummary = {
    timezoneOffsetHours: TZ_OFFSET_HOURS,
    wechat: {
      totalMinutes: r1(wechatTotal),
      perDay: r1(wechatTotal / days),
      items: wechatItems.map((i) => ({
        ...i,
        share: wechatTotal > 0 ? Math.round((i.minutes / wechatTotal) * 100) : 0,
        perDay: r1(i.minutes / days),
      })),
    },
    deadzone: {
      totalMinutes: r1(deadzoneMinutes),
      perDay: r1(deadzoneMinutes / days),
      share: totalActiveSec > 0 ? Math.round((deadzoneMinutes / (totalActiveSec / 60)) * 100) : 0,
      items: deadItems.map((i) => ({ ...i, perDay: r1(i.minutes / days) })),
    },
    items: detailItems.slice(0, 14).map((i) => ({ ...i, perDay: r1(i.minutes / days) })),
  }

  // 碎片化：单段时长（只统计 >0 的段，0 秒是心跳合并残留）
  const segSecs = activeAll.filter((e) => e.activeSec > 0.5).map((e) => e.activeSec)
  // 切换：相邻两条事件 app 变化且间隔 < 2 分钟
  let switches = 0
  for (let i = 1; i < activeAll.length; i++) {
    const prev = activeAll[i - 1]
    const cur = activeAll[i]
    const sameApp = String(prev.data.app) === String(cur.data.app)
    const gapSec = (cur.startMs - prev.endMs) / 1000
    if (!sameApp && gapSec < 120) switches++
  }

  // 专注块：同类目连续段（间隔 <= 2 分钟）累加
  const focusBlocks = []
  let curBlock = null
  for (const e of activeAll) {
    const cat = categorize(String(e.data.app || ''), e.data.package || '')
    if (curBlock && curBlock.cat === cat && (e.startMs - curBlock.lastEnd) <= 120000) {
      curBlock.sec += e.activeSec
      curBlock.lastEnd = Math.max(curBlock.lastEnd, e.endMs)
    } else {
      if (curBlock) focusBlocks.push(curBlock)
      curBlock = { cat, sec: e.activeSec, lastEnd: e.endMs }
    }
  }
  if (curBlock) focusBlocks.push(curBlock)
  const longestBlockMin = focusBlocks.reduce((a, b) => Math.max(a, b.sec), 0) / 60
  const deepBlocks = focusBlocks.filter((b) => b.sec >= 25 * 60).length

  // 用途分类 + 周对比：这是看板的主视图（技术分类只作为证据层保留）
  const purposeRecords = activeAll.map((e) => ({
    startMs: e.startMs,
    app: String(e.data.app || e.data.title || '?'),
    package: String(e.data.package || ''),
    classname: String(e.data.classname || ''),
    title: String(e.data.title || ''),
    seconds: e.activeSec,
    device: e.device,
  }))
  const purposeAll = summarizePurposes(purposeRecords, days)

  // 用途 × 小时 与 用途 × 日：时间轴对照图和产出相关性都要用
  const hourMaps = Array.from({ length: 24 }, () => new Map())
  const dayMaps = new Map()
  const dayObj = () => new Map()
  for (const r of purposeRecords) {
    if (!(r.seconds > 0)) continue
    const { purpose } = classifyPurpose(r)
    const mins = r.seconds / 60
    const hm = hourMaps[hourOf(r.startMs)]
    hm.set(purpose, (hm.get(purpose) || 0) + mins)
    const dk = dayKeyOf(r.startMs)
    if (!dayMaps.has(dk)) dayMaps.set(dk, dayObj())
    const dm = dayMaps.get(dk)
    dm.set(purpose, (dm.get(purpose) || 0) + mins)
  }
  const r1p = (v) => Math.round(v * 10) / 10
  purposeAll.hourly = hourMaps.map((m) => {
    const o = {}
    for (const [k, v] of m) o[k] = r1p(v)
    return o
  })
  purposeAll.daily = Array.from(dayMaps.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, m]) => {
      const o = { date }
      let total = 0
      for (const [k, v] of m) { o[k] = r1p(v); total += v }
      o.total = r1p(total)
      return o
    })

  // 周对比：最近 7 天 vs 之前 7 天（日均分钟），用来看趋势而不是绝对值
  const weekAgo = end.getTime() - 7 * 86400000
  const perDayMap = (s) => Object.fromEntries(s.purposes.map((p) => [p.purpose, p.perDay]))
  const curMap = perDayMap(summarizePurposes(purposeRecords.filter((r) => r.startMs >= weekAgo), 7))
  const prevMap = perDayMap(summarizePurposes(purposeRecords.filter((r) => r.startMs < weekAgo), 7))
  const rr = (v) => Math.round(v * 10) / 10
  purposeAll.wow = purposeAll.purposes.map((p) => {
    const cur = curMap[p.purpose] || 0
    const prev = prevMap[p.purpose] || 0
    return {
      purpose: p.purpose,
      thisWeek: cur,
      lastWeek: prev,
      deltaPerDay: rr(cur - prev),
      deltaPct: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null,
    }
  })
  purposeAll.windowNote = '最近 7 天 vs 前 7 天，单位=日均分钟'

  // 目标项周对比：示例中挑了三个典型「想减少」的项（短视频信息流 / 社交信息流 / 深夜），
  // 外加学习做对照组；这些 key 只是默认值，可按自己的关注点改。
  const WATCH = [
    { key: '微信视频号', test: (r) => /com\.tencent\.mm\.plugin\.finder\./.test(r.classname || '') },
    { key: 'X', test: (r) => /com\.twitter\.android/.test(r.package || '') },
    { key: '深夜0-3点', test: (r) => { const hh = hourOf(r.startMs); return hh >= 0 && hh <= 3 } },
    { key: '学习', test: (r) => classifyPurpose(r).purpose === '学习' },
  ]
  purposeAll.watchlist = WATCH.map((w) => {
    let cur = 0
    let prev = 0
    for (const r of purposeRecords) {
      if (!w.test(r)) continue
      if (r.startMs >= weekAgo) cur += r.seconds / 60
      else prev += r.seconds / 60
    }
    return {
      key: w.key,
      thisWeekPerDay: rr(cur / 7),
      lastWeekPerDay: rr(prev / 7),
      deltaPerDay: rr((cur - prev) / 7),
    }
  })

  // 逐日与时段（按 TZ_OFFSET_HOURS 分桶，不按电脑 local）
  const byDayMap = new Map()
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  const hourly = Array.from({ length: 24 }, () => 0)
  for (const e of activeAll) {
    // 按"用户时区的小时"切分事件，才能正确落进热力图
    let cursor = e.startMs
    const endMs = e.startMs + e.activeSec * 1000
    while (cursor < endMs) {
      const sliceEnd = Math.min(nextHourEdge(cursor), endMs)
      const sec = (sliceEnd - cursor) / 1000
      const k = dayKeyOf(cursor)
      const day = byDayMap.get(k) || { date: k, activeMinutes: 0, pcMinutes: 0, phoneMinutes: 0 }
      day.activeMinutes += sec / 60
      if (e.device === 'pc') day.pcMinutes += sec / 60
      else day.phoneMinutes += sec / 60
      byDayMap.set(k, day)
      heat[weekdayOf(cursor)][hourOf(cursor)] += sec / 60
      hourly[hourOf(cursor)] += sec / 60
      cursor = sliceEnd
    }
  }

  // 关机空档
  let offlineMinutes = 0
  let offlineBlocks = 0
  for (const n of names.filter(isOffline)) {
    const evs = await fetchEventsFor(n)
    for (const e of evs) {
      offlineMinutes += e.durSec / 60
      offlineBlocks++
    }
  }

  // 解锁次数（手机）
  let unlocks = 0
  for (const n of names.filter(isUnlock)) {
    const evs = await fetchEventsFor(n)
    unlocks += evs.length
  }

  const byDay = Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  const activeHours = totalActiveSec / 3600

  const pick = (v) => Math.round(v * 10) / 10

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    range: { days, start: iso(start), end: iso(end) },
    completeness: {
      offlineBlocks,
      offlineMinutes: pick(offlineMinutes),
      note: offlineBlocks ? '关机时段已用 aw-offline 标记，不是"没活动"' : '未检测到关机空档标记',
    },
    totals: {
      activeMinutes: pick(totalActiveSec / 60),
      afkMinutes: pick(afkTotalSec / 60),
      pcMinutes: pick(byDevice.pc / 60),
      phoneMinutes: pick(byDevice.phone / 60),
      pcShare: totalActiveSec ? Math.round((byDevice.pc / (byDevice.pc + byDevice.phone || 1)) * 100) : 0,
      unlocks,
    },
    focus: {
      longestBlockMin: pick(longestBlockMin),
      deepBlocks,
      medianSegmentSec: pick(median(segSecs)),
      switches,
      switchesPerHour: activeHours > 0 ? pick(switches / activeHours) : 0,
      fragmentation: segSecs.length
        ? Math.round((segSecs.filter((s) => s < 30).length / segSecs.length) * 100)
        : 0,
    },
    categories: Array.from(byCat.entries())
      .map(([name, sec]) => ({ name, minutes: pick(sec / 60), share: totalActiveSec ? Math.round((sec / totalActiveSec) * 100) : 0 }))
      .sort((a, b) => b.minutes - a.minutes),
    apps: Array.from(byApp.values())
      .map((a) => ({ ...a, minutes: pick(a.minutes) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 15),
    detail: detailSummary,
    purpose: purposeAll,
    byDay: byDay.map((d) => ({
      ...d,
      activeMinutes: pick(d.activeMinutes),
      pcMinutes: pick(d.pcMinutes),
      phoneMinutes: pick(d.phoneMinutes),
    })),
    heatmap: heat.map((row) => row.map((v) => Math.round(v))),
    hourly: hourly.map((v) => Math.round(v)),
    devices: { pcMinutes: pick(byDevice.pc / 60), phoneMinutes: pick(byDevice.phone / 60) },
  }
}

export function renderText(s) {
  if (!s || !s.ok) return '读取失败：' + (s && s.error || 'unknown')
  const t = s.totals
  const f = s.focus
  const lines = []
  lines.push(`【使用习惯看板】最近 ${s.range.days} 天`)
  lines.push(`活跃 ${t.activeMinutes} 分钟（电脑 ${t.pcMinutes} / 手机 ${t.phoneMinutes}，电脑占 ${t.pcShare}%）`)
  lines.push(`碎片化：单段中位 ${f.medianSegmentSec} 秒，每活跃小时切换 ${f.switchesPerHour} 次，短段(<30s)占 ${f.fragmentation}%`)
  lines.push(`专注：最长连续 ${f.longestBlockMin} 分钟，≥25 分钟的块 ${f.deepBlocks} 个`)
  lines.push(`关机空档：${s.completeness.offlineBlocks} 段，共 ${s.completeness.offlineMinutes} 分钟`)
  lines.push('')
  lines.push('分类占比：')
  for (const c of s.categories.slice(0, 8)) lines.push(`  ${c.name.padEnd(14)} ${c.minutes} 分钟 (${c.share}%)`)
  lines.push('')
  lines.push('Top 应用：')
  for (const a of s.apps.slice(0, 8)) lines.push(`  ${a.app.padEnd(24)} ${a.minutes} 分钟 (${a.device})`)
  return lines.join('\n')
}
