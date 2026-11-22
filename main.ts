// the-picture-that-tastes-of-one-20261122-2047
// Program Node 22 (tanpa dependensi) yang menggambar satu mangkuk ramen
// close-up dan menulisnya ke /output/entry.png (PNG 1024x1024).
// Sepenuhnya prosedural dan deterministik: PRNG ber-seed tetap, tanpa
// network, tanpa Date/Math.random. Encoder PNG ditulis sendiri dari
// buffer RGB + zlib deflate.

import * as fs from "node:fs";
import * as zlib from "node:zlib";
import * as path from "node:path";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- PRNG ---
// mulberry32: PRNG kecil yang deterministik untuk seed yang sama.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261122);

// ------------------------------------------------------- value noise ------
const GRID = 64;
const gridVals: number[] = [];
for (let i = 0; i < (GRID + 1) * (GRID + 1); i++) gridVals.push(rand());

function vnoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  const gx = xi % GRID;
  const gy = yi % GRID;
  const at = (a: number, b: number) =>
    gridVals[b * (GRID + 1) + a];
  const v00 = at(gx, gy);
  const v10 = at(gx + 1, gy);
  const v01 = at(gx, gy + 1);
  const v11 = at(gx + 1, gy + 1);
  const top = v00 + (v10 - v00) * sx;
  const bot = v01 + (v11 - v01) * sx;
  return top + (bot - top) * sy;
}

function fbm(x: number, y: number): number {
  return (
    vnoise(x, y) * 0.6 +
    vnoise(x * 2.13 + 7.7, y * 2.13 + 3.1) * 0.28 +
    vnoise(x * 4.31 + 13.7, y * 4.31 + 9.4) * 0.12
  );
}

// ---------------------------------------------------------- image buffer --
const img = new Uint8ClampedArray(W * H * 3);

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = x < a ? 0 : x > b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

// Campur warna (r,g,b) dengan alpha 0..1 ke piksel (x,y).
function blend(x: number, y: number, r: number, g: number, b: number, a: number): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= W || py >= H) return;
  if (a <= 0) return;
  const i = (py * W + px) * 3;
  if (a >= 1) {
    img[i] = clamp255(r);
    img[i + 1] = clamp255(g);
    img[i + 2] = clamp255(b);
    return;
  }
  const ia = 1 - a;
  img[i] = clamp255(r * a + img[i] * ia);
  img[i + 1] = clamp255(g * a + img[i + 1] * ia);
  img[i + 2] = clamp255(b * a + img[i + 2] * ia);
}

// Isi elips padat dengan warna + alpha.
function ellipse(
  cx: number, cy: number, rx: number, ry: number,
  r: number, g: number, b: number, a: number,
): void {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const dy = (y - cy) / ry;
    const dxMax = Math.sqrt(Math.max(0, 1 - dy * dy));
    const xa = Math.max(x0, Math.ceil(cx - rx * dxMax));
    const xb = Math.min(x1, Math.floor(cx + rx * dxMax));
    for (let x = xa; x <= xb; x++) {
      blend(x, y, r, g, b, a);
    }
  }
}

// Elips dengan gradien radial: warna dalam -> warna luar.
function ellipseGrad(
  cx: number, cy: number, rx: number, ry: number,
  c0: [number, number, number], c1: [number, number, number],
  a: number,
): void {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const dy = (y - cy) / ry;
    const dxMax = Math.sqrt(Math.max(0, 1 - dy * dy));
    const xa = Math.max(x0, Math.ceil(cx - rx * dxMax));
    const xb = Math.min(x1, Math.floor(cx + rx * dxMax));
    for (let x = xa; x <= xb; x++) {
      const dx = (x - cx) / rx;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      blend(
        x, y,
        lerp(c0[0], c1[0], d),
        lerp(c0[1], c1[1], d),
        lerp(c0[2], c1[2], d),
        a,
      );
    }
  }
}

function disc(cx: number, cy: number, rad: number, r: number, g: number, b: number, a: number): void {
  ellipse(cx, cy, rad, rad, r, g, b, a);
}

// Garis tebal dengan ujung bulat, digambar sebagai deretan cakram.
function thickLine(
  x0: number, y0: number, x1: number, y1: number, w: number,
  r: number, g: number, b: number, a: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / (w * 0.4)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    disc(x0 + dx * t, y0 + dy * t, w / 2, r, g, b, a);
  }
}

// Garis lengkung (quadratic bezier) tebal, ujung bulat.
function thickCurve(
  x0: number, y0: number, cx: number, cy: number,
  x1: number, y1: number, w: number,
  r: number, g: number, b: number, a: number,
): void {
  const steps = 48;
  let px = x0;
  let py = y0;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const mt = 1 - t;
    const x = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
    const y = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
    thickLine(px, py, x, y, w, r, g, b, a);
    px = x;
    py = y;
  }
}

