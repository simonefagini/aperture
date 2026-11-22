# aperture

A small static website for studying chess. It started as a way to look at opening lines as a tree of boards, and it is display only: there is no server and no account, just HTML, CSS and JavaScript that you can open in any browser.

## What is on the site

### Openings
The home page (`index.html`) lists the openings. Pick one and you get its list of variations (`openings/london.html`), and pick a variation to see its tree (`openings/london-main.html`): every line is drawn as a row of boards, and lines that branch share their common moves, so you can see at a glance where a position splits into different replies. Comments, arrows, circles and move marks (`!`, `?`, ...) are drawn on the boards. The eclipse button in the top right switches between light and dark.

### Test board (flask icon)
`tools/test-board.html` is a scratch pad. Type a line and a board follows it, so you can try out the notation (SAN, glyphs, arrows, circles, `@fen`) before putting it in a data file. If the line has a mistake, Ctrl/Cmd+Enter shows what is wrong.

### Coordinates (crosshair icon)
`tools/coordinates.html` is a drill for learning the board. A square lights up on an empty board and you type its name (`e4`); a wrong answer turns the text red. The green circle hides the coordinates around the board, and Ctrl/Cmd+Enter lets you choose which files are asked.

### Board recognition (scanner icon)
`tools/ocr.html` turns a screenshot of a chess position into a FEN you can paste anywhere (an analysis board, an engine, a study).

1. Drop, paste or choose a screenshot. It can be a whole browser window from chess.com or Lichess; you don't need to crop it.
2. The page finds the chessboard in the picture by itself and reads which piece is on each of the 64 squares.
3. It shows the position as a board next to the FEN, with a button to copy it.

A screenshot does not say whose turn it is or who can still castle, so you set those two by hand. The page also guesses the board's orientation (white or black at the bottom); if the guess is wrong, the flip button corrects it (the pieces stay where they are, the coordinates and the FEN change).

Everything happens in your browser. The screenshot is never uploaded anywhere. The reading is done by a small neural network trained on synthetic boards drawn from freely licensed piece sets; the authors and licenses of those sets are listed in `LICENSES.md`.

## Adding and editing lines

- To add a variation: write its data file and its tree page (copy `openings/london-main.html`), then add a line to `OPENINGS` in `js/chooser.js`.
- Lines live in plain text files such as `data/london/main.txt`: SAN moves, one line per row, optional move numbers (`1. d4 d5 2. Bf4`), and an optional `{comment}` after the last move. `data/legend.txt` describes the full syntax.
- Write `@empty` on its own line under a line (or at the end of its moves, e.g. `d4 d5 Bf4 Nf6 e3 @empty`) to add a faded, empty board below it, suggesting the line goes on. It is ignored if a reply to that line is listed.
- A mistake in a data file (illegal move, wrong move number, bad mark) shows on the page, with the line and the culprit marked.
- To see a tree from Black's side, put `data-orientation="black"` on `<body>` in the page.
- Sublime Text highlighting for the data files: copy `sublime/Aperture.sublime-syntax` into Packages/User, then pick "Aperture" from the syntax menu at the bottom right.

## Running and publishing

- Run locally: `python3 -m http.server`, then open http://localhost:8000
- Deploy: push to GitHub and enable Pages on the main branch.

## Technical notes on the screenshot reader

- The network is `model/baseline.onnx` (about 600 KB). It takes the 64 squares as 3x32x32 pixel crops and gives 13 scores per square (empty plus six white and six black piece types).
- It runs with onnxruntime-web, loaded from jsDelivr only when you load your first screenshot, so the other pages never download it.
- The code that finds the board (`js/board-finder.js`) and cuts it into squares (`js/fen-ocr.js`) is a port of the Python code used for training; the page itself is `js/ocr.js`.
- When the model file is replaced, bump the `?v=` on the `MODEL` constant in `js/ocr.js`, because browsers cache it.
