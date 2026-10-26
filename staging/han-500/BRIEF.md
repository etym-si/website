# Brief: extend etym.si to ~500 Chinese characters (branch `content/han-500`)

You are the **expansion lead**. A parallel effort (branch `content-foundation`, another worktree) is turning the app's hard-coded content into **one YAML file per character** (spec: `docs/superpowers/specs/2026-10-25-content-foundation-design.md`, read §1–§3 and §8). Your job is to produce the content for **~464 new characters** in that format, so that together with the existing 36 film characters etym.si has **~500**. Your branch is merged into the foundation later, where a real schema validator, the glyph importer and TTS will run.

## Hard boundaries
- Work only in `/home/kevin/etym-si/website/.worktrees/han-500` (branch `content/han-500`). Never touch `/home/kevin/etym-si/website` (it serves a LAN preview) or the `content-foundation` worktree.
- Only add files under `content/systems/han/signs/`, `content/collections/first-500/`, and `staging/han-500/`. Do **not** modify `demos/` or `docs/`.
- Do **not** create sign files for the 36 existing film characters: 日山水林木鸟象草田竹马夫刀舟鱼网燕云雨伞石火龟鹿豕叟虎弓舍羊花门犬子女月. They may (and should, if they fit) appear in the collection.
- No TTS, no pictures, no stories (those come later). No pushes. Commit on your branch in logical chunks.
- Network is allowed **only** for Wikimedia (en.wiktionary.org, commons.wikimedia.org, upload.wikimedia.org). Be polite: User-Agent `etym-si-content/0.1 (https://github.com/etym-si/website)`, ≤1 request/second, back off on 429/503 (honor Retry-After).

## Step 1: selection (`staging/han-500/selection.yaml` + `SELECTION.md`)
Choose ~500 characters total (the 36 film characters plus ~464 new ones) for children aged 6–9 learning Chinese (bilingual families). Criteria, in priority order:
1. Early-literacy relevance and frequency. Use authoritative lists and cite them in SELECTION.md: e.g. HSK 3.0 (2021) Level 1–2 character lists, mainland primary grade 1–2 literacy lists, character frequency ranks.
2. Visually explainable origins (pictograms, ideograms, simple compounds) are preferred. Common phono-semantic compounds are fine when they're explained as "meaning part + sound part".
3. Ancient forms are available on Wikimedia Commons ("Ancient Chinese characters project": `File:<form>-oracle.svg`, `-bronze.svg`, `-seal.svg`, `-clerical-han.svg` / `-slip.svg` / `-silk.svg`). Prefer characters with ≥2 ancient stages.

Group the list into **themed units of 6–10 characters**, ordered pedagogically: pictographs first (人 口 目 手 …), then ideograms (上 下 本 …), then compounds (休 明 好 …), then phono-semantic. Each unit gets a title (en / zh-Hans / zh-Hant) and a color (`#rrggbb`).

**Simplified forms that cover several traditional characters** (e.g. 发 發/髮, 后 後/后, 里 裡/里, 面 麵/面, 只 隻/只, 干 乾/幹/干, 几 幾/几, 台, 斗, 谷, 松, 冲, 钟): pick the sense kids need, and use the composite id `<simplified>-<traditional>` (e.g. `后-後`). The filename and `id` use that composite.

## Step 2: research, scripted (`staging/han-500/research/<id>.json`)
Write a Python script (`staging/han-500/tools/research.py`, stdlib only) that, for each selected new character, fetches the en.wiktionary wikitext of the simplified **and** traditional page (`action=query&prop=revisions&rvprop=content&rvslots=main&formatversion=2&format=json`) and saves a **compact extract** (no raw pages), containing:
- the forms (`{{zh-forms|s=…|t=…}}`)
- the first Mandarin reading (`{{zh-pron|m=…}}`)
- the "Glyph origin" text under `==Chinese==`, with templates flattened to readable text
- any Shuowen quote
- the first few English senses
- the source URLs

Keep each extract under ~2 KB. The writers read these extracts, never whole pages.

## Step 3: ancient forms, scripted (`staging/han-500/glyphs/<id>.json`)
Copy `demos/scripts/fetch-glyphs.py` to `staging/han-500/tools/fetch_glyphs_list.py` and adapt it to read the selection, with optional per-character journey overrides, instead of the hard-coded `FILM_ORDER`, `TRAD` and `OVERRIDES`. Keep the normalization and provenance logic **unchanged**.

- Output: **exactly the same JSON format** as `demos/public/glyphs/<char>.json`, one file per new character, into `staging/han-500/glyphs/`. Also write `staging/han-500/glyph-coverage.json` (stages found per character).
- Cache downloads under `staging/han-500/.cache/` and add that path to `.gitignore` within `staging/han-500/`.
- Don't copy hanzi stroke data; the build pulls it from `hanzi-writer-data`.

