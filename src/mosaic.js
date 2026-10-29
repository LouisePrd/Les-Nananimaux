// Mosaïque de la galerie : une planche PNG avec chaque Nana

import { createRandom } from './random.js';

const PAPER = '#F8EDE3';
const CARD = '#fbf8f1';
const INK = '#63516a';

const MAX_WIDTH = 4000;
const MAX_CELL = 900;
const GAP = 16;
const MARGIN = 40;
const PADDING = 16;

/**
 * @param keys       clés des Nanas à mettre dans la mosaïque
 * @param renderNana (clé, taille) => canvas carré de la Nana
 * @param onProgress (faites, total) => appelé après chaque Nana
 */
export async function exportMosaic(keys, renderNana, onProgress = () => {}) {
  const columns = Math.ceil(Math.sqrt(keys.length));
  const rows = Math.ceil(keys.length / columns);
  const cell = Math.min(MAX_CELL, Math.floor((MAX_WIDTH - 2 * MARGIN + GAP) / columns - GAP));

  const board = document.createElement('canvas');
  board.width = 2 * MARGIN + columns * cell + (columns - 1) * GAP;
  board.height = 2 * MARGIN + rows * cell + (rows - 1) * GAP;
  const ctx = board.getContext('2d');
  paper(ctx, board.width, board.height);

  const random = createRandom(keys.length);
  for (const [i, key] of keys.entries()) {
    const x = MARGIN + (i % columns) * (cell + GAP);
    const y = MARGIN + Math.floor(i / columns) * (cell + GAP);
    const image = renderNana(key, cell - 2 * PADDING);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + PADDING, y + PADDING, cell - 2 * PADDING, cell - 2 * PADDING, 10);
    ctx.clip();
    ctx.drawImage(image, x + PADDING, y + PADDING);
    ctx.restore();
    sketchFrame(ctx, x, y, cell, random);

    onProgress(i + 1, keys.length);
    await new Promise(requestAnimationFrame);
  }

  const blob = await new Promise((resolve) => board.toBlob(resolve, 'image/png'));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'nanaminaux-mosaique.png';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Fond papier légèrement granuleux
function paper(ctx, width, height) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    image.data[i] += n;
    image.data[i + 1] += n;
    image.data[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);
}

function sketchFrame(ctx, x, y, size, random) {
  ctx.save();
  ctx.fillStyle = CARD;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, [10, 16, 13, 18]);
  ctx.roundRect(x + PADDING, y + PADDING, size - 2 * PADDING, size - 2 * PADDING, 10);
  ctx.fill('evenodd');

  ctx.strokeStyle = INK;
  ctx.lineCap = ctx.lineJoin = 'round';
  const corners = [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ];
  const widths = [6, 10, 10, 6];
  corners.forEach((start, side) => {
    const end = corners[(side + 1) % 4];
    ctx.lineWidth = widths[side];
    wobblyLine(ctx, start, end, random);
  });
  ctx.restore();
}

function wobblyLine(ctx, [x0, y0], [x1, y1], random) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const nx = -(y1 - y0) / length;
  const ny = (x1 - x0) / length;
  const phases = [random.range(0, 6.3), random.range(0, 6.3)];
  const steps = Math.ceil(length / 12);
  ctx.beginPath();
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const wobble =
      Math.sin(Math.PI * t) * (2.4 * Math.sin(t * 9 + phases[0]) + 1.4 * Math.sin(t * 23 + phases[1]));
    const px = x0 + (x1 - x0) * t + nx * wobble;
    const py = y0 + (y1 - y0) * t + ny * wobble;
    if (s === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}
