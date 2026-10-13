// Draws a staff, a clef, and notes as SVG. Coordinates: W×H viewBox, five lines GAP apart.
import { staffPos, ledgerLines, noteAt, noteName, CLEFS } from './music.js';

export const W = 440;
export const H = 230;
export const GAP = 20;
const TOP = 70; // y of the top staff line
const BOTTOM = TOP + 4 * GAP;
export const HIT_X = 120; // where a rushing note is "due"
export const NOTE_X = 260; // where a single quiz note sits

const SVG = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

/** y of a staff position (0 = bottom line, 8 = top line). */
export function yOf(pos) {
  return BOTTOM - (pos * GAP) / 2;
}

// Clefs as stroked paths in a local frame: x right, y down, one GAP = 16 units, origin on the
// clef's reference line (G4 for treble, F3 for bass).
const TREBLE = [
  'M 6 -72 C 10 -40 6 10 4 44 C 4 56 -9 57 -9 48 C -9 42 -2 41 0 46',
  'M 6 -72 C -12 -56 -15 -36 -4 -20 C 10 -23 19 -8 16 2 C 14 14 2 19 -6 14 C -15 9 -14 -5 -4 -6 C 3 -8 6 -2 1 2',
];
const BASS = ['M -8 0 C -8 -18 16 -21 16 -4 C 16 14 0 28 -16 38'];

export class Staff {
  constructor(svg) {
    this.svg = svg;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.lines = el('g', { class: 'lines' });
    this.clefG = el('g', { class: 'clef' });
    this.labelsG = el('g', { class: 'labels' });
    this.hit = el('line', { x1: HIT_X, y1: TOP - GAP * 2.2, x2: HIT_X, y2: BOTTOM + GAP * 2.2, class: 'hitline' });
    this.hit.style.display = 'none';
    this.notesG = el('g', { class: 'notes' });
    svg.append(this.lines, this.clefG, this.labelsG, this.hit, this.notesG);
    for (let i = 0; i < 5; i++) this.lines.append(el('line', { x1: 24, y1: TOP + i * GAP, x2: W - 16, y2: TOP + i * GAP }));
    this.clef = 'treble';
    this.labels = false;
    this.setClef('treble');
  }

  setClef(clef) {
    this.clef = clef;
    this.clefG.innerHTML = '';
    if (clef === 'treble') {
      const g = el('g', { transform: `translate(50 ${yOf(2)}) scale(${GAP / 16})`, class: 'clef-treble' });
      for (const d of TREBLE) g.append(el('path', { d }));
      this.clefG.append(g);
    } else {
      const g = el('g', { transform: `translate(56 ${yOf(6)}) scale(${GAP / 16})`, class: 'clef-bass' });
      for (const d of BASS) g.append(el('path', { d }));
      g.append(el('circle', { cx: -8, cy: 0, r: 6, class: 'fill' }));
      g.append(el('circle', { cx: 26, cy: -8, r: 3.2, class: 'fill' }));
      g.append(el('circle', { cx: 26, cy: 8, r: 3.2, class: 'fill' }));
      this.clefG.append(g);
    }
    this.setLabels(this.labels);
  }

  /** Letter names on every line and space (learn mode). */
  setLabels(on) {
    this.labels = on;
    this.labelsG.innerHTML = '';
    if (!on) return;
    // Line names on the left (after the clef), space names on the right, so neither crowds.
    for (let p = 0; p <= 8; p++) {
      const n = noteAt(p, this.clef);
      const line = p % 2 === 0;
      const t = el('text', { x: line ? 108 : W - 36, y: yOf(p) + 5, class: line ? 'lbl line' : 'lbl space' });
      t.textContent = n.letter;
      this.labelsG.append(t);
    }
    const info = el('text', { x: 112, y: BOTTOM + GAP * 2.6, class: 'mnemonic' });
    info.textContent = `Lines: ${CLEFS[this.clef].lines} · Spaces: ${CLEFS[this.clef].spaces}`;
    this.labelsG.append(info);
  }

  showHitLine(on) {
    this.hit.style.display = on ? '' : 'none';
  }

  clear() {
    this.notesG.innerHTML = '';
  }

  /** Draw a note at x. Returns a handle for moving/removing it. */
  addNote(item, x = NOTE_X, { label = null } = {}) {
    const pos = staffPos(item.note, this.clef);
    const y = yOf(pos);
    const g = el('g', { class: 'note', transform: `translate(${x} 0)` });
    for (const lp of ledgerLines(pos)) g.append(el('line', { x1: -GAP, y1: yOf(lp), x2: GAP, y2: yOf(lp), class: 'ledger' }));
    const up = pos < 4;
    const head = el('ellipse', { cx: 0, cy: y, rx: GAP * 0.62, ry: GAP * 0.42, transform: `rotate(-20 0 ${y})`, class: 'head' });
    const sx = up ? GAP * 0.54 : -GAP * 0.54;
    const sy = up ? y - GAP * 3.3 : y + GAP * 3.3;
    g.append(el('line', { x1: sx, y1: y, x2: sx, y2: sy, class: 'stem' }), head);
    if (item.note.acc) {
      const a = el('text', { x: -GAP * 1.3, y: y + 8, class: 'acc' });
      a.textContent = item.note.acc > 0 ? '♯' : '♭';
      g.append(a);
    }
    if (label) {
      const t = el('text', { x: 0, y: up ? y + GAP * 1.8 : y - GAP * 1.4, class: 'note-label' });
      t.textContent = label;
      g.append(t);
    }
    this.notesG.append(g);
    return { g, x, item };
  }

  moveNote(h, x) {
    h.x = x;
    h.g.setAttribute('transform', `translate(${x} 0)`);
  }

  removeNote(h) {
    h.g.remove();
  }

  mark(h, ok) {
    h.g.classList.add(ok ? 'ok' : 'bad');
  }

  setActive(h, on) {
    h.g.classList.toggle('active', on);
  }

  /** Name shown big above the staff: feedback after an answer. */
  caption(text, cls = '') {
    this.captionEl?.remove();
    if (!text) return;
    this.captionEl = el('text', { x: W / 2, y: 34, class: `caption ${cls}` });
    this.captionEl.textContent = text;
    this.svg.append(this.captionEl);
  }

  labelFor(item) {
    return noteName(item.note);
  }
}
