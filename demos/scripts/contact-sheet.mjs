// Dev tool: renders every glyph stage for all 36 characters into a PNG contact sheet
// so we can eyeball data quality. Not part of the app bundle.
import { launch } from './browser.mjs';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const glyphDir = join(root, 'public', 'glyphs');
const hanziDir = join(root, 'public', 'hanzi');
const order = [...'日山水林木鸟象草田竹马夫刀舟鱼网燕云雨伞石火龟鹿豕叟虎弓舍羊花门犬子女月'];
const only = process.argv[2] ? [...process.argv[2]] : order;
const cols = ['oracle', 'bronze', 'seal', 'clerical', 'regular', 'simplified'];
const cell = 110;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function glyphSvg(stage, x, y) {
  const [bx, by, bw, bh] = stage.box;
  const sc = (cell - 20) / Math.max(bw, bh);
  const paths = stage.paths.map((p) => {
    const fill = p.mode === 'stroke' ? 'none' : p.mode === 'knockout' ? '#fff' : '#222';
    const stroke = p.mode === 'stroke' ? `stroke="#222" stroke-width="${p.w}"` : '';
    return `<path d="${esc(p.d)}" ${p.t ? `transform="${esc(p.t)}"` : ''} fill="${fill}" ${stroke} ${p.rule ? 'fill-rule="evenodd"' : ''}/>`;
  }).join('');
  return `<g transform="translate(${x + 10},${y + 10}) scale(${sc}) translate(${-bx},${-by})">${paths}</g>`;
}
function hanziSvg(ch, x, y) {
  let data;
  try { data = JSON.parse(readFileSync(join(hanziDir, `${ch}.json`), 'utf8')); } catch { return ''; }
  const sc = (cell - 20) / 1024;
  return `<g transform="translate(${x + 10},${y + 10}) scale(${sc}) translate(0,900) scale(1,-1)">${data.strokes.map((d) => `<path d="${esc(d)}" fill="#222"/>`).join('')}</g>`;
}

let body = '';
only.forEach((ch, r) => {
  const g = JSON.parse(readFileSync(join(glyphDir, `${ch}.json`), 'utf8'));
  const y = r * cell + 30;
  body += `<text x="8" y="${y + cell / 2 + 10}" font-size="28" font-family="Noto Sans CJK SC">${esc(ch)}</text>`;
  const used = new Set();
  cols.forEach((c, i) => {
    const x = 50 + i * cell;
    body += `<rect x="${x + 2}" y="${y + 2}" width="${cell - 4}" height="${cell - 4}" fill="#f7f0e1" stroke="#ddd"/>`;
    if (c === 'regular') body += hanziSvg(g.trad, x, y);
    else if (c === 'simplified') body += g.trad !== g.char ? hanziSvg(g.char, x, y) : '';
    else {
      const st = g.stages.find((s, idx) => s.stage === c && !used.has(idx));
      if (st) { used.add(g.stages.indexOf(st)); body += glyphSvg(st, x, y); body += `<text x="${x + 6}" y="${y + cell - 6}" font-size="10" fill="#999">${esc(st.form + ' ' + st.variant)}</text>`; }
    }
  });
});
const header = cols.map((c, i) => `<text x="${50 + i * cell + 8}" y="20" font-size="13" font-family="sans-serif">${c}</text>`).join('');
const W = 50 + cols.length * cell, H = only.length * cell + 30;
const html = `<!doctype html><html><body style="margin:0;background:#fff"><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${header}${body}</svg></body></html>`;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(html);
mkdirSync(join(root, 'shots'), { recursive: true });
const out = join(root, 'shots', process.argv[3] || 'contact-sheet.png');
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
