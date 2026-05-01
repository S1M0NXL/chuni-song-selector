# CHUNITHM 点歌器

一个面向 Bilibili 直播间的 CHUNITHM 点歌辅助程序。程序会读取直播弹幕，根据观众发送的关键词进行模糊搜索，在点歌板中匹配曲目，并生成可展示的曲目信息与歌曲封面。

## 项目目标

- 连接 Bilibili 直播间并实时读取弹幕。
- 识别固定格式的点歌弹幕：`点歌 (难度) <歌曲名称/别名> (难度)`。
- 根据观众输入的歌曲名称、别名和可选难度进行模糊搜索；如果没有填写难度，默认选择当前歌曲的最高难度。
- 从本地点歌板数据中匹配歌曲信息。
- 生成包含歌曲标题、别名、版本、定数、难度、BPM、曲师和封面的点歌结果。
- 为直播推流、网页叠加层或机器人回复提供稳定的数据输出。

## 基本流程

1. 配置 Bilibili 直播间房间号。
2. 程序连接直播间弹幕流。
3. 观众发送点歌弹幕，例如：

   ```text
   点歌 玩具狂奏曲
   点歌 红 提
   ```

4. 程序解析弹幕中的歌曲名称或别名，以及可选难度。
5. 在点歌板数据中进行模糊匹配。
6. 返回匹配度最高的曲目和最终选择的难度，并生成曲目信息和歌曲封面路径。

## 点歌板数据

建议使用 JSON 保存曲库数据，例如：

```json
[
  {
    "id": "2582",
    "title": "Ultimate Force",
    "aliases": ["UF", "终极力量"],
    "artist": "削除",
    "version": "LUMINOUS",
    "genre": "ORIGINAL",
    "bpm": 270,
    "cover": "https://chunithm.beerpsi.cc/assets/jackets/2582.webp",
    "difficulties": {
      "basic": { "level": "5", "const": 5.0, "constDisplay": "5.0" },
      "advanced": { "level": "10", "const": 10.4, "constDisplay": "10.4" },
      "expert": { "level": "14", "const": 14.4, "constDisplay": "14.4" },
      "master": { "level": "15+", "const": 15.6, "constDisplay": "15.6" },
      "ultima": null
    }
  }
]
```

推荐字段：

- `id`：歌曲唯一标识。
- `title`：歌曲标题。
- `aliases`：常用别名、中文名、简称或观众常用搜索词。
- `artist`：曲师 / 艺术家。
- `version`：收录版本。
- `genre`：乐曲分类。
- `bpm`：歌曲 BPM。
- `cover`：封面图片路径或 URL。
- `difficulties`：不同难度的等级、定数与物量信息；`const` 是一位小数的定数数值，`constDisplay` 是展示用字符串。

当前仓库提供曲库导入脚本，会从 `reiwa.f5.si/chunithm_record.json` 导入等级、定数、分类、版本等主体数据，从 `chuni-penguin` 补封面和部分别名，从 `ChunithmUtil` 合并社区别名。运行后会覆盖 `data/songs.json`，同时尽量保留本地已有且不与上游别名冲突的别名：

```bash
npm run import:songs
```

人工搜索曲库：

```bash
npm run search:song -- "终极力量"
```

为已有歌曲添加别名并写回 `data/songs.json`：

```bash
npm run add:alias -- 2582 终极力量2
npm run add:alias -- "Ultimate Force" 终极力量2
```

删除某首歌上的指定别名，或从全曲库删除某个精确别名：

```bash
npm run delete:alias -- 2582 终极力量2
npm run delete:alias -- --all 雅迪
```

如果一个别名已被多首歌使用，点歌结果会按当前模糊搜索分数排序，并选择匹配度最高的曲目。

## 弹幕指令设计

固定使用以下指令格式：

```text
点歌 (难度) <歌曲名称/别名> (难度)
```

其中 `(难度)` 为可选项，用户实际输入时不需要包含括号。难度可以放在歌曲名称或别名前，也可以放在后面；未填写难度时，程序会自动选择该曲目的当前最高难度。

合法写法示例：

```text
点歌 <歌曲名称/别名>
点歌 <难度> <歌曲名称/别名>
点歌 <歌曲名称/别名> <难度>
```

如果前后同时填写难度且不一致，程序应视为无效指令并提示用户重新点歌，避免错误匹配歌曲名称。

可选难度支持四种表示方法，按同一列归一化为同一个难度；优先级从左到右由低到高：

