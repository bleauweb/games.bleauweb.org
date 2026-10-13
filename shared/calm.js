// Calm settings shared by the pattern games: sound, motion, and a light calm palette.
// Stored once for the whole hub, so a player sets them a single time.
const KEY = 'bleauweb.calm.v1';

export function loadCalm() {
  const d = { sound: true, motion: true, theme: 'dark', text: 'normal' };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return d;
  }
}

export function saveCalm(c) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

export function applyCalm(c) {
  document.documentElement.dataset.theme = c.theme;
  document.documentElement.dataset.motion = c.motion ? 'on' : 'off';
  document.documentElement.dataset.text = c.text || 'normal';
}

/** Render the three switches into `el`; calls onChange(calm) after every change. */
export function calmControls(el, onChange) {
  const calm = loadCalm();
  applyCalm(calm);
  const render = () => {
    el.className = 'calm';
    el.innerHTML = `
      <span class="muted small">Settings:</span>
      <button class="chip ${calm.sound ? 'on' : ''}" data-k="sound">Sound ${calm.sound ? 'on' : 'off'}</button>
      <button class="chip ${calm.motion ? 'on' : ''}" data-k="motion">Motion ${calm.motion ? 'on' : 'off'}</button>
      <button class="chip ${calm.theme === 'calm' ? 'on' : ''}" data-k="theme">${calm.theme === 'calm' ? 'Calm colours' : 'Dark colours'}</button>
      <button class="chip ${calm.text === 'large' ? 'on' : ''}" data-k="text">${calm.text === 'large' ? 'Larger text' : 'Normal text'}</button>`;
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const k = b.dataset.k;
    if (k === 'theme') calm.theme = calm.theme === 'calm' ? 'dark' : 'calm';
    else if (k === 'text') calm.text = calm.text === 'large' ? 'normal' : 'large';
    else calm[k] = !calm[k];
    saveCalm(calm);
    applyCalm(calm);
    render();
    onChange?.(calm);
  });
  render();
  return calm;
}

/** A tiny, soft sound set that respects the sound switch. */
export function makeSounds(getCalm) {
  let ctx = null;
  const tone = (f, dur = 0.12, vol = 0.12, type = 'sine') => {
    if (!getCalm().sound) return;
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  };
  return {
    tap: () => tone(660, 0.06, 0.06),
    good: () => { tone(523, 0.12, 0.1); setTimeout(() => tone(784, 0.18, 0.1), 90); },
    gentle: () => tone(330, 0.2, 0.08, 'triangle'),
    done: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, 0.1), i * 110)),
    click: (f = 880) => tone(f, 0.04, 0.08, 'square'),
  };
}
