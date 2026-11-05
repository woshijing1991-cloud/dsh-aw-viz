// tools/env.mjs —— 运行期路径与基地址的唯一来源
//
// 这些脚本曾经把「数据写哪儿」硬编码成本机绝对路径。公开仓库里不能带任何人的
// 绝对路径，所以统一从这里取，全部可用环境变量覆盖：
//
//   AW_BASE             本机 aw-server 地址，默认 http://127.0.0.1:5600
//   AW_DATA_DIR         这些脚本写配置 / 报表 / 导出的目录，默认 <仓库根>/aw-data
//   AW_TZ_CONFIG        时区配置文件名，默认 $AW_DATA_DIR/user-tz.json
//   AW_TZ_OFFSET_HOURS  直接指定偏移小时数（优先级最高，适合你那台机器不改系统时区）
//
// 这些文件都只属于「本机导出/报表」这一侧，插件运行时不依赖它们；
// 插件侧（index.js / lib/stats.js）只读 127.0.0.1，不落库。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const AW_BASE = (process.env.AW_BASE || 'http://127.0.0.1:5600').replace(/\/+$/, '')

export const AW_DATA_DIR = process.env.AW_DATA_DIR
  ? resolve(process.env.AW_DATA_DIR)
  : join(ROOT, 'aw-data')

export const AW_TZ_CONFIG = process.env.AW_TZ_CONFIG
  ? resolve(process.env.AW_TZ_CONFIG)
  : join(AW_DATA_DIR, 'user-tz.json')

/** 用户时区偏移（小时）。没有配置时回退到 +8（东八区）。 */
export function tzOffsetHours(fallback = 8) {
  const raw = process.env.AW_TZ_OFFSET_HOURS
  if (raw !== undefined && raw !== '' && Number.isFinite(Number(raw))) return Number(raw)
  try {
    const cfg = JSON.parse(readFileSync(AW_TZ_CONFIG, 'utf8'))
    if (Number.isFinite(Number(cfg.offsetHours))) return Number(cfg.offsetHours)
  } catch { /* 没有配置文件就走兜底 */ }
  return fallback
}
