# REPORT: han-500 expansion (branch `content/han-500`)

etym.si grows from the 36 film characters to **502 characters**: 466 new sign files plus the 36 film characters, in one collection of 62 themed units. Every new sign is `status: draft`, cites its Wiktionary page(s), and was written only from the scripted research extracts.

## Counts

| | |
|---|---|
| **Total in the collection** | **502** characters in 62 units (6–10 each) |
| **New sign files** | **466** (`content/systems/han/signs/`), all `status: draft` |
| Film characters reused (no new files) | 36 |
| Composite ids | 6 (see below) |

**New signs by origin type**

| pictogram | ideogram | compound-ideogram | phono-semantic | loan | uncertain |
|---|---|---|---|---|---|
| 108 | 21 | 85 | 201 | 23 | 28 |

**New signs by number of ancient stages on Commons** (oracle / bronze / seal / clerical)

| 4 stages | 3 | 2 | 1 | **none** |
|---|---|---|---|---|
| 131 | 115 | 55 | 74 | **91** |

Stage totals: oracle 230, bronze 265, seal 363, clerical 195. Journeys: `default` 370, explicit list 5 (气 从 虫 两 内), `[]` 91.

**With no ancient forms** (`journey: []`, 91): 个 么 他 们 住 你 信 候 做 关 写 只-隻 吃 吗 吧 呢 哥 啊 喊 嘴 太 奶 她 妈 孩 帮 床 店 影 很 忙 快 怎 怕 息 您 想 慢 找 接 推 晚 晨 晴 条 杯 样 桌 椅 楼 欢 洗 清 灯 爷 爸 玩 现 病 相 眼 睛 穿 站 第 等 答 累 脑 脚 脸 腿 茶 蓝 蛋 认 诉 课 谁 谢 跑 跟 这 送 里-裡 钱 铁 错 难 雷 鸭.

Story beats: every sign has topic, hook and closer; 165 have `early` and 186 have `turn` (only where the research describes the oldest form or the change). HSK 3.0: level 1 is covered 284/300 (incl. film characters), level 2 116/300, level 3 37/300.

## Where things are

| What | Path |
|---|---|
| Sign files (466) | `content/systems/han/signs/<id>.yaml` |
| Collection (62 units, 502 signs) | `content/collections/first-500/collection.yaml` |
| Selection + method | `staging/han-500/selection.yaml`, `SELECTION.md`, `candidates.tsv` |
| Research extracts (Wiktionary, ≤ ~2 KB each) | `staging/han-500/research/<id>.json` |
| Ancient forms (demos glyph format) + coverage | `staging/han-500/glyphs/<id>.json`, `glyph-coverage.json` |
| Writer drafts (JSON, source of the YAML) | `staging/han-500/drafts/<id>.json` |
| Tools | `staging/han-500/tools/` (`research.py`, `fetch_glyphs_list.py`, `make_selection.py`, `to_yaml.mjs`, `check.mjs`, `audit.py`, `stats.mjs`) |

Rebuild: `python3 tools/research.py --offline`, `python3 tools/fetch_glyphs_list.py`, `node tools/to_yaml.mjs`, `node tools/check.mjs` (0 errors). The cache (`.cache/`) and `tools/node_modules/` are git-ignored.

## How it was made

1. **Selection** (`SELECTION.md`): HSK 3.0 Band I (level 1 almost complete: 284 of 300 incl. film characters), CKIP word frequency, Wiktionary liushu labels and Commons stage availability, all read through the Wikimedia APIs (≤1 request/s, `etym-si-content/0.1` User-Agent).
2. **Research** (`research.py`, stdlib): simplified + traditional wikitext per sign, flattened to readable text. **Glyphs** (`fetch_glyphs_list.py`): the demos script adapted to read the selection (the verbatim copy is commit `48cbc5f`, so the adaptation is one reviewable diff); normalization and provenance logic unchanged.
3. **Writing**: six parallel writers on disjoint unit ranges, each with a packet (research extract + journey + stages per sign) and `WORKERS.md`. The lead ran the checker and `audit.py` on every draft and spot-checked **79 drafts (17%) against their extracts**, 10–16 per slice (accuracy, hedging, script forms, tone). No unsupported claims were found; the fixes requested were storyline repeats across slices (29 signs, e.g. three "musical chairs", three "peekaboo", two "tug-of-war", two fire trucks), after which the writers re-scanned each other's drafts and gave roughly 140 more signs fresh scenes (facts untouched). Final scan: no duplicate hooks or topics.
4. **Conversion**: `to_yaml.mjs` (yaml 2.9.1) emits the brief's exact shape (field order, flow maps, `lineWidth: 0`); `check.mjs` passes with **0 errors** on all 466 signs and the collection.

## Composite ids

