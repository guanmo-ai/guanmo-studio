# Guanmo Studio

通过一份 JSON 配置复用三维卡片动画，在本地选择样式、检查画面并导出视频。面向创作者，也为 AI 提供明确的配置、构建和验证入口。

[English](README.en.md) · [配置说明](templates/card-carousel/references/config.md) · [参与贡献](CONTRIBUTING.md) · [素材许可](THIRD_PARTY_NOTICES.md)

[![卡片转盘示例](examples/studio-demo/poster.jpg)](examples/studio-demo/video.mp4)

当前有 **1 个动画模板**，Card Carousel（卡片转盘）。随包的 Studio Demo 可以直接播放、改配置和重新导出。

- 15 秒、1920×1080、60fps；快速草稿为 960×540、30fps
- 7—31 张图片或文字卡片，六张精选牌依次展示，一个主角展开
- 30 组可选色卡，支持先预览再加入、随机均分与保存选择
- 背景、卡片材质、内容、配乐和音效独立配置，音效可按镜头时间点在本地合成
- 本地预览、逐帧导出与六段剪辑素材包，无需登录或调用付费模型

项目处于 **0.1 预览阶段**。当前只支持这一种横版编排；竖版、其他时长、时间线编辑和多用户服务尚未实现。代码采用 MIT，随包素材的许可见 [素材清单](docs/asset-licenses.json)。

## 平台支持

| 平台 | 当前状态 | 使用方式 |
| --- | --- | --- |
| **macOS** | **已实测通过**（Apple Silicon）：构建、网页工作台和完整视频导出均通过检查 | 推荐原生安装，按下方「开始使用」操作 |
| **Windows** | **CI 已通过**（Windows Server 2025，软件渲染）：诊断、测试、网页交互和完整草稿导出；真实显卡与控制台 Ctrl+C 待手动验证 | 安装 Node.js、Python 和 FFmpeg 后，在 PowerShell 执行下方安装命令；先通过 `npm run doctor -- --render --probe` 再制作 |
| **Linux** | **CI 已通过**（Ubuntu 24.04 / x86_64，软件渲染）：诊断、测试、网页交互和完整草稿导出 | 批量导出推荐 Docker；原生安装需补齐浏览器系统依赖，使用 `npm run setup -- --with-deps` |

Windows / Linux 导出时遇到显卡或 WebGL 问题，可切换 `STUDIO_GL=software` 使用 CPU 渲染。软件渲染明显更慢（参考：960×540 草稿约 0.6 秒/帧），请先用草稿估算定稿耗时。PowerShell 的环境变量写法、各系统依赖安装和 Docker 命令见 [跨平台说明](docs/platform-support.md)。Docker 入口用于批量导出，网页工作台需原生运行；Windows 宿主上的 Docker 尚未单独实测。

## 开始使用

克隆仓库或解压对应版本的源码包，在项目目录打开终端。需要 Node.js 22+、Python 3.10+ 和 FFmpeg（含 ffprobe）。仅浏览网页时不需要 FFmpeg。macOS、Windows PowerShell 和 Linux 使用相同的项目命令；系统依赖安装方法见 [跨平台安装与验证](docs/platform-support.md)。

```bash
npm ci
npm run setup
npm run doctor -- --render --probe
```

`setup` 创建仓库独立的 Python 环境，安装锁定版本的 Pillow 和匹配的 Chromium，无需手动激活虚拟环境。Linux 首次安装可用 `npm run setup -- --with-deps` 补齐浏览器系统库。只构建、不渲染可用 `--skip-browser`。诊断的 `--probe` 会实际启动浏览器并检查 WebGL2。

也可以使用已安装的 Docker 与 Compose v2，统一在 Linux 容器中制作：

```bash
npm run container -- doctor --render --probe
npm run container -- update starter --draft
```

