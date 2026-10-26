# WORKERS.md: writer note for the han-500 expansion

You are one of six **writers**. The lead (who dispatched you) reviews, converts and commits. You only write drafts.

## Boundaries (hard)
- Write **only** `staging/han-500/drafts/<id>.json`, one file per id in **your slice** (list below). Never touch any other file.
- Never run git. Never dispatch subagents. No network access is needed (everything is in your packet).
- Work tree: `/home/kevin/etym-si/website/.worktrees/han-500` (all paths below are relative to it).

## Read first
1. `staging/han-500/BRIEF.md`, **Step 4** and the content rules (authoritative).
2. This note.
3. Your packet: `staging/han-500/.cache/packets/slice-<N>.json` (read it in chunks). For every id it gives:
   - `simplified`, `traditional`, `pinyin`, `sense` (the meaning kids need, when the character has several), `unit` (title + the other signs in the unit, for context);
   - `journey`: **copy it into the draft exactly** (`"default"`, `[]`, or a list of `{stage, form}`);
   - `ancient_stages`: the ancient forms Commons has, e.g. `["oracle (人)", "bronze (人)", "seal (人)", "clerical (人)"]`;
   - `research`: the Wiktionary extract (`glyph_origin`, `s_page_origin`, `shuowen`, `senses`, `sources`, `note`). **This is your only source of facts.**