| id | sense | note |
|---|---|---|
| `后-後` | after, behind | 后 alone = queen |
| `里-裡` | inside | 里 alone = village / *li*; no ancient forms for 裡 → `journey: []` |
| `几-幾` | how many | 几 alone = small table |
| `发-發` | to send out, to start (bow shooting an arrow) | 髮 hair not chosen |
| `只-隻` | measure word for animals (a hand holding one bird) | 只 only; no ancient forms for 隻 → `journey: []` |
| `钟-鐘` | bell, clock | 鍾 not chosen |

Same-form senses without a composite id: 面 (face), 谷 (valley), 斗 (dipper, *dǒu*), 了, 别 (別), 才, 向, 杯.

## Dropped characters and why

- **No Glyph origin on Wiktionary** (nothing accurate to say): 什 些 哪 净 (HSK 1), 咱 筷 (HSK 2), 苹 衬 (HSK 3), 壶.
- **Ambiguous simplified forms with little to show**: 着 (著), 系 (係/繫), 准 (準), 干 (乾/幹/干), and the brief's other examples 台 松 冲 (not in the selection).
- **Adult or travel vocabulary with unclear origins or 0–1 ancient stages**: 场 商 院 绍 馆 差 试 票 (HSK 1).
- **Cut for space while balancing units**: 曾 及 支 付 负 宿 (pool candidates with low relevance for young children); about 180 abstract HSK level 2 words (但 所 经 该 应 …) and most of HSK level 3 remain for a later round (`candidates.tsv` lists them with their data).

## Open questions for human review

1. **Grade 1–2 literacy lists were not consulted.** The network allowance covered only Wikimedia, so the mainland 识字表 lists the brief mentions could not be checked; please cross-check the selection against them.
2. **91 signs have no ancient forms** on Commons (`journey: []`), including very common words (你 他 们 吃 妈 爸). They were kept because literacy relevance ranks first; confirm, or look for another public-domain seal-script source later.
3. **Origin type convention.** Writers typed a sign by how it *started*, with later changes in `turn` (发-發 = pictogram though today's 發 is phono-semantic; 气 and 虫 = pictogram from the simplified page), and used `loan` when today's meaning is a sound-borrowing (23 signs: 万 八 其 南 四 它 常 必 我 才 新 早 来 相 者 自 色 行 豆 这 那 难 风). Please confirm the convention.
4. **28 `uncertain` signs** (两 也 五 做 公 六 再 冬 友 告 哥 夏 天 学 寸 小 尺 已 意 拿 方 是 比 白 累 西 间 青) explain competing theories in kid language ("Many scholars think…"); check the tone.
5. **`origin.parts` use the components of the research analysis, i.e. traditional forms** (买 = 网 + 貝, 视 = 示 + 見, 头 = 頁 + 豆). The schema has one `char` per part; decide whether parts need Hans/Hant variants. A few parts are rare Extension-B characters (𢑓 𦥯 𡆧 𢇅 𢧤 𠬝 𠂈) that need font coverage; they never appear in the text.
6. **Existing film content vs. research.** The film 豕 fact says "Find 豕 inside 家: a pig under a roof!", but Wiktionary (and the new 家 sign) says the bottom of 家 was originally a boar-shaped *sound* part 𢑓 and calls pig-under-a-roof readings folk etymology. Worth revisiting in the foundation migration. (Likewise 有 "hand holding meat" is labelled folk etymology; no film content uses it.)
7. **Readings chosen for multi-reading characters**: 为 wèi, 觉 jué, 假 jià, 相 xiāng, 朝 zhāo, 教 jiāo, 乐 lè, 谁 shéi, 血 xuè, 得 dé, 地 dì, 斗 dǒu. The checker warns on 不 (bù) and 识 (shí) only because Wiktionary gives those readings through automatic templates.
8. **Journey overrides** mix forms like the film's 云/雲: 气 (气 → 氣), 从 (从 → 從); 虫, 两 and 内 use files Commons stores under those variants. `File:朋-bronze.svg` has no drawable paths and was skipped (朋 shows 3 stages).
9. **Taiwan wording** was localized by the writers (洋芋片, 囉, 喔, 牠, 裡, 著); a native Taiwanese read-through is recommended. zh-Hans/zh-Hant lines that deliberately compare the two scripts produce 136 of the checker's 139 warnings; the other 3 are noted in items 7 and 10 (no errors).
10. **Unusual parts**: 太 (phono-semantic per Wiktionary, but only 大 + dot, so no sound part), 在 (two sound parts, no meaning part), 用 (sound part 同 only), 宫/师/很/影 (parts without glosses because the research gives none).
11. **Dependencies**: `staging/han-500/tools/` pins `yaml@2.9.1` (as instructed) and `hanzi-writer-data@2.0.1`, used only to fill the glyph files' `hanzi` list (no stroke data copied). Both were installed offline from the local npm cache. The SecureCoder dependency scanner was not running, so that check was skipped.
12. **Not done, by design**: no TTS, pictures or unit stories; the `rotate` beat from `char-stories.ts` is not part of the brief's YAML shape, so none was written. A few research extracts were trimmed to ~2 KB (marked "…"); writers saw only the trimmed text.
