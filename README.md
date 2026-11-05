# aperture
Static site that shows opening lines as a tree of boards. Display only.

- Edit lines in `data/london.txt` (SAN, one line per row, optional `{comment}` after the last move; see `data/legend.txt` for the full syntax).
- Run locally: `python3 -m http.server` then open http://localhost:8000
- Deploy: push to GitHub, enable Pages on the main branch.
- Black's view: `data-orientation="black"` on `<body>` in the page.
