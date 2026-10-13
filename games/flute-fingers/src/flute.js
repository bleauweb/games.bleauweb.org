// An SVG flute you can finger. Keys are drawn where they sit on the instrument, head joint to
// the left. Pressed keys fill dark; results colour them green, red or amber.
import { KEYS } from './fingerings.js';

const SVG = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

// Key positions on a 640 × 184 canvas; the tube runs along y = 88. The head joint is drawn
// short so the keys can be big enough to tap on a phone.
const LAYOUT = {
  T: { x: 172, y: 150, w: 40, h: 24, shape: 'rect' },
  Tb: { x: 218, y: 150, w: 30, h: 18, shape: 'rect' },
  L1: { x: 172, y: 88, r: 22 },
  L2: { x: 230, y: 88, r: 22 },
  L3: { x: 288, y: 88, r: 22 },
  Gs: { x: 322, y: 142, r: 13 },
  R1: { x: 366, y: 88, r: 22 },
  R2: { x: 424, y: 88, r: 22 },
  R3: { x: 482, y: 88, r: 22 },
  Eb: { x: 522, y: 34, r: 14 },
  Cs: { x: 566, y: 88, r: 15 },
  C: { x: 606, y: 88, r: 15 },
};

export class FluteDiagram {
  constructor(svg, { interactive = false, onChange = null } = {}) {
    this.svg = svg;
    this.interactive = interactive;
    this.onChange = onChange;
    this.pressedSet = new Set();
    this.keyEls = new Map();
    svg.setAttribute('viewBox', '0 0 640 184');
    svg.classList.add('flute');
    // Tube: head joint, body, foot.
    svg.append(
      el('rect', { x: 10, y: 70, width: 130, height: 36, rx: 18, class: 'tube head' }),
      el('ellipse', { cx: 56, cy: 88, rx: 12, ry: 7, class: 'hole' }),
      el('rect', { x: 142, y: 72, width: 400, height: 32, rx: 6, class: 'tube' }),
      el('rect', { x: 544, y: 72, width: 86, height: 32, rx: 10, class: 'tube foot' }),
      el('line', { x1: 322, y1: 104, x2: 322, y2: 130, class: 'rod' }),
      el('line', { x1: 522, y1: 48, x2: 522, y2: 72, class: 'rod' }),
      el('line', { x1: 172, y1: 108, x2: 172, y2: 140, class: 'rod' }),
    );
    for (const k of KEYS) {
      const p = LAYOUT[k.id];
      const g = el('g', { class: 'key', 'data-key': k.id });
      if (p.shape === 'rect') g.append(el('rect', { x: p.x - p.w / 2, y: p.y - p.h / 2, width: p.w, height: p.h, rx: 6, class: 'cap' }));
      else g.append(el('circle', { cx: p.x, cy: p.y, r: p.r, class: 'cap' }));
      const t = el('text', { x: p.x, y: p.shape === 'rect' ? p.y + 5 : p.y + 6, class: 'klabel' });
      t.textContent = k.label;
      g.append(t);
      const title = el('title');
      title.textContent = k.name;
      g.append(title);
      svg.append(g);
      this.keyEls.set(k.id, g);
    }
    const hands = el('g', { class: 'hands' });
    const lh = el('text', { x: 230, y: 24, class: 'hand' });
    lh.textContent = 'left hand';
    const rh = el('text', { x: 424, y: 24, class: 'hand' });
    rh.textContent = 'right hand';
    hands.append(lh, rh);
    svg.append(hands);
    svg.addEventListener('pointerdown', (e) => {
      if (!this.interactive) return;
      const g = e.target.closest('.key');
      if (!g) return;
      e.preventDefault();
      this.toggle(g.dataset.key);
    });
    this.render();
  }

  get pressed() {
    return new Set(this.pressedSet);
  }

  setInteractive(on) {
    this.interactive = on;
    this.svg.classList.toggle('interactive', on);
  }

  toggle(id) {
    if (this.pressedSet.has(id)) this.pressedSet.delete(id);
    else this.pressedSet.add(id);
    this.clearResult();
    this.render();
    this.onChange?.(this.pressed);
  }

  setPressed(keys) {
    this.pressedSet = new Set(keys);
    this.render();
  }

  clear() {
    this.pressedSet.clear();
    this.clearResult();
    this.render();
  }

  render() {
    for (const [id, g] of this.keyEls) g.classList.toggle('pressed', this.pressedSet.has(id));
  }

  /** Colour the keys after a check: green right, red extra, amber (dashed) missing. */
  showResult({ missing = [], extra = [] } = {}) {
    for (const [id, g] of this.keyEls) {
      g.classList.remove('good', 'extra', 'missing');
      if (missing.includes(id)) g.classList.add('missing');
      else if (extra.includes(id)) g.classList.add('extra');
      else if (this.pressedSet.has(id)) g.classList.add('good');
    }
  }

  clearResult() {
    for (const g of this.keyEls.values()) g.classList.remove('good', 'extra', 'missing');
  }
}
