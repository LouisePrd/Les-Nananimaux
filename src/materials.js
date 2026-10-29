import * as THREE from 'three';

export const INK = '#1d1b19';
export const CREAM = '#fbf8f1';

// Palettes des motifs peints. Les couleurs vives viennent des Nanas de Niki de Saint Phalle.
export const PALETTES = {
  niki: { label: 'Niki', colors: ['#e63946', '#f4c430', '#1d4fd8', '#2a9d4f', '#ff7eb6', CREAM] },
  soleil: { label: 'Soleil', colors: ['#e63946', '#ff8c1a', '#f4c430', '#ff7eb6', CREAM] },
  lagon: { label: 'Lagon', colors: ['#1d4fd8', '#25b8c9', '#2a9d4f', '#f4c430', CREAM] },
  bonbon: { label: 'Bonbon', colors: ['#ff9ebb', '#ffd6a5', '#b9f3c0', '#9bdcf6', '#c8b6ff', CREAM] },
  contraste: { label: 'Contraste', colors: [INK, CREAM, '#e63946', '#f4c430'] },
};

// Couleurs possibles pour la peau unie (bras, jambes, tête, ailes, queue).
// Le noir revient plus souvent, comme sur les Nanas.
const BODY_COLORS = [INK, INK, '#e63946', '#f4c430', '#1d4fd8', '#2a9d4f', '#ff7eb6', '#ff8c1a', '#7b3fbf', '#25b8c9', '#8b5a3c'];

/**
 * Tire la couleur de la peau unie, en écartant celles trop proches des couleurs du motif :
 * la démarcation entre le torse peint et le reste du corps reste nette.
 */
export function pickBodyColor(rng, paletteColors) {
  // Distance entre les valeurs sRGB (0–1) : plus proche de la perception que l'espace linéaire
  // de Three.js, où toutes les couleurs sombres semblent voisines
  const srgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const distance = (a, b) => {
    const [ca, cb] = [srgb(a), srgb(b)];
    return (ca[0] - cb[0]) ** 2 + (ca[1] - cb[1]) ** 2 + (ca[2] - cb[2]) ** 2;
  };
  const nearest = (c) => Math.min(...paletteColors.map((p) => distance(c, p)));
  const candidates = BODY_COLORS.filter((c) => nearest(c) > 0.1);
  // si toutes sont trop proches, on prend la plus éloignée
  if (candidates.length === 0) return [...BODY_COLORS].sort((a, b) => nearest(b) - nearest(a))[0];
  return rng.pick(candidates);
}

export function createMaterials(bodyColor) {
  // `skin` : la peau peinte du torse et des attributs animaux.
  // Sa texture (les motifs) est ajoutée après la construction du corps, voir paint.js.
  const skin = new THREE.MeshStandardMaterial({ roughness: 0.55 });

  // Peau unie : membres, tête, ailes et queue
  const limbs = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.5,
  });

  return { skin, limbs };
}
