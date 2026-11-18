# 配置字段

写配置（JSON）时读这份。它说明每个字段出现在片子的哪里、一行放得下多少字、牌怎么排。独立运行的完整例子见 [Studio Demo 配置](../../../examples/studio-demo/config.json)。

使用 `npm run build` 时，图片路径相对于配置文件所在目录；直接运行 Python 生成器时也可用 `--root` 指定素材根目录。只接受位图：PNG、JPG、WebP、GIF（GIF 取第一帧）；`brand.logo` 另外接受 SVG。远程图片先下载到示例目录再引用，并记录来源。

## 背景：`background`

背景独立于文字、卡片和镜头。用注册表 `assets/backgrounds/catalog.json` 中的 ID，或配置旁边的自备图片；`preset` 与 `image` 二选一。示例：

```json
"background": {
  "preset": "studio-amber",
  "dim": 0,
  "vignette": 0.18,
  "particles": false,
  "glow": false
}
```

自备图片改为 `"image": "assets/my-background.png"` 并删除 `preset`。图像保持比例居中铺满1920×1080，不随镜头转动；建议16:9，重要内容避开边缘。原图无损复制进工程，不按卡片尺寸压缩。GIF仅取第一帧，背景不支持视频。

`dim` 为黑色遮罩强度（0—1，默认0）；`vignette` 为暗角强度（0—1，有图默认0.18）。有图时 `particles`（浮尘）和 `glow`（地面光）默认关闭。没有 `background` 时沿用 `theme.stage` 渐变舞台及原附加光。渲染器不添加颗粒。

## 音轨：`audio`

```json
{
  "audio": {
    "music": { "path": "assets/my-music.wav", "volume": 0.9 },
    "sfx": { "path": "assets/sfx.wav", "volume": 0.65 }
  }
}
```

把自带 BGM 放在项目的 `assets/`，如上填写 `audio.music.path`，再运行 `npm run update -- <项目名> --draft` 试听。路径相对配置目录，支持 WAV、MP3、M4A、AAC、OGG 和 FLAC。启用配乐并省略 `path` 时使用模板的 [原创合成配乐](../assets/audio/MUSIC.md)。音量为 0—1，配乐默认 0.9，音效默认 1。两条音轨从 0 秒开始，导出时补静音或裁到 15 秒。换音乐后需要听音检查节拍，镜头按模板时间表播放。

每条音轨也支持 `enabled`（默认 `true`）。设为 `false` 时不读取、不复制也不混入该文件；两条都关闭可导出无声 MP4。`volume: 0` 仅静音，仍复制文件，不能用来排除不准备分发的素材。Styled Starter 默认启用配乐和 [Design Style 原片音效轨](../assets/audio/sfx.wav)。改动镜头节拍时，按 [音效对齐说明](../../../docs/sound-effects.md) 核对整轨、重新对齐或仅关闭音效。基础 `starter` 默认无声。

在仓库根目录运行 `npm run sfx -- --out examples/my-project/assets/sfx.wav` 可从镜头时间点生成独立 WAV。把输出路径填进 `audio.sfx.path`，再用草稿试听。可用 `--cues` 控制每个声音的种类、时间、长度、音量和声像，详见 [音效生成](../../../docs/sound-effects.md)。

`npm run build` 检查素材、范围及卡片选择，失败时列出原因；工程生成后 `studio.json` 给出实际音轨与段落时间。剪辑包和可搬移重建的方法见 [剪辑说明](../../../docs/editing.md)。

## 一行放得下多少字

每行文字不折行，超宽时整行缩小。下表是**不缩小**时的上限；一个汉字算 1，英文字母和数字约算 0.58。超过上限 25% 时生成脚本会提示“偏长”，先缩短文字。

