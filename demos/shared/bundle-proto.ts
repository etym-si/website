// Deterministic Protocol Buffers (proto3) encoder & decoder for SignBundle, StoryBundle and CollectionBundle.
// Matches content/_schema/bundle.proto field-for-field using demos/shared/proto-wire.ts.
import type {
  AudioIndex,
  Box,
  ByteRange,
  CardB,
  CardKind,
  CollectionBundle,
  FormB,
  GlyphData,
  GlyphPath,
  L10n,
  LessonB,
  MarkB,
  OriginB,
  PhotoB,
  PictureB,
  SignBundle,
  SignLabel,
  SignSummary,
  StoryBundle,
  StoryRefB,
  StrokesB,
  SvgNode,
  UnitB,
} from './bundle-types.ts';
import type { GlyphSel, Step } from './steps.ts';
import { ProtoReader, ProtoWriter } from './proto-wire.ts';

function writeSvgNode(w: ProtoWriter, field: number, [tag, attrs, kids]: SvgNode): void {
  w.sub(field, (s) => {
    s.string(1, tag);
    s.stringMap(2, attrs);
    for (const k of kids) writeSvgNode(s, 3, k);
  });
}

function readSvgNode(r: ProtoReader): SvgNode {
  let tag = '';
  const attrs: Record<string, string> = {};
  const kids: SvgNode[] = [];
  while (r.next()) {
    switch (r.field) {
      case 1: tag = r.string(); break;
      case 2: r.stringMapEntry(attrs); break;
      case 3: kids.push(readSvgNode(r.sub())); break;
      default: r.skip();
    }
  }
  return [tag, attrs, kids];
}

function writePicture(w: ProtoWriter, field: number, p: PictureB): void {
  w.sub(field, (s) => {
    s.double(1, p.rotate);
    if (p.ambient) s.string(2, p.ambient);
    for (const n of p.tree) writeSvgNode(s, 3, n);
  });
}

function readPicture(r: ProtoReader): PictureB {
  let rotate = 0;
  let ambient: string | undefined;
  const tree: SvgNode[] = [];
  while (r.next()) {
    switch (r.field) {
      case 1: rotate = r.double(); break;
      case 2: ambient = r.string(); break;
      case 3: tree.push(readSvgNode(r.sub())); break;
      default: r.skip();
    }
  }
  return { rotate, ...(ambient ? { ambient } : {}), tree };
}

function writeForm(w: ProtoWriter, field: number, f: FormB): void {
  w.sub(field, (s) => {
    s.string(1, f.stage);
    s.string(2, f.form);
    s.string(3, f.variant);
    for (const n of f.box) s.double(4, n);
    for (const p of f.paths) {
      s.sub(5, (pw) => {
        pw.string(1, p.d);
        if (p.t !== undefined) pw.string(2, p.t);
        if (p.mode !== undefined) pw.string(3, p.mode);
        if (p.w !== undefined) { pw.double(4, p.w); pw.bool(6, true); }
        if (p.rule !== undefined) pw.string(5, p.rule);
      });
    }
  });
}

function readForm(r: ProtoReader): FormB {
  let stage = '';
  let form = '';
  let variant = '';
  const box: number[] = [];
  const paths: GlyphPath[] = [];
  while (r.next()) {
    switch (r.field) {
      case 1: stage = r.string(); break;
      case 2: form = r.string(); break;
      case 3: variant = r.string(); break;
      case 4: box.push(r.double()); break;
      case 5: {
        const pr = r.sub();
        let d = '';
        let t: string | undefined;
        let mode: 'stroke' | 'knockout' | undefined;
        let w = 0;
        let hasW = false;
        let rule: 'evenodd' | undefined;
        while (pr.next()) {
          switch (pr.field) {
            case 1: d = pr.string(); break;
            case 2: t = pr.string(); break;
            case 3: mode = pr.string() as 'stroke' | 'knockout'; break;
            case 4: w = pr.double(); break;
            case 5: rule = pr.string() as 'evenodd'; break;
            case 6: hasW = pr.bool(); break;
            default: pr.skip();
          }
        }
        paths.push({
          d,
          ...(t !== undefined ? { t } : {}),
          ...(mode !== undefined ? { mode } : {}),
          ...(hasW ? { w } : {}),
          ...(rule !== undefined ? { rule } : {}),
        });
        break;
      }
      default: r.skip();
    }
  }
  return { stage, form, variant, box: [box[0] ?? 0, box[1] ?? 0, box[2] ?? 300, box[3] ?? 300] as Box, paths };
}

function writeStrokes(w: ProtoWriter, field: number, st: StrokesB): void {
  w.sub(field, (s) => {
    for (const d of st.strokes) s.string(1, d);
    for (const m of st.medians) {
      s.sub(2, (mw) => {
        for (const [x, y] of m) { mw.double(1, x); mw.double(1, y); }
      });
    }
  });
}

function readStrokes(r: ProtoReader): StrokesB {
  const strokes: string[] = [];
  const medians: [number, number][][] = [];
  while (r.next()) {
    switch (r.field) {
      case 1: strokes.push(r.string()); break;
      case 2: {
        const mr = r.sub();
        const coords: number[] = [];
        while (mr.next()) {
          if (mr.field === 1) coords.push(mr.double());
          else mr.skip();
        }
        const pts: [number, number][] = [];
        for (let i = 0; i + 1 < coords.length; i += 2) pts.push([coords[i], coords[i + 1]]);
        medians.push(pts);
        break;
      }
      default: r.skip();
    }
  }
  return { strokes, medians };
}

