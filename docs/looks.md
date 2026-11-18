# 舞台配色与卡片材质

默认舞台是 `warm`，卡片使用 `original` 轻薄结构。可用 `theme.look` 选择整套搭配，也可独立设置 `theme.stage` 或 `theme.cardLook`。背景图片、程序卡面和卡背材质均有各自的配置。 [配置说明](../templates/card-carousel/references/config.md)

- 整套风格包括暖光玻璃 `glass`、石墨银 `graphite`、深靛蓝 `midnight`、烟铜色 `copper`。 [风格定义](../templates/card-carousel/looks.json)
- 非 `original` 的卡片结构可用单卡 `cards[].backStyle` 设置独立卡背。 [卡背定义](../templates/card-carousel/card-styles.json)
- 样式工作台可以对照 30 组程序卡面。 [工作台操作](card-studio.md)
