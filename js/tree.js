import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
import { hierarchy, tree } from "https://cdn.jsdelivr.net/npm/d3-hierarchy@3.1.2/+esm";

const BOARD = 240, CELL = BOARD / 8;       // board size in px
const NODE_W = BOARD + 30, NODE_H = BOARD + 70;
const LIGHT = "#f0d9b5", DARK = "#b58863";
const NS = "http://www.w3.org/2000/svg";

// ---- parse: lines of SAN into a merged tree --------------------------------
function parse(text) {
  const root = { san: "start", fen: new Chess().fen(), comment: "", children: [] };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const game = new Chess();
    let node = root;
    // tokens: a move, or a {comment} attached to the previous move
    for (const [, comment, move] of line.matchAll(/\{([^}]*)\}|(\S+)/g)) {
      if (comment !== undefined) { if (node !== root && !node.comment) node.comment = comment; continue; }
      const san = game.move(move).san;      // throws on an illegal move
      let child = node.children.find(c => c.san === san);
      if (!child) { child = { san, fen: game.fen(), comment: "", children: [] }; node.children.push(child); }
      node = child;
    }
  }
  return root;
}

// ---- drawing -----------------------------------------------------------------
function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.appendChild(e);
  return e;
}

function drawBoard(parent, fen, flipped) {
  const rows = fen.split(" ")[0].split("/");
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += +ch; continue; }
      const piece = (ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase();
      const [x, y] = flipped ? [7 - f, 7 - r] : [f, r];
      el("image", { href: `pieces/${piece}.svg`, x: x * CELL, y: y * CELL, width: CELL, height: CELL }, parent);
      f++;
    }
  });
}

function drawNode(parent, d, flipped) {
  const g = el("g", { transform: `translate(${d.x - BOARD / 2},${d.y - NODE_H})` }, parent);
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++)
      el("rect", { x: f * CELL, y: r * CELL, width: CELL, height: CELL, fill: (r + f) % 2 ? DARK : LIGHT }, g);
  drawBoard(g, d.data.fen, flipped);
  // move number + SAN, e.g. "1. d4" or "1... d5" (root shows "start")
  const ply = d.depth;
  const label = `${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."} ${d.data.san}`;
  el("text", { class: "san", x: BOARD / 2, y: BOARD + 28 }, g).textContent = label;
  if (d.data.comment) el("text", { class: "comment", x: BOARD / 2, y: BOARD + 52 }, g).textContent = d.data.comment;
}

async function main() {
  const { file, orientation } = document.body.dataset;
  const flipped = orientation === "black";
  const text = await (await fetch(file)).text();
  const root = tree().nodeSize([NODE_W, NODE_H])(hierarchy(parse(text)));

  const nodes = root.descendants().filter(d => d.depth > 0);   // the start position is not drawn
  const minX = Math.min(...nodes.map(d => d.x)) - NODE_W / 2;
  const maxX = Math.max(...nodes.map(d => d.x)) + NODE_W / 2;
  const maxY = Math.max(...nodes.map(d => d.y));

  const svg = el("svg", { viewBox: `${minX} 0 ${maxX - minX} ${maxY}`, width: maxX - minX, height: maxY });
  for (const d of nodes) drawNode(svg, d, flipped);
  document.getElementById("tree").appendChild(svg);
}

main().catch(e => { document.getElementById("tree").textContent = "Error: " + e.message; });
