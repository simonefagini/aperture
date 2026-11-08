import { board } from "./board.js?v=57";

// train the coordinates, two ways (the icon under flip switches):
//  type: one square lights up on an empty board, you type its name (e4); right: another one lights up, wrong: the text turns red
//  click: a name is shown, you click that square on the board; right: another name, wrong: the square you clicked flashes red
// the green circle shows or hides the coordinates around the board; ctrl/cmd-Enter picks which files are asked.
const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1", FILES = "abcdefgh";
const stage = document.getElementById("stage"), input = document.getElementById("san"), panel = document.getElementById("files");
const boxes = [...panel.querySelectorAll("input")];
let flipped = false, target = null, clickMode = false, flash = null, reveal = false, flashTimer = 0;

// the ticked files / ranks (none ticked counts as all, so there is always a square to ask)
const picked = group => {
  const all = boxes.filter(b => b.dataset.group === group);
  const on = all.filter(b => b.checked);
  return (on.length ? on : all).map(b => b.value);
};

function draw() {
  const fig = document.createElement("figure");
  const svg = board({ fen: EMPTY_FEN, to: !clickMode || reveal ? target : undefined, checks: flash ? [flash] : [], arrows: [], rings: [] }, flipped);   // in click mode nothing is lit until you have answered: the name is the question
  if (clickMode) svg.addEventListener("click", e => clicked(squareAt(svg, e)));
  fig.appendChild(svg);
  const cap = document.createElement("figcaption");
  cap.textContent = " ";   // same height as the test board
  fig.appendChild(cap);
  stage.replaceChildren(fig);
}

// a new square on one of the enabled files, never the same twice in a row
function next() {
  const files = picked("files"), ranks = picked("ranks");
  if (files.length * ranks.length === 1 && files[0] + ranks[0] === target) return;   // only one square to ask
  const any = list => list[Math.floor(Math.random() * list.length)];
  let sq;
  do sq = any(files) + any(ranks);
  while (sq === target);
  if (!target) input.placeholder = sq;   // the first square is given away as an example; it vanishes when you type
  else input.placeholder = "";
  target = sq;
  if (clickMode) input.value = sq;
  draw();
}

// the square under a click: the svg is 9.1 x 8.6 units, with the board's corner at (0, 0)
function squareAt(svg, e) {
  const r = svg.getBoundingClientRect();
  let f = Math.floor(-0.55 + (e.clientX - r.left) / r.width * 9.1), row = Math.floor((e.clientY - r.top) / r.height * 8.6);
  if (f < 0 || f > 7 || row < 0 || row > 7) return null;
  if (flipped) { f = 7 - f; row = 7 - row; }
  return FILES[f] + (8 - row);
}

function clicked(sq) {
  if (!sq || reveal) return;   // while the answer is shown, clicks wait
  reveal = true;               // the right square goes green; a wrong click goes red as well
  flash = sq === target ? null : sq;
  draw();
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { reveal = false; flash = null; next(); }, sq === target ? 350 : 1000);   // then the next name
}

input.addEventListener("input", () => {
  const typed = input.value.trim().toLowerCase();
  if (typed === target) { input.value = ""; input.classList.remove("wrong"); next(); return; }
  input.classList.toggle("wrong", !target.startsWith(typed));   // red as soon as it cannot become the answer
  if (/^[a-h][1-8]$/.test(typed)) {   // a whole wrong square: it goes red on the board for a second, then the field is clear again
    flash = typed;
    input.readOnly = true;
    draw();
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flash = null; input.readOnly = false; input.value = ""; input.classList.remove("wrong"); draw(); input.focus(); }, 1000);
  }
});

// the mode icon: type (keyboard) or click (pointer); it shows the mode you would switch to
const modeButton = document.getElementById("mode");
function setMode(on) {
  clickMode = on;
  document.body.classList.toggle("clickmode", on);
  input.readOnly = on;
  input.value = on ? target : "";
  input.classList.remove("wrong");
  modeButton.setAttribute("aria-label", on ? "type the names instead" : "click the squares instead");
  try { localStorage.setItem("aperture-coords-mode", on ? "click" : "type"); } catch (e) {}
  flash = null; reveal = false;
  clearTimeout(flashTimer);
  draw();
  input.focus();
}
modeButton.addEventListener("click", () => setMode(!clickMode));

// the green circle: coordinates shown; grey: hidden
const toggle = document.getElementById("study-toggle");
function setHidden(on) {
  document.body.classList.toggle("nocoords", on);
  toggle.setAttribute("aria-pressed", on);
  toggle.setAttribute("aria-label", on ? "show the coordinates" : "hide the coordinates");
}
toggle.addEventListener("click", () => { setHidden(!document.body.classList.contains("nocoords")); input.focus(); });

// the files and ranks: remembered; "all" and "none" tick a whole row at once
const KEY = "aperture-coords-picked";
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved) boxes.forEach(b => { if (Array.isArray(saved[b.dataset.group])) b.checked = saved[b.dataset.group].includes(b.value); });
} catch (e) {}
function changed() {
  try { localStorage.setItem(KEY, JSON.stringify({ files: boxes.filter(b => b.dataset.group === "files" && b.checked).map(b => b.value), ranks: boxes.filter(b => b.dataset.group === "ranks" && b.checked).map(b => b.value) })); } catch (err) {}
  if (!picked("files").includes(target[0]) || !picked("ranks").includes(target[1])) next();
  input.focus();
}
panel.addEventListener("change", changed);
panel.addEventListener("click", e => {
  const set = e.target.dataset?.set;
  if (!set) return;
  boxes.filter(b => b.dataset.group === e.target.parentElement.dataset.group).forEach(b => { b.checked = set === "all"; });
  changed();
});

document.addEventListener("keydown", e => {   // the files and ranks panel: ctrl/cmd-Enter toggles it, Esc closes it
  if (e.key === "Escape" && !panel.hidden) panel.hidden = true;
  else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) panel.hidden = !panel.hidden;
  else return;
  e.preventDefault();
});
document.getElementById("flip").addEventListener("click", () => { flipped = !flipped; draw(); input.focus(); });
next();
try { if (localStorage.getItem("aperture-coords-mode") === "click") setMode(true); } catch (e) {}
input.focus();
document.addEventListener("keydown", e => {   // typing anywhere starts typing in the input
  if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement !== input) input.focus();
});
