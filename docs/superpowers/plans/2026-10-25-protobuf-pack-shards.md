# Protobuf & Multi-Member `.pack.gz` Shards + Dynamic `门` Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-item `.json` and `.mp3` files in `dist/data/` with ≤20 MiB RFC 1952 multi-member gzipped `.pack.gz` shards containing Protobuf-encoded bundles and MP3 voice sections, lazy-loaded in the browser via HTTP `Range` + `DecompressionStream('gzip')`, surfaced in a live Pack Inspector UI, and accompanied by a dynamic two-leaf door-opening animation for `门`.

**Architecture:** Compiler encodes `SignBundle`, `StoryBundle`, and `CollectionBundle` into proto3 wire format (`content/_schema/bundle.proto`, `demos/shared/proto-wire.ts`, `demos/shared/bundle-proto.ts`) and packs gzipped Protobuf slices (`level: 9, mtime: 0`) and gzipped MP3 voice sections (`level: 6, mtime: 0`) into ≤20 MiB `data/packs/pack-XX.<hash>.pack.gz` files (`demos/tools/compile/pack-shards.ts`). At runtime, `demos/src/pack-loader.ts` fetches only the requested `[start, length]` byte range (`Range: bytes=start-end`), decompresses it via `DecompressionStream('gzip')`, decodes the Protobuf or wraps the MP3 bytes in a `Blob` URL, and logs slice telemetry to the `📦 Pack Inspector` pill/modal (`demos/src/ui/pack-inspector.ts`).

**Tech Stack:** Node 24 (`node:zlib`, `node:crypto`, `node:test`), TypeScript 5.8, Vite 8, Playwright (`chromium-1234`), Web `DecompressionStream('gzip')`, Web Animations API (WAAPI).

**Spec:** `docs/superpowers/specs/2026-10-25-protobuf-pack-shards-design.md`

## Global Constraints

- **Node 24** with `--experimental-strip-types`; local relative TypeScript imports in `demos/shared/` and `demos/tools/` use `.ts` extensions.
- **Zero third-party runtime dependencies added**: Protobuf wire encoding/decoding uses `demos/shared/proto-wire.ts` + `demos/shared/bundle-proto.ts` matching `content/_schema/bundle.proto`; browser gzip decompression uses the built-in `DecompressionStream('gzip')`.
- **Cloudflare Pages budget**: `MAX_PACK_BYTES = 20 * 1024 * 1024` (20 MiB); `check-dist.ts` enforces `< 18,000` files, `< 24 MiB` per file, and zero Git LFS pointers.
- **Strict CSP & DOM safety**: Zero `innerHTML` / `outerHTML` / `eval`; no inline `style="..."` attributes in DOM templates; `/data/packs/*` served with `Content-Type: application/octet-stream`.
- **Never run `pkill` or `killall`**: A live LAN preview runs on port `3636` in `/home/kevin/etym-si/website`. Only stop servers via `.close()` or specific PID.

---

### Task 1: Sub-Part `pose` Step & Dynamic Two-Leaf Door (`门`) Animation

**Files:**
- Modify: `demos/shared/steps.ts`
- Modify: `demos/shared/bundle-check.ts`
- Modify: `demos/tools/compile/evolution.ts`
- Modify: `demos/src/engine/player.ts`
- Modify: `content/systems/han/signs/门.yaml`
- Modify: `content/collections/film-36/stories/06-home-under-the-crescent-moon.yaml`
- Modify: `demos/tests/parity/scripts.test.ts`
- Regenerate: `content/_schema/story.schema.json`

**Interfaces:**
- Produces:
  - `StepOf<'pose'>`: `{ do: 'pose'; actor: string; part: string; dx?: number; dy?: number; scaleX?: number; scaleY?: number; deg?: number; origin?: 'left' | 'right' | 'center' | 'top' | 'bottom'; ms?: number }`
  - `doorOpenSteps(actor: string, tree: SvgNode[]): Step[]` in `demos/tools/compile/evolution.ts`

