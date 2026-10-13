// A small synthesized piano so every answer is also heard. No samples, works offline.
import { freq } from './music.js';

class TrainerAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  /** A plucked-piano-ish note at a MIDI number. */
  note(midi, { dur = 1.4, vol = 0.35, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const f = freq(midi);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(this.master);
    const partials = [
      [1, 1, 'triangle'],
      [2, 0.35, 'sine'],
      [3, 0.12, 'sine'],
      [4, 0.06, 'sine'],
    ];
    for (const [mult, amp, type] of partials) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(amp, t0);
      g.gain.exponentialRampToValueAtTime(amp * 0.05, t0 + dur * (1 / mult));
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
  }

  good() {
    this.blip(1320, 0.07, 0.08);
  }

  bad() {
    this.blip(180, 0.25, 0.12, 'sawtooth');
  }

  blip(f, dur, vol, type = 'triangle') {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  fanfare() {
    [60, 64, 67, 72].forEach((m, i) => this.note(m, { dur: 0.9, vol: 0.25, delay: i * 0.12 }));
  }
}

export const audio = new TrainerAudio();
