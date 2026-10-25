#!/usr/bin/env python3
"""Scripted Wiktionary research for the han-500 expansion (Python standard library only).

For every selected new character this fetches the en.wiktionary wikitext of the simplified
and the traditional page and writes a compact extract (about 2 KB) to research/<id>.json:

  - forms from {{zh-forms|s=…|t=…}}
  - Mandarin readings from {{zh-pron|m=…}} (first reading first)
  - the "Glyph origin" text under ==Chinese==, templates flattened to readable text
  - Shuowen quotes / Shuowen remarks
  - the first few English senses
  - source URLs (+ revision ids)

Raw pages are cached under .cache/wikt/ (git-ignored) and are never committed; writers read
only the extracts.

Usage:
  research.py                          # all signs in ../selection.yaml -> ../research/
  research.py --chars 人口目 --out DIR  # ad-hoc (used to explore the candidate pool)
  research.py --pool FILE --out DIR    # one id per line (人, 后-後)
  research.py --offline                # cache only, never touch the network
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from selection import ID_RE, selected_signs  # noqa: E402

BASE = Path(__file__).resolve().parent.parent          # staging/han-500
CACHE = BASE / ".cache" / "wikt" / "pages"
API = "https://en.wiktionary.org/w/api.php"
ALLOWED_HOSTS = {"en.wiktionary.org"}
UA = "etym-si-content/0.1 (https://github.com/etym-si/website)"
BATCH = 20                  # titles per API request
MIN_INTERVAL = 1.05         # seconds between requests (<= 1 request/second)
MAX_BYTES = 2300            # hard cap per extract (target ~2 KB)

UNKNOWN: Counter = Counter()  # unknown template names (for tuning the flattener)
_last_request = 0.0


# ───────────────────────────── network ─────────────────────────────

def http_get(url: str, attempts: int = 6) -> bytes:
    """GET politely: <= 1 request/second; on 429/503 honor Retry-After (else back off)."""
    global _last_request
    host = urllib.parse.urlparse(url).hostname or ""
    if host not in ALLOWED_HOSTS:
        raise ValueError(f"host not allowed: {host}")
    delay = 10.0
    for i in range(attempts):
        wait = MIN_INTERVAL - (time.monotonic() - _last_request)
        if wait > 0:
            time.sleep(wait)
        _last_request = time.monotonic()
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or i == attempts - 1:
                raise
            ra = e.headers.get("Retry-After", "")
            pause = float(ra) if ra.isdigit() else delay
            print(f"  … HTTP {e.code}, waiting {pause:.0f}s", file=sys.stderr)
            time.sleep(pause)
            delay *= 2
    raise RuntimeError("unreachable")


def cache_path(title: str) -> Path:
    return CACHE / (urllib.parse.quote(title, safe="") + ".json")


def fetch_pages(titles: list[str], offline: bool = False) -> dict[str, dict]:
    """Return {title: {"title", "content", "rev"} or {"missing": True}} (cached)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    out: dict[str, dict] = {}
    todo = []
    for t in dict.fromkeys(titles):
        p = cache_path(t)
        if p.exists():
            out[t] = json.loads(p.read_text(encoding="utf-8"))
        else:
            todo.append(t)
    if todo and offline:
        raise SystemExit(f"--offline: {len(todo)} pages not cached, e.g. {todo[:5]}")
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        params = {"action": "query", "prop": "revisions", "rvprop": "content|ids", "rvslots": "main",
                  "formatversion": "2", "format": "json", "maxlag": "5", "titles": "|".join(chunk)}
        d = json.loads(http_get(API + "?" + urllib.parse.urlencode(params)))
        if "error" in d:
            raise RuntimeError(f"API error: {d['error']}")
        back = {n["to"]: n["from"] for n in d["query"].get("normalized", [])}
        for p in d["query"]["pages"]:
            title = back.get(p["title"], p["title"])
            if p.get("missing") or not p.get("revisions"):
                doc = {"title": p["title"], "missing": True}
            else:
                rev = p["revisions"][0]
                doc = {"title": p["title"], "rev": rev.get("revid"), "content": rev["slots"]["main"]["content"]}
            cache_path(title).write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
            out[title] = doc
        print(f"  fetched {min(i + BATCH, len(todo))}/{len(todo)} pages", file=sys.stderr)
    return out


