// The 3D game: a squad runs down a platform, picks gates, shoots through hordes, fights a boss.
// All of the balance math lives in combat.js so the level generator agrees with what you see.
import * as THREE from 'three';
import {
  RUN_SPEED, PLAYER_RANGE, ENEMY_RANGE, ENEMY_WALK, BOSS_STAND_OFF, BOSS_TELEGRAPH, TIERS,
  playerFire, enemyFire, toughness, applyGate, gateKind, gateLabel, gatePreview, displayPower, bossPowerFor,
} from './combat.js';
import { PLAYER_START_Z } from './level.js';
import { makeTextSprite, updateTextSprite, makeTextPlane, updateTextPlane, BarSprite } from './text.js';
import { BulletPool, ParticlePool } from './pools.js';
import {
  unitGeometry, unitMaterial, PLAYER_PALETTE, ENEMY_PALETTE, UNIT_SPACING, UNIT_HEIGHT,
  buildHero, buildBoss, treeGeometry, rockGeometry, sceneryMaterial,
} from './units.js';
import { audio } from './audio.js';

const LANE_HALF = 4.2; // platform edge
const PLAYER_X_MAX = 2.6; // where the squad centre may go
const MAX_SOLDIERS = 240;
const MAX_ENEMIES = 420;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const COLORS = {
  sky: 0x8fd3ff,
  water: 0x17417a,
  waterDeep: 0x0f2f5c,
  slab: 0xd9dde3,
  slabSide: 0xaab3c0,
  rim: 0xb8c0cc,
  island: 0x7fcf6b,
  gateGood: 0x3b82f6,
  gateMult: 0xf5b723,
  gateBad: 0xe6453f,
  gateTier: 0x1fb6a6,
  gateHero: 0x8b5cf6,
  coin: 0xffc83d,
  playerBullet: 0xffd84d,
  enemyBullet: 0xff6b6b,
  player: 0x4f8fff,
  enemy: 0xff4d4d,
  confetti: [0xff4d6d, 0xffc83d, 0x3ddc84, 0x5aa0ff, 0xc77dff, 0xffffff],
};

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler();

function gateColor(gate) {
  switch (gateKind(gate)) {
    case 'tier':
      return COLORS.gateTier;
    case 'hero':
      return COLORS.gateHero;
    case 'bad':
      return COLORS.gateBad;
    default:
      return gate.op === '×' ? COLORS.gateMult : COLORS.gateGood;
  }
}

