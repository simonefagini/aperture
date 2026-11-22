// Find the chessboard in a full screenshot. No neural network: just geometry.
// A line-by-line port of src/board_finder.py (see the long comment there for the idea):
// the board is the region where colours flip at 9 evenly spaced vertical and 9 horizontal lines.
//
//   findBoard({ data, width, height })  ->  [left, top, right, bottom, edgeScore] | null
//   isBoard(img, box)                   ->  true if the box really looks like a chessboard
//   locateBoard(img)                    ->  the box if the picture has a board (retrying on a blurred copy), else null
//
// `data` is RGBA bytes, exactly what canvas getImageData() returns. Plain arithmetic only,
// no DOM, so the same file runs in the browser and in Node (web/test/run.mjs checks it
// against the Python version).

export const EDGE_T = 25;      // colour jump (sum over R,G,B) that counts as an edge
export const MID_W = 0.3;      // how hard edges halfway between grid lines count against a candidate
export const PAD = 4;          // px of contrasting border, so a board touching the image edge still has an edge there
export const MIN_EDGE = 0.2;   // edge-score floor (a real board scored as low as 0.32)
export const MIN_CHECKER = 0.6; // real boards score 1.0 on the checker test, pages without a board <= 0.12

// Python's round(): halves go to the even number (JS Math.round goes up), so ties land the same.
export function pyRound(x) {
  const f = Math.floor(x), d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

// ---- resampling, the way Pillow does it (so sizes and values match the Python side) ----
const FILTERS = {
  box: { support: 0.5, f: x => (x > -0.5 && x <= 0.5 ? 1 : 0) },
  bilinear: { support: 1, f: x => { x = Math.abs(x); return x < 1 ? 1 - x : 0; } },
};

function coeffs(inSize, outSize, filter) {
  const scale = inSize / outSize, fscale = Math.max(scale, 1), support = filter.support * fscale;
  const out = [];
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    let xmin = Math.trunc(center - support + 0.5), xmax = Math.trunc(center + support + 0.5);
    if (xmin < 0) xmin = 0;
    if (xmax > inSize) xmax = inSize;
    const w = [];
    let sum = 0;
    for (let x = xmin; x < xmax; x++) { const v = filter.f((x - center + 0.5) / fscale); w.push(v); sum += v; }
    if (sum !== 0) for (let i = 0; i < w.length; i++) w[i] /= sum;
    out.push({ xmin, w });
  }
  return out;
}

const clamp8 = v => (v < 0 ? 0 : v > 255 ? 255 : v);

// Resize the region [x0,x1) x [y0,y1) of an image (RGBA or RGB bytes) to ow x oh RGB bytes.
// Horizontal pass first, rounded to bytes in between, like Pillow.
export function resize(src, sw, stride, x0, y0, x1, y1, ow, oh, mode) {
  const filter = FILTERS[mode], rw = x1 - x0, rh = y1 - y0;
  const cx = coeffs(rw, ow, filter), cy = coeffs(rh, oh, filter);
  let y_lo = rh, y_hi = 0;
  for (const c of cy) { y_lo = Math.min(y_lo, c.xmin); y_hi = Math.max(y_hi, c.xmin + c.w.length); }
  const mid = new Uint8Array(ow * (y_hi - y_lo) * 3);
  for (let y = y_lo; y < y_hi; y++) {
    const row = (y0 + y) * sw;
    for (let x = 0; x < ow; x++) {
      const { xmin, w } = cx[x];
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < w.length; k++) {
        const p = (row + x0 + xmin + k) * stride;
        r += src[p] * w[k]; g += src[p + 1] * w[k]; b += src[p + 2] * w[k];
      }
      const o = ((y - y_lo) * ow + x) * 3;
      mid[o] = clamp8(Math.floor(r + 0.5)); mid[o + 1] = clamp8(Math.floor(g + 0.5)); mid[o + 2] = clamp8(Math.floor(b + 0.5));
    }
  }
  const out = new Uint8Array(ow * oh * 3);
  for (let y = 0; y < oh; y++) {
    const { xmin, w } = cy[y];
    for (let x = 0; x < ow; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < w.length; k++) {
        const o = ((xmin + k - y_lo) * ow + x) * 3;
        r += mid[o] * w[k]; g += mid[o + 1] * w[k]; b += mid[o + 2] * w[k];
      }
      const o = (y * ow + x) * 3;
      out[o] = clamp8(Math.floor(r + 0.5)); out[o + 1] = clamp8(Math.floor(g + 0.5)); out[o + 2] = clamp8(Math.floor(b + 0.5));
    }
  }
  return out;
}

