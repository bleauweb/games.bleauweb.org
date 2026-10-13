// Cartoon geometry for everything that walks or rolls: four troop tiers, enemies, the hero,
// the boss, and the scenery. Each unit is one merged geometry with vertex colors so a whole
// army is a single instanced draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PLAYER_PALETTE = { body: 0x4f8fff, dark: 0x2b55c9, skin: 0xffd9b3, metal: 0x3a4256, glow: 0x9be7ff };
export const ENEMY_PALETTE = { body: 0xff4d4d, dark: 0x8b1a1a, skin: 0xffd9b3, metal: 0x3a4256, glow: 0xffb3b3 };

// Formation spacing and label height per tier.
export const UNIT_SPACING = [1, 1.25, 1.55, 1.5];
export const UNIT_HEIGHT = [1.05, 1.15, 0.8, 1.5];

function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function part(geo, hex, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  geo.scale(scale[0], scale[1], scale[2]);
  geo.rotateX(rot[0]);
  geo.rotateY(rot[1]);
  geo.rotateZ(rot[2]);
  geo.translate(pos[0], pos[1], pos[2]);
  return paint(geo, hex);
}

function merge(parts) {
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
  parts.forEach((p) => p.dispose());
  return g;
}

export function unitMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.05 });
}

/** Tier 0: rifleman. Tier 1: heavy. Tier 2: tank. Tier 3: mech. */
export function unitGeometry(tier, p = PLAYER_PALETTE) {
  switch (tier) {
    case 1:
      return merge([
        part(new THREE.CapsuleGeometry(0.27, 0.36, 4, 10), p.body, { pos: [0, 0.5, 0] }),
        part(new THREE.BoxGeometry(0.22, 0.16, 0.26), p.dark, { pos: [-0.33, 0.74, 0] }),
        part(new THREE.BoxGeometry(0.22, 0.16, 0.26), p.dark, { pos: [0.33, 0.74, 0] }),
        part(new THREE.SphereGeometry(0.18, 10, 8), p.skin, { pos: [0, 0.97, 0] }),
        part(new THREE.SphereGeometry(0.21, 10, 8), p.dark, { pos: [0, 1.03, 0], scale: [1, 0.75, 1] }),
        part(new THREE.BoxGeometry(0.3, 0.07, 0.1), p.glow, { pos: [0, 0.97, 0.16] }),
        part(new THREE.BoxGeometry(0.11, 0.11, 0.62), p.metal, { pos: [0.3, 0.55, -0.15] }),
      ]);
    case 2: {
      const g = merge([
        part(new THREE.BoxGeometry(0.8, 0.34, 1.05), p.body, { pos: [0, 0.34, 0] }),
        part(new THREE.BoxGeometry(0.22, 0.3, 1.12), p.metal, { pos: [-0.46, 0.22, 0] }),
        part(new THREE.BoxGeometry(0.22, 0.3, 1.12), p.metal, { pos: [0.46, 0.22, 0] }),
        part(new THREE.CylinderGeometry(0.3, 0.32, 0.26, 12), p.dark, { pos: [0, 0.64, 0.05] }),
        part(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 8), p.metal, { pos: [0, 0.66, -0.5], rot: [Math.PI / 2, 0, 0] }),
        part(new THREE.BoxGeometry(0.12, 0.06, 0.2), p.glow, { pos: [0, 0.79, 0.1] }),
      ]);
      g.scale(0.72, 0.72, 0.72);
      return g;
    }
    case 3: {
      const g = merge([
        part(new THREE.BoxGeometry(0.72, 0.62, 0.52), p.body, { pos: [0, 1.05, 0] }),
        part(new THREE.BoxGeometry(0.24, 0.62, 0.3), p.dark, { pos: [-0.24, 0.32, 0] }),
        part(new THREE.BoxGeometry(0.24, 0.62, 0.3), p.dark, { pos: [0.24, 0.32, 0] }),
        part(new THREE.BoxGeometry(0.34, 0.3, 0.34), p.dark, { pos: [0, 1.52, 0] }),
        part(new THREE.BoxGeometry(0.26, 0.08, 0.1), p.glow, { pos: [0, 1.54, 0.18] }),
        part(new THREE.BoxGeometry(0.2, 0.2, 0.8), p.metal, { pos: [-0.52, 1.22, -0.1] }),
        part(new THREE.BoxGeometry(0.2, 0.2, 0.8), p.metal, { pos: [0.52, 1.22, -0.1] }),
      ]);
      g.scale(0.8, 0.8, 0.8);
      return g;
    }
    default:
      // The ad look: a big round helmet-ball on a stubby body with little legs.
      return merge([
        part(new THREE.BoxGeometry(0.1, 0.22, 0.1), p.metal, { pos: [-0.09, 0.11, 0] }),
        part(new THREE.BoxGeometry(0.1, 0.22, 0.1), p.metal, { pos: [0.09, 0.11, 0] }),
        part(new THREE.CapsuleGeometry(0.17, 0.18, 4, 10), p.dark, { pos: [0, 0.4, 0] }),
        part(new THREE.SphereGeometry(0.27, 12, 10), p.body, { pos: [0, 0.78, 0] }),
        part(new THREE.SphereGeometry(0.1, 8, 6), p.skin, { pos: [0, 0.72, 0.22], scale: [1.3, 0.8, 0.5] }),
        part(new THREE.BoxGeometry(0.07, 0.07, 0.5), p.metal, { pos: [0.26, 0.45, -0.12] }),
      ]);
  }
}

