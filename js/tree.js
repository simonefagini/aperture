import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

// printed-diagram look: paper squares, dark squares hatched with ink (same in light and dark mode)
const PAPER = "#f0eadc", INK = "#1a1a1a";
const ACCENT = "#b04a4a";   // arrows and highlights (the "bad" red from biblioteca)
const NS = "http://www.w3.org/2000/svg";

// ---- parse: every line is one board; its parent is the nearest listed shorter line ----
function parse(text) {
  const root = { moves: [], fen: new Chess().fen(), comment: "", children: [] };
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
    if (byKey.has(key)) { if (comment) byKey.get(key).comment = comment; return; }   // repeated line
    const node = { moves, fen: game.fen(), from: last.from, to: last.to, comment, children: [] };
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

// hover layer, part 1 (under the pieces): tint the squares the last move went from and to
function tints(parent, node, flipped) {
  const g = el("g", { class: "layer" }, parent);
  for (const sq of [node.from, node.to]) {
    const [x, y] = center(sq, flipped);
    el("rect", { x: x - 0.5, y: y - 0.5, width: 1, height: 1, fill: ACCENT, "fill-opacity": 0.35 }, g);
  }
}

// hover layer, part 2 (over the pieces): an arrow for the last move, with a paper halo to read on the hatching
function arrow(parent, node, flipped) {
  const g = el("g", { class: "layer" }, parent);
  const [x0, y0] = center(node.from, flipped), [x1, y1] = center(node.to, flipped);
  const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  const tx = x1 - ux * 0.08, ty = y1 - uy * 0.08;            // tip
  const bx = tx - ux * 0.42, by = ty - uy * 0.42;            // base of the head
  const head = `${tx},${ty} ${bx - uy * 0.24},${by + ux * 0.24} ${bx + uy * 0.24},${by - ux * 0.24}`;
  const shaft = { x1: x0 + ux * 0.2, y1: y0 + uy * 0.2, x2: bx, y2: by, "stroke-linecap": "round" };
  el("line", { ...shaft, stroke: PAPER, "stroke-width": 0.24 }, g);
  el("polygon", { points: head, fill: PAPER, stroke: PAPER, "stroke-width": 0.1, "stroke-linejoin": "round" }, g);
  el("line", { ...shaft, stroke: ACCENT, "stroke-width": 0.14 }, g);
  el("polygon", { points: head, fill: ACCENT }, g);
}

function board(node, flipped) {
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
  arrow(svg, node, flipped);
  return svg;
}

// last move with its number, e.g. "2.Bf4" or "1...d5"
function label(moves) {
  const ply = moves.length;
  return `${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."}${moves[ply - 1]}`;
}

// a block is a board with its replies in a row below it; side says where its comment goes
function block(node, side, flipped) {
  const div = document.createElement("div");
  div.className = "block";
  const fig = document.createElement("figure");
  fig.appendChild(board(node, flipped));
  const cap = document.createElement("figcaption");
  cap.textContent = label(node.moves);
  fig.appendChild(cap);
  if (node.comment) {
    const note = document.createElement("p");
    note.className = `note ${side}`;
    note.textContent = node.comment;
    fig.appendChild(note);
  }
  div.appendChild(fig);
  if (node.children.length) div.appendChild(row(node.children, flipped));
  return div;
}

function row(nodes, flipped) {
  const div = document.createElement("div");
  div.className = "kids";
  nodes.forEach((n, i) => {
    const several = nodes.length > 1;   // first of several: comment on the left, last: on the right
    const side = !several ? "right" : i === 0 ? "left" : i === nodes.length - 1 ? "right" : "below";
    div.appendChild(block(n, side, flipped));
  });
  return div;
}

async function main() {
  const { file, orientation } = document.body.dataset;
  const root = parse(await (await fetch(file)).text());
  document.getElementById("tree").appendChild(row(root.children, orientation === "black"));
}

main().catch(e => { document.getElementById("tree").textContent = "Error: " + e.message; });