// ---- edges and running totals ----
// arr: RGB bytes, W x H. Returns the prefix sums of the (widened) edge maps.
function edgesAndPrefix(arr, W, H) {
  const exW = W - 1, eyH = H - 1;
  const ex = new Uint8Array(H * exW), ey = new Uint8Array(eyH * W);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < exW; x++) {
      const p = (y * W + x) * 3, q = p + 3;
      if (Math.abs(arr[q] - arr[p]) + Math.abs(arr[q + 1] - arr[p + 1]) + Math.abs(arr[q + 2] - arr[p + 2]) > EDGE_T) ex[y * exW + x] = 1;
    }
  }
  for (let y = 0; y < eyH; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3, q = p + W * 3;
      if (Math.abs(arr[q] - arr[p]) + Math.abs(arr[q + 1] - arr[p + 1]) + Math.abs(arr[q + 2] - arr[p + 2]) > EDGE_T) ey[y * W + x] = 1;
    }
  }
  // widen by 1 px so rounding of line positions is forgiven
  const cx = new Int32Array((H + 1) * exW);   // cx[(y+1)*exW + x] = edges in column x, rows 0..y
  for (let y = 0; y < H; y++)
    for (let x = 0; x < exW; x++) {
      const e = ex[y * exW + x] | (x + 1 < exW ? ex[y * exW + x + 1] : 0) | (x > 0 ? ex[y * exW + x - 1] : 0);
      cx[(y + 1) * exW + x] = cx[y * exW + x] + e;
    }
  const cyW = W + 1;
  const cy = new Int32Array(eyH * cyW);       // cy[y*cyW + x+1] = edges in row y, columns 0..x
  for (let y = 0; y < eyH; y++)
    for (let x = 0; x < W; x++) {
      const e = ey[y * W + x] | (y + 1 < eyH ? ey[(y + 1) * W + x] : 0) | (y > 0 ? ey[(y - 1) * W + x] : 0);
      cy[y * cyW + x + 1] = cy[y * cyW + x] + e;
    }
  return { cx, cxw: exW, cxh: H + 1, cy, cyw: cyW, cyh: eyH };
}

// best (score, row, col) over all top-left corners for integer square size s
function bestForSize(P, s, H, W) {
  const nR = H - 1 - 8 * s, nC = W - 1 - 8 * s;
  if (nR < 1 || nC < 1) return null;
  const { cx, cxw, cy, cyw } = P, h = s >> 1;
  let best = -Infinity, br = 0, bc = 0;
  for (let r = 0; r < nR; r++) {
    const a = (1 + r) * cxw, b = (1 + 8 * s + r) * cxw;
    for (let c = 0; c < nC; c++) {
      let on = 0, mid = 0;
      for (let k = 0; k < 9; k++) on += cx[b + c + k * s] - cx[a + c + k * s];
      for (let k = 0; k < 8; k++) mid += cx[b + c + k * s + h] - cx[a + c + k * s + h];
      const sv = on / 9 - MID_W * mid / 8;
      let hon = 0, hmid = 0;
      for (let k = 0; k < 9; k++) { const o = (r + k * s) * cyw + c; hon += cy[o + 1 + 8 * s] - cy[o + 1]; }
      for (let k = 0; k < 8; k++) { const o = (r + k * s + h) * cyw + c; hmid += cy[o + 1 + 8 * s] - cy[o + 1]; }
      const sh = hon / 9 - MID_W * hmid / 8;
      const m = Math.min(sv, sh) / (8 * s);
      if (m > best) { best = m; br = r; bc = c; }
    }
  }
  return [best, br, bc];
}

// same score for one corner and a fractional square size (fine search)
function scoreAt(P, r0, c0, sf) {
  const { cx, cxw, cxh, cy, cyw, cyh } = P;
  const n = 8 * sf;
  const cols = [], mids = [], rows = [], midr = [];
  for (let k = 0; k < 9; k++) { cols.push(pyRound(c0 + k * sf)); rows.push(pyRound(r0 + k * sf)); }
  for (let k = 0; k < 8; k++) { mids.push(pyRound(c0 + (k + 0.5) * sf)); midr.push(pyRound(r0 + (k + 0.5) * sf)); }
  const yt = r0 + 1, yb = pyRound(r0 + 1 + n), xl = c0 + 1, xr = pyRound(c0 + 1 + n);
  if (Math.min(yt, xl, r0, c0) < 0 || yb >= cxh || Math.max(...cols) >= cxw || xr >= cyw || Math.max(...rows) >= cyh) return -1.0;
  let on = 0, mid = 0, hon = 0, hmid = 0;
  for (const c of cols) on += cx[yb * cxw + c] - cx[yt * cxw + c];
  for (const c of mids) mid += cx[yb * cxw + c] - cx[yt * cxw + c];
  for (const r of rows) hon += cy[r * cyw + xr] - cy[r * cyw + xl];
  for (const r of midr) hmid += cy[r * cyw + xr] - cy[r * cyw + xl];
  const v = on / 9 - MID_W * mid / 8, h = hon / 9 - MID_W * hmid / 8;
  return Math.min(v, h) / n;
}

