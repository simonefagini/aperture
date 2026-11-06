# aperture
Static site that shows opening lines as a tree of boards. Display only.

- Flow: home page (`index.html`) → an opening's variation list (`london.html`, driven by `js/chooser.js`) → a variation's tree (`london-main.html`). To add a variation: write its data file and tree page (copy `london-main.html`), then add a line to `OPENINGS` in `js/chooser.js`.
- Edit lines in `data/london/main.txt` (SAN, one line per row, optional `{comment}` after the last move; see `data/legend.txt` for the full syntax).
- Put `@empty` after a line's moves (e.g. `d4 d5 Bf4 Nf6 e3 @empty`) to add a faded, empty board below it, suggesting the line goes on. Ignored if a reply to that line is listed.
- Run locally: `python3 -m http.server` then open http://localhost:8000
- Deploy: push to GitHub, enable Pages on the main branch.
- Black's view: `data-orientation="black"` on `<body>` in the page.