/** The hero: a knight with a big sword and a cape. Returns the group and the sword pivot. */
export function buildHero() {
  const group = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({ color: 0xf0b53a, roughness: 0.4, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x5a3a9c, roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd9b3, roughness: 0.8 });
  const cape = new THREE.MeshStandardMaterial({ color: 0x8a2be2, roughness: 0.9, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0xe8f0ff, roughness: 0.2, metalness: 0.6, emissive: 0x334455, emissiveIntensity: 0.3 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 5, 12), armor);
  body.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.38;
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), dark);
  helm.position.y = 1.46;
  helm.scale.set(1, 0.7, 1);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xff4d6d }));
  plume.position.set(0, 1.85, -0.05);
  const capeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0), cape);
  capeMesh.position.set(0, 0.85, 0.3);
  const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), dark);
  shoulderL.position.set(-0.38, 1.1, 0);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.38;

  const swordPivot = new THREE.Group();
  swordPivot.position.set(0.5, 1.05, 0);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.1, 0.04), steel);
  blade.position.y = 0.7;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.09), armor);
  guard.position.y = 0.12;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.07), new THREE.MeshStandardMaterial({ color: 0x5a3a1a }));
  grip.position.y = -0.05;
  swordPivot.add(blade, guard, grip);
  swordPivot.rotation.z = -0.5;

  group.add(body, head, helm, plume, capeMesh, shoulderL, shoulderR, swordPivot);
  group.scale.setScalar(1.15);
  return { group, swordPivot, capeMesh };
}

/** The boss: a horned brute with a spiked club. */
export function buildBoss(scale = 1) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9c2f2f, emissive: 0x3a0000, emissiveIntensity: 0.5, roughness: 0.55 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb84242, roughness: 0.6 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0xffc400, emissiveIntensity: 1.2 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x4a4f5c, roughness: 0.4, metalness: 0.5 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.3, 1.4, 6, 14), bodyMat);
  body.position.y = 2.3;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10), skinMat);
  belly.position.set(0, 1.9, 0.75);
  belly.scale.set(1, 0.9, 0.6);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 12), skinMat);
  head.position.y = 4.05;
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 8), boneMat);
    horn.position.set(sx * 0.55, 4.6, 0);
    horn.rotation.z = -sx * 0.6;
    group.add(horn);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), eyeMat);
    eye.position.set(sx * 0.3, 4.15, 0.62);
    group.add(eye);
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 6), boneMat);
    tusk.position.set(sx * 0.3, 3.65, 0.6);
    group.add(tusk);
  }
  const clubPivot = new THREE.Group();
  clubPivot.position.set(1.5, 2.6, 0.2);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.6, 10), woodMat);
  handle.position.y = 1.0;
  const clubHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), ironMat);
  clubHead.position.y = 2.4;
  clubPivot.add(handle, clubHead);
  clubPivot.rotation.z = -0.4;

  group.add(body, belly, head, clubPivot);
  group.scale.setScalar(scale);
  return { group, body, bodyMat, clubPivot };
}

export function treeGeometry() {
  return merge([
    part(new THREE.CylinderGeometry(0.18, 0.22, 0.8, 7), 0x8b5a2b, { pos: [0, 0.4, 0] }),
    part(new THREE.ConeGeometry(1.0, 1.7, 7), 0x3cb371, { pos: [0, 1.5, 0] }),
    part(new THREE.ConeGeometry(0.75, 1.4, 7), 0x55d08a, { pos: [0, 2.4, 0] }),
  ]);
}

export function rockGeometry() {
  return paint(new THREE.DodecahedronGeometry(0.8, 0), 0xb9c2cf);
}

export function sceneryMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
}
