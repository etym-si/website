#!/usr/bin/env python3
"""Candidate table for the han-500 selection (Python standard library only).

Reads, via the cached Wiktionary fetcher in research.py:
  - Appendix:HSK list of Mandarin words v3.0/characters  (HSK 3.0 = GF 0025-2021 character list)
  - Appendix:Mandarin Frequency lists/1-1000 … /9001-10000  (CKIP, Academia Sinica: top 10,000 words)

and writes ../candidates.tsv with, per simplified character: traditional form(s), HSK 3.0
pinyin + level, and a frequency proxy = the best CKIP rank of any top-10,000 word containing
the character. With --research DIR and --coverage FILE it also adds the Wiktionary liushu type
and the number of ancient stages found on Commons, which the selection uses.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from research import fetch_pages  # noqa: E402

BASE = Path(__file__).resolve().parent.parent
HSK = "Appendix:HSK list of Mandarin words v3.0/characters"
FREQ = [f"Appendix:Mandarin Frequency lists/{a}-{a + 999}" for a in range(1, 10000, 1000)]
FILM = "日山水林木鸟象草田竹马夫刀舟鱼网燕云雨伞石火龟鹿豕叟虎弓舍羊花门犬子女月"
LEVEL_ORDER = ["I-1", "I-2", "I-3", "II-4", "II-5", "II-6", "III"]


def hsk_rows(text: str) -> list[dict]:
    rows = []
    for m in re.finditer(r"^\|\{\{lang\|zh\|(.*?)\}\}\s*\|\|\s*\{\{lang\|zh\|(.*?)\}\}\s*\|\|\s*(.*?)\s*\|\|\s*(.*?)\s*\|\|(.*)$",
                         text, re.M):
        trad = re.findall(r"\[\[([^\]|]+)", m.group(1)) or [m.group(1)]
        rows.append({"s": m.group(2).strip(), "t": trad, "pinyin": m.group(3).strip(), "level": m.group(4).strip()})
    return rows


def freq_words(texts: list[str]) -> list[tuple[str, str]]:
    words = []
    for text in texts:
        for m in re.finditer(r"^\|([^|\n]+)\|([^|\n]+)\|", text, re.M):
            words.append((m.group(1).strip(), m.group(2).strip()))
    return words


def liushu_type(origin: str) -> str:
    """First liushu label in a flattened glyph origin (as written by research.py)."""
    o = origin.lower()
    hits = []
    for key, lab in (("pictogram", "pictogram"), ("ideogrammic compound", "compound-ideogram"),
                     ("ideogram (指事)", "ideogram"), ("ideogram", "ideogram"),
                     ("phono-semantic", "phono-semantic"), ("jiajie", "loan")):
        i = o.find(key)
        if i >= 0:
            hits.append((i, lab))
    if not hits:
        return "?"
    hits.sort()
    return hits[0][1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=BASE / "candidates.tsv")
    ap.add_argument("--research", type=Path)
    ap.add_argument("--coverage", type=Path)
    ap.add_argument("--extra", default="", help="extra simplified characters to include even if not in HSK I")
    ap.add_argument("--levels", default="I-1,I-2,I-3")
    ap.add_argument("--pool", type=Path, help="pool ids (人 or 后-後) used to name the research/coverage entries")
    a = ap.parse_args()
    pool_id = {}
    if a.pool:
        for x in a.pool.read_text(encoding="utf-8").split():
            pool_id[x.split("-")[0]] = x

    pages = fetch_pages([HSK] + FREQ)
    rows = hsk_rows(pages[HSK]["content"])
    words = freq_words([pages[t]["content"] for t in FREQ if not pages[t].get("missing")])
    best: dict[str, int] = {}
    for rank, (_t, s) in enumerate(words, 1):
        for ch in s:
            best.setdefault(ch, rank)

    table: dict[str, dict] = {}
    for r in rows:
        e = table.setdefault(r["s"], {"s": r["s"], "t": [], "pinyin": [], "level": r["level"]})
        for t in r["t"]:
            if t not in e["t"]:
                e["t"].append(t)
        if r["pinyin"] not in e["pinyin"]:
            e["pinyin"].append(r["pinyin"])
        if LEVEL_ORDER.index(r["level"]) < LEVEL_ORDER.index(e["level"]):
            e["level"] = r["level"]
    levels = set(a.levels.split(","))
    pool = [e for e in table.values() if e["level"] in levels]
    for ch in a.extra:
        if ch not in {e["s"] for e in pool}:
            pool.append(table.get(ch, {"s": ch, "t": [], "pinyin": [], "level": "-"}))

    cov = json.loads(a.coverage.read_text(encoding="utf-8")) if a.coverage else {}
    lines = ["s\tt\tpinyin\thsk\tckip_rank\tfilm\tliushu\tstages\tstage_list"]
    for e in sorted(pool, key=lambda e: (LEVEL_ORDER.index(e["level"]) if e["level"] in LEVEL_ORDER else 9,
                                         best.get(e["s"], 99999))):
        lt, st, sl = "", "", ""
        if a.research:
            p = a.research / f"{pool_id.get(e['s'], e['s'])}.json"
            if p.exists():
                lt = liushu_type(json.loads(p.read_text(encoding="utf-8")).get("glyph_origin", ""))
        if cov:
            c = cov.get(pool_id.get(e["s"], e["s"]))
            if c:
                st = str(c["count"])
                sl = ",".join(x["stage"] for x in c["stages"])
        lines.append("\t".join([e["s"], "、".join(e["t"]), "/".join(e["pinyin"]), e["level"],
                                str(best.get(e["s"], "")), "film" if e["s"] in FILM else "", lt, st, sl]))
    a.out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{len(pool)} candidates → {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
