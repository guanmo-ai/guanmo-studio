# 卡片样式工作台

运行 `npm run card-studio`，打开终端显示的本机地址。工作台以 Studio Demo 的 21 张程序卡片为样本，提供 30 组色卡，支持近看正反面和材质、切换版式、调节主光位置。 [示例配置](../examples/studio-demo/config.json)

1. 点击色卡只查看单款预览。点「加入这款样式」才进入混排列表，旁边的 × 用于移除。
2. 多款样式按卡片数量尽量均分后随机打散。21 张选四种会分成 6、5、5、5 张。正反面按同一款样式处理，切换镜头时分配保持稳定。点「重新随机分配」才换种子。
3. 确认后点「保存这套样式」，写入本机 `.local/card-style-selection.json`。可用「恢复已保存方案」恢复浏览器中的选择。还可导出选择 JSON。

## 把保存的方案用到视频

```bash
npm run update -- studio-demo --saved-style
npm run update -- studio-demo --saved-style --draft
npm run update -- studio-demo --saved-style --final
```

结果写入独立的 `build/studio-demo-selected/` 和 `renders/studio-demo-selected*`。只有显式执行命令才构建或导出。源项目的配置和成片可继续用于对照。没有有效保存记录时，命令会提示先保存。

自建项目使用 `cards[].face` 配置配色、版式、卡背、材质、灯光和可选图标。 [字段说明](../templates/card-carousel/references/config.md)
