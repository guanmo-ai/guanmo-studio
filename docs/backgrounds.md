# 舞台背景

打开 `npm run studio` 输出的本机地址，可浏览、预览和下载随包的原创程序背景。背景可以用于同一个卡片转盘模板。 [背景目录](../assets/backgrounds/catalog.json)

在源配置填写 `"background": { "preset": "studio-amber" }` 应用内置背景，或填写 `"background": { "image": "assets/your-image.jpg" }` 使用自己的图片。两种字段只能选一种。背景图片保持宽高比并按画面铺满，需检查边缘是否裁掉重要内容。抽象舞台可直接使用 `theme.stage`。 [配置说明](../templates/card-carousel/references/config.md)

使用自备图片时在项目的 `SOURCE.md` 中保留作者、出处和用途许可。 [项目许可](../LICENSE) · [随包素材清单](asset-licenses.json)
