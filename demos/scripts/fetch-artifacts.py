#!/usr/bin/env python3
"""Fetch photos of real artifacts (oracle bones, bronzes, bamboo slips, books) from Wikimedia Commons.

Only public-domain / CC0 / CC BY-SA images are used; licence + author are read from the Commons API
and written to src/data/artifact-credits.json so the app can show proper attribution.
Images are downscaled and re-encoded (metadata stripped) into public/artifacts/.
"""
from __future__ import annotations

import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "artifacts"
CREDITS = ROOT / "src" / "data" / "artifact-credits.json"
UA = "etym-si-demo/0.1 (https://github.com/etym-si/website; research prototype)"
API = "https://commons.wikimedia.org/w/api.php"
ALLOWED_HOSTS = {"upload.wikimedia.org", "thumb.wikimedia.org"}
ALLOWED_LICENSES = re.compile(r"^(Public domain|CC0|CC BY-SA [34]\.0|CC BY [34]\.0)$")

ARTIFACTS = {
    "heji6057": "File:Shang Inscribed Ox Scapula (for divination).jpg",
    "zheng-scapula": "File:Shang dynasty inscribed scapula.jpg",
    "yh127-plastron": "File:帶卜辭龜腹甲（丙86）.jpg",
    "dayu-ding": "File:Western Zhou bronze ding.jpg",
    "dayu-inscription": "File:Da Yu ding inscription.jpg",
    "hu-ding-rubbing": "File:周曶鼎铭文.jpg",
    "shuowen": "File:Shuowen Jiezi, by Xu Xuan.png",
    "qin-laws": "File:Eighteen Laws of Qin on Qin Bamboo Slips (10160622885).jpg",
    "qin-legal": "File:Qin Bamboo Slips Dealing with Legal Questions (10160525384).jpg",
    "qin-rishu": "File:Qin Rishu Bamboo Slips (10160493624).jpg",
    "qin-slips": "File:Qin Bamboo Slips (10160678273).jpg",
    "mawangdui": "File:Mawangdui LaoTsu Ms2.JPG",
    "zhiyong": "File:ZhiYong1000charcter.Color.jpg",
}


def http_get(url: str, data: bytes | None = None) -> bytes:
    delay = 15.0
    for i in range(5):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or i == 4:
                raise
            ra = e.headers.get("Retry-After", "")
            time.sleep(float(ra) if ra.isdigit() else delay)
            delay *= 2
    raise RuntimeError("unreachable")


def clean(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    params = {"action": "query", "prop": "imageinfo", "iiprop": "extmetadata|url", "iiurlwidth": "1000",
              "titles": "|".join(ARTIFACTS.values()), "format": "json", "formatversion": "2"}
    pages = {p["title"]: p for p in json.loads(http_get(API, urllib.parse.urlencode(params).encode()))["query"]["pages"]}
    credits: dict[str, dict] = {}
    for key, title in ARTIFACTS.items():
        p = pages.get(title) or pages.get(title.replace("_", " "))
        if not p or p.get("missing"):
            print(f"! missing {title}", file=sys.stderr)
            continue
        ii = p["imageinfo"][0]
        em = ii.get("extmetadata", {})
        lic = clean(em.get("LicenseShortName", {}).get("value", ""))
        if not ALLOWED_LICENSES.match(lic):
            print(f"! skipping {title}: licence {lic!r} not allowed", file=sys.stderr)
            continue
        url = ii.get("thumburl") or ii["url"]
        if urllib.parse.urlparse(url).hostname not in ALLOWED_HOSTS:
            print(f"! unexpected host for {title}", file=sys.stderr)
            continue
        target = OUT / f"{key}.jpg"
        if not target.exists():
            img = Image.open(io.BytesIO(http_get(url)))
            img = img.convert("RGB")
            img.thumbnail((900, 900), Image.LANCZOS)
            img.save(target, "JPEG", quality=80, optimize=True, progressive=True)  # re-encode: strips EXIF/XMP
            time.sleep(1.0)
        w, h = Image.open(target).size
        artist = clean(em.get("Artist", {}).get("value", ""))
        if not artist or artist.lower().startswith("unknown"):
            # many uploads put the photographer in "Credit" (e.g. "Gary Lee Todd 2011-09-01 … https://…")
            credit = clean(em.get("Credit", {}).get("value", ""))
            credit = re.sub(r"https?://\S+", "", credit)
            credit = re.sub(r"\b\d{4}-\d{2}-\d{2}.*$", "", credit).strip(" ,;")
            artist = credit if credit and credit.lower() not in ("own work",) else (artist or "unknown")
        artist = re.sub(r"(Unknown author)+", "Unknown author", artist)
        credits[key] = {
            "file": f"artifacts/{key}.jpg",
            "w": w, "h": h,
            "title": title.removeprefix("File:"),
            "license": lic,
            "author": artist[:140],
            "page": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
        }
        print(f"{key:18} {w}x{h}  {lic:14} {credits[key]['author'][:50]}")
    CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=1), encoding="utf-8")
    # keep the human-readable CREDITS.md in sync (replace our section, keep the glyph credits above it)
    md_path = ROOT / "CREDITS.md"
    md = md_path.read_text(encoding="utf-8") if md_path.exists() else "# Credits\n"
    md = md.split("\n## Artifact photos")[0].rstrip() + "\n\n## Artifact photos\n\n" + "\n".join(
        f"- `{c['title']}` — {c['author']} — {c['license']} — {c['page']}" for c in credits.values()) + "\n"
    md_path.write_text(md, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
