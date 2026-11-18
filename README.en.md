# Guanmo Studio

Configurable 3D card videos, a local style workbench, and frame-by-frame rendering for creators and AI agents.

[中文文档](README.md) · [Contributing](CONTRIBUTING.md) · [Licenses and assets](THIRD_PARTY_NOTICES.md)

[![Card Carousel](examples/studio-demo/poster.jpg)](examples/studio-demo/video.mp4)

**Preview release, v0.1.** One animation template, Card Carousel: 15 seconds, 1920×1080 at 60fps, with 7–31 image or text cards. Six featured cards lead into one expanded hero. Drafts render at 960×540 and 30fps. Backgrounds and palettes are options within the same template.

## Platform support

| Platform | Current status | Recommended approach |
| --- | --- | --- |
| **macOS** | **Verified on Apple Silicon**: builds, web workbench, and complete video exports | Follow the native quick start below |
| **Windows** | **CI passing** (Windows Server 2025, software rendering): doctor, tests, browser interaction, and full draft export; real GPUs and console Ctrl+C still need manual testing | Install Node.js, Python, and FFmpeg, then run the setup commands in PowerShell; pass the rendering doctor probe before creating videos |
| **Linux** | **CI passing** (Ubuntu 24.04 / x86_64, software rendering): doctor, tests, browser interaction, and full draft export | Prefer Docker for batch exports; native installation requires browser system libraries via `npm run setup -- --with-deps` |

For GPU or WebGL problems during exports on Windows/Linux, use `STUDIO_GL=software` for CPU rendering. Software rendering is much slower (roughly 0.6 s per frame for a 960×540 draft), so time a draft before a final export. See the [platform guide](docs/platform-support.md) for PowerShell syntax, system dependencies, and Docker commands. The container provides batch exports; use a native installation for the web workbench. Docker on a Windows host has not been separately tested.

## Quick start

Clone the repository or extract the source archive for this version, then open a terminal in the project directory. Requirements: Node.js 22+, Python 3.10+, and FFmpeg including ffprobe. `npm run setup` downloads the matching Chromium. No account or paid model is required.

```bash
npm ci
npm run setup
npm run doctor -- --render --probe
npm run update -- starter
npm run preview -- build/starter
npm run update -- starter --draft
npm run update -- starter --final
```

The same commands work in PowerShell and POSIX shells. Setup creates a local Python environment and installs pinned Pillow and matching Chromium; activation is unnecessary. On Linux, `npm run setup -- --with-deps` also installs browser system libraries. Python and FFmpeg remain system prerequisites. See the [platform guide and actual verification status](docs/platform-support.md).

For batch rendering with Docker and Compose v2:

```bash
npm run container -- doctor --render --probe
npm run container -- update starter --draft
```

The image builds locally. Examples mount read-only and output goes to the host's `renders/` directory. Use the native installation for the web workbench. Container rendering uses software WebGL and requires no GPU passthrough.

For an existing image and content-only changes, `npm run container -- --no-build update starter --draft` reuses the image without pulling or rebuilding. Omit `--no-build` after updating tool code to rebuild the image.

The starter uses placeholder text without third-party images and disables both audio tracks. Copy `examples/starter/` into your own example directory and edit `config.json`. Asset paths are relative to that file.

The Styled Starter uses the bundled original soundtrack and CC0 sound effects. To use your own BGM, place the file in your project's `assets/` directory and set `audio.music.path`, for example `assets/my-music.wav`. See the [audio settings](templates/card-carousel/references/config.md#音轨audio).

To create a custom effects track, run `npm run sfx -- --out examples/my-project/assets/sfx.wav` to synthesize a 15-second effects track, then set `audio.sfx.path` to `assets/sfx.wav`. Use `--cues` to provide your own timings and sound choices. See the [sound effects guide](docs/sound-effects.md).

```bash
npm run build -- examples/my-project/config.json --out build/my-project
npm run render -- build/my-project --proof-only
npm run render -- build/my-project --out renders/my-project.mp4 --edit-pack
```

Inspect proof images and a continuous draft before final rendering. The editing pack contains flattened video segments, enabled audio tracks, a timeline, and portable source configuration; changing composited text requires rebuilding.

## Reproduce the showcase

After setup, run these commands with the bundled Studio Demo configuration and assets.

```bash
npm run update -- studio-demo --draft
npm run update -- studio-demo --final --edit-pack
```

The draft and final video are `renders/studio-demo.draft.mp4` and `renders/studio-demo.mp4`. The editing pack in `renders/studio-demo-edit/` includes six video segments, separate music and effects tracks, and portable source files. Copy the configuration to a new project to adapt the template to your own content. [Demo configuration](examples/studio-demo/config.json) · [AI production prompt](templates/card-carousel/prompt.md)

## Style workbench

`npm run studio` opens the background gallery. `npm run card-studio` opens the 30-palette card workbench. Clicking a palette previews it; adding it is a separate action. Multiple palettes are distributed evenly with a saved random seed. Saving writes a local selection file without changing official examples or rendering a video. Run `npm run update -- studio-demo --saved-style` to build proof frames with that selection; add `--draft` or `--final` for video output. This uses a separate project directory. The workbench can restore the saved selection without writing the file, and reports edits made while a save is in progress as unsaved changes.

The current template supports landscape output with a fixed sequence. Portrait video, other durations, a timeline editor, and multi-user hosting are not implemented.

## Showcase

| Example | Video | Configuration and sources |
| --- | --- | --- |
| Studio Demo | [Example film](examples/studio-demo/video.mp4) | [Configuration](examples/studio-demo/config.json) · [Sources](examples/studio-demo/SOURCE.md) |

## Verification and licensing

```bash
npm run check
npm test
npm run test:smoke -- --video
npm run release:check
```

The project code, original soundtrack, and original example artwork use the [MIT License](LICENSE). Third-party fonts and sound effects retain their separate OFL and CC0 terms. See [third-party notices](THIRD_PARTY_NOTICES.md) and the [asset register](docs/asset-licenses.json).
