import { parse, board, showError } from "./board.js?v=46";

// last move with its number, e.g. "2.Bf4" or "1...d5"
function label(moves, glyph = "") {
  const ply = moves.length;
  if (!ply) return "";   // a position given as a FEN has no last move
  return `${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."}${moves[ply - 1]}${glyph}`;
}

// a figure: a board with its move caption
function makeFigure(node, flipped) {
  const fig = document.createElement("figure");
  if (node.empty) fig.className = "empty";   // the "@empty" board: faded, nothing to click
  fig.appendChild(board(node, flipped));
  fig.addEventListener("click", e => {      // cmd/ctrl-click: open this position on the chess.com analysis board
    if (e.metaKey || e.ctrlKey) window.open(`https://www.chess.com/analysis?fen=${encodeURI(node.fen)}&flip=${flipped}`, "_blank", "noopener");
  });
  const cap = document.createElement("figcaption");
  cap.textContent = label(node.moves, node.glyph);
  fig.appendChild(cap);
  return fig;
}

function note(text, side) {
  const p = document.createElement("p");
  p.className = `note ${side}`;
  // tiny markdown, built with DOM nodes (never innerHTML): **bold**, *italic*, [text](url), <br>
  const add = (parent, str) => {
    for (const m of str.matchAll(/(<br\s*\/?>)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|([^*<\[]+|[*<\[])/gi)) {
      const [whole, br, label, url, bold, ital, plain] = m;
      if (br) parent.appendChild(document.createElement("br"));
      else if (label !== undefined) {
        const external = /^https?:\/\//i.test(url);
        if (!external && /^[a-z][a-z0-9+.-]*:/i.test(url)) { parent.appendChild(document.createTextNode(whole)); continue; }   // javascript: and friends stay text
        const a = parent.appendChild(document.createElement("a"));
        a.href = url;
        if (external) { a.target = "_blank"; a.rel = "noopener"; }   // other pages of this site open in the same tab
        add(a, label);
      }
      else if (bold !== undefined) add(parent.appendChild(document.createElement("strong")), bold);
      else if (ital !== undefined) add(parent.appendChild(document.createElement("em")), ital);
      else parent.appendChild(document.createTextNode(plain));
    }
  };
  add(p, text);
  return p;
}

// a block is a board with its replies in a row below it; side says where its comment goes.
// Alternative lines ("~") sit in a column of smaller boards to the left of the board.
function block(node, side, flipped) {
  const div = document.createElement("div");
  div.className = "block";
  const main = document.createElement("div");
  main.className = "main";
  const fig = makeFigure(node, flipped);
  if (node.comment) fig.appendChild(note(node.comment, side));
  main.appendChild(fig);
  if (node.asides.length) {
    const col = document.createElement("div");
    col.className = "asides";
    for (const a of node.asides) {
      const f = makeFigure(a, flipped);
      f.classList.add("aside");
      if (a.comment) f.appendChild(note(a.comment, "below"));              // under its own board
      col.appendChild(f);
    }
    main.appendChild(col);
  }
  div.appendChild(main);
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
  const figs = [...document.querySelectorAll("#tree figure:not(.aside):not(.empty)")];   // document order is that tree order
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

  function move(step) {
    const target = figs[figs.indexOf(current()) + step];
    if (!target) return false;              // first or last board
    go(target);
    return true;
  }

  addEventListener("keydown", e => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const target = figs[figs.indexOf(current()) + step];
    if (!target) return;                    // first or last board: normal browser behaviour
    e.preventDefault();
    go(target);
  });

  // subtle buttons, bottom right: the arrow keys (for touch screens, and a hint that the keys work),
  // and above them a jump to the other end of the sequence
  const nav = document.createElement("div");
  nav.id = "stepper";
  const button = (label, inner, onclick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
    b.addEventListener("click", onclick);
    nav.appendChild(b);
    return b;
  };
  // a green circle: the annotations, comments and side boards are shown. Click for study mode (grey circle): only the
  // main line of boards, to analyse the positions yourself
  const study = button("study mode", `<circle cx="12" cy="12" r="8"/>`, () => setStudy(!document.body.classList.contains("study")));
  study.id = "study-toggle";
  function setStudy(on) {
    document.body.classList.toggle("study", on);
    document.body.classList.toggle("marks", !on);   // marks: the hover layers always on
    study.setAttribute("aria-pressed", on);
    study.setAttribute("aria-label", on ? "leave study mode" : "study mode");
    try { localStorage.setItem("aperture-study", on ? "1" : "0"); } catch (e) {}
  }
  let saved = false;
  try { saved = localStorage.getItem("aperture-study") === "1"; } catch (e) {}
  setStudy(saved);

  const TO_START = `<path d="M6 5h12M6 16l6-6 6 6"/>`, TO_END = `<path d="M6 19h12M6 8l6 6 6-6"/>`;
  let toEnd = true;
  const jump = button("go to the end", TO_END, () => { go(toEnd ? figs[figs.length - 1] : figs[0]); refresh(); });
  button("previous board", `<path d="M6 15l6-6 6 6"/>`, () => { move(-1); refresh(); });
  button("next board", `<path d="M6 9l6 6 6-6"/>`, () => { move(1); refresh(); });
  function refresh() {   // in the first half of the sequence the jump goes to the end, in the second half back to the start
    toEnd = figs.indexOf(current()) < figs.length / 2;
    jump.setAttribute("aria-label", toEnd ? "go to the end" : "go to the start");
    jump.firstChild.innerHTML = toEnd ? TO_END : TO_START;
  }
  let pending = false;
  addEventListener("scroll", () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; refresh(); }); } }, { passive: true });
  addEventListener("keydown", () => requestAnimationFrame(refresh));
  refresh();
  document.body.appendChild(nav);
}

async function main() {
  const { file, orientation } = document.body.dataset;
  const root = parse(await (await fetch(file)).text());
  document.getElementById("tree").appendChild(row(root.children, orientation === "black"));
  enableKeys();
}

main().catch(e => showError(document.getElementById("tree"), e));
