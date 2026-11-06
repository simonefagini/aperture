import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

// printed-diagram look: paper squares, dark squares hatched with ink (same in light and dark mode)
const PAPER = "#f0eadc", INK = "#1a1a1a";
// last-move highlight, as in most engines: lighter green for the square it left, darker for where it landed
const FROM_GREEN = { fill: "#b5d86a", "fill-opacity": 0.4 }, TO_GREEN = { fill: "#6fa83a", "fill-opacity": 0.45 };
// Lichess-style marks: G/R/Y/B in [%cal ...] (arrows) and [%csl ...] (circles)
const MARK_COLORS = { G: "#15781b", R: "#d03a3a", Y: "#e68f00", B: "#1d56c0" };
const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";
// an error that knows the offending token (and which occurrence of it), so the page can point at it
const fail = (message, token, occurrence = 0) => Object.assign(new Error(message), { token, occurrence });
const GLYPHS = ["!", "?", "!!", "??", "!?", "?!", "$7"];   // as in PGN: good, mistake, brilliant, blunder, interesting, dubious, and $7 = forced move (NAG 7)
// badges on the board, in the top right corner of the square the move went to (Lichess / chess.com style)
const BADGES = { "!": { fill: "#2f9e44", text: "!" }, "!!": { fill: "#1ba39c", text: "!!" }, "?": { fill: "#e08a1e", text: "?" }, "??": { fill: "#c93a3a", text: "??" }, "$7": { fill: "#8b8b8b", arrow: true } };
const CHECK_RED = { fill: "#d03a3a", "fill-opacity": 0.55 };
const NS = "http://www.w3.org/2000/svg";

// a knight's move: one square along one axis, two along the other
function isKnightMove(a, b) {
  const df = Math.abs("abcdefgh".indexOf(a[0]) - "abcdefgh".indexOf(b[0])), dr = Math.abs(a[1] - b[1]);
  return df * dr === 2;
}

// pull the [%cal ...] / [%csl ...] codes out of a comment; what is left is its text, all on one flow (line breaks are just spaces), line by line
function marksIn(comment, lineNo) {
  const arrows = [], rings = [], sqr = { checks: [] };
  const text = comment.replace(/\[%(cal|csl|sqr)\s+([^\]]*)\]/g, (_, kind, list) => {
    for (const item of list.split(/[\s,]+/).filter(Boolean)) {
      const ok = kind === "cal" ? /^[GRYB][a-h][1-8][a-h][1-8][Ll]?$/ : kind === "csl" ? /^[GRYB][a-h][1-8]$/ : /^[SER][a-h][1-8]$/;
      if (!ok.test(item)) throw fail(`line ${lineNo}: "${item}" is not a valid ${kind} mark`, item);
      if (kind === "cal" && item.length === 6 && !isKnightMove(item.slice(1, 3), item.slice(3, 5)))
        throw fail(`line ${lineNo}: "${item}": an L-shaped arrow (L or l at the end) only works for a knight move`, item);
      if (kind === "sqr" && item[0] === "R") sqr.checks.push(item.slice(1));       // [%sqr Rg8]: a red square, for a check
      else if (kind === "sqr") sqr[item[0] === "S" ? "from" : "to"] = item.slice(1);   // [%sqr Sb1,Eb2]: the last-move squares, start and end
      else if (kind === "cal" && item.slice(1, 3) !== item.slice(3, 5)) arrows.push(item);
      else rings.push(kind === "cal" ? item.slice(0, 3) : item);   // an arrow from a square to itself is a circle
    }
    return "";
  }).replace(/\s+/g, " ").trim();
  return { note: text, arrows, rings, sqr };
}

// the file as logical lines [first line number, text]: a { comment } may run over several lines,
// and "#" lines are never joined to the next one
function logicalLines(text) {
  const out = [];
  let buf = null, start = 0;
  text.split("\n").forEach((raw, i) => {
    if (buf === null && raw.trim().startsWith("#")) { out.push([i + 1, raw]); return; }
    if (buf === null) { buf = raw; start = i + 1; } else buf += "\n" + raw;
    if ((buf.match(/\{/g) || []).length <= (buf.match(/\}/g) || []).length) { out.push([start, buf]); buf = null; }
  });
  if (buf !== null) throw new Error(`line ${start}: a { comment is never closed`);
  return out;
}

