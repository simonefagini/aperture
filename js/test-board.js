import { parse, board } from "./board.js?v=57";

// a board that follows what you type: SAN, move numbers, ! ? $7, and the { [%cal ...] [%csl ...] [%sqr ...] } marks;
// "@fen <fen> [moves]" starts from any position (paste a whole FEN)
const stage = document.getElementById("stage"), input = document.getElementById("san");
let flipped = false, node = null;

// the board at the end of the typed line (an empty input is the starting position)
function positionOf(text) {
  if (text.trim().startsWith("@fen")) return parse(`d4\n~ ${text.trim()}`).children[0].asides[0];   // the parser only takes @fen on a side board
  let n = parse(text);
  while (n.children.length && !n.children[0].empty) n = n.children[0];
  return n;
}

// last move with its number, e.g. "2.Bf4!" or "1...d5"
function label(n, fromFen) {
  const ply = n.moves.length;
  if (!ply) return "";
  if (fromFen) return `${n.moves[ply - 1]}${n.glyph === "$7" ? "□" : n.glyph ?? ""}`;   // no move numbers after a FEN
  return `${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."}${n.moves[ply - 1]}${n.glyph === "$7" ? "□" : n.glyph ?? ""}`;
}

function draw() {
  const fig = document.createElement("figure");
  fig.appendChild(board(node, flipped));
  const cap = document.createElement("figcaption");
  cap.textContent = label(node, input.value.trim().startsWith("@fen")) || " ";
  fig.appendChild(cap);
  stage.replaceChildren(fig);
}

function update() {
  try {
    node = positionOf(input.value);
  } catch (e) {   // half-typed: keep the last good board
    if (node) return;
    node = positionOf("");
  }
  draw();
}

input.addEventListener("input", update);
document.getElementById("open").addEventListener("click", () =>   // the same as cmd-click on the tree page: this position on the chess.com analysis board
  window.open(`https://www.chess.com/analysis?fen=${encodeURI(node.fen)}&flip=${flipped}`, "_blank", "noopener"));
document.getElementById("flip").addEventListener("click", () => { flipped = !flipped; draw(); });
input.value = "1. d4 d5 2. Bf4! c5 {[%cal Rc5d4,Gf4c7]}";
update();
input.focus();
