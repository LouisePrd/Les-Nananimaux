import * as THREE from 'three';

// Socle comme sur les Nanas
export const SOCLE_THICKNESS = 0.1;

/** @param feet bouts des pieds d'appui */
export function buildSocle(feet) {
  const group = new THREE.Group();
  // métal sombre
  const material = new THREE.MeshPhysicalMaterial({
    color: '#2b2a2a',
    metalness: 0.6,
    roughness: 0.5,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3,
  });
  const center = new THREE.Vector3();
  const spread = Math.max(...feet.map((f) => Math.hypot(f.x - center.x, f.z - center.z)));
  const radius = Math.max(0.85, spread + 0.5);

  // disque aux bords arrondis
  const t = SOCLE_THICKNESS;
  const profile = [
    [0, 0],
    [radius - 0.02, 0],
    [radius, 0.015],
    [radius, t - 0.015],
    [radius - 0.02, t],
    [0, t],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const disk = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), material);
  disk.position.set(center.x, 0, center.z);
  group.add(disk);

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return group;
}
