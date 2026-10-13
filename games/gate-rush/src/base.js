// The Base: a merge grid in the Top War style. Drag two units of the same level together to
// make one of the next level. Every unit on the grid marches with you: its worth is added to
// the starting squad. Recruits arrive after each win and can be bought with coins.
export const GRID = 12;
export const MAX_UNIT_LEVEL = 7;

export function unitWorth(lv) {
  return 2 ** lv - 1; // 1, 3, 7, 15, 31, 63, 127 — merging two is always worth one more
}

export function armyBonus(units) {
  return (units || []).reduce((sum, u) => sum + (u ? unitWorth(u.lv) : 0), 0);
}

export function recruitCost(bought) {
  return Math.round(8 * 1.22 ** bought);
}

export function freeSlot(units) {
  return units.findIndex((u) => !u);
}

/** Add a Lv1 recruit; merges the smallest pair if the grid is full. Returns false if impossible. */
export function addRecruit(units) {
  let i = freeSlot(units);
  if (i < 0) {
    if (!mergeOnePair(units)) return false;
    i = freeSlot(units);
  }
  units[i] = { lv: 1 };
  return true;
}

export function mergeOnePair(units) {
  for (let lv = 1; lv < MAX_UNIT_LEVEL; lv++) {
    const idx = [];
    units.forEach((u, i) => {
      if (u && u.lv === lv) idx.push(i);
    });
    if (idx.length >= 2) {
      units[idx[0]] = { lv: lv + 1 };
      units[idx[1]] = null;
      return true;
    }
  }
  return false;
}

export function mergeAll(units) {
  let n = 0;
  while (mergeOnePair(units)) n++;
  return n;
}

const TIER_OF_LEVEL = [0, 0, 0, 1, 1, 2, 2, 3];
export function unitTier(lv) {
  return TIER_OF_LEVEL[Math.min(lv, MAX_UNIT_LEVEL)];
}

const ICONS = [
  // rifleman: ball head + body
  '<svg viewBox="0 0 40 40"><circle cx="20" cy="13" r="9" fill="#4f8fff"/><rect x="12" y="22" width="16" height="13" rx="5" fill="#2b55c9"/></svg>',
  // heavy: wider, shoulder pads, visor
  '<svg viewBox="0 0 40 40"><rect x="8" y="20" width="24" height="15" rx="5" fill="#2b55c9"/><rect x="4" y="19" width="8" height="7" rx="2" fill="#1b2a44"/><rect x="28" y="19" width="8" height="7" rx="2" fill="#1b2a44"/><circle cx="20" cy="12" r="9" fill="#4f8fff"/><rect x="13" y="11" width="14" height="4" rx="2" fill="#9be7ff"/></svg>',
  // tank
  '<svg viewBox="0 0 40 40"><rect x="4" y="22" width="32" height="12" rx="4" fill="#3a4256"/><rect x="8" y="17" width="24" height="10" rx="3" fill="#3f6fd6"/><rect x="14" y="10" width="12" height="9" rx="3" fill="#2b55c9"/><rect x="24" y="12" width="14" height="3" rx="1.5" fill="#3a4256"/></svg>',
  // mech
  '<svg viewBox="0 0 40 40"><rect x="10" y="8" width="20" height="16" rx="4" fill="#4a5fe0"/><rect x="14" y="2" width="12" height="8" rx="3" fill="#1b2a44"/><rect x="16" y="5" width="8" height="2.5" rx="1" fill="#9be7ff"/><rect x="3" y="12" width="7" height="14" rx="2" fill="#3a4256"/><rect x="30" y="12" width="7" height="14" rx="2" fill="#3a4256"/><rect x="11" y="24" width="7" height="13" rx="2" fill="#2b55c9"/><rect x="22" y="24" width="7" height="13" rx="2" fill="#2b55c9"/></svg>',
];
export function unitIcon(lv) {
  return ICONS[unitTier(lv)];
}

/**
 * Renders the grid into `el` and handles drag/tap merging.
 * opts: { getUnits(), onChange(units), onSound(name) }
 */
export class BaseGrid {
  constructor(el, opts) {
    this.el = el;
    this.opts = opts;
    this.selected = -1;
    this.drag = null;
    el.classList.add('base-grid');
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', () => this.endDrag());
    this.render();
  }

  render() {
    const units = this.opts.getUnits();
    this.el.innerHTML = '';
    units.forEach((u, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === this.selected ? ' selected' : '') + (u ? '' : ' empty');
      slot.dataset.i = i;
      if (u) {
        slot.innerHTML = `${unitIcon(u.lv)}<div class="lv">Lv ${u.lv}</div><div class="worth">+${unitWorth(u.lv)}</div>`;
      }
      this.el.appendChild(slot);
    });
  }

  slotAt(x, y) {
    const t = document.elementFromPoint(x, y);
    const slot = t && t.closest ? t.closest('.slot') : null;
    return slot && this.el.contains(slot) ? Number(slot.dataset.i) : -1;
  }

  onDown(e) {
    const i = this.slotAt(e.clientX, e.clientY);
    const units = this.opts.getUnits();
    if (i < 0 || !units[i]) return;
    this.drag = { from: i, x0: e.clientX, y0: e.clientY, moved: false, ghost: null };
    this.el.setPointerCapture?.(e.pointerId);
  }

  onMove(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) {
      d.moved = true;
      const units = this.opts.getUnits();
      d.ghost = document.createElement('div');
      d.ghost.className = 'slot ghost';
      d.ghost.innerHTML = `${unitIcon(units[d.from].lv)}<div class="lv">Lv ${units[d.from].lv}</div>`;
      document.body.appendChild(d.ghost);
      this.el.children[d.from]?.classList.add('lifting');
    }
    if (d.ghost) {
      d.ghost.style.left = `${e.clientX}px`;
      d.ghost.style.top = `${e.clientY}px`;
    }
  }

  onUp(e) {
    const d = this.drag;
    if (!d) return;
    const target = this.slotAt(e.clientX, e.clientY);
    if (d.moved) {
      if (target >= 0 && target !== d.from) this.act(d.from, target);
      this.selected = -1;
    } else if (this.selected >= 0 && this.selected !== d.from) {
      this.act(this.selected, d.from);
      this.selected = -1;
    } else {
      this.selected = this.selected === d.from ? -1 : d.from;
      this.opts.onSound?.('click');
    }
    this.endDrag();
    this.render();
  }

  endDrag() {
    if (this.drag?.ghost) this.drag.ghost.remove();
    this.drag = null;
  }

  act(from, to) {
    const units = this.opts.getUnits();
    const a = units[from];
    const b = units[to];
    if (!a) return;
    if (!b) {
      units[to] = a;
      units[from] = null;
      this.opts.onSound?.('click');
    } else if (a.lv === b.lv && a.lv < MAX_UNIT_LEVEL) {
      units[to] = { lv: a.lv + 1 };
      units[from] = null;
      this.opts.onSound?.('merge');
      this.pop(to);
    } else {
      units[to] = a;
      units[from] = b;
      this.opts.onSound?.('click');
    }
    this.opts.onChange?.(units);
  }

  pop(i) {
    requestAnimationFrame(() => this.el.children[i]?.classList.add('pop'));
  }
}
