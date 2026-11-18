# 卡片转盘音效

## 复用 Design Style 原片音效

[模板音效轨](../templates/card-carousel/assets/audio/sfx.wav) 是 Design Style 原片使用的 15 秒独立音效分轨，和原素材 `sfx-stem-v2.wav` 完全一致。Styled Starter 默认启用这条轨，随包的 Studio Demo 也使用这条轨。 [逐项 CC0 来源记录](../templates/card-carousel/assets/audio/SFX-LICENSES.txt)

1. 先出草稿，按实际画面核对扫过、落卡、展开、收牌和落章等声点。动作和声点仍然对应时，可以保留整轨。可用段落时间表定位镜头，用关键帧和波形辅助检查对齐。 [段落时间表](../templates/card-carousel/timeline.json)
2. 部分动作提前、延后或取消时，把仍匹配的声音截出来，保留声尾，移动到新动作的时间点。可用剪辑工具，也可用 FFmpeg 的 `atrim` 截取、`asetpts=PTS-STARTPTS` 重置片段起点、`adelay` 放到目标时间、`amix` 合成。将重排后的 WAV 另存到项目的 `assets/`，更新 `audio.sfx.path`，重出草稿核对。
3. 去掉无法干净拆出或没有对应动作的声音。没有能可靠对齐的声音时，把 `audio.sfx.enabled` 设为 `false`，配乐照常混入。

## 生成新的音效轨

用 Node.js 22 在仓库根目录运行以下命令。生成 WAV 无需额外依赖或账号。

```bash
npm run sfx -- --out examples/my-project/assets/sfx.wav
```

在 `examples/my-project/config.json` 的 `audio` 下添加以下字段，并保留项目自己的 `music` 配置。

```json
"sfx": { "enabled": true, "path": "assets/sfx.wav", "volume": 0.65 }
```

运行 `npm run update -- my-project --draft` 试听混音。满意后用 `npm run update -- my-project --final` 导出，或加 `--edit-pack` 保留单独的音效轨。

## 自定义声音与时间点

把 [模板时间表](../templates/card-carousel/sfx-cues.json) 复制到项目目录，按画面修改。用 `--cues` 指定这个 JSON 文件。输出使用新文件名。

```bash
npm run sfx -- --cues examples/my-project/sfx-cues.json --out examples/my-project/assets/sfx-v2.wav
```

时间表是一个 JSON 数组。以下例子在开场加入扫过声，在片尾加入盖章声。

```json
[
  { "time": 0.14, "sound": "whoosh", "duration": 0.45, "gain": 0.68, "pan": -0.36 },
  { "time": 14.0, "sound": "stamp", "gain": 0.75 }
]
```

| 字段 | 用途 |
| --- | --- |
| `time` | 声音起点，以秒计，从 0 到小于 15 |
| `sound` | `whoosh` 扫过、`card` 落卡、`pop` 弹出、`stamp` 盖章 |
| `duration` | 可选，长度为 0.02–2 秒，留空使用该声音的默认长度 |
| `gain` | 可选，单个声音音量为 0–1，默认 0.6 |
| `pan` | 可选，声像从左 −1 到右 1，默认居中 |

输出为 15 秒、48 kHz、16 位立体声 WAV。相同时间表会生成相同声音。仓库里的 [合成音效轨](../templates/card-carousel/assets/audio/sfx-synth.wav) 用默认时间表生成。该轨和 [生成脚本](../scripts/sfx.mjs) 均采用 [MIT 许可](../LICENSE)。
