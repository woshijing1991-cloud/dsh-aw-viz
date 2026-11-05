// tools/build-client.mjs —— 把 lib/page.css 注入模板，产出 lib/client.js
//
// 为什么要有这一步：桌面端的客户端插件拿不到 <link>（宿主不给我们加静态路由），
// CSS 只能内联进 JS。但内联两份 CSS 一定会漂移，所以让 page.css 当唯一真相：
// 本地预览页直接读它，线上页面由这里注入进去。
//
// 用法：node tools/build-client.mjs [--check]
//   --check 只比较，不写盘；不一致 exit 1（适合放进自检流程）
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const cssPath = join(root, 'lib', 'page.css')
const tplPath = join(root, 'lib', 'client.template.js')
const outPath = join(root, 'lib', 'client.js')

const MARK = '__AW_CSS_LITERAL__'

const css = readFileSync(cssPath, 'utf8')
const tpl = readFileSync(tplPath, 'utf8')

// 占位符必须恰好出现一次，且只能在代码里。出现过多次 = 注释里也写了，
// 那样 replace 会打错位置（这个坑踩过一次）。
const hits = tpl.split(MARK).length - 1
if (hits !== 1) {
  console.error('占位符出现 ' + hits + ' 次，必须恰好 1 次：检查模板注释里是否也写了它')
  process.exit(2)
}

// JSON.stringify 生成合法 JS 字符串字面量（引号、换行、反斜杠都安全）。
// 用函数式替换，避免 CSS 里的 $ 被 String.replace 当成替换模式。
const built = tpl.replace(MARK, () => JSON.stringify(css))

if (built.includes(MARK)) {
  console.error('替换后仍残留占位符，拒绝写盘')
  process.exit(2)
}
if (!built.includes('var CSS = ')) {
  console.error('产物里找不到 CSS 变量声明，模板结构可能被改坏')
  process.exit(2)
}

const checkOnly = process.argv.includes('--check')
if (checkOnly) {
  let current = ''
  try { current = readFileSync(outPath, 'utf8') } catch { current = '' }
  if (current === built) {
    console.log('client.js 与 page.css 一致')
    process.exit(0)
  }
  console.error('client.js 与 page.css 不一致，请运行 node tools/build-client.mjs')
  process.exit(1)
}

writeFileSync(outPath, built, 'utf8')
console.log('已生成 lib/client.js（CSS ' + css.length + ' 字符，产物 ' + built.length + ' 字符）')