# ───────────────────────────── wikitext ─────────────────────────────

def chinese_section(text: str) -> str:
    m = re.search(r"^==\s*Chinese\s*==\s*$", text, re.M)
    if not m:
        return ""
    n = re.search(r"^==[^=].*?==\s*$", text[m.end():], re.M)
    return text[m.end(): m.end() + (n.start() if n else len(text))]


def subsections(sec: str, name: str) -> list[str]:
    """Bodies of every '===…name…===' header (any level >= 3) in a section."""
    out = []
    for m in re.finditer(r"^(={3,6})\s*" + name + r"[^=\n]*\1\s*$", sec, re.M):
        rest = sec[m.end():]
        n = re.search(r"^={2,6}[^=\n].*?={2,6}\s*$", rest, re.M)
        out.append(rest[: n.start()] if n else rest)
    return out


def strip_markup_noise(s: str) -> str:
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"<ref[^>/]*/>", "", s)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"</?(?:span|small|big|sup|sub|i|b|u|s|abbr|nowiki)[^>]*>", "", s)
    return s


def find_close(s: str, i: int, op: str, cl: str) -> int:
    """s[i:i+2] == op; return index just past the matching cl (or len(s))."""
    depth = single = 0
    j = i
    while j < len(s):
        if s.startswith(op, j):
            depth += 1
            j += 2
        elif op == "{{" and s[j] == "{":
            single += 1
            j += 1
        elif s.startswith(cl, j) and single == 0:
            depth -= 1
            j += 2
            if depth == 0:
                return j
        elif op == "{{" and s[j] == "}" and single > 0:
            single -= 1
            j += 1
        else:
            j += 1
    return len(s)


def split_top(s: str, sep: str = "|") -> list[str]:
    parts, depth_t, depth_l, buf, j = [], 0, 0, [], 0
    while j < len(s):
        if s.startswith("{{", j):
            depth_t += 1; buf.append("{{"); j += 2; continue
        if s.startswith("}}", j) and depth_t:
            depth_t -= 1; buf.append("}}"); j += 2; continue
        if s.startswith("[[", j):
            depth_l += 1; buf.append("[["); j += 2; continue
        if s.startswith("]]", j) and depth_l:
            depth_l -= 1; buf.append("]]"); j += 2; continue
        if s[j] == sep and not depth_t and not depth_l:
            parts.append("".join(buf)); buf = []; j += 1; continue
        buf.append(s[j]); j += 1
    parts.append("".join(buf))
    return parts


def parse_template(inner: str) -> tuple[str, list[str], dict[str, str]]:
    parts = split_top(inner)
    name = parts[0].strip()
    name = (name[:1].lower() + name[1:]).replace("_", " ")
    pos: list[str] = []
    named: dict[str, str] = {}
    for p in parts[1:]:
        m = re.match(r"^\s*([\w\- ]+?)\s*=(.*)$", p, re.S)
        if m and not re.search(r"[\u3400-\u9fff]", m.group(1)):
            named[m.group(1).strip()] = m.group(2)
        else:
            pos.append(p)
    return name, pos, named


LIUSHU = {"1": "pictogram", "p": "pictogram", "pic": "pictogram",
          "2": "ideogram", "i": "ideogram",
          "3": "ideogrammic compound", "ic": "ideogrammic compound",
          "4": "phono-semantic compound", "psc": "phono-semantic compound", "ps": "phono-semantic compound",
          "5": "jiajie", "j": "jiajie"}
LIUSHU_ZH = {"pictogram": "象形", "ideogram": "指事", "ideogrammic compound": "會意",
             "phono-semantic compound": "形聲", "jiajie": "假借 phonetic loan"}
LIUSHU_ADJ = {"pictogram": "pictographic", "ideogram": "ideographic", "ideogrammic compound": "ideogrammic",
              "phono-semantic compound": "phono-semantic", "jiajie": "jiajie"}
