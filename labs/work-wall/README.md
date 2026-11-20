# 作品墙 Work Wall（实验片段）

一面由真实作品组成的三维墙：翻牌的波逐拍扫过、一张牌飞到全屏播放、落位时放射波纹、拉远收灯。可以单独当 15 秒短片，也可以拆成宣传片里的一个段落（“规模揭示”）。

第一版用 [design-style](https://github.com/guanmo-ai/design-style) 测试：成片 1920×1080 · 60fps · 15 秒，`smooth.py` 量得 0 跳变 0 死区。结构、字段和配乐提示词见 [TEMPLATE.md](TEMPLATE.md)。

状态：实验，不接入 `npm run update`。主人评价“作为片段可以，作为整支宣传片的重点还差质感”。

## 重建素材（素材不入库）

```bash
cd labs/work-wall
ln -sfn ../../node_modules/three lib/three && cp ../../node_modules/three/build/three.{module,core}.js lib/
mkdir -p fonts && cp ../../assets/fonts/*.otf fonts/
node src/svg2png.cjs <design-style 路径> src/img          # 风格图 SVG → JPEG
(cd src && ./fetch.sh)                                       # 下载各期 Release 成片
../../.venv/bin/python3 src/prep.py .                       # 统一 4:5 牌面
ffmpeg -ss 5.6 -i src/full/025-plush.mp4 -t 3.7 -vf fps=60 -q:v 3 assets/hero/%04d.jpg
node src/config.cjs .                                        # 生成 config.json
DESIGN_STYLE=<design-style 路径> ../../.venv/bin/python3 audio.py music.wav
node render.cjs . out.mp4 --fps 60 --audio music.wav         # 1080p60，云端 CPU 约 50 分钟
```

`render.cjs` 支持 `--q draft`（无景深，快速预览）、`--proof 0,1.5,…`（单帧）、`--frames a-b`（只重渲一段帧，用来补帧）。