// ------------------------------------------------------------- meja kayu ---
// Meja kayu hangat: gradien vertikal + serat kayu dari value noise.
function drawTable(): void {
  for (let y = 0; y < H; y++) {
    const vt = y / H;
    // Cokelat hangat: lebih terang di atas, gelap di bawah.
    let r = lerp(122, 58, vt);
    let g = lerp(78, 36, vt);
    let b = lerp(42, 20, vt);
    for (let x = 0; x < W; x++) {
      const grain = fbm(x * 0.012, y * 0.045);
      const band = 0.5 + 0.5 * Math.sin(y * 0.045 + grain * 9.0);
      const m = 0.86 + grain * 0.22 + band * 0.06;
      const i = (y * W + x) * 3;
      img[i] = clamp255(r * m);
      img[i + 1] = clamp255(g * m);
      img[i + 2] = clamp255(b * m);
    }
  }
  // Noda cahaya lembut dari atas kiri.
  ellipseGrad(300, 180, 620, 420, [255, 214, 150], [255, 214, 150], 0.0);
  ellipse(300, 180, 620, 420, 255, 205, 140, 0.05);
}

// -------------------------------------------------------------- mangkuk ---
function drawBowl(): void {
  // Bayangan mangkuk di meja.
  ellipse(512, 640, 430, 300, 20, 10, 6, 0.45);
  ellipse(512, 620, 410, 285, 16, 9, 5, 0.35);
  // Badan mangkuk: keramik gelap dengan gradien radial.
  ellipseGrad(
    512, 560, 402, 318,
    [58, 52, 74], [24, 21, 32],
    1,
  );
  // Kilau keramik di tepi kiri atas.
  ellipse(300, 330, 150, 70, 150, 140, 180, 0.16);
  ellipse(280, 320, 80, 36, 190, 180, 220, 0.18);
  // Bibir mangkuk: cincin terang.
  ellipse(512, 545, 356, 274, 92, 84, 112, 1);
  ellipse(512, 545, 344, 262, 70, 62, 88, 1);
}

// ---------------------------------------------------------------- kuah ----
function drawBroth(): void {
  // Permukaan kaldu: emas hangat, lebih terang di tengah.
  ellipseGrad(
    512, 545, 344, 262,
    [232, 158, 62], [158, 88, 22],
    1,
  );
  // Pusaran minyak: bercak-bercak keemasan lembut.
  for (let k = 0; k < 26; k++) {
    const ang = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * 0.85;
    const x = 512 + Math.cos(ang) * rad * 330;
    const y = 545 + Math.sin(ang) * rad * 250;
    const s = 26 + rand() * 60;
    ellipse(x, y, s, s * 0.62, 255, 196, 90, 0.10 + rand() * 0.10);
  }
  // Tetesan minyak cabai: merah-oranye mengilap.
  for (let k = 0; k < 9; k++) {
    const ang = rand() * Math.PI * 2;
    const rad = 0.45 + rand() * 0.45;
    const x = 512 + Math.cos(ang) * rad * 300;
    const y = 545 + Math.sin(ang) * rad * 225;
    const s = 10 + rand() * 16;
    ellipse(x, y, s, s * 0.7, 198, 52, 18, 0.75);
    ellipse(x - s * 0.25, y - s * 0.3, s * 0.32, s * 0.2, 255, 150, 80, 0.8);
  }
  // Kilau besar kaldu di kiri atas.
  ellipse(400, 430, 190, 80, 255, 220, 140, 0.20);
  ellipse(390, 425, 110, 42, 255, 240, 180, 0.22);
}

// ------------------------------------------------------------------- mi ----
// Satu helai mi bergelombang horizontal di dalam elips kuah.
function noodleStrand(yBase: number, amp: number, freq: number, phase: number): void {
  const cy = 545;
  const ry = 250;
  const dy = (yBase - cy) / ry;
  if (Math.abs(dy) >= 1) return;
  const half = 330 * Math.sqrt(1 - dy * dy);
  const x0 = 512 - half + 14;
  const x1 = 512 + half - 14;
  const shade = 0.82 + rand() * 0.3;
  const r = 238 * shade;
  const g = 196 * shade;
  const b = 110 * shade;
  const steps = 64;
  let px = x0;
  let py = yBase;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const x = x0 + (x1 - x0) * t;
    const y = yBase + Math.sin(t * freq * Math.PI * 2 + phase) * amp;
    thickLine(px, py, x, y, 8, r, g, b, 0.95);
    px = x;
    py = y;
  }
  // Highlight tipis di atas helai.
  const hx0 = x0 + 8;
  const hx1 = x1 - 8;
  let qx = hx0;
  let qy = yBase - 2;
  for (let s = 1; s <= 48; s++) {
    const t = s / 48;
    const x = hx0 + (hx1 - hx0) * t;
    const y = yBase - 2 + Math.sin(t * freq * Math.PI * 2 + phase) * amp;
    thickLine(qx, qy, x, y, 2.5, 255, 232, 170, 0.5);
    qx = x;
    qy = y;
  }
}

