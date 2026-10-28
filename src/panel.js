import { CHOICES, NONE, SHAPE_SLIDERS, currentValue } from './params.js';
import { PALETTES } from './materials.js';
import { iconSVG } from './icons.js';

const CAROUSEL_KEYS = ['tete', 'dos', 'queue', 'motif'];
const POSE_KEYS = ['legs', 'armRight', 'armLeft'];
const RANDOM = ''; // valeur « aléatoire » dans les carrousels et menus

// triangles centrés sur leur centre de gravité (x = 12), pour qu'ils paraissent bien au milieu
const ARROW_LEFT = '<svg viewBox="0 0 24 24" class="icon"><path d="M15 5 L6 12 L15 19 Z"/></svg>';
const ARROW_RIGHT = '<svg viewBox="0 0 24 24" class="icon"><path d="M9 5 L18 12 L9 19 Z"/></svg>';

/**
 * Panneau de réglages. Modifie directement l'objet `settings` (null = aléatoire)
 * puis appelle `onChange`. `show(params)` met l'affichage à jour avec la sculpture actuelle.
 * Un réglage laissé au hasard montre la valeur tirée, en plus pâle.
 */
export function createPanel(settings, { onChange }) {
  const set = (key, value) => {
    settings[key] = value === RANDOM ? null : value;
    onChange();
  };

  // ---------- Carrousels ◀ ▶ (attributs et motif) ----------
  const carousels = document.querySelector('#carousels');
  carousels.innerHTML = CAROUSEL_KEYS.map(
    (key) => `
    <div class="carousel" data-key="${key}">
      <div class="carousel-row">
        <button class="arrow sketch" data-step="-1" aria-label="Précédent">${ARROW_LEFT}</button>
        <div class="carousel-box sketch"></div>
        <button class="arrow sketch" data-step="1" aria-label="Suivant">${ARROW_RIGHT}</button>
      </div>
      <h2>${CHOICES[key].label}</h2>
    </div>`,
  ).join('');

  for (const key of CAROUSEL_KEYS) {
    // ordre de défilement : aléatoire, (aucun), puis les variantes
    const { options, allowNone } = CHOICES[key];
    const values = [RANDOM, ...(allowNone ? [NONE] : []), ...Object.keys(options)];
    for (const arrow of carousels.querySelectorAll(`[data-key="${key}"] .arrow`)) {
      arrow.addEventListener('click', () => {
        const index = values.indexOf(settings[key] ?? RANDOM);
        const next = (index + Number(arrow.dataset.step) + values.length) % values.length;
        set(key, values[next]);
      });
    }
  }

  // ---------- Palettes ----------
  // Cliquer la palette choisie une deuxième fois la remet au hasard
  const palettes = document.querySelector('#palettes');
  palettes.innerHTML = `
    <div class="swatches">
      ${Object.entries(PALETTES)
        .map(([id, { label, colors }]) => `<button class="swatch" data-palette="${id}" title="${label}" style="background: ${conic(colors)}"></button>`)
        .join('')}
    </div>
    <h2>Couleurs</h2>`;
  for (const swatch of palettes.querySelectorAll('.swatch')) {
    swatch.addEventListener('click', () => {
      const id = swatch.dataset.palette;
      set('palette', settings.palette === id ? RANDOM : id);
    });
  }

  // ---------- Pose : menus déroulants ----------
  const poses = document.querySelector('#poses');
  poses.innerHTML = POSE_KEYS.map((key) => {
    const { label, options } = CHOICES[key];
    return `
      <label class="choice">
        <h2>${label}</h2>
        <span class="select sketch">
          <select data-key="${key}">
            <option value="${RANDOM}"></option>
            ${Object.entries(options)
              .map(([id, text]) => `<option value="${id}">${text}</option>`)
              .join('')}
          </select>
          <span class="select-arrow">▽</span>
        </span>
      </label>`;
  }).join('');
  for (const select of poses.querySelectorAll('select')) {
    select.addEventListener('change', () => set(select.dataset.key, select.value));
  }

  // ---------- Silhouette : curseurs ----------
  // Bouger un curseur fixe la valeur ; un double-clic la remet au hasard
  const silhouette = document.querySelector('#silhouette');
  silhouette.innerHTML = `
    <h2>Silhouette</h2>
    ${SHAPE_SLIDERS.map(
      ({ key, label }) => `
      <div class="slider" data-key="${key}" title="Double-clic : au hasard">
        <span class="slider-label">${label}</span>
        <input type="range" min="0" max="1000" aria-label="${label}" />
      </div>`,
    ).join('')}`;
  for (const { key, min, max } of SHAPE_SLIDERS) {
    const row = silhouette.querySelector(`.slider[data-key="${key}"]`);
    row.querySelector('input').addEventListener('input', (e) => {
      set(key, min + (Number(e.target.value) / 1000) * (max - min));
    });
    row.addEventListener('dblclick', () => set(key, RANDOM));
  }

  // ---------- Mise à jour de l'affichage ----------
  function show(params) {
    for (const key of CAROUSEL_KEYS) {
      const value = currentValue(params, key);
      const box = carousels.querySelector(`[data-key="${key}"] .carousel-box`);
      box.innerHTML = iconSVG(key, value);
      box.title = value === NONE ? 'Aucun' : CHOICES[key].options[value];
      box.classList.toggle('is-random', settings[key] === null);
    }

    for (const swatch of palettes.querySelectorAll('.swatch')) {
      const id = swatch.dataset.palette;
      swatch.classList.toggle('selected', id === settings.palette);
      // au hasard : la palette tirée est entourée de pointillés
      swatch.classList.toggle('drawn', settings.palette === null && id === params.palette);
    }

    for (const select of poses.querySelectorAll('select')) {
      const key = select.dataset.key;
      select.value = settings[key] ?? RANDOM;
      select.options[0].textContent = CHOICES[key].options[currentValue(params, key)];
      select.classList.toggle('is-random', settings[key] === null); // texte pâle = au hasard
    }

    for (const { key, min, max } of SHAPE_SLIDERS) {
      const row = silhouette.querySelector(`.slider[data-key="${key}"]`);
      row.querySelector('input').value = String(Math.round(((currentValue(params, key) - min) / (max - min)) * 1000));
      row.classList.toggle('is-random', settings[key] === null);
    }
  }

  return { show };
}

// Pastille en camembert avec toutes les couleurs de la palette
function conic(colors) {
  const step = 100 / colors.length;
  return `conic-gradient(${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}
