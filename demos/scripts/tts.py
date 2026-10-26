#!/usr/bin/env python3
"""Clip synthesizer for `npm run tts` (demos/tools/tts.ts).

Node decides what to record: every narration or pronunciation line that has no master clip yet, already
normalized per voice. This script only synthesizes. Each job's key must equal
sha256("provider|voice|rate|text") (the same clip key as demos/tools/audio/clip-key.ts), so a clip is always
stored under the name of exactly what was spoken. Uses Microsoft Edge neural voices via `edge-tts`.

  python3 scripts/tts.py <jobs.json> <results.json>
  python3 scripts/tts.py --key <provider> <voice> <rate> <text>      (prints the clip key; no network)

jobs.json:    {"clipsDir": "/abs/media/clips", "jobs": [{"key", "provider", "voice", "rate", "text"}]}
results.json: {"ok": [key, …], "failed": [key, …]}
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
import sys
from pathlib import Path

KEY = re.compile(r"^[0-9a-f]{64}$")


def clip_key(provider: str, voice: str, rate: str, text: str) -> str:
    return hashlib.sha256(f"{provider}|{voice}|{rate}|{text}".encode("utf-8")).hexdigest()


def check_job(job: dict) -> None:
    if job.get("provider") != "edge-tts":
        raise ValueError(f"unsupported provider {job.get('provider')!r}")
    if not KEY.match(job.get("key", "")) or clip_key(job["provider"], job["voice"], job["rate"], job["text"]) != job["key"]:
        raise ValueError(f"job key does not match its text: {job.get('key')!r}")


async def synth_one(sem: asyncio.Semaphore, communicate, job: dict, out_path: Path) -> bool:
    if out_path.exists() and out_path.stat().st_size > 200:
        return True
    tmp = out_path.with_name(out_path.name + ".part")
    async with sem:
        for attempt in range(4):
            try:
                comm = communicate(job["text"], voice=job["voice"], rate=job["rate"])
                await comm.save(str(tmp))
                if tmp.exists() and tmp.stat().st_size > 200:
                    tmp.replace(out_path)
                    return True
            except Exception as e:
                if attempt == 3:
                    print(f"! failed {job['text'][:30]!r}: {e}", file=sys.stderr)
            await asyncio.sleep(1.5 * (attempt + 1))
    tmp.unlink(missing_ok=True)
    return False


async def run(clips_dir: Path, jobs: list[dict]) -> dict:
    for job in jobs:
        check_job(job)
    try:
        from edge_tts import Communicate  # imported here so --key and the job checks run without edge-tts
    except ImportError:
        raise SystemExit("tts: the edge-tts package is not installed (pip install edge-tts)")
    clips_dir.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(10)
    done = await asyncio.gather(*(synth_one(sem, Communicate, j, clips_dir / f"{j['key']}.mp3") for j in jobs))
    return {"ok": [j["key"] for j, d in zip(jobs, done) if d], "failed": [j["key"] for j, d in zip(jobs, done) if not d]}


def main(argv: list[str]) -> int:
    if len(argv) == 6 and argv[1] == "--key":
        print(clip_key(argv[2], argv[3], argv[4], argv[5]))
        return 0
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    spec = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    result = asyncio.run(run(Path(spec["clipsDir"]), spec["jobs"]))
    print(f"tts: {len(result['ok'])} clip(s) ready, {len(result['failed'])} failed")
    Path(argv[2]).write_text(json.dumps(result), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