| 表示方法 | 最低 |      |      |      |      | 最高 |
| --- | --- | --- | --- | --- | --- | --- |
| 单字 | 彩 | 绿 | 黄 | 红 | 紫 | 黑 |
| 谱面名 | 彩谱 | 绿谱 | 黄谱 | 红谱 | 紫谱 | 黑谱 |
| 缩写 | WE | BAS | ADV | EXP | MAS | ULT |
| 英文全称 | World's End | Basic | Advanced | Expert | Master | Ultima |

未填写难度时，程序会按该优先级选择当前曲目中存在的最高难度。例如曲目有黑谱则默认选择黑谱；没有黑谱但有紫谱则默认选择紫谱。

示例：

```text
点歌 玩具狂奏曲 紫
点歌 红 提
点歌 黑 younithm
点歌 怒槌
```

如果搜索到多个相近结果，程序会按匹配度排序并直接返回最高分结果。

## 配置项

建议使用项目根目录的 `.env` 或配置文件管理运行参数。注意 `.env` 放在仓库根目录，也就是和 `package.json` 同级，不是在 `src/backend/bilibili/` 目录下：

```env
BILIBILI_ROOM_ID=123456
SONG_DATA_PATH=data/songs.json
COVER_BASE_PATH=assets/covers
COMMAND_PREFIX=点歌
DIFFICULTY_PRIORITY=worlds_end,basic,advanced,expert,master,ultima
DIFFICULTY_LABELS=彩,绿,黄,红,紫,黑
DIFFICULTY_ALIASES=彩|彩谱|WE|World's End,绿|绿谱|BAS|Basic,黄|黄谱|ADV|Advanced,红|红谱|EXP|Expert,紫|紫谱|MAS|Master,黑|黑谱|ULT|Ultima
DEFAULT_DIFFICULTY=highest
FUZZY_MATCH_THRESHOLD=0.6
MAX_SEARCH_RESULTS=5
```

配置说明：

- `BILIBILI_ROOM_ID`：需要监听的 Bilibili 直播间房间号。
- `SONG_DATA_PATH`：点歌板曲库数据路径。
- `COVER_BASE_PATH`：歌曲封面资源目录。
- `COMMAND_PREFIX`：固定触发点歌的弹幕前缀，默认为 `点歌`。
- `DIFFICULTY_PRIORITY`：内部难度优先级，从左到右由低到高。
- `DIFFICULTY_LABELS`：展示用难度标签，从左到右对应 `DIFFICULTY_PRIORITY`。
- `DIFFICULTY_ALIASES`：允许用户输入的难度别名；同一组内使用 `|` 分隔，不同难度组使用 `,` 分隔。
- `DEFAULT_DIFFICULTY`：用户未填写难度时的默认策略，`highest` 表示选择当前曲目的最高可用难度。
- `FUZZY_MATCH_THRESHOLD`：模糊搜索最低匹配阈值。
- `MAX_SEARCH_RESULTS`：人工搜索命令最多展示的结果数量；点歌处理始终选最高分结果。

## 建议目录结构

```text
chuni-song-selector/
├── README.md
├── package.json
├── index.html
├── tsconfig.base.json
├── tsconfig.node.json
├── tsconfig.web.json
├── vite.config.ts
├── data/
│   └── songs.json
├── assets/
│   └── covers/
├── src/
│   ├── shared/
│   │   ├── difficulty.ts
│   │   └── types.ts
│   ├── backend/
│   │   ├── bilibili/
│   │   │   ├── danmaku-client.ts
│   │   │   └── types.ts
│   │   ├── commands/
│   │   │   └── parse-song-request.ts
│   │   ├── config/
│   │   │   └── app-config.ts
│   │   ├── search/
│   │   │   └── fuzzy-search.ts
│   │   ├── selection/
│   │   │   └── song-selector.ts
│   │   ├── songs/
│   │   │   ├── song-database.ts
│   │   │   └── song-loader.ts
│   │   └── main.ts
│   └── web/
│       ├── main.ts
│       ├── overlay-renderer.ts
│       ├── overlay-store.ts
│       └── styles.css
└── .env
```

## 当前项目框架

当前仓库已经搭好 TypeScript 项目骨架，包含后端核心逻辑模块、Bilibili 弹幕接入模块壳子，以及前端 OBS overlay 页面模块。

后端模块：

