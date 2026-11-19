# Card Carousel 配乐

仓库内的 `music.wav` 是为这个模板编写的原创合成配乐，15 秒、120 BPM、48 kHz、双声道。振荡器合成所有声音，没有外部录音、采样或素材包。

配乐及其生成脚本采用与项目一致的 [MIT 许可](../../../../LICENSE)。可随模板出片和分发，复用时保留该许可与来源。运行 `python3 templates/card-carousel/scripts/generate_music.py` 可重建 WAV。

本地构建时，项目通过 `audio.music.path` 指定配乐。省略该字段时使用 `.local/card-carousel/default-music.wav`，没有设置本地默认曲时使用随包的 `music.wav`。配乐与 CC0 动作音效在源配置和剪辑包中各有独立音轨。