| 字段 | 出现时间 | 上限（汉字 / 英文字符） | 说明 |
|---|---|---|---|
| `hook.kicker` | 0—0.7 s | 约 20 / 30 | 等宽小字，标题上方。可省 |
| `hook.title` | 0—0.8 s | 每行 4 / 7 | 1—2 行，全片最大的字 |
| `hook.sub` | 0—0.8 s | 20 / 35 | 标题下方一行。可省 |
| `count.big` | 2—4.8 s | 14 / 25 | 数字自动标成高亮色；独立的 `+ × · /` 自动弱化 |
| `count.sub` | 2—4.9 s | 28 / 48 | 可省 |
| `kit.head` | 6.1—10.1 s | 18 / 30 | 左上角，说明“拆开”的是什么 |
| `kit.path` | 6.2—10.2 s | 35 个等宽字符 | 右上角，主角在仓库里的路径或名字。可省 |
| `payoff` | 11—12.7 s | 4 / 8 | 左下角大字，全片落点 |
| `end.title` | 13.6 s 起 | 9 / 15 | 片尾名称 |
| `end.sub` | 13.6 s 起 | 22 / 38 | 一句话定位。可省 |
| `end.url` | 13.7 s 起 | 39 个等宽字符 | 不带 `https://` |
| `end.credit` + `end.handle` | 13.8 s 起 | 合计约 16 / 28 | 署名和账号。可省 |
| `end.seal` | 14.0 s 盖下 | 1—2 个字 | 署名旁的小印章。可省 |

## 牌：`cards`、`featured`、`hero`

`cards` 是 7—31 个对象的数组，每个：

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | 是 | 名字。牌下的名字行、牌背、无图牌的牌面都用它 |
| `no` | 否 | 名字前面的短标记，默认 `01`、`02`…。仓库有自己的编号就用仓库的；也可以放时长、版本号这类短数据 |
| `id` | 否 | 只用来在 `featured`、`hero` 里指这张牌，不显示。`no` 或名字有重复时写它 |
| `sub` | 否 | 一句补充：英文名、年代、类别、一句话用途 |
| `color` | 否 | 代表色 `#rrggbb`，用于牌背和无图牌面。不写时：有图片就从图里取一个主色，没有图片就从内置的十个颜色里轮流取。仓库里有这一项自己的颜色就写它的 |
| `backStyle` | 否 | 卡背配色与材质，写 `titanium` / `dusk` / `sand` / `amber` / `berry`；需要非 `original` 的 `theme.cardLook` 或 `theme.look`。不染色正面图片 |
| `back` | 否 | 单独覆盖卡背底色 `#rrggbb`；使用 `backStyle` 时保留该风格的文字、亮边和材质 |
| `tag` | 否 | 牌角的小标签（如 `STYLE`、`CLI`），全大写的短词 |
| `image` | 否 | 牌面图片，裁成 16:9。不写就用代表色加大字做牌面 |
| `front` | 否 | 与 `image` 同用，写 `image` 强制展示原图。可以同时保留 `face` 样式卡背。已有配置省略该字段时保留原绘制优先级 |
| `fit` | 否 | `cover`（默认，居中裁满）或 `contain`（完整放入，空处填图片边角的颜色）。终端截图、界面截图这类边上有内容的图用 `contain` |

**每拍转几张由牌数决定**：7—12 张每拍 1 张，13—18 张每拍 2 张，19—31 张每拍 3 张。2.0—5.0 s 一共六拍，所以只有 6 张牌会正对镜头停半秒，其余的只在两侧和远处闪过。

- `featured`：最多 6 个，按出场顺序写这 6 张（写 `id`、`no`、`title` 或从 0 起的序号）。挑画面差别最大的 6 张，相邻两张不要同色。不写就按 `cards` 的顺序取。
- `hero`：被拆开的那一张，写法同上，不能和 `featured` 重复。它在 5—6 s 飞转之后停下。
- 其余的牌按 `cards` 里的顺序填进剩下的位置。生成脚本会打印最终每一拍是哪张。

## 拆开的那张牌：`kit`

版式固定，两栏。左栏是主角牌、牌下一行字、打字面板；右栏是一排小图和最多三行标签。各部分按时间依次弹出，10.2 s 一起收回牌里。

```
kit.head                                        kit.path
┌──────────────┐   tiles.title  tiles.sub
│   主角牌      │   [小图][小图][小图][小图]        6.5 s
└──────────────┘   rows[0].title  rows[0].sub
under[0] under[1]   ● ● ● ● ●  [chip]              7.0 s
┌──────────────┐   rows[1].title  rows[1].sub
│ typing.title │   [01 标签][02 标签][03 标签]      7.5 s
│ typing.text▌ │   rows[2].title  rows[2].sub
└──────────────┘   [file.a][file.b][dir/]          9.0 s
   8.0—10.1 s 逐字打出
```

