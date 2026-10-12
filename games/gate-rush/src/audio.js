// All sound is synthesized: no files to load, works offline, and the whole game stays one bundle.
class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.lastShot = 0;
    this.lastHit = 0;
  }

  /** Call from a user gesture; browsers refuse to start audio otherwise. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.45;
  }

  tone({ freq = 440, to = null, type = 'square', dur = 0.1, vol = 0.2, delay = 0, attack = 0.005 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.15, vol = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  shoot() {
    const now = performance.now();
    if (now - this.lastShot < 70) return;
    this.lastShot = now;
    this.tone({ freq: 1100 + Math.random() * 300, to: 350, type: 'square', dur: 0.05, vol: 0.035 });
  }

  enemyShoot() {
    const now = performance.now();
    if (now - this.lastHit < 90) return;
    this.lastHit = now;
    this.tone({ freq: 240, to: 90, type: 'sawtooth', dur: 0.08, vol: 0.05 });
  }

  gateGood() {
    [523, 659, 784].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.14, vol: 0.18, delay: i * 0.06 }));
  }

  gateBad() {
    this.tone({ freq: 380, to: 140, type: 'sawtooth', dur: 0.3, vol: 0.16 });
  }

  coin() {
    this.tone({ freq: 1320, type: 'triangle', dur: 0.08, vol: 0.12 });
    this.tone({ freq: 1980, type: 'triangle', dur: 0.14, vol: 0.12, delay: 0.07 });
  }

  groupDown() {
    this.noise({ dur: 0.25, vol: 0.25 });
    this.tone({ freq: 200, to: 60, type: 'square', dur: 0.25, vol: 0.12 });
  }

  bossShot() {
    this.tone({ freq: 140, to: 50, type: 'sawtooth', dur: 0.22, vol: 0.2 });
    this.noise({ dur: 0.12, vol: 0.12 });
  }

  bossDown() {
    this.noise({ dur: 0.7, vol: 0.4 });
    [100, 80, 60].forEach((f, i) => this.tone({ freq: f, to: 30, type: 'square', dur: 0.4, vol: 0.2, delay: i * 0.12 }));
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.2, delay: 0.35 + i * 0.11 }));
    this.tone({ freq: 1046, type: 'triangle', dur: 0.6, vol: 0.2, delay: 0.35 + 4 * 0.11 });
  }

  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone({ freq: f, type: 'sawtooth', dur: 0.3, vol: 0.14, delay: i * 0.18 }));
  }

  click() {
    this.tone({ freq: 700, type: 'triangle', dur: 0.05, vol: 0.08 });
  }
}

export const audio = new GameAudio();
