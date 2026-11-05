// tools/tz-normalize.mjs —— 时区自动换算（不改系统配置）
//
// 问题：电脑系统时区可能和你的实际作息时区不一致（例如系统在另一个时区）。
// ActivityWatch 存的是 UTC，一旦按"电脑 local"分桶，作息会整体错位十几小时
// （下午的使用被读成凌晨）。改系统时区影响别的软件，不合适。
//
// 做法：只在统计时换算。
//   1. 读出电脑当前时区与偏移（只读）
//   2. 读手机时区：adb getprop persist.sys.timezone → IANA 名 → 反算偏移；
//      拿不到就退回 adb date +%z；再不成就沿用上次配置
//   3. 写到 $AW_TZ_CONFIG（默认 $AW_DATA_DIR/user-tz.json），lib/stats.js 每次统计时读它
//
// 用法：
//   node tools/tz-normalize.mjs           # 探测并写入
//   node tools/tz-normalize.mjs --check   # 只看，不写
//   node tools/tz-normalize.mjs --hours 8 # 手动指定偏移（手机不在身边时）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { AW_TZ_CONFIG } from './env.mjs'

const CONFIG = AW_TZ_CONFIG

// 把 IANA 时区名在当前时刻换算成 UTC 偏移小时数（处理夏令时）
function offsetHoursForZone(zone, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
    }).formatToParts(at)
    const name = (parts.find((p) => p.type === 'timeZoneName') || {}).value || ''
    const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
    if (!m) return 0
    const sign = m[1] === '-' ? -1 : 1
    return sign * (Number(m[2]) + Number(m[3] || 0) / 60)
  } catch {
    return null
  }
}

function pcZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
    || new Date().toString().match(/\(([^)]+)\)$/)?.[1]
    || 'unknown'
}

function pcOffsetHours() {
  // getTimezoneOffset 返回"UTC - 本地"的分钟数，取反才是本地相对 UTC 的偏移
  return -new Date().getTimezoneOffset() / 60
}

function adb(args, timeout = 8000) {
  try {
    return execFileSync('adb', args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

// 从 adb 拿手机时区，返回 { zone, offsetHours, source }
function detectPhone(now) {
  const zone = adb(['shell', 'getprop', 'persist.sys.timezone'])
  if (zone && /^[A-Za-z]+\/[A-Za-z_+\-0-9]+$/.test(zone)) {
    const off = offsetHoursForZone(zone, now)
    if (off !== null) return { zone, offsetHours: off, source: 'adb:getprop' }
  }
  const z = adb(['shell', 'date', '+%z'])   // 形如 +0800
  const m = z.match(/^([+-])(\d{2})(\d{2})$/)
  if (m) {
    const sign = m[1] === '-' ? -1 : 1
    return {
      zone: zone || '(unknown)',
      offsetHours: sign * (Number(m[2]) + Number(m[3]) / 60),
      source: 'adb:date',
    }
  }
  return null
}

function readExisting() {
  try { return JSON.parse(readFileSync(CONFIG, 'utf8')) } catch { return null }
}

const argv = process.argv.slice(2)
const checkOnly = argv.includes('--check')
const manualIdx = argv.indexOf('--hours')
const manualHours = manualIdx >= 0 ? Number(argv[manualIdx + 1]) : null

const now = new Date()
const pz = pcZone()
const poff = pcOffsetHours()

let picked = null
if (Number.isFinite(manualHours)) {
  picked = { zone: '(manual)', offsetHours: manualHours, source: 'arg:--hours' }
} else {
  picked = detectPhone(now)
}
if (!picked) {
  const prev = readExisting()
  if (prev && Number.isFinite(Number(prev.offsetHours))) {
    picked = { zone: prev.userTimezone || '(cached)', offsetHours: Number(prev.offsetHours), source: 'cache' }
  } else {
    picked = { zone: pz, offsetHours: poff, source: 'fallback:pc' }
  }
}

const cfg = {
  userTimezone: picked.zone,
  offsetHours: picked.offsetHours,
  source: picked.source,
  pcTimezone: pz,
  pcOffsetHours: poff,
  deltaHours: picked.offsetHours - poff,
  updatedAt: now.toISOString(),
}

console.log('电脑时区 : ' + pz + '  (UTC' + (poff >= 0 ? '+' : '') + poff + ')')
console.log('用户时区 : ' + cfg.userTimezone + '  (UTC' + (cfg.offsetHours >= 0 ? '+' : '') + cfg.offsetHours + ', 来源 ' + cfg.source + ')')
console.log('两者相差 : ' + cfg.deltaHours + ' 小时' + (cfg.deltaHours === 0 ? '（无需换算）' : '（统计时自动补偿，不改系统设置）'))

if (checkOnly) {
  console.log('\n--check：未写入 ' + CONFIG)
} else {
  mkdirSync(dirname(CONFIG), { recursive: true })
  writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), 'utf8')
  console.log('\n已写入 ' + CONFIG)
  console.log('lib/stats.js 下次统计会自动读取这个偏移量。')
}