DROP = {"han etym", "han etyl", "han ref", "rfe", "rfv-etym", "rfc", "rfd", "rfv", "wp", "wikipedia", "cln", "c",
        "cat", "categorize", "top", "attn", "anchor", "och-retrieve-pron", "cjkv", "zh-mw", "zh-also", "ant", "syn",
        "zh-dial", "col3", "col", "zh-wp", "multiple images", "img", "audio", "zh-character component",
        "zh-hg", "nb...", "sense", "senseid", "etymid", "zh-pron", "zh-forms", "head", "zh-hanzi", "han char",
        "defdate", "r:yue:hanzi", "zh-cat", "rfdef", "zh-attn-split", "tea room", "rfquotek", "rfclarify",
        "rfex", "rfref", "rftranslit", "zh-x/rest", "slim-wikipedia", "seemorecites", "zh-dial-syn",
        "sic", "cog", "inh", "der", "bor", "ncog", "zh-erhua form", "q-lite", "ipachar", "lang-lite", "tcl"}
YES = {"y", "yes", "1", "true", "t", "on"}


def _gloss(t: str) -> str:
    t = t.strip()
    return f" (“{t}”)" if t else ""


def _term(s: str) -> str:
    s = s.strip().lstrip("*").replace("//", "/").strip("/")
    return s.split("/")[0] if re.fullmatch(r"[^/]+/[^/]+", s) else s


def liushu_text(code: str, nocap: bool = False, adj: bool = False) -> str:
    key = LIUSHU.get(code.strip(), "")
    if not key:
        return ""
    name = LIUSHU_ADJ[key] if adj else key
    if not nocap:
        name = name[0].upper() + name[1:]
    return f"{name} ({LIUSHU_ZH[key]})"


def clean_zh_x(s: str) -> str:
    s = re.sub(r"\{[^{}]*\}", "", s)                     # {pinyin hints}
    s = s.replace("^", "").replace("'''", "")
    s = re.sub(r"(?<=[\u3400-\u9fff\uff0c\u3002])[ .\-]+(?=[\u3400-\u9fff])", "", s)
    s = re.sub(r"(?<=[\u3400-\u9fff])[ .\-]+(?=[\uff0c\u3002\uff1b\uff1a\uff1f\uff01])", "", s)
    return s.strip()


