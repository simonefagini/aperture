import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

// printed-diagram look: paper squares, dark squares hatched with ink (same in light and dark mode)
const PAPER = "#f0eadc", INK = "#1a1a1a";
// last-move highlight, as in most engines: lighter green for the square it left, darker for where it landed
const FROM_GREEN = { fill: "#b5d86a", "fill-opacity": 0.4 }, TO_GREEN = { fill: "#6fa83a", "fill-opacity": 0.45 };
// Lichess-style marks: G/R/Y/B in [%cal ...] (arrows) and [%csl ...] (circles)
const MARK_COLORS = { G: "#15781b", R: "#882020", Y: "#e68f00", B: "#003088" };
const NS = "http://www.w3.org/2000/svg";

// pull the [%cal ...] / [%csl ...] codes out of a comment; what is left is its text, all on one flow (line breaks are just spaces), line by line
function marksIn(comment, lineNo) {
  const arrows = [], rings = [], sqr = {};
  const text = comment.replace(/\[%(cal|csl|sqr)\s+([^\]]*)\]/g, (_, kind, list) => {
    for (const item of list.split(/[\s,]+/).filter(Boolean)) {
      const ok = kind === "cal" ? /^[GRYB][a-h][1-8][a-h][1-8]$/ : kind === "csl" ? /^[GRYB][a-h][1-8]$/ : /^[SE][a-h][1-8]$/;
      if (!ok.test(item)) throw new Error(`line ${lineNo}: "${item}" is not a valid ${kind} mark`);
      if (kind === "sqr") sqr[item[0] === "S" ? "from" : "to"] = item.slice(1);   // [%sqr Sb1,Eb2]: the last-move squares, start and end
      else if (kind === "cal" && item.slice(1, 3) !== item.slice(3, 5)) arrows.push(item);
      else rings.push(kind === "cal" ? item.slice(0, 3) : item);   // an arrow from a square to itself is a circle
    }
    return "";
  }).replace(/\s+/g, " ").trim();
  return { note: text, arrows, rings, sqr };
}

// the file as logical lines [first line number, text]: a { comment } may run over several lines,
// and "#" lines are never joined to the next one
function logicalLines(text) {
  const out = [];
  let buf = null, start = 0;
  text.split("\n").forEach((raw, i) => {
    if (buf === null && raw.trim().startsWith("#")) { out.push([i + 1, raw]); return; }
    if (buf === null) { buf = raw; start = i + 1; } else buf += "\n" + raw;
    if ((buf.match(/\{/g) || []).length <= (buf.match(/\}/g) || []).length) { out.push([start, buf]); buf = null; }
  });
  if (buf !== null) throw new Error(`line ${start}: a { comment is never closed`);
  return out;
}

// ---- parse: every line is one board; its parent is the nearest listed shorter line ----
export function parse(text) {
  const root = { moves: [], fen: new Chess().fen(), comment: "", arrows: [], rings: [], asides: [], children: [] };
  const byKey = new Map([["", root]]);
  const nodes = [];
  let lastNode = null;   // the board a "~" line hangs on: the last ordinary line
  logicalLines(text).forEach(([lineNo, raw]) => {
    let line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const isAside = line.startsWith("~");            // "~ <moves>": an alternative line shown beside the board above
    if (isAside) line = line.slice(1).trim();
    const isPreview = line.startsWith("@preview");   // "@preview <moves>": the board shown on the home page
    if (isPreview) line = line.slice("@preview".length).trim();
    let game = new Chess(), fromFen = false;
    if (line.startsWith("@fen")) {                  // "~ @fen <pieces> [moves] {comment}": any position, as a side board
      if (!isAside) throw new Error(`line ${lineNo}: "@fen" only works on a "~" line (a side board)`);
      const [placement = "", ...rest] = line.slice(4).trim().split(/\s+/);   // only the piece placement; the rest is assumed
      try { game = new Chess(`${placement} w - - 0 1`, { skipValidation: true }); }   // no kings needed
      catch (e) { throw new Error(`line ${lineNo}: "${placement}" is not a valid FEN piece placement`); }
      line = rest.join(" ");
      fromFen = true;
    }
    const moves = [];
    let comment = "", last;
    for (const [, c, move] of line.matchAll(/\{([^}]*)\}|(\S+)/g)) {
      if (c !== undefined) { comment = c; continue; }   // a {comment} belongs to the move before it
      try { last = game.move(move); moves.push(last.san); }
      catch (e) { throw new Error(`line ${lineNo}: "${move}" is not a legal move here`); }
      comment = "";                                       // only a comment after the last move counts
    }
    if (!moves.length && !fromFen) return;
    const { note, arrows, rings, sqr } = marksIn(comment, lineNo);
    const from = sqr.from ?? last?.from, to = sqr.to ?? last?.to;
    if (isPreview) { root.preview = { moves, fen: game.fen(), from, to, arrows, rings }; return; }
    if (isAside) {
      if (!lastNode) throw new Error(`line ${lineNo}: a "~" line needs a board above it`);
      lastNode.asides.push({ moves, fen: game.fen(), from, to, comment: note, arrows, rings });
      return;
    }
    const key = moves.join(" ");
    if (byKey.has(key)) {   // repeated line: keep the first board, take any comment or marks from this one
      const same = byKey.get(key);
      if (note) same.comment = note;
      if (sqr.from) same.from = sqr.from;
      if (sqr.to) same.to = sqr.to;
      same.arrows.push(...arrows); same.rings.push(...rings);
      lastNode = same;
      return;
    }
    const node = { moves, fen: game.fen(), from, to, comment: note, arrows, rings, asides: [], children: [] };
    byKey.set(key, node);
    nodes.push(node);
    lastNode = node;
  });
  for (const node of nodes) {   // parent = longest listed prefix (else the start position)
    let n = node.moves.length - 1;
    while (n > 0 && !byKey.has(node.moves.slice(0, n).join(" "))) n--;
    byKey.get(node.moves.slice(0, n).join(" ")).children.push(node);
  }
  return root;
}

