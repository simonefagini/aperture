import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

const LIGHT = "#f0d9b5", DARK = "#b58863";
const NS = "http://www.w3.org/2000/svg";

// ---- parse: lines of SAN into a merged tree --------------------------------
function parse(text) {
  const root = { san: "", fen: new Chess().fen(), children: [] };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const game = new Chess();
    let node = root;
    for (const [, comment, move] of line.matchAll(/\{([^}]*)\}|(\S+)/g)) {
      if (comment !== undefined) continue;   // comments are not shown yet
      const san = game.move(move).san;       // throws on an illegal move
      let child = node.children.find(c => c.san === san);
      if (!child) { child = { san, fen: game.fen(), children: [] }; node.children.push(child); }
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
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++)
      el("rect", { x: f, y: r, width: 1, height: 1, fill: (r + f) % 2 ? DARK : LIGHT }, svg);
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

// "1.d4 d5" style label for a path of SAN moves
function label(moves) {
  return moves.map((m, i) => (i % 2 ? "" : `${i / 2 + 1}.`) + m).join(" ");
}

function figure(node, moves, flipped) {
  const fig = document.createElement("figure");
  fig.appendChild(board(node.fen, flipped));
  const cap = document.createElement("figcaption");
  cap.textContent = label(moves);
  if (moves.length) fig.appendChild(cap);
  return fig;
}

async function main() {
  const { file, orientation } = document.body.dataset;
  const flipped = orientation === "black";
  const root = parse(await (await fetch(file)).text());

  // the replies: follow the single-move chain from the start until the first branching
  let node = root, moves = [];
  while (node.children.length === 1) { node = node.children[0]; moves.push(node.san); }

  const start = document.getElementById("start");
  start.appendChild(figure(root, [], flipped));
  const replies = document.getElementById("replies");
  for (const child of node.children.slice(0, 2))
    replies.appendChild(figure(child, [...moves, child.san], flipped));
}

main().catch(e => { document.getElementById("start").textContent = "Error: " + e.message; });