function writePhoto(w: ProtoWriter, field: number, p: PhotoB): void {
  w.sub(field, (s) => {
    s.string(1, p.file);
    s.uint32(2, p.w);
    s.uint32(3, p.h);
    s.string(4, p.title);
    s.string(5, p.license);
    s.string(6, p.author);
    s.string(7, p.page);
  });
}

function readPhoto(r: ProtoReader): PhotoB {
  let file = '';
  let w = 0;
  let h = 0;
  let title = '';
  let license = '';
  let author = '';
  let page = '';
  while (r.next()) {
    switch (r.field) {
      case 1: file = r.string(); break;
      case 2: w = r.uint32(); break;
      case 3: h = r.uint32(); break;
      case 4: title = r.string(); break;
      case 5: license = r.string(); break;
      case 6: author = r.string(); break;
      case 7: page = r.string(); break;
      default: r.skip();
    }
  }
  return { file, w, h, title, license, author, page };
}

function writeCard(w: ProtoWriter, field: number, c: CardB | null): void {
  w.sub(field, (s) => {
    if (!c) { s.bool(1, false); return; }
    s.bool(1, true);
    s.string(2, c.kind);
    writePhoto(s, 3, c.img);
    if (c.img2) writePhoto(s, 4, c.img2);
    for (const m of c.marks ?? []) {
      s.sub(5, (mw) => {
        mw.double(1, m.x); mw.double(2, m.y); mw.double(3, m.w); mw.double(4, m.h);
        if (m.label) mw.stringMap(5, m.label);
      });
    }
    if (c.form) {
      s.string(6, c.form.stage);
      s.uint32(7, c.form.index);
      s.bool(8, true);
    }
    s.stringMap(9, c.title);
    s.stringMap(10, c.text);
    if (c.source !== undefined) s.string(11, c.source);
  });
}

function readCard(r: ProtoReader): CardB | null {
  let present = false;
  let kind: CardKind = 'example';
  let img: PhotoB | undefined;
  let img2: PhotoB | undefined;
  const marks: MarkB[] = [];
  let formStage = '';
  let formIndex = 0;
  let hasForm = false;
  const title: L10n = {};
  const text: L10n = {};
  let source: string | undefined;
  while (r.next()) {
    switch (r.field) {
      case 1: present = r.bool(); break;
      case 2: kind = r.string() as CardKind; break;
      case 3: img = readPhoto(r.sub()); break;
      case 4: img2 = readPhoto(r.sub()); break;
      case 5: {
        const mr = r.sub();
        let x = 0, y = 0, w = 0, h = 0;
        const label: L10n = {};
        while (mr.next()) {
          switch (mr.field) {
            case 1: x = mr.double(); break;
            case 2: y = mr.double(); break;
            case 3: w = mr.double(); break;
            case 4: h = mr.double(); break;
            case 5: mr.stringMapEntry(label); break;
            default: mr.skip();
          }
        }
        marks.push({ x, y, w, h, ...(Object.keys(label).length ? { label } : {}) });
        break;
      }
      case 6: formStage = r.string(); break;
      case 7: formIndex = r.uint32(); break;
      case 8: hasForm = r.bool(); break;
      case 9: r.stringMapEntry(title); break;
      case 10: r.stringMapEntry(text); break;
      case 11: source = r.string(); break;
      default: r.skip();
    }
  }
  if (!present || !img) return null;
  return {
    kind,
    img,
    ...(img2 ? { img2 } : {}),
    ...(marks.length ? { marks } : {}),
    ...(hasForm ? { form: { stage: formStage, index: formIndex } } : {}),
    title,
    text,
    ...(source !== undefined ? { source } : {}),
  };
}

function writeGlyphSel(w: ProtoWriter, field: number, g: GlyphSel): void {
  w.sub(field, (s) => {
    s.string(1, g.sign);
    s.string(2, g.stage);
    if (g.index !== undefined) { s.uint32(3, g.index); s.bool(4, true); }
  });
}

function readGlyphSel(r: ProtoReader): GlyphSel {
  let sign = '';
  let stage = '';
  let index = 0;
  let hasIndex = false;
  while (r.next()) {
    switch (r.field) {
      case 1: sign = r.string(); break;
      case 2: stage = r.string(); break;
      case 3: index = r.uint32(); break;
      case 4: hasIndex = r.bool(); break;
      default: r.skip();
    }
  }
  return { sign, stage, ...(hasIndex ? { index } : {}) };
}

