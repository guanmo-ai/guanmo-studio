# Guanmo Studio 卡片转盘演示

这支演示用 21 张程序卡面介绍 Guanmo Studio 的制作流程。文案、配色、字标和抽象背景为本仓库示例制作。PNG 背景与网页缩略图由仓库脚本按固定参数生成。 [背景生成脚本](../../scripts/generate-demo-backgrounds.py)

演示配置、背景和随附演示媒体采用仓库的 MIT 许可。视频中使用的字体和音效继续遵循各自的许可。配乐使用本仓库原创合成轨，独立音效使用仓库随附的 CC0 音效。 [MIT 许可](../../LICENSE) · [配乐来源](../../templates/card-carousel/assets/audio/MUSIC.md) · [音效来源](../../templates/card-carousel/assets/audio/SFX-LICENSES.txt) · [第三方声明](../../THIRD_PARTY_NOTICES.md)

```bash
npm run update -- studio-demo --final
```

配置引用 `studio-amber` 背景。布局选择和音轨音量保存在同目录的 `config.json`。封面从演示成片取帧。
