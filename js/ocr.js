// ocr.html: a screenshot in, a FEN out. Everything happens in the browser.
import { board } from "./board.js?v=60";
import { locateBoard } from "./board-finder.js";
import { sliceBoard, classify, loadModel, guessFlipped, fenPlacement } from "./fen-ocr.js";

const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
const MODEL = new URL("../model/baseline.onnx?v=3", import.meta.url).href;   // bump the number when the model file is replaced (browsers cache it)
const $ = id => document.getElementById(id);
const file = $("file"), statusEl = $("status"), result = $("result"), tools = $("tools");
const stage = $("stage"), fenBox = $("fen"), shot = $("shot"), shotbox = $("shotbox");
const turnBtn = $("turn"), turnText = $("turnText");
const turnSelect = {   // the side to move, kept on the button
  get value() { return turnBtn.dataset.v || "w"; },
  set value(v) { turnBtn.dataset.v = v; turnText.textContent = v === "b" ? "black to move" : "white to move"; },
};
const castleBoxes = document.querySelectorAll(".castle input");
const wanted = new Set();   // the rights you ticked: kept while a flip makes them impossible, back when they are possible again
let turnTouched = false, placement = "", flipped = false, session = null, ort = null, lastLabels = null;

const say = (text, bad = false) => { statusEl.textContent = text; statusEl.classList.toggle("bad", bad); };
const nextPaint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r)));

// the model is loaded once, on the first screenshot (the runtime comes from a CDN, the model from this site)
async function ready() {
  if (session) return;
  await new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = ORT + "ort.wasm.min.js";
    s.onload = ok; s.onerror = () => fail(new Error("could not load the onnx runtime (offline?)"));
    document.head.appendChild(s);
  });
  ort = window.ort;
  ort.env.wasm.wasmPaths = ORT;
  ort.env.wasm.numThreads = 1;   // threads need special headers that GitHub Pages does not send
  session = await loadModel(ort, MODEL);
}

// which castling rights are even possible: the king and that rook are still on their home squares
function possibleCastling() {
  const rows = placement.split("/").map(r => r.replace(/\d/g, d => ".".repeat(+d)));   // rows[0] = rank 8 ... rows[7] = rank 1
  const ok = { K: false, Q: false, k: false, q: false };
  if (rows[7][4] === "K") { ok.K = rows[7][7] === "R"; ok.Q = rows[7][0] === "R"; }
  if (rows[0][4] === "k") { ok.k = rows[0][7] === "r"; ok.q = rows[0][0] === "r"; }
  return ok;
}

function fenNow() {
  const castle = [...castleBoxes].filter(b => b.checked).map(b => b.value).join("") || "-";
  return `${placement} ${turnSelect.value} ${castle} - 0 1`;
}

// the empty board, with the hint on it, waiting for a screenshot
function showEmpty() {
  const fig = document.createElement("figure");
  fig.appendChild(board({ fen: "8/8/8/8/8/8/8/8 w - - 0 1", arrows: [], rings: [] }, false));
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.innerHTML = '<span class="big">drop a screenshot, paste it, or click</span>';
  stage.replaceChildren(fig, hint);
  stage.classList.add("empty");
  stage.tabIndex = 0;
  tools.hidden = result.hidden = true;
  fenBox.value = "";
  lastLabels = null;
  turnSelect.value = "w";
  wanted.clear();
  for (const b of castleBoxes) b.checked = false;
  file.value = "";   // so choosing the same file again fires a change
  say("");
}

function draw() {
  stage.classList.remove("empty");
  stage.removeAttribute("tabindex");
  const ok = possibleCastling();
  for (const b of castleBoxes) { b.disabled = !ok[b.value]; b.checked = !b.disabled && wanted.has(b.value); }   // a right that cannot exist is greyed out
  const fen = fenNow();
  const fig = document.createElement("figure");
  fig.appendChild(board({ fen, arrows: [], rings: [] }, flipped));
  stage.replaceChildren(fig);
  fenBox.value = fen;
}

function showShot(bitmap, box) {
  shot.width = bitmap.width; shot.height = bitmap.height;
  const g = shot.getContext("2d");
  g.drawImage(bitmap, 0, 0);
  g.lineWidth = Math.max(3, bitmap.width / 250);
  g.strokeStyle = "#6fa83a";
  g.strokeRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
}

async function read(blob) {
  say("reading…");
  await nextPaint();
  try {
    const bitmap = await createImageBitmap(blob);
    const cv = new OffscreenCanvas(bitmap.width, bitmap.height);
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(bitmap, 0, 0);
    const img = cx.getImageData(0, 0, bitmap.width, bitmap.height);
    const t0 = performance.now();
    await ready();
    const box = locateBoard(img);
    if (!box) { say("no chessboard found in this image", true); return; }
    const labels = await classify(ort, session, sliceBoard(img, box));
    lastLabels = labels;
    turnTouched = false;
    wanted.clear();
  for (const b of castleBoxes) b.checked = false;
    flipped = guessFlipped(labels);
    turnSelect.value = flipped ? "b" : "w";   // black at the bottom: most often it is black's turn
    placement = fenPlacement(labels, flipped);
    if (labels.every(c => c === 0)) { say("a board, but no pieces on it", true); return; }
    draw();
    showShot(bitmap, box);
    result.hidden = tools.hidden = false;
    say(`read in ${((performance.now() - t0) / 1000).toFixed(1)} seconds`);
  } catch (e) {
    say(e.message || String(e), true);
  }
}

file.addEventListener("change", () => file.files[0] && read(file.files[0]));
stage.addEventListener("click", e => { if (!stage.classList.contains("empty")) e.preventDefault(); });   // only the empty board opens the file picker
stage.addEventListener("keydown", e => { if (stage.classList.contains("empty") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); file.click(); } });
// drop anywhere on the page (a drop that misses would make the browser open the image)
["dragenter", "dragover"].forEach(t => document.addEventListener(t, e => { e.preventDefault(); stage.classList.add("over"); }));
document.addEventListener("dragleave", e => { if (!e.relatedTarget) stage.classList.remove("over"); });
document.addEventListener("drop", e => { e.preventDefault(); stage.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) read(f); });
document.addEventListener("paste", e => {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith("image/"));
  if (item) read(item.getAsFile());
});

turnBtn.addEventListener("click", () => { turnSelect.value = turnSelect.value === "w" ? "b" : "w"; turnTouched = true; fenBox.value = fenNow(); });
for (const b of castleBoxes) b.addEventListener("change", () => { b.checked ? wanted.add(b.value) : wanted.delete(b.value); fenBox.value = fenNow(); });

$("original").addEventListener("click", () => shotbox.showModal());
shotbox.addEventListener("click", () => shotbox.close());   // a click anywhere closes it (Escape works too)

$("clear").addEventListener("click", showEmpty);

$("flip").addEventListener("click", () => {   // the orientation guess is wrong: read the same squares the other way round
  flipped = !flipped;
  if (!turnTouched) turnSelect.value = flipped ? "b" : "w";
  placement = fenPlacement(lastLabels, flipped);
  draw();
});
$("copy").addEventListener("click", async () => {   // the whole fen; a part of it can still be selected by hand
  try { await navigator.clipboard.writeText(fenBox.value); } catch (e) { fenBox.select(); document.execCommand("copy"); }
  $("copy").classList.add("done");
  setTimeout(() => $("copy").classList.remove("done"), 1200);
});
$("open").addEventListener("click", () =>
  window.open(`https://www.chess.com/analysis?fen=${encodeURI(fenBox.value)}&flip=${flipped}`, "_blank", "noopener"));

showEmpty();