function writeStep(w: ProtoWriter, field: number, st: Step): void {
  w.sub(field, (s) => {
    s.string(1, st.do);
    switch (st.do) {
      case 'place':
        s.string(2, st.actor);
        s.double(3, st.at[0]); s.double(3, st.at[1]);
        s.double(4, st.size);
        if (st.back !== undefined) { s.bool(5, st.back); s.bool(6, true); }
        break;
      case 'picture':
        s.string(2, st.actor);
        s.string(7, st.pic);
        if (st.ms !== undefined) { s.double(8, st.ms); s.bool(9, true); }
        break;
      case 'rotate':
        s.string(2, st.actor);
        s.double(10, st.deg); s.bool(11, true);
        if (st.target !== undefined) s.string(12, st.target);
        if (st.ms !== undefined) { s.double(8, st.ms); s.bool(9, true); }
        break;
      case 'pose':
        s.string(2, st.actor);
        s.string(13, st.part);
        if (st.dx !== undefined) { s.double(14, st.dx); s.bool(15, true); }
        if (st.dy !== undefined) { s.double(16, st.dy); s.bool(17, true); }
        if (st.scaleX !== undefined) { s.double(18, st.scaleX); s.bool(19, true); }
        if (st.scaleY !== undefined) { s.double(20, st.scaleY); s.bool(21, true); }
        if (st.deg !== undefined) { s.double(10, st.deg); s.bool(11, true); }
        if (st.origin !== undefined) s.string(22, st.origin);
        if (st.ms !== undefined) { s.double(8, st.ms); s.bool(9, true); }
        break;
      case 'draw':
      case 'swap':
        s.string(2, st.actor);
        writeGlyphSel(s, 23, st.glyph);
        if (st.ms !== undefined) { s.double(8, st.ms); s.bool(9, true); }
        if (st.color !== undefined) s.string(24, st.color);
        break;
      case 'show':
        s.string(2, st.actor);
        writeGlyphSel(s, 23, st.glyph);
        if (st.color !== undefined) s.string(24, st.color);
        break;
      case 'clearPicture':
      case 'remove':
        s.string(2, st.actor);
        if (st.ms !== undefined) { s.double(8, st.ms); s.bool(9, true); }
        break;
      case 'wash':
        s.string(2, st.actor);
        s.string(24, st.color);
        if (st.size !== undefined) s.double(4, st.size);
        if (st.w !== undefined) { s.double(25, st.w); s.bool(26, true); }
        if (st.h !== undefined) { s.double(27, st.h); s.bool(28, true); }
        if (st.opacity !== undefined) { s.double(29, st.opacity); s.bool(30, true); }
        if (st.ms !== undefined) { s.double(8, st.ms); s.bool(9, true); }
        if (st.dx !== undefined) { s.double(14, st.dx); s.bool(15, true); }
        if (st.dy !== undefined) { s.double(16, st.dy); s.bool(17, true); }
        break;
      case 'move':
        s.string(2, st.actor);
        s.double(3, st.to[0]); s.double(3, st.to[1]);
        s.double(8, st.ms); s.bool(9, true);
        if (st.gait !== undefined) s.string(31, st.gait);
        if (st.ease !== undefined) s.string(32, st.ease);
        break;
      case 'ambient':
        s.string(2, st.actor);
        s.string(33, st.motion);
        break;
      case 'fade':
      case 'scale':
        s.string(2, st.actor);
        s.double(34, st.to);
        if (st.ms !== undefined) { s.double(8, st.ms); s.bool(9, true); }
        break;
      case 'bg':
        s.string(35, st.tone);
        if (st.ms !== undefined) { s.double(8, st.ms); s.bool(9, true); }
        break;
      case 'stage':
        s.string(36, st.stage);
        if (st.variant !== undefined) s.string(37, st.variant);
        break;
      case 'caption':
        if (st.text === null) s.bool(39, true);
        else s.stringMap(38, st.text);
        break;
      case 'tag':
        s.string(2, st.actor);
        s.string(40, st.sign);
        if (st.hold !== undefined) { s.double(41, st.hold); s.bool(42, true); }
        if (st.dx !== undefined) { s.double(14, st.dx); s.bool(15, true); }
        if (st.dy !== undefined) { s.double(16, st.dy); s.bool(17, true); }
        break;
      case 'say':
        if (typeof st.text === 'string') s.string(43, st.text);
        else s.stringMap(38, st.text);
        s.string(44, st.lang);
        if (st.wait !== undefined) { s.bool(45, st.wait); s.bool(46, true); }
        if (st.silent !== undefined) { s.bool(47, st.silent); s.bool(48, true); }
        if (st.clip) s.stringMap(49, st.clip);
        break;
      case 'wait':
        s.double(8, st.ms); s.bool(9, true);
        break;
      case 'together':
        for (const c of st.steps) writeStep(s, 50, c);
        break;
    }
  });
}

