# 跨平台安装与验证

项目采用两条路径：原生环境提供网页工作台与本地导出；Docker 提供依赖一致的批量导出。两者使用相同的配置、构建和渲染代码。

## 按系统选择

- **macOS：推荐原生安装。** Apple Silicon 已通过构建、网页交互和完整导出检查，按下方 macOS 安装步骤使用。
- **Windows：CI 已通过完整流程（软件渲染）。** 在 PowerShell 中安装项目并先运行诊断；图形诊断失败时按下方说明设置 `STUDIO_GL=software`。真实显卡与控制台 Ctrl+C 仍待手动验证。已有 Docker 时也可尝试 Linux 容器批量导出，但 Windows 宿主上的 Docker 尚未单独验收。
- **Linux：批量导出推荐 Docker。** Ubuntu 24.04 / x86_64 在 CI 上通过完整检查（软件渲染）。需要网页工作台时使用原生安装，补齐浏览器系统库，并先通过 WebGL2 诊断；其他发行版、ARM64 和真实显卡驱动组合仍待实测。

具体环境与已知问题见本页「实际验证」。

## 原生安装

安装 Node.js 22+、Python 3.10+、FFmpeg（同时提供 `ffprobe`，含 libx264 与 AAC 编码器）。Windows 目标为 Windows 11 / Windows Server 2019 及以上；macOS 目标为 14 及以上；Linux 以 Debian 12/13 与 Ubuntu 22.04/24.04/26.04 为目标。这些是当前 [Playwright 系统要求](https://playwright.dev/docs/intro)，不表示本仓库已逐一实测所有版本和架构。其他发行版优先使用容器。

### macOS

已有 Homebrew 时先安装系统依赖，再执行下方共用的项目安装命令：

```bash
brew install node python ffmpeg
```

### Windows（PowerShell）

先安装 Node.js 22+ 和 Python 3.10+，并确保命令可在终端运行。已有这两项后安装 FFmpeg：

```powershell
winget install --id Gyan.FFmpeg --exact
# 安装后重新打开终端，确认 Python 和 FFmpeg 位于 PATH
py -3 --version
ffmpeg -version
ffprobe -version
```

然后执行下方共用的项目安装命令。若诊断中的 WebGL2 检查失败，使用本页的软件渲染步骤重新诊断。

### Linux（原生）

Debian / Ubuntu，已有 Node.js 22+ 时：

```bash
sudo apt-get update
sudo apt-get install python3-venv ffmpeg
```

### 安装项目依赖

在仓库目录内，各系统执行相同命令：

```bash
npm ci
npm run setup
npm run doctor -- --render --probe
npm run update -- starter --draft
```

Linux 首次安装将第二步改为 `npm run setup -- --with-deps`，允许 Playwright 安装系统浏览器依赖，可能需要系统管理员权限。`setup` 创建或复用 `.venv`，安装锁定的 Pillow 与当前 Playwright 匹配的 Chromium，不要求激活虚拟环境。只需要构建时使用 `npm run setup -- --skip-browser`。安装没有完成时可以重试，不会自动删除已有环境。

解释器选择顺序为显式 `PYTHON`、仓库 `.venv`、系统 Python；Windows 系统候选包含 `python`、`py -3`、`python3`。显式环境损坏时直接报告错误，避免静默切换到另一套依赖。`PYTHON`、`FFMPEG`、`FFPROBE`、`STUDIO_BROWSER_EXECUTABLE` 接受完整可执行文件路径，不把参数或引号写进变量值。

设置 `PYTHON` 时，`setup` 也会将 Pillow 安装到该解释器对应的环境，安装与构建沿用同一环境；建议指定自己的虚拟环境。未设置时仍自动管理仓库 `.venv`。配置文件使用 UTF-8，支持 Windows 编辑器保存的 UTF-8 BOM；构建不会改写原文件。

## 无显卡或驱动不兼容

默认 `STUDIO_GL=auto`，macOS 使用 Metal。软件渲染不需要独立显卡，速度取决于 CPU；参考值为 960×540 草稿约 0.6 秒/帧（450 帧约 7—8 分钟），1080p / 60fps 定稿会成倍增加。先生成草稿判断实际耗时。

macOS / Linux：

```bash
STUDIO_GL=software npm run doctor -- --render --probe
STUDIO_GL=software npm run update -- starter --draft
```

Windows PowerShell：

```powershell
$env:STUDIO_GL = 'software'
npm run doctor -- --render --probe
npm run update -- starter --draft
Remove-Item Env:STUDIO_GL
```

浏览器只使用独立自动化会话。可指定已有自动化浏览器路径，但偏离锁定浏览器版本后应重新运行诊断和冒烟；不复用个人浏览器资料。

## 容器批量制作

需要可运行 Linux 容器的 Docker 和 Compose v2，以及 Node.js 22+ 用于命令入口。面向 x86_64 与 ARM64；当前本地实测为 ARM64。无需宿主机安装 Python、FFmpeg 或 Chromium，也无需先安装 npm 依赖。

```bash
npm run container -- doctor --render --probe
npm run container -- update starter --draft
npm run container -- test
```

首次会根据 Dockerfile 构建本地镜像，安装 Python、FFmpeg、匹配的 Chromium 和浏览器系统库；后续复用构建缓存。容器默认软件 WebGL，不需要 GPU 透传。基础镜像固定到 digest，项目 npm/Pillow 版本锁定；Debian 系统包仍随仓库更新，不能承诺字节级可复现镜像。

已构建镜像后，替换示例内容或离线制作时可使用 `npm run container -- --no-build update starter --draft`。该模式检查本地镜像是否存在，不拉取或重建镜像；镜像缺失时给出构建提示。它会继续读取宿主机最新的 `examples/`，但引擎、脚本和公共素材来自已有镜像，更新这些内容后应去掉 `--no-build` 重新构建。

只读挂载 `examples/`，可写挂载 `renders/`，构建中间文件留在容器内，容器结束即删除。图片与音轨应放在自己的示例目录，用相对路径引用。宿主机任意绝对路径及容器内 `build/` 无法跨次命令访问；因此优先用 `update` 一次完成构建与导出。输出保存在宿主机 `renders/`。macOS/Linux 沿用当前用户 UID/GID，避免生成 root 所有的文件。

容器不开放端口，网页工作台使用原生入口。镜像仅在本机构建，不推送到镜像仓库；媒体与镜像的分发仍受 [第三方声明](../THIRD_PARTY_NOTICES.md) 约束。

## 实际验证

CI 配置包含 Ubuntu 24.04 / Node 22 / Python 3.10、macOS 15 / Node 24 / Python 3.13、Windows Server 2025 / Node 22 / Python 3.12。每个系统安装环境后执行 WebGL2 诊断、静态检查、全部核心测试、三个示例构建、网页交互与完整 15 秒草稿导出，并上传检查截图和视频。

Windows 额外覆盖 `py -3`、UTF-8、中文与空格目录、大小写盘符、跨盘输出、目录 junction 和 PowerShell 路径引用。编码器失败与 API 取消测试在三个系统运行。POSIX SIGINT 测试只在 macOS/Linux 运行，Windows 控制台 Ctrl+C 仍需原生手动验证。

## 实际验证范围

| 平台 | 当前验证边界 |
| --- | --- |
| macOS / Apple Silicon | 本机覆盖原生 WebGL2、网页交互和高清视频导出；CI（macOS 15）通过完整草稿流程。初次下载 Chromium 需要访问 Playwright 官方 CDN。 |
| Ubuntu 24.04 / x86_64 | CI 通过软件 WebGL2、核心测试、网页交互和完整草稿导出。ARM64、其他发行版和真实显卡驱动待实测。 |
| Windows Server 2025 | CI 通过 PowerShell 安装、路径回归、软件 WebGL2、网页交互和完整草稿导出。真实显卡与控制台 Ctrl+C 待手动验证。 |

在自己的环境先运行 `npm run doctor -- --render --probe`，再构建并导出 Starter 草稿。打包与测试入口见 [README](../README.md)。Chromium 下载中断时，可重试安装，或使用 `STUDIO_BROWSER_EXECUTABLE` 指向已安装的同版本独立 Chromium。 [故障排查](troubleshooting.md)
