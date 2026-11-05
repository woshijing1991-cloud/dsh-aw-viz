// index.js — dsh-aw-viz 的宿主侧（Node）。
//
// 职责很窄：把 ActivityWatch 本机库聚合成「习惯看板」需要的指标，通过
// webServer 暴露两个只读 JSON 路由，另外给模型一个只读工具。
//
// 为什么数据不直接在浏览器里取 AW：AW 的 5600 端口不保证对页面来源放行
// CORS；由宿主侧代理最稳妥，而且「数据都存在电脑上」这条也更容易守住 ——
// 全程只读本地 127.0.0.1，不出网。
//
// 三个硬约束（踩过的）：
//   1. 路由注册要 `ctx.webServer.register({kind:'exact', path, handler})`；
//   2. 工具必须带 `output: { schema, render }`，只写 schema 会被静默拒收；
//   3. 每个注册都要单独 try/catch，一个坏 schema 不该拖垮整个 profile。
import { join } from 'node:path'
import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const LOAD_LOG_DIR = join(DSH_HOME, 'dsh-aw-viz-load-logs')
const LOAD_LOG = join(LOAD_LOG_DIR, 'plugin-loaded.jsonl')

function loadTrace(extra) {
  try {
    // appendFileSync does not create parent directories
    mkdirSync(LOAD_LOG_DIR, { recursive: true })
    appendFileSync(LOAD_LOG, JSON.stringify({
      at: new Date().toISOString(),
      pid: process.pid,
      ...extra,
    }) + '\n')
  } catch { /* 日志写不了不能影响插件 */ }
}

export const name = 'dsh-aw-viz'
export const inject = ['tools']

export function apply(ctx, config) {
  const cfg = config && typeof config === 'object' ? config : {}
  const aw = typeof cfg.activityWatchBase === 'string' ? cfg.activityWatchBase : 'http://127.0.0.1:5600'
  const basePath = typeof cfg.basePath === 'string' ? cfg.basePath : '/dsh-aw-viz'
  const defaultDays = Number.isFinite(cfg.defaultRangeDays) ? cfg.defaultRangeDays : 7

  let stats
  // 统计模块只在真正需要时动态加载（ESM 里没有 require，别写 require()）
  const state = { registeredRoutes: 0, registeredTools: 0, failed: [], stats: null }

  // 统一挂到 root 上取 webServer：apply 早期拿不到服务是老问题，用 root.inject。
  const root = ctx.root ?? ctx

  try {
    root.inject(['webServer'], async (c) => {
      const webServer = c.webServer ?? c.get?.('webServer')
      if (!webServer || typeof webServer.register !== 'function') {
        loadTrace({ stage: 'no-webServer', registeredRoutes: 0 })
        return
      }

      // 统计模块按需动态加载，避免顶层 import 影响 apply 成败
      const mod = await import('./lib/stats.js')
      state.stats = mod

      const routes = [
        {
          kind: 'exact',
          path: `${basePath}/api/summary`,
          handler: async (req, res) => {
            try {
              const url = new URL(req.url || '/', 'http://127.0.0.1')
              const days = clampDays(url.searchParams.get('days'), defaultDays)
              const summary = await mod.buildSummary({ base: aw, days })
              sendJson(res, 200, summary)
            } catch (e) {
              sendJson(res, 500, { ok: false, error: String(e && e.message || e) })
            }
          },
        },
        {
          kind: 'exact',
          path: `${basePath}/api/health`,
          handler: async (req, res) => {
            try {
              const probe = await mod.probe(aw)
              sendJson(res, 200, { ok: true, ...probe })
            } catch (e) {
              sendJson(res, 200, { ok: false, error: String(e && e.message || e) })
            }
          },
        },
      ]

      for (const route of routes) {
        try {
          webServer.register(route)
          state.registeredRoutes++
        } catch (e) {
          state.failed.push({ route: route.path, error: String(e && e.message || e) })
        }
      }
      loadTrace({ stage: 'routes', registeredRoutes: state.registeredRoutes, failed: state.failed })
    })
  } catch (e) {
    state.failed.push({ stage: 'inject-webServer', error: String(e && e.message || e) })
    loadTrace({ stage: 'inject-webServer-failed', error: String(e && e.message || e) })
  }

  // 给模型一个只读工具：可以直接在对话里问「我最近一周的使用习惯」
  try {
    const TEXT_OUTPUT = {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    }
    ctx.tools.register({
      name: 'aw_habit_report',
      description: '读取本机 ActivityWatch 的活动数据，生成使用时长与习惯分析（时间分配、碎片化、专注块、时段分布、电脑与手机对比）。只读，不修改任何数据。',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: '统计最近多少天，默认 7，范围 1-90' },
          format: { type: 'string', enum: ['text', 'json'], description: 'text 为可读摘要，json 为原始指标' },
        },
        required: [],
      },
      output: TEXT_OUTPUT,
      execute: async (args) => {
        const days = clampDays(args && args.days, defaultDays)
        const mod = await import('./lib/stats.js')
        const summary = await mod.buildSummary({ base: aw, days })
        if (args && args.format === 'json') return JSON.stringify(summary, null, 2)
        return mod.renderText(summary)
      },
    })
    state.registeredTools++
  } catch (e) {
    state.failed.push({ stage: 'tool', error: String(e && e.message || e) })
  }

  loadTrace({
    stage: 'apply-done',
    registeredRoutes: state.registeredRoutes,
    registeredTools: state.registeredTools,
    failed: state.failed,
    aw,
  })
}

function clampDays(v, fallback) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(90, Math.max(1, Math.round(n)))
}

function sendJson(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8')
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(body.length),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}