function readStep(r: ProtoReader): Step {
  let doKind = '';
  let actor = '';
  const xy: number[] = [];
  let size = 0;
  let hasSize = false;
  let back = false;
  let hasBack = false;
  let pic = '';
  let ms = 0;
  let hasMs = false;
  let deg = 0;
  let hasDeg = false;
  let target: 'picture' | 'all' | undefined;
  let part = '';
  let dx = 0, hasDx = false;
  let dy = 0, hasDy = false;
  let scaleX = 1, hasScaleX = false;
  let scaleY = 1, hasScaleY = false;
  let origin: 'left' | 'right' | 'center' | 'top' | 'bottom' | undefined;
  let glyph: GlyphSel | undefined;
  let color: string | undefined;
  let w = 0, hasW = false;
  let h = 0, hasH = false;
  let opacity = 0, hasOpacity = false;
  let gait: 'walk' | 'hop' | 'fly' | 'swim' | 'gallop' | undefined;
  let ease: string | undefined;
  let motion: 'bob' | 'sway' | 'pulse' | 'flicker' | 'flow' | 'float' | 'none' = 'none';
  let toNum = 0;
  let tone: 'paper' | 'dawn' | 'dusk' | 'night' = 'paper';
  let stage = '';
  let variant: string | undefined;
  const textL10n: L10n = {};
  let captionNull = false;
  let sign = '';
  let hold = 0, hasHold = false;
  let textStr: string | undefined;
  let lang: 'zh' | 'ui' = 'ui';
  let wait = false, hasWait = false;
  let silent = false, hasSilent = false;
  const clip: Record<string, string> = {};
  const steps: Step[] = [];

  while (r.next()) {
    switch (r.field) {
      case 1: doKind = r.string(); break;
      case 2: actor = r.string(); break;
      case 3: xy.push(r.double()); break;
      case 4: size = r.double(); hasSize = true; break;
      case 5: back = r.bool(); break;
      case 6: hasBack = r.bool(); break;
      case 7: pic = r.string(); break;
      case 8: ms = r.double(); break;
      case 9: hasMs = r.bool(); break;
      case 10: deg = r.double(); break;
      case 11: hasDeg = r.bool(); break;
      case 12: target = r.string() as 'picture' | 'all'; break;
      case 13: part = r.string(); break;
      case 14: dx = r.double(); break;
      case 15: hasDx = r.bool(); break;
      case 16: dy = r.double(); break;
      case 17: hasDy = r.bool(); break;
      case 18: scaleX = r.double(); break;
      case 19: hasScaleX = r.bool(); break;
      case 20: scaleY = r.double(); break;
      case 21: hasScaleY = r.bool(); break;
      case 22: origin = r.string() as 'left' | 'right' | 'center' | 'top' | 'bottom'; break;
      case 23: glyph = readGlyphSel(r.sub()); break;
      case 24: color = r.string(); break;
      case 25: w = r.double(); break;
      case 26: hasW = r.bool(); break;
      case 27: h = r.double(); break;
      case 28: hasH = r.bool(); break;
      case 29: opacity = r.double(); break;
      case 30: hasOpacity = r.bool(); break;
      case 31: gait = r.string() as 'walk' | 'hop' | 'fly' | 'swim' | 'gallop'; break;
      case 32: ease = r.string(); break;
      case 33: motion = r.string() as typeof motion; break;
      case 34: toNum = r.double(); break;
      case 35: tone = r.string() as typeof tone; break;
      case 36: stage = r.string(); break;
      case 37: variant = r.string(); break;
      case 38: r.stringMapEntry(textL10n); break;
      case 39: captionNull = r.bool(); break;
      case 40: sign = r.string(); break;
      case 41: hold = r.double(); break;
      case 42: hasHold = r.bool(); break;
      case 43: textStr = r.string(); break;
      case 44: lang = r.string() as 'zh' | 'ui'; break;
      case 45: wait = r.bool(); break;
      case 46: hasWait = r.bool(); break;
      case 47: silent = r.bool(); break;
      case 48: hasSilent = r.bool(); break;
      case 49: r.stringMapEntry(clip); break;
      case 50: steps.push(readStep(r.sub())); break;
      default: r.skip();
    }
  }

  switch (doKind) {
    case 'place':
      return { do: 'place', actor, at: [xy[0] ?? 0, xy[1] ?? 0], size, ...(hasBack ? { back } : {}) };
    case 'picture':
      return { do: 'picture', actor, pic, ...(hasMs ? { ms } : {}) };
    case 'rotate':
      return { do: 'rotate', actor, deg, ...(target ? { target } : {}), ...(hasMs ? { ms } : {}) };
    case 'pose':
      return {
        do: 'pose',
        actor,
        part,
        ...(hasDx ? { dx } : {}),
        ...(hasDy ? { dy } : {}),
        ...(hasScaleX ? { scaleX } : {}),
        ...(hasScaleY ? { scaleY } : {}),
        ...(hasDeg ? { deg } : {}),
        ...(origin ? { origin } : {}),
        ...(hasMs ? { ms } : {}),
      };
    case 'draw':
      return { do: 'draw', actor, glyph: glyph!, ...(hasMs ? { ms } : {}), ...(color ? { color } : {}) };
    case 'show':
      return { do: 'show', actor, glyph: glyph!, ...(color ? { color } : {}) };
    case 'swap':
      return { do: 'swap', actor, glyph: glyph!, ...(hasMs ? { ms } : {}), ...(color ? { color } : {}) };
    case 'clearPicture':
      return { do: 'clearPicture', actor, ...(hasMs ? { ms } : {}) };
    case 'wash':
      return {
        do: 'wash',
        actor,
        color: color!,
        ...(hasSize ? { size } : {}),
        ...(hasW ? { w } : {}),
        ...(hasH ? { h } : {}),
        ...(hasOpacity ? { opacity } : {}),
        ...(hasMs ? { ms } : {}),
        ...(hasDx ? { dx } : {}),
        ...(hasDy ? { dy } : {}),
      };
    case 'move':
      return { do: 'move', actor, to: [xy[0] ?? 0, xy[1] ?? 0], ms, ...(gait ? { gait } : {}), ...(ease ? { ease } : {}) };
    case 'ambient':
      return { do: 'ambient', actor, motion };
    case 'fade':
      return { do: 'fade', actor, to: toNum, ...(hasMs ? { ms } : {}) };
    case 'scale':
      return { do: 'scale', actor, to: toNum, ...(hasMs ? { ms } : {}) };
    case 'remove':
      return { do: 'remove', actor, ...(hasMs ? { ms } : {}) };
    case 'bg':
      return { do: 'bg', tone, ...(hasMs ? { ms } : {}) };
    case 'stage':
      return { do: 'stage', stage, ...(variant ? { variant } : {}) };
    case 'caption':
      return { do: 'caption', text: captionNull ? null : textL10n };
    case 'tag':
      return { do: 'tag', actor, sign, ...(hasHold ? { hold } : {}), ...(hasDx ? { dx } : {}), ...(hasDy ? { dy } : {}) };
    case 'say':
      return {
        do: 'say',
        text: textStr !== undefined ? textStr : textL10n,
        lang,
        ...(hasWait ? { wait } : {}),
        ...(hasSilent ? { silent } : {}),
        ...(Object.keys(clip).length ? { clip } : {}),
      };
    case 'wait':
      return { do: 'wait', ms };
    case 'together':
      return { do: 'together', steps };
    default:
      throw new Error(`proto: unknown step do="${doKind}"`);
  }
}

