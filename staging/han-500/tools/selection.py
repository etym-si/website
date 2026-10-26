"""Read staging/han-500/selection.yaml with the Python standard library only.

selection.yaml is ordinary YAML, but written in a deliberately small subset so that the
stdlib-only Python tools can read it without PyYAML:

  - comment lines (``#``) and blank lines are ignored;
  - every top-level key starts at column 0: ``key: <JSON value>`` or ``key:`` followed by
    list items ``  - <JSON value>`` (one per line).

Every JSON value is also a valid YAML flow node, so Node's ``yaml`` package (used by
check.mjs) reads the very same file.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ID_RE = re.compile(r"^[\u3400-\u9fff\U00020000-\U0003134f\uf900-\ufaff](-[\u3400-\u9fff\U00020000-\U0003134f\uf900-\ufaff])?$")
_KEY = re.compile(r"^([A-Za-z_][\w-]*):\s*(.*)$")
_ITEM = re.compile(r"^\s+-\s+(.*)$")


def load_selection(path: Path) -> dict:
    out: dict = {}
    key: str | None = None
    for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = _KEY.match(line)
        if m:
            key, val = m.group(1), m.group(2).strip()
            if key in out:
                raise ValueError(f"{path}:{n}: duplicate key {key!r}")
            out[key] = json.loads(val) if val else []
            if val:
                key = None
            continue
        m = _ITEM.match(line)
        if m and key is not None:
            try:
                out[key].append(json.loads(m.group(1)))
            except json.JSONDecodeError as e:
                raise ValueError(f"{path}:{n}: not a JSON flow value: {e}") from None
            continue
        raise ValueError(f"{path}:{n}: outside the supported YAML subset: {line[:60]!r}")
    return out


def selected_signs(path: Path) -> list[dict]:
    """Return the new signs ({id, s, t, ...}) in selection order, validating ids."""
    sel = load_selection(path)
    signs = sel.get("signs") or []
    seen: set[str] = set()
    for s in signs:
        sid = s.get("id", "")
        if not ID_RE.match(sid):
            raise ValueError(f"bad sign id {sid!r}")
        if sid in seen:
            raise ValueError(f"duplicate sign id {sid!r}")
        seen.add(sid)
        parts = sid.split("-")
        if s.get("s") != parts[0] or (len(parts) == 2 and s.get("t") != parts[1]):
            raise ValueError(f"{sid}: s/t do not match the id")
    return signs
