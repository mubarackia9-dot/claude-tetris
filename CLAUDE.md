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
- **Cell encoding**: board is `ROWS × COLS` matrix; `0` = empty, `1–7` = piece type. Piece shapes in `PIECES` store their own type index as cell values, so `merge()` copies shape values straight into the board and the active skin's `colors[i]` maps them to colors (`COLORS` = retro palette, also reused by pixel). Adding a piece type means extending `PIECES`, every skin's `colors` (`COLORS` + neon/pastel arrays in `SKINS`), and the `* 7` in `randomPiece()`.
- **Rotation**: `rotateCW` (transpose + reverse) then `tryRotate` tests horizontal kicks `[0,-1,1,-2,2]` via `collide`. Not SRS.
- **Loop**: `requestAnimationFrame`-driven `loop(ts)` accumulates `dropAccum`; on exceeding `dropInterval`, piece falls or `lockPiece()` runs (`merge` → `clearLines` → `spawn`). `spawn()` colliding immediately triggers `endGame()`.
- **Pause/game over** cancel the RAF via `animId`; unpause resets `lastTime` and restarts `loop`. A single `#overlay` element is reused for both PAUSA and GAME OVER.
- **Scoring/speed**: `LINE_SCORES[cleared] * level`; soft drop +1/row, hard drop +2/row; level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Rendering**: `draw()` redraws everything each frame (grid, board, ghost at alpha 0.2, current piece). `drawBlock` is shared by the main board and the next-piece preview (`drawNext`, 4×4 grid of 30px on a 120px canvas).

## Modes

`mode` (`'classic'` | `'challenge'`) survives `init()`; `setMode()` switches it and restarts. Challenge = `CHALLENGE` constant (40 lines in 120 s): `loop` decrements `timeLeft` by `dt` (so pause excludes it) and ends with TIEMPO AGOTADO at 0; `lockPiece` checks the win before `spawn()` and sets `current = null`, so `draw()` must tolerate a null `current`. All endings go through `endGame(title, detail, won)`.

## Theme

Colors live in CSS variables (`:root` = dark default, `:root[data-theme="light"]` = light). `setTheme()` in game.js sets `data-theme`, persists to `localStorage`, caches `--grid` into `gridColor` for `drawGrid`, and repaints (needed while paused/game over).

## Skins

`SKINS` (block `// ---- Skins ----` in game.js) maps `retro | neon | pastel | pixel` → `{ label, colors, draw(context, px, py, size, color), boardBg?, grid? }`. `drawBlock` wraps `skin.draw` in `save/restore` (so alpha/shadow never leak into the grid) and is shared by board and preview, so the ghost (alpha 0.2) works in every skin. `paintSkinBg` fills `boardBg` (neon = black, regardless of theme) right after `clearRect` in `draw`/`drawNext`; `drawGrid` uses `skin.grid || gridColor`. Pixel art uses the fixed `PIXEL_PATTERN` (deterministic). `setSkin(name)` validates (fallback retro), syncs `#skin-select` (inside `.top-controls` next to `#theme-toggle`), persists to `localStorage` key `skin`, and repaints like `setTheme`. The select is blurred after `change` so arrows keep reaching the game.

## Constraints

- Changing `COLS`, `ROWS`, or `BLOCK` requires updating `<canvas id="board">` `width`/`height` in `index.html` to `COLS*BLOCK` × `ROWS*BLOCK`.
- DOM element IDs referenced in `game.js` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `theme-toggle`, `mode-classic`, `mode-challenge`, `timer-section`, `timer`, `skin-select`) must stay in sync with `index.html`.