def render(name: str, pos: list[str], named: dict[str, str]) -> str:
    f = lambda s: flatten(s)  # noqa: E731
    P = lambda k: f(pos[k]).strip() if len(pos) > k else ""  # noqa: E731
    N = lambda k: f(named.get(k, "")).strip()  # noqa: E731
    if name in DROP:
        return ""
    if name == "liushu":
        return liushu_text(pos[0] if pos else "", N("nocap").lower() in YES, bool(N("adj")))
    if name == "han compound":
        bits = []
        for k in range(1, 5):
            if len(pos) < k or not pos[k - 1].strip():
                continue
            term = _term(f(pos[k - 1]))
            alt = _term(N(f"alt{k}"))
            role = {"p": "phonetic ", "s": "semantic "}.get(N(f"c{k}"), "")
            abb = "abbreviated " if N(f"abb{k}") else ""
            disp = f"{alt} (= {term})" if alt and alt != term else term
            bits.append(f"{abb}{role}{disp}{_gloss(N(f't{k}'))}")
        head = ""
        if N("ls"):
            nocap = N("nocap").lower() in YES
            head = liushu_text(N("ls"), nocap, bool(N("adj")))
            if N("ls2"):
                head += " and " + liushu_text(N("ls2"), True, bool(N("adj")))
            head += ": "
        return head + " + ".join(bits)
    if name == "han simp":
        res = ("s" if N("nocap") else "S") + "implified from " + (P(0) or "?")
        if N("a"):
            res += " and " + N("a")
        ch = []
        for fk, tk in (("f", "t"), ("f2", "t2")):
            if N(fk) or N(tk):
                frm = N(fk) or P(0)
                to = N(tk)
                ch.append(f"{frm} → {to}" if to else f"{frm} → (a component)")
        return res + (f" ({' and '.join(ch)})" if ch else "")
    if name in ("m", "l", "mention", "link", "l-self", "m-self", "ll", "l-lite", "m-lite", "lw"):
        term = _term(P(1)) if len(pos) > 1 else ""
        alt = P(2)
        gl = P(3) or N("t") or N("gloss")
        return (alt or term) + _gloss(gl)
    if name in ("zh-l", "och-l", "zh-m", "ltc-l", "och-m"):
        term = _term(P(0))
        gl = P(1) or N("t") or N("gloss")
        if len(pos) > 2 and P(2):
            gl = P(2)
        return term + _gloss(gl)
    if name in ("lang", "lang-lite"):
        return P(1)
    if name in ("w", "pedia", "wikipedia-lite", "wj", "w2"):
        return P(1) or P(0)
    if name in ("m-g", "n-g", "ng", "non-gloss", "non-gloss definition", "i", "qualifier", "q", "qf", "gloss-lite",
                "taxlink", "vern", "sup", "sub", "smallcaps", "small", "nowrap", "ruby", "circa2", "c.", "circa",
                "lang-short", "upright", "zh-ref", "glink", "glossary", "nobr", "sc", "smc", "ul", "u", "b", "def-date"):
        if name in ("glossary", "glink"):
            return P(1) or P(0)
        if name in ("i", "qualifier", "q", "qf"):
            return "(" + ", ".join(f(x).strip() for x in pos if x.strip()) + ")"
        return P(0)
    if name in ("gloss", "gl"):
        return "(" + P(0) + ")"
    if name in ("lb", "lbl", "label", "term-label", "tlb"):
        labels = [f(x).strip() for x in pos[1:] if f(x).strip() and f(x).strip() not in ("_", "or", "and")]
        return "(" + ", ".join(labels) + ")" if labels else ""
    if name in ("zh-x", "zh-q", "zh-co", "zh-usex", "zh-quote", "zh-ux"):
        txt = clean_zh_x(f(pos[0])) if pos else ""
        tr = P(1)
        return f"「{txt}」" + (f" (“{tr}”)" if tr else "")
    if name == "zh-see":
        return "see " + P(0)
    if name in ("surname",):
        return "a surname"
    if name in ("name translit", "given name", "zh-given name"):
        return "a transliterated name"
    if name in ("obs form", "alt form", "alternative form of", "obsolete form of", "alt sp", "zh-alt-form",
                "abbreviation of", "short for", "zh-short", "zh-abbrev", "form of", "altform", "zh-erhua"):
        kind = {"obs form": "obsolete form of", "obsolete form of": "obsolete form of", "short for": "short for",
                "zh-short": "short for", "abbreviation of": "abbreviation of", "zh-abbrev": "abbreviation of"}.get(
                    name, "alternative form of")
        if name.startswith("zh-"):
            term, gl = P(0), P(1)
        else:
            term, gl = P(1), (P(3) or N("t"))
        return f"{kind} {term}{_gloss(gl)}"
    if name in ("zh-classifier",):
        return "classifier for " + P(0)
    if name in ("syn of", "synonym of", "zh-syn of"):
        return "synonym of " + (P(1) if not name.startswith("zh-") else P(0))
    if name in ("zh-only", "zh-only used in", "only used in", "zh-used in"):
        terms = [P(k) for k in range(0, len(pos), 2) if P(k)] if name.startswith("zh-") else [P(1)]
        return ("used in " if name == "zh-used in" else "only used in ") + ", ".join(terms)
    if name == "shuowen":
        return "Shuowen"
    if name == "han phonetically borrowed":
        return "phonetically borrowed (假借)"
    if name == "jiajie":
        res = liushu_text("j") + " - The character was subsequently borrowed for a near-homophone"
        if P(1):
            res += f' meaning "{P(1)}"'
        if P(0):
            res += f", and the original meaning came to be represented by {_term(P(0))}"
        return res
    if name in ("zh-etym-double", "zh-etym-triple"):
        word = "duplication" if name.endswith("double") else "triplication"
        if N("nocap").lower() not in YES:
            word = word.capitalize()
        return f"{word} of {_term(P(0))}{_gloss(P(1))}"
    if name in ("unc", "uncertain"):
        return "Uncertain"
    if name in ("unk", "unknown"):
        return "Unknown"
    if name == "zh-subst-char":
        return f"substitute character for {_term(P(0))}{_gloss(P(1))}"
    if name == "zh-alt-lb":
        return "(alt. form " + ", ".join(_term(f(x)) for x in pos if x.strip()) + ")"
    if name in ("sound-symbolic",):
        return "sound symbolism"
    if name in ("doublet", "contraction of", "euph form", "zh-alt-name", "alt form of"):
        kind = {"doublet": "doublet of", "contraction of": "contraction of", "euph form": "euphemistic form of",
                "zh-alt-name": "alternative name for", "alt form of": "alternative form of"}[name]
        return f"{kind} {P(0) if name == 'zh-alt-name' else P(1)}"
    if name in ("taxfmt", "n-g-lite", "iPAchar", "ipachar", "langname"):
        return P(0)
    if name == "qlit":
        return f"literally “{P(0)}”"
    if name == "place":
        return "a place name"
    if name == "nbsp":
        return " "
    if name in ("def-uncertain",):
        return "(meaning uncertain)"
    if name in ("zh-used2", "zh-div", "reflist", "attention", "etystub", "rfquote-sense", "sid", "foreign name",
                "zh-pronunciation spelling of", "rfm", "zh-used"):
        return ""
    if name in ("zh-original", "zh-character", "zh-hanzi-box"):
        return P(0)
    if name in ("etyl", "sense-lite"):
        return ""
    if name.startswith("r:") or name.startswith("rq:") or name.startswith("table:") or name.startswith("list:"):
        return ""
    UNKNOWN[name] += 1
    return ""


