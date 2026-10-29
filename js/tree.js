import { parse, board } from "./board.js?v=21";

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

// Keys on the opening page. The current board is the one at the first board's place on screen.
//   Down / Up: jump to its first reply / its parent, landing exactly where the current board sits
//   Right / Left: switch to the next / previous branch (same parent); Down then follows that branch
function enableKeys() {
  const figs = [...document.querySelectorAll("#tree figure")];
  if (!figs.length) return;
  const treeEl = document.getElementById("tree");
  const top = f => f.getBoundingClientRect().top + scrollY;
  const anchor = top(figs[0]);              // where the first board sits when the page is at the top
  const choice = new Map();                 // board block -> the reply you were last on
  let sel = null;

  const blockOf = f => f.closest(".block");
  const figOf = b => b.querySelector(":scope > figure");
  const repliesOf = b => [...b.querySelectorAll(":scope > .kids > .block")];

  function current() {
    const line = scrollY + anchor, dist = f => Math.abs(top(f) - line);
    const best = Math.min(...figs.map(dist));
    if (sel && dist(sel) <= best + 1) return sel;               // still where we left it
    const x = f => { const r = f.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - innerWidth / 2); };
    return sel = figs.filter(f => dist(f) <= best + 1).sort((a, b) => x(a) - x(b))[0];   // e.g. after scrolling by hand
  }

  function go(target) {
    sel = target;
    scrollTo({ top: top(target) - anchor, behavior: "instant" });   // a hard jump
    const r = target.getBoundingClientRect(), t = treeEl.getBoundingClientRect();
    treeEl.scrollLeft += r.left + r.width / 2 - (t.left + t.width / 2);   // centre the branch when the tree is wider than the screen
  }

  addEventListener("keydown", e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const b = blockOf(current()), parent = b.parentElement.closest(".block");
    let target = null;
    if (e.key === "ArrowDown") {
      const replies = repliesOf(b);
      if (replies.length) { const next = choice.get(b) ?? replies[0]; choice.set(b, next); target = figOf(next); }
    } else if (e.key === "ArrowUp") {
      if (parent) target = figOf(parent);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const sibs = [...b.parentElement.children], next = sibs[sibs.indexOf(b) + (e.key === "ArrowRight" ? 1 : -1)];
      if (next) { target = figOf(next); if (parent) choice.set(parent, next); }
    }
    if (!target) return;                    // nothing there: normal browser behaviour
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
