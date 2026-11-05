// lib/purpose.js —— 按「功能用途」给每条使用记录归类
//
// 为什么单独一层：ActivityWatch 记录的是"哪个 App 在前台"，不是"你为什么打开它"。
// 用途是推断值，所以每条都带证据强度（high/medium/low）与命中的规则名，
// 不允许出现"看起来像学习就标学习"这种静默猜测。
//
// 六大类（另有"工具/未知"兜底）：
//   学习 / 办公 / 娱乐消遣 / 沟通社交 / 生活事务 / 系统空转
// 用户的三大类映射：娱乐消遣→娱乐、办公→办公、学习→学习，其余单列不硬塞。
//
// 判定优先级：界面级(classname) > 包名(package) > 应用名(app) > 窗口标题(title)
// 顺序敏感：先匹配先赢，所以"微信视频号"必须排在"微信=沟通"之前。

export const PURPOSES = ['学习', '办公', '娱乐消遣', '沟通社交', '生活事务', '系统空转', '工具/未知']

// 三大类映射（用户要求的粗粒度视图）
export const COARSE = {
  '学习': '学习',
  '办公': '办公',
  '娱乐消遣': '娱乐消遣',
  '沟通社交': '沟通社交',
  '生活事务': '生活事务',
  '系统空转': '系统空转',
  '工具/未知': '未判定',
}

// [用途, 证据强度, 规则名, 正则]  正则在拼接后的 haystack 上匹配
const RULES = [
  // ── 系统空转：亮屏但零产出 ──────────────────────────
  ['系统空转', 'high', '桌面', /com\.hihonor\.android\.launcher|com\.hihonor\.edulauncher|com\.hihonor\.hnofficelauncher|com\.android\.launcher3/],
  ['系统空转', 'high', '应用商店/系统服务', /com\.hihonor\.appmarket|com\.hihonor\.id|com\.hihonor\.systemmanager|com\.google\.android\.gms/],

  // ── 娱乐消遣：视频/短视频/信息流/游戏/音乐 ───────────
  ['娱乐消遣', 'high', '微信视频号', /com\.tencent\.mm\.plugin\.finder\./],
  ['娱乐消遣', 'high', 'YouTube', /youtube/],
  ['娱乐消遣', 'high', '短视频', /douyin|抖音|kuaishou|快手|ixigua|西瓜/],
  ['娱乐消遣', 'high', '长视频', /bilibili|哔哩|iqiyi|爱奇艺|youku|优酷|tencentvideo|腾讯视频|mgtv|芒果/],
  ['娱乐消遣', 'high', '信息流', /twitter|(^|[^a-z])x\.(android|com)|weibo|微博|reddit|xiaohongshu|小红书|tieba|贴吧|zhihu|知乎/],
  ['娱乐消遣', 'high', '游戏', /steam|battle\.net|wegame|com\.tencent\.tmgp|mumu|emulator|游戏/],
  ['娱乐消遣', 'high', '音乐/播客', /spotify|netease\.cloudmusic|qqmusic|kugou|kuwo|music|podcast/],

  // ── 学习 ────────────────────────────────────────────
  ['学习', 'high', 'English Study 看视频学英语', /com\.zs\.lite|zerostudy|english-study/],
  ['学习', 'high', '背单词/词典', /anki|欧路|eudic|youdao|有道|词典|dictionary|单词|vocab/],
  ['学习', 'high', '题库/网课', /chaoxing|超星|xuetangx|学堂在线|zhihuishu|知到|mooc|题库|猿题库|作业帮/],
  ['学习', 'high', '学习计时/自律', /番茄todo|forest|timing|专注/],
  ['学习', 'medium', '笔记', /notepad|笔记|onenote|obsidian|typora/],
  ['学习', 'medium', '标题含学习词', /高考|错题|知识库|复习|试卷|真题|练习|教材|单词|词汇|文言|导数|函数|几何|物理|化学|生物|语文|数学|英语/],

  // ── 办公 ────────────────────────────────────────────
  ['办公', 'high', 'DeepSeek', /deepseek/],
  ['办公', 'high', 'AI 助手', /ai\.x\.grok|grok|chatgpt|claude|kimi|copilot|豆包|doubao|通义|qwen/],
  ['办公', 'high', '代码/终端', /code\.exe|visual studio|vscode|devenv|idea|pycharm|webstorm|terminal|powershell|pwsh|cmd\.exe|git|docker/],
  ['办公', 'high', '文档/表格', /winword|excel|powerpnt|wps|acrobat|foxit/],
  ['办公', 'high', '邮件/协作', /gmail|outlook|feishu|飞书|dingtalk|钉钉|slack|notion|企业微信/],

  // ── 沟通社交（放娱乐之后，避免视频号被算进来）─────────
  ['沟通社交', 'high', '微信聊天', /com\.tencent\.mm\.ui\.chatting\./],
  ['沟通社交', 'medium', '微信其他界面', /com\.tencent\.mm\.(ui\.LauncherUI|ui\.conversation\.|plugin\.sns\.)/],
  ['沟通社交', 'high', '即时通讯', /com\.tencent\.mobileqq|telegram|discord|whatsapp|line\.android|短信|mms|dialer|电话/],
  // 微信容器里的内容型界面：它们不是沟通，必须排在下面的微信兜底之前
  ['娱乐消遣', 'medium', '微信公众号/网页', /com\.tencent\.mm\.plugin\.(brandservice|webview)\./],
  ['工具/未知', 'low', '微信小程序(内容不可知)', /com\.tencent\.mm\.plugin\.(appbrand|lite)\./],
  // 兜底：微信里没被上面细分的界面（视频通话、设置页等）。放最后，不抢上面更细的规则。
  ['沟通社交', 'low', '微信(未细分界面)', /com\.tencent\.mm/],

  // ── 生活事务 ────────────────────────────────────────
  ['生活事务', 'high', '购物', /taobao|淘宝|jingdong|京东|pinduoduo|拼多多|xianyu|闲鱼|amazon/],
  ['生活事务', 'high', '系统设置/文件', /com\.android\.settings|设置|filemanager|文件管理|com\.hihonor\.notepad.*settings/],
  ['生活事务', 'medium', '相机/相册', /camera|相机|gallery|相册|photos/],
  ['生活事务', 'medium', '出行/支付', /alipay|支付宝|wechatpay|地图|maps|didi|滴滴|meituan|美团/],
  ['生活事务', 'low', '装包/商店', /packageinstaller|软件包安装|com\.android\.packageinstaller|com\.android\.vending|play\.store|google play 商店/],
  ['生活事务', 'low', '换机/迁移', /kitesim|clonephone|手机克隆/],
  ['生活事务', 'low', '出行/共享', /哈啰|hello\.bike|共享单车|高德|amap/],
  ['系统空转', 'low', '壁纸/画报', /魔法画报|wallpaper|com\.hihonor\.magazine/],

  // ── 工具：能确定是工具，但确定不了用途 ──────────────
  ['工具/未知', 'low', '浏览器(无网址)', /mark\.via|com\.honor\.browser|msedge|chrome|firefox|browser|浏览器/],
  ['工具/未知', 'low', '代理/输入法工具', /clash|metacubex|v2ray|shadowsocks|inputmethod|输入法/],
]

