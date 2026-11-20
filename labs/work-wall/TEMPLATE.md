# 作品墙 Work Wall（模板草案）

一面由真实作品组成的墙。镜头在第 0 帧就贴着墙在滑，每一拍有一道翻牌的波扫过，把整面墙换成下一种内容。之后一张牌离开墙面，飞到镜头前铺满全屏，播放它自己的影片。它飞回墙上落位的那一刻，一圈波纹把全墙翻开，镜头随之拉远。最后全墙从中间往外熄灯，字标出现，盖章收尾。

**适合**：有大量视觉产出的项目，例如设计库、模板库、作品集、多 SKU 产品线、AI 生成作品集、字体或图标库。

## 固定的部分（不随内容变）

| 时间 | 段落 | 画面 | 声音 |
|---|---|---|---|
| 0—2 s | 钩子 | 镜头贴墙低角度滑行，一道翻牌波正从镜头边掠过；第 0 帧标题已完整 | 标题砸字 + 一串翻牌 |
| 2—6 s | 四道波 | 每拍一道波从左扫到右，整面墙换成下一类内容；左下角标签逐字升起 | 每道波一记重拍 + 一串左→右的翻牌 |
| 6—7 s | 主角离墙 | 一张牌交叉淡化离开牌位（留下空格），沿弧线飞到镜头前，宽高比从 4:5 变成 16:9 | 抽空鼓，上升音 + 气流 |
| 7—8.75 s | 主角播放 | 铺满全屏播放这张牌的真实影片，景深焦点跟着它 | 7 s 落下：重拍 + 低频 + 镲 |
| 8.75—9.75 s | 主角回墙 | 飞回牌位，落位一刻一圈放射波纹把全墙翻成混排 | 落位“咚” + 闪光 + 放射状翻牌 |
| 9.75—11.4 s | 拉远 | 对数节奏拉远（屏幕上的缩放速度恒定），露出整面墙 | — |
| 10.5—13 s | 收获 | 墙退成散景背景，左侧标题和标签逐个弹出 | 每个标签一声“啵”，音高沿和弦上行 |
| 13—15 s | 片尾 | 全墙从中间往外翻成暗面，字标从圆点里长出来，14 s 盖章 | 收灯翻牌 + 盖章 + 主和弦 |

## 换成另一个项目，要给什么（config.json）

| 字段 | 内容 |
|---|---|
| `stages` | 几组图片（每组一类内容）。每组 ≥ 12 张最好，越多越不重复；统一按 4:5 居中裁切 |
| `waves` | 每道波：时间、换到哪一组、标签和一句说明（标签就是"这一类是什么"） |
| `hero` | 主角牌：牌位、牌面图、一段 16:9 影片帧序列（或产品演示录屏），以及编号和名称 |
| `hook` | 第 0 帧的大标题（两行）、kicker、一句副标题 |
| `payoff` | 一句话 + 4—6 个标签（"你能带走什么"） |
| `end` | 字标（含 `.` 时句点画成强调色圆点）、一句定位、链接、署名、印章 |
| `camera` | 镜头关键帧（一般不用改；换宽高比时再调） |

同一个牌位的墙能装下 338 张牌（26 × 13）。素材少时自动循环，并保证相邻不重复。

## 质量自查（本片已做）

- 第 0 帧：标题完整，墙在动（翻牌波正扫过）。
- `smooth.py`（design-style 自带）：60fps 草稿 0 段死区；修好光位跳变和主角淡入后，只剩 1 处跳变（主角离墙），已改成交叉淡化。
- 数字都有出处：25 期、每期 4 张图、15—20 秒，均来自 design-style 的 README 和 works.json。
- 声音与画面读同一份时间表；每次出字都有声音，音效从属于配乐。

## Sonilo 文本模式提示词（与本片节拍对齐）

> 15-second premium launch-film score, exactly 120 BPM, 4/4, A minor resolving to C major at the end. Must have sound at 0:00 — no intro, no fade-in. 0.0s: a heavy cinematic impact with a short cymbal, then a sparse, tense pulse (soft pad + ticking percussion) for two seconds while tension rises; a short riser ends exactly on 2.0s. 2.0–6.0s: the full band drops in — tight punchy kick on every beat, crisp hats, warm sidechained synth bass, plucky arpeggio — with a strong accent on 2.0, 3.0, 4.0 and 5.0 seconds. 6.0–7.0s: everything pulls out except a rising whoosh and riser (a held breath). 7.0s: a huge drop — sub-bass hit, crash, full groove returns, bigger than before. 8.75–9.75s: brief reverse swell that resolves into a bright shimmering chord at 9.75s. 10–13s: confident, airy groove, slightly lighter. 13.0s: the energy falls away with a filtered sweep. 14.0s: one final heavy stamp-like hit and a sustained C major chord ringing to 15.0s. Modern, elegant, cinematic, no vocals.

翻牌、出字、盖章这类音效跟画面逐帧对齐，由代码合成（`audio.py`）。Sonilo 只负责音乐。拿到曲子后替换 `audio.py` 里的乐队部分，音效保留。