// ---- drawing: a board is an 8x8 SVG that scales to its container ----------
function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.appendChild(e);
  return e;
}

// centre of a square like "e4" in board units
function center(sq, flipped) {
  const f = "abcdefgh".indexOf(sq[0]), r = 8 - +sq[1];
  return flipped ? [7 - f + 0.5, 7 - r + 0.5] : [f + 0.5, r + 0.5];
}

// hover layer: tint the squares the last move went from and to
function tints(parent, node, flipped) {
  const g = el("g", { class: "layer" }, parent);
  for (const [sq, green] of [[node.from, FROM_GREEN], [node.to, TO_GREEN]]) {
    if (!sq) continue;
    const [x, y] = center(sq, flipped);
    el("rect", { x: x - 0.5, y: y - 0.5, width: 1, height: 1, ...green }, g);
  }
}

// an arrow from one square to another: Lichess-like: thick shaft, short head, transparent
function arrow(parent, color, from, to, flipped) {
  const [x0, y0] = center(from, flipped), [x1, y1] = center(to, flipped);
  const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  const tx = x1 - ux * 0.05, ty = y1 - uy * 0.05;            // tip
  const bx = tx - ux * 0.4, by = ty - uy * 0.4;              // base of the head
  const head = `${tx},${ty} ${bx - uy * 0.25},${by + ux * 0.25} ${bx + uy * 0.25},${by - ux * 0.25}`;
  const g = el("g", { opacity: 0.6 }, parent);              // one opacity for the whole arrow, so shaft and head do not double up
  el("line", { x1: x0 + ux * 0.2, y1: y0 + uy * 0.2, x2: bx + ux * 0.05, y2: by + uy * 0.05, stroke: color, "stroke-width": 0.16, "stroke-linecap": "butt" }, g);
  el("polygon", { points: head, fill: color }, g);
}

// hover layer (over the pieces): the marks written in the comment
function marks(parent, node, flipped) {
  if (!node.arrows?.length && !node.rings?.length) return;
  const g = el("g", { class: "layer" }, parent);
  for (const item of node.rings) {
    const [x, y] = center(item.slice(1), flipped);
    el("circle", { cx: x, cy: y, r: 0.42, fill: "none", stroke: MARK_COLORS[item[0]], "stroke-width": 0.12, opacity: 0.6 }, g);   // same colour and transparency as the arrows, no outline
  }
  for (const item of node.arrows) arrow(g, MARK_COLORS[item[0]], item.slice(1, 3), item.slice(3, 5), flipped);
}

export function board(node, flipped) {
  const fen = node.fen;
  const svg = el("svg", { viewBox: "-0.55 0 9.1 8.6", class: "board" });   // extra room for the coordinates
  const hatch = el("pattern", { id: "hatch", width: 0.11, height: 0.11, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, el("defs", {}, svg));
  el("line", { x1: 0, y1: 0, x2: 0, y2: 0.11, stroke: INK, "stroke-width": 0.04 }, hatch);
  el("rect", { width: 8, height: 8, fill: PAPER }, svg);
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++)
      if ((r + f) % 2) el("rect", { x: f, y: r, width: 1, height: 1, fill: "url(#hatch)" }, svg);
  el("rect", { x: 0.02, y: 0.02, width: 7.96, height: 7.96, fill: "none", stroke: INK, "stroke-width": 0.04 }, svg);
  // coordinates outside the frame: files below, ranks on the left (reversed when flipped)
  for (let i = 0; i < 8; i++) {
    const file = "abcdefgh"[flipped ? 7 - i : i], rank = flipped ? i + 1 : 8 - i;
    el("text", { class: "coord", x: i + 0.5, y: 8.4 }, svg).textContent = file;
    el("text", { class: "coord", x: -0.28, y: i + 0.62 }, svg).textContent = rank;
  }
  fen.split(" ")[0].split("/").forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += +ch; continue; }
      const piece = (ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase();
      const [x, y] = flipped ? [7 - f, 7 - r] : [f, r];
      el("image", { href: `pieces/${piece}.svg`, x, y, width: 1, height: 1 }, svg);
      f++;
    }
  });
  tints(svg, node, flipped);   // hover layers sit on top of the pieces
  marks(svg, node, flipped);
  return svg;
}
