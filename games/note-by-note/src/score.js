// Draws a whole melody on one long scrolling staff: bar lines, note values, rests, and the
// clef that stays put while the music slides under it.
import { ledgerLines, noteName } from '../../treble-maker/src/music.js';

export const W = 560;
export const H = 240;
export const GAP = 20;
const TOP = 72; // top staff line
const BOTTOM = TOP + 4 * GAP;
export const NOW_X = 176; // where the current beat sits
const CLIP_X = 122; // music is visible right of the clef
export const PX_PER_BEAT = 58;
const LEAD = 12; // beats of empty staff before the first note, in px

const SVG = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

export function yOf(pos) {
  return BOTTOM - (pos * GAP) / 2;
}

const TREBLE = [
  'M 6 -72 C 10 -40 6 10 4 44 C 4 56 -9 57 -9 48 C -9 42 -2 41 0 46',
  'M 6 -72 C -12 -56 -15 -36 -4 -20 C 10 -23 19 -8 16 2 C 14 14 2 19 -6 14 C -15 9 -14 -5 -4 -6 C 3 -8 6 -2 1 2',
];

export class Score {
  constructor(svg) {
    this.svg = svg;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const defs = el('defs');
    const clip = el('clipPath', { id: 'score-clip' });
    clip.append(el('rect', { x: CLIP_X, y: 0, width: W - CLIP_X, height: H }));
    defs.append(clip);
    this.lines = el('g', { class: 'lines' });
    for (let i = 0; i < 5; i++) this.lines.append(el('line', { x1: 20, y1: TOP + i * GAP, x2: W - 8, y2: TOP + i * GAP }));
    const clefG = el('g', { class: 'clef', transform: `translate(52 ${yOf(2)}) scale(${GAP / 16})` });
    for (const d of TREBLE) clefG.append(el('path', { d }));
    this.viewport = el('g', { 'clip-path': 'url(#score-clip)' });
    this.scroll = el('g', { class: 'scroll' });
    this.viewport.append(this.scroll);
    this.playhead = el('line', { x1: NOW_X, y1: TOP - GAP * 2.4, x2: NOW_X, y2: BOTTOM + GAP * 2.4, class: 'playhead' });
    this.countEl = el('text', { x: NOW_X, y: TOP - GAP * 1.4, class: 'count' });
    svg.append(defs, this.lines, this.viewport, clefG, this.playhead, this.countEl);
    this.handles = [];
    this.labels = false;
    this.setOffset(0);
  }

  xOf(t) {
    return LEAD + t * PX_PER_BEAT;
  }

  /** Lay the song out. `handles[i]` corresponds to `song.events[i]`. */
  load(song, { labels = false } = {}) {
    this.song = song;
    this.labels = labels;
    this.scroll.innerHTML = '';
    this.handles = [];
    const barsG = el('g', { class: 'bars' });
    song.barLines.forEach((t, i) => {
      const x = this.xOf(t) - PX_PER_BEAT * 0.32;
      barsG.append(el('line', { x1: x, y1: TOP, x2: x, y2: BOTTOM }));
      const n = el('text', { x: x + 3, y: TOP - GAP * 2.4, class: 'barnum' });
      n.textContent = String(i + (song.pickup ? 1 : 2));
      barsG.append(n);
    });
    const endX = this.xOf(song.total) + PX_PER_BEAT * 0.2;
    barsG.append(el('line', { x1: endX, y1: TOP, x2: endX, y2: BOTTOM }));
    barsG.append(el('line', { x1: endX + 5, y1: TOP, x2: endX + 5, y2: BOTTOM, class: 'thick' }));
    this.scroll.append(barsG);
    for (const e of song.events) this.handles.push(e.rest ? this.drawRest(e) : this.drawNote(e));
    this.setLabels(labels);
  }