| 字段 | 说明 |
|---|---|
| `under` | `[粗体主词, 细体补充]`，牌正下方一行，说明这张牌是什么。可省 |
| `tiles.title`、`tiles.sub` | 小图上方的标题和补充。`sub` 不写时用各小图的 `label` 连起来 |
| `tiles.items` | 2—4 个。有图：`{"image": "...", "label": "海报"}`，裁成 4:5 竖图。没图：`{"big": "15s", "small": "短片", "label": "短片"}`——`big` 是一个大字或数字（1—4 个字符），`small` 是一行小字 |
| `rows` | 1—3 行，从上到下。尽量写满 3 行，只有 1 行时右栏下半是空的 |
| `typing.title`、`typing.sub` | 面板标题条，如 `安装` / `终端`、`AI 提示词` / `直接复制` |
| `typing.text` | 逐字打出的正文，等宽字体，每行约 53 个英文字符，最多 4 行；可以用 `\n` 换行。放仓库里**原样存在**的一段：安装命令、一行用法、提示词开头。太长就截断并以 `…` 结尾 |

`rows` 每行必须有 `title` 和 `items`，可以有 `sub`。三种 `kind`：

| `kind` | `items` | 适合 | 备注 |
|---|---|---|---|
| `dots` | 最多 7 个 `#rrggbb` | 配色、主题色 | 可加 `"chip": "Fredoka 600—700"`，在色点右边放一个等宽标签 |
| `chips`（默认） | 短词 | 规则、特性、步骤 | 自动加 `01`、`02` 编号；不要编号写 `"numbered": false` |
| `mono` | 文件名、命令、参数 | 目录结构、子命令、接口 | 等宽字体 |

一行的总宽度约等于 30 个汉字；超了整行缩小，**最后一行**会先折成两行。一行 4—6 个标签、每个 2—6 个字最好看。

## 字标牌和片尾：`brand`、`end`

字标牌是那摞牌的最上面一张，片尾停在画面左边。

| 字段 | 说明 |
|---|---|
| `brand.wordmark` | 必填。牌上的大字，一般是仓库名。含 `.` 时第一个句点画成强调色圆点（`Design.style`）；不想要写 `"dot": false` |
| `brand.tagline` | 字标下面一行小字 |
| `brand.logo` | 仓库的标志（SVG 或 PNG）。有就放在字标上方，牌背用它的剪影 |
| `brand.font` | `serif`、`sans`、`mono`。默认：纯英文用衬线体，含中文用黑体 |
| `brand.back` | 牌背颜色，默认等于强调色 |
| `brand.paper`、`brand.ink` | 牌面的底色和字色，默认浅纸色配深字。品牌是深色底时写成它的底色和浅字色 |

`end` 必填 `title` 和 `url`，其余可省。

## 颜色：`theme`

全部可省，默认是原片的暖色。

### 整套舞台与卡背：`theme.look`

```json
"theme": { "look": "graphite" },
"background": { "particles": false, "glow": false, "vignette": 0.28 }
```

| ID | 名称 | 方向 |
|---|---|---|
| `graphite` | 石墨银 | 中性石墨暗场、冷银柔光与少量暖灰，保留的金属配色 |
| `midnight` | 深靛蓝 | 深蓝和灰紫的低饱和暗场 |
| `copper` | 烟铜色 | 暖炭黑、烟铜与冷灰的轻微对照 |
| `glass` | 暖光玻璃 | 原片式暖暗舞台、地面光、透明玻璃弧面与透射卡背，历史试版 |

预设在 `templates/card-carousel/looks.json`，同时定义舞台、卡背、边缘光、文字强调色和打字面板配色。卡背使用柔和金属反射与薄倒角，反光随三维转动改变；不添加颗粒或噪声。正面图片和 `cards[].color` 的服务识别色保留。想单独指定某张卡背，用 `cards[].back: "#rrggbb"`；不设置时按整套调色板选择。

`glass` 使用透明玻璃卡背和独立印字，不使用不透明的金属底色。背景玻璃按边缘坡度折射光场，立体弧面随时间缓慢移动，并在主角拆解和片尾时避让文字区域。该预设默认关闭浮尘；建议 `background.glow: true` 保留原片式地面光。服务正面图片不变成透明玻璃。玻璃开关和基础配色在 `looks.json` 的 `surface` 内，透射参数与背景光学效果分别在 `scene.js`、`glass-stage.js`。

