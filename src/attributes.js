import * as THREE from 'three';
import { variableTube, res } from './geometry.js';

// Chaque attribut se fixe sur un emplacement : tête, dos ou queue.
// Le choix des emplacements et des variantes se fait dans params.js (hasard ou panneau de réglages).
// Les attributs de la tête reprennent la peinture du torse (`skin`) ;
// les ailes et la queue ont la couleur unie des bras et des jambes (`limbs`).
export const ATTRIBUTE_SLOTS = {
  tete: {
    label: 'Tête',
    variants: {
      taureau: { label: 'Cornes de taureau', make: cornesTaureau },
      belier: { label: 'Cornes de bélier', make: cornesBelier },
      chevre: { label: 'Cornes de chèvre', make: cornesChevre },
      cerf: { label: 'Bois de cerf', make: boisCerf },
      chat: { label: 'Oreilles de chat', make: oreillesChat },
      lapin: { label: 'Oreilles de lapin', make: oreillesLapin },
      antennes: { label: 'Antennes', make: antennes },
    },
  },
  dos: {
    label: 'Dos',
    variants: {
      oiseau: { label: "Ailes d'oiseau", make: ailesOiseau },
      papillon: { label: 'Ailes de papillon', make: ailesPapillon },
      nageoire: { label: 'Nageoire dorsale', make: nageoireDorsale },
    },
  },
  queue: {
    label: 'Queue',
    variants: {
      chat: { label: 'Queue de chat', make: queueChat },
      lion: { label: 'Queue de lion', make: queueLion },
      diable: { label: 'Queue de diable', make: queueDiable },
      renard: { label: 'Queue de renard', make: queueRenard },
      poisson: { label: 'Queue de poisson', make: queuePoisson },
    },
  },
};

/** Ajoute les attributs choisis dans `params.attributes` et renvoie leurs noms. */
export function addAnimalAttributes(params, body, materials) {
  const labels = [];
  for (const [slot, { variants }] of Object.entries(ATTRIBUTE_SLOTS)) {
    const variant = variants[params.attributes[slot]];
    if (!variant) continue; // emplacement vide
    // flux aléatoire propre à l'emplacement : la forme ne change pas quand on modifie un autre réglage
    const material = slot === 'tete' ? materials.skin : materials.limbs;
    const object = variant.make(params.stream(`forme-${slot}`), body, material);
    object.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    if (slot === 'tete') body.head.add(object);
    else body.torso.add(object);
    labels.push(variant.label);
  }
  return labels;
}

// Construit la version « côté droit » puis la duplique en miroir (scale.x = -1)
function mirrored(build) {
  const pair = new THREE.Group();
  const right = new THREE.Group();
  right.add(build());
  const left = right.clone();
  left.scale.x = -1;
  pair.add(right, left);
  return pair;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Décale une liste de points et applique un facteur d'échelle
const offsetPoints = (base, offsets, scale) => offsets.map(([x, y, z]) => base.clone().add(V(x * scale, y * scale, z * scale)));

// Oriente un objet (axe +y) selon une direction
function alignY(object, direction) {
  object.quaternion.setFromUnitVectors(V(0, 1, 0), direction.clone().normalize());
}

// ---------------------------------------------------------------------------
// Tête

function cornesTaureau(rng, { headR }, skin) {
  const k = headR / 0.17;
  const len = rng.range(0.8, 1.3) * k;
  const object = mirrored(() => {
    const base = V(0.75 * headR, 0.35 * headR, 0);
    const pts = offsetPoints(base, [[0, 0, 0], [0.12, 0.04, 0], [0.24, 0.14, 0.04], [0.28, 0.28, 0.1], [0.26, 0.38, 0.14]], len);
    return new THREE.Mesh(variableTube(pts, [0.055, 0.05, 0.035, 0.02, 0.006].map((r) => r * k)), skin);
  });
  return object;
}

function cornesBelier(rng, { headR }, skin) {
  const k = headR / 0.17;
  const R0 = rng.range(0.12, 0.17) * k;
  const turns = rng.range(1.5, 1.9) * Math.PI;
  const object = mirrored(() => {
    const base = V(0.6 * headR, 0.6 * headR, -0.1 * headR);
    const center = base.clone().add(V(0, -R0, 0));
    const pts = [];
    const radii = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * turns;
      const R = R0 * (1 - (0.5 * t) / turns);
      // spirale dans le plan y-z, qui s'écarte de la tête en x
      pts.push(center.clone().add(V(0.05 * k * t, R * Math.cos(t), -R * Math.sin(t))));
      radii.push((0.065 - (0.05 * i) / steps) * k);
    }
    return new THREE.Mesh(variableTube(pts, radii), skin);
  });
  return object;
}

