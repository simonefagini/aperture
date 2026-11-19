# Licenses

## Piece images (`pieces/`)
Chess piece set "Cburnett" by Colin M.L. Burnett (Wikimedia Commons).
Licensed under CC BY-SA 3.0, GFDL, or GPL (your choice, per Wikimedia).
Files were taken from the Lichess copy of the set
(https://github.com/lichess-org/lila/tree/master/public/piece/cburnett),
which distributes them under GPLv2+. Check the upstream pages before publishing.
If you modify the SVGs, share the changes under the same license.

## Code
Your own code: add a license of your choice (e.g. MIT) as `LICENSE`.
Libraries loaded from CDN: chess.js (BSD-2-Clause), d3-hierarchy (ISC), onnxruntime-web (MIT, used by the screenshot-to-FEN page).

## Screenshot-to-FEN model (`model/baseline.onnx`)

The model `baseline.onnx` was trained on synthetic chessboards that I drew myself from 32 piece sets downloaded from
[Lichess](https://github.com/lichess-org/lila/tree/master/public/piece) (`src/download_pieces.py`), combined with random positions,
board colours, highlights and arrows. Authors and licenses below are copied from Lichess's
[COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md) (read on 2026-11-19; check upstream before relying on them).
The model file (`baseline.onnx`, 614 KB) contains only trained numbers, no images.

Groups: **A** free licenses (attribution / share-alike / copyleft / public domain): 16 sets · **B** non-commercial (CC BY-NC-SA): 16 sets.

| Piece set | Author | License | Group | Role |
|---|---|---|---|---|
| `cburnett` | Colin M.L. Burnett | GPLv2+ | A | training |
| `celtic` | Maurizio Monge | MIT | A | held out: never trained on, used for testing |
| `chessnut` | Alexis Luengas | Apache 2.0 | A | training |
| `fantasy` | Maurizio Monge | MIT | A | training |
| `firi` | James Faure | CC BY 4.0 | A | training |
| `kiwen-suwi` | neverRare | CC BY 4.0 | A | training |
| `letter` | usolando | AGPLv3+ | A | skipped (not a real piece style) |
| `merida` | Armando Hernandez Marroquin | GPLv2+ | A | training |
| `mpchess` | Maxime Chupin | GPLv3+ | A | training |
| `papercut` | Nikolay Anzarov | CC BY 4.0 | A | training |
| `pirouetti` | pirouetti | AGPLv3+ | A | training |
| `pixel` | therealqtpi | AGPLv3+ | A | held out: never trained on, used for testing |
| `rhosgfx` | RhosGFX | CC0 1.0 | A | training |
| `shapes` | flugsio | CC BY-SA 4.0 | A | skipped (not a real piece style) |
| `spatial` | Maurizio Monge | MIT | A | held out: never trained on, used for testing |
| `totoy` | Kosal Sen | CC BY 4.0 | A | training |
| `anarcandy` | caderek | CC BY-NC-SA 4.0 | B | training |
| `caliente` | avi | CC BY-NC-SA 4.0 | B | training |
| `california` | Jerry S. | CC BY-NC-SA 4.0 | B | training |
| `cardinal` | sadsnake1 | CC BY-NC-SA 4.0 | B | training |
| `chessboart` | Michał Fudalej / ChessboArt | CC BY-NC-SA 4.0 | B | training |
| `cooke` | fejfar | CC BY-NC-SA 4.0 | B | training |
| `dubrovny` | sadsnake1 | CC BY-NC-SA 4.0 | B | training |
| `fresca` | sadsnake1 | CC BY-NC-SA 4.0 | B | training |
| `gioco` | sadsnake1 | CC BY-NC-SA 4.0 | B | held out: never trained on, used for testing |
| `horsey` | cham, michael1241 | CC BY-NC-SA 4.0 | B | training |
| `icpieces` | sadsnake1 | CC BY-NC-SA 4.0 | B | training |
| `maestro` | sadsnake1 | CC BY-NC-SA 4.0 | B | training |
| `minimal-warmth` | blunder_reign | CC BY-NC-SA 4.0 | B | training |
| `staunty` | sadsnake1 | CC BY-NC-SA 4.0 | B | training |
| `tatiana` | sadsnake1 | CC BY-NC-SA 4.0 | B | held out: never trained on, used for testing |
| `xkcd` | Randall Munroe | CC BY-NC-SA 2.5 | B | skipped (not a real piece style) |

### Left out on purpose
Nine Lichess sets were removed from this repository and from training, because their licenses are non-free, not stated, or
not listed upstream: `alpha` ("personal non-commercial use"), `chess7`, `companion`, `leipzig` ("freeware"), `reillycraig`,
`riohacha` (nothing stated), `shahi-ivory-brown` (no modification allowed), `governor` and `kosal` (not listed upstream).
The first model, trained with them, made no more mistakes on my real screenshots than the current one (0 errors on all 38 boards
both times) and was equal on unseen styles (98.3% vs 98.2% of squares), so nothing was lost. They are still in this repository's
git history (it is private); the history would have to be rewritten before the repository is ever made public.

### Open question (not decided)
Is a model trained on images under these licenses a derivative of them? This is legally unsettled. The model contains numbers,
not images, but I have no legal answer. Group B (non-commercial, share-alike) is the uncomfortable one; this site is a personal,
non-commercial project. The clean option is to retrain with group A only (plus my own screenshots) and compare again; not run yet.