def flatten(s: str) -> str:
    """Wikitext -> readable plain text (templates rendered or dropped, links resolved)."""
    out: list[str] = []
    j = 0
    while j < len(s):
        if s.startswith("{{", j):
            k = find_close(s, j, "{{", "}}")
            name, pos, named = parse_template(s[j + 2: k - 2])
            out.append(render(name, pos, named))
            j = k
            continue
        if s.startswith("[[", j):
            k = find_close(s, j, "[[", "]]")
            inner = s[j + 2: k - 2]
            if re.match(r"^\s*:?\s*(File|Image|Category|Fichier|Media)\s*:", inner, re.I):
                j = k
                continue
            parts = split_top(inner)
            if len(parts) > 1:
                out.append(flatten(parts[-1]))
            else:
                tgt = parts[0].split("#")[0] if not parts[0].startswith("#") else parts[0][1:]
                tgt = re.sub(r"^:?(w|wikipedia|s|wikisource):(zh:|en:)?", "", tgt)
                out.append(flatten(tgt))
            j = k
            continue
        out.append(s[j])
        j += 1
    t = "".join(out)
    t = re.sub(r"\[(?:https?:)?//\S+\s+([^\]]+)\]", r"\1", t)
    t = re.sub(r"\[(?:https?:)?//\S+\]", "", t)
    t = t.replace("'''", "").replace("''", "")
    return t


def tidy(t: str) -> str:
    t = html.unescape(t)
    t = re.sub(r"^[ \t]*[*#:]+[ \t]*", "• ", t, flags=re.M)
    t = re.sub(r"\(\s*\)", "", t)
    t = re.sub(r"[ \t\u00a0]+", " ", t)
    t = re.sub(r"\s*\n\s*", " ", t)
    t = re.sub(r"\s+([,.;:)])", r"\1", t)
    t = re.sub(r"\(\s+", "(", t)
    return t.strip(" •")


def cut(t: str, n: int) -> str:
    if len(t) <= n:
        return t
    head = t[:n]
    k = max(head.rfind(". "), head.rfind("; "), head.rfind("。"))
    if k > n * 0.6:
        head = head[: k + 1]
    return head.rstrip() + " …"


# ───────────────────────────── extraction ─────────────────────────────

def templates_named(sec: str, names: set[str]) -> list[tuple[list[str], dict[str, str]]]:
    alts = "|".join(f"[{re.escape(n[0].lower())}{re.escape(n[0].upper())}]{re.escape(n[1:])}" for n in sorted(names))
    res = []
    for m in re.finditer(r"\{\{\s*(?:" + alts + r")\s*[|}\n]", sec):
        i = m.start()
        k = find_close(sec, i, "{{", "}}")
        name, pos, named = parse_template(sec[i + 2: k - 2])
        if name in names:
            res.append((pos, named))
    return res


def mandarin(sec: str) -> list[str]:
    out: list[str] = []
    for _pos, named in templates_named(sec, {"zh-pron"}):
        for item in _readings(named):
            if item not in out:
                out.append(item)
    return out


