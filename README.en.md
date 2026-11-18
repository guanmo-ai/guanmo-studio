# Guanmo Studio

**Edit one JSON file and turn your project into a 15-second 3D card carousel video.** Everything runs locally and exports a 1920×1080 / 60fps MP4. Free and open source: no account and no paid model required. AI coding agents can produce videos for you with the bundled prompt.

[**Live demo**](https://guanmo-ai.github.io/guanmo-studio/) · [中文文档](README.md) · [Configuration](templates/card-carousel/references/config.md) · [AI prompt](templates/card-carousel/prompt.md) · [Licenses and assets](THIRD_PARTY_NOTICES.md)

[![Card Carousel showcase: cards fan out, spin, and focus on one hero card](examples/studio-demo/preview.webp)](examples/studio-demo/video.mp4)

<sub>This showcase ships with the repository. Click for the 1080p original; the three steps below reproduce it on your machine.</sub>

## Reproduce it in three steps

You need **Node.js 22+**, **Python 3.10+**, and **FFmpeg**. See the [platform guide](docs/platform-support.md) if any are missing.

**1. Get the code** with **Use this template** above, or clone it:

```bash
git clone https://github.com/guanmo-ai/guanmo-studio.git
cd guanmo-studio
```

**2. Install** (once; downloads the matching browser):

```bash
npm ci
npm run setup
npm run doctor -- --render --probe
```

**3. Export the showcase:**

```bash
npm run update -- studio-demo --final
```

The video is written to `renders/studio-demo.mp4`. Use `--draft` instead of `--final` for a quick 960×540 preview, and add `--edit-pack` to export six segments plus separate music and effects tracks to `renders/studio-demo-edit/`.

## Use your own content

Copy the styled starter (styled cards, music, and effects) under a new project name:

```bash
cp -r examples/styled-starter examples/my-project
```

<sub>Windows PowerShell: `Copy-Item -Recurse examples/styled-starter examples/my-project`</sub>

Edit `examples/my-project/config.json`:

| Field | Purpose |
| --- | --- |
| `brand.wordmark` / `brand.tagline` | Project name and one-line pitch |
| `cards` | 7–31 cards, each with `title` and `sub`; use `front: "image"` with `image` for picture cards |
| `featured` / `hero` | The six featured cards and the hero card that expands |
| `background.preset` | Background ID; browse them in the [live demo](https://guanmo-ai.github.io/guanmo-studio/) |

Then check and render:

```bash
npm run update -- my-project            # quick proof frames
npm run update -- my-project --draft    # continuous 15-second draft
npm run update -- my-project --final    # high-quality video
```

**Let AI do it:** give the [production prompt](templates/card-carousel/prompt.md) and your project link to Claude Code, Codex, or another coding agent. It follows the [template guide](templates/card-carousel/SKILL.md) to pick content, edit the configuration, check frames, and export.

**Preview release, v0.1.** One animation template, Card Carousel: 15 seconds, 1920×1080 at 60fps, with 7–31 image or text cards. Six featured cards lead into one expanded hero. Drafts render at 960×540 and 30fps. Backgrounds and palettes are options within the same template. Portrait video, other durations, a timeline editor, and multi-user hosting are not implemented.

## Platform support

| Platform | Current status | Recommended approach |
| --- | --- | --- |
| **macOS** | **Verified on Apple Silicon**: builds, web workbench, and complete video exports | Follow the three steps above |
| **Windows** | **CI passing** (Windows Server 2025, software rendering): doctor, tests, browser interaction, and full draft export; real GPUs and console Ctrl+C still need manual testing | Install Node.js, Python, and FFmpeg, then run the setup commands in PowerShell; pass the rendering doctor probe before creating videos |
| **Linux** | **CI passing** (Ubuntu 24.04 / x86_64, software rendering): doctor, tests, browser interaction, and full draft export | Prefer Docker for batch exports; native installation requires browser system libraries via `npm run setup -- --with-deps` |

For GPU or WebGL problems during exports on Windows/Linux, use `STUDIO_GL=software` for CPU rendering. Software rendering is much slower (roughly 0.6 s per frame for a 960×540 draft), so time a draft before a final export. See the [platform guide](docs/platform-support.md) for PowerShell syntax, system dependencies, and Docker commands. The container provides batch exports; use a native installation for the web workbench. Docker on a Windows host has not been separately tested.

## Installation details

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

## Style workbench

`npm run studio` opens the background gallery. `npm run card-studio` opens the 30-palette card workbench. Clicking a palette previews it; adding it is a separate action. Multiple palettes are distributed evenly with a saved random seed. Saving writes a local selection file without changing official examples or rendering a video. Run `npm run update -- studio-demo --saved-style` to build proof frames with that selection; add `--draft` or `--final` for video output. This uses a separate project directory. The workbench can restore the saved selection without writing the file, and reports edits made while a save is in progress as unsaved changes.

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
