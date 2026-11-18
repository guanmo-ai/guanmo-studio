# 故障排查

先运行 `npm run doctor -- --render --probe`，再根据失败项处理。诊断不自动安装软件或访问网络；`--probe` 实际启动独立浏览器并创建 WebGL2 上下文。使用 `npm run --silent doctor -- --render --probe --json` 可以输出不带 npm 提示的 JSON 诊断结果。

| 现象 | 处理 |
| --- | --- |
| 找不到 Python / Pillow | 安装 Python 3.10+ 后运行 `npm run setup`；支持 Windows 的 `py -3`。已有环境可用 `PYTHON` 指定解释器完整路径，不附加命令参数 |
| 指定了 `PYTHON` | `setup` 与构建均使用该解释器；依赖也安装到该环境。若希望由工具自动管理 `.venv`，先清除 `PYTHON` 覆盖再运行安装 |
| 找不到 Chromium | 运行 `npm run setup`；Linux 用 `npm run setup -- --with-deps` 补齐系统库。已有自动化浏览器可通过 `STUDIO_BROWSER_EXECUTABLE` 指定，不使用个人 Chrome 配置 |
| WebGL2 不可用、显卡驱动异常 | 设置 `STUDIO_GL=software` 后重新诊断和导出；PowerShell 写法与 Bash 不同，见平台说明。也可使用容器入口 |
| Chromium 下载中断 | 重新运行 `npm run setup`，已完成的 Pillow 环境会复用；如网络需要代理，可按 Playwright 官方安装说明设置 `HTTPS_PROXY`，不关闭 TLS 证书校验 |
| Windows 安装后仍找不到命令 | 重新打开终端，确认 `python --version` 或 `py -3 --version`、`ffmpeg -version`、`ffprobe -version` 可运行 |
| 找不到 ffmpeg / ffprobe | 安装包含 libx264 与 AAC 编码器的 FFmpeg；自定义路径分别用 `FFMPEG` 与 `FFPROBE` |
| 端口已占用 | Studio 自动分配空闲端口，以终端实际地址为准 |
| 浏览器提示配置或素材错误 | 修正源 `config.json`，图片和音轨路径以该配置目录为基准，然后重新构建 |
| 无法覆盖构建目录 | 使用新目录，或确认它是本工具生成的工程；工具会拒绝覆盖源配置、仓库和普通资料目录 |
| 输出正在保存或有异常退出留下的锁 | 等待现有任务完成，或改用另一输出名。确认相关进程已退出后，可移走同级的空 `.*.studio-lock` 目录。若有 `.backup` 文件，先检查备份内容 |
| 构建清单无效或剪辑包快照残留符号链接 | 从原始配置重新执行 `npm run build`，再导出视频或剪辑包 |
| 画面仍是旧版本 | 修改源配置后重新构建，再从终端地址打开；保存样式不会自动改写示例配置 |
| 本机保存的样式损坏或失效 | 工作台会提示并以默认样式继续预览，保留原文件；确认后重新选择并保存。`--saved-style` 制作仍拒绝使用无效方案 |
| Windows 保存的 JSON 无法读取 | 使用 UTF-8（可带 BOM）保存配置；UTF-16 文件需先由编辑器转换为 UTF-8 |
| 想离线复用已有容器镜像 | 使用 `npm run container -- --no-build update starter --draft`；工具升级后需联网去掉 `--no-build` 重建镜像 |
| 只要无声视频 | 将 `audio.music.enabled` 与 `audio.sfx.enabled` 均设为 `false`；默认保留示例音轨的旧配置仍会使用原音轨 |
| 发布检查失败 | 查看 `docs/asset-licenses.json` 中的待确认项，补充实际授权证据或移除相应素材；不要只改状态 |

渲染会使用 GPU 或软件 WebGL，性能因硬件和素材而异。先运行 `npm run update -- <项目> --draft`，用实际耗时判断完整导出的成本。`*-checks/report.json` 保存运行错误和耗时，`ffprobe.json` 保存媒体规格；无 MP4 的关键帧模式不会执行编码检查。

浏览器冒烟失败时，`renders/open-source-smoke/failure.json` 保存当前错误及浏览器错误，页面仍可截图时另存 `failure.png`。后续成功运行会清除旧失败证据，当前系统与完整检查项见同目录的 `report.json`。

提交问题时提供仓库版本、系统、诊断结果、最小配置和相关日志。请移除私人文件、绝对路径和凭据。历史验证日志仅说明当时的版本与环境。

安装、软件渲染环境变量与容器的具体命令见 [跨平台说明](platform-support.md)。
