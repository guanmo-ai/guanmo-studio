---
name: digital-horizon
description: 用弧光、汇入地平线的字符和两段文字制作短版发布片。支持替换色调、字符与音轨并在本地导出。
---

# 数字地平线

默认 7 秒、1920×1080、60fps。开场文案淡入后停留，约 1.82 秒开始淡出，约 2.18 秒开始显出主标题。光弧和字符在换字时持续运动。默认使用本地合成的立体声氛围配乐。

## 新建项目

从仓库根目录复制 [示例配置](../../examples/digital-horizon/config.json)，将品牌、文字和音轨替换为自己的内容。

```bash
mkdir -p examples/my-horizon
cp examples/digital-horizon/config.json examples/my-horizon/config.json
npm run update -- my-horizon
npm run preview -- build/my-horizon
npm run update -- my-horizon --draft
npm run update -- my-horizon --final
```

预览页可以播放、暂停和拖动时间轴。关键帧保存到 `renders/my-horizon.proof-checks/`，草稿为 `renders/my-horizon.draft.mp4`，高清成片为 `renders/my-horizon.mp4`。定稿时可以加 `--edit-pack` 导出三段无声视频和音轨。

## 配置

| 字段 | 用法 |
| --- | --- |
| `template` | 固定为 `digital-horizon` |
| `opening` | 开场文案，留空可省略。支持中英文，最多 80 字符 |
| `title` | 主标题，支持中英文，最多 80 字符。两段文字各占一行，长行自动缩放 |
| `color` | 默认 `#ffa466`，使用参考片的琥珀色弧光、亮心与暗部。可填其他 `#RRGGBB` 色值为弧光和字符换色 |
| `duration` | 4–20 秒的整数。换字时机随时长同比伸缩，字符运动保持原速度 |
| `particles.count` | 0–1000，默认 520。设为 0 隐藏字符 |
| `particles.seed` | 0–4294967295 的整数，改动后重新分布字符 |
| `particles.glyphs` | 字符数组，如 `["{ }", "[ ]", "01", "+"]`。最多 48 项，每项 1–4 字符 |
| `audio.path` | 相对于配置文件的本地音轨路径，省略时本地合成。支持 WAV、MP3、M4A、AAC、OGG、FLAC |
| `audio.enabled` / `audio.volume` | 设为 `false` 导出无声视频。音量为 0–1，默认 0.85 |

查验开场、换字间隙、主标题和最后一帧，确认文字大小和音轨音量。导出可指定 `--out renders/my-horizon.mp4`。
