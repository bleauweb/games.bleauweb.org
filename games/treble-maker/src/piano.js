// One octave of piano keys to answer with. Reports the pitch class (0 = C … 11 = B).
const WHITE = [
  { letter: 'C', pc: 0 }, { letter: 'D', pc: 2 }, { letter: 'E', pc: 4 }, { letter: 'F', pc: 5 },
  { letter: 'G', pc: 7 }, { letter: 'A', pc: 9 }, { letter: 'B', pc: 11 },
];
const BLACK = [
  { name: 'C♯ D♭', pc: 1, after: 0 }, { name: 'D♯ E♭', pc: 3, after: 1 },
  { name: 'F♯ G♭', pc: 6, after: 3 }, { name: 'G♯ A♭', pc: 8, after: 4 }, { name: 'A♯ B♭', pc: 10, after: 5 },
];
const KEYMAP = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, 1: 1, 2: 3, 3: 6, 4: 8, 5: 10 };

export class Piano {
  constructor(root, { onKey, labels = true } = {}) {
    this.root = root;
    this.onKey = onKey;
    this.enabled = true;
    root.classList.add('piano');
    this.keys = new Map();
    WHITE.forEach((k, i) => {
      const b = document.createElement('button');
      b.className = 'key white';
      b.style.left = `${(i / 7) * 100}%`;
      b.innerHTML = `<span class="kl">${k.letter}</span>`;
      b.dataset.pc = k.pc;
      root.append(b);
      this.keys.set(k.pc, b);
    });
    BLACK.forEach((k) => {
      const b = document.createElement('button');
      b.className = 'key black';
      b.style.left = `${((k.after + 1) / 7) * 100}%`;
      b.innerHTML = `<span class="kl">${k.name.replace(' ', '<br>')}</span>`;
      b.dataset.pc = k.pc;
      root.append(b);
      this.keys.set(k.pc, b);
    });
    root.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.key');
      if (!b || !this.enabled) return;
      e.preventDefault();
      this.press(Number(b.dataset.pc));
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const pc = KEYMAP[e.key.toLowerCase()];
      if (pc !== undefined && this.enabled && this.root.offsetParent !== null) this.press(pc);
    });
    this.setLabels(labels);
  }

  press(pc) {
    const b = this.keys.get(pc);
    b.classList.add('down');
    setTimeout(() => b.classList.remove('down'), 120);
    this.onKey?.(pc);
  }

  setLabels(on) {
    this.root.classList.toggle('no-labels', !on);
  }

  setEnabled(on) {
    this.enabled = on;
    this.root.classList.toggle('disabled', !on);
  }

  flash(pc, ok) {
    const b = this.keys.get(pc);
    if (!b) return;
    const cls = ok ? 'ok' : 'bad';
    b.classList.add(cls);
    setTimeout(() => b.classList.remove(cls), 500);
  }
}
