# Guanmo Studio

为 AI 和创作者准备的本地视频模板工具。卡片转盘的定稿输出为 15 秒、1920×1080、60fps。

- 制作先读 [模板 Skill](templates/card-carousel/SKILL.md) 和 [制作提示词](templates/card-carousel/prompt.md)。字段查 [配置说明](templates/card-carousel/references/config.md)。
- 从 `examples/styled-starter/` 复制到独立项目目录。保留可追溯的素材来源和实际项目数据，使用项目自身明确可用的素材。
- 构建生成物放在 `build/`，导出放在 `renders/`。依次检查关键帧、连续草稿和定稿。标准流程见 [README](README.md)。
- 新项目沿用 GIF Factory 参考片的暖棕舞台和地面光，关闭浮尘。配乐优先用项目指定的音轨，省略时使用本地默认曲，未配置本地默认曲时沿用随包的合成曲。镜头或动作节拍变化时，核对声点，重排可以对齐的片段，或仅关闭音效。 [配置说明](templates/card-carousel/references/config.md) · [音效说明](docs/sound-effects.md)
- 样式工作台使用 `studio-demo`。点击色卡只预览，明确加入后才进入混排。保存选择独立于示例配置。 [工作台说明](docs/card-studio.md)
- 修改源码后运行 `npm run check` 和相关测试。发布前在实际交付的源码包中运行 `npm run release:check`，核对媒体和成片清单。提交和发布以维护者授权为准。
