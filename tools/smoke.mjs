// tools/smoke.mjs —— 无需 ActivityWatch 的自检
//
// 覆盖四件事：
//   1. lib/client.js 与 lib/page.css + 模板是否一致（构建漂移）
//   2. lib/sample-summary.js 的结构是否还能被 preview.html 渲染
//   3. 分类/用途规则是否还能命中（防正则改坏）
//   4. 仓库里有没有混进本机绝对路径（隐私红线，CI 里当门禁）
//
// 用法：node tools/smoke.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { classifyPurpose } from '../lib/purpose.js'
import { categorize } from '../lib/stats.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0

function check(name, fn) {
  try {
    fn()
    console.log('  ok   ' + name)
  } catch (e) {
    failed++
    console.error('  FAIL ' + name + ' — ' + (e && e.message ? e.message : e))
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

// ── 1. 构建漂移：client.js 必须等于模板 + page.css ──────────────
check('lib/client.js 与 page.css 一致', () => {
  const MARK = '__AW_CSS_LITERAL__'
  const css = readFileSync(join(ROOT, 'lib', 'page.css'), 'utf8')
  const tpl = readFileSync(join(ROOT, 'lib', 'client.template.js'), 'utf8')
  const built = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8')
  assert(tpl.split(MARK).length - 1 === 1, '模板里的 __AW_CSS_LITERAL__ 必须恰好出现一次')
  assert(tpl.replace(MARK, () => JSON.stringify(css)) === built,
    'client.js 与 page.css 不一致，跑 node tools/build-client.mjs')
})

// ── 2. 样本数据结构 ────────────────────────────────────────────
const sampleLoaded = (() => {
  globalThis.window = globalThis.window || {}
  const p = pathToFileURL(join(ROOT, 'lib', 'sample-summary.js')).href
  // 样本是普通脚本（挂到 window 上），动态 import 只为了拿到副作用
  return import(p).then(() => globalThis.window.__AW_SAMPLE__)
})()

const sample = await sampleLoaded
check('lib/sample-summary.js 结构完整', () => {
  assert(sample && sample.ok === true, '样本数据缺失或 ok!==true')
  for (const k of ['totals', 'focus', 'categories', 'apps', 'purpose', 'byDay', 'heatmap', 'hourly', 'devices']) {
    assert(sample[k], '缺少字段 ' + k)
  }
  assert(Array.isArray(sample.heatmap) && sample.heatmap.length === 7, 'heatmap 应为 7 行')
  assert(sample.heatmap.every((r) => Array.isArray(r) && r.length === 24), 'heatmap 每行应为 24 列')
  assert(Array.isArray(sample.hourly) && sample.hourly.length === 24, 'hourly 应为 24 项')
  assert(sample.categories.length > 0 && sample.apps.length > 0, '分类/应用列表不能为空')
  const sum = sample.categories.reduce((a, c) => a + (Number(c.minutes) || 0), 0)
  const total = Number(sample.totals.activeMinutes) || 0
  assert(total > 0, 'totals.activeMinutes 必须大于 0')
  assert(Math.abs(sum - total) / total < 0.05, `分类合计 ${sum.toFixed(1)} 与活跃总时长 ${total} 偏差过大`)
})

// ── 3. 规则命中 ───────────────────────────────────────────────
check('用途分类规则命中', () => {
  assert(classifyPurpose({ app: 'YouTube', title: 'watch' }).purpose === '娱乐消遣', 'YouTube 应归娱乐消遣')
  assert(classifyPurpose({ package: 'com.tencent.mm.plugin.finder.ui' }).purpose === '娱乐消遣', '视频号应归娱乐消遣')
  assert(classifyPurpose({ app: 'Code.exe', title: 'index.js' }).purpose === '办公', '编辑器应归办公')
  assert(classifyPurpose({ app: 'unknownthing' }).purpose === '工具/未知', '未命中应为工具/未知')
})

check('应用粗分类规则命中', () => {
  assert(categorize('msedge.exe', '') === 'Browser', 'msedge 应归 Browser')
  assert(categorize('steam.exe', '') === 'Game', 'steam 应归 Game')
})

// ── 4. 隐私红线：源码里不得出现本机绝对路径 ────────────────────
check('源码中无本机绝对路径', () => {
  const RE = /(?<![A-Za-z])[A-Za-z]:[\\/]/
  const SKIP = new Set(['node_modules', '.git', 'aw-data', 'data', 'exports', 'reports'])
  // 本机私有脚本：.gitignore 已排除，不参与公开仓库的红线检查（它读的是本机私有路径）
  const SKIP_FILES = new Set(['tools/study-correlation.mjs'])
  const bad = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) { walk(full); continue }
      if (!/\.(mjs|js|yml|json|html|css|md)$/.test(name)) continue
      const rel = relative(ROOT, full).replace(/\\/g, '/')
      if (rel === 'lib/sample-summary.js' || SKIP_FILES.has(rel)) continue
      const text = readFileSync(full, 'utf8')
      if (RE.test(text)) bad.push(rel)
    }
  }
  walk(ROOT)
  assert(bad.length === 0, '出现本机绝对路径：' + bad.join(', '))
})

console.log('')
if (failed) {
  console.error(`✗ ${failed} 项失败`)
  process.exit(1)
}
console.log('✓ smoke 全部通过')