function cornesChevre(rng, { headR }, skin) {
  const k = headR / 0.17;
  const len = rng.range(0.8, 1.4) * k;
  const object = mirrored(() => {
    const base = V(0.35 * headR, 0.85 * headR, 0.15 * headR);
    const pts = offsetPoints(base, [[0, 0, 0], [0.03, 0.12, -0.04], [0.07, 0.24, -0.14], [0.1, 0.3, -0.28], [0.12, 0.3, -0.4]], len);
    return new THREE.Mesh(variableTube(pts, [0.045, 0.04, 0.03, 0.018, 0.005].map((r) => r * k)), skin);
  });
  return object;
}

function boisCerf(rng, { headR }, skin) {
  const k = headR / 0.17;
  const len = rng.range(0.9, 1.4) * k;
  const tines = [1, 2, 3].map(() => ({ up: rng.range(0.8, 1.2), fwd: rng.range(0.6, 1.3) }));
  const object = mirrored(() => {
    const group = new THREE.Group();
    const base = V(0.4 * headR, 0.85 * headR, 0);
    const beam = offsetPoints(base, [[0, 0, 0], [0.08, 0.15, -0.03], [0.18, 0.3, -0.08], [0.24, 0.48, -0.06], [0.26, 0.6, 0]], len);
    group.add(new THREE.Mesh(variableTube(beam, [0.035, 0.03, 0.025, 0.018, 0.008].map((r) => r * k)), skin));
    // andouillers qui partent du merrain vers le haut et l'avant
    tines.forEach(({ up, fwd }, i) => {
      const start = beam[i + 1];
      const pts = offsetPoints(start, [[0, 0, 0], [-0.02, 0.1 * up, 0.06 * fwd], [-0.03, 0.18 * up, 0.12 * fwd]], len);
      group.add(new THREE.Mesh(variableTube(pts, [0.02, 0.014, 0.005].map((r) => r * k), { segments: 48 }), skin));
    });
    return group;
  });
  return object;
}

// Oreille posée sur le crâne, inclinée de `tilt` vers l'extérieur et `droop` vers l'arrière
function placeOnHead(mesh, headR, tilt, droop, halfLength) {
  const dir = V(Math.sin(tilt), Math.cos(tilt), 0).applyAxisAngle(V(1, 0, 0), droop);
  const base = V(Math.sin(tilt) * headR * 0.8, Math.cos(tilt) * headR * 1.12 * 0.8, 0);
  mesh.position.copy(base.addScaledVector(dir, halfLength * 0.85));
  alignY(mesh, dir);
}

function oreillesChat(rng, { headR }, skin) {
  const k = headR / 0.17;
  const h = rng.range(0.13, 0.19) * k;
  const tilt = rng.range(0.45, 0.7);
  const object = mirrored(() => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075 * k, h, res(32, 6)), skin);
    ear.geometry.scale(1, 1, 0.4);
    placeOnHead(ear, headR, tilt, rng.range(-0.15, 0.05), h / 2);
    return ear;
  });
  return object;
}

function oreillesLapin(rng, { headR }, skin) {
  const k = headR / 0.17;
  const len = rng.range(0.22, 0.32) * k;
  const tilt = rng.range(0.15, 0.4);
  const droop = rng.range(-0.6, 0);
  const object = mirrored(() => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, res(32, 6), res(20, 4)), skin);
    ear.geometry.scale(0.055 * k, len, 0.025 * k);
    placeOnHead(ear, headR, tilt, droop, len);
    return ear;
  });
  return object;
}

// Antennes de papillon : tiges fines et souples terminées par une boule
function antennes(rng, { headR }, skin) {
  const k = headR / 0.17;
  const len = rng.range(0.8, 1.3) * k;
  const spread = rng.range(0.7, 1.3);
  const curl = rng.range(-0.08, 0.06);
  const object = mirrored(() => {
    const group = new THREE.Group();
    const base = V(0.25 * headR, 1.0 * headR, 0.1 * headR);
    const pts = offsetPoints(
      base,
      [[0, 0, 0], [0.05 * spread, 0.18, 0.06], [0.12 * spread, 0.34, 0.08 + curl], [0.2 * spread, 0.45, 0.02 + 2 * curl]],
      len,
    );
    group.add(new THREE.Mesh(variableTube(pts, [0.018, 0.015, 0.012, 0.01].map((r) => r * k), { roundEnd: false }), skin));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.04 * k, res(24, 6), res(16, 4)), skin);
    ball.position.copy(pts[pts.length - 1]);
    group.add(ball);
    return group;
  });
  return object;
}

// ---------------------------------------------------------------------------
// Dos

