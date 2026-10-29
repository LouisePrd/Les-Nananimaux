import * as THREE from 'three';
import { createStream } from './random.js';
import { INK, CREAM, PALETTES } from './materials.js';

// Texture peinte de la « peau ». Coordonnées sur le torse :
// u fait le tour du corps (0 = dos, 0.5 = devant), v monte de l'entrejambe (0) au cou (1).
const W = 2048;
const H = 1024;

export const MOTIFS = { bandes: 'Bandes', spirale: 'Spirale', rayures: 'Rayures', mosaique: 'Mosaïque', uni: 'Uni' };

/**
 * Peint des zones colorées cernées de noir, remplies de petits motifs (pois, cœurs, fleurs…),
 * puis des décors sur les seins et parfois le ventre.
 * @param features positions (u, v) des seins et du ventre, fournies par body.js
 */
export function paintTexture({ seed, motif, palette, features }) {
  // Deux flux : changer de palette garde le même découpage, et inversement
  const rng = createStream(seed, `peinture-${motif}`);
  const colorRng = createStream(seed, 'peinture-couleurs');
  const colors = colorRng.shuffle(PALETTES[palette].colors);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.lineCap = ctx.lineJoin = 'round';

  const regions = LAYOUTS[motif](rng);

  // 1. Zones de couleur et leurs motifs
  regions.forEach((region, i) => {
    const fill = motif === 'mosaique' ? colorRng.pick(colors) : bandColor(colors, i, regions.length);
    const pattern = motif !== 'uni' && rng.chance(0.65) ? rng.pick(Object.keys(PATTERNS)) : null;
    const patternColor = contrasting(fill, colors, rng);
    const scale = rng.range(36, 64);
    const variant = rng.next();
    forEachCopy(region, (offset) => {
      ctx.save();
      ctx.translate(offset, 0);
      ctx.clip(region.path);
      ctx.fillStyle = fill;
      ctx.fillRect(region.box.x, region.box.y, region.box.w, region.box.h);
      if (pattern) PATTERNS[pattern](ctx, region.box, patternColor, scale, variant);
      ctx.restore();
    });
  });

  // 2. Cernes noirs entre les zones
  ctx.strokeStyle = INK;
  ctx.lineWidth = rng.range(9, 14);
  for (const region of regions) {
    forEachCopy(region, (offset) => {
      ctx.save();
      ctx.translate(offset, 0);
      ctx.stroke(region.path);
      ctx.restore();
    });
  }

  // 3. Décors : les seins (même décor des deux côtés), parfois le ventre
  const breastDecor = rng.pick(['cible', 'fleur', 'spirale']);
  const breastSize = rng.range(60, 85);
  const decorColors = rng.shuffle(colors);
  for (const { u, v } of features.breasts) DECORS[breastDecor](ctx, u * W, (1 - v) * H, breastSize, decorColors);
  if (rng.chance(0.5)) {
    const { u, v } = features.belly;
    DECORS[rng.pick(['coeur', 'fleur', 'spirale'])](ctx, u * W, (1 - v) * H, rng.range(80, 120), rng.shuffle(colors));
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

// Bandes voisines de couleurs différentes, y compris la dernière avec la première (le tour du corps)
function bandColor(colors, i, count) {
  const n = colors.length;
  if (i === count - 1 && count % n === 1) return colors[(i + 1) % n];
  return colors[i % n];
}

function contrasting(fill, colors, rng) {
  const choice = rng.pick([INK, INK, CREAM, rng.pick(colors)]);
  if (choice !== fill) return choice;
  return fill === INK ? CREAM : INK;
}

// La texture fait le tour du corps : une zone qui dépasse d'un côté réapparaît de l'autre
function forEachCopy(region, draw) {
  if (region.box.w >= W) {
    draw(0);
    return;
  }
  for (let k = -4; k <= 4; k++) {
    const offset = k * W;
    if (region.box.x + offset < W && region.box.x + region.box.w + offset > 0) draw(offset);
  }
}

function makeRegion(points) {
  const path = new Path2D();
  points.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { path, box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y } };
}

// ---------------------------------------------------------------------------
// Découpages. Les bords de chaque zone sont tracés hors de la texture quand ils ne
// séparent pas deux zones, pour ne pas dessiner de cerne sur la couture.

const LAYOUTS = {
  bandes: (rng) => verticalBands(rng, 0),
  spirale: (rng) => verticalBands(rng, rng.sign() * rng.range(0.4, 0.8) * W),
  rayures: horizontalStripes,
  mosaique: mosaic,
  uni: () => [makeRegion([[-40, -40], [W + 40, -40], [W + 40, H + 40], [-40, H + 40]])],
};

// Bandes verticales ondulées ; avec `slant`, elles s'enroulent en spirale autour du corps
function verticalBands(rng, slant) {
  const n = rng.int(10, 15);
  const widths = Array.from({ length: n }, () => rng.range(0.6, 1.4));
  const total = widths.reduce((a, b) => a + b, 0);
  const minWidth = (Math.min(...widths) / total) * W;
  let x = rng.range(0, W);
  const edges = widths.map((w) => {
    const base = x;
    x += (w / total) * W;
    const amp = rng.range(0.1, 0.3) * minWidth;
    const freq = rng.int(1, 3);
    const phase = rng.range(0, Math.PI * 2);
    return (y) => base + slant * (1 - y / H) + amp * Math.sin((2 * Math.PI * freq * y) / H + phase);
  });
  return edges.map((left, k) => {
    const right = k + 1 < n ? edges[k + 1] : (y) => edges[0](y) + W;
    const points = [];
    for (let y = -40; y <= H + 40; y += 16) points.push([left(y), y]);
    for (let y = H + 40; y >= -40; y -= 16) points.push([right(y), y]);
    return makeRegion(points);
  });
}

// Rayures horizontales ondulées (fréquences entières : elles se raccordent dans le dos)
function horizontalStripes(rng) {
  const n = rng.int(5, 9);
  const heights = Array.from({ length: n }, () => rng.range(0.6, 1.4));
  const total = heights.reduce((a, b) => a + b, 0);
  const minHeight = (Math.min(...heights) / total) * H;
  const edges = [() => -40];
  let y = 0;
  for (let k = 0; k < n - 1; k++) {
    y += (heights[k] / total) * H;
    const base = y;
    const amp = rng.range(0.1, 0.3) * minHeight;
    const freq = rng.int(1, 4);
    const phase = rng.range(0, Math.PI * 2);
    edges.push((x) => base + amp * Math.sin((2 * Math.PI * freq * x) / W + phase));
  }
  edges.push(() => H + 40);
  const regions = [];
  for (let k = 0; k < n; k++) {
    const points = [];
    for (let x = -40; x <= W + 40; x += 16) points.push([x, edges[k](x)]);
    for (let x = W + 40; x >= -40; x -= 16) points.push([x, edges[k + 1](x)]);
    regions.push(makeRegion(points));
  }
  return regions;
}

// Mosaïque de cellules (diagramme de Voronoï), comme les céramiques du Jardin des Tarots
function mosaic(rng) {
  const n = rng.int(16, 28);
  const sites = Array.from({ length: n }, () => [rng.range(0, W), rng.range(0, H)]);
  const all = sites.flatMap(([x, y]) => [[x - W, y], [x, y], [x + W, y]]);
  return sites.map(([sx, sy]) => {
    let poly = [[sx - W, -40], [sx + W, -40], [sx + W, H + 40], [sx - W, H + 40]];
    for (const [px, py] of all) {
      if (px === sx && py === sy) continue;
      // on garde le demi-plan plus proche de (sx, sy) que de (px, py)
      const nx = px - sx;
      const ny = py - sy;
      const c = nx * (sx + px) * 0.5 + ny * (sy + py) * 0.5;
      poly = clipHalfPlane(poly, nx, ny, c);
    }
    return makeRegion(poly);
  });
}

// Découpe d'un polygone convexe par le demi-plan nx·x + ny·y <= c (Sutherland-Hodgman)
function clipHalfPlane(poly, nx, ny, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = nx * a[0] + ny * a[1] - c;
    const db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Petits motifs qui remplissent une zone. `s` = taille de la trame, `variant` ∈ [0, 1[

const PATTERNS = {
  pois(ctx, b, color, s) {
    ctx.fillStyle = color;
    grid(b, s, (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  rayures(ctx, b, color, s, variant) {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.22;
    const angle = [0, Math.PI / 4, Math.PI / 2, -Math.PI / 4][Math.floor(variant * 4)];
    const L = Math.hypot(b.w, b.h) / 2 + s;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.rotate(angle);
    ctx.beginPath();
    for (let t = -L; t <= L; t += s * 0.6) {
      ctx.moveTo(-L, t);
      ctx.lineTo(L, t);
    }
    ctx.stroke();
    ctx.restore();
  },
  coeurs(ctx, b, color, s) {
    ctx.fillStyle = color;
    grid(b, s * 1.2, (x, y) => {
      heartPath(ctx, x, y, s * 0.3);
      ctx.fill();
    });
  },
  fleurs(ctx, b, color, s) {
    grid(b, s * 1.3, (x, y) => flower(ctx, x, y, s * 0.42, color, color === INK ? CREAM : INK));
  },
  zigzag(ctx, b, color, s) {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    for (let y = b.y; y <= b.y + b.h + s; y += s * 0.7) {
      for (let x = b.x - s, i = 0; x <= b.x + b.w + s; x += s * 0.4, i++) {
        const yy = y + (i % 2 ? s * 0.2 : -s * 0.2);
        if (x === b.x - s) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
    }
    ctx.stroke();
  },
  damier(ctx, b, color, s) {
    ctx.fillStyle = color;
    const c = s * 0.6;
    for (let y = b.y, r = 0; y < b.y + b.h; y += c, r++) {
      for (let x = b.x + (r % 2) * c; x < b.x + b.w; x += 2 * c) ctx.fillRect(x, y, c, c);
    }
  },
  cercles(ctx, b, color, s) {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.15;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const max = Math.hypot(b.w, b.h) / 2;
    for (let r = s * 0.3; r < max; r += s * 0.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  spirale(ctx, b, color, s) {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.15;
    spiralPath(ctx, b.x + b.w / 2, b.y + b.h / 2, Math.hypot(b.w, b.h) / 2, s * 0.55);
    ctx.stroke();
  },
};

// Trame en quinconce couvrant la boîte
function grid(b, step, draw) {
  for (let y = b.y, row = 0; y <= b.y + b.h + step; y += step * 0.87, row++) {
    for (let x = b.x + (row % 2) * (step / 2) - step; x <= b.x + b.w + step; x += step) draw(x, y);
  }
}

function heartPath(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.4, y + r * 0.1, x - r * 0.9, y - r * 1.1, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.9, y - r * 1.1, x + r * 1.4, y + r * 0.1, x, y + r * 0.9);
  ctx.closePath();
}

function flower(ctx, x, y, r, petals, center) {
  ctx.fillStyle = petals;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.42, r * 0.26, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function spiralPath(ctx, cx, cy, maxR, gap) {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  for (let a = 0; ; a += 0.15) {
    const r = (gap * a) / (Math.PI * 2);
    if (r > maxR) break;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
}

// ---------------------------------------------------------------------------
// Grands décors posés sur les seins et le ventre (toujours cernés de noir)

const DECORS = {
  cible(ctx, x, y, r, colors) {
    const rings = 4;
    for (let i = 0; i < rings; i++) {
      ctx.beginPath();
      ctx.arc(x, y, r * (1 - i / rings), 0, Math.PI * 2);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  },
  fleur(ctx, x, y, r, colors) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.45, r * 0.3, a, 0, Math.PI * 2);
      ctx.fillStyle = colors[0];
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = colors[1 % colors.length];
    ctx.fill();
    ctx.stroke();
  },
  spirale(ctx, x, y, r, colors) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = colors[0];
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.lineWidth = 7;
    spiralPath(ctx, x, y, r * 0.85, r * 0.3);
    ctx.stroke();
  },
  coeur(ctx, x, y, r, colors) {
    heartPath(ctx, x, y, r * 0.8);
    ctx.fillStyle = colors[0];
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.stroke();
  },
};
