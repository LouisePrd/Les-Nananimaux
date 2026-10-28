// Générateur pseudo-aléatoire à graine (mulberry32).
// Même graine => même sculpture : utile plus tard pour le partage ou la galerie.
export function createRandom(seed) {
  // On brasse d'abord la graine : sinon deux graines voisines (1, 2, 3…) donnent des premiers tirages proches
  let a = Math.imul((seed ^ 0x9e3779b9) >>> 0, 0x85ebca6b);
  a ^= a >>> 13;
  a = Math.imul(a, 0xc2b2ae35);
  a = (a ^ (a >>> 16)) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    // Mélange de Fisher-Yates (renvoie une copie)
    shuffle: (list) => {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

/**
 * Flux aléatoire nommé, dérivé de la graine. Chaque aspect de la sculpture (couleur, pose,
 * bras droit…) a son propre flux : fixer un réglage dans le panneau ne décale pas les tirages
 * des autres, donc le reste de la sculpture ne change pas.
 */
export function createStream(seed, name) {
  let h = seed >>> 0;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return createRandom(h >>> 0);
}

export function newSeed() {
  return Math.floor(Math.random() * 2 ** 32);
}
