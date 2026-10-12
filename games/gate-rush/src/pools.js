// Instanced pools for the many small things: bullets and debris. One draw call each.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

class InstancePool {
  constructor(geometry, material, capacity) {
    this.capacity = capacity;
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.items = [];
    // Touch instanceColor once so three allocates the attribute.
    this.mesh.setColorAt(0, _c.set(0xffffff));
    this.mesh.instanceColor.needsUpdate = true;
  }

  spawn(item) {
    if (this.items.length >= this.capacity) this.items.shift();
    this.items.push(item);
    return item;
  }

  write() {
    const n = this.items.length;
    for (let i = 0; i < n; i++) {
      const it = this.items[i];
      _s.setScalar(it.scale);
      _m.compose(it.pos, _q, _s);
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, it.color);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.items.length = 0;
    this.mesh.count = 0;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export class BulletPool extends InstancePool {
  constructor(capacity = 400) {
    super(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), capacity);
  }

  /** Fire from `from` toward `to`; `onArrive` runs when it gets there (visual only). */
  fire(from, to, { speed = 48, color = 0xffe066, scale = 1, onArrive = null } = {}) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    dir.normalize().multiplyScalar(speed);
    this.spawn({ pos: from.clone(), vel: dir, ttl: dist / speed, scale, color: new THREE.Color(color), onArrive });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i];
      b.ttl -= dt;
      if (b.ttl <= 0) {
        if (b.onArrive) b.onArrive(b.pos);
        this.items.splice(i, 1);
        continue;
      }
      b.pos.addScaledVector(b.vel, dt);
    }
    this.write();
  }
}

export class ParticlePool extends InstancePool {
  constructor(capacity = 320) {
    super(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }), capacity);
  }

  burst(at, { count = 8, color = 0xff5c5c, speed = 5, scale = 1, up = 3 } = {}) {
    for (let i = 0; i < count; i++) {
      const vel = new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * up + 1, (Math.random() - 0.5) * speed);
      this.spawn({ pos: at.clone(), vel, ttl: 0.5 + Math.random() * 0.5, life: 1, scale, scale0: scale, color: new THREE.Color(color) });
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.ttl -= dt;
      if (p.ttl <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.vel.y -= 14 * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.08) {
        p.pos.y = 0.08;
        p.vel.y *= -0.3;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }
      p.scale = p.scale0 * Math.min(1, p.ttl * 2.5);
    }
    this.write();
  }
}
