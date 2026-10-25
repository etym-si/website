#!/usr/bin/env python3
"""Pre-generate natural neural storytelling TTS audio (MP3) for all stories and character evolutions.

Uses Microsoft Edge / Azure Neural voices via `edge-tts`:
  - English:  en-US-AvaMultilingualNeural (expressive, warm, and pronounces embedded Chinese characters!)
  - Mandarin: zh-CN-XiaoxiaoNeural (warm storytelling voice)

Outputs:
  - public/tts/<lang>-<sha256[:12]>.mp3
  - src/data/tts-manifest.json  (maps exact UI strings in EN / 简 / 繁 to MP3 filenames)
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "tts"
MANIFEST = ROOT / "src" / "data" / "tts-manifest.json"

VOICE_EN = "en-US-AvaMultilingualNeural"
VOICE_ZH = "zh-CN-XiaoxiaoNeural"

# Parse Tri(en, zhs, zht) calls from TypeScript source files
TRI_RE = re.compile(
    r"""\b(?:m|T)\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*(['"])((?:\\.|(?!\3).)*)\3\s*,\s*(['"])((?:\\.|(?!\5).)*)\5\s*[,]?\s*\)""",
    re.DOTALL,
)


def unescape(s: str) -> str:
    return s.replace(r"\'", "'").replace(r"\"", '"').replace(r"\n", "\n")


def clean_en_for_tts(text: str) -> str:
    """Remove bare radical codepoints that already have an English gloss right beside them."""
    s = text
    for rad in ("艹", "氵", "虍", "宀", "犭", "厂", "口"):
        s = re.sub(rf"\s*{rad}\b", "", s)
    s = s.replace("—", ", ").replace("…", "... ")
    return re.sub(r"\s+", " ", s).strip()


def clean_zh_for_tts(text: str) -> str:
    """Clean radical symbols in Chinese storytelling text so the narrator reads them naturally."""
    s = text
    s = s.replace("草字头“艹”", "草字头").replace("“艹”", "草字头")
    s = s.replace("”虍", "”").replace("屋顶“宀”", "宝盖头")
    s = s.replace("反犬旁“犭”", "反犬旁").replace("山崖“厂”", "山崖厂字头").replace("“厂”", "厂字头")
    return s.strip()


def collect_items() -> tuple[dict[str, str], dict[str, str], list[tuple[str, str]]]:
    """Return (en_map, zh_map, zh_aliases) where maps are {raw_text: spoken_text}."""
    en_items: dict[str, str] = {}
    zh_items: dict[str, str] = {}
    zh_aliases: list[tuple[str, str]] = []  # (trad_raw, simp_raw) sharing the same Mandarin audio

    sources = [
        ROOT / "src" / "data" / "chars.ts",
        ROOT / "src" / "data" / "char-stories.ts",
        ROOT / "src" / "engine" / "scripts.ts",
    ]
    for src in sources:
        txt = src.read_text(encoding="utf-8")
        for match in TRI_RE.finditer(txt):
            en = unescape(match.group(2))
            zhs = unescape(match.group(4))
            zht = unescape(match.group(6))
            # Skip short 1-2 word glosses in chars.ts (`meaning` / `title` / `topic`) except when > 12 chars
            if len(en) < 12 and len(zhs) < 6:
                continue
            en_items[en] = clean_en_for_tts(en)
            zh_items[zhs] = clean_zh_for_tts(zhs)
            if zht != zhs:
                zh_aliases.append((zht, zhs))

    # Also add the simplified transition line for characters where trad != char, plus single-char pronunciations
    glyph_index = json.loads((ROOT / "public" / "glyphs" / "index.json").read_text(encoding="utf-8"))
    for entry in glyph_index:
        ch = entry["char"]
        tr = entry["trad"]
        zh_items[ch] = ch
        if tr != ch:
            zh_aliases.append((tr, ch))
            en_line = f"In modern simplified writing, {tr} is written {ch}."
            zhs_line = f"在现代简化字里，“{tr}”写作“{ch}”。"
            zht_line = f"在現代簡化字裡，「{tr}」寫作「{ch}」。"
            en_items[en_line] = en_line
            zh_items[zhs_line] = zhs_line
            zh_aliases.append((zht_line, zhs_line))

    return en_items, zh_items, zh_aliases


async def synth_one(sem: asyncio.Semaphore, voice: str, rate: str, spoken: str, out_path: Path) -> None:
    if out_path.exists() and out_path.stat().st_size > 200:
        return
    async with sem:
        for attempt in range(4):
            try:
                comm = edge_tts.Communicate(spoken, voice=voice, rate=rate)
                await comm.save(str(out_path))
                if out_path.exists() and out_path.stat().st_size > 200:
                    return
            except Exception as e:
                if attempt == 3:
                    print(f"! failed {spoken[:30]!r}: {e}", file=sys.stderr)
                await asyncio.sleep(1.5 * (attempt + 1))


async def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    en_items, zh_items, zh_aliases = collect_items()
    print(f"Collected {len(en_items)} English lines and {len(zh_items)} Mandarin lines (+ {len(zh_aliases)} traditional aliases)")

    sem = asyncio.Semaphore(10)
    tasks: list[asyncio.Task[None]] = []
    manifest: dict[str, dict[str, str]] = {"en": {}, "zh": {}}

    for raw, spoken in en_items.items():
        h = hashlib.sha256(f"en:{spoken}".encode("utf-8")).hexdigest()[:12]
        fname = f"en-{h}.mp3"
        manifest["en"][raw] = fname
        tasks.append(asyncio.create_task(synth_one(sem, VOICE_EN, "-4%", spoken, OUT_DIR / fname)))

    for raw, spoken in zh_items.items():
        h = hashlib.sha256(f"zh:{spoken}".encode("utf-8")).hexdigest()[:12]
        fname = f"zh-{h}.mp3"
        manifest["zh"][raw] = fname
        # Slightly slower rate for single-character pronunciation so kids hear the tone clearly
        rate = "-15%" if len(spoken) == 1 else "-6%"
        tasks.append(asyncio.create_task(synth_one(sem, VOICE_ZH, rate, spoken, OUT_DIR / fname)))

    for zht_raw, zhs_raw in zh_aliases:
        if zhs_raw in manifest["zh"]:
            manifest["zh"][zht_raw] = manifest["zh"][zhs_raw]

    await asyncio.gather(*tasks)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    mp3_count = len(list(OUT_DIR.glob("*.mp3")))
    print(f"Done! {mp3_count} MP3 files in {OUT_DIR}, manifest written to {MANIFEST}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
