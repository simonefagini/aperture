import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

// printed-diagram look: paper squares, dark squares hatched with ink (same in light and dark mode)
const PAPER = "#f0eadc", INK = "#1a1a1a";
// last-move highlight, as in most engines: lighter green for the square it left, darker for where it landed
const FROM_GREEN = { fill: "#b5d86a", "fill-opacity": 0.6 }, TO_GREEN = { fill: "#6fa83a", "fill-opacity": 0.7 };
// Lichess-style marks: G/R/Y/B in [%cal ...] (arrows) and [%csl ...] (circles)
const MARK_COLORS = { G: "#15781b", R: "#882020", Y: "#e68f00", B: "#003088" };
const NS = "http://www.w3.org/2000/svg";

// pull the [%cal ...] / [%csl ...] codes out of a comment; what is left is the text to show
function marksIn(comment, lineNo) {
  const arrows = [], rings = [];
  const text = comment.replace(/\[%(cal|csl)\s+([^\]]*)\]/g, (_, kind, list) => {
    for (const item of list.split(/[\s,]+/).filter(Boolean)) {
      const ok = kind === "cal" ? /^[GRYB][a-h][1-8][a-h][1-8]$/ : /^[GRYB][a-h][1-8]$/;
      if (!ok.test(item)) throw new Error(`line ${lineNo}: "${item}" is not a valid ${kind} mark`);
      if (kind === "cal" && item.slice(1, 3) !== item.slice(3, 5)) arrows.push(item);
      else rings.push(kind === "cal" ? item.slice(0, 3) : item);   // an arrow from a square to itself is a circle
    }
    return "";
  }).replace(/\s+/g, " ").trim();
  return { text, arrows, rings };
}

// ---- parse: every line is one board; its parent is the nearest listed shorter line ----
export function parse(text) {
  const root = { moves: [], fen: new Chess().fen(), comment: "", arrows: [], rings: [], children: [] };
  const byKey = new Map([["", root]]);
  const nodes = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const game = new Chess();
    const moves = [];
    let comment = "", last;
    for (const [, c, move] of line.matchAll(/\{([^}]*)\}|(\S+)/g)) {
      if (c !== undefined) { comment = c; continue; }   // a {comment} belongs to the move before it
      try { last = game.move(move); moves.push(last.san); }
      catch (e) { throw new Error(`line ${i + 1}: "${move}" is not a legal move here`); }
      comment = "";                                       // only a comment after the last move counts
    }
    if (!moves.length) return;
    const key = moves.join(" ");
    const { text, arrows, rings } = marksIn(comment, i + 1);
    if (byKey.has(key)) {   // repeated line: keep the first board, take any comment or marks from this one
      const same = byKey.get(key);
      if (text) same.comment = text;
      same.arrows.push(...arrows); same.rings.push(...rings);
      return;
    }
    const node = { moves, fen: game.fen(), from: last.from, to: last.to, comment: text, arrows, rings, children: [] };
    byKey.set(key, node);
    nodes.push(node);
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

// hover layer (under the pieces): tint the squares the last move went from and to
function tints(parent, node, flipped) {
  if (!node.from) return;
  const g = el("g", { class: "layer" }, parent);
  for (const [sq, green] of [[node.from, FROM_GREEN], [node.to, TO_GREEN]]) {
    const [x, y] = center(sq, flipped);
    el("rect", { x: x - 0.5, y: y - 0.5, width: 1, height: 1, ...green }, g);
  }
}

// an arrow from one square to another, with a paper halo so it reads on the hatching
function arrow(parent, color, from, to, flipped) {
  const [x0, y0] = center(from, flipped), [x1, y1] = center(to, flipped);
  const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  const tx = x1 - ux * 0.08, ty = y1 - uy * 0.08;            // tip
  const bx = tx - ux * 0.42, by = ty - uy * 0.42;            // base of the head
  const head = `${tx},${ty} ${bx - uy * 0.24},${by + ux * 0.24} ${bx + uy * 0.24},${by - ux * 0.24}`;
  const shaft = { x1: x0 + ux * 0.2, y1: y0 + uy * 0.2, x2: bx, y2: by, "stroke-linecap": "round" };
  el("line", { ...shaft, stroke: PAPER, "stroke-width": 0.24 }, parent);
  el("polygon", { points: head, fill: PAPER, stroke: PAPER, "stroke-width": 0.1, "stroke-linejoin": "round" }, parent);
  el("line", { ...shaft, stroke: color, "stroke-width": 0.14 }, parent);
  el("polygon", { points: head, fill: color }, parent);
}

// hover layer (over the pieces): the marks written in the comment
function marks(parent, node, flipped) {
  if (!node.arrows?.length && !node.rings?.length) return;
  const g = el("g", { class: "layer" }, parent);
  for (const item of node.rings) {
    const [x, y] = center(item.slice(1), flipped);
    el("circle", { cx: x, cy: y, r: 0.44, fill: "none", stroke: PAPER, "stroke-width": 0.17 }, g);   // halo
    el("circle", { cx: x, cy: y, r: 0.44, fill: "none", stroke: MARK_COLORS[item[0]], "stroke-width": 0.09 }, g);
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
  tints(svg, node, flipped);
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
  marks(svg, node, flipped);
  return svg;
}
