import { parse, board } from "./board.js?v=22";

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
  fig.addEventListener("click", e => {      // cmd/ctrl-click: open this position on the chess.com analysis board
    if (e.metaKey || e.ctrlKey) window.open(`https://www.chess.com/analysis?fen=${encodeURI(node.fen)}&flip=${flipped}`, "_blank", "noopener");
  });
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

// Keys on the opening page: Down / Right go to the next board, Up / Left to the previous one, in the
// order of the tree (a board, then its first branch all the way down, then the next branch, ...).
// The board you move to lands exactly where the current one sits: the first board's place on screen.
function enableKeys() {
  const figs = [...document.querySelectorAll("#tree figure")];   // document order is that tree order
  if (!figs.length) return;
  const treeEl = document.getElementById("tree");
  const top = f => f.getBoundingClientRect().top + scrollY;
  const anchor = top(figs[0]);              // where the first board sits when the page is at the top
  let sel = null;

  function current() {                      // the board at that place (several: the one nearest the middle)
    const line = scrollY + anchor, dist = f => Math.abs(top(f) - line);
    const best = Math.min(...figs.map(dist));
    if (sel && dist(sel) <= best + 1) return sel;               // still where we left it
    const x = f => { const r = f.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - innerWidth / 2); };
    return sel = figs.filter(f => dist(f) <= best + 1).sort((a, b) => x(a) - x(b))[0];
  }

  function go(target) {
    sel = target;
    scrollTo({ top: top(target) - anchor, behavior: "instant" });   // a hard jump
    const r = target.getBoundingClientRect(), t = treeEl.getBoundingClientRect();
    treeEl.scrollLeft += r.left + r.width / 2 - (t.left + t.width / 2);   // centre it when the tree is wider than the screen
  }

  addEventListener("keydown", e => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const target = figs[figs.indexOf(current()) + step];
    if (!target) return;                    // first or last board: normal browser behaviour
    e.preventDefault();
    go(target);
  });
}

async function main() {
  const { file, orientation } = document.body.dataset;
  const root = parse(await (await fetch(file)).text());
  document.getElementById("tree").appendChild(row(root.children, orientation === "black"));
  enableKeys();
}

main().catch(e => { document.getElementById("tree").textContent = "Error: " + e.message; });
