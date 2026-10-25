#!/usr/bin/env python3
"""Accuracy audit for writer drafts (stdlib only): flags claims that the research may not support.

For every draft (or --slice N / --ids …) it reports:
  - CJK characters used in English text or in origin.parts that appear neither in the sign itself
    nor in its research extract (often a sign of an invented component);
  - script stages named in the text (oracle/bronze/seal/clerical, 甲骨/金文/篆/隶) that
    glyph coverage does not have;
  - origin.type that doesn't match the liushu wording of the research;
  - early/turn present although the research is a one-line phono-semantic formula.
Flags are prompts for human review, not errors.

Usage: audit.py [--slice N] [--ids 人,口] [--coverage FILE]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
CJK = re.compile(r"[\u3400-\u9fff\U00020000-\U0003134f]")
STAGE_WORDS = {
    "oracle": [r"\boracle", "甲骨"],
    "bronze": [r"\bbronze", "金文", "青铜", "青銅", "铜器", "銅器"],
    "seal": [r"\bseal", "篆"],
    "clerical": [r"\bclerical", "隶书", "隸書"],
}
TYPE_WORDS = {
    "pictogram": ["pictogram", "象形"],
    "ideogram": ["ideogram (指事)", "指事"],
    "compound-ideogram": ["ideogrammic", "會意", "compound of", "duplication", "triplication"],
    "phono-semantic": ["phono-semantic", "形聲", "phonetic"],
    "loan": ["borrow", "jiajie", "假借", "loan"],
    "uncertain": ["unclear", "uncertain", "theor", "possibly", "perhaps", "interpret", "disput", "unknown"],
}


def texts(d: dict):
    yield "fact", d.get("fact", {})
    for k, v in (d.get("story") or {}).items():
        yield f"story.{k}", v


def audit(d: dict, r: dict, cov: dict | None) -> list[str]:
    flags = []
    research_text = " ".join([r.get("glyph_origin", ""), r.get("s_page_origin", ""), " ".join(r.get("shuowen", [])),
                              json.dumps(r.get("forms", {}), ensure_ascii=False)])
    allowed = set(CJK.findall(research_text)) | set(d["id"].replace("-", "")) | {r.get("s", ""), r.get("t", "")}
    for key, tri in texts(d):
        extra = sorted(set(CJK.findall(tri.get("en", ""))) - allowed)
        if extra:
            flags.append(f"{key}.en mentions {''.join(extra)} (not in research)")
    for p in (d.get("origin") or {}).get("parts", []) or []:
        if p.get("char") and not set(CJK.findall(p["char"])) <= allowed:
            flags.append(f"origin part {p['char']} not in research")
    if cov is not None:
        have = {s["stage"] for s in cov.get("stages", [])}
        for key, tri in texts(d):
            blob = " ".join(tri.values()).lower()
            for stage, pats in STAGE_WORDS.items():
                if stage not in have and any(re.search(p, blob) for p in pats):
                    flags.append(f"{key} names the {stage} stage, which coverage lacks")
    t = (d.get("origin") or {}).get("type")
    low = research_text.lower()
    if t in TYPE_WORDS and not any(w.lower() in low for w in TYPE_WORDS[t]):
        flags.append(f"origin.type {t}: research never says {TYPE_WORDS[t][0]!r}")
    go = r.get("glyph_origin", "")
    if re.fullmatch(r"Phono-semantic compound \(形聲\): [^.]*\.?", go.strip()) and any(
            k in (d.get("story") or {}) for k in ("early", "turn")) and not r.get("s_page_origin"):
        flags.append("early/turn written although the research is only a phono-semantic formula")
    return flags


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slice", type=int)
    ap.add_argument("--ids", default="")
    ap.add_argument("--coverage", type=Path, default=BASE / "glyph-coverage.json")
    a = ap.parse_args()
    cov_all = json.loads(a.coverage.read_text(encoding="utf-8")) if a.coverage.exists() else {}
    if a.slice:
        ids = (BASE / ".cache" / "packets" / f"slice-{a.slice}.ids").read_text(encoding="utf-8").split()
    elif a.ids:
        ids = a.ids.split(",")
    else:
        ids = sorted(p.stem for p in (BASE / "drafts").glob("*.json"))
    n_flag = 0
    for sid in ids:
        p = BASE / "drafts" / f"{sid}.json"
        if not p.exists():
            continue
        d = json.loads(p.read_text(encoding="utf-8"))
        r = json.loads((BASE / "research" / f"{sid}.json").read_text(encoding="utf-8"))
        flags = audit(d, r, cov_all.get(sid) if cov_all else None)
        if flags:
            n_flag += 1
            print(f"{sid}: " + " | ".join(flags))
    print(f"-- {n_flag} draft(s) flagged of {len(ids)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