  drawNote(e) {
    const x = this.xOf(e.t);
    const y = yOf(e.pos);
    const g = el('g', { class: 'note', transform: `translate(${x} 0)` });
    for (const lp of ledgerLines(e.pos)) g.append(el('line', { x1: -GAP * 0.9, y1: yOf(lp), x2: GAP * 0.9, y2: yOf(lp), class: 'ledger' }));
    const hollow = e.dur >= 2;
    const head = el('ellipse', { cx: 0, cy: y, rx: GAP * 0.58, ry: GAP * 0.4, transform: `rotate(-20 0 ${y})`, class: hollow ? 'head hollow' : 'head' });
    g.append(head);
    const up = e.pos < 4;
    if (e.dur < 4) {
      const sx = up ? GAP * 0.5 : -GAP * 0.5;
      const sy = up ? y - GAP * 3.2 : y + GAP * 3.2;
      g.append(el('line', { x1: sx, y1: y, x2: sx, y2: sy, class: 'stem' }));
      const flags = e.dur < 0.5 ? 2 : e.dur < 1 ? 1 : 0;
      for (let f = 0; f < flags; f++) {
        const fy = sy + (up ? f * GAP * 0.6 : -f * GAP * 0.6);
        const dir = up ? 1 : -1;
        g.append(el('path', { d: `M ${sx} ${fy} c 0 ${dir * GAP * 0.5} ${GAP * 0.7} ${dir * GAP * 0.6} ${GAP * 0.5} ${dir * GAP * 1.4}`, class: 'flag' }));
      }
    }
    const dotted = [6, 3, 1.5, 0.75, 0.375].some((d) => Math.abs(e.dur - d) < 1e-9);
    if (dotted) g.append(el('circle', { cx: GAP * 0.9, cy: e.pos % 2 === 0 ? y - GAP * 0.25 : y, r: 2.6, class: 'dot' }));
    if (e.note.acc) {
      const a = el('text', { x: -GAP * 1.25, y: y + 8, class: 'acc' });
      a.textContent = e.note.acc > 0 ? '♯' : '♭';
      g.append(a);
    }
    const label = el('text', { x: 0, y: TOP - GAP * 0.9, class: 'label' });
    label.textContent = noteName(e.note);
    g.append(label);
    this.scroll.append(g);
    return { g, e };
  }

  drawRest(e) {
    const x = this.xOf(e.t);
    const g = el('g', { class: 'rest', transform: `translate(${x} 0)` });
    const mid = yOf(4);
    if (e.dur >= 4) g.append(el('rect', { x: -GAP * 0.5, y: yOf(6), width: GAP, height: GAP * 0.35, class: 'fill' }));
    else if (e.dur >= 2) g.append(el('rect', { x: -GAP * 0.5, y: mid - GAP * 0.35, width: GAP, height: GAP * 0.35, class: 'fill' }));
    else if (e.dur >= 1) g.append(el('path', { d: `M -4 ${mid - GAP * 0.9} L 5 ${mid - GAP * 0.2} L -3 ${mid + GAP * 0.4} L 5 ${mid + GAP * 1.0}`, class: 'stroke' }));
    else {
      g.append(el('circle', { cx: -4, cy: mid - GAP * 0.3, r: 3.2, class: 'fill' }));
      g.append(el('path', { d: `M -1 ${mid - GAP * 0.3} L 5 ${mid - GAP * 0.35} L 0 ${mid + GAP * 0.7}`, class: 'stroke' }));
      if (e.dur < 0.5) g.append(el('circle', { cx: -6, cy: mid + GAP * 0.2, r: 3.2, class: 'fill' }));
    }
    this.scroll.append(g);
    return { g, e };
  }

  setLabels(on) {
    this.labels = on;
    this.svg.classList.toggle('show-labels', on);
  }

  /** Slide the music so that beat `t` sits on the playhead. */
  setOffset(t) {
    this.offset = t;
    this.scroll.setAttribute('transform', `translate(${NOW_X - this.xOf(t)} 0)`);
  }

  /** state: '' | current | ok | bad | miss | hint */
  setState(i, state) {
    const h = this.handles[i];
    if (!h) return;
    h.g.classList.remove('current', 'ok', 'bad', 'miss');
    if (state) h.g.classList.add(state);
  }

  hint(i, on) {
    this.handles[i]?.g.classList.toggle('hint', on);
  }

  dimOutside(fromBar, toBar) {
    for (const h of this.handles) h.g.classList.toggle('dim', h.e.bar < fromBar || h.e.bar >= toBar);
  }

  resetStates() {
    for (const h of this.handles) h.g.classList.remove('current', 'ok', 'bad', 'miss', 'hint');
  }

  count(text) {
    this.countEl.textContent = text || '';
  }
}
