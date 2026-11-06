import { parse, board } from "./board.js?v=39";

// the variations of each opening: a name, the moves that define it (shown as SAN and as the little board),
// and the page with its tree. A "{[%cal ...]}" after the moves adds marks to the board.
const OPENINGS = {
  london: {
    flipped: false,
    variations: [
      { name: "Main line", moves: "d4 d5 Bf4 {[%cal Gc1f4]}", page: "london-main.html" },
    ],
  },
};

// "d4 d5 Bf4" -> "1. d4 d5 2. Bf4"
function numbered(moves) {
  return moves.map((m, i) => (i % 2 ? "" : `${i / 2 + 1}. `) + m).join(" ");
}

const PLACEHOLDERS = 3;
const EMPTY = { fen: "8/8/8/8/8/8/8/8 w - - 0 1" };

function item(v, flipped) {
  const empty = !v;   // a placeholder: an empty board and no text
  const preview = empty ? { ...EMPTY, moves: [] } : parse(`@preview ${v.moves}`).preview;
  const a = document.createElement(empty ? "div" : "a");
  a.className = empty ? "variation empty" : "variation";
  if (!empty) a.href = v.page;
  const fig = document.createElement("figure");
  fig.appendChild(board(preview, flipped));
  const text = document.createElement("div");
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = empty ? " " : v.name;
  const san = document.createElement("div");
  san.className = "san";
  san.textContent = empty ? " " : numbered(preview.moves);
  text.append(name, san);
  a.append(fig, text);
  return a;
}

const opening = OPENINGS[document.body.dataset.opening];
const list = document.getElementById("list");
for (const v of opening.variations) list.appendChild(item(v, opening.flipped));
for (let i = 0; i < PLACEHOLDERS; i++) list.appendChild(item(null, opening.flipped));
