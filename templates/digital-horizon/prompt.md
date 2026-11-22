请用 Guanmo Studio 的「数字地平线」模板，为我的项目制作一支横版发布短片。先显示一句开场文案，再出现产品名或主标题。默认用琥珀色弧光和本地合成配乐。

1. 优先使用当前工作区或我提供的源码包。在仓库根目录确认有 `templates/digital-horizon/SKILL.md` 和 `examples/digital-horizon/config.json`，再读模板说明。只有公开仓库时，先核实对应版本包含这两个文件。缺少模板文件时请告诉我需要哪份源码。 [公开仓库](https://github.com/guanmo-ai/guanmo-studio)
2. 首次使用时，按仓库 README 准备 Node.js 22+、Python 3.10+ 和带 libx264、AAC 编码器及 ffprobe 的 FFmpeg，然后运行 `npm ci` 和 `npm run setup`。Linux 所需的系统依赖见 README。已有可用的独立 Chromium 时，可用 `STUDIO_BROWSER_EXECUTABLE` 指定其完整路径，并用 `npm run setup -- --skip-browser`。出片前运行 `npm run doctor -- --render --probe`，按诊断处理缺项。
3. 用小写字母、数字和短横线取一个未占用的项目名，例如 `my-project`。把示例配置复制到 `examples/my-project/config.json`，保留 `"template": "digital-horizon"`。用项目名填写 `title`，用一句短文案填写 `opening`。我给了文案就用原文。没有指定色调、字符、时长或音轨时，沿用示例默认值。若我提供音轨，把文件放进新项目，用相对于配置文件的路径填写 `audio.path`，例如 `assets/theme.wav`。
4. 在仓库根目录运行以下命令，把示例项目名换成实际项目名。先核对关键帧，再核对连续草稿的开场、换字、主标题和音轨，确认后导出定稿。

   ```bash
   npm run update -- my-project
   npm run update -- my-project --draft
   npm run update -- my-project --final
   ```

5. 核对成片可播放和导出规格，交付 `renders/my-project.mp4`、项目配置和重渲所需的自备素材。默认是 7 秒、1920×1080、60fps，带立体声音轨。
