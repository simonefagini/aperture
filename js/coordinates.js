import { board } from "./board.js?v=57";

// train the coordinates: one square lights up on an empty board, you type its name (e4); right: another one lights up, wrong: the text turns red.
// the green circle shows or hides the coordinates around the board; ctrl/cmd-Enter picks which files are asked.
const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1", FILES = "abcdefgh";
const stage = document.getElementById("stage"), input = document.getElementById("san"), panel = document.getElementById("files");
const boxes = [...panel.querySelectorAll("input")];
let flipped = false, target = null;

// the ticked files / ranks (none ticked counts as all, so there is always a square to ask)
const picked = group => {
  const all = boxes.filter(b => b.dataset.group === group);
  const on = all.filter(b => b.checked);
  return (on.length ? on : all).map(b => b.value);
};

function draw() {
  const fig = document.createElement("figure");
  fig.appendChild(board({ fen: EMPTY_FEN, to: target, checks: [], arrows: [], rings: [] }, flipped));
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
  target = sq;
  draw();
}

input.addEventListener("input", () => {
  const typed = input.value.trim().toLowerCase();
  if (typed === target) { input.value = ""; input.classList.remove("wrong"); next(); return; }
  input.classList.toggle("wrong", !target.startsWith(typed));   // red as soon as it cannot become the answer
});

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

input.addEventListener("keydown", e => {
  if (e.key === "Escape" && !panel.hidden) panel.hidden = true;
  else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) panel.hidden = !panel.hidden;
  else return;
  e.preventDefault();
});
document.getElementById("flip").addEventListener("click", () => { flipped = !flipped; draw(); input.focus(); });
next();
input.focus();
document.addEventListener("keydown", e => {   // typing anywhere starts typing in the input
  if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement !== input) input.focus();
});
