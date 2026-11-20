# 新模板探索：面向推特爆款与商业宣传片

## 共同原则（每个模板都遵守）

1. **第 0 帧就能看懂**：首帧不淡入、不黑场。X 的信息流自动播放、默认静音，缩略图常取首帧。
2. **静音也能看懂**：核心信息用大字和画面表达，配乐用来加分，不靠配乐传达信息。
3. **前 2 秒每拍都要有变化**：按拍子硬切、反色、砸字，不给观众划走的空档。
4. **首尾无缝循环**：最后一拍切回第一帧。X 会自动循环播放，观众容易多看一遍。
5. **一份配置出多种画幅**：16:9 适合桌面端和 YouTube，1:1 在 X 移动端信息流里占的面积更大。
6. **用 DOM/2D 渲染**：同样 15 秒，2D 原型渲染只要 30 秒左右，卡片转盘用 CPU 渲染 WebGL 需要几分钟。

## 模板候选

| # | 模板 | 开头钩子（0–1 秒） | 适合 | 状态 |
|---|---|---|---|---|
| 002 | **Beat Slam 节拍快闪** | 一个问题砸满全屏，每拍换一句并反色 | 产品发布、AI 工具、开源项目 | ✅ 已有可运行原型 |
| 003 | **Before / After 擦除对比** | 首帧先给"之前"（粗糙、混乱），0.5 秒处一刀擦出"之后" | AI 修图/设计、SaaS 改版、效率工具 | 构思 |
| 004 | **Screen Zoom 界面巡游** | 首帧直接放大到最终结果，再拉远交代过程；光标点击触发放大 | SaaS、App、开发者工具演示 | 构思 |
| 005 | **Wall → One 卡墙聚焦** | 首帧铺满 40+ 张作品缩略图并快速滚动，再选中一张放大到全屏 | 作品集、模板库、电商多款商品 | 构思 |
| 006 | **Stat Slam 数字冲击** | 首帧一个大数字从 0 开始计数（星标、用户、营收） | 里程碑、融资、增长公告 | 构思（Beat Slam 的数字段可单独拆出来） |
| 007 | **Terminal → Result 命令即成片** | 首帧一行命令正在逐字打出，回车后结果直接炸开铺满全屏 | 开发者工具、CLI、AI Agent | 构思 |

## 002 Beat Slam 原型（已完成）

120 BPM，一拍 0.5 秒，全片 30 拍：

| 时间 | 段落 | 内容 |
|---|---|---|
| 0–2 s | 钩子 | 4 句大字，每拍一句，深色/奶油色/陶土色轮换反色 |
| 2–6 s | 蒙太奇 | 6 个画面，前两张各 2 拍，后四张各 1 拍，逐渐加速 |
| 6–9 s | 主角 | 一张截图在固定取景框内推近，3 个标注依拍弹出 |
| 9–12 s | 数字 | 4 个数字块逐拍砸入并计数，最后一行总结 |
| 12–14 s | 行动号召 | 名称、一句话、链接、署名印章 |
| 14–15 s | 循环 | 切回首句，与第 0 帧画面一致 |

内容全部来自配置里的 `hook / shots / hero / stats / cta`，画幅通过 `?w=&h=` 切换。

## 配乐提示词（Sonilo · 文本模式）

时长统一 15 秒。剪辑的节拍按 120 BPM 写死，生成的曲子务必也是 120 BPM，而且从 0 秒就有声音。

**002 Beat Slam**
> 15-second hype product-launch track, 120 BPM, 4/4. Starts instantly at 0:00 with a punchy kick + clap hit on every beat, no intro or fade-in. 0–2s: hard staccato stabs on each beat (four hits). 2–6s: driving electronic groove, tight drums, plucky synth bass, rising energy. 6–9s: brief half-time breakdown with a filtered riser. 9–12s: full drop, big sidechained synth chords, accented hits every beat. 12–14s: confident resolving chord progression. 14–15s: short reverse cymbal swell that loops cleanly back to the start. Modern, premium, minimal, no vocals.

**003 Before / After**
> 15-second minimalist tech track, 120 BPM. 0–0.5s: muted, lo-fi, slightly detuned texture (the "before"). At exactly 0.5s a bright whoosh + impact opens into a clean, wide, polished electronic beat (the "after"). Steady four-on-the-floor with crisp hats, airy pads, a satisfying "reveal" hit every 2 seconds. Ends on a clean sustained chord at 15s. No vocals.

**004 Screen Zoom**
> 15-second calm but upbeat SaaS demo music, 120 BPM. Soft plucks and marimba-like synth, light shaker, warm bass. Small sparkle accents every 1 second for UI clicks. Gentle lift at 6s, fuller arrangement 9–13s, soft resolve and button-click-style ending at 14–15s. Clean, friendly, Apple-keynote style, no vocals.

**005 Wall → One**
> 15-second fast-scrolling energetic track, 120 BPM. Opens at 0:00 with rapid 16th-note arpeggios and ticking percussion (sense of speed). At 3s a sudden stop/tape-stop into silence for half a beat, then a big cinematic impact as one item fills the screen. 4–12s: confident groove with bright lead. 12–15s: tidy outro hit. No vocals.

**007 Terminal → Result**
> 15-second dark minimal techno-ish track, 120 BPM. 0–1.5s: only soft mechanical keyboard-like ticks and a low hum. At 1.5s ("enter"), a huge sub-bass drop and bright synth burst. 2–12s: driving minimal techno with glitchy accents. 12–15s: filtered outro that can loop. Futuristic, hacker aesthetic, no vocals.
