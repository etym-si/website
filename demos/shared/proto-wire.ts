// Zero-dependency Protocol Buffers (proto3) wire reader and writer.
// Implements standard proto3 wire types: 0 (varint), 1 (64-bit float64), 2 (length-delimited), 5 (32-bit).
export const WIRE_VARINT = 0;
export const WIRE_64 = 1;
export const WIRE_LEN = 2;
export const WIRE_32 = 5;

const enc = new TextEncoder();
const dec = new TextDecoder();

export class ProtoWriter {
  private chunks: Uint8Array[] = [];
  private len = 0;

  private push(b: Uint8Array): void {
    this.chunks.push(b);
    this.len += b.length;
  }

  rawVarint(v: number): void {
    let n = v >>> 0;
    const out: number[] = [];
    while (n > 0x7f) {
      out.push((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    out.push(n & 0x7f);
    this.push(new Uint8Array(out));
  }

  tag(field: number, wire: number): void {
    this.rawVarint((field << 3) | wire);
  }

  uint32(field: number, v: number): void {
    this.tag(field, WIRE_VARINT);
    this.rawVarint(v >>> 0);
  }

  sint32(field: number, v: number): void {
    const n = v | 0;
    this.uint32(field, ((n << 1) ^ (n >> 31)) >>> 0);
  }

  bool(field: number, v: boolean): void {
    this.uint32(field, v ? 1 : 0);
  }

  double(field: number, v: number): void {
    this.tag(field, WIRE_64);
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, v, true);
    this.push(b);
  }

  bytes(field: number, b: Uint8Array): void {
    this.tag(field, WIRE_LEN);
    this.rawVarint(b.length);
    this.push(b);
  }

  string(field: number, s: string): void {
    this.bytes(field, enc.encode(s));
  }

  sub(field: number, fn: (w: ProtoWriter) => void): void {
    const child = new ProtoWriter();
    fn(child);
    this.bytes(field, child.finish());
  }

  stringMap(field: number, map: Record<string, string>): void {
    for (const k of Object.keys(map)) {
      this.sub(field, (w) => {
        w.string(1, k);
        w.string(2, map[k]);
      });
    }
  }

  finish(): Uint8Array {
    const out = new Uint8Array(this.len);
    let at = 0;
    for (const c of this.chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  }
}

export class ProtoReader {
  readonly buf: Uint8Array;
  pos = 0;
  readonly end: number;
  field = 0;
  wire = 0;
  private readonly view: DataView;

  constructor(buf: Uint8Array, start = 0, end = buf.length) {
    this.buf = buf;
    this.pos = start;
    this.end = end;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  next(): boolean {
    if (this.pos >= this.end) return false;
    const t = this.rawVarint();
    this.field = t >>> 3;
    this.wire = t & 0x07;
    if (this.field === 0) throw new Error('proto: invalid field number 0');
    return true;
  }

  rawVarint(): number {
    let res = 0;
    let shift = 0;
    while (this.pos < this.end) {
      const b = this.buf[this.pos++];
      res |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return res >>> 0;
      shift += 7;
      if (shift > 35) throw new Error('proto: varint overflow');
    }
    throw new Error('proto: truncated varint');
  }

  uint32(): number {
    if (this.wire !== WIRE_VARINT) throw new Error(`proto: expected varint for field ${this.field}`);
    return this.rawVarint();
  }

  sint32(): number {
    const n = this.uint32();
    return (n >>> 1) ^ -(n & 1);
  }

  bool(): boolean {
    return this.uint32() !== 0;
  }

  double(): number {
    if (this.wire !== WIRE_64) throw new Error(`proto: expected 64-bit wire for field ${this.field}`);
    if (this.pos + 8 > this.end) throw new Error('proto: truncated double');
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  bytes(): Uint8Array {
    if (this.wire !== WIRE_LEN) throw new Error(`proto: expected length-delimited wire for field ${this.field}`);
    const len = this.rawVarint();
    if (this.pos + len > this.end) throw new Error('proto: truncated bytes');
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  string(): string {
    return dec.decode(this.bytes());
  }

  sub(): ProtoReader {
    if (this.wire !== WIRE_LEN) throw new Error(`proto: expected length-delimited wire for field ${this.field}`);
    const len = this.rawVarint();
    if (this.pos + len > this.end) throw new Error('proto: truncated submessage');
    const r = new ProtoReader(this.buf, this.pos, this.pos + len);
    this.pos += len;
    return r;
  }

  stringMapEntry(target: Record<string, string>): void {
    const r = this.sub();
    let k = '';
    let v = '';
    while (r.next()) {
      if (r.field === 1) k = r.string();
      else if (r.field === 2) v = r.string();
      else r.skip();
    }
    target[k] = v;
  }

  skip(): void {
    switch (this.wire) {
      case WIRE_VARINT:
        this.rawVarint();
        return;
      case WIRE_64:
        if (this.pos + 8 > this.end) throw new Error('proto: truncated 64-bit skip');
        this.pos += 8;
        return;
      case WIRE_LEN: {
        const len = this.rawVarint();
        if (this.pos + len > this.end) throw new Error('proto: truncated length-delimited skip');
        this.pos += len;
        return;
      }
      case WIRE_32:
        if (this.pos + 4 > this.end) throw new Error('proto: truncated 32-bit skip');
        this.pos += 4;
        return;
      default:
        throw new Error(`proto: unsupported wire type ${this.wire}`);
    }
  }
}
