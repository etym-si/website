# Protobuf & Multi-Member `.pack.gz` Shards + Dynamic `门` Animation — Design Spec

**Date:** 2026-10-25  
**Status:** Approved  
**Builds on:** `docs/superpowers/specs/2026-10-25-content-foundation-design.md`

---

## 1. Goals

1. **Protobuf Binary Data Storage (`proto3`)**:
   - Encode compiled `SignBundle`, `StoryBundle`, and `CollectionBundle` payloads in Protocol Buffers (`syntax = "proto3";`) defined by [`content/_schema/bundle.proto`](../../../content/_schema/bundle.proto).
   - Provide a deterministic, zero-dependency TypeScript proto3 wire codec (`demos/shared/proto-wire.ts` and `demos/shared/bundle-proto.ts`) shared by the Node compiler and the browser runtime, eliminating JSON key/punctuation overhead (~65% smaller before compression, ~83% smaller after gzip).
2. **Batched ≤20 MiB Multi-Member `.pack.gz` Shards**:
   - Batch signs, stories, and collections (both their Protobuf metadata and their per-voice MP3 audio sections) into content-addressed `data/packs/pack-XX.<hash>.pack.gz` shard files capped at **`20 MiB`** (`20,971,520` bytes), maximizing Cloudflare Pages' `25 MiB` per-file limit (`check-dist.ts` enforces `< 24 MiB`).
   - Collapse `dist/data/` for the 502-sign corpus from `1,020` per-item files down to **6 `.pack.gz` shard files** (plus 13 artifact photos), so even 10,000+ signs across Chinese, Egyptian, and Mayan require only ~120 files (<0.7% of Cloudflare Pages' 20,000-file limit).
3. **RFC 1952 Multi-Member Gzip + Browser `Range` Lazy Loading**:
   - Per RFC 1952 §2.2, a valid `.gz` file consists of one or more independent gzip members (`1f 8b 08 ...`) concatenated back-to-back.
   - Each Protobuf record (`gzipSync(pbBytes, { level: 9 })`) and each voice MP3 section (`gzipSync(mp3Bytes, { level: 6 })`) is written as its own standalone gzip member inside `pack-XX.<hash>.pack.gz`.
   - Consequently:
     - Every `pack-XX.<hash>.pack.gz` file is a 100% valid `.gz` file as a whole (`gunzip` / `zlib.gunzipSync` decompresses the entire shard).
     - Every `[start, length]` byte slice inside `pack-XX.<hash>.pack.gz` is ALSO a standalone valid `.gz` stream.
     - When the user opens the app, **zero `.pack.gz` shards are downloaded upfront**. When a character, story, or collection is requested, the browser fetches only its `[start, length]` byte range (`Range: bytes=start-end`) and pipes it through the built-in Web `DecompressionStream('gzip')` API.
4. **Live Pack & Lazy-Load Inspector in the Demo UI**:
   - Add a live **`📦 Pack Inspector`** pill in the top bar (e.g. `📦 4 slices · 148 KB / 101.4 MB (0.1%)`) that opens an interactive inspector dialog showing:
     - All `.pack.gz` shards in `CATALOG.packs` with their compressed vs raw sizes, item counts, and visual byte-range coverage bars.
     - Every lazy-loaded `Range` request made during the session (item key, shard file, `[start..end]` byte range, gzip wire bytes → decompressed Protobuf/MP3 bytes, duration in `ms`, and cache status).
5. **Dynamic Two-Leaf Door (`门`) Animation**:
   - Add a custom `300×300` courtyard gate illustration (`picture.svg`) to `content/systems/han/signs/门.yaml` with two hinged wooden door leaves (`<g data-part="leaf-l">` and `<g data-part="leaf-r">`).
   - Add a `pose` animation step (`{ do: 'pose', actor, part, scaleX?, dx?, dy?, rotate?, ms? }`) to `Step` (`demos/shared/steps.ts`), `bundle.proto`, `evolution.ts`, and `Player` (`demos/src/engine/player.ts`) so both door leaves of `门` swing open in Evolution Theater (`#/theater/han/门`) and Story 6 (`#/story/film-36/home-under-the-crescent-moon`).

---

## 2. Protocol Buffers Schema (`content/_schema/bundle.proto`)

`content/_schema/bundle.proto` defines the canonical wire format for `SignBundle`, `StoryBundle`, and `CollectionBundle`:

- **Wire primitives (`demos/shared/proto-wire.ts`)**:
  - Standard proto3 wire types: `0` (varint: `uint32`, `int32`, `sint32`, `bool`, `enum`), `1` (64-bit `double`), `2` (length-delimited UTF-8 `string`, `bytes`, nested messages, packed repeated scalars).
  - Deterministic encoding: map entries and object keys are sorted lexicographically before serialization so identical inputs produce byte-for-byte identical Protobuf outputs and content hashes.
- **Step encoding (`StepProto`)**:
  - Encodes every `Step` variant (`place`, `picture`, `rotate`, `pose`, `draw`, `show`, `swap`, `clearPicture`, `wash`, `move`, `ambient`, `fade`, `scale`, `remove`, `bg`, `stage`, `caption`, `tag`, `say`, `wait`, `together`).
- **SVG tree encoding (`SvgNodeProto`)**:
  - Recursive message `SvgNodeProto { string tag = 1; map<string, string> attrs = 2; repeated SvgNodeProto children = 3; }`.
- **Runtime Defense-in-Depth**:
  - After `DecompressionStream('gzip')` and Protobuf decoding (`decodeSignBundle`, `decodeStoryBundle`, `decodeCollectionBundle`), every decoded object still passes through `checkSignBundle`, `checkStoryBundle`, or `checkCollectionBundle` (`demos/shared/bundle-check.ts`) before reaching the UI or DOM.

---

## 3. Multi-Member `.pack.gz` Shards & Shard Packing (`demos/tools/compile/pack-shards.ts`)

### 3.1 Shard Constants & Layout
- `MAX_PACK_BYTES = 20 * 1024 * 1024` (`20 MiB`).
- Each shard is written to `data/packs/pack-XX.<hash>.pack.gz` where `XX` is a zero-padded 2-digit index (`00`, `01`, …) and `<hash>` is the first 10 hex characters of the SHA-256 of the shard's uncompressed payload sequence.
- Every slice appended to a shard is compressed with `zlib.gzipSync(rawBytes, { level, mtime: 0 })` (`mtime: 0` in the gzip header guarantees 100% deterministic, reproducible builds across machines and timestamps).

### 3.2 Two-Tier Shard Ordering (Zero Circular References)
1. **Sign Shards (`pack-00` … `pack-(K-1)`)**:
   - Signs are ordered deterministically by their first appearance in published collections (`collection → unit → sign`).
   - For each sign:
     - Its packed audio sections (`en`, `zh`, …) are compressed as individual gzip members (`level: 6`, `mtime: 0`).
     - Its `SignBundle` (with `audio.mp3` pointing to its shard file and `audio.sections[id] = [start, gzLength]`) is encoded to Protobuf and compressed as a gzip member (`level: 9`, `mtime: 0`).
     - If adding the sign's gzip members (audio + Protobuf) to the current shard would exceed `MAX_PACK_BYTES`, the current shard is finalized and a new shard is started.
   - Because each sign shard's `10`-char content hash is computed over the raw `(signBundleWithoutPackHash + rawAudioSections)` of the signs assigned to that shard, `packRel = "data/packs/pack-XX.<hash>.pack.gz"` is known before emitting the final `SignBundle` Protobuf gzip members.
   - Result: every sign now has a final `{ file: packRel, range: [start, length] }`.
2. **Stories & Collections Shard (`pack-K`)**:
   - Stories and collections are packed into the final shard(s) using the same deterministic hash pre-computation:
     - First, each story's audio sections (gzipped) and `StoryBundle` Protobuf (gzipped) are placed, yielding `{ file: packRel, range: [start, length] }` for each story.
     - Second, each `CollectionBundle` (referencing the already-finalized `{ file, range }` of its signs and stories) has its pronunciation audio sections (gzipped) and `CollectionBundle` Protobuf (gzipped) appended.

### 3.3 Updated Reference Types (`demos/shared/bundle-types.ts`)
- `ByteRange = [start: number, length: number]`
- `SignSummary`: adds `range: ByteRange` alongside `file: string`.
- `StoryRefB`: adds `range: ByteRange` alongside `file: string`.
- `Catalog.collections[i]`: adds `range: ByteRange` alongside `file: string`.
- `PackMetaB`: `{ file: string; bytes: number; rawBytes: number; items: number; kind: 'signs' | 'collections' }`
- `Catalog`: adds `packs: PackMetaB[]`.
- `AudioIndex`: unchanged shape (`{ mp3: string; sections: Record<string, [start: number, length: number]>; clips: ... }`), where `mp3` is the `.pack.gz` path and `sections[id]` is the `[start, length]` of that voice's gzipped MP3 member inside the `.pack.gz` file.

### 3.4 HTTP Headers (`demos/shared/csp.ts`)
- In `public/_headers`:
  - `/data/*` keeps `Cache-Control: public, max-age=31536000, immutable` and `X-Content-Type-Options: nosniff`.
  - `/data/packs/*` explicitly sets `Content-Type: application/octet-stream` so static hosts and CDNs serve raw byte ranges (`206 Partial Content`) without transparent content-encoding transformations.

---

## 4. Browser Lazy-Loading & Pack Telemetry (`demos/src/pack-loader.ts`)

### 4.1 Range Fetching & Native Decompression
- `fetchPackRange(meta: { file: string; range: [number, number]; label: string; kind: 'proto' | 'audio' }): Promise<{ gzBytes: Uint8Array; rawBytes: Uint8Array; status: number; ms: number }>`:
  - Requests `fetch(base + file, { headers: { Range: 'bytes=' + start + '-' + (start + length - 1) }, credentials: 'same-origin' })`.
  - If the server returns `200 OK` instead of `206 Partial Content`, slices `bytes.slice(start, start + length)`.
  - Verifies `gzBytes.length === length`.
  - Decompresses `gzBytes` via `new Response(new Blob([gzBytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()` (with a guard checking gzip magic bytes `0x1f 0x8b` so uncompressed test mocks also work seamlessly).
  - Records a telemetry event in `PackTelemetry` for the UI inspector.

### 4.2 Content & Audio Loaders (`demos/src/content.ts`, `demos/src/audio.ts`)
- `loadCollection(id)`: calls `fetchPackRange` with `ref.file` and `ref.range`, decodes with `decodeCollectionBundle(rawBytes)`, validates with `checkCollectionBundle`.
- `loadSign(summary)`: calls `fetchPackRange` with `summary.file` and `summary.range`, decodes with `decodeSignBundle(rawBytes)`, validates with `checkSignBundle`.
- `loadStory(ref)`: calls `fetchPackRange` with `ref.file` and `ref.range`, decodes with `decodeStoryBundle(rawBytes)`, validates with `checkStoryBundle`.
- `fetchSection(index, id)` in `demos/src/audio.ts`: calls `fetchPackRange` with `index.mp3` and `index.sections[id]` (`kind: 'audio'`), receives the decompressed `rawBytes` (verified CBR MP3 frames), and wraps them in `URL.createObjectURL(new Blob([rawBytes], { type: 'audio/mpeg' }))`.

### 4.3 Live Pack Inspector UI (`demos/src/ui/pack-inspector.ts`)
- Top-bar button `.pack-pill` (rendered by `topBar` in `demos/src/ui/common.ts`):
  - Displays live counters: `📦 <N> slices · <fetched KB> / <total MB> (<pct>%)`.
  - Clicking opens a modal dialog (`.pack-dialog`) with:
    1. **Summary Banner**: Total shards (`6`), total `.pack.gz` size on server (`~101 MiB`), total bytes lazy-loaded so far (`KB`), and compression savings (`Protobuf + gzip`).
    2. **Shard Map (`CATALOG.packs`)**: Each `pack-XX.<hash>.pack.gz` file (~20 MiB cap), item count, compressed vs uncompressed size, and a visual SVG bar highlighting the exact `[start..end]` byte slices fetched in this session.
    3. **Lazy-Load Slice Log**: Reverse-chronological table of every `Range` request (`kind`, `label`, `file`, `bytes=start-end`, `gzip → raw` sizes, HTTP status `206`, latency `ms`).

---

## 5. Dynamic Two-Leaf Door (`门`) Animation

### 5.1 Gate Illustration (`content/systems/han/signs/门.yaml`)
- Adds `picture` (`rotate: 0`) with a `300×300` courtyard gate SVG:
  - Stone threshold and timber lintel beam at top (`y=36..58`) + left and right timber posts (`x=44..58`, `x=242..256`).
  - Left door leaf `<g data-part="leaf-l">`: wooden frame and lattice panels spanning `x=58..148, y=58..252` with a brass ring knocker at `(130, 155)`.
  - Right door leaf `<g data-part="leaf-r">`: wooden frame and lattice panels spanning `x=152..242, y=58..252` with a brass ring knocker at `(170, 155)`.

### 5.2 Sub-Part `pose` Step (`demos/shared/steps.ts`, `demos/src/engine/player.ts`)
- Step schema:
  ```ts
  z.strictObject({
    do: z.literal('pose'),
    actor: Actor,
    part: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
    dx: Offset.optional(),
    dy: Offset.optional(),
    scaleX: z.number().min(0.05).max(5).optional(),
    scaleY: z.number().min(0.05).max(5).optional(),
    deg: z.number().min(-360).max(360).optional(),
    origin: z.enum(['left', 'right', 'center', 'top', 'bottom']).optional(),
    ms: Ms.optional(),
  })
  ```
- In `Player.exec`:
  - Finds `a.pic.querySelector('[data-part="' + st.part + '"]')` (validated against `/^[a-z][a-z0-9-]{0,31}$/`).
  - Sets `transformBox = 'fill-box'` and `transformOrigin = st.origin ?? 'center'`.
  - Animates from its current pose transform to `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY}) rotate(${deg}deg)` over `st.ms ?? 800` ms using WAAPI.
- Usage in `门` Evolution & Story 6:
  - In `evolution.ts`: when a sign has `picture` whose tree contains `data-part="leaf-l"` and `data-part="leaf-r"`, after showing the picture, the script runs a `together` step swinging `leaf-l` (`origin: 'left', scaleX: 0.32, dy: -6`) and `leaf-r` (`origin: 'right', scaleX: 0.32, dy: -6`) open before drawing the first historical glyph (`oracle` / `bronze`).
  - In `content/collections/film-36/stories/06-home-under-the-crescent-moon.yaml`: the `gate` actor (`门`) first shows its `picture` (`门`), swings both door leaves open (`pose` on `leaf-l` and `leaf-r`) as the puppy (`犬`) trots out to greet the family, and then morphs into the bronze glyph `門`!
