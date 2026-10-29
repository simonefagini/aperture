import { parse, board } from "./board.js?v=20";

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

// ArrowDown / ArrowUp: scroll so the next / previous board lands exactly where the current one sits
function enableKeys() {
  const figs = [...document.querySelectorAll("#tree figure")];
  if (!figs.length) return;
  const pos = f => { const r = f.getBoundingClientRect(); return { top: r.top + scrollY, mid: r.left + r.width / 2 + scrollX }; };
  const anchor = pos(figs[0]).top;                    // where the first board sits when the page is at the top
  addEventListener("keydown", e => {
    if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const ps = figs.map(pos), line = scrollY + anchor;
    let cur = 0;                                      // the current board is the one closest to that line
    ps.forEach((p, i) => { if (Math.abs(p.top - line) < Math.abs(ps[cur].top - line)) cur = i; });
    const dir = e.key === "ArrowDown" ? 1 : -1;
    const next = ps.filter(p => dir * (p.top - ps[cur].top) > 1);   // boards further down (or up)
    if (!next.length) return;                         // none left: let the browser scroll as usual
    const rowTop = dir > 0 ? Math.min(...next.map(p => p.top)) : Math.max(...next.map(p => p.top));
    const row = next.filter(p => Math.abs(p.top - rowTop) < 1);     // the nearest row, and in it the branch you are on
    row.sort((a, b) => Math.abs(a.mid - ps[cur].mid) - Math.abs(b.mid - ps[cur].mid));
    e.preventDefault();
    scrollTo({ top: row[0].top - anchor, behavior: "instant" });   // a hard jump, no animation
  });
}

async function main() {
  const { file, orientation } = document.body.dataset;
  const root = parse(await (await fetch(file)).text());
  document.getElementById("tree").appendChild(row(root.children, orientation === "black"));
  enableKeys();
}

main().catch(e => { document.getElementById("tree").textContent = "Error: " + e.message; });