export class Game {
  /**
   * @param {HTMLElement} container element the canvas is added to; also receives input
   * @param {{onHud?: Function, onEnd?: Function, onBoss?: Function}} hooks
   */
  constructor(container, hooks = {}) {
    this.container = container;
    this.hooks = hooks;
    this.state = 'idle'; // idle | running | boss | won | lost
    this.paused = false;
    this.timeScale = 1;
    this.elapsed = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ antialias: dpr < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.sky, 55, 120);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 260);
    this.shake = 0;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6f8fb8, 1.35));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(6, 16, 10);
    this.scene.add(sun);

    this.world = new THREE.Group(); // per-level stuff, rebuilt every level
    this.scene.add(this.world);

    this.bullets = new BulletPool(500);
    this.particles = new ParticlePool(400);
    this.scene.add(this.bullets.mesh, this.particles.mesh);

    // One instanced mesh per troop tier; only the current tier is drawn.
    this.unitMat = unitMaterial();
    this.troopMeshes = TIERS.map((_, tier) => {
      const mesh = new THREE.InstancedMesh(unitGeometry(tier, PLAYER_PALETTE), this.unitMat, MAX_SOLDIERS);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.scene.add(mesh);
      return mesh;
    });
    this.enemyGeo = unitGeometry(0, ENEMY_PALETTE);

    this.hero = buildHero();
    this.scene.add(this.hero.group);

    this.countLabel = makeTextSprite('0', { color: '#ffffff' }, 1.5);
    this.scene.add(this.countLabel);

    this.floaters = [];
    this.input = { dragging: false, lastX: 0, keys: 0 };
    this.bindInput();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.last = performance.now();
    this.rafId = requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- lifecycle ----------

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait phones need a taller view to see the next gate and the squad at once.
    this.camera.fov = this.camera.aspect < 0.75 ? 78 : this.camera.aspect < 1.1 ? 68 : 56;
    this.camera.updateProjectionMatrix();
  }

  /** stats: { startBonus, power, armor, heroStart } */
  start(level, stats) {
    this.clearWorld();
    this.level = level;
    this.stats = stats;
    this.state = 'running';
    this.paused = false;
    this.timeScale = 1;
    this.elapsed = 0;
    this.endTimer = 0;
    this.coinsCollected = 0;
    this.enteredBossWith = 0;
    this.lastHud = '';
    this.squad = { count: level.start.count + stats.startBonus, tier: 0, hero: Math.max(1, stats.heroStart || 1) };
    this.player = { x: 0, targetX: 0, z: PLAYER_START_Z };
    this.peak = this.squad.count;
    this.swing = 0;
    this.buildWorld(level);
    this.updateCamera(true);
    this.pushHud();
  }

  clearWorld() {
    this.world.traverse((o) => {
      if (o.geometry && o.geometry !== this.enemyGeo) o.geometry.dispose();
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m === this.unitMat) continue;
        if (m.map && m.map.isTexture) m.map.dispose();
        m.dispose();
      }
    });
    this.world.clear();
    this.bullets.clear();
    this.particles.clear();
    for (const f of this.floaters) {
      this.scene.remove(f.sprite);
      f.sprite.material.map.dispose();
      f.sprite.material.dispose();
    }
    this.floaters = [];
    this.gates = [];
    this.coins = [];
    this.groups = [];
    this.boss = null;
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.clearWorld();
    this.renderer.dispose();
  }

  // ---------- world building ----------

  buildWorld(level) {
    const length = PLAYER_START_Z - level.endZ + 50;
    const midZ = (PLAYER_START_Z + level.endZ) / 2;

    // Sea all around, a raised slab to run on, a low rim at the edges.
    const water = new THREE.Mesh(new THREE.PlaneGeometry(600, length + 300), new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.4, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -1.4, midZ);
    this.world.add(water);

    const slabTex = makeSlabTexture();
    slabTex.repeat.set(2, length / 8);
    const slabMats = [
      new THREE.MeshStandardMaterial({ color: COLORS.slabSide, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: COLORS.slabSide, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ map: slabTex, roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: COLORS.slabSide, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: COLORS.slabSide, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: COLORS.slabSide, roughness: 0.9 }),
    ];
    const slab = new THREE.Mesh(new THREE.BoxGeometry(LANE_HALF * 2, 1.4, length), slabMats);
    slab.position.set(0, -0.7, midZ);
    this.world.add(slab);

    const rimMat = new THREE.MeshStandardMaterial({ color: COLORS.rim, roughness: 0.8 });
    for (const side of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, length), rimMat);
      rim.position.set(side * (LANE_HALF - 0.15), 0.15, midZ);
      this.world.add(rim);
    }

    // Little islands with trees and rocks drifting past on both sides.
    const islandGeo = new THREE.CylinderGeometry(2.2, 2.6, 0.8, 9);
    const islandMat = new THREE.MeshStandardMaterial({ color: COLORS.island, roughness: 1, flatShading: true });
    const trees = new THREE.InstancedMesh(treeGeometry(), sceneryMaterial(), 80);
    const rocks = new THREE.InstancedMesh(rockGeometry(), sceneryMaterial(), 40);
    trees.frustumCulled = false;
    rocks.frustumCulled = false;
    let ti = 0;
    let ri = 0;
    const islands = Math.floor(length / 22);
    for (let i = 0; i < islands; i++) {
      const side = i % 2 ? 1 : -1;
      const ix = side * (8 + Math.random() * 7);
      const iz = PLAYER_START_Z + 12 - (i / islands) * (length + 20) - Math.random() * 6;
      const island = new THREE.Mesh(islandGeo, islandMat);
      island.position.set(ix, -1.1, iz);
      island.rotation.y = Math.random() * Math.PI;
      this.world.add(island);
      for (let t = 0; t < 2 && ti < 80; t++, ti++) {
        const sc = 0.7 + Math.random() * 0.6;
        _m.compose(_v.set(ix + (Math.random() - 0.5) * 2.4, -0.7, iz + (Math.random() - 0.5) * 2.4), _q.setFromEuler(_e.set(0, Math.random() * 6, 0)), _s.set(sc, sc, sc));
        trees.setMatrixAt(ti, _m);
      }
      if (ri < 40) {
        const sc = 0.4 + Math.random() * 0.5;
        _m.compose(_v.set(ix + (Math.random() - 0.5) * 3, -0.9, iz + (Math.random() - 0.5) * 3), _q.setFromEuler(_e.set(Math.random(), Math.random() * 6, 0)), _s.set(sc, sc, sc));
        rocks.setMatrixAt(ri++, _m);
      }
    }
    trees.count = ti;
    rocks.count = ri;
    this.world.add(trees, rocks);
    _s.set(1, 1, 1);

    // Boss arena: a darker circle on the slab.
    const pad = new THREE.Mesh(new THREE.CircleGeometry(5.5, 40), new THREE.MeshStandardMaterial({ color: 0x6b2a3a, roughness: 1 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.015, level.boss.z);
    this.world.add(pad);

    for (const row of level.rows) {
      if (row.type === 'gates') this.buildGateRow(row);
      else if (row.type === 'enemy') this.buildEnemyGroup(row);
      else this.buildCoins(row);
    }
    this.buildBoss(level.boss);
  }

  buildGateRow(row) {
    const make = (gate, x) => {
      const color = gateColor(gate);
      const g = new THREE.Group();
      g.position.set(x, 0, row.z);
      const postMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.6 });
      for (const px of [-1.35, 1.35]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 8), postMat);
        post.position.set(px, 1.3, 0);
        g.add(post);
      }
      const panelMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.15 });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.9, 0.16), panelMat);
      panel.position.set(0, 1.75, 0);
      g.add(panel);
      const label = makeTextPlane(gateLabel(gate), { color: '#ffffff', stroke: 'rgba(0,0,0,0.55)' }, gate.op === 'tier' || gate.op === 'hero' ? 0.75 : 1.15);
      label.position.set(0, 2.0, 0.1);
      g.add(label);
      const preview = makeTextPlane('', { color: '#ffffff', stroke: 'rgba(0,0,0,0.5)' }, 0.5);
      preview.position.set(0, 1.2, 0.1);
      g.add(preview);
      this.world.add(g);
      return { gate, group: g, panelMat, preview, x };
    };
    this.gates.push({ z: row.z, left: make(row.left, -1.85), right: make(row.right, 1.85), done: false, anim: 0 });
  }

  buildEnemyGroup(row) {
    const cap = Math.min(row.count, MAX_ENEMIES);
    const mesh = new THREE.InstancedMesh(this.enemyGeo, this.unitMat, cap);
    mesh.frustumCulled = false;
    const offsets = [];
    const spread = row.halfWidth > 2 ? 1.25 : 0.95;
    for (let i = 0; i < cap; i++) {
      const r = 0.44 * Math.sqrt(i);
      const a = i * GOLDEN;
      offsets.push([Math.cos(a) * r * spread, Math.sin(a) * r * 0.85]);
    }
    this.world.add(mesh);
    const label = makeTextSprite(String(row.count), { color: '#ffffff', stroke: 'rgba(120,0,0,0.8)' }, 1.6);
    this.world.add(label);
    const g = { row, mesh, offsets, cap, label, x: row.x, z: row.z, countF: row.count, shown: row.count, alive: true, charging: false, phase: Math.random() * 6 };
    this.groups.push(g);
    this.writeGroup(g);
  }

  buildCoins(row) {
    const geo = new THREE.CylinderGeometry(0.34, 0.34, 0.1, 18);
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.coin, emissive: 0x7a5a00, emissiveIntensity: 0.35, metalness: 0.5, roughness: 0.35 });
    for (const p of row.positions) {
      const pivot = new THREE.Group();
      pivot.position.set(p.x, 0.8, p.z);
      const coin = new THREE.Mesh(geo, mat);
      coin.rotation.x = Math.PI / 2;
      pivot.add(coin);
      this.world.add(pivot);
      this.coins.push({ x: p.x, z: p.z, pivot, taken: false });
    }
  }

  buildBoss(boss) {
    const built = buildBoss(1 + Math.min(0.5, this.level.n * 0.02));
    built.group.position.set(0, 0, boss.z);
    const bar = new BarSprite(4.6, 0.75);
    bar.sprite.position.set(0, 5.6 * built.group.scale.x, 0);
    bar.set(1, `HP ${boss.hp}`);
    built.group.add(bar.sprite);
    const power = makeTextSprite('', { color: '#ffd0d0', stroke: 'rgba(80,0,0,0.8)' }, 0.9);
    power.position.set(0, 6.5 * built.group.scale.x, 0);
    built.group.add(power);
    this.world.add(built.group);
    this.boss = { def: boss, ...built, bar, powerLabel: power, hp: boss.hp, stood: 0, shotTimer: 0, flash: 0, dead: false, announced: false };
  }

  // ---------- input ----------

  bindInput() {
    const el = this.container;
    el.style.touchAction = 'none';
    const down = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      this.input.dragging = true;
      this.input.lastX = e.clientX;
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!this.input.dragging || !this.player) return;
      const dx = e.clientX - this.input.lastX;
      this.input.lastX = e.clientX;
      const width = el.clientWidth || 1;
      this.player.targetX = clamp(this.player.targetX + (dx / width) * 8, -PLAYER_X_MAX, PLAYER_X_MAX);
    };
    const up = () => {
      this.input.dragging = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.input.keys |= 1;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.input.keys |= 2;
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.input.keys &= ~1;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.input.keys &= ~2;
    });
  }

  // ---------- main loop ----------

  frame(now) {
    this.rafId = requestAnimationFrame((t) => this.frame(t));
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.paused) return;
    dt *= this.timeScale;
    this.elapsed += dt;
    if (this.player) this.update(dt);
    this.bullets.update(dt);
    this.particles.update(dt);
    this.updateFloaters(dt);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    const p = this.player;
    const active = this.state === 'running' || this.state === 'boss';

    if (active) {
      if (this.input.keys & 1) p.targetX = clamp(p.targetX - 8 * dt, -PLAYER_X_MAX, PLAYER_X_MAX);
      if (this.input.keys & 2) p.targetX = clamp(p.targetX + 8 * dt, -PLAYER_X_MAX, PLAYER_X_MAX);
    }
    p.x += (p.targetX - p.x) * Math.min(1, dt * 11);

    let blocked = false;
    if (active) blocked = this.updateEnemies(dt);

    if (this.state === 'running') {
      if (!blocked) p.z -= RUN_SPEED * dt;
      this.updateGates();
      this.updateCoins();
      this.updateBossApproach(dt);
    } else if (this.state === 'boss') {
      this.updateBossFight(dt);
    }

    if (active && this.squad.count <= 0) this.lose();

    this.updateGateAnims(dt);
    this.updateSquad(dt, blocked);
    this.updateCamera(false);
    this.animateCoins(dt);
    this.pushHud();

    if (this.state === 'won' || this.state === 'lost') {
      this.endTimer += dt / this.timeScale;
      this.timeScale += (1 - this.timeScale) * Math.min(1, dt * 2);
      if (this.state === 'won' && !this.ended && Math.random() < 0.5) this.confetti();
      if (this.endTimer > (this.state === 'won' ? 2.2 : 1.3) && !this.ended) {
        this.ended = true;
        this.hooks.onEnd?.({
          won: this.state === 'won',
          remaining: Math.max(0, Math.ceil(this.squad.count)),
          enteredBossWith: this.enteredBossWith,
          peak: this.peak,
          coins: this.coinsCollected,
          level: this.level.n,
          tier: this.squad.tier,
          hero: this.squad.hero,
        });
      }
    }
  }

  // ---------- gates ----------

  updateGates() {
    const p = this.player;
    const next = this.gates.find((g) => !g.done);
    if (!next) return;
    const chosenRight = p.x >= 0;
    for (const side of [next.left, next.right]) {
      const sel = (side === next.right) === chosenRight;
      side.panelMat.emissiveIntensity = sel ? 0.55 : 0.1;
      side.group.scale.setScalar(sel ? 1.06 : 1);
      if (next.z > p.z - 70) updateTextPlane(side.preview, gatePreview(this.squad, side.gate));
    }
    if (p.z <= next.z) {
      next.done = true;
      const side = chosenRight ? next.right : next.left;
      const before = this.squad;
      this.squad = applyGate(before, side.gate);
      this.peak = Math.max(this.peak, this.squad.count);
      const kind = gateKind(side.gate);
      const good = kind !== 'bad';
      if (side.gate.op === 'tier') {
        this.float(this.squad.tier !== before.tier ? `${TIERS[this.squad.tier].name.toUpperCase()}!` : `+${this.squad.count - before.count}`, p.x, 2.6, p.z, '#7ff5e8', 1.4);
        this.burstSquad(COLORS.gateTier, 40);
      } else if (side.gate.op === 'hero') {
        this.float(`HERO Lv ${this.squad.hero}`, p.x, 2.6, p.z, '#d8b4fe', 1.2);
        this.particles.burst(_v.set(p.x, 1.5, p.z - 1.5), { count: 24, color: COLORS.gateHero, speed: 6, up: 5 });
      } else {
        const delta = this.squad.count - before.count;
        this.float(`${delta >= 0 ? '+' : ''}${delta}`, p.x, 2.4, p.z, good ? '#3ddc84' : '#ff7a7a', 1.4);
      }
      this.particles.burst(_v.set(side.x, 1.8, next.z), { count: 18, color: gateColor(side.gate), speed: 7, up: 4 });
      if (good) audio.gateGood();
      else audio.gateBad();
      this.shake = Math.max(this.shake, good ? 0.12 : 0.3);
    }
  }

  updateGateAnims(dt) {
    for (const g of this.gates) {
      if (!g.done || g.anim >= 1) continue;
      g.anim = Math.min(1, g.anim + dt * 3);
      const s = 1 - g.anim;
      for (const side of [g.left, g.right]) {
        side.group.scale.set(1 + g.anim * 0.3, s, 1);
        side.group.visible = g.anim < 1;
      }
    }
  }

  // ---------- coins ----------

  updateCoins() {
    const p = this.player;
    for (const c of this.coins) {
      if (c.taken) continue;
      if (Math.abs(c.z - p.z) < 0.9 && Math.abs(c.x - p.x) < 1.4) {
        c.taken = true;
        c.pivot.visible = false;
        this.coinsCollected++;
        this.particles.burst(_v.set(c.x, 0.8, c.z), { count: 6, color: COLORS.coin, speed: 4, up: 3, scale: 0.7 });
        audio.coin();
      }
    }
  }

  animateCoins(dt) {
    for (const c of this.coins) if (!c.taken) c.pivot.rotation.y += dt * 4;
  }

  // ---------- enemies ----------

  updateEnemies(dt) {
    const p = this.player;
    let blocked = false;
    let target = null;
    let targetD = Infinity;
    for (const g of this.groups) {
      if (!g.alive) continue;
      const d = p.z - g.z; // distance ahead (positive while in front of us)
      if (d <= PLAYER_RANGE && d > -2 && d < targetD) {
        target = g;
        targetD = d;
      }
    }
    const tough = toughness(this.squad);
    for (const g of this.groups) {
      if (!g.alive) continue;
      let d = p.z - g.z;
      // Hordes pour toward you once the shooting starts.
      if (d <= PLAYER_RANGE && d > 1.2) {
        g.charging = true;
        g.z += Math.min(ENEMY_WALK * dt, d - 1.2);
        d = p.z - g.z;
      }
      const inPath = Math.abs(p.x - g.x) < g.row.halfWidth + 0.7;
      if (g === target) {
        g.countF -= playerFire(this.squad, this.stats.power) * dt;
        this.spawnPlayerShots(g, dt);
      }
      if (d <= ENEMY_RANGE && d > -4) {
        this.squad.count -= (enemyFire(g.countF) * this.stats.armor / tough) * dt;
        this.spawnEnemyShots(g, dt);
      }
      if (inPath && d <= 1.3 && d > -1.5) {
        blocked = true;
        p.z = Math.max(p.z, g.z + 1.2);
      }
      this.refreshGroup(g);
      this.writeGroup(g);
    }
    return blocked;
  }

  writeGroup(g) {
    const n = Math.min(g.shown, g.cap);
    const t = this.elapsed * 10 + g.phase;
    const bob = g.charging ? 0.08 : 0.02;
    for (let i = 0; i < n; i++) {
      const [ox, oz] = g.offsets[i];
      _v.set(g.x + ox, Math.abs(Math.sin(t + i * 1.3)) * bob, g.z + oz);
      _m.compose(_v, _q.setFromEuler(_e.set(0, Math.PI, 0)), _s);
      g.mesh.setMatrixAt(i, _m);
    }
    g.mesh.count = n;
    g.mesh.instanceMatrix.needsUpdate = true;
    g.label.position.set(g.x, 2.2 + Math.sqrt(n) * 0.12, g.z - Math.sqrt(n) * 0.2);
  }

  refreshGroup(g) {
    const shown = Math.max(0, Math.ceil(g.countF));
    if (shown === g.shown) return;
    for (let i = shown; i < g.shown && i < g.cap && i > g.shown - 6; i++) {
      const [ox, oz] = g.offsets[Math.min(i, g.cap - 1)];
      this.particles.burst(_v.set(g.x + ox, 0.5, g.z + oz), { count: 3, color: COLORS.enemy, speed: 3, up: 2.5, scale: 0.7 });
    }
    g.shown = shown;
    updateTextSprite(g.label, String(shown));
    if (shown <= 0) {
      g.alive = false;
      g.mesh.visible = false;
      g.label.visible = false;
      this.particles.burst(_v.set(g.x, 0.8, g.z), { count: 30, color: COLORS.enemy, speed: 8, up: 5 });
      audio.groupDown();
      this.shake = Math.max(this.shake, 0.18);
    }
  }

  spawnPlayerShots(g, dt) {
    const rate = clamp(playerFire(this.squad, this.stats.power) * 1.2, 8, 40);
    this.shotAcc = (this.shotAcc || 0) + rate * dt;
    while (this.shotAcc >= 1) {
      this.shotAcc -= 1;
      const from = this.soldierSpot(Math.floor(Math.random() * Math.min(Math.ceil(this.squad.count), MAX_SOLDIERS)));
      from.y = 0.8;
      const [ox, oz] = g.offsets[Math.floor(Math.random() * Math.max(1, Math.min(g.shown, g.cap)))];
      const to = _v2.set(g.x + ox, 0.6, g.z + oz).clone();
      this.bullets.fire(from, to, { color: COLORS.playerBullet, speed: 55, scale: 1, stretch: 2.4 });
      audio.shoot();
    }
  }

  spawnEnemyShots(g, dt) {
    const rate = clamp(enemyFire(g.countF) * 1.5, 3, 24);
    g.shotAcc = (g.shotAcc || 0) + rate * dt;
    while (g.shotAcc >= 1) {
      g.shotAcc -= 1;
      const [ox, oz] = g.offsets[Math.floor(Math.random() * Math.max(1, Math.min(g.shown, g.cap)))];
      const from = _v2.set(g.x + ox, 0.7, g.z + oz).clone();
      const to = this.soldierSpot(Math.floor(Math.random() * Math.min(Math.ceil(this.squad.count), MAX_SOLDIERS)));
      to.y = 0.6;
      this.bullets.fire(from, to, {
        color: COLORS.enemyBullet,
        speed: 32,
        scale: 0.9,
        stretch: 1.6,
        onArrive: (pos) => this.particles.burst(pos, { count: 2, color: COLORS.player, speed: 3, up: 2, scale: 0.6 }),
      });
      audio.enemyShoot();
    }
  }

  // ---------- boss ----------

  updateBossApproach(dt) {
    const b = this.boss;
    const p = this.player;
    const d = p.z - b.def.z;
    const rowsDone = this.gates.every((g) => g.done);
    if (!rowsDone) return;
    if (d <= PLAYER_RANGE + 6 && !b.announced) {
      b.announced = true;
      const you = displayPower(this.squad, this.stats.power);
      const theirs = bossPowerFor(this.squad, b.def, this.stats.power, this.stats.armor);
      updateTextSprite(b.powerLabel, `POWER ${theirs}`);
      this.hooks.onBoss?.({ you, boss: theirs });
    }
    if (d <= PLAYER_RANGE) this.hitBoss(playerFire(this.squad, this.stats.power) * dt, dt);
    if (d <= BOSS_STAND_OFF) {
      p.z = b.def.z + BOSS_STAND_OFF;
      this.state = 'boss';
      this.enteredBossWith = Math.ceil(this.squad.count);
      b.stood = 0;
    }
  }

  updateBossFight(dt) {
    const b = this.boss;
    b.stood += dt;
    this.hitBoss(playerFire(this.squad, this.stats.power) * dt, dt);
    if (b.dead) return;
    if (b.stood >= BOSS_TELEGRAPH) {
      this.squad.count -= (b.def.dps * this.stats.armor / toughness(this.squad)) * dt;
      b.shotTimer -= dt;
      b.clubPivot.rotation.z = -0.4 - Math.max(0, Math.sin(b.shotTimer * 12)) * 1.2;
      if (b.shotTimer <= 0) {
        b.shotTimer = 0.3;
        const from = _v.set(0, 3.2, b.def.z).clone();
        const to = this.soldierSpot(Math.floor(Math.random() * Math.min(Math.ceil(this.squad.count), MAX_SOLDIERS)));
        to.y = 0.6;
        this.bullets.fire(from, to, {
          color: 0xff6a3d,
          speed: 32,
          scale: 2.6,
          stretch: 1,
          onArrive: (pos) => {
            this.particles.burst(pos, { count: 8, color: COLORS.player, speed: 5, up: 3 });
            this.shake = Math.max(this.shake, 0.2);
          },
        });
        audio.bossShot();
      }
    } else {
      // Telegraph: the boss swells before it opens fire.
      b.body.scale.setScalar(1 + Math.sin((b.stood / BOSS_TELEGRAPH) * Math.PI) * 0.18);
    }
  }

  hitBoss(amount, dt) {
    const b = this.boss;
    if (b.dead) return;
    b.hp -= amount;
    b.flash = Math.min(1, b.flash + amount * 0.02);
    b.flash = Math.max(0, b.flash - dt * 3);
    b.bodyMat.emissiveIntensity = 0.5 + b.flash * 2;
    b.bar.set(Math.max(0, b.hp / b.def.hp), `HP ${Math.max(0, Math.ceil(b.hp))}`);
    this.bossShotAcc = (this.bossShotAcc || 0) + clamp(playerFire(this.squad, this.stats.power) * 1.2, 8, 40) * dt;
    while (this.bossShotAcc >= 1) {
      this.bossShotAcc -= 1;
      const from = this.soldierSpot(Math.floor(Math.random() * Math.min(Math.ceil(this.squad.count), MAX_SOLDIERS)));
      from.y = 0.8;
      const to = _v2.set((Math.random() - 0.5) * 1.8, 1.6 + Math.random() * 2.4, b.def.z + 0.8).clone();
      this.bullets.fire(from, to, { color: COLORS.playerBullet, speed: 55, scale: 1, stretch: 2.4 });
      audio.shoot();
    }
    if (b.hp <= 0) {
      b.dead = true;
      b.group.visible = false;
      this.particles.burst(_v.set(0, 2.5, b.def.z), { count: 90, color: 0x9c2f2f, speed: 14, up: 9, scale: 1.6 });
      this.particles.burst(_v.set(0, 3, b.def.z), { count: 30, color: COLORS.coin, speed: 10, up: 8, scale: 1.1 });
      audio.bossDown();
      audio.win();
      this.shake = 0.8;
      this.timeScale = 0.35;
      this.state = 'won';
      this.ended = false;
    }
  }

  lose() {
    if (this.state === 'lost') return;
    this.squad.count = 0;
    this.state = 'lost';
    this.ended = false;
    this.particles.burst(_v.set(this.player.x, 0.8, this.player.z), { count: 40, color: COLORS.player, speed: 8, up: 5 });
    audio.lose();
    this.shake = 0.5;
    this.timeScale = 0.5;
  }

  confetti() {
    const color = COLORS.confetti[Math.floor(Math.random() * COLORS.confetti.length)];
    this.particles.burst(_v.set(this.player.x + (Math.random() - 0.5) * 8, 6 + Math.random() * 3, this.player.z - 4 + Math.random() * 6), { count: 3, color, speed: 3, up: 1, scale: 0.9 });
  }

  burstSquad(color, count) {
    for (let i = 0; i < count; i++) {
      this.soldierSpot(Math.floor(Math.random() * Math.min(Math.ceil(this.squad.count), MAX_SOLDIERS)), _v);
      _v.y = 0.8;
      this.particles.burst(_v, { count: 1, color, speed: 2, up: 4, scale: 0.8 });
    }
  }

  // ---------- squad rendering ----------

  formationRadius() {
    const n = Math.min(Math.max(1, Math.ceil(this.squad.count)), MAX_SOLDIERS);
    return 0.44 * UNIT_SPACING[this.squad.tier] * Math.sqrt(n);
  }

  soldierSpot(i, out = new THREE.Vector3()) {
    const sp = 0.44 * UNIT_SPACING[this.squad.tier];
    const r = sp * Math.sqrt(i);
    const a = i * GOLDEN;
    return out.set(this.player.x + Math.cos(a) * r, 0, this.player.z + Math.sin(a) * r * 0.8);
  }

  updateSquad(dt, blocked) {
    const p = this.player;
    const tier = this.squad.tier;
    const n = Math.min(Math.max(0, Math.ceil(this.squad.count)), MAX_SOLDIERS);
    const running = this.state === 'running' && !blocked;
    const lean = running && tier !== 2 ? -0.15 : 0;
    const sway = (p.targetX - p.x) * 0.25;
    _q.setFromEuler(_e.set(lean, 0, -sway));
    for (let t = 0; t < this.troopMeshes.length; t++) {
      const mesh = this.troopMeshes[t];
      if (t !== tier) {
        mesh.count = 0;
        continue;
      }
      for (let i = 0; i < n; i++) {
        this.soldierSpot(i, _v);
        const phase = this.elapsed * 15 + i * 1.7;
        _v.y += running ? Math.abs(Math.sin(phase)) * (tier === 2 ? 0.02 : 0.09) : Math.sin(phase * 0.4) * 0.02;
        _m.compose(_v, _q, _s);
        mesh.setMatrixAt(i, _m);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
    const radius = this.formationRadius();
    this.countLabel.position.set(p.x, UNIT_HEIGHT[tier] + 1.2 + radius * 0.25, p.z - radius * 0.3);
    this.countLabel.visible = this.squad.count > 0;
    updateTextSprite(this.countLabel, String(Math.max(0, Math.ceil(this.squad.count))));

    // The hero leads from the front and swings when anything is close.
    const h = this.hero.group;
    h.position.set(p.x, 0, p.z - radius - 1.0);
    h.rotation.y = Math.PI + sway * 0.6;
    h.position.y = running ? Math.abs(Math.sin(this.elapsed * 12)) * 0.08 : 0;
    const fighting = this.state === 'boss' || this.groups.some((g) => g.alive && Math.abs(p.z - g.z) < 7);
    this.swing += dt * (fighting ? 14 : 4);
    this.hero.swordPivot.rotation.z = fighting ? -0.5 - Math.max(0, Math.sin(this.swing)) * 1.6 : -0.5 + Math.sin(this.swing) * 0.15;
    this.hero.swordPivot.rotation.x = fighting ? Math.sin(this.swing * 0.5) * 0.6 : 0;
    this.hero.capeMesh.rotation.x = 0.25 + Math.sin(this.elapsed * 9) * 0.1 + (running ? 0.35 : 0);
    h.visible = this.squad.count > 0;
  }

  updateCamera(snap) {
    const p = this.player;
    const boss = this.state === 'boss' || this.state === 'won';
    const tx = p.x * 0.35;
    const ty = boss ? 7 : 8.2;
    const tz = p.z + (boss ? 10 : 11.5);
    if (snap) this.camera.position.set(tx, ty, tz);
    else this.camera.position.lerp(_v.set(tx, ty, tz), 0.12);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= 0.86;
    }
    this.camera.lookAt(p.x * 0.35, 1.0, p.z - (boss ? 7 : 10));
  }

  // ---------- floating text ----------

  float(text, x, y, z, color, height = 1) {
    const sprite = makeTextSprite(text, { color }, height);
    sprite.position.set(x, y, z);
    this.scene.add(sprite);
    this.floaters.push({ sprite, ttl: 1.1 });
  }

  updateFloaters(dt) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.ttl -= dt;
      f.sprite.position.y += dt * 1.6;
      f.sprite.material.opacity = Math.min(1, f.ttl * 2);
      if (f.ttl <= 0) {
        this.scene.remove(f.sprite);
        f.sprite.material.map.dispose();
        f.sprite.material.dispose();
        this.floaters.splice(i, 1);
      }
    }
  }

  pushHud() {
    const count = Math.max(0, Math.ceil(this.squad.count));
    const power = displayPower(this.squad, this.stats.power);
    const key = `${count}|${this.coinsCollected}|${power}|${this.squad.tier}|${this.squad.hero}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.hooks.onHud?.({ count, coins: this.coinsCollected, power, tier: this.squad.tier, hero: this.squad.hero });
  }
}

function makeSlabTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9dde3';
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#c9ced6';
  ctx.fillRect(0, 0, 128, 3);
  ctx.fillRect(0, 0, 3, 256);
  ctx.fillStyle = '#e4e7ec';
  ctx.fillRect(56, 100, 16, 56);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
