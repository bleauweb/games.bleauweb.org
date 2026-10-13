// Pitch detection in the browser: which note is being played into the microphone.
// detectPitch() is pure (McLeod-style normalised autocorrelation) so it can be tested in Node;
// PitchListener wires it to getUserMedia and turns a stream of pitches into note events.

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function freqToMidi(freq, a4 = 440) {
  return 69 + 12 * Math.log2(freq / a4);
}

export function midiToFreq(midi, a4 = 440) {
  return a4 * 2 ** ((midi - 69) / 12);
}

export function midiName(midi) {
  const m = Math.round(midi);
  return `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

export function centsOff(freq, midi, a4 = 440) {
  return 1200 * Math.log2(freq / midiToFreq(midi, a4));
}

/**
 * Estimate the fundamental frequency of a buffer of samples.
 * Returns { freq, clarity, rms }; freq is 0 when nothing periodic is found.
 */
export function detectPitch(buf, sampleRate, { minFreq = 70, maxFreq = 2500, minRms = 0.004 } = {}) {
  const n = buf.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / n);
  if (rms < minRms) return { freq: 0, clarity: 0, rms };

  const maxLag = Math.min(n - 2, Math.floor(sampleRate / minFreq));
  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  // Start from lag 1 so the opening lobe (which always begins at 1.0) is recognised and
  // skipped properly, even when the tone's period is close to minLag.
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let acf = 0;
    let m = 0;
    for (let i = 0, j = lag; j < n; i++, j++) {
      const a = buf[i];
      const b = buf[j];
      acf += a * b;
      m += a * a + b * b;
    }
    nsdf[lag] = m > 0 ? (2 * acf) / m : 0;
  }

  // Key maxima: the highest point of each positive run after the first negative crossing.
  const peaks = [];
  let lag = 1;
  while (lag <= maxLag && nsdf[lag] > 0) lag++; // skip the opening lobe
  while (lag <= maxLag) {
    while (lag <= maxLag && nsdf[lag] <= 0) lag++;
    let best = -1;
    let bestVal = 0;
    while (lag <= maxLag && nsdf[lag] > 0) {
      if (nsdf[lag] > bestVal) {
        bestVal = nsdf[lag];
        best = lag;
      }
      lag++;
    }
    if (best >= minLag) peaks.push([best, bestVal]);
  }
  if (!peaks.length) return { freq: 0, clarity: 0, rms };
  let highest = 0;
  for (const [, v] of peaks) highest = Math.max(highest, v);
  const threshold = 0.85 * highest;
  const [pick, clarity] = peaks.find(([, v]) => v >= threshold);

  // Parabolic interpolation around the chosen lag for sub-sample precision.
  let refined = pick;
  if (pick > minLag && pick < maxLag) {
    const y0 = nsdf[pick - 1];
    const y1 = nsdf[pick];
    const y2 = nsdf[pick + 1];
    const denom = y0 - 2 * y1 + y2;
    if (Math.abs(denom) > 1e-9) refined = pick + (0.5 * (y0 - y2)) / denom;
  }
  return { freq: sampleRate / refined, clarity, rms };
}

/**
 * Listens to the microphone and reports pitches and note onsets.
 * opts: { onPitch({freq, midi, cents, clarity, rms}), onNote(midi), onState(state),
 *         a4 = 440, minClarity = 0.9, minRms = 0.01, holdFrames = 3 }
 */
export class PitchListener {
  constructor(opts = {}) {
    this.opts = { a4: 440, minClarity: 0.9, minRms: 0.01, holdFrames: 3, ...opts };
    this.running = false;
    this.candidate = null;
    this.count = 0;
    this.lastEmitted = null;
    this.quiet = 0;
    this.envPeak = 0;
    this.dipped = false;
  }

  get supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));
  }

  async start() {
    if (this.running) return true;
    if (!this.supported) throw new Error('This browser cannot use the microphone here. Microphone input needs HTTPS or localhost.');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.source.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.running = true;
    this.opts.onState?.('on');
    const loop = () => {
      if (!this.running) return;
      this.tick();
      this.raf = requestAnimationFrame(loop);
    };
    loop();
    return true;
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
    this.candidate = null;
    this.lastEmitted = null;
    this.opts.onState?.('off');
  }

  setA4(a4) {
    this.opts.a4 = a4;
  }

  tick() {
    this.analyser.getFloatTimeDomainData(this.buf);
    const { freq, clarity, rms } = detectPitch(this.buf, this.ctx.sampleRate);
    const o = this.opts;
    // Envelope: a dip and recovery in level means the same note was tongued again.
    this.envPeak = Math.max(rms, this.envPeak * 0.94);
    if (rms < this.envPeak * 0.35) this.dipped = true;

    if (freq > 0 && clarity >= o.minClarity && rms >= o.minRms) {
      const midiF = freqToMidi(freq, o.a4);
      const m = Math.round(midiF);
      o.onPitch?.({ freq, midi: midiF, nearest: m, cents: (midiF - m) * 100, clarity, rms });
      this.quiet = 0;
      if (m === this.candidate) this.count++;
      else {
        this.candidate = m;
        this.count = 1;
      }
      if (this.count === o.holdFrames && (m !== this.lastEmitted || this.dipped)) {
        this.lastEmitted = m;
        this.dipped = false;
        o.onNote?.(m);
      }
    } else {
      o.onPitch?.({ freq: 0, midi: null, nearest: null, cents: 0, clarity, rms });
      this.candidate = null;
      this.count = 0;
      if (++this.quiet > 8) {
        this.lastEmitted = null;
        this.dipped = false;
      }
    }
  }
}
