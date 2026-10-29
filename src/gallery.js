// Galerie des Nanas gardées, enregistrée dans le navigateur (localStorage).
// Une Nana est entièrement décrite par sa « clé » : la graine + les réglages fixés
// (la même chaîne que dans l'adresse de la page). On garde aussi une vignette.

const STORAGE_KEY = 'nanaminaux-galerie';

const HEART = '<svg viewBox="0 0 24 24" class="icon heart"><path d="M12 20 C4 14.5 2.5 10.5 4 7.5 C5.5 4.5 10 4 12 8 C14 4 18.5 4.5 20 7.5 C21.5 10.5 20 14.5 12 20 Z"/></svg>';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

/**
 * @param currentKey () => clé de la Nana affichée
 * @param capture    () => vignette (data URL) de la Nana affichée
 * @param onSelect   (clé) => affiche la Nana choisie dans la galerie
 * @param onSwarm (clés) => affiche l'essaim : une grande Nana faite de ces Nanas
 */
export function createGallery({ currentKey, capture, onSelect, onSwarm }) {
  let items = load();

  const favorite = document.querySelector('#favorite');
  const openButton = document.querySelector('#open-gallery');
  const count = document.querySelector('#gallery-count');
  const modal = document.querySelector('#gallery');
  const grid = modal.querySelector('.gallery-grid');
  const empty = modal.querySelector('.gallery-empty');
  const swarmButton = document.querySelector('#swarm');
  const notice = document.querySelector('#swarm-notice');

  favorite.innerHTML = HEART;

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      alert("La galerie est pleine : retirez quelques Nanas pour en garder d'autres.");
      items = load();
    }
    refresh();
  }

  // ♡ : garde la Nana affichée, ou la retire si elle est déjà dans la galerie
  favorite.addEventListener('click', () => {
    const key = currentKey();
    if (items.some((item) => item.key === key)) {
      items = items.filter((item) => item.key !== key);
    } else {
      items.unshift({ key, thumb: capture(), savedAt: Date.now() });
    }
    persist();
  });

  const open = () => {
    modal.hidden = false;
  };
  const close = () => {
    modal.hidden = true;
    notice.hidden = true;
  };
  openButton.addEventListener('click', open);
  modal.querySelector('.gallery-close').addEventListener('click', close);
  for (const overlay of [modal, notice]) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(); // clic sur le fond
    });
  }
  notice.querySelector('.notice-close').addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // Essaim : il faut au moins une Nana gardée
  swarmButton.addEventListener('click', () => {
    if (items.length === 0) {
      notice.hidden = false;
      notice.querySelector('.notice-close').focus();
    } else {
      onSwarm(items.map((item) => item.key));
    }
  });

  grid.addEventListener('click', (e) => {
    const remove = e.target.closest('.gallery-remove');
    const pick = e.target.closest('.gallery-open');
    if (remove) {
      items = items.filter((item) => item.key !== remove.dataset.key);
      persist();
    } else if (pick) {
      close();
      onSelect(pick.dataset.key);
    }
  });

  function refresh() {
    const saved = items.some((item) => item.key === currentKey());
    favorite.classList.toggle('saved', saved);
    favorite.title = saved ? 'Retirer de la galerie' : 'Garder dans la galerie';
    count.textContent = items.length ? `(${items.length})` : '';
    empty.hidden = items.length > 0;
    grid.innerHTML = items
      .map(
        (item) => `
        <div class="gallery-item sketch">
          <button class="gallery-open" data-key="${item.key}" aria-label="Afficher cette Nana">
            <img src="${item.thumb}" alt="" />
          </button>
          <button class="gallery-remove" data-key="${item.key}" aria-label="Retirer de la galerie">×</button>
        </div>`,
      )
      .join('');
  }

  refresh();
  return { refresh };
}