function median(values) {
  const a = Float64Array.from(values).sort();
  const n = a.length;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}

// How well does this window look like a checkerboard? 0..1 (see _checker in board_finder.py).
// arr: bytes with `stride` values per pixel (3 = RGB, 4 = RGBA).
export function checker(arr, W, H, stride, left, top, s) {
  const cols = new Float64Array(64 * 3);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const x = left + j * s, y = top + i * s;
      const ch = [[], [], []];
      for (const fx of [0.1, 0.68]) {
        for (const fy of [0.1, 0.68]) {
          const x0 = pyRound(x + fx * s), y0 = pyRound(y + fy * s);
          const x1 = Math.max(x0 + 1, pyRound(x0 + 0.22 * s)), y1 = Math.max(y0 + 1, pyRound(y0 + 0.22 * s));
          if (x0 < 0 || y0 < 0 || x1 > W || y1 > H) return 0.0;
          for (let yy = y0; yy < y1; yy++)
            for (let xx = x0; xx < x1; xx++) {
              const p = (yy * W + xx) * stride;
              ch[0].push(arr[p]); ch[1].push(arr[p + 1]); ch[2].push(arr[p + 2]);
            }
        }
      }
      for (let k = 0; k < 3; k++) cols[(i * 8 + j) * 3 + k] = median(ch[k]);
    }
  }
  const par = idx => (Math.floor(idx / 8) + (idx % 8)) % 2;
  const m = [[0, 0, 0], [0, 0, 0]];
  for (let p = 0; p < 2; p++)
    for (let k = 0; k < 3; k++) {
      const v = [];
      for (let idx = 0; idx < 64; idx++) if (par(idx) === p) v.push(cols[idx * 3 + k]);
      m[p][k] = median(v);
    }
  const dist = (idx, mm) => Math.hypot(cols[idx * 3] - mm[0], cols[idx * 3 + 1] - mm[1], cols[idx * 3 + 2] - mm[2]);
  const sep = Math.hypot(m[0][0] - m[1][0], m[0][1] - m[1][1], m[0][2] - m[1][2]);
  if (sep < 25) return 0.0;
  let near = 0;
  for (let idx = 0; idx < 64; idx++) if (dist(idx, m[par(idx)]) < 0.35 * sep) near++;
  return near / 64;
}

// ---- the search ----
function toRGB(rgba, n) {
  const out = new Uint8Array(n * 3);
  for (let i = 0, o = 0; i < n * 4; i += 4, o += 3) { out[o] = rgba[i]; out[o + 1] = rgba[i + 1]; out[o + 2] = rgba[i + 2]; }
  return out;
}

