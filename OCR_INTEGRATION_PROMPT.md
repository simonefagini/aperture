# Prompt: add the "screenshot to FEN" page to aperture

Paste everything below the line into a new Claude Code session started in this repo, after you have tried the
standalone page and are happy with it. Delete this file once the page is in.

---

Add a "screenshot to FEN" page (`ocr.html`) to this site. It is already built and tested as a standalone page in
my other repo; your job is to move it in so it looks and behaves like the rest of aperture. Do not rewrite it.

## Where the source is
- GitHub: `simonefagini/chess-ocr`, folder `web/`. Local clone: `~/Developer/chess-ocr/web` (`git pull` it first).
- Read `~/Developer/chess-ocr/web/README.md` first; it lists what to copy.
- What it does: I drop/paste/choose a screenshot (a whole browser window is fine), the page finds the chessboard by
  itself, reads the 64 squares with a small neural network (ONNX, run in the browser by onnxruntime-web) and shows
  the position as a board + FEN. Turn and castling rights are set by hand (they are not on a screenshot). Everything
  runs locally in the browser, nothing is uploaded.

## What to copy (and what NOT to)
Copy into this repo, keeping the same relative paths:
- `ocr.html`
- `ocr.css`  (either keep it as a file linked after `style.css`, or append its rules to `style.css` and bump the
  `style.css?v=` number everywhere; pick whichever matches how this repo does things, and tell me which)
- `js/ocr.js`, `js/board-finder.js`, `js/fen-ocr.js`
- `model/baseline.onnx` (614 KB; a new `model/` folder)

Do NOT copy `style.css`, `js/theme.js`, `js/board.js`, `pieces/`, `favicon.svg` from the chess-ocr `web/` folder: those
are old vendored copies of THIS repo's files, only there so the page looked right standalone. `ocr.js` imports this
repo's own `js/board.js` (check the `?v=` in that import matches the real one here, and that `board()` still takes
`{fen, arrows: [], rings: []}` as its node; it is called with a minimal object, no chess.js parsing).
Also do not copy `web/test/` (Node tests, `node_modules`).

## Changes needed here
1. **Nav.** Every page has a `#nav` of icon links in the top right (see `index.html`, `test-board.html`,
   `coordinates.html`). The new page's icon (a scanner/viewfinder, `id="ocrlink"`, copy the SVG from `ocr.html`) must
   be added. Final order, left to right: **test board (flask), coordinates (crosshair), screenshot to fen (scanner),
   home (grid)**, then the eclipse button. Existing pages show only the links to the OTHER pages (e.g.
   `coordinates.html` has the flask and home, not its own icon): keep that rule, so each page gets the scanner link
   and the order above, minus its own icon. The new `ocr.html` itself shows all four (that is how I asked for it);
   leave it as it is. Today the order on some pages is coordinates-then-flask: fix that order everywhere as part of this.
2. **Cache busting.** Pages use `?v=NN` on css/js (see `index.html`). Bump `style.css?v=` / `theme.js?v=` only if you
   change them; use fresh numbers for the new files; bump `js/board.js?v=` only if you touch it (you should not).
3. **README.md.** Add a bullet like the existing ones for `test-board.html` and `coordinates.html`: what the page is,
   which icon opens it, one line on how it works (model in `model/`, runtime from jsDelivr).
4. **LICENSES.md.** Add: the model `model/baseline.onnx` was trained on synthetic boards rendered from Lichess piece
   sets (many different licenses, e.g. cburnett CC BY-SA/GPLv2+, plus others; the training code and the list of sets
   are in `simonefagini/chess-ocr`, `src/download_pieces.py`). onnxruntime-web (MIT) is loaded from jsDelivr.
   I have not checked whether a model trained on those images has any license implication: mention it as an
   open question for me, do not decide it.
5. **No other behaviour changes.** Do not restyle the page; do not move the board; keep the empty-board drop target,
   the grey option text, the FEN bar centered under the board with the copy button inside it.

## Things to know about the page (so you do not "fix" them)
- The flip button deliberately does NOT flip the view: it means "the orientation guess was wrong" (pieces stay where
  they are, coordinates and FEN change). I decided to keep it that way.
- onnxruntime-web is pinned to 1.22.0 and loaded on the first screenshot, single-threaded (GitHub Pages cannot send the
  headers multi-threading needs). Do not "upgrade" it without re-running the check below.
- The board finder (`js/board-finder.js`) and slicer (`js/fen-ocr.js`) are line-by-line ports of Python code; a Node
  test in the other repo checks they give identical results to the Python on 42 real images. Do not refactor them.
- Browsers cache hard: when testing changes, add a throwaway query string to the URL.

## How to check it works
1. `python3 -m http.server` here, open `http://localhost:8000/ocr.html`.
2. Drop in a screenshot of a board (chess.com or lichess). Expect: the board appears centered, "read in 0.x seconds",
   a FEN you can copy, flip / screenshot popup / open-on-chess.com / clear icons beside the board.
3. Drop in a screenshot with no board: a red "no chessboard found" message, the page stays usable.
4. Dark mode works (the eclipse button), and the page works at phone width.
5. Click through the nav on every page: the scanner icon appears everywhere, the order is right, no page shows its own icon
   except `ocr.html`.
6. Optional: in `~/Developer/chess-ocr/web/test`, `npm install && node run.mjs` re-verifies the JS against the Python
   reference (needs Node >= 20; skip if Node is not installed, do not install it just for this).

## Rules for this session
- Commit in small, separate commits (nav, page files, README/LICENSES) and push; pull first.
- Do not download or install tools just to check things; tell me what I should test instead.
- If something in the page looks wrong or ugly, tell me instead of silently changing it.