- `src/backend/config/app-config.ts`：读取 `.env` 和默认配置。
- `src/backend/commands/parse-song-request.ts`：解析 `点歌 (难度) 歌名 (难度)` 指令，要求 `点歌` 后至少一个空格，难度和歌名之间的空格可省略。
- `src/backend/commands/song-request-inspector.ts`：复用的点歌处理管线，输出最高匹配曲目的单个谱面信息。
- `src/backend/songs/song-loader.ts`：加载并校验 `data/songs.json`。
- `src/backend/songs/song-database.ts`：维护曲库和搜索词索引。
- `src/backend/songs/import-songs.ts`：从线上数据源导入正式曲库并覆盖 sample 数据库。
- `src/backend/songs/add-alias.ts`：为已有歌曲追加本地别名并持久化。
- `src/backend/songs/delete-alias.ts`：删除单曲别名，或从全曲库删除一个精确别名。
- `src/backend/songs/search-song.ts`：命令行人工检查搜索结果。
- `src/backend/search/fuzzy-search.ts`：标题 / 别名模糊搜索。
- `src/backend/selection/song-selector.ts`：串联指令解析、搜索和难度选择。
- `src/backend/bilibili/danmaku-client.ts`：Bilibili 直播弹幕 WebSocket 接入模块。
- `src/backend/bilibili/web-room-info.ts`：获取真实房间号、弹幕服务器列表和连接 token。
- `src/backend/bilibili/print-danmaku.ts`：监听直播间弹幕，将点歌弹幕转换为单曲单谱面结果。
- `src/backend/main.ts`：后端入口，支持本地模拟弹幕和直播间监听。

前端模块：

- `src/web/main.ts`：网页入口，默认渲染主页；带 `?overlay=1` 时渲染点歌队列页，带 `?ws=...` 时渲染后端事件 overlay。
- `src/web/overlay-store.ts`：接收后端事件并维护页面状态。
- `src/web/overlay-renderer.ts`：渲染当前点歌、候选列表和错误状态。
- `src/web/styles.css`：主页和 OBS 叠加层样式。
- `public/images/`：主页使用的静态图片资源目录，构建时会原样复制到网页输出目录。

安装依赖后可以使用：

```bash
npm install
npm run dev:sample
npm run dev
npm run inspect:command -- "点歌 紫玩具狂奏曲"
npm run import:songs
npm run search:song -- "终极力量"
npm run add:alias -- 2582 终极力量2
npm run delete:alias -- --all 雅迪
npm run danmaku -- 123456
npm run dev:web
npm run typecheck
```

本地验证点歌核心逻辑：

```bash
npm run dev:sample
```

或直接传入弹幕文本：

```bash
npm run dev -- "点歌 怒槌 紫"
```

字符串解析规则：

- `点歌` 和后续内容之间必须至少有一个空格，例如 `点歌 玩具狂奏曲`。
- 难度和歌曲名之间的空格可选，例如 `点歌 紫玩具狂奏曲`、`点歌 玩具狂奏曲紫` 都合法。
- 前后同时填写难度时必须一致，例如 `点歌 紫 玩具狂奏曲 紫` 合法，`点歌 紫 玩具狂奏曲 黑` 无效。

人工检查点歌解析和最高分匹配结果：

```bash
npm run inspect:command -- "点歌 Ultimate Force"
```

该命令会解析点歌文本，在曲库中按匹配度选择最高分结果，并只输出一首歌的一个谱面信息，例如曲目 ID、曲名、作者、BPM、分类、谱面难度、等级、定数和封面 URL。未填写难度时会按当前配置选择最高可用难度。不传参数时会进入交互模式，也可以通过 stdin 批量检查多行弹幕。

监听直播间弹幕并输出点歌结果：

```bash
npm run danmaku -- 123456
```

这个命令收到 `DANMU_MSG` 后会取 `info[1]` 的纯文本作为输入，复用 `inspect:command` 的搜索逻辑。普通聊天会跳过；合法点歌并匹配成功时，stdout 会输出单首歌的单个谱面 JSON。状态日志和无效点歌提示会写到 stderr。

如果看到 `获取弹幕服务器信息失败: -352`，通常是 Bilibili 的 WBI 签名没有生成成功。当前实现会在未登录状态下继续从 `/x/web-interface/nav` 读取 `wbi_img` 生成签名，因此不需要登录 cookie 也可以初始化普通直播间弹幕服务器。

如果连接和认证成功，但发送弹幕后没有文本输出，可以打开调试模式：

```bash
npm run danmaku -- 123456 --debug
```

调试模式会把收到的包类型和业务 `cmd` 写到 stderr。正常收到点歌弹幕时应该看到 `收到业务消息: DANMU_MSG`，随后 stdout 会打印匹配到的曲目信息。

网页前端默认打开主页：

```text
http://localhost:5173/
```

