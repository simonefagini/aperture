// From a found board to a FEN: slice into 64 squares, classify each with the ONNX model,
// guess the orientation, assemble the placement. A port of src/slicer.py.
import { resize, pyRound } from "./board-finder.js";

export const CLASSES = "·PNBRQKpnbrqk";   // 0 = empty, 1..6 = P N B R Q K, 7..12 = p n b r q k
const SIZE = 32;

// 64 squares, row by row from the top-left of the box, as one float tensor (64, 3, 32, 32), raw 0-255 pixels
// (the model normalises inside). Width and height are divided by 8 separately, like the Python slicer.
export function sliceBoard(img, box) {
  const [l, t, r, b] = box, w = r - l, h = b - t;
  const out = new Float32Array(64 * 3 * SIZE * SIZE);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const x0 = l + pyRound(j * w / 8), y0 = t + pyRound(i * h / 8);
      const x1 = l + pyRound((j + 1) * w / 8), y1 = t + pyRound((i + 1) * h / 8);
      const px = resize(img.data, img.width, 4, x0, y0, x1, y1, SIZE, SIZE, "bilinear");
      const base = (i * 8 + j) * 3 * SIZE * SIZE;
      for (let k = 0; k < SIZE * SIZE; k++) {
        out[base + k] = px[k * 3];
        out[base + SIZE * SIZE + k] = px[k * 3 + 1];
        out[base + 2 * SIZE * SIZE + k] = px[k * 3 + 2];
      }
    }
  }
  return out;
}

// scores (64 x 13) -> 64 class ids
export function argmax13(scores) {
  const labels = new Int32Array(64);
  for (let i = 0; i < 64; i++) {
    let best = 0;
    for (let c = 1; c < 13; c++) if (scores[i * 13 + c] > scores[i * 13 + best]) best = c;
    labels[i] = best;
  }
  return labels;
}

// White starts at the bottom: more white material in the top half means the board is flipped.
export function guessFlipped(labels) {
  const value = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };
  let top = 0, bottom = 0;
  for (let i = 0; i < 64; i++) (i < 32 ? (top += value[labels[i]] || 0) : (bottom += value[labels[i]] || 0));
  return top > bottom;
}

// 64 class ids in image order -> the first FEN field (rank 8 first, files a..h)
export function fenPlacement(labels, flipped) {
  const rows = [];
  for (let row = 0; row < 8; row++) {
    let s = "", run = 0;
    for (let col = 0; col < 8; col++) {
      const c = flipped ? labels[(7 - row) * 8 + (7 - col)] : labels[row * 8 + col];
      if (c === 0) run++;
      else { s += (run ? run : "") + CLASSES[c]; run = 0; }
    }
    rows.push(s + (run ? run : ""));
  }
  return rows.join("/");
}

// ort: the onnxruntime-web module (browser: the global `ort`; Node: import). model: URL, path or bytes.
export async function loadModel(ort, model) {
  return ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
}

export async function classify(ort, session, tensorData) {
  const out = await session.run({ squares: new ort.Tensor("float32", tensorData, [64, 3, SIZE, SIZE]) });
  return argmax13(out.scores.data);
}
