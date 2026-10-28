import * as THREE from 'three';
import { variableTube, limbDirection } from './geometry.js';

// Repère : y vers le haut, +z vers l'avant (face à la caméra), +x vers la droite de la sculpture.
// side = +1 pour le côté droit, -1 pour le côté gauche.

/**
 * Construit le corps d'une Nana à partir des paramètres tirés dans params.js.
 * Renvoie la sculpture, le groupe du torse et de la tête, et des points d'accroche
 * pour les attributs animaux.
 */
export function buildBody(params, materials) {
  const { skin, limbs } = materials;
  const { shape } = params;
  const figure = new THREE.Group();

  // ---------- Proportions ----------
  // Les grandeurs réglables viennent des curseurs (ou du hasard), le reste de son propre flux
  const rng = params.stream('proportions');
  const p = {
    hipR: shape.hips,
    headR: shape.head,
    armThick: shape.limbs,
    legThick: shape.limbs,
    depth: rng.range(0.72, 0.85), // aplatissement avant/arrière du torse
    hipY: rng.range(0.3, 0.4),
    waistY: rng.range(0.85, 1.0),
    armScale: rng.range(0.9, 1.1),
    thighLen: rng.range(0.78, 0.9),
    shinLen: rng.range(0.72, 0.82),
  };
  p.waistR = p.hipR * shape.waist;
  p.chestR = p.waistR * rng.range(1.05, 1.25);
  p.shoulderR = p.chestR * rng.range(0.78, 0.92);
  p.chestY = p.waistY + rng.range(0.25, 0.35);
  p.shoulderY = p.chestY + rng.range(0.15, 0.22);
  p.neckY = p.shoulderY + 0.14;

  // ---------- Torse ----------
  const torso = new THREE.Group();
  figure.add(torso);

  // Bosses gaussiennes qui déforment le torse. Mêmes valeurs à gauche et à droite pour la symétrie.
  const breast = {
    y: p.chestY - 0.04,
    a: rng.range(0.45, 0.6),
    sy: rng.range(0.1, 0.13),
    sa: rng.range(0.28, 0.36),
    amp: shape.breasts,
  };
  const bumps = [
    // ventre
    { y: (p.hipY + p.waistY) / 2, a: 0, sy: 0.28, sa: 0.85, amp: shape.belly },
    // seins
    ...[-1, 1].map((s) => ({ ...breast, a: s * breast.a })),
    // fesses
    ...[-1, 1].map((s) => ({ y: p.hipY + 0.02, a: Math.PI + s * 0.42, sy: 0.22, sa: 0.45, amp: shape.buttocks })),
  ];

  const profile = torsoProfile(p);
  const torsoGeometry = buildTorsoGeometry(profile, bumps, p.depth);
  const torsoMesh = new THREE.Mesh(torsoGeometry, skin);
  torso.add(torsoMesh);

  // Point à la surface du torse (avant le placement dans la scène), a = angle autour de l'axe (0 = devant)
  const surface = (y, a) => {
    const r = profileRadiusAt(profile, y) + bumpOffset(bumps, y, a);
    return new THREE.Vector3(r * Math.sin(a), y, r * Math.cos(a) * p.depth);
  };

  // Positions (u, v) dans la texture peinte des seins et du ventre, pour y poser des décors.
  // u : tour du corps, 0 = dos (couture de la surface de révolution) ; v : indice du point de profil.
  const textureU = (a) => ((((a - Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI);
  const textureV = (y) => {
    let best = 0;
    profile.forEach((pt, j) => {
      if (Math.abs(pt.y - y) < Math.abs(profile[best].y - y)) best = j;
    });
    return best / (profile.length - 1);
  };
  const paintFeatures = {
    breasts: [-1, 1].map((s) => ({ u: textureU(s * breast.a), v: textureV(breast.y) })),
    belly: { u: 0.5, v: textureV(bumps[0].y) },
  };

  // ---------- Cou et tête ----------
  const neckTop = p.neckY + 0.12;
  const neck = variableTube(
    [new THREE.Vector3(0, p.shoulderY - 0.05, 0), new THREE.Vector3(0, p.neckY, 0), new THREE.Vector3(0, neckTop, 0)],
    [0.12, 0.095, 0.08],
    { segments: 16, roundStart: false, roundEnd: false },
  );
  torso.add(new THREE.Mesh(neck, limbs));

  const headRng = params.stream('tete');
  const head = new THREE.Group();
  head.position.set(0, neckTop + p.headR * 0.88, 0);
  head.rotation.set(headRng.range(-0.08, 0.08), headRng.range(-0.16, 0.16), headRng.range(-0.1, 0.1));
  const headGeometry = new THREE.SphereGeometry(1, 48, 32);
  const headPositions = headGeometry.attributes.position;
  for (let i = 0; i < headPositions.count; i++) {
    const y = headPositions.getY(i);
    const jawTaper = 1 - 0.18 * Math.max(0, -y);
    headPositions.setX(i, headPositions.getX(i) * jawTaper);
    headPositions.setZ(i, headPositions.getZ(i) * jawTaper);
  }
  headGeometry.computeVertexNormals();
  const headMesh = new THREE.Mesh(headGeometry, limbs);
  headMesh.scale.set(0.95 * p.headR, 1.12 * p.headR, 0.88 * p.headR);
  head.add(headMesh);
  addFace(head, p.headR, headRng);
  torso.add(head);

  // ---------- Pose ----------
  const legPose = params.legs;
  const poseRng = params.stream('pose-torse');
  const raisedSide = poseRng.sign();
  const twist = poseRng.range(-0.3, 0.3);
  const torsoRotations = {
    genou: [poseRng.range(-0.1, 0.05), twist, raisedSide * poseRng.range(0.02, 0.1)],
    arabesque: [poseRng.range(0.15, 0.3), twist, raisedSide * poseRng.range(0, 0.08)],
    ecart: [poseRng.range(-0.05, 0.05), twist, raisedSide * poseRng.range(0.12, 0.25)],
    debout: [poseRng.range(-0.05, 0.05), twist, poseRng.range(-0.08, 0.08)],
  };
  torso.rotation.set(...torsoRotations[legPose]);
  torso.position.y = p.thighLen + p.shinLen + 0.3;
  figure.updateMatrixWorld(true);

  // ---------- Bras (attachés au torse) ----------
  for (const side of [1, -1]) {
    const pose = side === 1 ? params.arms.right : params.arms.left;
    const geometry = buildArm(params.stream(`bras${side}`), p, side, pose);
    torso.add(new THREE.Mesh(geometry, limbs));
  }

  // ---------- Jambes (en coordonnées monde) ----------
  const feet = []; // bout des pieds d'appui, pour poser la sculpture sur son socle
  for (const side of [1, -1]) {
    const legRng = params.stream(`jambe${side}`);
    const hip = torso.localToWorld(new THREE.Vector3(side * p.hipR * 0.45, p.hipY * 0.85, 0));
    const raised = legPose !== 'debout' && side === raisedSide;
    let geometry;
    if (raised) {
      geometry = buildRaisedLeg(legRng, p, hip, side, legPose);
    } else {
      const leg = buildSupportLeg(legRng, p, hip, side, legPose);
      geometry = leg.geometry;
      feet.push(leg.toe);
    }
    figure.add(new THREE.Mesh(geometry, limbs));
  }

  // ---------- Points d'accroche des attributs (repère du torse) ----------
  const backY = p.chestY - 0.05;
  const tailY = p.hipY + 0.25;
  const anchors = {
    back: surface(backY, Math.PI).add(new THREE.Vector3(0, 0, 0.04)),
    tail: surface(tailY, Math.PI).add(new THREE.Vector3(0, 0, 0.03)),
  };

  figure.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });

  return { figure, torso, head, headR: p.headR, anchors, paintFeatures, feet };
}

function addFace(head, headR, rng) {
  const ink = new THREE.MeshStandardMaterial({ color: '#493b4e', roughness: 0.55 });
  const ivory = new THREE.MeshStandardMaterial({ color: '#fff3e5', roughness: 0.45 });
  const eyeSpacing = rng.range(0.3, 0.35);
  const eyeRadius = rng.range(0.095, 0.11) * headR;
  const surfaceZ = (x, y) => {
    const taper = 1 - 0.18 * Math.max(0, -y);
    return 0.88 * headR * taper * Math.sqrt(Math.max(0, 1 - x * x - y * y));
  };

  for (const side of [-1, 1]) {
    const x = side * eyeSpacing;
    const y = 0.12;
    const z = surfaceZ(x, y);
    const socket = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), ink);
    socket.scale.set(eyeRadius * 1.15, eyeRadius * 1.35, eyeRadius * 0.7);
    socket.position.set(x * 0.95 * headR, y * 1.12 * headR, z + eyeRadius * 0.8);
    head.add(socket);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), ivory);
    eye.scale.set(eyeRadius * 0.76, eyeRadius, eyeRadius * 0.55);
    eye.position.set(x * 0.95 * headR, y * 1.12 * headR, z + eyeRadius * 1.4);
    head.add(eye);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), ink);
    pupil.scale.set(eyeRadius * 0.38, eyeRadius * 0.52, eyeRadius * 0.45);
    pupil.position.set((x + side * 0.012) * 0.95 * headR, y * 1.12 * headR, z + eyeRadius * 1.9);
    head.add(pupil);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), ink);
  nose.scale.set(0.06 * headR, 0.045 * headR, 0.04 * headR);
  nose.position.set(0, -0.08 * 1.12 * headR, surfaceZ(0, -0.08) + 0.08 * headR);
  head.add(nose);

  const mouthWidth = rng.range(0.17, 0.2);
  const mouthPoints = [
    [-mouthWidth, -0.25],
    [-mouthWidth * 0.55, -0.32],
    [0, -0.34],
    [mouthWidth * 0.55, -0.32],
    [mouthWidth, -0.25],
  ].map(
    ([x, y]) =>
      new THREE.Vector3(
        x * 0.95 * headR,
        y * 1.12 * headR,
        surfaceZ(x, y) + 0.05 * headR,
      ),
  );
  const mouth = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPoints), 24, 0.018 * headR, 8, false),
    ink,
  );
  head.add(mouth);
}

