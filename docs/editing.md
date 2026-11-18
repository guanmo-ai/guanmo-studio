# 替换与剪辑

以 `config.json` 为内容入口。背景、卡片、文案、颜色和音轨各有独立字段，修改源配置后重新构建；不要手工修改会被覆盖的 `build/<项目>/film.json`。

```bash
npm run build -- studio-demo
npm run render -- build/studio-demo --out renders/studio-demo.mp4 --proof-only
npm run preview -- build/studio-demo
npm run render -- build/studio-demo --out renders/studio-demo.mp4 --edit-pack
```

先看关键帧和预览，再执行最后的完整渲染。`--proof-only` 将关键帧和报告写入 `*.proof-checks/`。完整渲染使用独立的 `*-checks/`，因此可以用同一个 `--out` 名称补画关键帧。`.proof.mp4` 后缀留给审阅命令的输出标识。一次完整渲染附带剪辑包时，输出为：

```text
renders/studio-demo.mp4          带混音成片
renders/studio-demo-checks/      关键帧与规格记录
renders/studio-demo-edit/
  clips/01-hook.mp4 … 06-end.mp4       按帧切开的六段无声画面
  audio/music.wav                     配乐，24-bit / 48kHz / 双声道
  audio/sfx.wav                       音效，相同规格
  background.png                      使用的原背景（仅使用图片背景时）
  timeline.json                       秒数、帧号、相对文件路径
  markers.csv                         便于查看的段落表
  project/config.json                 可继续编辑的源配置
  project/assets/                     原图片与原音轨，路径可搬移
  README.md                           本次导出对应的操作说明
  TEMPLATE-SOURCES.md                  模板默认素材的来源记录
  SFX-LICENSES.txt                     默认音效的出处与CC0说明
```

六段画面依编号首尾相接，保持60fps，总计900帧。时间表中的帧号从0起，`endFrame` 是不包含的结束边界。将两条音轨各放一轨，从0秒开始；导出分轨已应用配置中的音量，导入后保持0dB可还原混音。分段在准确帧位置重新编码，不依赖H.264的关键帧位置；适合调顺序、删段或换声音。

片段内卡片、文字与背景已合成。替换这些内容时，修改 `project/config.json` 再渲染，原素材都随包保留。构建产物中的 `source/` 也是同一份可编辑源配置。该目录能整体搬移，重建需要Guanmo Studio仓库和本地依赖，不是剪映、Premiere或DaVinci的原生时间线。

项目如有 `SOURCE.md` 会随源配置保存。自备素材以项目来源记录为准，`TEMPLATE-SOURCES.md` 与 `SFX-LICENSES.txt` 描述模板默认素材，不授予新增素材许可。

已有成片也能单独打包，无需重复渲染画面：

```bash
node scripts/edit-pack.mjs build/studio-demo renders/studio-demo.mp4
```

构建目录和成片必须来自同一版配置，且为60fps。不同规格的旧视频不应直接套用这个段落表。

AI制作入口是根目录 `AGENTS.md` 和模板 `SKILL.md`；字段、字数和配置示例集中在 `templates/card-carousel/references/config.md`。这种短入口、按需读取说明、脚本返回具体失败原因的组织，参考 [OpenAI的AGENTS.md说明](https://learn.chatgpt.com/docs/agent-configuration/agents-md) 与 [Anthropic的Agent工具实践](https://www.anthropic.com/research/writing-tools-for-agents)。实际能力以仓库验证记录为准。


## 快速替换入口

```bash
npm run update -- studio-demo
npm run update -- studio-demo --draft
npm run update -- studio-demo --final --edit-pack
```

第一条只构建并输出快速关键帧；第二条导出 `.draft.mp4`，规格960×540、30fps，减少运动模糊采样，用于看内容、构图和连续动作；第三条才输出1920×1080、60fps高清成片与剪辑包。快速预览不替代高清画面检查，默认文件名分开，避免覆盖定稿。脚本记录实际耗时，不承诺所有素材在固定秒数内完成。

背景由 `background` / `theme.stage` 决定；卡片材质由 `theme.cardLook` 决定（`original` 或已有质感ID），内容仍由 `cards` 决定，音轨由 `audio` 决定。修改配置、快速预览、完整导出是独立步骤，普通替换不改镜头或动画引擎。


只审阅某一帧时可直接输出原尺寸PNG（不生成MP4）：

```bash
npm run render -- build/studio-demo --frame 2.75 --out renders/studio-demo-frame.mp4
```

`--frame` 自动进入单帧模式，关闭时间上的运动模糊以便检查字色与材质。上述命令将图片保存到 `renders/studio-demo-frame.proof-checks/frame-2.75.png`。完整视频采用原运动模糊采样，连续播放需另看草稿或成片。

## 保存失败与中断

视频、检查报告和剪辑包先在临时目录完成，再一起替换目标。正常错误或渲染中按 Ctrl+C 会保留上一次完成的输出；保存多个产物时任一移动失败，会恢复本次已移动的旧产物。该保证不覆盖断电或强制 SIGKILL。

剪辑包拒绝覆盖仓库、输入工程、成片及含普通资料的目录；MP4输出拒绝覆盖目录与符号链接。包内的许可和来源说明保留可用的相对链接；其余源仓库引用使用明确的仓库链接。迁移剪辑包后，重建时应使用迁移后的 `project/config.json` 路径。