def _readings(named: dict[str, str]) -> list[str]:
    """Pinyin items of a zh-pron |m= value (inline modifiers and hanzi auto-readings skipped)."""
    res = []
    for item in named.get("m", "").split(","):
        item = item.strip()
        if item and "=" not in item and re.search(r"[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]", item):
            res.append(item)
    return res


def forms(sec: str) -> dict[str, str]:
    res: dict[str, str] = {}
    for _pos, named in templates_named(sec, {"zh-forms"}):
        for k in ("s", "s2", "t", "t2"):
            v = named.get(k, "").strip()
            if v and k not in res:
                res[k] = v
        alt = named.get("alt", "").strip()
        if alt and "alt" not in res:
            items = [a for a in alt.split(",") if a.strip()]
            res["alt"] = ",".join(items[:4]) + (",…" if len(items) > 4 else "")
    return res


LABELS = {"obs-std": "obsolete in standard Chinese", "no-solo": "not used alone", "obsolete": "obsolete",
          "literary": "literary", "classical": "Classical Chinese", "archaic": "archaic"}


def senses(sec: str, per_reading: int = 2, n: int = 6) -> list[str]:
    """First senses of each reading, in page order, as '[reading] sense' strings."""
    events: list[tuple[int, str, str]] = []
    for m in re.finditer(r"\{\{zh-pron", sec):
        k = find_close(sec, m.start(), "{{", "}}")
        _name, _pos, named = parse_template(sec[m.start() + 2: k - 2])
        r = _readings(named)
        events.append((m.start(), "pron", r[0] if r else ""))
    for m in re.finditer(r"^#(?![#:*])\s*(.+)$", sec, re.M):
        events.append((m.start(), "sense", m.group(1)))
    events.sort()
    out: list[str] = []
    seen_texts: list[str] = []
    reading, count = "", Counter()
    for _i, kind, val in events:
        if kind == "pron":
            reading = val
            continue
        if count[reading] >= per_reading:
            continue
        t = tidy(flatten(strip_markup_noise(val)))
        for k, v in LABELS.items():
            t = t.replace(f"({k}", f"({v}").replace(f", {k}", f", {v}")
        if not t:
            continue
        key = t[:24].lower()
        if any(key == seen_t[:24].lower() for seen_t in seen_texts):
            continue
        seen_texts.append(t)
        item = cut((f"[{reading}] " if reading else "") + t, 100)
        if item not in out:
            out.append(item)
            count[reading] += 1
        if len(out) >= n:
            break
    return out


SW_RE = re.compile(r"Shuowen|說文|说文")


def shuowen(sec: str, origin_flat: str) -> list[str]:
    out: list[str] = []
    for pos, named in templates_named(sec, {"zh-x", "zh-q", "zh-quote", "zh-usex"}):
        ref = named.get("ref", "") + " " + " ".join(pos[2:3])
        if SW_RE.search(ref) and pos:
            txt = clean_zh_x(tidy(flatten(strip_markup_noise(pos[0]))))
            tr = tidy(flatten(strip_markup_noise(pos[1]))) if len(pos) > 1 else ""
            out.append(cut(f"「{txt}」" + (f" (“{tr}”)" if tr else ""), 220))
    if not out:  # fall back to sentences that mention the Shuowen inside the glyph origin
        for s in re.split(r"(?<=[.;])\s+", origin_flat):
            if SW_RE.search(s):
                out.append(cut(s, 220))
    return out[:2]


def page_extract(doc: dict | None) -> dict:
    if not doc or doc.get("missing"):
        return {}
    sec = re.sub(r"<!--.*?-->", "", chinese_section(doc["content"]), flags=re.S)
    if not sec:
        return {"no_chinese": True}
    origins = [tidy(flatten(strip_markup_noise(b))) for b in subsections(sec, "Glyph origin")]
    origins = [o for o in origins if o]
    see = [p[0].strip() for p, _n in templates_named(sec, {"zh-see"}) if p]
    simp = [p[0].strip() for p, _n in templates_named(sec, {"han simp"}) if p]
    return {"origin": " / ".join(origins), "forms": forms(sec), "pinyin": mandarin(sec),
            "senses": senses(sec), "see": see, "simp_of": simp, "sec": sec, "rev": doc.get("rev")}


def url_for(title: str) -> str:
    return "https://en.wiktionary.org/wiki/" + urllib.parse.quote(title, safe="")


