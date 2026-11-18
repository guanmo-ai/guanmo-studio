# 参与贡献

欢迎报告可复现的问题、改进模板与文档。当前只有 `card-carousel` 一个动画模板，优先保证配置替换、预览和导出稳定；新增时长、画幅或动画模板请先说明实际制作需求。

## 本地开发

按 [README](README.md) 安装后执行：

```bash
npm run doctor -- --render --probe
npm run check
npm test
npm run test:smoke -- --video
```

日常改动先执行相关检查。修改背景或卡片配置时构建并查看关键帧；修改动画、渲染器或播放器时另看连续草稿。截图、编码规格和实际审美验收是不同证据，提交说明中分别记录。

跨平台改动须保留 Windows 的 `py -3` 启动器、UTF-8 输出和中文/空格路径支持。调用外部程序使用参数数组，避免依赖 Bash、通配符展开或可执行脚本的 shebang。CI 在 Windows、macOS 和 Linux 上运行相同的核心测试及完整草稿冒烟；具体范围见 [平台说明](docs/platform-support.md)。

- `examples/<名称>/config.json`：内容和视觉参数，不直接修改 `build/`
- `templates/card-carousel/assets/engine/`：动画、材质和文字绘制
- `scripts/`：构建、本地服务、浏览器与导出
- `web/`：背景画廊和卡片样式工作台
- [架构与边界](docs/architecture.md)：调用链、输出与平台范围

## 提交修改

保持改动围绕一个问题，保留既有素材来源。错误修复应包含能暴露该问题的验证；避免只重复实现逻辑的测试。不要提交 `.local/`、虚拟环境、构建物或本地试稿。

新增示例先从 `examples/starter/` 复制。所有数字、能力和安装命令应可追溯；新增素材更新 [许可清单](docs/asset-licenses.json)。MIT 代码许可不覆盖第三方商标、字体或音轨。提交你拥有或有权以对应许可提供的内容，不要求额外签署 CLA。

本项目默认用简体中文讨论，英文报告和贡献也欢迎。不要把用户的样式选择或未认可试作当成可公开发布内容。

## 验证发布包

由维护者确认版本后，从对应 Git 版本导出源码包。例如 `git archive --format=zip --prefix=guanmo-studio/ -o guanmo-studio-source.zip <版本>`。解压到干净目录，确认源码能独立安装和出片。

```bash
npm ci
npm run setup
npm run release:check
npm run check
npm test
npm run test:smoke -- --video
```

更新随包媒体时同步更新许可记录与校验值。更新案例时同步检查视频、封面、配置和模板目录。附上这次实际验证的平台与版本。
