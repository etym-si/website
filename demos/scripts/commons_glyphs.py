#!/usr/bin/env python3
"""Commons glyph adapter for `npm run ingest:glyphs` (demos/tools/ingest/glyphs.ts).

Downloads historical glyph SVGs (oracle bone, bronze, seal, clerical/slip/silk) from the Wikimedia Commons
"Ancient Chinese characters project" (public domain) and normalizes each SVG down to pure geometry: path data +
transforms + fill mode. Everything else (scripts, metadata, styles, external refs) is discarded, so no third-party
markup ever reaches content/. Node builds the job list from content and validates the results again.

  python3 scripts/commons_glyphs.py <jobs.json> <results.json>
  python3 scripts/commons_glyphs.py --selftest        (no network)

jobs.json:    {"jobs": [{"id": "han/马#0", "candidates": [{"variant": "oracle", "title": "File:馬-oracle.svg"}]}]}
results.json: {"results": [{"id", "variant", "title", "provenance": {"period", "code", "note"}, "box", "paths"}
                           or {"id", "error"}]}

Only commons.wikimedia.org (API) and upload.wikimedia.org (files) are contacted.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache" / "commons"
UA = "etym-si-demo/0.1 (https://github.com/etym-si/website; research prototype)"
API = "https://commons.wikimedia.org/w/api.php"
ALLOWED_HOSTS = {"commons.wikimedia.org", "upload.wikimedia.org"}
SVG_NS = "{http://www.w3.org/2000/svg}"
TITLE = re.compile(r"^File:[^|#<>\[\]{}\n/\\]{1,200}\.svg$")  # no path separators: titles become cache file names


def http_get(url: str, data: bytes | None = None, attempts: int = 5) -> bytes:
    """GET/POST politely: on HTTP 429/503 honor Retry-After (or back off exponentially)."""
    parts = urllib.parse.urlparse(url)
    if parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"refusing to fetch {url}: host is not allowlisted")
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
        time.sleep(0.5)
    return out


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


def run(jobs: list[dict]) -> list[dict]:
    for job in jobs:
        for c in job["candidates"]:
            if not TITLE.match(c["title"]):
                raise ValueError(f"bad Commons title in job {job['id']}: {c['title']!r}")
    wanted = sorted({c["title"] for job in jobs for c in job["candidates"]})
    print(f"querying {len(wanted)} candidate titles on Commons…")
    idx = commons_index(wanted) if wanted else {}
    print(f"  {len(idx)} exist")
    prov = commons_provenance(sorted(idx)) if idx else {}
    results: list[dict] = []
    for job in jobs:
        hit = next((c for c in job["candidates"] if c["title"] in idx), None)
        if not hit:
            results.append({"id": job["id"], "error": "no Commons file"})
            continue
        try:
            geo = normalize_svg(fetch_svg(hit["title"], idx[hit["title"]]))
        except Exception as e:  # keep going; report
            results.append({"id": job["id"], "error": f"{hit['title']}: {e}"})
            continue
        results.append({"id": job["id"], "variant": hit["variant"], "title": hit["title"],
                        "provenance": prov.get(hit["title"], {"period": "", "code": "", "note": ""}), **geo})
    return results


SELFTEST_SVG = """<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 300 300">
  <metadata><x>ignored</x></metadata>
  <script>alert(1)</script>
  <g transform="translate(10,20)" style="fill:#000">
    <path d="M0 0   L10 0 L10 10 Z"/>
    <rect x="1" y="2" width="3" height="4" fill="#fff"/>
    <polyline points="0,0 5,5 10,0" fill="none" stroke="#000" stroke-width="2"/>
    <image xlink:href="https://example.org/x.png" width="10" height="10"/>
  </g>
</svg>"""


def selftest() -> int:
    got = normalize_svg(SELFTEST_SVG)
    want = {"box": [0.0, 0.0, 300.0, 300.0], "paths": [
        {"d": "M0 0 L10 0 L10 10 Z", "t": "translate(10,20)"},
        {"d": "M1.0,2.0 h3.0 v4.0 h-3.0 Z", "t": "translate(10,20)", "mode": "knockout"},
        {"d": "M0,0 L5,5 L10,0", "t": "translate(10,20)", "mode": "stroke", "w": 2.0},
    ]}
    assert got == want, got
    for bad in ('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L1 1 url(#x)"/></svg>',
                '<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>'):
        try:
            normalize_svg(bad)
        except ValueError:
            continue
        raise AssertionError(f"accepted {bad}")
    for url in ("http://upload.wikimedia.org/x.svg", "https://example.org/x.svg"):
        try:
            http_get(url)
        except ValueError:
            continue
        raise AssertionError(f"fetched {url}")
    assert TITLE.match("File:馬-oracle.svg") and not TITLE.match("File:../x.svg") and not TITLE.match("File:a|b.svg")
    print("commons_glyphs selftest: ok")
    return 0


def main(argv: list[str]) -> int:
    if argv[1:] == ["--selftest"]:
        return selftest()
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    jobs = json.loads(Path(argv[1]).read_text(encoding="utf-8"))["jobs"]
    results = run(jobs)
    Path(argv[2]).write_text(json.dumps({"results": results}, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
