# 第三方与素材许可

项目自有代码与原创素材采用 [MIT](LICENSE)。随附第三方字体、依赖和 CC0 音效保留各自的许可及来源。

| 类别 | 许可或状态 | 保留位置 |
| --- | --- | --- |
| Three.js、esbuild | MIT | 安装包内的 LICENSE；打包器保留依赖法律声明 |
| Playwright | Apache-2.0 | 安装包内的 LICENSE 与 NOTICE |
| Pillow | HPND（含其第三方组件声明） | Python 安装包内的许可文件 |
| 渲染字体 | SIL OFL 1.1 | `assets/fonts/licenses/` |
| 网页字体 | SIL OFL 1.1 | `web/fonts/geist-OFL.txt`、`geist-mono-OFL.txt` |
| 原版卡片音效分轨 | CC0 1.0 | `templates/card-carousel/assets/audio/SFX-LICENSES.txt` |
| 程序合成音效与生成脚本 | MIT | [音效生成](docs/sound-effects.md) |
| 默认原创合成配乐 | MIT | [配乐来源](templates/card-carousel/assets/audio/MUSIC.md) |
| 原创程序背景与 Studio Demo | MIT，随附音效及字体各有许可 | [素材清单](docs/asset-licenses.json) |

GSAP 已从独立播放器及直接依赖中移除；当前动画使用 Three.js 和按时间计算的自有编排。

仓库不附带 FFmpeg 与 Chromium 二进制。原生安装由用户的系统包管理器与 Playwright 下载，Dockerfile 会在用户本机构建的镜像中安装它们；它们及其编解码组件适用各自许可证。Debian 安装包的版权说明保留在镜像 `/usr/share/doc/`，Python 和 npm 组件的许可随各自安装包保留。容器构建会纳入本包素材及系统组件，其许可证据随各自组件保留。

`npm run release:check` 检查公开目录中的媒体是否有许可记录，并在存在待确认项时返回非零状态。检查还会核对已列出的校验值和案例清单。新增媒体时应填写来源、许可与证据，由维护者核对实际权利范围。