/**
 * 给一条记录定用途。
 * @param {{package?:string, classname?:string, app?:string, title?:string}} rec
 * @returns {{purpose:string, confidence:string, rule:string|null}}
 */
export function classifyPurpose(rec) {
  const pkg = String(rec.package || '')
  // 兼容两种字段名：AW 原始事件叫 classname，导出/预览记录里叫 detail
  const cls = String(rec.classname || rec.detail || '')
  const app = String(rec.app || '')
  const title = String(rec.title || '')
  // 拼接顺序即优先级：classname 在最前，保证"界面级"压过"包名级"
  const hay = [cls, pkg, app, title].join(' \u0001 ').toLowerCase()
  if (!hay.replace(/[\s\u0001]/g, '')) return { purpose: '工具/未知', confidence: 'low', rule: null }

  for (const [purpose, confidence, rule, re] of RULES) {
    if (re.test(hay)) return { purpose, confidence, rule }
  }
  // 电脑窗口：有标题但没命中任何规则 → 仍可尝试用"标题是否像网页"降级判断，这里保持未知
  return { purpose: '工具/未知', confidence: 'low', rule: null }
}

/** 汇总：按用途聚合，并给出证据强度分布与未判定明细 */
export function summarizePurposes(records, days) {
  const byPurpose = new Map()
  const byCoarse = new Map()
  const byConf = { high: 0, medium: 0, low: 0 }
  const unknownApps = new Map()

  for (const r of records) {
    const sec = r.seconds || 0
    if (sec <= 0) continue
    const c = classifyPurpose(r)
    const p = byPurpose.get(c.purpose) || { purpose: c.purpose, seconds: 0, count: 0 }
    p.seconds += sec
    p.count += 1
    byPurpose.set(c.purpose, p)
    const co = COARSE[c.purpose] || '未判定'
    byCoarse.set(co, (byCoarse.get(co) || 0) + sec)
    byConf[c.confidence] = (byConf[c.confidence] || 0) + sec
    if (c.purpose === '工具/未知') {
      const key = String(r.app || r.package || '?')
      unknownApps.set(key, (unknownApps.get(key) || 0) + sec)
    }
  }

  const totalSec = Array.from(byPurpose.values()).reduce((a, b) => a + b.seconds, 0)
  const d = days || 1
  const r1 = (v) => Math.round(v * 10) / 10

  return {
    totalMinutes: r1(totalSec / 60),
    perDayMinutes: r1(totalSec / 60 / d),
    purposes: Array.from(byPurpose.values())
      .map((p) => ({
        purpose: p.purpose,
        minutes: r1(p.seconds / 60),
        perDay: r1(p.seconds / 60 / d),
        share: totalSec ? Math.round((p.seconds / totalSec) * 100) : 0,
        count: p.count,
      }))
      .sort((a, b) => b.minutes - a.minutes),
    coarse: Array.from(byCoarse.entries())
      .map(([name, sec]) => ({ name, minutes: r1(sec / 60), perDay: r1(sec / 60 / d), share: totalSec ? Math.round((sec / totalSec) * 100) : 0 }))
      .sort((a, b) => b.minutes - a.minutes),
    confidence: {
      high: { minutes: r1(byConf.high / 60), share: totalSec ? Math.round((byConf.high / totalSec) * 100) : 0 },
      medium: { minutes: r1(byConf.medium / 60), share: totalSec ? Math.round((byConf.medium / totalSec) * 100) : 0 },
      low: { minutes: r1(byConf.low / 60), share: totalSec ? Math.round((byConf.low / totalSec) * 100) : 0 },
    },
    unknownTop: Array.from(unknownApps.entries())
      .map(([app, sec]) => ({ app, minutes: r1(sec / 60), perDay: r1(sec / 60 / d) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10),
  }
}