- [ ] **Step 1: Add failing test for `门` picture + `pose` step in `demos/tests/parity/scripts.test.ts`**
  - Update `demos/tests/parity/scripts.test.ts` so the 35 unchanged `film-36` signs and stories 1–5 match the legacy golden snapshots, while `门` and `06-home-under-the-crescent-moon` assert the new `picture` and `pose` steps on `leaf-l` and `leaf-r`.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `node --test tests/parity/scripts.test.ts`
- [ ] **Step 3: Implement `pose` in `demos/shared/steps.ts`, `demos/shared/bundle-check.ts`, `demos/tools/compile/evolution.ts`, and `demos/src/engine/player.ts`, and add `门` gate picture & Story 6 door opening**
  - Add `pose` leaf schema to `demos/shared/steps.ts` and `checkStep` in `demos/shared/bundle-check.ts`.
  - In `demos/tools/compile/evolution.ts`, when a sign's `picture.svg` contains both `data-part="leaf-l"` and `data-part="leaf-r"`, insert a `together` step after the picture appears that swings `leaf-l` (`origin: 'left', scaleX: 0.32, dy: -6, ms: 900`) and `leaf-r` (`origin: 'right', scaleX: 0.32, dy: -6, ms: 900`) open.
  - In `demos/src/engine/player.ts`, handle `case 'pose':` by finding `a.pic.querySelector('[data-part="' + st.part + '"]')`, setting `transformBox = 'fill-box'` and `transformOrigin = st.origin ?? 'center'`, and animating `transform` with WAAPI.
  - Add `picture` with `data-part="leaf-l"` and `data-part="leaf-r"` to `content/systems/han/signs/门.yaml`, and add the door-opening `picture` + `pose` + `clearPicture` sequence for `gate` in `content/collections/film-36/stories/06-home-under-the-crescent-moon.yaml`.
  - Run `node tools/content/json-schema.ts` and `npm run tts` (if any new narration text was added; none needed if narration lines stay identical).
- [ ] **Step 4: Run tests and commit**
  - Run: `npm test && npm run check -- --strict`
  - Commit: `feat(anim): add sub-part pose step and swinging two-leaf door for 门`

---

### Task 2: Protocol Buffers Schema & Zero-Dependency Wire Codec

**Files:**
- Create: `content/_schema/bundle.proto`
- Create: `demos/shared/proto-wire.ts`
- Create: `demos/shared/bundle-proto.ts`
- Modify: `demos/shared/bundle-types.ts`
- Modify: `demos/shared/bundle-check.ts`
- Test: `demos/tests/unit/proto.test.ts`

**Interfaces:**
- Produces:
  - `ByteRange = [start: number, length: number]`
  - `PackMetaB = { file: string; bytes: number; rawBytes: number; items: number; kind: 'signs' | 'collections' }`
  - `encodeSignBundle(b: SignBundle): Uint8Array` / `decodeSignBundle(bytes: Uint8Array): SignBundle`
  - `encodeStoryBundle(b: StoryBundle): Uint8Array` / `decodeStoryBundle(bytes: Uint8Array): StoryBundle`
  - `encodeCollectionBundle(b: CollectionBundle): Uint8Array` / `decodeCollectionBundle(bytes: Uint8Array): CollectionBundle`

- [ ] **Step 1: Write failing unit tests in `demos/tests/unit/proto.test.ts`**
  - Test varint, sint32, float64, string, bytes, and nested message wire encoding/decoding in `proto-wire.ts`.
  - Test deterministic round-trip of `SignBundle` (with `picture`, `pose` step, `forms`, `strokes`, `cards`, `audio`), `StoryBundle`, and `CollectionBundle`, plus `checkSignBundle` / `checkStoryBundle` / `checkCollectionBundle` validation on decoded outputs.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `node --test tests/unit/proto.test.ts`
- [ ] **Step 3: Implement `content/_schema/bundle.proto`, `demos/shared/proto-wire.ts`, `demos/shared/bundle-proto.ts`, and update `bundle-types.ts` & `bundle-check.ts`**
- [ ] **Step 4: Run test to verify it passes and commit**
  - Run: `node --test tests/unit/proto.test.ts tests/unit/bundle-check.test.ts`
  - Commit: `feat(proto): add bundle.proto schema and zero-dependency proto3 wire codec`