function ailesOiseau(rng, { anchors }, skin) {
  const span = rng.range(0.9, 1.4);
  const lift = rng.range(0.5, 1.1); // angle de l'« os » de l'aile
  const sweep = rng.range(0.35, 0.75); // ailes repliées vers l'arrière
  const count = rng.int(7, 11);
  const jitter = Array.from({ length: count }, () => rng.range(0.9, 1.1));

  const object = mirrored(() => {
    const wing = new THREE.Group();
    wing.position.set(0.12, 0, 0);
    wing.rotation.set(0, sweep, 0);

    const boneEnd = V(Math.cos(lift), Math.sin(lift), 0).multiplyScalar(span * 0.6);
    wing.add(new THREE.Mesh(variableTube([V(0, 0, 0), boneEnd.clone().multiplyScalar(0.5), boneEnd], [0.08, 0.06, 0.035], { segments: 48 }), skin));

    const feather = new THREE.SphereGeometry(1, res(24, 6), res(12, 4));
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1); // 0 = bout de l'aile (rémiges primaires), 1 = près du dos
      const base = V(0, 0, 0).lerp(boneEnd, 1 - t * 0.9);
      const angle = THREE.MathUtils.lerp(0.5, -1.45, t);
      const dir = V(Math.cos(angle), Math.sin(angle), 0);
      for (const [lengthFactor, z, width] of [
        [1, -i * 0.006, 0.075],
        [0.5, 0.03, 0.065], // rangée de couvertures, plus courtes, devant
      ]) {
        const length = span * THREE.MathUtils.lerp(0.75, 0.45, t) * jitter[i] * lengthFactor;
        const mesh = new THREE.Mesh(feather, skin);
        mesh.scale.set(length / 2, width, 0.022);
        mesh.position.copy(base).addScaledVector(dir, length * 0.45);
        mesh.position.z += z;
        mesh.rotation.z = angle;
        wing.add(mesh);
      }
    }
    return wing;
  });
  object.position.copy(anchors.back);
  return object;
}

function ailesPapillon(rng, { anchors }, skin) {
  const w = rng.range(0.8, 1.2);
  const h = rng.range(0.7, 1.1);
  const lw = w * rng.range(0.55, 0.8);
  const lh = h * rng.range(0.6, 0.95);
  const sweep = rng.range(0.3, 0.7);

  const upper = new THREE.Shape();
  upper.moveTo(0, 0);
  upper.bezierCurveTo(w * 0.2, h * 0.6, w * 0.6, h * 1.05, w * 0.95, h * 0.95);
  upper.bezierCurveTo(w * 1.15, h * 0.85, w * 1.05, h * 0.35, w * 0.8, h * 0.15);
  upper.bezierCurveTo(w * 0.55, -0.02, w * 0.2, -0.05, 0, 0);

  const lower = new THREE.Shape();
  lower.moveTo(0, 0);
  lower.bezierCurveTo(lw * 0.4, 0.02, lw * 1.0, -lh * 0.1, lw * 0.95, -lh * 0.55);
  lower.bezierCurveTo(lw * 0.9, -lh * 1.0, lw * 0.35, -lh * 1.05, lw * 0.15, -lh * 0.6);
  lower.bezierCurveTo(lw * 0.05, -lh * 0.35, 0, -0.1, 0, 0);

  const extrude = {
    depth: 0.015,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: res(4, 1),
    curveSegments: res(40, 6),
  };

  const object = mirrored(() => {
    const wing = new THREE.Group();
    wing.position.set(0.05, 0, 0);
    wing.rotation.set(0, sweep, 0);
    const upperMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(upper, extrude), skin);
    const lowerMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(lower, extrude), skin);
    lowerMesh.rotation.z = -0.15;
    lowerMesh.position.z = 0.02;
    wing.add(upperMesh, lowerMesh);
    return wing;
  });
  object.position.copy(anchors.back);
  return object;
}

// Nageoire dorsale : une grande voile courbe plantée le long de la colonne
function nageoireDorsale(rng, { anchors }, skin) {
  const size = rng.range(0.8, 1.2);
  const reach = rng.range(0.4, 0.6);
  const rise = rng.range(0.25, 0.5);
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.35);
  shape.bezierCurveTo(0.15, -0.2, reach * 0.7, rise * 0.3, reach, rise);

  shape.quadraticCurveTo(reach * 0.75, rise * 0.75, reach * 0.62, rise * 0.62);
  shape.quadraticCurveTo(reach * 0.45, rise * 0.62, reach * 0.33, rise * 0.48);
  shape.quadraticCurveTo(reach * 0.18, rise * 0.5, 0, 0.25);
  shape.closePath();

  const depth = 0.025;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: res(4, 1),
    curveSegments: res(40, 6),
  });
  geometry.translate(0, 0, -depth / 2);
  const fin = new THREE.Mesh(geometry, skin);

  fin.rotation.y = Math.PI / 2;
  fin.scale.setScalar(size);

  fin.position.copy(anchors.back).add(V(0, -0.05, 0.1));
  return fin;
}

