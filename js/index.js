import { parse, board } from "./board.js?v=15";

// the openings on the home page; every other cell is an empty placeholder
const OPENINGS = [
  { name: "London System", page: "london.html", file: "data/london.txt", flipped: false },
];
const PLACEHOLDERS = 5;
const MAX_PLIES = 16;   // the preview follows the first line for up to 8 moves each
const EMPTY = { fen: "8/8/8/8/8/8/8/8 w - - 0 1" };

// the board to show: follow the first reply of each position, as far as the data goes (max 8 moves)
async function preview(file) {
  let node = parse(await (await fetch(file)).text());
  while (node.children.length && node.moves.length < MAX_PLIES) node = node.children[0];
  return node;
}

function card(tag, node, name, flipped, href) {
  const el = document.createElement(tag);
  el.className = "card";
  if (href) el.href = href;
  const fig = document.createElement("figure");
  fig.appendChild(board(node, flipped));
  const cap = document.createElement("figcaption");
  cap.textContent = name;
  fig.appendChild(cap);
  el.appendChild(fig);
  return el;
}

async function main() {
  const grid = document.getElementById("grid");
  for (const o of OPENINGS) grid.appendChild(card("a", await preview(o.file), o.name, o.flipped, o.page));
  for (let i = 0; i < PLACEHOLDERS; i++) {
    const empty = card("div", EMPTY, " ", false);
    empty.classList.add("empty");
    grid.appendChild(empty);
  }
}

main().catch(e => { document.getElementById("grid").textContent = "Error: " + e.message; });
