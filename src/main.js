import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import '@fontsource/patrick-hand';
import { createRandom, createStream, newSeed } from './random.js';
import { createMaterials } from './materials.js';
import { buildBody } from './body.js';
import { addAnimalAttributes } from './attributes.js';
import { drawParams, fromQuery, toQuery } from './params.js';
import { createPanel } from './panel.js';
import { paintTexture } from './paint.js';
import { buildSocle, SOCLE_THICKNESS } from './socle.js';
import { withDetail } from './geometry.js';
import { coverWithMinis, disposeKit, makeKit } from './swarm.js';
import { createGallery } from './gallery.js';
import './style.css';

const BACKGROUND = '#fbf8f1'; // même crème que l'intérieur des cadres

// Texture de grain :
function grainTexture(baseColor, strength, size = 512) {
  const grain = document.createElement('canvas');
  grain.width = grain.height = size;
  const ctx = grain.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  const image = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (Math.random() - 0.5) * strength;
    image.data[i] += n;
    image.data[i + 1] += n;
    image.data[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(grain);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ---------- Scène ----------
const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = grainTexture(BACKGROUND, 12, 1024); // fond légèrement granuleux
scene.fog = new THREE.Fog(BACKGROUND, 14, 32);

// Environnement « studio » pour les reflets de la laque
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(35, 1, 0.02, 100); // près : on peut zoomer sur les mini-Nanas
camera.position.set(0, 2.2, 10);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // pas sous le sol
controls.autoRotateSpeed = 1.2;
controls.addEventListener('start', () => (controls.autoRotate = false));

const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(3, 7, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -5;
sun.shadow.camera.right = sun.shadow.camera.top = 5;
sun.shadow.bias = -0.0005;
scene.add(sun, new THREE.HemisphereLight(0xffffff, 0xd8cfc0, 0.6));

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(40, 64),
  new THREE.MeshStandardMaterial({ map: grainTexture('#e4ddd0', 18), roughness: 0.95 }),
);
floor.rotation.x = -Math.PI / 2;
floor.material.map.repeat.set(10, 10); // grain répété sur tout le sol
floor.receiveShadow = true;
scene.add(floor);

// ---------- État ----------
// `settings` : réglages du panneau (null = aléatoire). `seed` : graine de la sculpture actuelle.
const fromUrl = fromQuery(location.search);
const settings = fromUrl.settings;
let seed = fromUrl.seed ?? newSeed();

let current = null;
let bornAt = 0;
let swarm = null; // mini-Nanas de la galerie, quand l'essaim est affiché
let pendingBuild = null; // reconstruction demandée, faite à la prochaine image

const panel = createPanel(settings, { onChange: () => requestBuild() });

// Les curseurs envoient beaucoup d'événements : on reconstruit au plus une fois par image
function requestBuild(options = {}) {
  pendingBuild = { reframe: pendingBuild?.reframe || options.reframe || false };
}

function assemble(params, paintFor) {
  const materials = createMaterials(params.bodyColor);
  const body = buildBody(params, materials);
  materials.skin.map = paintFor(body.paintFeatures);
  addAnimalAttributes(params, body, materials);

  const figure = body.figure;
  const root = new THREE.Group();
  root.add(figure);
  figure.updateMatrixWorld(true);
  const figureBox = new THREE.Box3().setFromObject(figure);
  const center = figureBox.getCenter(new THREE.Vector3());
  // centrée, les pieds posés sur le socle
  figure.position.set(-center.x, -figureBox.min.y + SOCLE_THICKNESS, -center.z);
  const feet = body.feet.map((foot) => foot.clone().add(figure.position));
  root.add(buildSocle(feet));
  return root;
}

function build({ reframe }) {
  if (current) {
    scene.remove(current);
    dispose(current);
  }
  const params = drawParams(seed, settings);
  const root = assemble(params, (features) => getPaint(params, features));
  if (swarm) {
    const figure = root.children[0];
    root.add(coverWithMinis(figure, swarm, createStream(seed, 'essaim')));
    figure.visible = false;
  }
  scene.add(root);
  current = root;
  const box = new THREE.Box3().setFromObject(root);

  if (reframe) {
    const size = box.getSize(new THREE.Vector3());
    const height = Math.max(size.y, size.x * 0.8);
    controls.target.set(0, size.y * 0.47, 0);
    const direction = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(direction, height * 2.3);
    controls.autoRotate = true;
    bornAt = performance.now();
  }

  panel.show(params);
  document.querySelector('#favorite').hidden = Boolean(swarm);
  controls.zoomToCursor = Boolean(swarm); // pour aller voir une mini-Nana précise
  if (!swarm) updateUrl();
  gallery.refresh();
}

// Peindre la texture prend quelques dizaines de millisecondes : on la garde tant que
// la graine, le motif et la palette ne changent pas (bouger un curseur ne la repeint pas)
let paint = { key: null, texture: null };
function getPaint(params, features) {
  const key = `${params.seed}-${params.motif}-${params.palette}`;
  if (paint.key !== key) {
    paint.texture?.dispose();
    paint = { key, texture: paintTexture({ ...params, features }) };
  }
  return paint.texture;
}

function dispose(object) {
  const materials = new Set();
  object.traverse((o) => {
    if (o.isMesh && !o.userData.shared) {
      o.geometry.dispose();
      materials.add(o.material);
    }
  });
  materials.forEach((m) => m.dispose());
}

// ---------- Interface ----------
const TITLE_COLORS = ['#e63946', '#f4c430', '#1d4fd8', '#2a9d4f', '#ff7eb6', '#ff8c1a', '#7b3fbf', '#25b8c9'];
function danceTitle(title) {
  const random = createRandom(7);
  const colors = random.shuffle(TITLE_COLORS);
  const text = title.textContent;
  let n = 0;
  title.setAttribute('aria-label', text);
  title.innerHTML = [...text]
    .map((char) => {
      if (char === ' ') return '<span class="space" aria-hidden="true"> </span>';
      const style = [
        `--color: ${colors[n++ % colors.length]}`,
        `--tilt: ${random.range(-11, 11).toFixed(1)}deg`,
        `--lift: ${random.range(-0.1, 0.1).toFixed(2)}em`,
        `--size: ${random.range(0.9, 1.12).toFixed(2)}`,
      ].join('; ');
      return `<span aria-hidden="true" style="${style}">${char}</span>`;
    })
    .join('');
}
danceTitle(document.querySelector('h1'));

// L'adresse garde la graine et les réglages fixés : recharger la page redonne la même sculpture
function updateUrl() {
  history.replaceState(null, '', `?${toQuery(seed, settings)}`);
}

// Vignette carrée prise au centre de la vue
function captureThumbnail() {
  renderer.render(scene, camera);
  const size = 240;
  const thumb = document.createElement('canvas');
  thumb.width = thumb.height = size;
  const side = Math.min(canvas.width, canvas.height);
  thumb
    .getContext('2d')
    .drawImage(canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side, 0, 0, size, size);
  return thumb.toDataURL('image/jpeg', 0.85);
}

// Mini-Nanas : une par Nana de la galerie
const MAX_MINI_SOURCES = 60;
const kits = new Map(); // clé de la galerie
function miniKits(keys) {
  keys = keys.slice(0, MAX_MINI_SOURCES);
  for (const [key, kit] of kits) {
    if (!keys.includes(key)) {
      disposeKit(kit);
      kits.delete(key);
    }
  }
  return keys.map((key) => {
    if (!kits.has(key)) {
      const saved = fromQuery(key);
      const params = drawParams(saved.seed, saved.settings);
      const root = withDetail(0.2, () => assemble(params, (features) => paintTexture({ ...params, features })));
      root.children[1].traverse((o) => o.geometry?.dispose()); // pas de socle pour les mini-Nanas
      kits.set(key, makeKit(root.children[0]));
    }
    return kits.get(key);
  });
}

const gallery = createGallery({
  currentKey: () => toQuery(seed, settings),
  capture: captureThumbnail,
  // grande Nana recouverte de mini-Nanas de la galerie
  onSwarm: (keys) => {
    swarm = miniKits(keys);
    seed = newSeed();
    requestBuild({ reframe: true });
  },
  onSelect: (key) => {
    const saved = fromQuery(key);
    seed = saved.seed;
    Object.assign(settings, saved.settings);
    swarm = null;
    requestBuild({ reframe: true });
  },
});

function generate() {
  seed = newSeed();
  swarm = null;
  requestBuild({ reframe: true });
}

document.querySelector('#generate').addEventListener('click', generate);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault();
    generate();
  }
});

// ---------- Boucle de rendu ----------
function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  const ratio = renderer.getPixelRatio();
  if (canvas.width !== Math.floor(w * ratio) || canvas.height !== Math.floor(h * ratio)) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function animate(now) {
  if (pendingBuild) {
    build(pendingBuild);
    pendingBuild = null;
  }
  resize();
  // petite apparition « pop » à chaque nouvelle sculpture
  if (current) {
    const t = Math.min(1, (now - bornAt) / 450);
    current.scale.setScalar(0.85 + 0.15 * (1 - (1 - t) ** 3));
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestBuild({ reframe: true });
requestAnimationFrame(animate);
