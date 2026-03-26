import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "..", "assets");
mkdirSync(assetsDir, { recursive: true });

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c;
  }
  return t;
})();

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function be32(v) {
  const a = new Uint8Array(4);
  a[0] = v >>> 24;
  a[1] = (v >>> 16) & 0xff;
  a[2] = (v >>> 8) & 0xff;
  a[3] = v & 0xff;
  return a;
}

function chunk(type, data) {
  const tb = new TextEncoder().encode(type);
  const p = new Uint8Array(tb.length + data.length);
  p.set(tb);
  p.set(data, tb.length);
  const c = crc32(p);
  const r = new Uint8Array(4 + p.length + 4);
  r.set(be32(data.length));
  r.set(p, 4);
  r.set(be32(c), 4 + p.length);
  return r;
}

function generateIcon(size) {
  const w = size;
  const h = size;
  const img = new Uint8Array(w * h * 4);

  function set(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    if (a === 255) {
      img[i] = r;
      img[i + 1] = g;
      img[i + 2] = b;
      img[i + 3] = 255;
    }
  }

  function circleFill(cx, cy, radius, r, g, b) {
    for (let y = Math.max(0, cy - radius); y <= Math.min(h - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(w - 1, cx + radius); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          set(x, y, r, g, b);
        }
      }
    }
  }

  function rectFill(rx, ry, rw, rh, r, g, b) {
    for (let dy = 0; dy < rh; dy++) {
      for (let dx = 0; dx < rw; dx++) {
        set(rx + dx, ry + dy, r, g, b);
      }
    }
  }

  function triangleFill(x1, y1, x2, y2, x3, y3, r, g, b) {
    const minY = Math.max(0, Math.ceil(Math.min(y1, y2, y3)));
    const maxY = Math.min(h - 1, Math.floor(Math.max(y1, y2, y3)));
    for (let y = minY; y <= maxY; y++) {
      let lo = w;
      let hi = -1;
      for (const [ax, ay, bx, by] of [
        [x1, y1, x2, y2],
        [x2, y2, x3, y3],
        [x3, y3, x1, y1]
      ]) {
        if ((ay <= y && y <= by) || (by <= y && y <= ay)) {
          if (Math.abs(ay - by) < 0.5) {
            lo = Math.min(lo, ax, bx);
            hi = Math.max(hi, ax, bx);
          } else {
            const t = (y - ay) / (by - ay);
            const x = ax + t * (bx - ax);
            lo = Math.min(lo, Math.round(x));
            hi = Math.max(hi, Math.round(x));
          }
        }
      }
      for (let x = Math.max(0, lo); x <= Math.min(w - 1, hi); x++) {
        set(x, y, r, g, b);
      }
    }
  }

  const cx = w >> 1;
  const cy = h >> 1;
  const R = (w >> 1) - 1;

  circleFill(cx, cy, R, 0x46, 0x7e, 0xff);

  const s = w / 32;
  const shaftX = Math.round(cx - 2 * s);
  const shaftY = Math.round(5 * s);
  const shaftW = Math.round(4 * s);
  const shaftH = Math.round(12 * s);
  rectFill(shaftX, shaftY, shaftW, shaftH, 255, 255, 255);

  const tipX = cx;
  const tipY = Math.round(22 * s);
  const baseY = shaftY + shaftH;
  const halfW = Math.round(6 * s);
  triangleFill(tipX - halfW, baseY, tipX + halfW, baseY, tipX, tipY, 255, 255, 255);

  const raw = new Uint8Array(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    raw.set(img.slice(y * w * 4, (y + 1) * w * 4), y * (1 + w * 4) + 1);
  }

  const comp = deflateSync(raw);
  const ihdr = new Uint8Array(13);
  ihdr.set(be32(w));
  ihdr.set(be32(h), 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", comp), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

writeFileSync(join(assetsDir, "tray-16.png"), generateIcon(16));
writeFileSync(join(assetsDir, "tray-32.png"), generateIcon(32));
console.log("Icons generated in:", assetsDir);