function writeByteRange(w: ProtoWriter, field: number, [start, length]: ByteRange): void {
  w.sub(field, (s) => {
    s.uint32(1, start);
    s.uint32(2, length);
  });
}

function readByteRange(r: ProtoReader): ByteRange {
  let start = 0;
  let length = 0;
  while (r.next()) {
    if (r.field === 1) start = r.uint32();
    else if (r.field === 2) length = r.uint32();
    else r.skip();
  }
  return [start, length];
}

function writeAudio(w: ProtoWriter, field: number, a: AudioIndex | null): void {
  if (!a) return;
  w.sub(field, (s) => {
    s.string(1, a.mp3);
    for (const k of Object.keys(a.sections).sort()) {
      s.sub(2, (m) => {
        m.string(1, k);
        writeByteRange(m, 2, a.sections[k]);
      });
    }
    for (const ck of Object.keys(a.clips).sort()) {
      s.sub(3, (m) => {
        m.string(1, ck);
        m.sub(2, (cs) => {
          const per = a.clips[ck];
          for (const sec of Object.keys(per).sort()) {
            cs.sub(1, (entry) => {
              entry.string(1, sec);
              writeByteRange(entry, 2, per[sec]);
            });
          }
        });
      });
    }
  });
}

function readAudio(r: ProtoReader): AudioIndex {
  let mp3 = '';
  const sections: Record<string, [number, number]> = {};
  const clips: Record<string, Record<string, [number, number]>> = {};
  while (r.next()) {
    switch (r.field) {
      case 1: mp3 = r.string(); break;
      case 2: {
        const mr = r.sub();
        let k = '';
        let range: ByteRange = [0, 0];
        while (mr.next()) {
          if (mr.field === 1) k = mr.string();
          else if (mr.field === 2) range = readByteRange(mr.sub());
          else mr.skip();
        }
        sections[k] = range;
        break;
      }
      case 3: {
        const mr = r.sub();
        let ck = '';
        const per: Record<string, [number, number]> = {};
        while (mr.next()) {
          if (mr.field === 1) ck = mr.string();
          else if (mr.field === 2) {
            const csr = mr.sub();
            while (csr.next()) {
              if (csr.field === 1) {
                const er = csr.sub();
                let sec = '';
                let pos: ByteRange = [0, 0];
                while (er.next()) {
                  if (er.field === 1) sec = er.string();
                  else if (er.field === 2) pos = readByteRange(er.sub());
                  else er.skip();
                }
                per[sec] = pos;
              } else csr.skip();
            }
          } else mr.skip();
        }
        clips[ck] = per;
        break;
      }
      default: r.skip();
    }
  }
  return { mp3, sections, clips };
}

export function encodeSignBundle(b: SignBundle): Uint8Array {
  const w = new ProtoWriter();
  w.uint32(1, b.v);
  w.string(2, b.key);
  w.string(3, b.system);
  w.string(4, b.id);
  w.string(5, b.status);
  w.stringMap(6, b.text);
  w.stringMap(7, b.readings);
  w.string(8, b.reading);
  w.stringMap(9, b.meaning);
  w.stringMap(10, b.fact);
  if (b.topic) w.stringMap(11, b.topic);
  if (b.origin) {
    w.sub(12, (ow) => {
      ow.string(1, b.origin!.type);
      for (const p of b.origin!.parts ?? []) {
        ow.sub(2, (pw) => {
          pw.string(1, p.char);
          pw.string(2, p.role);
          if (p.gloss) pw.stringMap(3, p.gloss);
        });
      }
    });
  }
  for (const src of b.sources ?? []) {
    w.sub(13, (sw) => { sw.string(1, src.title); sw.string(2, src.url); });
  }
  if (b.ext) {
    for (const k of Object.keys(b.ext).sort()) {
      const val = b.ext[k];
      w.sub(14, (mw) => {
        mw.string(1, k);
        mw.sub(2, (vw) => {
          if (typeof val === 'string') vw.string(1, val);
          else if (typeof val === 'number') vw.double(2, val);
          else vw.bool(3, val);
        });
      });
    }
  }
  if (b.picture) writePicture(w, 15, b.picture);
  for (const f of b.forms) writeForm(w, 16, f);
  for (const k of Object.keys(b.strokes).sort()) {
    w.sub(17, (mw) => { mw.string(1, k); writeStrokes(mw, 2, b.strokes[k]); });
  }
  for (const st of b.stages) w.string(18, st);
  for (const k of Object.keys(b.cards).sort()) {
    w.sub(19, (mw) => {
      mw.string(1, k);
      mw.sub(2, (lw) => {
        for (const c of b.cards[k]) writeCard(lw, 1, c);
      });
    });
  }
  for (const st of b.scripts.full) writeStep(w, 20, st);
  for (const st of b.scripts.compact) writeStep(w, 21, st);
  if (b.clip) w.string(22, b.clip);
  writeAudio(w, 23, b.audio);
  return w.finish();
}

