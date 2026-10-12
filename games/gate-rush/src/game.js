// The 3D game: a squad runs down a lane, picks gates, shoots enemies, fights a boss.
// All of the balance math lives in combat.js so the level generator agrees with what you see.
import * as THREE from 'three';
import {
  RUN_SPEED, PLAYER_RANGE, ENEMY_RANGE, BOSS_STAND_OFF, BOSS_TELEGRAPH,
  playerFire, enemyFire, applyGate, gateIsGood, gateLabel,
} from './combat.js';
import { PLAYER_START_Z } from './level.js';
import { makeTextSprite, updateTextSprite, makeTextPlane, updateTextPlane, BarSprite } from './text.js';
import { BulletPool, ParticlePool } from './pools.js';
import { audio } from './audio.js';

const LANE_HALF = 3.5; // lane edge
const PLAYER_X_MAX = 2.4; // where the squad centre may go
const MAX_SOLDIERS = 220;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const COLORS = {
  bg: 0x0f1626,
  ground: 0x121a2e,
  lane: 0x1c2a4a,
  laneStripe: 0x27396a,
  curb: 0x3b4f85,
  player: 0x5aa0ff,
  enemy: 0xff4d4d,
  good: 0x3ddc84,
  bad: 0xff5c5c,
  coin: 0xffc83d,
  playerBullet: 0xfff1a8,
  enemyBullet: 0xff8a8a,
};

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler();

