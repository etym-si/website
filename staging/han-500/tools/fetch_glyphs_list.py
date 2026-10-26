#!/usr/bin/env python3
"""Glyph pipeline for the han-500 expansion, adapted from demos/scripts/fetch-glyphs.py.

Differences from the original (everything else, in particular the SVG normalization and the
{{ACClicense}} provenance parsing, is unchanged):
  - the character list comes from ../selection.yaml (or --pool / --chars) instead of the
    hard-coded FILM_ORDER / TRAD / OVERRIDES; a sign may carry an optional "journey" override:
    [] = no ancient forms, or [{"stage": "seal", "form": "雲"}, …] (variants default per stage);
  - output goes to ../glyphs/<id>.json (exactly the demos/public/glyphs/<char>.json format)
    plus ../glyph-coverage.json (stages found per sign); downloads are cached in ../.cache/;
  - hanzi stroke data is NOT copied: "hanzi" only lists the forms that hanzi-writer-data has;
  - politeness: <= 1 request/second, User-Agent etym-si-content/0.1;
  - --index-only only checks which Commons files exist (used while choosing the selection).

1. Downloads historical glyph SVGs (oracle bone, bronze, seal, clerical/slip/silk)
   from the Wikimedia Commons "Ancient Chinese characters project" (public domain).
2. Normalizes each SVG down to pure geometry: path data + transforms + fill mode.
   Everything else (scripts, metadata, styles, external refs) is discarded, so the
   app never injects third-party markup.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from selection import ID_RE, selected_signs  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent          # staging/han-500
CACHE = ROOT / ".cache" / "commons"
OUT_GLYPHS = ROOT / "glyphs"
COVERAGE = ROOT / "glyph-coverage.json"
HANZI_DATA = ROOT / "tools" / "node_modules" / "hanzi-writer-data"
UA = "etym-si-content/0.1 (https://github.com/etym-si/website)"
API = "https://commons.wikimedia.org/w/api.php"
ALLOWED_HOSTS = {"commons.wikimedia.org", "upload.wikimedia.org"}
SVG_NS = "{http://www.w3.org/2000/svg}"
MIN_INTERVAL = 1.05  # seconds between any two requests (<= 1 request/second)

# Per-character historical stage plan: list of (stage, lookup form, [variant candidates]).
# Default plan: oracle, bronze, seal, clerical, each looked up on the traditional form.
DEFAULT_PLAN = [
    ("oracle", None, ["oracle"]),
    ("bronze", None, ["bronze", "bronze-shang"]),
    ("seal", None, ["seal"]),
    ("clerical", None, ["clerical-han", "clerical", "slip", "silk"]),
]
STAGE_VARIANTS = {s: v for (s, _f, v) in DEFAULT_PLAN}

_last = 0.0


def http_get(url: str, data: bytes | None = None, attempts: int = 5) -> bytes:
    """GET/POST politely: on HTTP 429/503 honor Retry-After (or back off exponentially)."""
    global _last
    host = urllib.parse.urlparse(url).hostname or ""
    if host not in ALLOWED_HOSTS:
        raise ValueError(f"host not allowed: {host}")
    delay = 15.0
    for i in range(attempts):
        pause = MIN_INTERVAL - (time.monotonic() - _last)
        if pause > 0:
            time.sleep(pause)
        _last = time.monotonic()
        req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or i == attempts - 1:
                raise
            retry_after = e.headers.get("Retry-After", "")
            wait = float(retry_after) if retry_after.isdigit() else delay
            print(f"  … rate limited ({e.code}), waiting {wait:.0f}s", file=sys.stderr)
            time.sleep(wait)
            delay *= 2
    raise RuntimeError("unreachable")


def commons_index(titles: list[str]) -> dict[str, str]:
    """Return {title: original file url} for titles that exist."""
    found: dict[str, str] = {}
    for i in range(0, len(titles), 50):
        params = {"action": "query", "titles": "|".join(titles[i:i + 50]), "prop": "imageinfo",
                  "iiprop": "url", "format": "json", "formatversion": "2"}
        d = json.loads(http_get(API, urllib.parse.urlencode(params).encode()))
        for p in d["query"]["pages"]:
            if not p.get("missing") and p.get("imageinfo"):
                found[p["title"]] = p["imageinfo"][0]["url"]
        if (i // 50) % 10 == 9:
            print(f"  … {i + 50}/{len(titles)} titles checked", file=sys.stderr)
    return found


PROV_SAFE = re.compile(r"[^\w\s.,;:()（）\-·'’]", re.UNICODE)


def commons_provenance(titles: list[str]) -> dict[str, dict]:
    """Read each file's {{ACClicense|char|script|period|code|source note|...}} template.
    The source note names the artifact the glyph was traced from (e.g. 合5216, 大盂鼎, 睡.秦4)."""
    out: dict[str, dict] = {}
    for i in range(0, len(titles), 50):
        params = {"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
                  "titles": "|".join(titles[i:i + 50]), "format": "json", "formatversion": "2"}
        d = json.loads(http_get(API, urllib.parse.urlencode(params).encode()))
        for p in d["query"]["pages"]:
            txt = (p.get("revisions") or [{}])[0].get("slots", {}).get("main", {}).get("content", "")
            m = re.search(r"\{\{ACClicense\|(.*?)\}\}", txt, re.S)
            pos = [x.strip() for x in m.group(1).split("|") if "=" not in x] if m else []
            get = lambda k: pos[k] if len(pos) > k else ""
            note = PROV_SAFE.sub("", get(4))[:120]
            if "http" in get(4) or "ignore" in note.lower() or note.isdigit():
                note = ""  # URLs / editor remarks / bare radical numbers aren't provenance
            code = get(3) if re.fullmatch(r"[A-Za-z]\d{4,5}", get(3)) else ""
            out[p["title"]] = {"period": PROV_SAFE.sub("", get(2))[:20], "code": code, "note": note}
    return out


def fetch_svg(title: str, url: str) -> str:
    CACHE.mkdir(parents=True, exist_ok=True)
    fname = CACHE / (title.split(":", 1)[1])
    if fname.resolve().parent != CACHE.resolve():
        raise ValueError(f"unsafe cache name for {title}")
    if not fname.exists():
        # Only accept files hosted on Wikimedia's upload server.
        host = urllib.parse.urlparse(url).hostname or ""
        if host != "upload.wikimedia.org":
            raise ValueError(f"unexpected host for {title}: {host}")
        fname.write_bytes(http_get(url))
    return fname.read_text(encoding="utf-8", errors="replace")


NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")
SAFE_D = re.compile(r"^[MmLlHhVvCcSsQqTtAaZz0-9eE\s,.+\-]*$")
SAFE_T = re.compile(r"^[a-zA-Z0-9\s,.()+\-]*$")


def parse_len(v: str | None) -> float | None:
    if not v:
        return None
    m = NUM.match(v.strip())
    return float(m.group(0)) if m else None


def style_map(el: ET.Element) -> dict[str, str]:
    out: dict[str, str] = {}
    for part in (el.get("style") or "").split(";"):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip()] = v.strip()
    for k in ("fill", "stroke", "stroke-width", "fill-rule"):
        if el.get(k) is not None:
            out.setdefault(k, el.get(k))
    return out


def shape_to_d(el: ET.Element) -> str | None:
    tag = el.tag.replace(SVG_NS, "")
    if tag == "path":
        return el.get("d")
    if tag in ("polygon", "polyline"):
        pts = NUM.findall(el.get("points") or "")
        if len(pts) < 4:
            return None
        pairs = [f"{pts[i]},{pts[i + 1]}" for i in range(0, len(pts) - 1, 2)]
        return "M" + " L".join(pairs) + (" Z" if tag == "polygon" else "")
    if tag == "rect":
        x, y = parse_len(el.get("x")) or 0, parse_len(el.get("y")) or 0
        w, h = parse_len(el.get("width")) or 0, parse_len(el.get("height")) or 0
        return f"M{x},{y} h{w} v{h} h{-w} Z" if w and h else None
    if tag in ("circle", "ellipse"):
        cx, cy = parse_len(el.get("cx")) or 0, parse_len(el.get("cy")) or 0
        rx = parse_len(el.get("r") or el.get("rx")) or 0
        ry = parse_len(el.get("r") or el.get("ry")) or 0
        if not rx or not ry:
            return None
        return (f"M{cx - rx},{cy} a{rx},{ry} 0 1,0 {2 * rx},0 a{rx},{ry} 0 1,0 {-2 * rx},0 Z")
    return None


def normalize_svg(text: str) -> dict:
    root = ET.fromstring(text.encode("utf-8"))  # no DTD/entity expansion in ElementTree
    vb = root.get("viewBox")
    if vb:
        box = [float(x) for x in NUM.findall(vb)][:4]
    else:
        box = [0.0, 0.0, parse_len(root.get("width")) or 300.0, parse_len(root.get("height")) or 300.0]
    paths: list[dict] = []

    def walk(el: ET.Element, transforms: list[str], inherited: dict[str, str]) -> None:
        tag = el.tag.replace(SVG_NS, "")
        if tag in ("metadata", "defs", "title", "desc", "clipPath", "mask", "style", "script") or ":" in tag:
            return
        if not el.tag.startswith(SVG_NS):
            return
        st = {**inherited, **style_map(el)}
        t = el.get("transform")
        tlist = transforms + ([t] if t else [])
        d = shape_to_d(el)
        if d:
            d = " ".join(d.split())
            tt = " ".join(tlist)
            if not SAFE_D.match(d) or not SAFE_T.match(tt):
                raise ValueError("unexpected characters in path/transform")
            fill = st.get("fill", "#000")
            stroke = st.get("stroke", "none")
            item: dict = {"d": d}
            if tt:
                item["t"] = tt
            if fill == "none" and stroke not in ("none", ""):
                item["mode"] = "stroke"
                item["w"] = parse_len(st.get("stroke-width")) or 1.0
            elif fill in ("#fff", "#ffffff", "white"):
                item["mode"] = "knockout"  # white shapes punched over black ones
            if st.get("fill-rule") == "evenodd":
                item["rule"] = "evenodd"
            paths.append(item)
        for child in el:
            walk(child, tlist, st)

    walk(root, [], {})
    if not paths:
        raise ValueError("no drawable paths")
    return {"box": box, "paths": paths}


def plan_for(sign: dict) -> tuple[str, list[tuple[str, str, list[str]]]]:
    """('default' | 'override', [(stage, form, variants)]) for one selected sign."""
    trad = sign["t"]
    if "journey" not in sign:
        return "default", [(s, trad, v) for (s, _f, v) in DEFAULT_PLAN]
    plan = []
    for j in sign["journey"]:
        stage, form = j["stage"], j["form"]
        if stage not in STAGE_VARIANTS or not ID_RE.match(form):
            raise ValueError(f"{sign['id']}: bad journey entry {j}")
        plan.append((stage, form, list(j.get("variants") or STAGE_VARIANTS[stage])))
    return "override", plan


def load_signs(a: argparse.Namespace) -> list[dict]:
    if a.chars or a.pool:
        ids = list(a.chars) if a.chars else a.pool.read_text(encoding="utf-8").split()
        signs = []
        for x in ids:
            x = x.strip()
            p = x.split("\t")
            sid = p[0]
            if not ID_RE.match(sid):
                raise SystemExit(f"bad id {sid!r}")
            s, _, t = sid.partition("-")
            signs.append({"id": sid, "s": s, "t": t or s})
        return signs
    return selected_signs(a.selection)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--selection", type=Path, default=ROOT / "selection.yaml")
    ap.add_argument("--pool", type=Path, help="file with one id per line (s-t for a different traditional form)")
    ap.add_argument("--chars", default="")
    ap.add_argument("--index-only", action="store_true", help="only check which Commons files exist")
    ap.add_argument("--coverage", type=Path, default=COVERAGE)
    a = ap.parse_args()

    signs = load_signs(a)
    plans: dict[str, tuple[str, list[tuple[str, str, list[str]]]]] = {s["id"]: plan_for(s) for s in signs}

    wanted = sorted({f"File:{form}-{v}.svg" for (_k, plan) in plans.values() for (_s, form, vs) in plan for v in vs})
    print(f"querying {len(wanted)} candidate titles on Commons…")
    idx = commons_index(wanted)
    print(f"  {len(idx)} exist")
    prov: dict[str, dict] = {}
    if not a.index_only:
        prov = commons_provenance(sorted(idx))
        print(f"  provenance read for {len(prov)} files")
        OUT_GLYPHS.mkdir(parents=True, exist_ok=True)

    coverage: dict[str, dict] = {}
    for sign in signs:
        sid, ch, trad = sign["id"], sign["s"], sign["t"]
        kind, plan = plans[sid]
        stages: list[dict] = []
        for stage, form, variants in plan:
            title = next((f"File:{form}-{v}.svg" for v in variants if f"File:{form}-{v}.svg" in idx), None)
            if not title:
                continue
            variant = title.split("-", 1)[1].rsplit(".", 1)[0]
            if a.index_only:
                stages.append({"stage": stage, "form": form, "variant": variant})
                continue
            try:
                geo = normalize_svg(fetch_svg(title, idx[title]))
            except Exception as e:  # keep going; report
                print(f"  ! {title}: {e}", file=sys.stderr)
                continue
            stages.append({"stage": stage, "form": form, "variant": variant,
                           "src": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
                           "prov": prov.get(title, {"period": "", "code": "", "note": ""}),
                           **geo})
        if a.index_only:
            hz: list[str] = []
        else:
            # regular-script stroke data (traditional + simplified): listed, never copied
            hz = []
            for c in dict.fromkeys([trad, ch]):
                if (HANZI_DATA / f"{c}.json").exists():
                    hz.append(c)
                else:
                    print(f"  ! no hanzi-writer data for {c}", file=sys.stderr)
            doc = {"char": ch, "trad": trad, "stages": stages, "hanzi": hz}
            out = (OUT_GLYPHS / f"{sid}.json").resolve()
            if out.parent != OUT_GLYPHS.resolve():
                raise SystemExit(f"refusing to write outside {OUT_GLYPHS}: {out}")
            out.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        found = [{"stage": s["stage"], "form": s["form"], "variant": s["variant"]} for s in stages]
        if kind == "default":
            journey: object = "default" if found else []
        else:
            journey = [{"stage": f["stage"], "form": f["form"]} for f in found]
        coverage[sid] = {"char": ch, "trad": trad, "plan": kind, "count": len(found), "stages": found,
                         "journey": journey, "hanzi": hz}
        print(f"{sid} ({trad}): {', '.join(s['stage'] + '/' + s['form'] + ':' + s['variant'] for s in found) or '—'}"
              + ("" if a.index_only else f" | hanzi: {''.join(hz)}"))

    a.coverage.write_text(json.dumps(coverage, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"done: {len(coverage)} signs, coverage → {a.coverage}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
