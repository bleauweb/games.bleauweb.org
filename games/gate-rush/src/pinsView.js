// Draws a treasure room on a 2D canvas and turns taps on pins into pulls.
import { parseRoom, step, pull, POTION } from './pins.js';

const STEP_MS = 150;

export class PinRoom {
  /** opts: { onSound(name), onUpdate(state, done) } */
  constructor(canvas, def, opts = {}) {
    this.canvas = canvas;
    this.def = def;
    this.opts = opts;
    this.state = parseRoom(def);
    this.pullAnims = new Map(); // pin index -> start time
    this.pops = []; // {x, y, text, color, t}
    this.busy = false;
    this.done = false;
    this.t0 = performance.now();
    this.onPointer = (e) => this.tap(e);
    canvas.addEventListener('pointerdown', this.onPointer);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    this.settleAnimated();
    this.raf = requestAnimationFrame(() => this.draw());
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.ro.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointer);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 400;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
    this.cell = Math.floor(Math.min(w / this.state.w, h / this.state.h));
    this.ox = Math.floor((w - this.cell * this.state.w) / 2);
    this.oy = Math.floor((h - this.cell * this.state.h) / 2);
  }

  // ---------- interaction ----------

  tap(e) {
    if (this.busy || this.done) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const c = this.cell;
    let best = -1;
    let bestD = 24; // CSS px tolerance
    this.state.pins.forEach((p, i) => {
      if (p.pulled) return;
      const y = this.oy + p.y * c;
      const x0 = this.ox + p.x0 * c - c * 0.5;
      const x1 = this.ox + (p.x1 + 1) * c + c * 0.5;
      const dx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0;
      const d = Math.hypot(dx, py - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) return;
    pull(this.state, best);
    this.pullAnims.set(best, performance.now());
    this.opts.onSound?.('pin');
    this.settleAnimated();
  }

  settleAnimated() {
    this.busy = true;
    const tick = () => {
      const moved = step(this.state);
      this.consumeEvents();
      this.opts.onUpdate?.(this.state, false);
      if (moved) this.timer = setTimeout(tick, STEP_MS);
      else {
        this.busy = false;
        const allPulled = this.state.pins.every((p) => p.pulled);
        if (!this.state.hero.alive || allPulled) this.done = true;
        this.opts.onUpdate?.(this.state, this.done);
      }
    };
    this.timer = setTimeout(tick, STEP_MS);
  }

  consumeEvents() {
    for (const ev of this.state.events) {
      const sfx = { gold: 'coin', potion: 'potion', kill: 'groupDown', death: 'lose', steam: 'splash', burn: 'burn' }[ev.type];
      if (sfx) this.opts.onSound?.(sfx);
      const text = { gold: 'GOLD!', potion: `+${POTION}`, kill: `+${Math.floor((ev.power || 0) / 2)}`, death: ev.by === 'lava' ? 'BURNED' : 'CRUSHED', steam: 'SSSS', burn: 'BURNED' }[ev.type];
      if (text) this.pops.push({ x: ev.x, y: ev.y, text, color: ev.type === 'death' || ev.type === 'burn' ? '#ff6b6b' : ev.type === 'steam' ? '#cfe8ff' : '#ffd84d', t: performance.now() });
    }
    this.state.events.length = 0;
  }

  // ---------- drawing ----------

  draw() {
    this.raf = requestAnimationFrame(() => this.draw());
    const ctx = this.canvas.getContext('2d');
    const { cell: c, ox, oy, state: s } = this;
    const now = performance.now();
    const time = (now - this.t0) / 1000;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const px = ox + x * c;
        const py = oy + y * c;
        const t = s.cells[y][x].t;
        if (t === '#') this.wall(ctx, px, py, c);
        else {
          ctx.fillStyle = '#2a2140';
          ctx.fillRect(px, py, c, c);
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(px, py, c, 2);
        }
      }
    }
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const cell = s.cells[y][x];
        const px = ox + x * c;
        const py = oy + y * c;
        switch (cell.t) {
          case 'L':
            this.lava(ctx, px, py, c, time, x + y);
            break;
          case 'W':
            this.water(ctx, px, py, c, time, x + y);
            break;
          case 'S':
            this.stone(ctx, px, py, c);
            break;
          case 'G':
            this.gold(ctx, px, py, c);
            break;
          case 'P':
            this.potion(ctx, px, py, c);
            break;
          case 'M':
            this.monster(ctx, px, py, c, cell.power, time);
            break;
          default:
            break;
        }
      }
    }
    this.heroDraw(ctx, ox + s.hero.x * c, oy + s.hero.y * c, c, s.hero, time);

    for (let i = 0; i < s.pins.length; i++) this.pin(ctx, s.pins[i], i, now);

    this.pops = this.pops.filter((p) => now - p.t < 900);
    for (const p of this.pops) {
      const k = (now - p.t) / 900;
      ctx.globalAlpha = 1 - k;
      ctx.font = `800 ${Math.max(14, c * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.fillStyle = p.color;
      const tx = ox + p.x * c + c / 2;
      const ty = oy + p.y * c + c * 0.4 - k * c * 0.8;
      ctx.strokeText(p.text, tx, ty);
      ctx.fillText(p.text, tx, ty);
      ctx.globalAlpha = 1;
    }
  }

  wall(ctx, x, y, c) {
    ctx.fillStyle = '#5b6478';
    ctx.fillRect(x, y, c, c);
    ctx.fillStyle = '#6e788e';
    ctx.fillRect(x + 2, y + 2, c - 4, c * 0.45 - 3);
    ctx.fillRect(x + 2, y + c * 0.5 + 1, c * 0.48 - 3, c * 0.5 - 3);
    ctx.fillRect(x + c * 0.52 + 1, y + c * 0.5 + 1, c * 0.48 - 3, c * 0.5 - 3);
  }

  lava(ctx, x, y, c, t, seed) {
    ctx.fillStyle = '#ff5a1f';
    ctx.fillRect(x, y, c, c);
    ctx.fillStyle = '#ffb347';
    for (let i = 0; i < 3; i++) {
      const bx = x + ((seed * 37 + i * 53) % 80) / 100 * c;
      const by = y + c * 0.3 + Math.sin(t * 3 + seed + i * 2) * c * 0.2 + i * c * 0.2;
      ctx.beginPath();
      ctx.arc(bx + c * 0.1, by, c * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  water(ctx, x, y, c, t, seed) {
    ctx.fillStyle = '#3b8bea';
    ctx.fillRect(x, y, c, c);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const wx = x + (i / 4) * c;
      const wy = y + c * 0.3 + Math.sin(t * 4 + seed + i) * c * 0.06;
      if (i === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  }

  stone(ctx, x, y, c) {
    ctx.fillStyle = '#3f4452';
    ctx.fillRect(x + 1, y + 1, c - 2, c - 2);
    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(x + c * 0.2, y + c * 0.3, c * 0.25, c * 0.2);
    ctx.fillRect(x + c * 0.55, y + c * 0.6, c * 0.2, c * 0.15);
  }

  gold(ctx, x, y, c) {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 2 ? '#ffe066' : '#ffc83d';
      ctx.beginPath();
      ctx.ellipse(x + c / 2, y + c * (0.78 - i * 0.14), c * 0.36, c * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b98400';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  potion(ctx, x, y, c) {
    ctx.fillStyle = '#c77dff';
    ctx.beginPath();
    ctx.arc(x + c / 2, y + c * 0.62, c * 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e9d5ff';
    ctx.fillRect(x + c * 0.42, y + c * 0.18, c * 0.16, c * 0.25);
    ctx.fillStyle = '#5a3a9c';
    ctx.fillRect(x + c * 0.38, y + c * 0.12, c * 0.24, c * 0.08);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x + c * 0.4, y + c * 0.55, c * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  monster(ctx, x, y, c, power, t) {
    const bob = Math.sin(t * 5 + x) * c * 0.03;
    ctx.fillStyle = '#d93b3b';
    ctx.beginPath();
    ctx.ellipse(x + c / 2, y + c * 0.58 + bob, c * 0.36, c * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5e6c8';
    ctx.beginPath();
    ctx.moveTo(x + c * 0.25, y + c * 0.32 + bob);
    ctx.lineTo(x + c * 0.18, y + c * 0.08 + bob);
    ctx.lineTo(x + c * 0.38, y + c * 0.3 + bob);
    ctx.moveTo(x + c * 0.75, y + c * 0.32 + bob);
    ctx.lineTo(x + c * 0.82, y + c * 0.08 + bob);
    ctx.lineTo(x + c * 0.62, y + c * 0.3 + bob);
    ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(x + c * 0.4, y + c * 0.5 + bob, c * 0.06, 0, Math.PI * 2);
    ctx.arc(x + c * 0.6, y + c * 0.5 + bob, c * 0.06, 0, Math.PI * 2);
    ctx.fill();
    this.badge(ctx, x + c / 2, y + c * 0.98, c, String(power), '#ff8a8a');
  }

  heroDraw(ctx, x, y, c, hero, t) {
    if (!hero.alive) {
      ctx.fillStyle = '#777';
      ctx.font = `${c * 0.6}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('✕', x + c / 2, y + c * 0.7);
      return;
    }
    const bob = Math.sin(t * 4) * c * 0.02;
    ctx.fillStyle = '#f0b53a';
    ctx.fillRect(x + c * 0.32, y + c * 0.42 + bob, c * 0.36, c * 0.4);
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(x + c / 2, y + c * 0.32 + bob, c * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3a9c';
    ctx.beginPath();
    ctx.arc(x + c / 2, y + c * 0.27 + bob, c * 0.19, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ff4d6d';
    ctx.fillRect(x + c * 0.46, y + c * 0.02 + bob, c * 0.08, c * 0.14);
    ctx.strokeStyle = '#e8f0ff';
    ctx.lineWidth = Math.max(2, c * 0.06);
    ctx.beginPath();
    ctx.moveTo(x + c * 0.74, y + c * 0.7 + bob);
    ctx.lineTo(x + c * 0.9, y + c * 0.2 + bob);
    ctx.stroke();
    this.badge(ctx, x + c / 2, y + c * 0.98, c, String(hero.power), '#9be7ff');
  }

  badge(ctx, cx, cy, c, text, color) {
    ctx.font = `800 ${Math.max(11, c * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + c * 0.2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - c * 0.17, w, c * 0.3, c * 0.1);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy - c * 0.02);
    ctx.textBaseline = 'alphabetic';
  }

  pin(ctx, p, i, now) {
    const c = this.cell;
    let k = 0;
    if (p.pulled) {
      const start = this.pullAnims.get(i);
      k = start ? Math.min(1, (now - start) / 260) : 1;
      if (k >= 1) return;
    }
    const y = this.oy + p.y * c;
    const len = (p.x1 - p.x0 + 1) * c + c * 0.6;
    const x0 = this.ox + p.x0 * c - c * 0.6 - k * (len + c);
    ctx.globalAlpha = 1 - k * 0.6;
    ctx.fillStyle = '#9aa3b5';
    ctx.beginPath();
    ctx.roundRect(x0, y - c * 0.09, len + c * 0.3, c * 0.18, c * 0.09);
    ctx.fill();
    ctx.fillStyle = '#e4e8f0';
    ctx.fillRect(x0 + c * 0.2, y - c * 0.04, len - c * 0.1, c * 0.05);
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath();
    ctx.arc(x0, y, c * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b98400';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
