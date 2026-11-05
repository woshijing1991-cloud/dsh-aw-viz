// tools/export-sample.mjs —— 把当前聚合结果导出成 lib/sample-summary.js
//
// 用途：preview.html 在 file:// 下不能跨源 fetch，所以离线预览用一份快照。
// 仓库里那份是**虚构演示数据**；如果你想让预览显示自己的真实数据，就在本机跑一次这个脚本。
//
//   node tools/export-sample.mjs                  # 默认取最近 7 天
//   node tools/export-sample.mjs --days 14
//   node tools/export-sample.mjs --api http://127.0.0.1:<DSH 端口>/dsh-aw-viz/api/summary
//
// ⚠ 导出的文件含你自己的使用记录，**不要提交、不要外发**。
// 它是被 git 跟踪的文件（会显示为 modified），所以别 commit；用完执行
//   git checkout -- lib/sample-summary.js
// 就能还原成虚构演示数据。
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AW_BASE } from './env.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outPath = join(here, '..', 'lib', 'sample-summary.js')

const argv = process.argv.slice(2)
const argOf = (name, fallback) => {
  const i = argv.indexOf('--' + name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const days = Number(argOf('days', '7'))
const api = argOf('api', `${AW_BASE}/dsh-aw-viz/api/summary?days=${days}`)

const res = await fetch(api)
if (!res.ok) {
  console.error(`拉取失败：${api} → HTTP ${res.status}`)
  console.error('先确认 DSH 在跑、插件已加载，或改用 --api 指定地址。')
  process.exit(1)
}
const data = await res.json()
if (!data || !data.ok) {
  console.error('返回体不是有效的 summary：' + JSON.stringify(data).slice(0, 200))
  process.exit(1)
}

const header = [
  '/* 本机导出的快照（含真实使用记录，不要提交）：由 tools/export-sample.mjs 生成。',
  ` * 生成时间 ${new Date().toISOString()}，来源 ${api}`,
  ' */',
  'window.__AW_SAMPLE__ = ' + JSON.stringify(data) + ';',
  '',
].join('\n')

writeFileSync(outPath, header, 'utf8')
console.log(`已写入 ${outPath}（${header.length} 字符，最近 ${days} 天）`)
console.log('提示：用完想回到虚构演示数据，执行 git checkout -- lib/sample-summary.js')
