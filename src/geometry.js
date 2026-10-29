import * as THREE from 'three';

/**
 * Tube à rayon variable le long d'une courbe passant par des points de contrôle.
 * C'est la brique de base des membres, du cou, des queues et des cornes.
 *
 * @param {THREE.Vector3[]} points  points de contrôle
 * @param {number[]} radii          un rayon par point de contrôle
 * @param {object} options
 *   - segments : nombre d'anneaux le long de la courbe
 *   - radialSegments : nombre de sommets par anneau
 *   - roundStart / roundEnd : arrondit les extrémités en dôme (bouts des doigts, orteils…)
 */
export function variableTube(points, radii, options = {}) {
  const {
    segments = 160,
    radialSegments = 36,
    roundStart = true,
    roundEnd = true,
  } = options;

  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const n = points.length - 1;

  // Échantillons le long de la courbe. Avec getPoint(u), le point de contrôle i
  // correspond à u = i / n, ce qui permet d'interpoler les rayons simplement.
  const samples = [];
  for (let s = 0; s <= segments; s++) {
    const u = s / segments;
    samples.push({ u, p: curve.getPoint(u), r: radiusAt(radii, u * n) });
  }

  // Longueur totale (pour calculer la taille des dômes aux extrémités)
  let length = 0;
  for (let s = 1; s < samples.length; s++) length += samples[s].p.distanceTo(samples[s - 1].p);

  // Dômes : sur les derniers centimètres, le rayon suit un quart de cercle
  let acc = 0;
  for (let s = 0; s < samples.length; s++) {
    if (s > 0) acc += samples[s].p.distanceTo(samples[s - 1].p);
    samples[s].d = acc;
  }
  for (const smp of samples) {
    if (roundStart) smp.r = dome(smp.r, smp.d, radii[0]);
    if (roundEnd) smp.r = dome(smp.r, length - smp.d, radii[radii.length - 1]);
  }

  // Repères par « transport parallèle » : évite les torsions brusques des repères de Frenet
  const tangents = samples.map((smp, s) => {
    const a = samples[Math.max(0, s - 1)].p;
    const b = samples[Math.min(samples.length - 1, s + 1)].p;
    return b.clone().sub(a).normalize();
  });
  const normals = [];
  const binormals = [];
  const t0 = tangents[0];
  const helper = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  normals[0] = new THREE.Vector3().crossVectors(t0, helper).normalize();
  binormals[0] = new THREE.Vector3().crossVectors(t0, normals[0]);
  for (let s = 1; s < tangents.length; s++) {
    const q = new THREE.Quaternion().setFromUnitVectors(tangents[s - 1], tangents[s]);
    normals[s] = normals[s - 1].clone().applyQuaternion(q).normalize();
    binormals[s] = new THREE.Vector3().crossVectors(tangents[s], normals[s]);
  }

  // Construction des sommets
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let s = 0; s < samples.length; s++) {
    const { p, r } = samples[s];
    for (let k = 0; k <= radialSegments; k++) {
      const a = (k / radialSegments) * Math.PI * 2;
      const c = Math.cos(a);
      const si = Math.sin(a);
      positions.push(
        p.x + r * (c * normals[s].x + si * binormals[s].x),
        p.y + r * (c * normals[s].y + si * binormals[s].y),
        p.z + r * (c * normals[s].z + si * binormals[s].z),
      );
      uvs.push(k / radialSegments, samples[s].u);
    }
  }
  const row = radialSegments + 1;
  for (let s = 0; s < segments; s++) {
    for (let k = 0; k < radialSegments; k++) {
      const a = s * row + k;
      const b = (s + 1) * row + k;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  fixSeamNormals(geometry, samples.length, row);
  return geometry;
}

// Interpolation douce (smoothstep) entre les rayons des points de contrôle
function radiusAt(radii, x) {
  const i = Math.min(Math.floor(x), radii.length - 2);
  const t = x - i;
  const s = t * t * (3 - 2 * t);
  return radii[i] * (1 - s) + radii[i + 1] * s;
}

function dome(r, distFromEnd, endRadius) {
  const cap = endRadius;
  if (distFromEnd >= cap) return r;
  const t = 1 - distFromEnd / cap;
  return r * Math.sqrt(Math.max(0, 1 - t * t));
}

// Les sommets du premier et du dernier méridien sont doublés (pour les UV) :
// on moyenne leurs normales pour qu'aucune couture ne soit visible.
function fixSeamNormals(geometry, rings, row) {
  const normal = geometry.attributes.normal;
  for (let s = 0; s < rings; s++) {
    const a = s * row;
    const b = s * row + row - 1;
    const v = new THREE.Vector3(
      normal.getX(a) + normal.getX(b),
      normal.getY(a) + normal.getY(b),
      normal.getZ(a) + normal.getZ(b),
    ).normalize();
    normal.setXYZ(a, v.x, v.y, v.z);
    normal.setXYZ(b, v.x, v.y, v.z);
  }
}

/** Direction « vers le bas » tournée par un tangage (avant/arrière) et un roulis (côté). */
export function limbDirection(pitch, roll) {
  return new THREE.Vector3(0, -1, 0).applyEuler(new THREE.Euler(pitch, 0, roll, 'ZXY'));
}