export function decodeSignBundle(bytes: Uint8Array): SignBundle {
  const r = new ProtoReader(bytes);
  let v: 1 = 1;
  let key = '';
  let system = '';
  let id = '';
  let status: 'draft' | 'reviewed' = 'draft';
  const text: Record<string, string> = {};
  const readings: Record<string, string> = {};
  let reading = '';
  const meaning: L10n = {};
  const fact: L10n = {};
  const topic: L10n = {};
  let origin: OriginB | undefined;
  const sources: { title: string; url: string }[] = [];
  const ext: Record<string, string | number | boolean> = {};
  let picture: PictureB | undefined;
  const forms: FormB[] = [];
  const strokes: Record<string, StrokesB> = {};
  const stages: string[] = [];
  const cards: Record<string, (CardB | null)[]> = {};
  const full: Step[] = [];
  const compact: Step[] = [];
  let clip: string | undefined;
  let audio: AudioIndex | null = null;

  while (r.next()) {
    switch (r.field) {
      case 1: v = r.uint32() as 1; break;
      case 2: key = r.string(); break;
      case 3: system = r.string(); break;
      case 4: id = r.string(); break;
      case 5: status = r.string() as 'draft' | 'reviewed'; break;
      case 6: r.stringMapEntry(text); break;
      case 7: r.stringMapEntry(readings); break;
      case 8: reading = r.string(); break;
      case 9: r.stringMapEntry(meaning); break;
      case 10: r.stringMapEntry(fact); break;
      case 11: r.stringMapEntry(topic); break;
      case 12: {
        const or = r.sub();
        let type = '';
        const parts: NonNullable<OriginB['parts']> = [];
        while (or.next()) {
          if (or.field === 1) type = or.string();
          else if (or.field === 2) {
            const pr = or.sub();
            let char = '';
            let role = '';
            const gloss: L10n = {};
            while (pr.next()) {
              if (pr.field === 1) char = pr.string();
              else if (pr.field === 2) role = pr.string();
              else if (pr.field === 3) pr.stringMapEntry(gloss);
              else pr.skip();
            }
            parts.push({ char, role, ...(Object.keys(gloss).length ? { gloss } : {}) });
          } else or.skip();
        }
        origin = { type, ...(parts.length ? { parts } : {}) };
        break;
      }
      case 13: {
        const sr = r.sub();
        let title = '', url = '';
        while (sr.next()) {
          if (sr.field === 1) title = sr.string();
          else if (sr.field === 2) url = sr.string();
          else sr.skip();
        }
        sources.push({ title, url });
        break;
      }
      case 14: {
        const mr = r.sub();
        let k = '';
        let val: string | number | boolean = '';
        while (mr.next()) {
          if (mr.field === 1) k = mr.string();
          else if (mr.field === 2) {
            const vr = mr.sub();
            while (vr.next()) {
              if (vr.field === 1) val = vr.string();
              else if (vr.field === 2) val = vr.double();
              else if (vr.field === 3) val = vr.bool();
              else vr.skip();
            }
          } else mr.skip();
        }
        ext[k] = val;
        break;
      }
      case 15: picture = readPicture(r.sub()); break;
      case 16: forms.push(readForm(r.sub())); break;
      case 17: {
        const mr = r.sub();
        let k = '';
        let st: StrokesB = { strokes: [], medians: [] };
        while (mr.next()) {
          if (mr.field === 1) k = mr.string();
          else if (mr.field === 2) st = readStrokes(mr.sub());
          else mr.skip();
        }
        strokes[k] = st;
        break;
      }
      case 18: stages.push(r.string()); break;
      case 19: {
        const mr = r.sub();
        let k = '';
        const list: (CardB | null)[] = [];
        while (mr.next()) {
          if (mr.field === 1) k = mr.string();
          else if (mr.field === 2) {
            const lr = mr.sub();
            while (lr.next()) {
              if (lr.field === 1) list.push(readCard(lr.sub()));
              else lr.skip();
            }
          } else mr.skip();
        }
        cards[k] = list;
        break;
      }
      case 20: full.push(readStep(r.sub())); break;
      case 21: compact.push(readStep(r.sub())); break;
      case 22: clip = r.string(); break;
      case 23: audio = readAudio(r.sub()); break;
      default: r.skip();
    }
  }

  return {
    v,
    key,
    system,
    id,
    status,
    text,
    readings,
    reading,
    meaning,
    fact,
    ...(Object.keys(topic).length ? { topic } : {}),
    ...(origin ? { origin } : {}),
    ...(sources.length ? { sources } : {}),
    ...(Object.keys(ext).length ? { ext } : {}),
    ...(picture ? { picture } : {}),
    forms,
    strokes,
    stages,
    cards,
    scripts: { full, compact },
    ...(clip ? { clip } : {}),
    audio,
  };
}

