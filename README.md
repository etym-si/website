# website
etym.si — animated, kid-friendly lessons on how Chinese characters evolved

| Path | What |
|---|---|
| `content/` | everything the app teaches, as YAML (signs, artifacts, sources, stories, collections) — see [`content/README.md`](content/README.md) |
| `media/` | narration clips (`clips/*.mp3`, Git LFS) and their index (`manifest.json`) |
| `demos/` | the app (Vite + TypeScript), the content compiler (`demos/tools/`) and the network ingest adapters (`demos/scripts/`) — see [`demos/README.md`](demos/README.md) |
| `docs/superpowers/` | design specs and implementation plans |

After cloning: `git lfs install && git lfs pull`, then `cd demos && npm ci && npm run dev`. Pushes to `main` are deployed to Cloudflare Pages by GitHub Actions (`.github/workflows/deploy.yml`).
