# etym.si content

Everything the app teaches lives here as YAML: one file per sign, artifact, source, story and collection. The compiler
in `demos/tools/` checks it and turns it into the static API the app plays (`npm run build`). Narration audio lives
next door in `media/` (Git LFS). Nothing in `demos/src/` holds content any more.

```text
content/
├─ config.yaml                    # locales + fallbacks, narration voices, published collections, file budget
├─ ui.yaml                        # every UI string, per locale
├─ _schema/*.schema.json          # generated JSON Schemas (editor autocomplete); npm run schema
├─ systems/<system>/
│  ├─ system.yaml                 # stages, reading schemes, sign-id rule, pronunciation voice, ingest adapters
│  └─ signs/<id>.yaml             # everything about one sign
├─ artifacts/<id>.yaml + <id>.jpg # real objects (bones, bronzes, slips, books) with their photo and credit
├─ sources/<id>.yaml              # catalogues and texts that glyph provenance points to (Heji, Shuowen, 千字文 …)
└─ collections/<id>/
   ├─ collection.yaml             # units (signs, colour, optional story and lessons)
   └─ stories/NN-<id>.yaml        # scene scripts, in unit order
media/
├─ manifest.json                  # every narration clip ever recorded (plain git)
└─ clips/<sha256>.mp3             # the clips (Git LFS): run `git lfs pull` after cloning
```

Keys and ids:

- A sign is `<system>/<id>`, e.g. `han/马`. A han id is the simplified form; when one simplified form covers two
  characters, the id names both (`后-後`, `发-髮`). File names equal ids.
- Collections, artifacts, sources and stories use lowercase slugs (`film-36`, `heji6057`, `casting-the-net`); lesson
  ids are `<collection>/u<unit>-<lesson>` (`film-36/u1-l1`).
- Every text a reader sees is a localized map: `{ en: …, zh-Hans: …, zh-Hant: … }`. `en` is required; missing
  translations fall back (`zh-Hant → zh-Hans → en`) and are reported.

## The files

Files start with `# yaml-language-server: $schema=…` (`npm run new` adds it), so editors with the YAML language server
autocomplete and check them. The schemas are strict: unknown keys are errors, colours are `#rrggbb`, numbers are ranged and strings capped.