## Step 4: write the content
Writers produce **one JSON draft per character** in `staging/han-500/drafts/<id>.json`. Using JSON avoids YAML quoting mistakes. Your converter (`staging/han-500/tools/to_yaml.mjs`, using the `yaml` npm package 2.9.1 installed in this worktree with `npm i -D yaml@2.9.1` inside `staging/han-500/tools/`) then emits canonical YAML to `content/systems/han/signs/<id>.yaml`.

The YAML shape is exactly this (field order as shown; `lineWidth: 0`):

```yaml
id: 目
text: { Hans: 目, Hant: 目 }
readings: { pinyin: mù }
meaning: { en: eye, zh-Hans: 眼睛, zh-Hant: 眼睛 }
fact:
  en: …
  zh-Hans: …
  zh-Hant: …
story:
  topic: { en: …, zh-Hans: …, zh-Hant: … }
  hook: { en: …, zh-Hans: …, zh-Hant: … }
  early: { … }        # optional: what the oldest form shows
  turn: { … }         # optional: how it changed into today's form
  closer: { … }
journey: default      # or [] (no ancient forms), or an explicit list: [{ stage: seal, form: 艸 }, …]
origin:
  type: pictogram     # pictogram | ideogram | compound-ideogram | phono-semantic | loan | uncertain
  parts:              # optional; for compounds
    - { char: 氵, role: meaning, gloss: { en: water, zh-Hans: 水, zh-Hant: 水 } }
    - { char: 可, role: sound }
status: draft
sources:
  - { title: 'Wiktionary: 目', url: 'https://en.wiktionary.org/wiki/%E7%9B%AE' }
```

**Content rules** (match the tone and quality of the existing `demos/src/data/chars.ts` and `demos/src/data/char-stories.ts`; read a few entries first):
- **Accuracy first.** Every claim must come from the research extract (glyph origin / Shuowen). No folk etymologies. If scholars disagree, say so gently ("Many scholars think…") or use `origin.type: uncertain`. `early` must describe what the oldest form actually shows; omit it if unknown. Every sign needs ≥1 `sources` URL (https).
- **For children aged 6–9.**
  - `fact`: 1–2 short sentences.
  - Each story line: 1–2 sentences.
  - Vivid, warm, concrete. Each character gets **its own topic and storyline**. Never start with "Long, long ago" or "很久很久以前". No two characters may share a hook.
- `meaning.en`: a short gloss. `meaning.zh-*`: a common kids' word containing the character (as in chars.ts).
- **Three locales, all required**:
  - **zh-Hans** uses “” quotes.
  - **zh-Hant** uses 「」 quotes, Taiwan-standard traditional characters and wording (裡, 著, 牠 for animals), and the traditional form of the character itself.
  - **English** may contain the character itself (e.g. "目 is an eye…").
- `readings.pinyin`: tone marks (not numbers), the primary reading for the chosen sense.
- `journey`:
  - `default` = oracle, bronze, seal, clerical looked up on the **traditional** form.
  - Use an explicit list when the ancient form is written with a different character (as the existing 云/网/草/花 do).
  - Use `[]` when Commons has no ancient forms.
  - Keep it consistent with `glyph-coverage.json`.

## Parallel writers (optional, recommended)
You may dispatch **up to 6** writer subagents in parallel (type `self`, model `inherit`). Each one:
- owns a **disjoint** slice of ids
- reads this brief + a short worker note you write (`staging/han-500/WORKERS.md`: their id list, style examples, file paths)
- writes only `staging/han-500/drafts/<id>.json`
- never runs git
- never dispatches subagents

You review: run the checker, spot-check ≥10% of each slice against its research extract (accuracy + style), send back fixes, then convert and commit.

## Checker (`staging/han-500/tools/check.mjs`)
Fail on any of these:
- YAML doesn't parse
- a field is missing or extra versus the shape above
- an empty locale string
- an id ≠ filename, or a duplicate id
- a pinyin without a tone mark (allow neutral-tone exceptions)
- a zh-Hant string with “” quotes, or a zh-Hans string with 「」
- English starting with "Long, long ago"
- a duplicated hook
- `journey` inconsistent with glyph coverage
- missing sources

It also checks that the collection's signs all exist (here or among the 36 film chars), and that each sign appears once in the collection.

## Collection (`content/collections/first-500/collection.yaml`)
```yaml
id: first-500
title: { en: My First 500 Characters, zh-Hans: 我的前500个字, zh-Hant: 我的前500個字 }
system: han
units:
  - n: 1
    title: { en: …, zh-Hans: …, zh-Hant: … }
    color: '#2fb67c'
    signs: [人, 口, 目, …]
```
No `story` and no `lessons` keys (the default lesson rule applies).

## Finish
`staging/han-500/REPORT.md` covers:
- counts: total, new, by origin type, by number of ancient stages, with no ancient forms
- composite ids
- characters you dropped and why
- open questions for human review

Commit everything on `content/han-500`.

Reply to the controller with **only**: the commit range, the counts, and the REPORT.md path (≤20 lines).