// ---------------------------------------------------------------------------
// Queue

function tailPoints(rng, anchor, offsets, length) {
  const s = rng.sign(); // la queue part d'un côté ou de l'autre
  return offsets.map(([x, y, z], i) =>
    anchor.clone().add(
      V(
        (s * x + (i > 0 ? rng.range(-0.04, 0.04) : 0)) * length,
        (y + (i > 0 ? rng.range(-0.05, 0.05) : 0)) * length,
        z * length,
      ),
    ),
  );
}

function tip(object, pts) {
  const end = pts[pts.length - 1];
  const dir = end.clone().sub(pts[pts.length - 2]);
  object.position.copy(end);
  alignY(object, dir);
  return object;
}

const CAT_TAIL = [[0, 0, 0], [0.05, -0.1, -0.2], [0.1, -0.05, -0.45], [0.08, 0.2, -0.65], [0, 0.45, -0.7], [-0.05, 0.6, -0.6]];

function queueChat(rng, { anchors }, skin) {
  const pts = tailPoints(rng, anchors.tail, CAT_TAIL, rng.range(0.9, 1.3));
  const object = new THREE.Mesh(variableTube(pts, [0.07, 0.06, 0.05, 0.045, 0.04, 0.03]), skin);
  return object;
}

function queueLion(rng, { anchors }, skin) {
  const pts = tailPoints(rng, anchors.tail, CAT_TAIL, rng.range(1.0, 1.4));
  const object = new THREE.Group();
  object.add(new THREE.Mesh(variableTube(pts, [0.06, 0.045, 0.035, 0.03, 0.03, 0.03]), skin));
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(1, res(32, 6), res(20, 4)), skin);
  tuft.geometry.scale(0.09, 0.17, 0.09);
  tuft.geometry.translate(0, 0.1, 0);
  object.add(tip(tuft, pts));
  return object;
}

function queueDiable(rng, { anchors }, skin) {
  const pts = tailPoints(
    rng,
    anchors.tail,
    [[0, 0, 0], [0.05, -0.15, -0.25], [0.15, -0.1, -0.55], [0.2, 0.15, -0.75], [0.1, 0.35, -0.8]],
    rng.range(1.0, 1.4),
  );
  const object = new THREE.Group();
  object.add(new THREE.Mesh(variableTube(pts, [0.045, 0.035, 0.03, 0.028, 0.025], { roundEnd: false }), skin));
  // pointe en losange
  const spade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), skin);
  spade.geometry.scale(1, 1, 0.35);
  spade.geometry.translate(0, 0.08, 0);
  object.add(tip(spade, pts));
  return object;
}

function queueRenard(rng, { anchors }, skin) {
  const pts = tailPoints(
    rng,
    anchors.tail,
    [[0, 0, 0], [0, -0.05, -0.25], [0.05, 0, -0.5], [0.1, 0.15, -0.7], [0.1, 0.32, -0.8], [0.05, 0.42, -0.82]],
    rng.range(0.9, 1.2),
  );
  const object = new THREE.Mesh(variableTube(pts, [0.06, 0.13, 0.19, 0.2, 0.15, 0.04]), skin);
  return object;
}

function queuePoisson(rng, { anchors }, skin) {
  const pts = tailPoints(
    rng,
    anchors.tail,
    [[0, 0, 0], [0.03, -0.12, -0.2], [0.06, -0.15, -0.45], [0.05, 0, -0.65], [0.03, 0.2, -0.75]],
    rng.range(0.9, 1.2),
  );
  const object = new THREE.Group();
  object.add(new THREE.Mesh(variableTube(pts, [0.08, 0.08, 0.06, 0.04, 0.025], { roundEnd: false }), skin));

  const spread = rng.range(0.25, 0.38);
  const length = rng.range(0.3, 0.42);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.08, 0.08, -spread * 0.9, length * 0.7, -spread, length);
  shape.quadraticCurveTo(-spread * 0.35, length * 0.62, 0, length * 0.55);
  shape.quadraticCurveTo(spread * 0.35, length * 0.62, spread, length);
  shape.bezierCurveTo(spread * 0.9, length * 0.7, 0.08, 0.08, 0, 0);
  const depth = 0.02;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: res(3, 1),
    curveSegments: res(32, 6),
  });
  geometry.translate(0, -0.02, -depth / 2);
  object.add(tip(new THREE.Mesh(geometry, skin), pts));
  return object;
}