---

### Task 3: Multi-Member `.pack.gz` Shard Compiler & Dist Budget

**Files:**
- Create: `demos/tools/compile/pack-shards.ts`
- Modify: `demos/tools/compile/site.ts`
- Modify: `demos/shared/csp.ts`
- Modify: `demos/tools/check-dist.ts`
- Modify: `demos/tests/unit/site.test.ts`
- Modify: `demos/tests/parity/catalog.test.ts`

**Interfaces:**
- Consumes: `encodeSignBundle`, `encodeStoryBundle`, `encodeCollectionBundle`, `decodeSignBundle`, `decodeStoryBundle`, `decodeCollectionBundle` from `demos/shared/bundle-proto.ts`.
- Produces:
  - `MAX_PACK_BYTES = 20 * 1024 * 1024`
  - `gunzipSlice(packBytes: Uint8Array, range: [number, number]): Uint8Array`
  - `data/packs/pack-XX.<hash>.pack.gz` in `CompiledSite.files` and `Catalog.packs`

- [ ] **Step 1: Update `demos/tests/unit/site.test.ts` and `demos/tests/parity/catalog.test.ts` to assert `.pack.gz` shard output**
  - Verify `site.files` contains `data/packs/pack-XX.<hash>.pack.gz` shards (each `≤ 20 MiB`), zero loose `data/signs/**` or `data/stories/**` or `data/collections/**` files, valid whole-file `gunzipSync`, valid per-slice `gunzipSlice` + Protobuf decode for all 502 signs, 6 stories, and 2 collections, and `/data/packs/*` headers with `Content-Type: application/octet-stream`.
- [ ] **Step 2: Run tests to verify they fail**
  - Run: `node --test tests/unit/site.test.ts tests/parity/catalog.test.ts`
- [ ] **Step 3: Implement `demos/tools/compile/pack-shards.ts` and update `site.ts`, `csp.ts`, and `check-dist.ts`**
- [ ] **Step 4: Run full unit & parity test suite and commit**
  - Run: `npm test`
  - Commit: `feat(compile): pack protobuf bundles and MP3 sections into <=20 MiB multi-member .pack.gz shards`

---

### Task 4: Browser `.pack.gz` Range Loader, DecompressionStream, & Live Pack Inspector UI

**Files:**
- Create: `demos/src/pack-loader.ts`
- Create: `demos/src/ui/pack-inspector.ts`
- Modify: `demos/src/content.ts`
- Modify: `demos/src/audio.ts`
- Modify: `demos/src/ui/common.ts`
- Modify: `demos/src/styles.css`
- Modify: `content/ui.yaml`
- Modify: `demos/tests/e2e/audio.test.ts`
- Modify: `demos/tests/e2e/egyptian.test.ts`
- Modify: `demos/tests/e2e/smoke.test.ts`

**Interfaces:**
- Consumes: `decodeSignBundle`, `decodeStoryBundle`, `decodeCollectionBundle`, `CATALOG.packs`
- Produces:
  - `fetchPackRange(opts: { file: string; range: [number, number]; label: string; kind: 'proto' | 'audio' }): Promise<Uint8Array>`
  - `packTelemetry` store & `packInspectorButton(): HTMLElement` in `topBar`

- [ ] **Step 1: Update E2E tests (`audio.test.ts`, `egyptian.test.ts`, `smoke.test.ts`) to assert `.pack.gz` range requests, Pack Inspector UI, and `门` door animation**
- [ ] **Step 2: Implement `demos/src/pack-loader.ts`, `demos/src/ui/pack-inspector.ts`, and update `content.ts`, `audio.ts`, `common.ts`, `styles.css`, and `content/ui.yaml`**
- [ ] **Step 3: Run `npm test && npm run build && npm run test:e2e`**
- [ ] **Step 4: Commit**
  - Commit: `feat(app): lazy-load .pack.gz byte ranges via DecompressionStream and add live Pack Inspector UI`
