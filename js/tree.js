import { parse, board } from "./board.js?v=16";

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