`theme.look` 未设置时保留原版纯色卡背与渐变舞台。`theme` 内显式填写的颜色可覆盖预设；`theme.stage` 可覆盖舞台。背景使用图片时，仍以 `background.preset` / `image` 为准。想回到抽象舞台，应删除这两个图片字段。

### 单张卡背的风格：`cards[].backStyle`

舞台继续用 `theme.look`，卡背可以分别指定以下风格，定义见 `templates/card-carousel/card-styles.json`：

| ID | 名称 | 材质与文字 |
|---|---|---|
| `titanium` | 石墨钛银 | 深灰缎面金属、微暖银边、浅色字 |
| `dusk` | 暮紫冷银 | 暗紫烟色玻璃、冷银轮廓、浅色字 |
| `sand` | 砂金暗场 | 暖砂哑光、浅金受光面、奶油色字 |
| `amber` | 琥珀暗蓝 | 蓝灰金属、琥珀边光、浅色字 |
| `berry` | 奶油莓红 | 浅奶油粉哑光、莓红细节、深莓色字 |

```json
{ "id": "amap", "title": "高德地图", "image": "assets/amap.jpg", "backStyle": "titanium" }
```

此前MCP试版将这五组循环分配给21张服务卡（本人已要求恢复原版）；风格跟随卡片重排。省略 `backStyle` 时使用 `theme.look` 原有卡背。`cards[].back` 仍可覆盖该风格底色。奶油莓红使用深色字，不能统一改成白字。改动后需重新渲染，背景和动画无需跟着替换。

### 单项主题颜色

| 字段 | 默认 | 用在哪 |
|---|---|---|
| `accent` | `#a34332` | 字标里的圆点、字标牌背、标签编号 |
| `highlight` | `#ffb59f` | 屏幕文字里的高亮：小标题、数字、路径、牌下的编号。要在深色背景上够亮 |
| `seal` | `#c8372d` | 印章 |
| `cursor` | `#ff7eb6` | 打字面板的光标 |
| `stage` | `"warm"` | 舞台色：`"warm"` 暖棕，`"cool"` 蓝灰 |

用仓库自己的品牌色做 `accent`；`highlight` 取同色系的浅色。牌本身的颜色越杂越好看，舞台和文字的颜色保持一种。


### 独立控制卡片：`theme.cardLook`

`original` 使用第一条 Design Style 原片的轻薄结构、彩色实心卡背和大编号；`graphite` / `midnight` / `copper` / `glass` 仅替换卡片材质，背景仍由 `theme.stage` / `background` 决定。省略时沿用 `theme.look` 的材质，保持旧配置兼容。

当前MCP示例采用 `"theme": {"accent":"#a34332","stage":"warm","cardLook":"original"}`。更换背景图片时保留 `cardLook`；更换卡片时保留 `background`。`cards[].back` 可独立覆盖卡背颜色，服务正面的 `color` 和图片不受影响。


`background.titleScrimHeight` 控制轮转段标题后暗色遮罩的高度，范围0—1080像素，默认400。浅色卡面上出现暗色横带时可缩短该遮罩；本次待审单帧使用280，暖色背景、镜头与卡片位置不变。


### 程序卡面：`cards[].face`

复用网页当前卡面样式时，从 `examples/styled-starter/config.json` 开始：七张卡片已有 `face`，没有外部图标依赖，默认启用原创 BGM。普通 `starter` 继续保留无程序卡面的原入门形式。

`face.brand` 为卡面底部、右上编号与极简卡背的品牌，省略时由构建器使用当前 `brand.wordmark`；`face.kicker` 为卡面左上标语，可显式留空。新项目应替换标语，避免带入示例内容。旧MCP配置及工作台预览保留原有默认字样。

用于在不修改原分享图的情况下，独立替换卡面色板、文字版式和图标。`palette` 使用 `front-styles.json` 的完整目录ID；`layout` 为 editorial / poster / split / minimal，`back` 为 number / type / minimal，`material` 为 matte / metal / glass，`light` 为0—100的主光横向位置。`icon` 是相对配置目录的位图路径，`summary` 与 `nameEn` 为来源支持的文字。存在该字段时默认优先绘制程序卡面。使用 `front: "image"` 时正面显示原图，卡背仍使用 `face`。

网页入口、保存选择的位置与完整库来源见 [样式工作台](../../../docs/card-studio.md)。