export class Game {
  /**
   * @param {HTMLElement} container element the canvas is added to; also receives input
   * @param {{onHud?: Function, onEnd?: Function}} hooks
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
    this.scene.background = new THREE.Color(COLORS.bg);
    this.scene.fog = new THREE.Fog(COLORS.bg, 45, 100);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 220);
    this.shake = 0;

    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2a3350, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(6, 14, 8);
    this.scene.add(sun);

    this.world = new THREE.Group(); // per-level stuff, rebuilt every level
    this.scene.add(this.world);

    this.bullets = new BulletPool(400);
    this.particles = new ParticlePool(320);
    this.scene.add(this.bullets.mesh, this.particles.mesh);

    const soldierGeo = new THREE.CapsuleGeometry(0.22, 0.42, 4, 10);
    this.soldierGeo = soldierGeo;
    this.soldiers = new THREE.InstancedMesh(
      soldierGeo,
      new THREE.MeshStandardMaterial({ color: COLORS.player, roughness: 0.55, metalness: 0.05 }),
      MAX_SOLDIERS,
    );
    this.soldiers.frustumCulled = false;
    this.scene.add(this.soldiers);
    this.enemyMat = new THREE.MeshStandardMaterial({ color: COLORS.enemy, roughness: 0.6 });

    this.countLabel = makeTextSprite('0', { color: '#dbe9ff' }, 1.1);
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
    this.lastHudCount = -1;
    this.player = { x: 0, targetX: 0, z: PLAYER_START_Z, count: level.start + stats.startBonus };
    this.peak = this.player.count;
    this.buildWorld(level);
    this.updateCamera(true);
    this.pushHud();
  }

  clearWorld() {
    this.world.traverse((o) => {
      if (o.geometry && o.geometry !== this.soldierGeo) o.geometry.dispose();
      if (o.material && o.material !== this.enemyMat) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
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
    const length = PLAYER_START_Z - level.endZ + 40;
    const midZ = (PLAYER_START_Z + level.endZ) / 2;

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, length + 200), new THREE.MeshStandardMaterial({ color: COLORS.ground, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, midZ);
    this.world.add(ground);

    const laneTex = makeLaneTexture();
    laneTex.repeat.set(1, length / 6);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_HALF * 2, length), new THREE.MeshStandardMaterial({ map: laneTex, roughness: 0.9 }));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, 0, midZ);
    this.world.add(lane);

    const curbMat = new THREE.MeshStandardMaterial({ color: COLORS.curb, emissive: COLORS.curb, emissiveIntensity: 0.25, roughness: 0.7 });
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, length), curbMat);
      curb.position.set(side * (LANE_HALF + 0.2), 0.2, midZ);
      this.world.add(curb);
    }

    // Side scenery: a scatter of dark pyramids and blocks for a sense of speed.
    const scatter = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.4, 4), new THREE.MeshStandardMaterial({ color: 0x1f2d52, roughness: 1, flatShading: true }), 90);
    scatter.frustumCulled = false;
    for (let i = 0; i < 90; i++) {
      const side = i % 2 ? 1 : -1;
      const sx = side * (6 + Math.random() * 12);
      const sz = PLAYER_START_Z + 10 - (i / 90) * (length + 20);
      const sc = 0.7 + Math.random() * 1.8;
      _m.compose(_v.set(sx, sc * 1.2 - 0.2, sz), _q.setFromEuler(_e.set(0, Math.random() * Math.PI, 0)), _s.set(sc, sc, sc));
      scatter.setMatrixAt(i, _m);
    }
    this.world.add(scatter);
    _s.set(1, 1, 1);

    // Finish arena marker.
    const pad = new THREE.Mesh(new THREE.CircleGeometry(5, 40), new THREE.MeshStandardMaterial({ color: 0x2b1a2a, emissive: 0x4a1020, emissiveIntensity: 0.6, roughness: 1 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.01, level.boss.z);
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
      const good = gateIsGood(gate);
      const color = good ? COLORS.good : COLORS.bad;
      const g = new THREE.Group();
      g.position.set(x, 1.2, row.z);
      const frameMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4 });
      const w = 2.9;
      const h = 2.4;
      const t = 0.14;
      for (const [sx, sy, px, py] of [[w, t, 0, h / 2], [w, t, 0, -h / 2], [t, h, -w / 2, 0], [t, h, w / 2, 0]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, t), frameMat);
        bar.position.set(px, py, 0);
        g.add(bar);
      }
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w - t, h - t), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
      g.add(panel);
      const label = makeTextPlane(gateLabel(gate), { color: '#ffffff' }, 1.2);
      label.position.set(0, 0.35, 0.06);
      g.add(label);
      const preview = makeTextPlane('', { color: good ? '#c9ffe0' : '#ffd0d0' }, 0.62);
      preview.position.set(0, -0.62, 0.06);
      g.add(preview);
      this.world.add(g);
      return { gate, group: g, panel, frameMat, preview, x };
    };
    this.gates.push({ z: row.z, left: make(row.left, -1.7), right: make(row.right, 1.7), done: false, anim: 0 });
  }

  buildEnemyGroup(row) {
    const cap = Math.min(row.count, 120);
    const mesh = new THREE.InstancedMesh(this.soldierGeo, this.enemyMat, cap);
    mesh.frustumCulled = false;
    const spots = [];
    const spread = row.halfWidth > 2 ? 1.15 : 0.9;
    for (let i = 0; i < cap; i++) {
      const r = 0.42 * Math.sqrt(i);
      const a = i * GOLDEN;
      spots.push(new THREE.Vector3(row.x + Math.cos(a) * r * spread, 0.44, row.z + Math.sin(a) * r * 0.8));
    }
    for (let i = 0; i < cap; i++) {
      _m.compose(spots[i], _q.identity(), _s);
      mesh.setMatrixAt(i, _m);
    }
    this.world.add(mesh);
    const label = makeTextSprite(String(row.count), { color: '#ffd0d0' }, 1.0);
    label.position.set(row.x, 1.9 + 0.3 * Math.sqrt(cap) * 0.3, row.z);
    this.world.add(label);
    this.groups.push({ row, mesh, spots, cap, label, countF: row.count, shown: row.count, alive: true });
  }

  buildCoins(row) {
    const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.09, 18);
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.coin, emissive: 0x7a5a00, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.35 });
    for (const p of row.positions) {
      const pivot = new THREE.Group();
      pivot.position.set(p.x, 0.75, p.z);
      const coin = new THREE.Mesh(geo, mat);
      coin.rotation.x = Math.PI / 2;
      pivot.add(coin);
      this.world.add(pivot);
      this.coins.push({ x: p.x, z: p.z, pivot, taken: false });
    }
  }

  buildBoss(boss) {
    const g = new THREE.Group();
    g.position.set(0, 0, boss.z);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd93b3b, emissive: 0x4a0000, emissiveIntensity: 0.6, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.25, 1.5, 6, 14), bodyMat);
    body.position.y = 2.0;
    g.add(body);
    const crownMat = new THREE.MeshStandardMaterial({ color: COLORS.coin, emissive: 0x5a3a00, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.3 });
    for (let i = 0; i < 6; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 5), crownMat);
      const a = (i / 6) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.8, 4.15, Math.sin(a) * 0.8);
      g.add(spike);
    }
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    for (const sx of [-0.45, 0.45]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), eyeMat);
      eye.position.set(sx, 2.5, 1.1);
      g.add(eye);
    }
    const bar = new BarSprite(4.2, 0.7);
    bar.sprite.position.set(0, 4.6, 0);
    bar.set(1, `HP ${boss.hp}`);
    g.add(bar.sprite);
    this.world.add(g);
    this.boss = { def: boss, group: g, body, bodyMat, bar, hp: boss.hp, stood: 0, shotTimer: 0, flash: 0, dead: false };
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
      this.player.targetX = clamp(this.player.targetX + (dx / width) * 7.5, -PLAYER_X_MAX, PLAYER_X_MAX);
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

    if (active && p.count <= 0) this.lose();

    this.updateGateAnims(dt);
    this.updateSoldiers();
    this.updateCamera(false);
    this.animateCoins(dt);
    this.pushHud();

    if (this.state === 'won' || this.state === 'lost') {
      this.endTimer += dt / this.timeScale;
      this.timeScale += (1 - this.timeScale) * Math.min(1, dt * 2);
      if (this.endTimer > (this.state === 'won' ? 1.9 : 1.3) && !this.ended) {
        this.ended = true;
        this.hooks.onEnd?.({
          won: this.state === 'won',
          remaining: Math.max(0, Math.ceil(this.player.count)),
          enteredBossWith: this.enteredBossWith,
          peak: this.peak,
          coins: this.coinsCollected,
          level: this.level.n,
        });
      }
    }
  }

  // ---------- gates ----------

  updateGates() {
    const p = this.player;
    const next = this.gates.find((g) => !g.done);
    if (!next) return;
    const count = Math.ceil(p.count);
    const chosenRight = p.x >= 0;
    for (const side of [next.left, next.right]) {
      const sel = (side === next.right) === chosenRight;
      side.panel.material.opacity = sel ? 0.62 : 0.22;
      side.frameMat.emissiveIntensity = sel ? 1.1 : 0.35;
      if (next.z > p.z - 60) updateTextPlane(side.preview, `= ${applyGate(count, side.gate)}`);
    }
    if (p.z <= next.z) {
      next.done = true;
      const side = chosenRight ? next.right : next.left;
      const before = count;
      p.count = applyGate(count, side.gate);
      this.peak = Math.max(this.peak, p.count);
      const good = p.count >= before;
      const delta = p.count - before;
      this.float(`${delta >= 0 ? '+' : ''}${delta}`, p.x, 2.2, p.z, good ? '#3ddc84' : '#ff7a7a', 1.3);
      this.particles.burst(_v.set(side.x, 1.2, next.z), { count: 18, color: good ? COLORS.good : COLORS.bad, speed: 7, up: 4 });
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
      if (Math.abs(c.z - p.z) < 0.9 && Math.abs(c.x - p.x) < 1.35) {
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
      const d = p.z - g.row.z; // distance ahead (positive while in front of us)
      if (d <= PLAYER_RANGE && d > -2 && d < targetD) {
        target = g;
        targetD = d;
      }
    }
    for (const g of this.groups) {
      if (!g.alive) continue;
      const d = p.z - g.row.z;
      const inPath = Math.abs(p.x - g.row.x) < g.row.halfWidth + 0.7;
      if (g === target) {
        g.countF -= playerFire(p.count, this.stats.power) * dt;
        this.spawnPlayerShots(g, dt);
      }
      if (d <= ENEMY_RANGE && d > -4) {
        p.count -= enemyFire(g.countF) * this.stats.armor * dt;
        this.spawnEnemyShots(g, dt);
      }
      if (inPath && d <= 1.0 && d > -1.5) {
        blocked = true;
        p.z = Math.max(p.z, g.row.z + 0.9);
      }
      this.refreshGroup(g);
    }
    return blocked;
  }

  refreshGroup(g) {
    const shown = Math.max(0, Math.ceil(g.countF));
    if (shown === g.shown) return;
    for (let i = shown; i < g.shown && i < g.cap; i++) {
      this.particles.burst(g.spots[Math.min(i, g.cap - 1)], { count: 3, color: COLORS.enemy, speed: 3, up: 2.5, scale: 0.7 });
    }
    g.shown = shown;
    g.mesh.count = Math.min(shown, g.cap);
    updateTextSprite(g.label, String(shown));
    if (shown <= 0) {
      g.alive = false;
      g.mesh.visible = false;
      g.label.visible = false;
      this.particles.burst(_v.set(g.row.x, 0.8, g.row.z), { count: 24, color: COLORS.enemy, speed: 8, up: 5 });
      audio.groupDown();
      this.shake = Math.max(this.shake, 0.18);
    }
  }

  spawnPlayerShots(g, dt) {
    const rate = clamp(playerFire(this.player.count, this.stats.power) * 1.4, 6, 36);
    this.shotAcc = (this.shotAcc || 0) + rate * dt;
    while (this.shotAcc >= 1) {
      this.shotAcc -= 1;
      const from = this.soldierSpot(Math.floor(Math.random() * Math.min(Math.ceil(this.player.count), MAX_SOLDIERS)));
      from.y = 0.7;
      const to = g.spots[Math.floor(Math.random() * Math.max(1, Math.min(g.shown, g.cap)))].clone();
      to.y = 0.6;
      this.bullets.fire(from, to, { color: COLORS.playerBullet, speed: 50, scale: 0.9 });
      audio.shoot();
    }
  }

  spawnEnemyShots(g, dt) {
    const rate = clamp(enemyFire(g.countF) * 2, 3, 24);
    g.shotAcc = (g.shotAcc || 0) + rate * dt;
    while (g.shotAcc >= 1) {
      g.shotAcc -= 1;
      const from = g.spots[Math.floor(Math.random() * Math.max(1, Math.min(g.shown, g.cap)))].clone();
      from.y = 0.7;
      const to = this.soldierSpot(Math.floor(Math.random() * Math.min(Math.ceil(this.player.count), MAX_SOLDIERS)));
      to.y = 0.6;
      this.bullets.fire(from, to, {
        color: COLORS.enemyBullet,
        speed: 30,
        scale: 1.1,
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
    if (d <= PLAYER_RANGE) this.hitBoss(playerFire(p.count, this.stats.power) * dt, dt);
    if (d <= BOSS_STAND_OFF) {
      p.z = b.def.z + BOSS_STAND_OFF;
      this.state = 'boss';
      this.enteredBossWith = Math.ceil(p.count);
      b.stood = 0;
    }
  }

  updateBossFight(dt) {
    const b = this.boss;
    const p = this.player;
    b.stood += dt;
    this.hitBoss(playerFire(p.count, this.stats.power) * dt, dt);
    if (b.dead) return;
    if (b.stood >= BOSS_TELEGRAPH) {
      p.count -= b.def.dps * this.stats.armor * dt;
      b.shotTimer -= dt;
      if (b.shotTimer <= 0) {
        b.shotTimer = 0.3;
        const from = _v.set(0, 2.4, b.def.z).clone();
        const to = this.soldierSpot(Math.floor(Math.random() * Math.min(Math.ceil(p.count), MAX_SOLDIERS)));
        to.y = 0.6;
        this.bullets.fire(from, to, {
          color: 0xff6a3d,
          speed: 32,
          scale: 2.4,
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
    b.bodyMat.emissiveIntensity = 0.6 + b.flash * 2;
    b.bar.set(Math.max(0, b.hp / b.def.hp), `HP ${Math.max(0, Math.ceil(b.hp))}`);
    this.bossShotAcc = (this.bossShotAcc || 0) + clamp(playerFire(this.player.count, this.stats.power) * 1.4, 6, 36) * dt;
    while (this.bossShotAcc >= 1) {
      this.bossShotAcc -= 1;
      const from = this.soldierSpot(Math.floor(Math.random() * Math.min(Math.ceil(this.player.count), MAX_SOLDIERS)));
      from.y = 0.7;
      const to = _v2.set((Math.random() - 0.5) * 1.6, 1.4 + Math.random() * 1.6, b.def.z + 0.6).clone();
      this.bullets.fire(from, to, { color: COLORS.playerBullet, speed: 50, scale: 0.9 });
      audio.shoot();
    }
    if (b.hp <= 0) {
      b.dead = true;
      b.group.visible = false;
      this.particles.burst(_v.set(0, 2, b.def.z), { count: 90, color: 0xd93b3b, speed: 14, up: 9, scale: 1.6 });
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
    this.player.count = 0;
    this.state = 'lost';
    this.ended = false;
    this.particles.burst(_v.set(this.player.x, 0.8, this.player.z), { count: 40, color: COLORS.player, speed: 8, up: 5 });
    audio.lose();
    this.shake = 0.5;
    this.timeScale = 0.5;
  }

  // ---------- squad rendering ----------

  soldierSpot(i, out = new THREE.Vector3()) {
    const r = 0.42 * Math.sqrt(i);
    const a = i * GOLDEN;
    return out.set(this.player.x + Math.cos(a) * r, 0.44, this.player.z + Math.sin(a) * r * 0.8);
  }

  updateSoldiers() {
    const p = this.player;
    const n = Math.min(Math.max(0, Math.ceil(p.count)), MAX_SOLDIERS);
    const running = this.state === 'running';
    const lean = running ? -0.18 : 0;
    const sway = (p.targetX - p.x) * 0.25;
    _q.setFromEuler(_e.set(lean, 0, -sway));
    for (let i = 0; i < n; i++) {
      this.soldierSpot(i, _v);
      const phase = this.elapsed * 15 + i * 1.7;
      _v.y += running ? Math.abs(Math.sin(phase)) * 0.09 : Math.sin(phase * 0.4) * 0.02;
      _m.compose(_v, _q, _s);
      this.soldiers.setMatrixAt(i, _m);
    }
    this.soldiers.count = n;
    this.soldiers.instanceMatrix.needsUpdate = true;
    const radius = 0.42 * Math.sqrt(Math.max(1, n));
    this.countLabel.position.set(p.x, 1.9 + radius * 0.25, p.z - radius * 0.4);
    this.countLabel.visible = p.count > 0;
    updateTextSprite(this.countLabel, String(Math.max(0, Math.ceil(p.count))));
  }

  updateCamera(snap) {
    const p = this.player;
    const boss = this.state === 'boss' || this.state === 'won';
    const tx = p.x * 0.35;
    const ty = boss ? 6.5 : 7.4;
    const tz = p.z + (boss ? 9 : 10.5);
    if (snap) this.camera.position.set(tx, ty, tz);
    else this.camera.position.lerp(_v.set(tx, ty, tz), 0.12);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= 0.86;
    }
    this.camera.lookAt(p.x * 0.35, 0.9, p.z - (boss ? 7 : 9));
  }

  // ---------- floating text ----------

  float(text, x, y, z, color, height = 1) {
    const sprite = makeTextSprite(text, { color }, height);
    sprite.position.set(x, y, z);
    this.scene.add(sprite);
    this.floaters.push({ sprite, ttl: 1.0 });
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
    const count = Math.max(0, Math.ceil(this.player.count));
    if (count === this.lastHudCount && this.coinsCollected === this.lastHudCoins) return;
    this.lastHudCount = count;
    this.lastHudCoins = this.coinsCollected;
    this.hooks.onHud?.({ count, coins: this.coinsCollected });
  }
}

function makeLaneTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#' + COLORS.lane.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#' + COLORS.laneStripe.toString(16).padStart(6, '0');
  ctx.fillRect(60, 20, 8, 90);
  ctx.fillRect(0, 0, 128, 3);
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
