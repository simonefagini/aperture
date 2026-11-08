import { board } from "./board.js?v=57";

// train the coordinates: one square lights up on an empty board, you type its name (e4); right: another one lights up, wrong: the text turns red.
// the green circle shows or hides the coordinates around the board; ctrl/cmd-Enter picks which files are asked.
const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1", FILES = "abcdefgh";
const stage = document.getElementById("stage"), input = document.getElementById("san"), panel = document.getElementById("files");
const boxes = [...panel.querySelectorAll("input")];
let flipped = false, target = null;

const enabled = () => boxes.filter(b => b.checked).map(b => b.value);

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
  const files = enabled();
  let sq;
  do sq = files[Math.floor(Math.random() * files.length)] + (1 + Math.floor(Math.random() * 8));
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
  try { localStorage.setItem("aperture-coords-hidden", on ? "1" : "0"); } catch (e) {}
}
toggle.addEventListener("click", () => { setHidden(!document.body.classList.contains("nocoords")); input.focus(); });
try { setHidden(localStorage.getItem("aperture-coords-hidden") === "1"); } catch (e) {}

// the files: remembered, and at least one stays on
try {
  const saved = JSON.parse(localStorage.getItem("aperture-coords-files"));
  if (Array.isArray(saved) && saved.some(f => FILES.includes(f))) boxes.forEach(b => { b.checked = saved.includes(b.value); });
} catch (e) {}
panel.addEventListener("change", e => {
  if (!enabled().length) e.target.checked = true;
  try { localStorage.setItem("aperture-coords-files", JSON.stringify(enabled())); } catch (err) {}
  if (!enabled().includes(target[0])) next();
  input.focus();
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
