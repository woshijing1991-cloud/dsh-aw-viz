// tools/weekly-report.mjs —— 周报：本周 vs 上周，只看四个目标项
//
// 设计原则：只报"能行动"的数。总时长这种三个月不变的数不报，报了也没人看。
// 四个默认目标项：短视频信息流、社交信息流、深夜 0-3 点、学习（对照）；
// 下面的 TARGETS 只是示例阈值，改成你自己的目标即可。
//
// 用法：node tools/weekly-report.mjs [--days 14]
// 产物：$AW_DATA_DIR/reports/weekly-YYYY-MM-DD.md（默认位置见 tools/env.mjs）
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildSummary } from '../lib/stats.js'
import { AW_BASE, AW_DATA_DIR, tzOffsetHours } from './env.mjs'

const argv = process.argv.slice(2)
const di = argv.indexOf('--days')
const DAYS = di >= 0 ? Number(argv[di + 1]) : 14

const B = AW_BASE
const s = await buildSummary({ base: B, days: DAYS })

const OFF = tzOffsetHours() * 3600000
const today = new Date(Date.now() + OFF).toISOString().slice(0, 10)

const wl = s.purpose.watchlist || []
const byKey = Object.fromEntries(wl.map((w) => [w.key, w]))
const fp = (v) => (v >= 0 ? '+' : '') + Number(v).toFixed(1)

// 目标：视频号 ≤30、X ≤10、深夜 ≤30、学习 ≥40（分钟/天）
const TARGETS = { '微信视频号': 30, 'X': 10, '深夜0-3点': 30, '学习': 40 }
const mark = (key, cur) => {
  const t = TARGETS[key]
  if (t === undefined) return ''
  // 学习是"越多越好"，其余是"越少越好"
  const ok = key === '学习' ? cur >= t : cur <= t
  return ok ? '✅' : '❌'
}

const lines = []
lines.push('# 使用习惯周报 ' + today)
lines.push('')
lines.push('| 目标项 | 上周 | 本周 | 变化 | 目标 | 达成 |')
lines.push('|---|---|---|---|---|---|')
for (const key of ['微信视频号', 'X', '深夜0-3点', '学习']) {
  const w = byKey[key] || { lastWeekPerDay: 0, thisWeekPerDay: 0, deltaPerDay: 0 }
  lines.push(
    `| ${key} | ${w.lastWeekPerDay} | **${w.thisWeekPerDay}** | ${fp(w.deltaPerDay)} | ${TARGETS[key]} | ${mark(key, w.thisWeekPerDay)} |`
  )
}
lines.push('')
lines.push('（单位：分钟/天；「深夜0-3点」是绝对时间窗，不是某种 App）')
lines.push('')
lines.push('## 用途占比（最近 7 天日均）')
lines.push('')
lines.push('| 用途 | 分钟/天 | 占比 |')
lines.push('|---|---|---|')
for (const p of s.purpose.purposes) {
  lines.push(`| ${p.purpose} | ${p.perDay} | ${p.share}% |`)
}
lines.push('')
lines.push('## 数据质量')
lines.push('')
const c = s.purpose.confidence
lines.push(`- 证据强度：高 ${c.high.share}% / 中 ${c.medium.share}% / 低（未判定）${c.low.share}%`)
lines.push(`- 时区偏移：UTC+${s.purpose.timezoneOffsetHours ?? tzOffsetHours()}（与电脑系统时区无关）`)
lines.push(`- 生成时间：${new Date().toISOString()}`)

const md = lines.join('\n')
const dir = join(AW_DATA_DIR, 'reports')
mkdirSync(dir, { recursive: true })
const out = `${dir}/weekly-${today}.md`
writeFileSync(out, md, 'utf8')

console.log(md)
console.log('')
console.log('已写入 ' + out)
