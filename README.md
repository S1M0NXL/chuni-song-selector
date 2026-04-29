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
    "id": "song-001",
    "title": "Song Title",
    "aliases": ["别名1", "别名2"],
    "artist": "Artist",
    "version": "CHUNITHM",
    "bpm": 180,
    "cover": "assets/covers/song-001.jpg",
    "difficulties": {
      "basic": "3",
      "advanced": "7",
      "expert": "10",
      "master": "13+",
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
- `bpm`：歌曲 BPM。
- `cover`：封面图片路径。
- `difficulties`：不同难度的等级信息。

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

如果搜索到多个相近结果，程序可以按匹配度返回候选列表；如果匹配度足够高，则直接返回最佳结果。

## 配置项

建议使用 `.env` 或配置文件管理运行参数：

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
- `MAX_SEARCH_RESULTS`：最多返回的候选曲目数量。

## 建议目录结构

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
  "type": "song-selected",
  "query": "玩具狂奏曲",
  "requestedDifficulty": "紫",
  "matchedScore": 0.92,
  "song": {
    "title": "Garakuta Doll Play",
    "artist": "t+pazolite",
    "version": "CHUNITHM",
    "bpm": 256,
    "cover": "assets/covers/garakuta-doll-play.jpg",
    "difficulties": {
      "basic": "4",
      "advanced": "8",
      "expert": "12",
      "master": "14"
    }
  },
  "selectedDifficulty": {
    "name": "master",
    "label": "紫",
    "level": "14"
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

- Bilibili 直播弹幕连接可能需要处理断线重连、心跳包和房间号转换。
- 曲库别名质量会直接影响模糊搜索体验，建议为热门曲目维护常用简称。
- 封面图片建议统一尺寸和命名规则，避免直播展示时出现拉伸或缺图。
- 如果需要机器人发弹幕回复，请遵守 Bilibili 直播间规则和接口限制。
