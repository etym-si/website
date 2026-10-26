#!/usr/bin/env python3
"""Commons photo adapter for `npm run ingest:photos` (demos/tools/ingest/photos.ts).

Fetches photos of real artifacts (oracle bones, bronzes, bamboo slips, books) from Wikimedia Commons.
Only public-domain / CC0 / CC BY / CC BY-SA images are used; licence + author are read from the Commons API
and returned, and Node writes them into the artifact's `credit:` section so the app can show proper attribution.
Images are downscaled and re-encoded (metadata stripped).

  python3 scripts/commons_photos.py <jobs.json> <results.json>
  python3 scripts/commons_photos.py --selftest        (no network, no Pillow)

jobs.json:    {"dir": "/abs/content/artifacts", "jobs": [{"id": "heji6057", "title": "File:….jpg", "file": "heji6057.jpg",
               "refresh": false}]}
results.json: {"results": [{"id", "author", "license", "page", "width", "height"} or {"id", "error"}]}

Only commons.wikimedia.org (API) and upload.wikimedia.org / thumb.wikimedia.org (images) are contacted.
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

UA = "etym-si-demo/0.1 (https://github.com/etym-si/website; research prototype)"
API = "https://commons.wikimedia.org/w/api.php"
IMAGE_HOSTS = {"upload.wikimedia.org", "thumb.wikimedia.org"}
ALLOWED_HOSTS = {"commons.wikimedia.org"} | IMAGE_HOSTS
ALLOWED_LICENSES = re.compile(r"^(Public domain|CC0|CC BY-SA [34]\.0|CC BY [34]\.0)$")
FILE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}\.(jpg|png)$")  # the artifact schema's image.file rule


def http_get(url: str, data: bytes | None = None) -> bytes:
    parts = urllib.parse.urlparse(url)
    if parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"refusing to fetch {url}: host is not allowlisted")
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


def credit_from(title: str, em: dict) -> dict | str:
    """Licence, author and page from a file's extmetadata; an error string when the licence is not allowed."""
    lic = clean(em.get("LicenseShortName", {}).get("value", ""))
    if not ALLOWED_LICENSES.match(lic):
        return f"licence {lic!r} not allowed"
    artist = clean(em.get("Artist", {}).get("value", ""))
    if not artist or artist.lower().startswith("unknown"):
        # many uploads put the photographer in "Credit" (e.g. "Gary Lee Todd 2011-09-01 … https://…")
        credit = clean(em.get("Credit", {}).get("value", ""))
        credit = re.sub(r"https?://\S+", "", credit)
        credit = re.sub(r"\b\d{4}-\d{2}-\d{2}.*$", "", credit).strip(" ,;")
        artist = credit if credit and credit.lower() not in ("own work",) else (artist or "unknown")
    artist = re.sub(r"(Unknown author)+", "Unknown author", artist)
    return {"license": lic, "author": artist[:140],
            "page": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))}


def save_photo(data: bytes, target: Path) -> None:
    from PIL import Image  # imported here so --selftest runs without Pillow

    img = Image.open(io.BytesIO(data))
    img = img.convert("RGB")
    img.thumbnail((900, 900), Image.LANCZOS)
    tmp = target.with_name(target.name + ".part")
    if target.suffix == ".png":
        img.save(tmp, "PNG", optimize=True)
    else:
        img.save(tmp, "JPEG", quality=80, optimize=True, progressive=True)  # re-encode: strips EXIF/XMP
    tmp.replace(target)


def image_size(target: Path) -> tuple[int, int]:
    from PIL import Image

    with Image.open(target) as img:
        return img.size


def run(folder: Path, jobs: list[dict]) -> list[dict]:
    for job in jobs:
        if not FILE.match(job["file"]) or not job["title"].startswith("File:"):
            raise ValueError(f"bad job {job!r}")
    params = {"action": "query", "prop": "imageinfo", "iiprop": "extmetadata|url", "iiurlwidth": "1000",
              "titles": "|".join(j["title"] for j in jobs), "format": "json", "formatversion": "2"}
    pages = {p["title"]: p for p in json.loads(http_get(API, urllib.parse.urlencode(params).encode()))["query"]["pages"]}
    results: list[dict] = []
    for job in jobs:
        title = job["title"]
        p = pages.get(title) or pages.get(title.replace("_", " "))
        if not p or p.get("missing"):
            results.append({"id": job["id"], "error": f"missing {title}"})
            continue
        ii = p["imageinfo"][0]
        credit = credit_from(title, ii.get("extmetadata", {}))
        if isinstance(credit, str):
            results.append({"id": job["id"], "error": credit})
            continue
        url = ii.get("thumburl") or ii["url"]
        if urllib.parse.urlparse(url).hostname not in IMAGE_HOSTS:
            results.append({"id": job["id"], "error": f"unexpected host for {title}"})
            continue
        target = folder / job["file"]
        if job.get("refresh") or not target.exists():
            save_photo(http_get(url), target)
            time.sleep(1.0)
        w, h = image_size(target)
        results.append({"id": job["id"], **credit, "width": w, "height": h})
        print(f"{job['id']:18} {w}x{h}  {credit['license']:14} {credit['author'][:50]}")
    return results


def selftest() -> int:
    title = "File:Shang Inscribed Ox Scapula (for divination).jpg"
    em = {"LicenseShortName": {"value": "Public domain"}, "Artist": {"value": "<span>Unknown author</span>"},
          "Credit": {"value": 'Gary Lee Todd 2011-09-01 <a href="https://example.org">site</a>'}}
    assert credit_from(title, em) == {
        "license": "Public domain", "author": "Gary Lee Todd",
        "page": "https://commons.wikimedia.org/wiki/File%3AShang_Inscribed_Ox_Scapula_%28for_divination%29.jpg"}, credit_from(title, em)
    assert credit_from(title, {"LicenseShortName": {"value": "CC BY-NC 2.0"}}) == "licence 'CC BY-NC 2.0' not allowed"
    assert credit_from(title, {"LicenseShortName": {"value": "CC0"}})["author"] == "unknown"
    assert FILE.match("heji6057.jpg") and not FILE.match("../x.jpg") and not FILE.match("x.svg")
    for url in ("http://upload.wikimedia.org/x.jpg", "https://example.org/x.jpg"):
        try:
            http_get(url)
        except ValueError:
            continue
        raise AssertionError(f"fetched {url}")
    print("commons_photos selftest: ok")
    return 0


def main(argv: list[str]) -> int:
    if argv[1:] == ["--selftest"]:
        return selftest()
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    spec = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    results = run(Path(spec["dir"]), spec["jobs"]) if spec["jobs"] else []
    Path(argv[2]).write_text(json.dumps({"results": results}, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