export function encodeStoryBundle(b: StoryBundle): Uint8Array {
  const w = new ProtoWriter();
  w.uint32(1, b.v);
  w.string(2, b.collection);
  w.string(3, b.id);
  w.uint32(4, b.unit);
  w.stringMap(5, b.title);
  w.stringMap(6, b.topic);
  for (const st of b.script) writeStep(w, 7, st);
  for (const k of Object.keys(b.glyphs).sort()) {
    const g = b.glyphs[k];
    w.sub(8, (mw) => {
      mw.string(1, k);
      mw.sub(2, (gw) => {
        gw.string(1, g.kind);
        if (g.kind === 'paths') writeForm(gw, 2, g.form);
        else writeStrokes(gw, 3, g.strokes);
      });
    });
  }
  for (const k of Object.keys(b.labels).sort()) {
    const l = b.labels[k];
    w.sub(9, (mw) => {
      mw.string(1, k);
      mw.sub(2, (lw) => { lw.stringMap(1, l.text); lw.string(2, l.reading); });
    });
  }
  if (b.pictures) {
    for (const k of Object.keys(b.pictures).sort()) {
      w.sub(10, (mw) => {
        mw.string(1, k);
        writePicture(mw, 2, b.pictures![k]);
      });
    }
  }
  writeAudio(w, 11, b.audio);
  return w.finish();
}

export function decodeStoryBundle(bytes: Uint8Array): StoryBundle {
  const r = new ProtoReader(bytes);
  let v: 1 = 1;
  let collection = '';
  let id = '';
  let unit = 0;
  const title: L10n = {};
  const topic: L10n = {};
  const script: Step[] = [];
  const glyphs: Record<string, GlyphData> = {};
  const labels: Record<string, SignLabel> = {};
  const pictures: Record<string, PictureB> = {};
  let audio: AudioIndex | null = null;

  while (r.next()) {
    switch (r.field) {
      case 1: v = r.uint32() as 1; break;
      case 2: collection = r.string(); break;
      case 3: id = r.string(); break;
      case 4: unit = r.uint32(); break;
      case 5: r.stringMapEntry(title); break;
      case 6: r.stringMapEntry(topic); break;
      case 7: script.push(readStep(r.sub())); break;
      case 8: {
        const mr = r.sub();
        let k = '';
        let g: GlyphData | undefined;
        while (mr.next()) {
          if (mr.field === 1) k = mr.string();
          else if (mr.field === 2) {
            const gr = mr.sub();
            let kind = '';
            let form: FormB | undefined;
            let strokes: StrokesB | undefined;
            while (gr.next()) {
              if (gr.field === 1) kind = gr.string();
              else if (gr.field === 2) form = readForm(gr.sub());
              else if (gr.field === 3) strokes = readStrokes(gr.sub());
              else gr.skip();
            }
            if (kind === 'paths' && form) g = { kind: 'paths', form };
            else if (kind === 'strokes' && strokes) g = { kind: 'strokes', strokes };
          } else mr.skip();
        }
        if (g) glyphs[k] = g;
        break;
      }
      case 9: {
        const mr = r.sub();
        let k = '';
        const text: Record<string, string> = {};
        let reading = '';
        while (mr.next()) {
          if (mr.field === 1) k = mr.string();
          else if (mr.field === 2) {
            const lr = mr.sub();
            while (lr.next()) {
              if (lr.field === 1) lr.stringMapEntry(text);
              else if (lr.field === 2) reading = lr.string();
              else lr.skip();
            }
          } else mr.skip();
        }
        labels[k] = { text, reading };
        break;
      }
      case 10: {
        const mr = r.sub();
        let k = '';
        let p: PictureB | undefined;
        while (mr.next()) {
          if (mr.field === 1) k = mr.string();
          else if (mr.field === 2) p = readPicture(mr.sub());
          else mr.skip();
        }
        if (p) pictures[k] = p;
        break;
      }
      case 11: audio = readAudio(r.sub()); break;
      default: r.skip();
    }
  }
  return {
    v,
    collection,
    id,
    unit,
    title,
    topic,
    script,
    glyphs,
    labels,
    ...(Object.keys(pictures).length ? { pictures } : {}),
    audio,
  };
}

