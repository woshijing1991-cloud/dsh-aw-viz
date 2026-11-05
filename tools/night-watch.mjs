// tools/night-watch.mjs —— 昨晚 22:00 → 今天 07:00 的手机使用检查
//
// 为什么单独做：深夜是这份数据里唯一"改了立刻有身体感受"的指标——
// 熬到几点的差隔天精力就告诉你，所以单独拎出来每天早上查一次。
// 每天早上跑一次，超过阈值就醒目报出来，不超就一句话带过。
//
// 用法：node tools/night-watch.mjs [--threshold 20] [--json]
// 状态：$AW_DATA_DIR/night-watch.json（默认位置见 tools/env.mjs）
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { AW_BASE, AW_DATA_DIR, tzOffsetHours } from './env.mjs'

const B = AW_BASE
const argv = process.argv.slice(2)
const ti = argv.indexOf('--threshold')
const THRESHOLD = ti >= 0 ? Number(argv[ti + 1]) : 20
const asJson = argv.includes('--json')

const OFF = tzOffsetHours() * 3600000

const j = async (u) => {
  const r = await fetch(u)
  if (!r.ok) throw new Error(u + ' ' + r.status)
  return r.json()
}

// 窗口：昨天 22:00 → 今天 07:00（用户时区）
const nowMs = Date.now()
const localNow = new Date(nowMs + OFF)
const todayMidnightLocal = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate())
const startLocal = todayMidnightLocal - 2 * 3600000       // 昨天 22:00
const endLocal = todayMidnightLocal + 7 * 3600000         // 今天 07:00
const startUtc = new Date(startLocal - OFF)
const endUtc = new Date(endLocal - OFF)

const names = Object.keys(await j(B + '/api/0/buckets/'))
const byApp = new Map()
let totalSec = 0
let deepSec = 0   // 0-3 点
for (const n of names) {
  if (!n.includes('android') || n.includes('unlock')) continue
  let arr = []
  try {
    arr = await j(`${B}/api/0/buckets/${encodeURIComponent(n)}/events?start=${encodeURIComponent(startUtc.toISOString())}&end=${encodeURIComponent(endUtc.toISOString())}`)
  } catch { continue }
  for (const e of arr) {
    const s0 = new Date(e.timestamp).getTime()
    const dur = (+e.duration || 0) * 1000
    const s1 = s0 + dur
    const f = Math.max(s0, startUtc.getTime())
    const t = Math.min(s1, endUtc.getTime())
    if (t <= f) continue
    const sec = (t - f) / 1000
    totalSec += sec
    const app = String((e.data || {}).app || '?')
    byApp.set(app, (byApp.get(app) || 0) + sec)
    // 0-3 点部分单独计
    const h = new Date(s0 + OFF).getUTCHours()
    if (h >= 0 && h <= 3) deepSec += sec
  }
}

const mins = Math.round(totalSec / 60)
const deepMins = Math.round(deepSec / 60)
const top = Array.from(byApp.entries())
  .map(([app, sec]) => ({ app, minutes: Math.round(sec / 60) }))
  .sort((a, b) => b.minutes - a.minutes)
  .slice(0, 5)

const over = mins > THRESHOLD
const dateLocal = new Date(nowMs + OFF).toISOString().slice(0, 10)
const state = {
  date: dateLocal,
  window: `昨天 22:00 → 今天 07:00 (UTC+${tzOffsetHours()})`,
  totalMinutes: mins,
  deepNightMinutes: deepMins,
  threshold: THRESHOLD,
  over,
  top: top.slice(0, 3),
  generatedAt: new Date().toISOString(),
}

const outPath = join(AW_DATA_DIR, 'night-watch.json')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(state, null, 2), 'utf8')

if (asJson) {
  console.log(JSON.stringify(state, null, 2))
} else {
  const head = over
    ? `⚠️ 昨晚 22:00-07:00 手机用了 ${mins} 分钟（阈值 ${THRESHOLD}），其中 0-3 点 ${deepMins} 分钟`
    : `昨晚 22:00-07:00 手机用了 ${mins} 分钟（阈值 ${THRESHOLD} 内），其中 0-3 点 ${deepMins} 分钟`
  console.log(head)
  if (top.length) console.log('主要占用：' + top.map((t) => `${t.app} ${t.minutes} 分`).join(' / '))
  console.log('状态已写入 ' + outPath)
}