function drawNoodles(): void {
  // Lapisan bayangan dulu (lebih gelap, sedikit bergeser ke bawah).
  for (let k = 0; k < 34; k++) {
    const y = 380 + rand() * 330;
    noodleStrand(y + 5, 9 + rand() * 12, 2 + Math.floor(rand() * 3), rand() * 6.28);
  }
  // Lapisan utama: mi kuning keemasan bergelombang.
  for (let k = 0; k < 46; k++) {
    const y = 375 + rand() * 335;
    noodleStrand(y, 8 + rand() * 13, 2 + Math.floor(rand() * 3), rand() * 6.28);
  }
}

// Mi yang diangkat sumpit: gumpalan melengkung ke arah sumpit.
function drawLiftedNoodles(): void {
  // Bayangan gumpalan di kuah.
  ellipse(560, 480, 120, 46, 120, 62, 14, 0.28);
  // Helai-helai terpisah: menyempit di ujung sumpit, melebar di kuah,
  // dengan celah gelap di antaranya agar terbaca sebagai mi, bukan kipas.
  for (let k = 0; k < 12; k++) {
    const off = (k - 5.5) * 10;
    const shade = 0.85 + rand() * 0.3;
    const r = 242 * shade;
    const g = 202 * shade;
    const b = 118 * shade;
    // Dari gumpalan mi di tengah ke ujung sumpit di kanan atas.
    thickCurve(
      545 + off * 1.6, 478 + Math.abs(off) * 0.5,
      625 + off * 0.8, 385 - Math.abs(off) * 0.2,
      692 + off * 0.35, 318,
      6.5, r, g, b, 0.98,
    );
    thickCurve(
      545 + off * 1.6, 478 + Math.abs(off) * 0.5,
      625 + off * 0.8, 385 - Math.abs(off) * 0.2,
      692 + off * 0.35, 318,
      2.2, 255, 236, 175, 0.45,
    );
  }
}

// ---------------------------------------------------------------- topping --
// Telur rebus setengah matang: putih mengilap + kuning oranye.
function drawEgg(): void {
  // Putih telur.
  ellipseGrad(348, 648, 82, 64, [252, 246, 232], [214, 200, 178], 1);
  // Kuning telur: oranye pekat berkilau.
  ellipseGrad(348, 648, 44, 38, [255, 176, 66], [224, 110, 16], 1);
  // Kilau pada kuning.
  ellipse(332, 632, 16, 9, 255, 226, 150, 0.75);
  // Kilau pada putih.
  ellipse(310, 612, 22, 10, 255, 255, 255, 0.35);
}

// Chashu: irisan daging babi panggang, pinggir cokelat, tengah merah muda.
function drawChashu(cx: number, cy: number, rad: number): void {
  ellipseGrad(cx, cy, rad, rad * 0.92, [214, 128, 104], [146, 74, 58], 1);
  // Lingkaran lemak krem di dalam.
  ellipse(cx, cy, rad * 0.62, rad * 0.56, 238, 196, 164, 0.95);
  ellipse(cx, cy, rad * 0.42, rad * 0.38, 206, 118, 96, 0.95);
  // Kilau berminyak.
  ellipse(cx - rad * 0.3, cy - rad * 0.34, rad * 0.3, rad * 0.16, 255, 210, 180, 0.4);
}

// Narutomaki: cakram putih dengan spiral merah muda.
function drawNarutomaki(cx: number, cy: number, rad: number): void {
  disc(cx, cy, rad, 250, 244, 232, 1);
  disc(cx, cy, rad * 0.82, 226, 84, 118, 1);
  disc(cx, cy, rad * 0.62, 250, 244, 232, 1);
  disc(cx, cy, rad * 0.42, 226, 84, 118, 1);
  disc(cx, cy, rad * 0.2, 250, 244, 232, 1);
  ellipse(cx - rad * 0.3, cy - rad * 0.35, rad * 0.22, rad * 0.12, 255, 255, 255, 0.5);
}

