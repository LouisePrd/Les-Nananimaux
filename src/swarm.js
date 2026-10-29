// L'essaim : une grande Nana recouverte de centaines de mini-Nanas en 3D,
// couchées sur sa peau, de face, la tête vers le haut. Chaque mini-Nana est choisie selon la
// couleur de l'endroit où elle se pose (photomosaïque) : de loin on voit la peinture de la
// grande, de près les petites.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MINI_COUNT = 1600; // nombre de mini-Nanas visé sur la grande
const MINI_TEXTURE = 512; // largeur des textures des mini-Nanas (elles sont petites à l'écran)

/**
 * Prépare une mini-Nana pour être répétée : ses maillages sont fusionnés par matériau
 * (un seul appel de dessin par matériau, quel que soit le nombre de copies), puis ramenés
 * à une hauteur de 1, centrée, le dos en z = 0. On calcule aussi sa couleur moyenne.
 * @param root figure d'une Nana (sans socle), de préférence en détail réduit
 */
export function makeKit(root) {
  root.updateMatrixWorld(true);
  const byMaterial = new Map();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const geometry = bakedGeometry(mesh);
    mesh.geometry.dispose();
    if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, []);
    byMaterial.get(mesh.material).push(geometry);
  });

  const parts = [...byMaterial].map(([material, geometries]) => {
    const geometry = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (material.map) material.map = shrinkTexture(material.map);
    return { geometry, material };
  });

  // hauteur 1, centrée, le dos en z = 0 : elle se couche sur la peau de la grande
  const box = new THREE.Box3();
  for (const { geometry } of parts) {
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox);
  }
  const scale = 1 / (box.max.y - box.min.y);
  const center = box.getCenter(new THREE.Vector3());
  const normalize = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -box.min.z));
  for (const { geometry } of parts) {
    geometry.applyMatrix4(normalize);
    geometry.computeBoundingSphere();
  }

  // couleur moyenne, pondérée par la surface de chaque matériau
  const color = [0, 0, 0];
  let total = 0;
  for (const { geometry, material } of parts) {
    const area = surfaceArea(geometry);
    const c = materialColor(material);
    for (let i = 0; i < 3; i++) color[i] += c[i] * area;
    total += area;
  }
  return { parts, color: color.map((c) => c / total) };
}

export function disposeKit(kit) {
  for (const { geometry, material } of kit.parts) {
    geometry.dispose();
    material.map?.dispose();
    material.dispose();
  }
}

/**
 * Recouvre la figure de mini-Nanas.
 * @param figure la grande Nana (sans son socle), déjà placée
 * @param kits   mini-Nanas préparées par makeKit
 * @param rng    flux aléatoire (placement, orientation, choix)
 * @returns groupe à ajouter à la scène, à côté de la figure
 */
export function coverWithMinis(figure, kits, rng) {
  figure.updateMatrixWorld(true);
  const surface = sampleSurface(figure);
  const spacing = Math.sqrt(surface.area / MINI_COUNT);
  const points = scatter(surface, spacing, rng);
  const owners = assignKits(points, kits, rng);

  // une mini-Nana : couchée sur la peau, de face (z selon la normale), la tête vers le haut
  // de la grande, un peu penchée au hasard. Elles se chevauchent pour couvrir toute la peau.
  const matrices = kits.map(() => []);
  const worldUp = new THREE.Vector3(0, 1, 0);
  const worldFront = new THREE.Vector3(0, 0, 1);
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const tilt = new THREE.Matrix4();
  points.forEach((point, i) => {
    const height = spacing * 2.3 * rng.range(0.85, 1.15);
    const z = point.normal;
    // « haut » de la mini-Nana : la verticale projetée sur la peau (ou l'avant, sur le dessus des épaules)
    const reference = Math.abs(z.dot(worldUp)) < 0.9 ? worldUp : worldFront;
    y.copy(reference).addScaledVector(z, -z.dot(reference)).normalize();
    x.crossVectors(y, z);
    const matrix = new THREE.Matrix4().makeBasis(x, y, z);
    matrix.multiply(tilt.makeRotationZ(rng.range(-0.35, 0.35)));
    matrix.scale(new THREE.Vector3(height, height, height));
    matrix.setPosition(point.position.clone().addScaledVector(z, -0.04 * height));
    matrices[owners[i]].push(matrix);
  });

  const group = new THREE.Group();
  kits.forEach((kit, k) => {
    if (matrices[k].length === 0) return;
    for (const { geometry, material } of kit.parts) {
      const mesh = new THREE.InstancedMesh(geometry, material, matrices[k].length);
      matrices[k].forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.userData.shared = true;
      group.add(mesh);
    }
  });
  return group;
}