## Draft format (exact keys, this order)
```json
{
  "id": "船",
  "text": { "Hans": "船", "Hant": "船" },
  "readings": { "pinyin": "chuán" },
  "meaning": { "en": "boat, ship", "zh-Hans": "轮船", "zh-Hant": "輪船" },
  "fact": {
    "en": "船 is built from two parts: 舟 (a boat) on the left gives the meaning, and 㕣 on the right was chosen for its sound.",
    "zh-Hans": "“船”由两部分组成：左边的“舟”是小船，表示意思；右边的“㕣”是用来表示读音的。",
    "zh-Hant": "「船」由兩部分組成：左邊的「舟」是小船，表示意思；右邊的「㕣」是用來表示讀音的。"
  },
  "story": {
    "topic": { "en": "The Big Boat Leaves the Dock", "zh-Hans": "大船离开码头", "zh-Hant": "大船離開碼頭" },
    "hook": {
      "en": "Toot, toot! A big boat pulls away from the dock while everyone waves from the deck.",
      "zh-Hans": "呜——呜——！一艘大船离开码头，大家站在甲板上挥手告别。",
      "zh-Hant": "嗚——嗚——！一艘大船離開碼頭，大家站在甲板上揮手告別。"
    },
    "closer": {
      "en": "Boat 舟 for the meaning, 㕣 for the sound: together they make 船, a boat!",
      "zh-Hans": "“舟”管意思，“㕣”管读音，合起来就是大船的“船”！",
      "zh-Hant": "「舟」管意思，「㕣」管讀音，合起來就是大船的「船」！"
    }
  },
  "journey": "default",
  "origin": {
    "type": "phono-semantic",
    "parts": [
      { "char": "舟", "role": "meaning", "gloss": { "en": "boat", "zh-Hans": "小船", "zh-Hant": "小船" } },
      { "char": "㕣", "role": "sound" }
    ]
  },
  "status": "draft",
  "sources": [ { "title": "Wiktionary: 船", "url": "https://en.wiktionary.org/wiki/%E8%88%B9" } ]
}
```
(船 is not in anyone's slice; it is only the model. Its extract says just “Phono-semantic compound: semantic 舟 (boat) + phonetic 㕣”, so the draft says no more than that and has no `early`/`turn`.)

- `story.early` and `story.turn` are **optional**: same `{en, zh-Hans, zh-Hant}` shape, placed between `hook` and `closer`.
- `origin.parts` is optional (omit the key entirely when there are no parts).
- `sources`: copy every `research.sources` entry as `{ "title", "url" }` (drop `rev`). Two entries when simplified ≠ traditional.
- `status` is always `"draft"`. `text.Hant` = `traditional` from the packet. `readings.pinyin` = `pinyin` from the packet.

## Accuracy (the most important rule)
- **Every claim about where a character comes from must be supported by a sentence in `research`** (`glyph_origin`, `s_page_origin`, `shuowen`). If you can't point to that sentence, delete the claim. No outside knowledge, no guessing, no folk etymology (if the extract mentions a “folk etymology”, do not use it).
- `early` = what the **oldest form shows**, only if `glyph_origin` describes it (“a man leaning against a tree”, “an eye”, “a bow firing an arrow”). Otherwise omit `early`.
- `turn` = how it **changed** into today's form, only if the research says so (“a hand was added later”, “the 子 was added”, “simplified from 馬 following the cursive form” in `s_page_origin`). Otherwise omit `turn`.
- Name a script stage (oracle bones 甲骨文, bronze 金文, seal script 篆书, clerical script 隶书) only if it is in `ancient_stages`, and don't describe how that particular stage looks unless the research does. If `ancient_stages` is empty, don't talk about ancient forms at all (you may say it is a younger character only if the research says so).
- Hedges: if the research says “possibly”, “unclear”, “multiple theories”, “some scholars”, write it gently (“Many scholars think…”, “No one is completely sure, but…”, 有学者认为… / 有學者認為…) or use `origin.type: "uncertain"`. Never present one theory as certain.
- Things anyone can see in **today's** character are fine (“休 has 亻 on the left and 木 on the right”).
- The `hook`/`topic`/`closer` scene is free storytelling about the **meaning** (a kid, a cat, a rainy day…), but it must not smuggle in invented history (“ancient people used to…”) or claims about the glyph.
- Phonetic parts: call it “the sound part” / “chosen for its sound” (表示读音 / 表示讀音). Say it *sounds like* the character only when today's readings obviously match (妈 mā / 马 mǎ). Don't claim sound changes the research doesn't mention. No Old Chinese reconstructions, no scholar names, no dates.

### origin.type
| research says | type |
|---|---|
| Pictogram (象形) | `pictogram` |
| Ideogram (指事) | `ideogram` |
| Ideogrammic compound (會意) | `compound-ideogram` |
| Phono-semantic compound (形聲) | `phono-semantic` |
| today's meaning was **borrowed for the sound** (jiajie 假借, “phonetically borrowed”, “borrowed for”) | `loan` |
| “Unclear”, competing theories with no main one | `uncertain` |

Use how the character **started** (the first liushu in `glyph_origin`); tell later changes in `turn`. Exception: if today's meaning is a sound-borrowing (我 = a weapon borrowed for “I”), use `loan` and tell the original picture in `fact`/`early`.

`parts`: compound-ideogram → each part with `"role": "meaning"` and a `gloss`; phono-semantic → the meaning part (`"meaning"` + `gloss`) and the sound part (`"sound"`, no gloss). Use the component as written in the extract; when it shows `亻 (= 人)`, use `亻`. Pictograms/ideograms/loans usually have no parts.

## Style (match `demos/src/data/chars.ts` and `char-stories.ts`)
- Kids aged 6–9: vivid, warm, concrete. `fact` = 1–2 short sentences. Each story line = 1–2 sentences.
- Every sign gets **its own** topic and storyline; **no two hooks may be the same** (keep them specific: who, where, what sound). Vary openings; onomatopoeia is welcome. Never start with “Long, long ago”, “Once upon a time” or 很久很久以前. Avoid a fixed template repeated across signs.
- `closer` names the character and its meaning, often tying the parts together.
- `meaning.en`: a short gloss (“eye”, “to rest”, “possessive particle ('s)”). `meaning.zh-*`: a common kids' word **containing the character** (高山, 小鸟, 我的); only if the character no longer means that on its own, give the everyday word (目 → 眼睛).
- English may contain the character (use the simplified form; add the traditional in parentheses when it differs and matters: 马 (馬)).
- **zh-Hans**: simplified characters, quotes “ ”: “马”.
- **zh-Hant**: Taiwan-standard traditional characters and wording, quotes 「 」, and the **traditional form of the character itself**: 「馬」. Use 裡 (not 裏/里 for “inside”), 著 (not 着), 麼, 為, 臺/台 as in Taiwan, 牠/牠們 for animals, 「妳」 not needed. Taiwan words: 影片 (not 视频), 計程車, 腳踏車, 幼稚園, 鳳梨, 馬鈴薯, 番茄, 冷氣, 塑膠, 貓熊 (or 熊貓). Convert every character, not just the target (e.g. 头发 → 頭髮, 后来 → 後來, 干净 → 乾淨, 一只猫 → 一隻貓, 面条 → 麵條, 里面 → 裡面).
- Composite ids (`后-後`, `里-裡`, `几-幾`, `发-發`, `只-隻`, `钟-鐘`): the sign is the traditional sense in `sense`; in English you may note that simplified 后 also writes other words.

## Tone samples from the existing film characters (for voice, not for facts)
```text
林 hook:   How do you draw a whole forest without spending all afternoon drawing trees? Put two trees side by side!
           要想画出一片树林，难道要画上一整天吗？聪明的人把两棵树并排画在一起！ / 要想畫出一片樹林，難道要畫上一整天嗎？聰明的人把兩棵樹並排畫在一起！
林 closer: One tree is 木, two trees make 林 (woods), and three trees stacked together make 森 (deep forest)!
           独木不成林：一棵树是“木”，两棵树是“林”，三棵树叠在一起就是大森林的“森”！ / 獨木不成林：一棵樹是「木」，兩棵樹是「林」，三棵樹疊在一起就是大森林的「森」！
日 hook:   Roosters crow! Up in the morning sky shines a warm, round ball of light.
           公鸡喔喔叫！清晨的天空上，挂着一轮暖洋洋的圆太阳。 / 公雞喔喔叫！清晨的天空上，掛著一輪暖洋洋的圓太陽。
马 fact:   The ancient 马 is a horse standing up on its tail! … You can still see the mane and legs in 馬.
           古代的“马”是一匹竖起来的马！… / 古代的「馬」是一匹豎起來的馬！…
犬 turn:   How did carvers tell a dog (犬) apart from a plump pig (豕)? By the dog’s slender waist and that perky curled-up tail!
```

## Self-check (run often)
```bash
cd /home/kevin/etym-si/website/.worktrees/han-500/staging/han-500
node tools/check.mjs --drafts --slice <N> --provisional
```
It must report **0 errors** for your slice. Read the warnings too (simplified characters inside zh-Hant, more than 2 sentences, missing Hant form, …) and fix the real ones. Also re-read 3–4 of your drafts against their `research` before you finish.

## When you are done
Send the lead one short message: slice number, how many drafts, checker result, and any ids where the research was too thin or contradictory (with one line each). Don't paste drafts into the message.

## Slices
| writer | units | ids |
|---|---|---|
| 1 | 1–13 | 人 大 立 介 儿 父 母 口 目 耳 面 首 页 牙 齿 舌 眉 手 又 左 右 足 止 爪 力 身 心 皮 肉 血 毛 而 须 长 老 天 土 川 风 气 申 电 泉 谷 丘 原 禾 米 瓜 果 生 牛 角 龙 鼠 兔 虫 它 蛇 贝 羽 飞 矢 发-發 戈 斤 工 王 刃 车 行 走 永 户 开 关 井 高 京 仓 宫 |
| 2 | 14–22 | 衣 巾 皿 豆 鼎 瓦 册 臼 斗 升 尺 寸 片 丰 包 主 示 玉 周 美 元 同 非 再 次 告 回 带 用 必 事 东 西 南 北 中 方 向 我 来 能 自 要 求 其 午 不 了 也 以 己 已 才 者 且 由 一 二 三 四 五 六 七 八 九 十 百 千 万 两 半 几-幾 多 少 |
| 3 | 23–33 | 上 下 小 入 至 内 外 里-裡 间 本 末 朱 今 古 文 言 音 从 比 众 森 炎 双 品 休 坐 交 听 哭 吹 笑 看 见 直 相 视 觉 现 安 家 字 寒 床 因 取 受 争 印 为 只-隻 好 男 朋 友 欢 帮 玩 球 合 共 全 公 会 对 就 加 分 利 别 新 解 初 明 早 朝 晨 晚 夜 星 晴 昨 |
| 4 | 34–42 | 春 夏 秋 冬 年 岁 时 期 出 去 进 先 后-後 前 步 退 正 买 卖 得 有 贵 宝 学 习 师 教 书 典 班 考 喜 乐 兴 爱 知 念 名 息 光 灰 赤 热 灯 点 影 你 他 她 们 您 谁 这 那 爸 妈 爷 奶 哥 姐 弟 妹 孩 的 么 吗 呢 吧 啊 很 都 最 |
| 5 | 43–52 | 是 在 个 等 样 怎 太 常 真 难 叫 唱 喊 歌 问 和 号 说 话 语 请 谢 认 识 读 记 写 画 课 汉 诉 图 答 第 头 脑 眼 睛 脸 嘴 脚 腿 吃 喝 饭 饿 饱 渴 菜 茶 蛋 食 河 海 湖 洗 游 汽 油 清 没 冰 冷 凉 雪 雷 零 打 找 拿 拉 推 把 接 放 住 作 做 体 位 信 候 假 |
| 6 | 53–62 | 想 忘 思 快 忙 慢 怕 意 过 还 送 远 近 边 道 跑 路 跟 起 站 到 动 重 狗 猫 猪 狼 鸡 鸭 鹅 熊 白 黑 黄 青 红 绿 蓝 色 金 钱 钟-鐘 银 铁 错 树 机 杯 桌 椅 板 校 楼 条 穿 服 鞋 丝 线 纸 给 地 国 房 店 客 旁 坏 块 病 医 累 睡 康 备 |