// ---- parse: every line is one board; its parent is the nearest listed shorter line ----
export function parse(text) {
  const root = { moves: [], fen: new Chess().fen(), comment: "", arrows: [], rings: [], asides: [], children: [] };
  const byKey = new Map([["", root]]);
  const nodes = [];
  let lastNode = null;   // the board a "~" line hangs on: the last ordinary line
  const handle = ([lineNo, raw]) => {
    let line = raw.trim();
    if (!line || line.startsWith("#")) return;
    if (line === "@empty") {                         // "@empty" on its own line: an empty board after the line above it
      if (!lastNode) throw new Error(`line ${lineNo}: "@empty" needs a line above it`);
      lastNode.more = true;
      return;
    }
    const isAside = line.startsWith("~");            // "~ <moves>": an alternative line shown beside the board above
    if (isAside) line = line.slice(1).trim();
    const isPreview = line.startsWith("@preview");   // "@preview <moves>": the board shown on the home page
    if (isPreview) line = line.slice("@preview".length).trim();
    let game = new Chess(), fromFen = false;
    if (line.startsWith("@fen")) {                  // "~ @fen <pieces> [moves] {comment}": any position, as a side board
      if (!isAside) throw new Error(`line ${lineNo}: "@fen" only works on a "~" line (a side board)`);
      const [placement = "", ...rest] = line.slice(4).trim().split(/\s+/);   // only the piece placement; the rest is assumed
      try { game = new Chess(`${placement} w - - 0 1`, { skipValidation: true }); }   // no kings needed
      catch (e) { throw fail(`line ${lineNo}: "${placement}" is not a valid FEN piece placement`, placement); }
      line = rest.join(" ");
      fromFen = true;
    }
    const moves = [];
    let comment = "", last, more = false, pending = null, glyph = "";
    const seen = {};   // how many times each token has appeared, to point at the right one in an error
    for (const [, c, tok] of line.matchAll(/\{([^}]*)\}|(\S+)/g)) {
      if (c !== undefined) { comment = c; continue; }   // a {comment} belongs to the move before it
      if (tok === "@empty") { more = true; continue; } // "@empty" after a line: an empty board after it, to suggest the line goes on
      seen[tok] = (seen[tok] ?? -1) + 1;
      let move = tok;
      const num = /^(\d+)(\.+)(.*)$/.exec(tok);   // an optional move number: "3." "3.e3" "3..." "3...Nf6"
      if (num) {
        if (num[2].length !== 1 && num[2].length !== 3) throw fail(`line ${lineNo}: "${tok}" is not a move number (use "3." for White, "3..." for Black)`, tok, seen[tok]);
        pending = { n: +num[1], dots: num[2].length, tok, occurrence: seen[tok] };
        move = num[3];
        if (!move) continue;                            // the number stands alone: it belongs to the next move
      }
      if (pending && !fromFen) {                        // numbers are checked against the position (not after an @fen start)
        const ply = moves.length, white = ply % 2 === 0;
        const expected = white ? `${ply / 2 + 1}.` : `${(ply + 1) / 2}...`;
        if (pending.n !== (white ? ply / 2 + 1 : (ply + 1) / 2) || pending.dots !== (white ? 1 : 3))
          throw fail(`line ${lineNo}: expected "${expected}" before ${move}, found "${pending.tok}"`, pending.tok, pending.occurrence);
      }
      pending = null;
      const g = /(\$\d+|[!?]{1,2})$/.exec(move);           // a move annotation: ! ? !! ?? !? ?! or $7 (forced)
      if (g && !GLYPHS.includes(g[0])) throw fail(`line ${lineNo}: "${g[0]}" is not a move annotation (use ! ? !! ?? !? ?! or $7)`, tok, seen[tok]);
      glyph = g ? g[0] : "";
      if (g) move = move.slice(0, -g[0].length);
      try { last = game.move(move); moves.push(last.san); }
      catch (e) { throw fail(`line ${lineNo}: "${move}" is not a legal move here`, tok, seen[tok]); }
      comment = "";                                       // only a comment after the last move counts
    }
    if (!moves.length && !fromFen) return;
    const { note, arrows, rings, sqr } = marksIn(comment, lineNo);
    const from = sqr.from ?? last?.from, to = sqr.to ?? last?.to;
    if (isPreview) { root.preview = { moves, glyph, checks: sqr.checks, fen: game.fen(), from, to, arrows, rings }; return; }
    if (isAside) {
      if (!lastNode) throw new Error(`line ${lineNo}: a "~" line needs a board above it`);
      lastNode.asides.push({ moves, glyph, checks: sqr.checks, fen: game.fen(), from, to, comment: note, arrows, rings });
      return;
    }
    const key = moves.join(" ");
    if (byKey.has(key)) {   // repeated line: keep the first board, take any comment or marks from this one
      const same = byKey.get(key);
      if (note) same.comment = note;
      if (glyph) same.glyph = glyph;
      same.checks.push(...sqr.checks);
      if (sqr.from) same.from = sqr.from;
      if (sqr.to) same.to = sqr.to;
      same.arrows.push(...arrows); same.rings.push(...rings);
      if (more) same.more = true;
      lastNode = same;
      return;
    }
    const node = { moves, glyph, checks: sqr.checks, fen: game.fen(), from, to, comment: note, arrows, rings, asides: [], children: [], more };
    byKey.set(key, node);
    nodes.push(node);
    lastNode = node;
  };
  logicalLines(text).forEach(entry => {   // an error carries its line, so the page can show it
    try { handle(entry); } catch (e) { e.lineNo = entry[0]; e.source = entry[1]; throw e; }
  });
  for (const node of nodes) {   // parent = longest listed prefix (else the start position)
    let n = node.moves.length - 1;
    while (n > 0 && !byKey.has(node.moves.slice(0, n).join(" "))) n--;
    byKey.get(node.moves.slice(0, n).join(" ")).children.push(node);
  }
  for (const node of nodes)   // "@empty": a faded, empty board after a line that has no replies of its own
    if (node.more && !node.children.length) node.children.push({ moves: [], fen: EMPTY_FEN, empty: true, comment: "", arrows: [], rings: [], asides: [], children: [] });
  return root;
}