// Surface de la grande Nana

function sampleSurface(figure) {
  const meshes = [];
  let area = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  figure.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const { position } = mesh.geometry.attributes;
    const index = mesh.geometry.index;
    const count = (index ? index.count : position.count) / 3;
    const cumulative = new Float64Array(count);
    const vertex = (t, k) => (index ? index.getX(t * 3 + k) : t * 3 + k);
    for (let t = 0; t < count; t++) {
      a.fromBufferAttribute(position, vertex(t, 0)).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, vertex(t, 1)).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, vertex(t, 2)).applyMatrix4(mesh.matrixWorld);
      area += b.sub(a).cross(c.sub(a)).length() / 2;
      cumulative[t] = area;
    }
    meshes.push({ mesh, vertex, cumulative, normalMatrix: new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld) });
  });
  return { meshes, area };
}

// Point tiré uniformément sur la surface : position, normale, couleur de la peau à cet endroit
function randomPoint(surface, rng) {
  const target = rng.next() * surface.area;
  const entry = surface.meshes.find((m) => m.cumulative[m.cumulative.length - 1] >= target) ?? surface.meshes.at(-1);
  const t = lowerBound(entry.cumulative, target);
  const { mesh, vertex, normalMatrix } = entry;
  const { position, normal, uv } = mesh.geometry.attributes;

  let r1 = rng.next();
  let r2 = rng.next();
  if (r1 + r2 > 1) [r1, r2] = [1 - r1, 1 - r2];
  const weights = [1 - r1 - r2, r1, r2];
  const ids = [0, 1, 2].map((k) => vertex(t, k));
  const mix = (attribute, size) => {
    const out = new Array(size).fill(0);
    ids.forEach((id, k) => {
      for (let i = 0; i < size; i++) out[i] += attribute.array[id * size + i] * weights[k];
    });
    return out;
  };

  const point = new THREE.Vector3(...mix(position, 3)).applyMatrix4(mesh.matrixWorld);
  const n = new THREE.Vector3(...mix(normal, 3)).applyMatrix3(normalMatrix).normalize();
  const color = mesh.material.map && uv ? textureColor(mesh.material.map, ...mix(uv, 2)) : materialColor(mesh.material);
  return { position: point, normal: n, color };
}

function scatter(surface, spacing, rng) {
  const cell = spacing;
  const grid = new Map();
  const keyOf = (p) => `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`;
  const tooClose = (p) => {
    const [x, y, z] = keyOf(p).split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const q of grid.get(`${x + dx},${y + dy},${z + dz}`) ?? []) {
            if (q.position.distanceToSquared(p) < spacing * spacing) return true;
          }
    return false;
  };

  const points = [];
  for (let tries = 0; tries < MINI_COUNT * 30 && points.length < MINI_COUNT; tries++) {
    const point = randomPoint(surface, rng);
    if (tooClose(point.position)) continue;
    points.push(point);
    const key = keyOf(point.position);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(point);
  }
  return points;
}

// Photomosaïque : à chaque point, une mini-Nana de couleur proche de la peau à cet endroit