function find(padded, W0, H0, maxSide, minS) {
  const f = Math.max(1, Math.max(W0, H0) / maxSide);
  let arr, W, H;
  if (f > 1) {
    W = pyRound(W0 / f); H = pyRound(H0 / f);
    arr = resize(padded, W0, 4, 0, 0, W0, H0, W, H, "box");
  } else { W = W0; H = H0; arr = toRGB(padded, W0 * H0); }
  const P = edgesAndPrefix(arr, W, H);

  // 1) coarse: every square size, every corner, on the shrunken copy
  let best = -9.0, cand = null;
  for (let s = minS; s <= Math.floor(Math.min(H, W) / 8); s++) {
    const m = bestForSize(P, s, H, W);
    if (m && m[0] > best) { best = m[0]; cand = [m[1], m[2], s]; }
  }
  if (!cand) return null;
  let [r0, c0, s] = cand;

  // 1b) the window shifted by exactly one square hits the same strong lines: the checker test decides
  let topCombo = -9.0, bestRC = [r0, c0];
  for (const dr of [-1, 0, 1]) {
    for (const dc of [-1, 0, 1]) {
      const r = r0 + dr * s, c = c0 + dc * s;
      const combo = scoreAt(P, r, c, s) + checker(arr, W, H, 3, c + 1, r + 1, s);
      if (combo > topCombo + 1e-9) { topCombo = combo; bestRC = [r, c]; }
    }
  }
  [r0, c0] = bestRC;

  // 2) fine: re-run at full resolution on a window around the candidate
  const pad = Math.trunc(3 * f) + 8;
  const xLo = Math.max(0, Math.trunc((c0 + 1) * f) - pad), yLo = Math.max(0, Math.trunc((r0 + 1) * f) - pad);
  const xHi = Math.min(W0, Math.trunc((c0 + 1 + 8 * s) * f) + pad), yHi = Math.min(H0, Math.trunc((r0 + 1 + 8 * s) * f) + pad);
  const sw = xHi - xLo, sh = yHi - yLo;
  const sub = new Uint8Array(sw * sh * 3);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const p = ((yLo + y) * W0 + xLo + x) * 4, o = (y * sw + x) * 3;
      sub[o] = padded[p]; sub[o + 1] = padded[p + 1]; sub[o + 2] = padded[p + 2];
    }
  const F = edgesAndPrefix(sub, sw, sh);
  const rC = (r0 + 1) * f - yLo - 1, cC = (c0 + 1) * f - xLo - 1, sC = s * f;
  const d = Math.trunc(f) + 3;
  let found = [], top = -9.0;
  const start = sC - f - 2, stop = sC + f + 2.01, nSteps = Math.ceil((stop - start) / 0.25);
  for (let i = 0; i < nSteps; i++) {
    const sf = start + i * 0.25;
    for (let r = Math.trunc(rC) - d; r <= Math.trunc(rC) + d; r++) {
      for (let c = Math.trunc(cC) - d; c <= Math.trunc(cC) + d; c++) {
        const sc = scoreAt(F, r, c, sf);
        if (sc > top + 1e-9) { top = sc; found = [[r, c, sf]]; }
        else if (Math.abs(sc - top) <= 1e-9) found.push([r, c, sf]);
      }
    }
  }
  const mean = k => found.reduce((a, t) => a + t[k], 0) / found.length;
  const r = mean(0), c = mean(1), sf = mean(2);
  const left = xLo + c + 1, topp = yLo + r + 1;
  return [pyRound(left), pyRound(topp), pyRound(left + 8 * sf), pyRound(topp + 8 * sf), top];
}

export function findBoard(img, maxSide = 512, minS = 6) {
  const { data, width: ow, height: oh } = img;
  const pad = Math.trunc(PAD * Math.max(1, Math.max(ow, oh) / maxSide)) + PAD;   // still >= PAD px after shrinking
  const W0 = ow + 2 * pad, H0 = oh + 2 * pad;
  const padded = new Uint8Array(W0 * H0 * 4);   // magenta border: it contrasts with almost any page
  for (let i = 0; i < W0 * H0; i++) { padded[i * 4] = 255; padded[i * 4 + 2] = 255; padded[i * 4 + 3] = 255; }
  for (let y = 0; y < oh; y++) padded.set(data.subarray(y * ow * 4, (y + 1) * ow * 4), ((y + pad) * W0 + pad) * 4);
  const box = find(padded, W0, H0, maxSide, minS);
  if (!box) return null;
  const [l, t, r, b, conf] = box;
  return [Math.max(0, l - pad), Math.max(0, t - pad), Math.min(ow, r - pad), Math.min(oh, b - pad), conf];
}

// Accept the box only if it has grid edges AND looks like a two-colour checkerboard.
export function isBoard(img, box) {
  if (!box || box[4] < MIN_EDGE) return false;
  const [l, t, r] = box;
  return checker(img.data, img.width, img.height, 4, l, t, (r - l) / 8) >= MIN_CHECKER;
}

// ---- book diagrams: the hatching on the dark squares makes a finer grid than the board itself ----
// A box blur (width BLUR_W, two passes, edges repeated) smooths the hatching into flat grey, so the real
// grid wins. It is only tried when the plain image has no board, so screenshots behave as before.
// Same arithmetic as blur() in src/board_finder.py.
const BLUR_W = 5;

function boxPass(src, w, h, horizontal) {
  const out = new Uint8Array(src.length), r = BLUR_W >> 1;
  const n = horizontal ? w : h, lines = horizontal ? h : w;
  for (let line = 0; line < lines; line++) {
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) {
          const j = Math.min(n - 1, Math.max(0, i + k));
          sum += horizontal ? src[(line * w + j) * 4 + c] : src[(j * w + line) * 4 + c];
        }
        out[(horizontal ? line * w + i : i * w + line) * 4 + c] = Math.floor((sum + r) / BLUR_W);
      }
      out[(horizontal ? line * w + i : i * w + line) * 4 + 3] = 255;
    }
  }
  return out;
}

export function blur(img) {
  let data = img.data;
  for (let round = 0; round < 2; round++) data = boxPass(boxPass(data, img.width, img.height, true), img.width, img.height, false);
  return { data, width: img.width, height: img.height };
}

// The board box if the picture has a board, else null.
export function locateBoard(img) {
  let box = findBoard(img);
  if (isBoard(img, box)) return box;
  box = findBoard(blur(img));
  return isBoard(img, box) ? box : null;
}
