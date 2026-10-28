// Petites icônes au trait pour les carrousels d'attributs (viewBox 64×64).
// Le filtre SVG « sketch » (dans index.html) leur donne l'aspect dessiné à la main.

const HEAD = '<circle cx="32" cy="42" r="12"/>';
const FRAME = '<rect x="12" y="12" width="40" height="40" rx="6"/>';
const mirror = (path) => `<path d="${path}"/><path d="${path}" transform="translate(64 0) scale(-1 1)"/>`;

const ICONS = {
  aleatoire: `<rect x="14" y="14" width="36" height="36" rx="8"/>
    <circle cx="24" cy="24" r="2.5" class="fill"/><circle cx="40" cy="24" r="2.5" class="fill"/>
    <circle cx="32" cy="32" r="2.5" class="fill"/>
    <circle cx="24" cy="40" r="2.5" class="fill"/><circle cx="40" cy="40" r="2.5" class="fill"/>`,
  aucun: '<circle cx="32" cy="32" r="16"/><path d="M21 43 L43 21"/>',

  // tête
  taureau: HEAD + mirror('M22 36 C12 34 10 26 14 18'),
  belier: HEAD + mirror('M23 35 C12 37 8 24 16 21 C22 19 24 27 19 28'),
  chevre: HEAD + mirror('M27 31 C25 20 22 14 14 10'),
  cerf: HEAD + mirror('M27 31 L19 8 M23 19 L12 16 M21 13 L25 5'),
  chat: HEAD + mirror('M23 34 L21 20 L30 30'),
  antennes: HEAD + mirror('M28 31 C26 22 21 15 15 11') + '<circle cx="14" cy="10" r="3.5"/><circle cx="50" cy="10" r="3.5"/>',
  lapin: HEAD + '<ellipse cx="26" cy="17" rx="4" ry="12"/><ellipse cx="38" cy="17" rx="4" ry="12"/>',

  // dos
  oiseau: `<path d="M12 46 C16 26 34 14 54 12 C50 18 46 20 42 21 C46 23 44 27 40 27 C42 30 40 33 35 33 C36 37 32 39 28 38 C24 43 18 45 12 46 Z"/>
    <path d="M22 38 L40 22"/>`,
  papillon: mirror('M32 30 C24 8 6 8 10 24 C12 32 24 32 32 31') + mirror('M32 34 C22 34 14 48 22 52 C28 54 32 44 32 34') + '<path d="M32 18 L32 50"/>',

  nageoire: '<path d="M12 52 C22 44 32 26 50 12 C44 24 44 34 48 40 C42 40 40 44 42 50 C34 48 30 50 28 52 Z"/><path d="M24 48 L44 20"/>',

  // queue
  queueChat: '<path d="M10 52 C30 52 36 42 32 28 C30 18 40 12 48 18"/>',
  queueLion: '<path d="M10 52 C28 52 36 42 34 28"/><path d="M34 28 L28 20 L34 22 L34 12 L39 21 L46 16 L42 26 Z"/>',
  queueDiable: '<path d="M10 52 C28 52 34 40 34 28"/><path d="M34 28 L26 24 L36 8 L44 22 Z"/>',
  queuePoisson: '<path d="M8 50 C24 52 32 44 34 34"/><path d="M34 34 C34 26 26 18 20 12 C30 16 36 20 40 24 C44 18 50 14 58 12 C52 20 46 26 44 32 Z"/>',
  queueRenard: '<path d="M10 52 C14 40 28 34 38 26 C46 20 52 14 50 8 C42 12 32 14 24 22 C16 30 10 42 10 52 Z"/><path d="M44 18 L50 8"/>',

  // motifs peints
  bandes: FRAME + '<path d="M25 12 C20 24 30 40 25 52"/><path d="M39 12 C34 24 44 40 39 52"/>',
  spirale: FRAME + '<path d="M12 30 L30 12"/><path d="M12 46 L46 12"/><path d="M26 52 L52 26"/>',
  rayures: FRAME + '<path d="M12 25 C24 20 40 30 52 25"/><path d="M12 39 C24 34 40 44 52 39"/>',
  mosaique: FRAME + '<path d="M12 30 L27 25 L33 12"/><path d="M27 25 L37 39 L52 35"/><path d="M37 39 L31 52"/><path d="M12 30 L20 52"/>',
  uni: FRAME,
};

// Les identifiants « chat » existent pour la tête et la queue : on préfixe les queues
const QUEUE_IDS = { chat: 'queueChat', lion: 'queueLion', diable: 'queueDiable', renard: 'queueRenard', poisson: 'queuePoisson' };

export function iconSVG(slot, id) {
  const key = slot === 'queue' && QUEUE_IDS[id] ? QUEUE_IDS[id] : id;
  return `<svg viewBox="0 0 64 64" class="icon" aria-hidden="true">${ICONS[key] ?? ICONS.aucun}</svg>`;
}
