// Live Pack & Lazy-Load Inspector: visualizes the multi-member .pack.gz shards (<=20 MiB each),
// Protobuf + gzip compression savings, and every HTTP 206 byte-range slice lazy-loaded in the session.
import { h, s } from '../dom';
import { CATALOG } from '../content';
import { chime } from '../audio';
import { packTelemetry } from '../pack-loader';

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

function shortShard(file: string): string {
  const base = file.split('/').pop() ?? file;
  return base.replace(/\.[0-9a-f]{10}\.pack\.gz$/, '.pack.gz');
}

let activeModal: HTMLElement | null = null;
let unsubscribeModal: (() => void) | null = null;

function closeInspector(): void {
  if (unsubscribeModal) {
    unsubscribeModal();
    unsubscribeModal = null;
  }
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }
}

export function openPackInspector(): void {
  closeInspector();
  const packs = CATALOG.packs ?? [];
  const body = h('div', { class: 'pack-dialog-body' });

  const render = () => {
    const sum = packTelemetry.summary(packs);
    const savedPct = sum.totalPackRawBytes > 0
      ? Math.round((1 - sum.totalPackGzBytes / sum.totalPackRawBytes) * 100)
      : 0;
    const fetchedPct = sum.totalPackGzBytes > 0
      ? ((sum.fetchedGzBytes / sum.totalPackGzBytes) * 100).toFixed(2)
      : '0.00';

    const kpis = h('div', { class: 'pack-kpis' },
      h('div', { class: 'pack-kpi' },
        h('span', { class: 'pack-kpi-label' }, 'Batched Shards (≤20 MiB cap)'),
        h('strong', { class: 'pack-kpi-val' }, `${sum.shardCount} .pack.gz files`),
        h('span', { class: 'pack-kpi-sub' }, '502 signs + 6 stories + 3,432 clips')),
      h('div', { class: 'pack-kpi' },
        h('span', { class: 'pack-kpi-label' }, 'Protobuf + Gzip Corpus'),
        h('strong', { class: 'pack-kpi-val' }, `${fmtBytes(sum.totalPackGzBytes)}`),
        h('span', { class: 'pack-kpi-sub' }, `from ${fmtBytes(sum.totalPackRawBytes)} raw (−${savedPct}%)`)),
      h('div', { class: 'pack-kpi accent' },
        h('span', { class: 'pack-kpi-label' }, 'Lazy-Loaded This Session'),
        h('strong', { class: 'pack-kpi-val' }, `${ fmtBytes(sum.fetchedGzBytes) } (${sum.slices} slices)`),
        h('span', { class: 'pack-kpi-sub' }, `${fmtBytes(sum.fetchedRawBytes)} gunzipped · ${fetchedPct}% of corpus`)),
    );

    const shardRows = packs.map((p) => {
      const hits = packTelemetry.entries.filter((e) => e.file === p.file);
      const hitBytes = hits.reduce((acc, e) => acc + e.gzBytes, 0);
      const rects = hits.map((e) => {
        const [start, len] = e.range;
        const x = Math.max(0, Math.min(996, (start / Math.max(1, p.bytes)) * 1000));
        const w = Math.max(4, Math.min(1000 - x, (len / Math.max(1, p.bytes)) * 1000));
        return s('rect', {
          x: x.toFixed(1),
          y: '2',
          width: w.toFixed(1),
          height: '14',
          rx: '3',
          class: e.kind === 'proto' ? 'slice-proto' : 'slice-audio',
        });
      });
      const bar = s('svg', { viewBox: '0 0 1000 18', class: 'pack-bar', role: 'img', 'aria-label': shortShard(p.file) },
        s('rect', { x: '0', y: '2', width: '1000', height: '14', rx: '4', class: 'slice-bg' }),
        ...rects,
      );
      return h('div', { class: `pack-shard-row ${hits.length ? 'active' : ''}` },
        h('div', { class: 'pack-shard-meta' },
          h('code', { class: 'pack-shard-name' }, shortShard(p.file)),
          h('span', { class: 'pack-shard-size' }, `${fmtBytes(p.bytes)} gz / ${fmtBytes(p.rawBytes)} raw · ${p.items} members`),
          h('span', { class: 'pack-shard-hits' }, hits.length ? `${hits.length} slice(s) · ${fmtBytes(hitBytes)}` : 'idle')),
        bar,
      );
    });

    const logRows = packTelemetry.entries.slice(0, 40).map((e) => {
      const [start, len] = e.range;
      return h('tr', { class: 'pack-log-row' },
        h('td', {}, `#${e.id}`),
        h('td', {}, h('span', { class: `pack-tag ${e.kind}` }, e.kind === 'proto' ? 'Protobuf.gz' : 'MP3.gz')),
        h('td', {}, h('code', {}, e.label)),
        h('td', {}, h('code', {}, shortShard(e.file))),
        h('td', {}, h('code', {}, `${start}..${start + len - 1}`)),
        h('td', {}, `${fmtBytes(e.gzBytes)} → ${fmtBytes(e.rawBytes)}`),
        h('td', {}, h('span', { class: 'pack-status' }, `HTTP ${e.status}`)),
        h('td', {}, `${e.ms} ms`),
      );
    });

    body.replaceChildren(
      kpis,
      h('section', { class: 'pack-section' },
        h('h4', {}, 'Shard Map (RFC 1952 Multi-Member .pack.gz · ≤20 MiB per file)'),
        h('div', { class: 'pack-shards' }, ...shardRows)),
      h('section', { class: 'pack-section' },
        h('h4', {}, 'Live HTTP 206 Byte-Range & DecompressionStream("gzip") Log'),
        h('div', { class: 'pack-table-wrap' },
          h('table', { class: 'pack-table' },
            h('thead', {},
              h('tr', {},
                h('th', {}, '#'),
                h('th', {}, 'Format'),
                h('th', {}, 'Bundle / Section'),
                h('th', {}, 'Shard'),
                h('th', {}, 'Range (bytes)'),
                h('th', {}, 'Gzip → Gunzipped'),
                h('th', {}, 'Status'),
                h('th', {}, 'Time'))),
            h('tbody', {}, ...logRows)))),
    );
  };

  render();
  unsubscribeModal = packTelemetry.subscribe(render);

  const modal = h('div', {
    class: 'modal-backdrop pack-backdrop',
    onclick: (ev: Event) => { if (ev.target === modal) closeInspector(); },
  },
    h('div', { class: 'pack-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pack & Lazy-Load Inspector' },
      h('div', { class: 'pack-dialog-head' },
        h('div', {},
          h('h3', { class: 'pack-dialog-title' }, '📦 Protobuf + Multi-Member .pack.gz Lazy-Load Inspector'),
          h('p', { class: 'pack-dialog-sub' },
            'Every sign, story, collection (proto3) and voice audio section is gzipped as an independent RFC 1952 member inside <=20 MiB .pack.gz shards, fetched via HTTP 206 byte ranges, and decompressed in the browser via DecompressionStream("gzip").')),
        h('button', {
          type: 'button',
          class: 'chip pack-close',
          'aria-label': 'Close Pack Inspector',
          onclick: () => { chime('tap'); closeInspector(); },
        }, '✕')),
      body),
  );

  activeModal = modal;
  document.body.appendChild(modal);
}

/** Topbar pill that displays live lazy-loaded slice count & bytes and opens the Pack Inspector modal. */
export function packPill(): HTMLButtonElement {
  const packs = CATALOG.packs ?? [];
  const btn = h('button', {
    type: 'button',
    class: 'chip pack-pill',
    title: 'Inspect Protobuf + .pack.gz Shards & Lazy-Loaded Byte Ranges',
    'aria-label': 'Inspect Protobuf and .pack.gz lazy-loaded shards',
    onclick: () => { chime('tap'); openPackInspector(); },
  });
  const update = () => {
    const sum = packTelemetry.summary(packs);
    btn.textContent = `📦 ${sum.slices} slices · ${fmtBytes(sum.fetchedGzBytes)}`;
  };
  update();
  const unsub = packTelemetry.subscribe(() => {
    if (!btn.isConnected && activeModal === null) {
      unsub();
      return;
    }
    update();
  });
  return btn;
}
