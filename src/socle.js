import * as THREE from 'three';

// Socle comme sur les Nana
export const SOCLE_THICKNESS = 0.1;
export const ROD_HEIGHT = 0.25;

/**
 * @param feet     bouts des pieds d'appui, dans le repère de la scène (sculpture déjà surélevée)
 * @param onTiptoe true : un seul pied d'appui, porté par une tige ; false : pieds posés sur le disque
 */
export function buildSocle(feet, onTiptoe) {
  const group = new THREE.Group();
  // métal sombre
  const material = new THREE.MeshPhysicalMaterial({ color: '#2b2a2a', metalness: 0.6, roughness: 0.35, clearcoat: 0.6 });
  const center = feet.reduce((sum, f) => sum.add(f), new THREE.Vector3()).divideScalar(feet.length);
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

  if (onTiptoe) {
    for (const foot of feet) {
      // la tige entre un peu dans la pointe du pied
      const height = foot.y - t;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, height, 24), material);
      rod.position.set(foot.x, t + height / 2, foot.z);
      group.add(rod);
    }
  }

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return group;
}