// ---------------------------------------------------------------------------
// Torse

function torsoProfile(p) {
  const pts = [
    [0.0, 0],
    [p.hipR * 0.5, 0.03],
    [p.hipR * 0.88, p.hipY * 0.45],
    [p.hipR, p.hipY],
    [p.hipR * 0.93, (p.hipY + p.waistY) / 2],
    [p.waistR, p.waistY],
    [p.chestR, p.chestY],
    [p.shoulderR, p.shoulderY],
    [p.shoulderR * 0.65, p.shoulderY + 0.09],
    [0.12, p.neckY],
    [0.0, p.neckY + 0.01],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.SplineCurve(pts).getPoints(72).map((v) => new THREE.Vector2(Math.max(0, v.x), v.y));
}

function profileRadiusAt(profile, y) {
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    if ((y - a.y) * (y - b.y) <= 0 && a.y !== b.y) {
      return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
    }
  }
  return 0;
}

function bumpOffset(bumps, y, a) {
  let offset = 0;
  for (const b of bumps) {
    let da = a - b.a;
    da = Math.atan2(Math.sin(da), Math.cos(da)); // ramène dans [-π, π]
    offset += b.amp * Math.exp(-(((y - b.y) / b.sy) ** 2) - (da / b.sa) ** 2);
  }
  return offset;
}

