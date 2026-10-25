#!/usr/bin/env python3
"""Bundle what each writer needs into .cache/packets/slice-<n>.json (stdlib only).

Per sign: selection data (pinyin, sense, unit), the journey value to copy into the draft,
the ancient stages Commons has (from glyph-coverage.json, or a provisional coverage file),
and the research extract (research/<id>.json, verbatim).

Usage: make_packets.py [--coverage FILE] [--slices 6]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from selection import load_selection, selected_signs  # noqa: E402

BASE = Path(__file__).resolve().parent.parent
OUT = BASE / ".cache" / "packets"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--coverage", type=Path, default=BASE / "glyph-coverage.json")
    ap.add_argument("--slices", type=int, default=6)
    a = ap.parse_args()
    sel = load_selection(BASE / "selection.yaml")
    signs = {s["id"]: s for s in selected_signs(BASE / "selection.yaml")}
    cov = json.loads(a.coverage.read_text(encoding="utf-8"))
    units = sel["units"]
    new_per_unit = [[x for x in u["signs"] if x in signs] for u in units]
    total = sum(len(x) for x in new_per_unit)
    target = total / a.slices
    # contiguous runs of whole units, balanced by number of new signs
    slices: list[list[int]] = [[]]
    count = 0
    for i, ids in enumerate(new_per_unit):
        if count >= target * len(slices) - len(ids) / 2 and len(slices) < a.slices and slices[-1]:
            slices.append([])
        slices[-1].append(i)
        count += len(ids)
    OUT.mkdir(parents=True, exist_ok=True)
    for k, unit_idx in enumerate(slices, 1):
        items = []
        for i in unit_idx:
            u = units[i]
            for sid in new_per_unit[i]:
                s = signs[sid]
                c = cov[sid]
                research = json.loads((BASE / "research" / f"{sid}.json").read_text(encoding="utf-8"))
                items.append({
                    "id": sid, "simplified": s["s"], "traditional": s["t"], "pinyin": s["pinyin"],
                    "sense": s.get("sense", ""), "hsk": s["hsk"],
                    "unit": {"n": u["n"], "title": u["title"]["en"], "signs": u["signs"]},
                    "journey": c["journey"],
                    "ancient_stages": [f"{x['stage']} ({x['form']})" for x in c["stages"]],
                    "research": research,
                })
        doc = {"slice": k, "units": [units[i]["n"] for i in unit_idx], "count": len(items), "signs": items}
        (OUT / f"slice-{k}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        (OUT / f"slice-{k}.ids").write_text("\n".join(x["id"] for x in items) + "\n", encoding="utf-8")
        print(f"slice {k}: units {unit_idx[0] + 1}–{unit_idx[-1] + 1}, {len(items)} signs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
