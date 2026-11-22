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
Libraries loaded from CDN: chess.js (BSD-2-Clause), d3-hierarchy (ISC), onnxruntime-web (MIT, used by the board recognition page).

## Board recognition model (`model/baseline.onnx`)

The model `baseline.onnx` was trained on synthetic chessboards that I drew myself from piece sets taken from
[Lichess](https://github.com/lichess-org/lila/tree/master/public/piece) (`src/download_pieces.py`), combined with random positions,
board colours, highlights and arrows. **Only sets under free licenses were used for training** (group A below).
Authors and licenses are copied from Lichess's [COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md)
(read on 2026-11-19; check upstream before relying on them). The model file (`baseline.onnx`, 614 KB) contains only trained
numbers, no images.

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
| `gioco` | sadsnake1 | CC BY-NC-SA 4.0 | B | held out: never trained on, used for testing |
| `tatiana` | sadsnake1 | CC BY-NC-SA 4.0 | B | held out: never trained on, used for testing |

Group A = free licenses (attribution, share-alike, copyleft, public domain), used for training. Group B = non-commercial
(CC BY-NC-SA): `gioco` and `tatiana` are used **only to test** the model on styles it has never seen, never to train it.
The `letter` and `shapes` sets are not real piece styles and are skipped.