// ---- drawing: a board is an 8x8 SVG that scales to its container ----------
function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.appendChild(e);
  return e;
}

// centre of a square like "e4" in board units
function center(sq, flipped) {
  const f = "abcdefgh".indexOf(sq[0]), r = 8 - +sq[1];
  return flipped ? [7 - f + 0.5, 7 - r + 0.5] : [f + 0.5, r + 0.5];
}

// hover layer (under the pieces): tint the squares the last move went from and to
function tints(parent, node, flipped) {
  const g = el("g", { class: "layer" }, parent);
  for (const [sq, green] of [[node.from, FROM_GREEN], [node.to, TO_GREEN]]) {
    if (!sq) continue;
    const [x, y] = center(sq, flipped);
    el("rect", { x: x - 0.5, y: y - 0.5, width: 1, height: 1, ...green }, g);
  }
  for (const sq of node.checks ?? []) {   // [%sqr Rg8]: a red square, e.g. the king in check
    const [x, y] = center(sq, flipped);
    el("rect", { x: x - 0.5, y: y - 0.5, width: 1, height: 1, ...CHECK_RED }, g);
  }
}

// an arrow from one square to another: Lichess-like: thick shaft, short head, transparent.
// elbow "L": a knight's arrow bent in an L, the long leg first; "l": the short leg first
function arrow(parent, color, from, to, flipped, elbow) {
  const [x0, y0] = center(from, flipped), [x1, y1] = center(to, flipped);
  // the corner of the L (none for a straight arrow)
  let corner = null;
  if (elbow) {
    const longX = Math.abs(x1 - x0) > Math.abs(y1 - y0);   // the long leg runs along x
    corner = (elbow === "L") === longX ? [x1, y0] : [x0, y1];
  }
  const [cx, cy] = corner ?? [x0, y0];
  const L2 = Math.hypot(x1 - cx, y1 - cy), ux = (x1 - cx) / L2, uy = (y1 - cy) / L2;          // direction of the head
  const tx = x1 - ux * 0.05, ty = y1 - uy * 0.05;            // tip
  const bx = tx - ux * 0.45, by = ty - uy * 0.45;            // base of the head
  const head = `${tx},${ty} ${bx - uy * 0.31},${by + ux * 0.31} ${bx + uy * 0.31},${by - ux * 0.31}`;
  const sx = x0, sy = y0;   // the arrow starts exactly at the centre of its square
  const end = `${bx + ux * 0.05},${by + uy * 0.05}`;
  const path = corner ? `M${sx},${sy} L${cx},${cy} L${end}` : `M${sx},${sy} L${end}`;   // an L has a sharp corner
  const g = el("g", { opacity: 0.72 }, parent);             // one opacity for the whole arrow, so shaft and head do not double up
  el("path", { d: path, fill: "none", stroke: color, "stroke-width": 0.22, "stroke-linecap": "butt", "stroke-linejoin": "miter" }, g);
  el("polygon", { points: head, fill: color }, g);
}

