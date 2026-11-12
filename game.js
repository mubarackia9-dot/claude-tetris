'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const CHALLENGE = { targetLines: 40, timeMs: 120000 };

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const timerSection = document.getElementById('timer-section');
const timerEl = document.getElementById('timer');
const modeClassicBtn = document.getElementById('mode-classic');
const modeChallengeBtn = document.getElementById('mode-challenge');

let gridColor = '#22222e';
let mode = 'classic';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, timeLeft;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  if (mode === 'challenge' && lines >= CHALLENGE.targetLines) {
    current = null;
    const used = formatTime(CHALLENGE.timeMs - timeLeft);
    endGame('¡COMPLETADO!', `Tiempo: ${used} · Puntuación: ${score.toLocaleString()}`, true);
    return;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    while (collide(current.shape, current.x, current.y)) current.y--;
    endGame('GAME OVER', lossDetail());
  }
  drawNext();
}

function lossDetail() {
  const scoreText = `Puntuación: ${score.toLocaleString()}`;
  return mode === 'challenge'
    ? `Líneas: ${lines}/${CHALLENGE.targetLines} · ${scoreText}`
    : scoreText;
}

function formatTime(ms) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = mode === 'challenge' ? `${lines}/${CHALLENGE.targetLines}` : lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[skinName];
  context.save();
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x * size, y * size, size, skin.colors[colorIndex]);
  context.restore();
}

// ---- Skins ----
// Cada skin define su paleta (índice = tipo de pieza), su función de dibujo de
// bloque (px, py en píxeles) y opcionalmente fondo (boardBg) y color de grid.

function shadeColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = v => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}

function pathRoundRect(context, x, y, w, h, r) {
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

// Patrón fijo 6×6 para pixel art: 1 = claro, -1 = oscuro, 0 = color base
const PIXEL_PATTERN = [
  [ 1, 1, 1, 1, 1, 0],
  [ 1, 0, 0, 1, 0,-1],
  [ 1, 0, 1, 0, 0,-1],
  [ 1, 1, 0, 0,-1,-1],
  [ 1, 0, 0,-1, 0,-1],
  [ 0,-1,-1,-1,-1,-1],
];

const SKINS = {
  retro: {
    label: 'Retro',
    colors: COLORS,
    draw(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    label: 'Neon',
    colors: [null, '#00f0ff', '#fff200', '#d000ff', '#39ff14', '#ff073a', '#2d6bff', '#ff8c00'],
    boardBg: '#000000',
    grid: '#141420',
    draw(context, px, py, size, color) {
      context.shadowBlur = size / 2;
      context.shadowColor = color;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.fillStyle = color;
      context.globalAlpha *= 0.35;
      context.fillRect(px + 5, py + 5, size - 10, size - 10);
    },
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a8e6f0', '#fdf1a8', '#d9c2f0', '#bfe8c4', '#f7b8c0', '#b8d4f5', '#fcd5b0'],
    draw(context, px, py, size, color) {
      const r = size / 5;
      pathRoundRect(context, px + 2, py + 2, size - 4, size - 4, r);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = shadeColor(color, -0.15);
      context.lineWidth = 1.5;
      context.stroke();
      context.fillStyle = 'rgba(255,255,255,0.35)';
      pathRoundRect(context, px + 5, py + 4, size - 10, size / 4, r / 2);
      context.fill();
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: COLORS,
    draw(context, px, py, size, color) {
      const n = PIXEL_PATTERN.length;
      const cell = size / n;
      const light = shadeColor(color, 0.35);
      const dark = shadeColor(color, -0.3);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const v = PIXEL_PATTERN[r][c];
          context.fillStyle = v > 0 ? light : v < 0 ? dark : color;
          // coordenadas enteras para bordes nítidos entre sub-cuadros
          const x0 = Math.round(px + c * cell), y0 = Math.round(py + r * cell);
          const x1 = Math.round(px + (c + 1) * cell), y1 = Math.round(py + (r + 1) * cell);
          context.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
      }
      context.strokeStyle = 'rgba(0,0,0,0.45)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    },
  },
};

let skinName = 'retro';

function paintSkinBg(context, cvs) {
  const bg = SKINS[skinName].boardBg;
  if (!bg) return;
  context.fillStyle = bg;
  context.fillRect(0, 0, cvs.width, cvs.height);
}
// ---- fin Skins ----

function drawGrid() {
  ctx.strokeStyle = SKINS[skinName].grid || gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paintSkinBg(ctx, canvas);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!current) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  paintSkinBg(nextCtx, nextCanvas);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame(title, detail, won = false) {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw();
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle('win', won);
  overlayScore.textContent = detail;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayTitle.classList.remove('win');
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (mode === 'challenge') {
    // rAF puede entregar un ts anterior a performance.now() en el primer frame
    timeLeft = Math.max(0, timeLeft - Math.max(0, dt));
    timerEl.textContent = formatTime(timeLeft);
    if (timeLeft === 0) {
      endGame('TIEMPO AGOTADO', lossDetail());
      return;
    }
  }
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  timeLeft = CHALLENGE.timeMs;
  timerEl.textContent = formatTime(timeLeft);
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function setMode(newMode) {
  mode = newMode;
  modeClassicBtn.setAttribute('aria-pressed', String(mode === 'classic'));
  modeChallengeBtn.setAttribute('aria-pressed', String(mode === 'challenge'));
  timerSection.classList.toggle('hidden', mode !== 'challenge');
  init();
}

modeClassicBtn.addEventListener('click', () => {
  setMode('classic');
  modeClassicBtn.blur();
});

modeChallengeBtn.addEventListener('click', () => {
  setMode('challenge');
  modeChallengeBtn.blur();
});

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'light' ? '🌙 Oscuro' : '☀️ Claro';
  try { localStorage.setItem('theme', theme); } catch (e) {}
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  if (board && next) { draw(); drawNext(); }
}

themeBtn.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur();
});

// ---- Skins: selector ----
const skinSelect = document.getElementById('skin-select');

function setSkin(name) {
  skinName = Object.prototype.hasOwnProperty.call(SKINS, name) ? name : 'retro';
  skinSelect.value = skinName;
  try { localStorage.setItem('skin', skinName); } catch (e) {}
  if (board && next) { draw(); drawNext(); }
}

skinSelect.addEventListener('change', () => {
  setSkin(skinSelect.value);
  skinSelect.blur();
});

let savedSkin = null;
try { savedSkin = localStorage.getItem('skin'); } catch (e) {}
setSkin(savedSkin);
// ---- fin Skins: selector ----

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
setTheme(savedTheme === 'light' ? 'light' : 'dark');
init();
