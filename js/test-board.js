import { parse, board } from "./board.js?v=54";

// a board that follows what you type: SAN, move numbers, ! ? $7, and the { [%cal ...] [%csl ...] [%sqr ...] } marks
const stage = document.getElementById("stage"), input = document.getElementById("san"), msg = document.getElementById("msg");
let flipped = false, node = null;

// the board at the end of the typed line (an empty input is the starting position)
function positionOf(text) {
  let n = parse(text);
  while (n.children.length && !n.children[0].empty) n = n.children[0];
  return n;
}

// last move with its number, e.g. "2.Bf4!" or "1...d5"
function label(n) {
  const ply = n.moves.length;
  if (!ply) return "";
  return `${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."}${n.moves[ply - 1]}${n.glyph === "$7" ? "□" : n.glyph ?? ""}`;
}

function draw() {
  const fig = document.createElement("figure");
  fig.appendChild(board(node, flipped));
  const cap = document.createElement("figcaption");
  cap.textContent = label(node) || " ";
  fig.appendChild(cap);
  stage.replaceChildren(fig);
}

function update() {
  try {
    node = positionOf(input.value);
    msg.textContent = "";
  } catch (e) {   // half-typed: keep the last good board and say what is wrong
    msg.textContent = e.message;
    if (node) return;
    node = positionOf("");
  }
  draw();
}

input.addEventListener("input", update);
document.getElementById("flip").addEventListener("click", () => { flipped = !flipped; draw(); });
input.value = "1. d4 d5 2. Bf4! c5 {[%cal Rc5d4,Gf4c7]}";
update();
input.focus();