// a round badge in the top right corner of a square: "!" "!!", or a grey arrow for a forced move
function drawBadge(parent, b, sq, flipped) {
  const [x, y] = center(sq, flipped), cx = x + 0.32, cy = y - 0.32;
  el("circle", { cx, cy, r: 0.19, fill: b.fill, stroke: "#fff", "stroke-width": 0.03 }, parent);
  if (b.arrow) {
    el("path", { d: `M${cx - 0.09},${cy} H${cx + 0.09} M${cx + 0.01},${cy - 0.08} L${cx + 0.09},${cy} L${cx + 0.01},${cy + 0.08}`, fill: "none", stroke: "#fff", "stroke-width": 0.045, "stroke-linecap": "round", "stroke-linejoin": "round" }, parent);
    return;
  }
  const t = el("text", { x: cx, y: cy + (b.text.length > 1 ? 0.085 : 0.1), "text-anchor": "middle", "font-size": b.text.length > 1 ? 0.27 : 0.34, "font-weight": 700, fill: "#fff", "font-family": "Onest, system-ui, sans-serif" }, parent);
  t.textContent = b.text;
}

// hover layer (over the pieces): the marks written in the comment
function marks(parent, node, flipped) {
  const badge = BADGES[node.glyph] && node.to;
  if (!node.arrows?.length && !node.rings?.length && !badge) return;
  const g = el("g", { class: "layer" }, parent);
  for (const item of node.rings) {
    const [x, y] = center(item.slice(1), flipped);
    el("circle", { cx: x, cy: y, r: 0.42, fill: "none", stroke: MARK_COLORS[item[0]], "stroke-width": 0.092, opacity: 0.6 }, g);   // same colour and transparency as the arrows, no outline
  }
  if (badge) drawBadge(g, BADGES[node.glyph], node.to, flipped);
  for (const item of node.arrows) arrow(g, MARK_COLORS[item[0]], item.slice(1, 3), item.slice(3, 5), flipped, item[5]);
}

export function board(node, flipped) {
  const fen = node.fen;
  const svg = el("svg", { viewBox: "-0.55 0 9.1 8.6", class: "board" });   // extra room for the coordinates
  const hatch = el("pattern", { id: "hatch", width: 0.11, height: 0.11, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, el("defs", {}, svg));
  el("line", { x1: 0, y1: 0, x2: 0, y2: 0.11, stroke: INK, "stroke-width": 0.04 }, hatch);
  el("rect", { width: 8, height: 8, fill: PAPER }, svg);
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++)
      if ((r + f) % 2) el("rect", { x: f, y: r, width: 1, height: 1, fill: "url(#hatch)" }, svg);
  el("rect", { x: 0.02, y: 0.02, width: 7.96, height: 7.96, fill: "none", stroke: INK, "stroke-width": 0.04 }, svg);
  // coordinates outside the frame: files below, ranks on the left (reversed when flipped)
  for (let i = 0; i < 8; i++) {
    const file = "abcdefgh"[flipped ? 7 - i : i], rank = flipped ? i + 1 : 8 - i;
    el("text", { class: "coord", x: i + 0.5, y: 8.4 }, svg).textContent = file;
    el("text", { class: "coord", x: -0.28, y: i + 0.62 }, svg).textContent = rank;
  }
  tints(svg, node, flipped);   // the last-move squares sit under the pieces
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
  marks(svg, node, flipped);   // arrows and circles sit on top of the pieces
  return svg;
}

// show a parse error on the page like a debugger: the message, then the line it is about, the culprit marked
export function showError(target, e) {
  target.replaceChildren();
  const box = document.createElement("div");
  box.className = "error";
  const msg = document.createElement("p");
  msg.className = "msg";
  msg.textContent = e.message;
  box.appendChild(msg);
  if (e.source) {
    const pre = document.createElement("pre");
    const gutter = document.createElement("span");
    gutter.className = "gutter";
    gutter.textContent = `${e.lineNo} │ `;
    pre.appendChild(gutter);
    const src = e.source.trim().slice(0, 400);
    let at = -1;
    if (e.token) for (let i = 0, from = 0; i <= (e.occurrence ?? 0); i++) { at = src.indexOf(e.token, from); if (at < 0) break; from = at + e.token.length; }
    if (at < 0) pre.append(src);
    else {
      const mark = document.createElement("mark");
      mark.textContent = e.token;
      pre.append(src.slice(0, at), mark, src.slice(at + e.token.length));
    }
    box.appendChild(pre);
  }
  target.appendChild(box);
}
