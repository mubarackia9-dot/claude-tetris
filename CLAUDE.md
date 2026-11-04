# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vanilla JS Tetris on HTML5 Canvas. No dependencies, no `package.json`, no build, no tests, no linter. Three source files: `index.html` (DOM + canvases), `style.css` (dark theme), `game.js` (all logic). UI text and README are in Spanish — keep user-facing strings in Spanish.

## Running

Open `index.html` directly, or serve statically (preferred):

```bash
python -m http.server 8000   # then http://localhost:8000
```

## Architecture (game.js)

- **Global mutable state**: `board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId` are module-level `let`s, all reset in `init()` (also the restart handler).
- **Cell encoding**: board is `ROWS × COLS` matrix; `0` = empty, `1–7` = piece type. Piece shapes in `PIECES` store their own type index as cell values, so `merge()` copies shape values straight into the board and `COLORS[i]` maps them to colors. Adding a piece type means extending `PIECES`, `COLORS`, and the `* 7` in `randomPiece()`.
- **Rotation**: `rotateCW` (transpose + reverse) then `tryRotate` tests horizontal kicks `[0,-1,1,-2,2]` via `collide`. Not SRS.
- **Loop**: `requestAnimationFrame`-driven `loop(ts)` accumulates `dropAccum`; on exceeding `dropInterval`, piece falls or `lockPiece()` runs (`merge` → `clearLines` → `spawn`). `spawn()` colliding immediately triggers `endGame()`.
- **Pause/game over** cancel the RAF via `animId`; unpause resets `lastTime` and restarts `loop`. A single `#overlay` element is reused for both PAUSA and GAME OVER.
- **Scoring/speed**: `LINE_SCORES[cleared] * level`; soft drop +1/row, hard drop +2/row; level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Rendering**: `draw()` redraws everything each frame (grid, board, ghost at alpha 0.2, current piece). `drawBlock` is shared by the main board and the next-piece preview (`drawNext`, 4×4 grid of 30px on a 120px canvas).

## Constraints

- Changing `COLS`, `ROWS`, or `BLOCK` requires updating `<canvas id="board">` `width`/`height` in `index.html` to `COLS*BLOCK` × `ROWS*BLOCK`.
- DOM element IDs referenced in `game.js` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`) must stay in sync with `index.html`.