// Daun bawang: cincin hijau kecil tersebar di kuah.
function drawGreenOnions(): void {
  for (let k = 0; k < 30; k++) {
    const ang = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * 0.9;
    const x = 512 + Math.cos(ang) * rad * 320;
    const y = 545 + Math.sin(ang) * rad * 240;
    // Hindari menutupi telur dan chashu.
    if (Math.hypot(x - 348, y - 648) < 95) continue;
    if (Math.hypot(x - 700, y - 640) < 105) continue;
    const s = 7 + rand() * 6;
    const tilt = rand() * Math.PI;
    const rx = s;
    const ry = s * (0.45 + rand() * 0.3);
    void tilt;
    ellipse(x, y, rx, ry, 52, 138, 58, 0.95);
    ellipse(x, y, rx * 0.55, ry * 0.55, 126, 196, 96, 0.95);
    ellipse(x, y, rx * 0.25, ry * 0.25, 34, 96, 40, 0.95);
  }
}

// Wijen putih di atas kuah.
function drawSesame(): void {
  for (let k = 0; k < 40; k++) {
    const ang = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * 0.92;
    const x = 512 + Math.cos(ang) * rad * 325;
    const y = 545 + Math.sin(ang) * rad * 245;
    ellipse(x, y, 4.5, 2.6, 250, 240, 210, 0.9);
  }
}

// ---------------------------------------------------------------- sumpit ---
function drawChopsticks(): void {
  // Dua sumpit kayu dari kanan atas ke gumpalan mi.
  thickLine(700, 300, 968, 96, 17, 122, 78, 34, 1);
  thickLine(700, 300, 968, 96, 11, 158, 104, 48, 1);
  thickLine(700, 300, 968, 96, 3.5, 198, 140, 74, 0.8);
  thickLine(676, 322, 930, 128, 17, 110, 70, 30, 1);
  thickLine(676, 322, 930, 128, 11, 146, 96, 44, 1);
  thickLine(676, 322, 930, 128, 3.5, 186, 130, 68, 0.8);
  // Ujung sumpit menjepit mi.
  disc(700, 300, 9, 110, 70, 30, 1);
  disc(676, 322, 9, 100, 64, 28, 1);
}

// ------------------------------------------------------------------ uap ----
// Uap tipis mengepul: banyak elips putih sangat transparan berlapis.
function drawSteam(): void {
  const columns: Array<[number, number, number]> = [
    [430, 330, 1.0],
    [520, 300, 1.25],
    [610, 330, 0.9],
  ];
  for (const [bx, by, scale] of columns) {
    for (let k = 0; k < 44; k++) {
      const t = k / 44;
      const y = by - t * 230 * scale;
      const drift = Math.sin(t * 7 + bx * 0.7) * 26 * t;
      const x = bx + drift + (rand() - 0.5) * 18;
      const s = (9 + t * 30) * scale;
      ellipse(x, y, s, s * 1.9, 255, 250, 244, 0.022);
    }
  }
}

// --------------------------------------------------------------- vignette --
// Gelapkan tepi dan beri gradasi hangat agar mata tertuju ke mangkuk.
function drawVignette(): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - 512) / 512;
      const dy = (y - 512) / 512;
      const d = Math.sqrt(dx * dx + dy * dy);
      const v = smoothstep(0.62, 1.25, d);
      if (v <= 0) continue;
      const i = (y * W + x) * 3;
      const m = 1 - 0.38 * v;
      img[i] = clamp255(img[i] * m);
      img[i + 1] = clamp255(img[i + 1] * m);
      img[i + 2] = clamp255(img[i + 2] * m);
    }
  }
}

// ------------------------------------------------------------ encoder PNG --
// CRC32 (polinomial 0xEDB88320) untuk chunk PNG.
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE.push(c >>> 0);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(): Buffer {
  // Data mentah: tiap baris diawali byte filter 0, lalu piksel RGB.
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const rowStart = y * (W * 3 + 1);
    raw[rowStart] = 0;
    raw.set(img.subarray(y * W * 3, (y + 1) * W * 3), rowStart + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ main ---
function main(): void {
  drawTable();
  drawBowl();
  drawBroth();
  drawNoodles();
  drawChashu(706, 636, 88);
  drawChashu(742, 556, 72);
  drawNarutomaki(636, 428, 34);
  drawNarutomaki(392, 452, 28);
  drawEgg();
  drawGreenOnions();
  drawSesame();
  drawLiftedNoodles();
  drawChopsticks();
  drawSteam();
  drawVignette();

  const png = encodePng();
  const outPath = process.env.ENTRY_PNG || "/output/entry.png";
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
}

main();