如果需要人工修改主页内容：

- 修改标题、作者、链接等页面文本：编辑 `src/web/main.ts`。
- 修改背景图、布局、字号、颜色、页脚位置：编辑 `src/web/styles.css`。
- 替换主页图片：把新图片放到 `public/images/`，再在 `src/web/main.ts` 中更新 `EIRENE_IMAGE_URL`。

本地预览网页：

```bash
npm run dev:web
```

构建可部署的静态网页：

```bash
npm run build
```

构建完成后，网页产物位于 `dist/web/`。部署时把 `dist/web/` 目录中的内容上传到任意静态网页服务即可，例如 Nginx、GitHub Pages、Netlify、Vercel 或 Cloudflare Pages。如果使用 OBS 浏览器源在本机预览，可以直接使用 `npm run dev:web` 提供的本地地址。

网页点歌器队列页可通过参数打开：

```text
http://localhost:5173/?overlay=1
```

后续接入后端推送后，可以通过查询参数指定 WebSocket 地址：

```text
http://localhost:5173/?ws=ws://localhost:17890
```

## 旧版建议目录草案

```text
chuni-song-selector/
├── README.md
├── data/
│   └── songs.json
├── assets/
│   └── covers/
├── src/
│   ├── bilibili/
│   │   └── danmaku-client.*
│   ├── songs/
│   │   ├── song-loader.*
│   │   └── fuzzy-search.*
│   ├── renderer/
│   │   └── song-card.*
│   └── main.*
└── .env
```

## 开发计划

- [ ] 初始化项目运行环境。
- [ ] 实现 Bilibili 直播弹幕连接。
- [ ] 实现弹幕指令解析。
- [ ] 设计并加载点歌板曲库数据。
- [ ] 实现歌曲模糊搜索与别名匹配。
- [ ] 生成点歌结果数据。
- [ ] 生成可用于直播展示的歌曲信息卡片。
- [ ] 增加搜索失败、重复点歌、候选列表等边界处理。

## 输出示例

程序匹配成功后可以输出类似数据：

```json
{
  "ok": true,
  "searchRawData": "Ultimate Force",
  "matchedScore": 1,
  "matchedTerm": "Ultimate Force",
  "matchedField": "title",
  "song": {
    "id": "2582",
    "title": "Ultimate Force",
    "artist": "削除",
    "bpm": 270,
    "genre": "ORIGINAL",
    "version": "LUMINOUS",
    "cover": "https://chunithm.beerpsi.cc/assets/jackets/2582.webp"
  },
  "chart": {
    "difficulty": "master",
    "difficultyLabel": "紫",
    "level": "15+",
    "const": 15.6,
    "constDisplay": "15.6",
    "notes": 3210
  }
}
```

如果需要事件式输出，`src/backend/selection/song-selector.ts` 仍可生成包含完整曲目和 `selectedDifficulty` 的 `song-selected` 事件：

```json
{
  "type": "song-selected",
  "query": "Ultimate Force",
  "requestedDifficulty": "紫",
  "matchedScore": 1,
  "song": {
    "title": "Ultimate Force",
    "artist": "削除",
    "version": "LUMINOUS",
    "genre": "ORIGINAL",
    "bpm": 270,
    "cover": "https://chunithm.beerpsi.cc/assets/jackets/2582.webp",
    "difficulties": {
      "basic": { "level": "5", "const": 5.0, "constDisplay": "5.0" },
      "advanced": { "level": "10", "const": 10.4, "constDisplay": "10.4" },
      "expert": { "level": "14", "const": 14.4, "constDisplay": "14.4" },
      "master": { "level": "15+", "const": 15.6, "constDisplay": "15.6" }
    }
  },
  "selectedDifficulty": {
    "name": "master",
    "label": "紫",
    "level": "15+",
    "const": 15.6,
    "constDisplay": "15.6"
  }
}
```

后续可以将该结果用于：

- 控制台输出。
- Bilibili 弹幕机器人回复。
- OBS 浏览器源叠加层。
- 本地网页点歌面板。
- 自动生成当前歌曲封面和信息卡片。

## 注意事项

- Bilibili 直播弹幕连接已包含心跳包、房间号转换和意外断开后的自动重连；主动停止程序不会触发重连。
- 曲库别名质量会直接影响模糊搜索体验，建议为热门曲目维护常用简称。
- 封面图片建议统一尺寸和命名规则，避免直播展示时出现拉伸或缺图。
- 如果需要机器人发弹幕回复，请遵守 Bilibili 直播间规则和接口限制。
