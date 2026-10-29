import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

// printed-diagram look: paper squares, dark squares hatched with ink (same in light and dark mode)
const PAPER = "#f0eadc", INK = "#1a1a1a";
const NS = "http://www.w3.org/2000/svg";

// ---- parse: lines of SAN into a merged tree --------------------------------
function parse(text) {
  const root = { san: "", fen: new Chess().fen(), comment: "", children: [] };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const game = new Chess();
    let node = root;
    for (const [, comment, move] of line.matchAll(/\{([^}]*)\}|(\S+)/g)) {
      if (comment !== undefined) { if (node !== root && !node.comment) node.comment = comment; continue; }
      const san = game.move(move).san;       // throws on an illegal move
      let child = node.children.find(c => c.san === san);
      if (!child) { child = { san, fen: game.fen(), comment: "", children: [] }; node.children.push(child); }
      node = child;
    }
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

function board(fen, flipped) {
  const svg = el("svg", { viewBox: "0 0 8 8", class: "board" });
  const hatch = el("pattern", { id: "hatch", width: 0.11, height: 0.11, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, el("defs", {}, svg));
  el("line", { x1: 0, y1: 0, x2: 0, y2: 0.11, stroke: INK, "stroke-width": 0.022 }, hatch);
  el("rect", { width: 8, height: 8, fill: PAPER }, svg);
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++)
      if ((r + f) % 2) el("rect", { x: f, y: r, width: 1, height: 1, fill: "url(#hatch)" }, svg);
  el("rect", { x: 0.02, y: 0.02, width: 7.96, height: 7.96, fill: "none", stroke: INK, "stroke-width": 0.04 }, svg);
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
  return svg;
}

// last move with its number, e.g. "2.d4" or "1...d5"
function label(ply, san) {
  return `${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."}${san}`;
}

function figure(node, caption, flipped) {
  const fig = document.createElement("figure");
  fig.appendChild(board(node.fen, flipped));
  if (caption) {
    const cap = document.createElement("figcaption");
    cap.textContent = caption;
    fig.appendChild(cap);
  }
  return fig;
}

function note(text, side) {
  const p = document.createElement("p");
  p.className = `note ${side}`;
  p.textContent = text;
  return p;
}

async function main() {
  const { file, orientation } = document.body.dataset;
  const flipped = orientation === "black";
  const root = parse(await (await fetch(file)).text());

  // the replies: follow the single-move chain from the start until the first branching
  let node = root, moves = [];
  while (node.children.length === 1) { node = node.children[0]; moves.push(node.san); }

  // the top board is the position where the lines split, e.g. after 1.d4
  document.getElementById("start").appendChild(figure(node, "", flipped));

  // two replies, with room for a comment to the left of the first and to the right of the second
  const [a, b] = node.children;
  const ply = moves.length + 1;
  const replies = document.getElementById("replies");
  replies.append(
    note(a?.comment ?? "", "left"),
    ...(a ? [figure(a, label(ply, a.san), flipped)] : []),
    ...(b ? [figure(b, label(ply, b.san), flipped)] : []),
    note(b?.comment ?? "", "right"));
}

main().catch(e => { document.getElementById("start").textContent = "Error: " + e.message; });