function assignKits(points, kits, rng) {
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const owners = points.map((point) => {
    const distances = kits.map((kit) => distance(kit.color, point.color));
    const best = Math.min(...distances);
    // parmi les mini-Nanas presque aussi proches que la meilleure, une au hasard : plus de variété
    const close = distances.flatMap((d, k) => (d <= best * 1.25 + 0.03 ? [k] : []));
    return rng.pick(close);
  });

  // chaque Nana de la galerie apparaît au moins une fois, là où sa couleur va le mieux
  const forced = new Set();
  kits.forEach((kit, k) => {
    if (owners.includes(k)) return;
    let bestPoint = -1;
    let bestDistance = Infinity;
    points.forEach((point, i) => {
      const d = distance(kit.color, point.color);
      if (!forced.has(i) && d < bestDistance) [bestPoint, bestDistance] = [i, d];
    });
    if (bestPoint >= 0) {
      owners[bestPoint] = k;
      forced.add(bestPoint);
    }
  });
  return owners;
}

function materialColor(material) {
  if (material.map) return averageColor(material.map.image);
  const c = new THREE.Color();
  material.color.getRGB(c, THREE.SRGBColorSpace);
  return [c.r, c.g, c.b];
}

const pixelsCache = new WeakMap();
function pixels(image) {
  if (!pixelsCache.has(image)) {
    const ctx = image.getContext('2d', { willReadFrequently: true });
    pixelsCache.set(image, ctx.getImageData(0, 0, image.width, image.height));
  }
  return pixelsCache.get(image);
}

function textureColor(texture, u, v) {
  const data = pixels(texture.image);
  const wrap = (x) => x - Math.floor(x);
  const x = Math.min(data.width - 1, Math.floor(wrap(u) * data.width));
  const y = Math.min(data.height - 1, Math.floor((1 - wrap(v)) * data.height)); // flipY des CanvasTexture
  const i = (y * data.width + x) * 4;
  return [data.data[i] / 255, data.data[i + 1] / 255, data.data[i + 2] / 255];
}

function averageColor(image) {
  const small = document.createElement('canvas');
  small.width = 16;
  small.height = 8;
  const ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, 16, 8);
  const { data } = ctx.getImageData(0, 0, 16, 8);
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += data[i + k];
  return sum.map((s) => s / (255 * (data.length / 4)));
}

// Outils

// Géométrie du maillage dans le repère de la Nana, réduite à position / normale / uv
function bakedGeometry(mesh) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  for (const name of Object.keys(geometry.attributes)) {
    if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
  }
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  if (!geometry.attributes.uv) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
  }
  geometry.applyMatrix4(mesh.matrixWorld);
  // un maillage en miroir a ses triangles retournés : on remet leur sens pour qu'ils restent visibles
  if (mesh.matrixWorld.determinant() < 0) flipWinding(geometry);
  return geometry;
}

function flipWinding(geometry) {
  for (const attribute of Object.values(geometry.attributes)) {
    const { array, itemSize } = attribute;
    for (let t = 0; t < attribute.count; t += 3) {
      for (let i = 0; i < itemSize; i++) {
        const a = (t + 1) * itemSize + i;
        const b = (t + 2) * itemSize + i;
        [array[a], array[b]] = [array[b], array[a]];
      }
    }
  }
}

function surfaceArea(geometry) {
  const { position } = geometry.attributes;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let area = 0;
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return area;
}

// Copie réduite d'une texture peinte (2048 px de large pour une Nana normale)
function shrinkTexture(texture) {
  const { image } = texture;
  const small = document.createElement('canvas');
  small.width = MINI_TEXTURE;
  small.height = Math.round((MINI_TEXTURE * image.height) / image.width);
  small.getContext('2d').drawImage(image, 0, 0, small.width, small.height);
  const copy = new THREE.CanvasTexture(small);
  copy.colorSpace = texture.colorSpace;
  copy.wrapS = texture.wrapS;
  copy.wrapT = texture.wrapT;
  texture.dispose();
  return copy;
}

function lowerBound(array, value) {
  let lo = 0;
  let hi = array.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (array[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