function buildTorsoGeometry(profile, bumps, depth) {
  const radial = 96;
  // phiStart = π : la couture de la surface de révolution se retrouve dans le dos
  const geometry = new THREE.LatheGeometry(profile, radial, Math.PI);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const a = Math.atan2(x, z);
    // près des pôles (entrejambe, cou) on ne déforme pas
    const r2 = r + bumpOffset(bumps, y, a) * Math.min(1, r / 0.15);
    pos.setXYZ(i, r2 * Math.sin(a), y, r2 * Math.cos(a) * depth);
  }
  geometry.computeVertexNormals();

  // Moyenne des normales sur la couture (sommets dupliqués)
  const normal = geometry.attributes.normal;
  const n = profile.length;
  for (let j = 0; j < n; j++) {
    const a = j;
    const b = radial * n + j;
    const v = new THREE.Vector3(
      normal.getX(a) + normal.getX(b),
      normal.getY(a) + normal.getY(b),
      normal.getZ(a) + normal.getZ(b),
    ).normalize();
    normal.setXYZ(a, v.x, v.y, v.z);
    normal.setXYZ(b, v.x, v.y, v.z);
  }
  return geometry;
}

// ---------------------------------------------------------------------------
// Bras

function buildArm(rng, p, side, pose) {
  let pitch, roll, forePitch, foreRoll;
  switch (pose) {
    case 'leve':
      pitch = rng.range(-0.3, 0.2);
      roll = rng.range(2.2, 2.8);
      forePitch = pitch;
      foreRoll = roll + rng.range(0, 0.5);
      break;
    case 'tendu':
      pitch = rng.range(-0.4, 0.3);
      roll = rng.range(1.2, 1.7);
      forePitch = pitch;
      foreRoll = roll + rng.range(-0.1, 0.6);
      break;
    case 'hanche':
      pitch = rng.range(0.1, 0.3);
      roll = rng.range(1.0, 1.2);
      forePitch = pitch;
      foreRoll = rng.range(-0.6, -0.4);
      break;
    case 'devant':
      pitch = rng.range(-1.1, -0.8);
      roll = rng.range(0.9, 1.2); // assez écarté pour ne pas traverser la poitrine
      forePitch = pitch - rng.range(0.2, 0.6);
      foreRoll = roll * 0.5;
      break;
  }

  const upperLen = 0.55 * p.armScale;
  const foreLen = 0.5 * p.armScale;
  const handLen = 0.2 * p.armScale;
  const upperDir = limbDirection(pitch, side * roll);
  const foreDir = limbDirection(forePitch, side * foreRoll);

  const shoulder = new THREE.Vector3(side * p.shoulderR * 0.8, p.shoulderY - 0.06, 0);
  const elbow = shoulder.clone().addScaledVector(upperDir, upperLen);
  const wrist = elbow.clone().addScaledVector(foreDir, foreLen);
  const points = [
    shoulder,
    shoulder.clone().addScaledVector(upperDir, upperLen * 0.5),
    elbow,
    elbow.clone().addScaledVector(foreDir, foreLen * 0.5),
    wrist,
    wrist.clone().addScaledVector(foreDir, handLen * 0.45),
    wrist.clone().addScaledVector(foreDir, handLen),
  ];
  const t = p.armThick;
  const radii = [0.15, 0.13, 0.085, 0.085, 0.052, 0.072, 0.04].map((r) => r * t);
  return variableTube(points, radii);
}

