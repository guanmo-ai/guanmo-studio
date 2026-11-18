# 架构与边界

Guanmo Studio 使用本地 Node.js 工具链与固定动画模板。没有服务端数据库、远程账号或模型调用。

```mermaid
flowchart LR
  C[JSON 配置与原素材] --> P[Python 校验与图片处理]
  P --> B[临时构建目录]
  E[Three.js 动画引擎] --> B
  B --> J[esbuild 独立播放器]
  J --> O[替换已完成工程]
  O --> W[本机 HTTP 与独立 Chromium]
  W --> K[关键帧与报告]
  W --> F[FFmpeg 临时 MP4]
  F --> V[ffprobe 规格检查]
  V --> X[临时剪辑素材包]
  V --> R[本次检查报告]
  X --> M[统一保存产物，失败恢复旧版]
  R --> M
```

## 主要模块

- `scripts/build.mjs`：调用 Python 生成器，复制字体、打包播放器、保存相对路径源快照。失败时清理本次临时工程，保留旧工程。只允许替换已识别的生成目录。
- `templates/card-carousel/scripts/build_film.py`：配置类型、数量、选择和素材检查，图片处理，输出 `film.json` 和引擎源码。核心编排按时间计算，不依赖 GSAP。
- `scripts/render.mjs`：独立 Chromium 确定性 seek 与截图，FFmpeg 编码与混音，核对帧数、尺寸和时长，再替换目标 MP4。
- `scripts/server.mjs`：仅监听本机，流式传输文件，支持 HEAD 与单字节范围；拒绝隐藏文件、依赖目录、目录外符号链接及跨站请求。选择 API 校验 JSON 后用临时文件替换保存。
- `scripts/card-studio.mjs` 与 `web/card-studio/`：从 Studio Demo 的程序卡片生成样式预览。保存选择与制作视频分开。
- `scripts/edit-pack.mjs`：按帧切成六段，导出启用音轨与可搬移配置。输出是已合成素材，不是剪辑软件原生工程。
- `scripts/environment.mjs`、`scripts/setup.mjs`：统一解析 Python / Windows 启动器，保持 UTF-8，管理仓库独立环境与匹配的 Chromium；`scripts/browser.mjs` 集中处理 Metal、自动与软件 WebGL。
- `scripts/container.mjs`、`compose.yaml`：在非 root 的 Linux 容器中执行同一套命令；示例只读挂载，成片写入宿主目录。

## 数据与输出

源配置和素材放 `examples/`，公用字体、背景放 `assets/`。`build/`、`renders/`、`.local/` 均为本地目录；审阅试稿不进入公开集合。

Studio Demo 使用随包配置和素材构建，成片校验值记录在 [案例清单](example-videos.json)。

## 支持范围

当前固定为 15 秒横版。核心工具要求 Node.js 22+、Python 3.10+；高清 60fps 与草稿30fps分别检查。原生安装、软件渲染、Linux 容器与三系统 CI 的范围和实际结果统一记录在 [平台说明](platform-support.md)。Windows 原生 CI 尚未执行，不能将路径回归或 Linux 容器运行结果等同于 Windows 验收。

该服务用于本机制作，不支持公网部署、多用户隔离或接收不受信任的配置。完整视频的视觉与听感仍需人工验收，技术报告不代替艺术判断。
