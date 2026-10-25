#!/usr/bin/env python3
"""Build-time glyph pipeline for the etym.si demos.

1. Downloads historical glyph SVGs (oracle bone, bronze, seal, clerical/slip/silk)
   from the Wikimedia Commons "Ancient Chinese characters project" (public domain).
2. Normalizes each SVG down to pure geometry: path data + transforms + fill mode.
   Everything else (scripts, metadata, styles, external refs) is discarded, so the
   app never injects third-party markup.
3. Copies regular-script stroke data (hanzi-writer-data, Arphic PL) for the
   simplified and traditional forms into public/hanzi/.

Output: public/glyphs/<char>.json, public/glyphs/index.json, CREDITS.md
"""
from __future__ import annotations

import json
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache" / "commons"
OUT_GLYPHS = ROOT / "public" / "glyphs"
OUT_HANZI = ROOT / "public" / "hanzi"
HANZI_DATA = ROOT / "node_modules" / "hanzi-writer-data"
UA = "etym-si-demo/0.1 (https://github.com/etym-si/website; research prototype)"
API = "https://commons.wikimedia.org/w/api.php"
SVG_NS = "{http://www.w3.org/2000/svg}"

# simplified -> traditional (only where they differ)
TRAD = {"鸟": "鳥", "马": "馬", "鱼": "魚", "网": "網", "云": "雲", "伞": "傘", "龟": "龜", "门": "門"}

# The 36 characters of 《三十六个字》 in order of appearance.
FILM_ORDER = list("日山水林木鸟象草田竹马夫刀舟鱼网燕云雨伞石火龟鹿豕叟虎弓舍羊花门犬子女月")

# Per-character historical stage plan: list of (stage, lookup form, [variant candidates]).
# Default plan: oracle, bronze, seal, clerical, each looked up on the traditional form.
DEFAULT_PLAN = [
    ("oracle", None, ["oracle"]),
    ("bronze", None, ["bronze", "bronze-shang"]),
    ("seal", None, ["seal"]),
    ("clerical", None, ["clerical-han", "clerical", "slip", "silk"]),
]
OVERRIDES: dict[str, list[tuple[str, str, list[str]]]] = {
    # 云 cloud: the original pictograph 云 got 雨 (rain) added → 雲; simplification went back to 云.
    "云": [("oracle", "云", ["oracle"]), ("seal", "雲", ["seal"])],
    # 网 net: Shuowen head form is 网 itself; 網 (with 糸 + 亡) came later.
    "网": [("oracle", "网", ["oracle"]), ("bronze", "网", ["bronze", "bronze-shang"]),
           ("seal", "网", ["seal"]), ("clerical", "网", ["clerical", "slip", "silk"])],
    # 草 grass: first written as sprouts 艸; 早 was added later as a sound hint.
    "草": [("seal", "艸", ["seal"]), ("seal", "草", ["seal"])],
    # 花 flower: originally written 華 (a blooming plant); 花 is a much later character.
    "花": [("bronze", "華", ["bronze"]), ("seal", "華", ["seal"])],
    # 伞 umbrella and 叟 old man: no ancient forms available on Commons.
    "伞": [],
    "叟": [],
}


def http_get(url: str, data: bytes | None = None, attempts: int = 5) -> bytes:
    """GET/POST politely: on HTTP 429/503 honor Retry-After (or back off exponentially)."""
    delay = 15.0
    for i in range(attempts):
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
        time.sleep(0.3)
    return found


def fetch_svg(title: str, url: str) -> str:
    CACHE.mkdir(parents=True, exist_ok=True)
    fname = CACHE / (title.split(":", 1)[1])
    if not fname.exists():
        # Only accept files hosted on Wikimedia's upload server.
        host = urllib.parse.urlparse(url).hostname or ""
        if host != "upload.wikimedia.org":
            raise ValueError(f"unexpected host for {title}: {host}")
        fname.write_bytes(http_get(url))
        time.sleep(1.0)  # stay well under Wikimedia's bot rate limits
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


def main() -> int:
    OUT_GLYPHS.mkdir(parents=True, exist_ok=True)
    OUT_HANZI.mkdir(parents=True, exist_ok=True)

    plans: dict[str, list[tuple[str, str, list[str]]]] = {}
    for ch in FILM_ORDER:
        trad = TRAD.get(ch, ch)
        plans[ch] = OVERRIDES.get(ch, [(s, trad, v) for (s, _f, v) in DEFAULT_PLAN])

    wanted = sorted({f"File:{form}-{v}.svg" for plan in plans.values() for (_s, form, vs) in plan for v in vs})
    print(f"querying {len(wanted)} candidate titles on Commons…")
    idx = commons_index(wanted)
    print(f"  {len(idx)} exist")

    credits: list[str] = []
    index: list[dict] = []
    for ch in FILM_ORDER:
        trad = TRAD.get(ch, ch)
        stages: list[dict] = []
        for stage, form, variants in plans[ch]:
            title = next((f"File:{form}-{v}.svg" for v in variants if f"File:{form}-{v}.svg" in idx), None)
            if not title:
                continue
            try:
                geo = normalize_svg(fetch_svg(title, idx[title]))
            except Exception as e:  # keep going; report
                print(f"  ! {title}: {e}", file=sys.stderr)
                continue
            variant = title.split("-", 1)[1].rsplit(".", 1)[0]
            stages.append({"stage": stage, "form": form, "variant": variant,
                           "src": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
                           **geo})
            credits.append(f"- `{title}` — public domain — https://commons.wikimedia.org/wiki/{urllib.parse.quote(title)}")
        # regular-script stroke data (traditional + simplified)
        hz = []
        for c in dict.fromkeys([trad, ch]):
            src = HANZI_DATA / f"{c}.json"
            if src.exists():
                shutil.copyfile(src, OUT_HANZI / f"{c}.json")
                hz.append(c)
            else:
                print(f"  ! no hanzi-writer data for {c}", file=sys.stderr)
        doc = {"char": ch, "trad": trad, "stages": stages, "hanzi": hz}
        (OUT_GLYPHS / f"{ch}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index.append({"char": ch, "trad": trad, "stages": [s["stage"] + ":" + s["variant"] for s in stages], "hanzi": hz})
        print(f"{ch} ({trad}): {', '.join(s['stage'] + '/' + s['variant'] for s in stages) or '—'} | hanzi: {''.join(hz)}")

    (OUT_GLYPHS / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    license_src = HANZI_DATA / "ARPHICPL.TXT"
    if license_src.exists():
        shutil.copyfile(license_src, OUT_HANZI / "ARPHICPL.TXT")
    (ROOT / "CREDITS.md").write_text(
        "# Credits\n\n"
        "## Historical glyphs\n\nFrom the Wikimedia Commons *Ancient Chinese characters project*, "
        "released into the **public domain** (sources: Sinica database, Chinese Etymology, et al.).\n\n"
        + "\n".join(credits) +
        "\n\n## Regular-script stroke data\n\n[hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) "
        "(derived from Make Me a Hanzi / Arphic fonts) — Arphic Public License, see `public/hanzi/ARPHICPL.TXT`.\n\n"
        "## Animation reference\n\nTechniques inspired by 《三十六个字》 (Shanghai Animation Film Studio, 1984, dir. A Da). "
        "No frames or drawings from the film are used.\n",
        encoding="utf-8")
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
