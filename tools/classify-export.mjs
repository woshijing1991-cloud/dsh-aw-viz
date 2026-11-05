// tools/classify-export.mjs —— 把每条使用记录按用途归类并导出
//
// 产出：
//   $AW_DATA_DIR/purpose-<天数>d.csv   每条记录一行（按用户时区换算）
//   控制台：用途汇总、证据强度分布、未判定 Top
//
// 用法：node tools/classify-export.mjs [--days 14]
// 路径与基地址见 tools/env.mjs（AW_BASE / AW_DATA_DIR / AW_TZ_OFFSET_HOURS）。
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { classifyPurpose, summarizePurposes } from '../lib/purpose.js'
import { AW_BASE, AW_DATA_DIR, tzOffsetHours } from './env.mjs'

const B = AW_BASE
const argv = process.argv.slice(2)
const di = argv.indexOf('--days')
const DAYS = di >= 0 ? Number(argv[di + 1]) : 14

const OFF = tzOffsetHours() * 3600000
const localISO = (ms) => new Date(ms + OFF).toISOString().replace('T', ' ').slice(0, 19)

const j = async (u) => {
  const r = await fetch(u)
  if (!r.ok) throw new Error(u + ' ' + r.status)
  return r.json()
}

const start = new Date(Date.now() - DAYS * 86400e3).toISOString()
const names = Object.keys(await j(B + '/api/0/buckets/'))
const fetchEvents = async (id) => {
  try {
    const arr = await j(`${B}/api/0/buckets/${encodeURIComponent(id)}/events?start=${encodeURIComponent(start)}`)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

// AFK 活跃区间（只用于电脑事件）
const afk = []
for (const n of names.filter((n) => n.startsWith('aw-watcher-afk_'))) {
  for (const e of await fetchEvents(n)) {
    if ((e.data || {}).status === 'not-afk') afk.push([new Date(e.timestamp).getTime(), new Date(e.timestamp).getTime() + (+e.duration || 0) * 1000])
  }
}
const overlapSec = (s, e) => {
  let acc = 0
  for (const [as, ae] of afk) {
    const f = Math.max(as, s)
    const t = Math.min(ae, e)
    if (t > f) acc += (t - f) / 1000
  }
  return acc
}

const records = []
for (const n of names) {
  if (!(n.startsWith('aw-watcher-window_') || n.includes('android'))) continue
  if (n.includes('unlock')) continue
  const isPhone = n.includes('android')
  for (const e of await fetchEvents(n)) {
    const d = e.data || {}
    const s = new Date(e.timestamp).getTime()
    const dur = +e.duration || 0
    const sec = isPhone ? dur : (afk.length ? overlapSec(s, s + dur * 1000) : dur)
    if (sec <= 0.5) continue
    records.push({
      startMs: s,
      device: isPhone ? '手机' : '电脑',
      app: String(d.app || d.title || '?'),
      package: String(d.package || ''),
      detail: String(d.classname || d.title || ''),
      seconds: sec,
    })
  }
}
records.sort((a, b) => a.startMs - b.startMs)

// 逐条归类
for (const r of records) {
  const c = classifyPurpose(r)
  r.purpose = c.purpose
  r.confidence = c.confidence
  r.rule = c.rule || ''
}

// 导出 CSV（UTF-8 带 BOM，Excel 直接打开不乱码）
const header = ['开始时间(东八区)', '设备', '应用', '包名', '界面/标题', '秒数', '用途', '证据', '规则']
const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'
const lines = [header.join(',')]
for (const r of records) {
  lines.push([
    localISO(r.startMs), r.device, r.app, r.package, r.detail,
    Math.round(r.seconds * 10) / 10, r.purpose, r.confidence, r.rule,
  ].map(esc).join(','))
}
const out = join(AW_DATA_DIR, `purpose-${DAYS}d.csv`)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, '\uFEFF' + lines.join('\r\n'), 'utf8')

// 汇总
const sum = summarizePurposes(records, DAYS)
console.log('记录数 ' + records.length + '（' + DAYS + ' 天），已导出 ' + out)
console.log('')
console.log('== 按用途（六类）==')
for (const p of sum.purposes) {
  console.log('  ' + p.purpose.padEnd(8) + String(p.perDay).padStart(7) + ' 分/天  ' + String(p.share).padStart(3) + '%   (' + p.count + ' 条)')
}
console.log('')
console.log('== 三大类映射 ==')
for (const c of sum.coarse) console.log('  ' + c.name.padEnd(8) + String(c.perDay).padStart(7) + ' 分/天  ' + String(c.share).padStart(3) + '%')
console.log('')
console.log('== 证据强度（占比越高越可信）==')
console.log('  高  ' + sum.confidence.high.share + '%   中  ' + sum.confidence.medium.share + '%   低(未判定)  ' + sum.confidence.low.share + '%')
console.log('')
console.log('== 未判定 Top（规则还漏了什么）==')
for (const u of sum.unknownTop) console.log('  ' + String(u.perDay).padStart(6) + ' 分/天  ' + u.app)