export function encodeCollectionBundle(b: CollectionBundle): Uint8Array {
  const w = new ProtoWriter();
  w.uint32(1, b.v);
  w.string(2, b.id);
  w.string(3, b.system);
  w.stringMap(4, b.title);
  for (const f of b.featured) w.string(5, f);
  for (const u of b.units) {
    w.sub(6, (uw) => {
      uw.uint32(1, u.n);
      uw.stringMap(2, u.title);
      uw.string(3, u.color);
      uw.bool(4, u.playable);
      for (const s of u.signs) uw.string(5, s);
      if (u.story) uw.string(6, u.story);
    });
  }
  for (const l of b.lessons) {
    w.sub(7, (lw) => {
      lw.string(1, l.id);
      lw.uint32(2, l.unit);
      lw.string(3, l.kind);
      for (const s of l.signs) lw.string(4, s);
    });
  }
  for (const k of Object.keys(b.signs).sort()) {
    const s = b.signs[k];
    w.sub(8, (mw) => {
      mw.string(1, k);
      mw.sub(2, (sw) => {
        sw.string(1, s.key);
        sw.string(2, s.id);
        sw.stringMap(3, s.text);
        sw.string(4, s.reading);
        sw.stringMap(5, s.meaning);
        sw.string(6, s.file);
        if (s.range) writeByteRange(sw, 7, s.range);
        if (s.clip) sw.string(8, s.clip);
      });
    });
  }
  for (const st of b.stories) {
    w.sub(9, (sw) => {
      sw.string(1, st.id);
      sw.uint32(2, st.unit);
      sw.stringMap(3, st.title);
      sw.stringMap(4, st.topic);
      sw.string(5, st.file);
      if (st.range) writeByteRange(sw, 6, st.range);
    });
  }
  writeAudio(w, 10, b.audio);
  return w.finish();
}

export function decodeCollectionBundle(bytes: Uint8Array): CollectionBundle {
  const r = new ProtoReader(bytes);
  let v: 1 = 1;
  let id = '';
  let system = '';
  const title: L10n = {};
  const featured: string[] = [];
  const units: UnitB[] = [];
  const lessons: LessonB[] = [];
  const signs: Record<string, SignSummary> = {};
  const stories: StoryRefB[] = [];
  let audio: AudioIndex | null = null;

  while (r.next()) {
    switch (r.field) {
      case 1: v = r.uint32() as 1; break;
      case 2: id = r.string(); break;
      case 3: system = r.string(); break;
      case 4: r.stringMapEntry(title); break;
      case 5: featured.push(r.string()); break;
      case 6: {
        const ur = r.sub();
        let n = 0;
        const uTitle: L10n = {};
        let color = '';
        let playable = false;
        const uSigns: string[] = [];
        let story: string | undefined;
        while (ur.next()) {
          switch (ur.field) {
            case 1: n = ur.uint32(); break;
            case 2: ur.stringMapEntry(uTitle); break;
            case 3: color = ur.string(); break;
            case 4: playable = ur.bool(); break;
            case 5: uSigns.push(ur.string()); break;
            case 6: story = ur.string(); break;
            default: ur.skip();
          }
        }
        units.push({ n, title: uTitle, color, playable, signs: uSigns, ...(story ? { story } : {}) });
        break;
      }
      case 7: {
        const lr = r.sub();
        let lId = '';
        let unit = 0;
        let kind: 'learn' | 'review' | 'story' = 'learn';
        const lSigns: string[] = [];
        while (lr.next()) {
          switch (lr.field) {
            case 1: lId = lr.string(); break;
            case 2: unit = lr.uint32(); break;
            case 3: kind = lr.string() as typeof kind; break;
            case 4: lSigns.push(lr.string()); break;
            default: lr.skip();
          }
        }
        lessons.push({ id: lId, unit, kind, signs: lSigns });
        break;
      }
      case 8: {
        const mr = r.sub();
        let k = '';
        let summary: SignSummary | undefined;
        while (mr.next()) {
          if (mr.field === 1) k = mr.string();
          else if (mr.field === 2) {
            const sr = mr.sub();
            let sKey = '', sId = '', reading = '', file = '';
            const text: Record<string, string> = {};
            const meaning: L10n = {};
            let range: ByteRange | undefined;
            let clip: string | undefined;
            while (sr.next()) {
              switch (sr.field) {
                case 1: sKey = sr.string(); break;
                case 2: sId = sr.string(); break;
                case 3: sr.stringMapEntry(text); break;
                case 4: reading = sr.string(); break;
                case 5: sr.stringMapEntry(meaning); break;
                case 6: file = sr.string(); break;
                case 7: range = readByteRange(sr.sub()); break;
                case 8: clip = sr.string(); break;
                default: sr.skip();
              }
            }
            summary = {
              key: sKey,
              id: sId,
              text,
              reading,
              meaning,
              file,
              ...(range ? { range } : {}),
              ...(clip ? { clip } : {}),
            };
          } else mr.skip();
        }
        if (summary) signs[k] = summary;
        break;
      }
      case 9: {
        const sr = r.sub();
        let sId = '', file = '';
        let unit = 0;
        const sTitle: L10n = {};
        const sTopic: L10n = {};
        let range: ByteRange | undefined;
        while (sr.next()) {
          switch (sr.field) {
            case 1: sId = sr.string(); break;
            case 2: unit = sr.uint32(); break;
            case 3: sr.stringMapEntry(sTitle); break;
            case 4: sr.stringMapEntry(sTopic); break;
            case 5: file = sr.string(); break;
            case 6: range = readByteRange(sr.sub()); break;
            default: sr.skip();
          }
        }
        stories.push({ id: sId, unit, title: sTitle, topic: sTopic, file, ...(range ? { range } : {}) });
        break;
      }
      case 10: audio = readAudio(r.sub()); break;
      default: r.skip();
    }
  }
  return { v, id, system, title, featured, units, lessons, signs, stories, audio };
}