容器自动构建本地镜像，成片写入宿主机 `renders/`，`examples/` 只读挂载。该入口用于批量导出；网页工作台在本机运行。各平台的实际验证状态见 [支持矩阵](docs/platform-support.md#实际验证)。

已有镜像且只替换示例内容时，可用 `npm run container -- --no-build update starter --draft` 复用镜像，不拉取或重建；更新工具代码后去掉 `--no-build` 重新构建。

从不含外部图片、默认无声的入门配置开始：

```bash
npm run update -- starter           # 构建并生成快速关键帧
npm run preview -- build/starter    # 浏览器交互预览
npm run update -- starter --draft   # 完整 15 秒草稿
npm run update -- starter --final   # 高清 MP4
```

关键帧位于 `renders/starter.proof-checks/`，草稿为 `renders/starter.draft.mp4`，高清成片为 `renders/starter.mp4`。每次修改配置后，先查看关键帧，再查看连续草稿，确认后导出高清。

构建和渲染分别在临时目录或临时 MP4 中完成，成功后才替换旧工程或成片。配置、素材解码、编码或剪辑包失败时保留旧输出；视频、检查报告与剪辑包完成后一起保存。渲染时按 Ctrl+C 会停止浏览器与编码器，并清理本次临时产物；不要把自己的源文件放进生成目录。

## 复刻公开样片

完成上面的安装后，用随仓库提供的 Studio Demo 配置和素材运行：

```bash
npm run update -- studio-demo --draft
npm run update -- studio-demo --final --edit-pack
```

草稿在 `renders/studio-demo.draft.mp4`，高清成片在 `renders/studio-demo.mp4`。剪辑包 `renders/studio-demo-edit/` 包含六段画面、独立配乐和音效，以及可搬移重建的配置和素材。样片的卡面、背景和音轨都在源码中。复刻后可以复制配置到新项目，再替换成自己的内容。 [示例配置](examples/studio-demo/config.json) · [制作提示词](templates/card-carousel/prompt.md)

## 浏览与选择样式

```bash
npm run studio       # 背景画廊与模板示例
npm run card-studio  # 卡片样式工作台
```

打开终端输出的本机地址。背景库支持分类、搜索、预览和原图下载。卡片工作台可用 30 组色卡试配版式、材质和光位。

点色卡只单独预览，点击「加入这款样式」才加入使用列表。多种样式会按卡片数量尽量均分并随机打散，正反面保持同类；切换镜头不重新分配。「保存这套样式」写入本机 `.local/card-style-selection.json`，不会改写正式示例或自动生成视频。详细流程见 [样式工作台](docs/card-studio.md)。


将保存的工作台方案应用到 Studio Demo：

```bash
npm run update -- studio-demo --saved-style
npm run update -- studio-demo --saved-style --draft
npm run update -- studio-demo --saved-style --final
```

结果写入独立的 `studio-demo-selected` 工程与输出，不覆盖正式示例。当前保存方案仅适用于此工作台示例；新项目仍从 Starter 配置开始。保存后继续调整会标为未保存修改；「恢复已保存方案」只恢复浏览器状态，不写入文件。

## 制作自己的视频

复制 `examples/starter/` 到自己的目录，编辑 `config.json`。图片、图标与音轨路径相对于配置文件：

```bash
npm run build -- examples/my-project/config.json --out build/my-project
npm run render -- build/my-project --proof-only
npm run render -- build/my-project --draft --out renders/my-project.draft.mp4
npm run render -- build/my-project --out renders/my-project.mp4 --edit-pack
```

- 背景：`background.preset` 使用背景目录 ID；自备图片用 `background.image`，二者择一
- 卡片：`cards` 设置内容，`theme.cardLook` 独立选择结构与材质；`original` 为原版轻薄卡片
- 音频：把自带 BGM 放进项目的 `assets/`，在配置中填写 `audio.music.path`（如 `assets/my-music.wav`）。启用配乐并省略路径时使用随包的原创合成配乐。详见[音轨配置](templates/card-carousel/references/config.md#音轨audio)。
- 音效：Styled Starter 自带音效。运行 `npm run sfx -- --out examples/my-project/assets/sfx.wav` 生成 WAV，填入 `audio.sfx.path` 即可混入成片。支持 [自定义镜头时间点](docs/sound-effects.md)。
- 编辑：`--edit-pack` 输出六段已合成的无声画面、启用的音轨、时间表与可搬移重建的源配置

剪辑包不是分层合成工程。替换已合成的卡片与文字需要重新渲染，详见 [剪辑说明](docs/editing.md)。

各命令支持 `--help`。常见安装与运行问题见 [故障排查](docs/troubleshooting.md)。

## 让 AI 使用

打开模板详情可以复制[完整制作提示词](templates/card-carousel/prompt.md)。复用当前程序卡面时，从 `examples/styled-starter/config.json` 开始。它保留最新卡背样式，默认使用随包的原创合成配乐和 CC0 音效。有项目原图时用 `cards[].front: "image"` 与 `image` 显示完整卡面。为不同项目使用不同目录，按提示词先核对仓库能力，再生成关键帧、草稿和高清成片。纯文字基础形式仍可使用 `examples/starter/config.json`。

内容替换通常只需修改配置与素材。动画节拍位于 `templates/card-carousel/assets/engine/choreo.js`，段落定义位于 `timeline.json`；修改时间编排时需同步维护。

## 示例与文档

| 示例 | 内容 |
| --- | --- |
| Starter | [基础配置](examples/starter/config.json)，用于修改文案后快速出片 |
| Styled Starter | [程序卡面配置](examples/styled-starter/config.json)，带默认配乐和音效 |
| Studio Demo | [示例成片](examples/studio-demo/video.mp4) · [配置](examples/studio-demo/config.json) · [来源](examples/studio-demo/SOURCE.md) |

创作者案例和随包素材出处见 [素材来源](docs/SOURCES.md)。示例成片规格和 SHA256 见 [案例清单](docs/example-videos.json)。

[架构](docs/architecture.md) · [背景](docs/backgrounds.md) · [配色](docs/looks.md) · [平台实测](docs/platform-support.md)

## 检查与许可

```bash
npm run check                   # JS 语法、JSON、本地文档链接
npm test                        # 配置、构建、服务与边界回归
npm run test:smoke -- --video    # 独立浏览器交互、关键帧、完整无声草稿
npm run release:check           # 检查随包媒体许可、素材校验值与案例清单
```

代码、原创合成配乐和随附程序素材采用 [MIT](LICENSE)。字体与原版音效分别保留 OFL 和 CC0 来源。自备素材随各自许可。 [第三方声明](THIRD_PARTY_NOTICES.md) · [素材清单](docs/asset-licenses.json)