def build_extract(sid: str, s: str, t: str, pages: dict[str, dict]) -> dict:
    es = page_extract(pages.get(s))
    et = page_extract(pages.get(t)) if t != s else es
    origin = et.get("origin", "")
    s_page = es.get("origin", "") if t != s else ""
    sw = shuowen(et.get("sec", ""), origin)
    pinyin = et.get("pinyin") or es.get("pinyin") or []
    fm = et.get("forms") or {}
    srcs = []
    for title, e in ((s, es), (t, et)) if t != s else ((s, es),):
        if pages.get(title) and not pages[title].get("missing"):
            srcs.append({"title": f"Wiktionary: {title}", "url": url_for(title), "rev": e.get("rev")})
    ext = {
        "id": sid, "s": s, "t": t,
        "forms": {k: v for k, v in fm.items()},
        "pinyin": pinyin[:6],
        "glyph_origin": origin,
        "s_page_origin": s_page,
        "shuowen": sw,
        "senses": et.get("senses") or es.get("senses") or [],
        "sources": srcs,
    }
    notes = []
    if "-" in sid:
        notes.append(f"Composite id: {s} also writes other words; this sign is the {t} sense. glyph_origin is "
                     f"from the {t} page; s_page_origin is the {s} page's own text.")
    elif t != s:
        notes.append(f"glyph_origin is from the traditional page {t}; s_page_origin explains the simplified {s}.")
    if not origin:
        notes.append("Wiktionary has no Glyph origin section for this character.")
    if notes:
        ext["note"] = " ".join(notes)
    # Keep it compact: trim the longest free-text fields until the file is <= MAX_BYTES.
    budget = [("glyph_origin", 1300), ("s_page_origin", 300), ("glyph_origin", 1000), ("glyph_origin", 800),
              ("s_page_origin", 160), ("glyph_origin", 600)]
    for field, n in budget:
        if size_of(ext) <= MAX_BYTES:
            break
        ext[field] = cut(ext[field], n)
    while size_of(ext) > MAX_BYTES and len(ext["senses"]) > 2:
        ext["senses"].pop()
    while size_of(ext) > MAX_BYTES and ext["shuowen"]:
        ext["shuowen"].pop()
    return ext


def dump(ext: dict) -> str:
    return json.dumps(ext, ensure_ascii=False, indent=1)


def size_of(ext: dict) -> int:
    return len(dump(ext).encode())


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--selection", type=Path, default=BASE / "selection.yaml")
    ap.add_argument("--chars", default="")
    ap.add_argument("--pool", type=Path)
    ap.add_argument("--out", type=Path, default=BASE / "research")
    ap.add_argument("--offline", action="store_true")
    a = ap.parse_args()

    items: list[tuple[str, str, str]] = []   # (id, simplified, traditional)
    if a.chars or a.pool:
        # ad-hoc ids: "人" (same simplified/traditional) or "后-後" (traditional given explicitly)
        ids = list(a.chars) if a.chars else [x.strip() for x in a.pool.read_text(encoding="utf-8").split()]
        for x in ids:
            if not ID_RE.match(x):
                raise SystemExit(f"bad id {x!r}")
            p = x.split("-")
            items.append((x, p[0], p[-1]))
    else:
        items = [(s["id"], s["s"], s["t"]) for s in selected_signs(a.selection)]

    out_dir = a.out.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    pages = fetch_pages([s for _i, s, _t in items] + [t for _i, _s, t in items], a.offline)
    resolved = items

    sizes = []
    for sid, s, t in resolved:
        ext = build_extract(sid, s, t, pages)
        path = (out_dir / f"{sid}.json").resolve()
        if path.parent != out_dir:
            raise SystemExit(f"refusing to write outside {out_dir}: {path}")
        data = dump(ext)
        path.write_text(data + "\n", encoding="utf-8")
        sizes.append(len(data.encode()))
    print(f"wrote {len(resolved)} extracts to {out_dir} (max {max(sizes) if sizes else 0} B, "
          f"mean {sum(sizes) // max(1, len(sizes))} B)")
    if UNKNOWN:
        print("unknown templates dropped:", ", ".join(f"{k}×{v}" for k, v in UNKNOWN.most_common(40)), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
