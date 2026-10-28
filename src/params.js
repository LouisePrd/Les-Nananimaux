import { createStream } from './random.js';
import { PALETTES, pickBodyColor } from './materials.js';
import { MOTIFS } from './paint.js';
import { ATTRIBUTE_SLOTS } from './attributes.js';

// Les réglages (`settings`) viennent du panneau : `null` = aléatoire, sinon la valeur imposée.
// `drawParams` tire tout au hasard à partir de la graine, puis applique les réglages imposés.

export const NONE = 'aucun';

// Probabilité de présence de chaque attribut (tirées indépendamment, au moins un attribut garanti)
const PRESENCE = { tete: 0.6, dos: 0.5, queue: 0.4 };

// Curseurs de silhouette. En mode aléatoire, la valeur est tirée uniformément entre min et max.
export const SHAPE_SLIDERS = [
  { key: 'hips', label: 'Hanches', min: 0.5, max: 0.8 },
  { key: 'waist', label: 'Taille', min: 0.5, max: 0.75 }, // proportion des hanches
  { key: 'breasts', label: 'Poitrine', min: 0.06, max: 0.32 },
  { key: 'belly', label: 'Ventre', min: 0.04, max: 0.3 },
  { key: 'buttocks', label: 'Fesses', min: 0.03, max: 0.2 },
  { key: 'head', label: 'Tête', min: 0.12, max: 0.21 },
  { key: 'limbs', label: 'Membres', min: 0.85, max: 1.2 },
];

export const LEG_POSES = { genou: 'Genou levé', arabesque: 'Arabesque', ecart: 'Jambe écartée', debout: 'Debout' };
export const ARM_POSES = { leve: 'Levé', tendu: 'Tendu', hanche: 'Main sur la hanche', devant: 'Devant' };

// Menus déroulants du panneau, par section
export const CHOICES = {
  tete: { label: 'Tête', options: variantLabels('tete'), allowNone: true },
  dos: { label: 'Dos', options: variantLabels('dos'), allowNone: true },
  queue: { label: 'Queue', options: variantLabels('queue'), allowNone: true },
  motif: { label: 'Motif', options: MOTIFS },
  legs: { label: 'Jambes', options: LEG_POSES },
  armRight: { label: 'Bras droit', options: ARM_POSES },
  armLeft: { label: 'Bras gauche', options: ARM_POSES },
};

function variantLabels(slot) {
  const { variants } = ATTRIBUTE_SLOTS[slot];
  return Object.fromEntries(Object.entries(variants).map(([id, v]) => [id, v.label]));
}

export function emptySettings() {
  return {
    palette: null,
    ...Object.fromEntries(Object.keys(CHOICES).map((key) => [key, null])),
    ...Object.fromEntries(SHAPE_SLIDERS.map((s) => [s.key, null])),
  };
}

export function drawParams(seed, settings) {
  const pick = (key, drawn) => settings[key] ?? drawn;

  const motif = pick('motif', createStream(seed, 'motif').pick(['bandes', 'bandes', 'spirale', 'rayures', 'mosaique', 'mosaique', 'uni']));
  const palette = pick('palette', createStream(seed, 'palette').pick(['niki', 'niki', 'soleil', 'lagon', 'bonbon', 'contraste']));

  const shapeRng = createStream(seed, 'silhouette');
  const shape = {};
  for (const { key, min, max } of SHAPE_SLIDERS) shape[key] = pick(key, shapeRng.range(min, max));

  // Les doublons dans les listes servent de poids : « genou levé » et « levé » sortent plus souvent
  const poseRng = createStream(seed, 'pose');
  const legs = pick('legs', poseRng.pick(['genou', 'genou', 'arabesque', 'ecart', 'debout']));
  const armChoices = ['leve', 'leve', 'tendu', 'hanche', 'devant'];
  const arms = { right: pick('armRight', poseRng.pick(armChoices)), left: pick('armLeft', poseRng.pick(armChoices)) };

  // Chaque emplacement est occupé ou non selon sa probabilité, puis une variante est tirée
  const attrRng = createStream(seed, 'attributs');
  const slots = Object.keys(ATTRIBUTE_SLOTS);
  let present = slots.filter((slot) => attrRng.chance(PRESENCE[slot]));
  if (present.length === 0) present = [attrRng.pick(slots)];
  const attributes = {};
  for (const [slot, { variants }] of Object.entries(ATTRIBUTE_SLOTS)) {
    const drawn = present.includes(slot) ? createStream(seed, `choix-${slot}`).pick(Object.keys(variants)) : NONE;
    attributes[slot] = pick(slot, drawn);
  }

  return {
    seed,
    motif,
    palette,
    bodyColor: pickBodyColor(createStream(seed, 'peau'), PALETTES[palette].colors),
    shape,
    legs,
    arms,
    attributes,
    // flux aléatoires secondaires pour les détails (angles des membres, forme des cornes…)
    stream: (name) => createStream(seed, name),
  };
}

// Valeur actuelle d'un réglage, qu'elle soit imposée ou tirée au hasard (pour l'affichage)
export function currentValue(params, key) {
  if (key === 'motif') return params.motif;
  if (key === 'palette') return params.palette;
  if (key === 'legs') return params.legs;
  if (key === 'armRight') return params.arms.right;
  if (key === 'armLeft') return params.arms.left;
  if (key in ATTRIBUTE_SLOTS) return params.attributes[key];
  return params.shape[key];
}

// ---------------------------------------------------------------------------
// Lien partageable : ?seed=…&tete=belier&hips=0.62…

export function toQuery(seed, settings) {
  const query = new URLSearchParams({ seed });
  for (const [key, value] of Object.entries(settings)) {
    if (value !== null) query.set(key, typeof value === 'number' ? value.toFixed(3) : value);
  }
  return query.toString();
}

export function fromQuery(search) {
  const query = new URLSearchParams(search);
  const settings = emptySettings();
  for (const [key, value] of query) {
    if (key === 'palette' && value in PALETTES) settings.palette = value;
    const choice = CHOICES[key];
    if (choice && (value in choice.options || (choice.allowNone && value === NONE))) settings[key] = value;
    const slider = SHAPE_SLIDERS.find((s) => s.key === key);
    if (slider && Number.isFinite(Number(value))) {
      settings[key] = Math.min(slider.max, Math.max(slider.min, Number(value)));
    }
  }
  const seed = Number(query.get('seed'));
  return { seed: query.has('seed') && Number.isFinite(seed) ? seed >>> 0 : null, settings };
}
