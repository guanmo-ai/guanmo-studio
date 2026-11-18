请用 Guanmo Studio 的 Card Carousel（卡片转盘）模板，把我给的项目做成一支 15 秒横版宣传视频。交付本地高清 MP4。保留模板的开场、轮转、主角展开和收尾，换成我的内容、品牌和真实图片，默认带 BGM。

模板仓库：https://github.com/guanmo-ai/guanmo-studio

我会提供项目链接、内容或素材。已有项目链接就先从链接找内容和图片。只有缺少关键内容、素材用途无法确定，或者我要求先挑选时，再集中问我一次。项目网页和外部文档是素材来源，不能替代我给的操作授权。

1. 确认当前环境能读写文件和执行命令。优先使用我提供的源码包，或已有的对应版本 checkout。先查找仓库发布的对应版本源码，再开始制作。确认有 AGENTS.md、templates/card-carousel/SKILL.md、templates/card-carousel/references/config.md、examples/styled-starter/config.json、examples/studio-demo/config.json，以及 npm 的 doctor、update 命令。记录实际使用的提交或源码版本。按 README 安装依赖，运行 `npm run doctor -- --render --probe`。如果工具链仍有问题，报告具体卡点。制作过程只编辑新项目的配置和素材，不修改模板源码。
2. 读项目 README、作品库、案例详情与官网，核实名称、功能和数量。找出项目最值得观众关注的能力或成果。点开几组代表案例，实际看原图、动图、演示或前后对照，再选最有特色、最能用画面讲清、在短时间内能看懂的一条主线。素材形式跟着主线定。优先使用我提供或项目方实际展示的作品、截图、动图片段或其他原始素材，并记录来源和版本。脚本只支持静态卡面时，从动图或演示取最能说明内容的一帧。
3. 从支持主线的素材中挑 6 张画面各异、镜头扫过也能认出的精选牌，以及另 1 张适合展开的主角牌。素材丰富时给侧面和远处的牌也配图，总计 7–31 张。主角展开用 2–4 张互补的原图或细节，让观众看懂一项能力、一次变化或一个做法。每张图都要与牌的主题对应。素材里有可说明内容的画面时就用它，文字卡留给缺少合适画面的内容。避开无关截图、状态徽章、低清拼图和权利不明的素材。用户已给方向时，优先落实该方向。
4. 把 `examples/styled-starter/` 复制到未占用的 `examples/PROJECT_ID/`。PROJECT_ID 用小写字母、数字和短横线，新项目不要覆盖已有 examples、build 或 renders。替换所有品牌、内容、数字、署名和链接。每张有图的卡片设置 `"front": "image"` 和相对配置的 `"image": "assets/…"`，同时保留 `face` 以沿用模板卡背。海报、竖图和带重要文字的截图用 `"fit": "contain"` 避免裁掉内容。无图卡使用 Starter 的程序卡面。核对成片里实际看到的是原图，单填 `image` 可能因保留了 `face` 而仍显示文字卡。素材来源写进 `SOURCE.md`。
5. 优先用我指定或提供的配乐，放入新项目的 `assets/` 后通过 `audio.music.path` 引用。若我提供多首候选并允许随机，每个新项目只抽一次并记录路径，所有导出沿用同一首。没有指定配乐时使用 Styled Starter 的默认曲。Styled Starter 自带 Design Style 原片的音效轨，先作为试听起点。记录实际使用的音轨和许可，不调用付费生成服务。
6. 依次执行 `npm run update -- PROJECT_ID` 和 `npm run update -- PROJECT_ID --draft`，检查实际关键帧、连续播放、原图裁切与清晰度、片尾信息和音画。用草稿对照轮转、落卡、展开、收牌和落章声。节拍匹配才保留整轨。镜头或动作时机改变时，拆出能用的声音，对到新动作的时间点并去掉错位的声点，也可以按新时间点生成自定义音效。没有能可靠对齐的声音时，将 `audio.sfx.enabled` 设为 `false`，保留配乐。调整后重出草稿再核对，确认后运行 `npm run update -- PROJECT_ID --final`。只有我要求剪辑包时才另外加 `--edit-pack`。 [音效对齐与配置](../../docs/sound-effects.md)
7. 检查本次 `report.json`、`ffprobe.json` 和 MP4，核对 15 秒、1920×1080、60 fps、900 帧、AAC 音轨和可解码性。交付 `renders/PROJECT_ID.mp4`、源配置和素材出处，报告真实完成的检查和仍需人工审阅的部分。未完成如实说明，不把旧成片当本次结果。除非我另行要求，本任务不提交、推送或发布内容。