// ---------------------------------------------------------------------------
// Jambes

function legRadii(p) {
  const thighR = 0.3 * p.legThick;
  return [thighR, thighR * 0.85, 0.12, 0.14, 0.062, 0.075, 0.04].map((r, i) => (i < 2 ? r : r * p.legThick));
}

function legPoints(hip, knee, ankle, footDir, footLen) {
  return [
    hip,
    hip.clone().lerp(knee, 0.5),
    knee,
    knee.clone().lerp(ankle, 0.35),
    ankle,
    ankle.clone().addScaledVector(footDir, footLen * 0.5),
    ankle.clone().addScaledVector(footDir, footLen),
  ];
}

// Jambe d'appui : cinématique inverse à deux segments, le genou plie vers l'avant
function buildSupportLeg(rng, p, hip, side, legPose) {
  const a = p.thighLen;
  const b = p.shinLen;
  const flat = legPose === 'debout';
  const spread = flat ? rng.range(0.5, 1.3) : rng.range(0.1, 0.4);
  const reach = (a + b) * rng.range(0.94, 0.99);
  const ankle = new THREE.Vector3(
    hip.x * spread,
    hip.y - Math.sqrt(Math.max(0, reach ** 2 - (hip.x * (1 - spread)) ** 2)),
    hip.z + rng.range(-0.05, 0.1),
  );

  const toAnkle = ankle.clone().sub(hip);
  const d = toAnkle.length();
  toAnkle.normalize();
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const bend = new THREE.Vector3(0, 0, 1).addScaledVector(toAnkle, -toAnkle.z).normalize();
  const knee = hip.clone().addScaledVector(toAnkle, along).addScaledVector(bend, h);

  // pied à plat ou sur la pointe (comme une danseuse)
  const footDir = flat ? limbDirection(-1.35, side * 0.2) : limbDirection(rng.range(-0.45, -0.2), 0);
  const footLen = flat ? 0.34 : 0.3;
  const points = legPoints(hip, knee, ankle, footDir, footLen);
  return { geometry: variableTube(points, legRadii(p)), toe: points[points.length - 1] };
}

function buildRaisedLeg(rng, p, hip, side, legPose) {
  let thighDir, shinDir, footDir;
  if (legPose === 'genou') {
    const shinPitch = rng.range(0.0, 0.5);
    thighDir = limbDirection(-rng.range(1.1, 1.6), side * rng.range(0.1, 0.35));
    shinDir = limbDirection(shinPitch, side * rng.range(0, 0.2));
    footDir = limbDirection(shinPitch + rng.range(0.3, 0.6), 0);
  } else if (legPose === 'arabesque') {
    const thighPitch = rng.range(0.9, 1.4);
    const shinPitch = thighPitch + rng.range(0.1, 0.5);
    thighDir = limbDirection(thighPitch, side * 0.15);
    shinDir = limbDirection(shinPitch, side * 0.1);
    footDir = limbDirection(shinPitch + 0.3, 0);
  } else {
    const thighRoll = rng.range(0.8, 1.2);
    const shinRoll = thighRoll + rng.range(0.1, 0.4);
    const pitch = rng.range(-0.3, 0.1);
    thighDir = limbDirection(pitch, side * thighRoll);
    shinDir = limbDirection(pitch, side * shinRoll);
    footDir = limbDirection(pitch, side * (shinRoll + 0.3));
  }
  const knee = hip.clone().addScaledVector(thighDir, p.thighLen);
  const ankle = knee.clone().addScaledVector(shinDir, p.shinLen);
  return variableTube(legPoints(hip, knee, ankle, footDir, 0.3), legRadii(p));
}