- **Sign** (`systems/han/signs/马.yaml`): `id`, `status` (`draft` | `reviewed`), `text` per script (`Hans`, `Hant`),
  `readings` (`pinyin`), `meaning`, `fact`, optional `origin` (type + parts), `sources` (https links), `story` (topic,
  hook, optional rotate/early/turn, closer: the Evolution Theater's beats), `picture` (rotate, ambient, `svg`),
  `journey` (`default`, `[]`, or `[{ stage, form, variants }]`) and optional per-stage `cards` overrides. The `forms:`
  section at the end is generated: it is the Commons glyph geometry for each journey stage.
- **Picture SVGs** are drawn by hand and sanitized at build time against an allowlist: shapes, presentation attributes,
  `class` (the animation hooks in `demos/src/pictures.css`) and `data-part` on groups. No `style`, `href`, `<use>`,
  `<image>`, `<foreignObject>`, event handlers or `url()`.
- **Artifact** (`artifacts/dayu-inscription.yaml`): the object's title, `aliases` (provenance notes that name it),
  `image: { file, commons }`, `occurrences` (where a sign is circled on the photo, with mark boxes in 0–1 units) and
  card `templates`. The `credit:` section at the end is generated.
- **Source** (`sources/heji.yaml`): how a provenance note is recognized (`match`, `entries`), the card templates it
  produces (`book`, `example`, `quote`) and, for texts like the 千字文, its `lines`.
- **Story** (`collections/film-36/stories/03-casting-the-net.yaml`): `cast` and a `script` in the step vocabulary of
  `demos/shared/steps.ts` (`narrate`, `place`, `draw`, `tagSay`, `move`, `wash`, …).
- **Collection**: `units` of signs. Lessons default to chunks of two new signs, a review and, when the unit has a story,
  a story node; list `lessons:` to override. A sign may sit in several collections, but in at most one unit of each.

Card texts are templates: `{sign}` (the sign in the system's first script), `{note}`, `{part}`, `{phrase}`,
`{tracedFrom}` and the source's own variables are filled in at build time, and any unknown placeholder fails the build.
Only `{shown}` is left for the app, which fills in the sign in the reader's script (简/繁).

## Commands (run in `demos/`)

| Command | What it does | Network |
|---|---|---|
| `npm run check` | validate everything: schemas, cross-references, assets, translations; `-- --strict` turns warnings into errors | no |
| `npm run content` | validate and compile into `public/data/`, `public/_headers`, `public/CREDITS.md`, `src/generated/` | no |
| `npm run build` | `content --strict`, type checks, Vite, file budget and LFS-pointer guard → `dist/` | no |
| `npm run new -- han 鹤` | create `systems/han/signs/鹤.yaml` with every required field, empty | no |
| `npm run ingest:glyphs -- han/鹤` | fill the sign's `forms:` from Wikimedia Commons; no arguments: every sign without `forms:`; `--all` refreshes | Wikimedia |
| `npm run ingest:photos -- <artifact>` | download the photo and write its `credit:`; no arguments: every artifact missing either | Wikimedia |
| `npm run tts` | record only the narration lines that have no clip yet (`-- --dry-run` lists them) | edge-tts |
| `npm run schema` | regenerate `content/_schema/*.schema.json` after changing `tools/content/schema.ts` | no |

The build never touches the network and needs no secrets; only the three ingest commands do, and only talk to their
allowlisted hosts. Commit what they write (`content/`, `media/`).

## Extending

**Add a sign** (content only):

1. `npm run new -- han 鹤` creates `content/systems/han/signs/鹤.yaml`.
2. Fill in `text.Hant`, `readings`, `meaning`, `fact` and `story` in all three locales (or have an AI agent draft them;
   keep `status: draft` until a person has checked every claim against its `sources`).
3. `npm run ingest:glyphs -- han/鹤` fills in `forms:`. If Commons lacks a stage, the tool says so: with
   `journey: default` the stage is simply skipped; with an explicit journey, remove the entry or give it another `form`.
4. Optional: paste a `picture.svg`; add the sign to a unit of a collection, or cast it in a story.
5. `npm run tts` records only the new lines.
6. `npm run check -- --strict`, then push: CI tests, builds and deploys.

**Add a writing system** (e.g. Egyptian; `demos/tests/fixtures/content-egyptian/` is a working one-sign example):

1. Write `systems/<id>/system.yaml`: its stages (`kind: paths` for drawn forms), the sign-id rule (Gardiner codes:
   `'^[A-Z]{1,2}[0-9]{1,3}[a-z]?$'`), the reading scheme (`translit`), the pronunciation voice, and a self-hosted font if
   signs are shown as text.
2. Add a glyph ingest adapter for its source: a job-list builder next to `demos/tools/ingest/glyphs.ts`, a network
   adapter in `demos/scripts/`, and its name in the `ingest.glyphs` enum of `demos/tools/content/schema.ts`.
3. Add signs and a collection, and list the collection in `config.yaml`. The engine, player and screens don't change:
   hieroglyph forms are drawn exactly like oracle-bone forms.

**Add a UI language** (e.g. Spanish):

1. Add it to `config.yaml`: `{ id: es, lang: es, section: es, fallback: en }`, and a narration voice for the `es`
   section under `narration` and `voices`.
2. Translate `ui.yaml` and the content strings. `npm run check` prints what is missing and the build fills gaps from the
   fallback until they are translated; `npm run tts` then records the Spanish narration. Each voice is a byte section of
   the same per-sign MP3, so the number of deployed files does not grow.

## Validation and errors

Every problem is reported against its YAML node, errors first:

```text
content/systems/han/signs/马.yaml:14:5 story.hook.zh-Hant: missing translation (falls back to zh-Hans)
content/collections/film-36/collection.yaml:31:15 units[4].signs[2]: unknown sign han/鹤
content/artifacts/heji6057.yaml:8:3 image: credit section missing (run npm run ingest:photos -- heji6057)
```

The checks: strict schemas; every referenced sign, stage, artifact, source and story exists; a sign appears at most
once per collection; story glyph selectors point to real forms and actors are placed before they act; mark boxes stay
within 0–1; ids match file names; pictures pass the sanitizer; photos are present and credited; journey stages have
forms; narration coverage (a warning, an error with `--strict`); Git LFS pointers that were never fetched.

## Audio

A clip is one line spoken by one voice, stored as `media/clips/<key>.mp3` where `key = sha256(provider|voice|rate|text)`
and `text` is the line after the voice's `normalize` rules from `config.yaml`. Once a key is in `media/manifest.json` the
line is never recorded again; changing a voice, rate or provider changes the keys, so each line is re-recorded once.
The build packs each sign's, story's and collection's clips into one MP3 with one byte section per narration language.

## Golden snapshots

`demos/tests/golden/` holds what the pre-migration app produced (recorded before any content moved). The parity tests
(`demos/tests/parity/`, `demos/tests/unit/golden.test.ts`, `demos/tests/e2e/picture.test.ts`) prove that the YAML
compiles to exactly that, apart from the planned renames. They freeze the film-36 corpus. When you change that content
on purpose (or what the compiler makes of it), retire them in the same commit:

```bash
git rm -r demos/tests/golden demos/tests/parity demos/tests/unit/golden.test.ts demos/tests/e2e/picture.test.ts
```

From then on the YAML is the only source of truth; the unit tests and the end-to-end smoke test keep guarding the
compiler and the app.
