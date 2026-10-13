// Pull-the-pin treasure rooms: a tiny cellular world. Pure logic, no DOM, so the tests can
// brute-force every pin order and prove each room is solvable (and that the wrong order hurts).
//
// A room is drawn as text. Cell rows and boundary rows alternate:
//   #####        cell row:   # wall  . empty  L lava  W water  G gold  P potion  M monster  H hero
//    = =         boundary:   = a pin under that column (a run of = is one pin, pulled together)
//   #...#
// Things fall straight down unless a pin or something solid is under them. Fluids that land
// spread sideways. Lava burns gold, potions and monsters and kills the hero; water turns lava
// to stone. Gold, potions and monsters that come to rest within one cell of the hero are
// collected, drunk, or fought (hero power vs monster power; a win adds half the monster's power).

export const POTION = 100;

const MOVABLE = new Set(['L', 'W', 'G', 'P', 'M']);
const FLUID = new Set(['L', 'W']);

export function parseRoom(def) {
  const cells = [];
  const pins = [];
  const monsters = [...(def.monsters || [])];
  let hero = null;
  let gold = 0;
  for (let i = 0; i < def.map.length; i++) {
    const line = def.map[i];
    if (i % 2 === 0) {
      const y = i / 2;
      const row = [];
      for (let x = 0; x < line.length; x++) {
        const ch = line[x] === ' ' ? '.' : line[x];
        const cell = { t: ch };
        if (ch === 'H') {
          hero = { x, y, power: def.hero ?? 100, alive: true };
        } else if (ch === 'M') {
          cell.power = monsters.shift() ?? 100;
        } else if (ch === 'G') gold++;
        row.push(cell);
      }
      cells.push(row);
    } else {
      const y = (i + 1) / 2; // the pin sits above this row
      let x = 0;
      while (x < line.length) {
        if (line[x] === '=') {
          const x0 = x;
          while (x < line.length && line[x] === '=') x++;
          pins.push({ y, x0, x1: x - 1, pulled: false });
        } else x++;
      }
    }
  }
  if (!hero) throw new Error(`room ${def.id}: no hero`);
  return { id: def.id, name: def.name, w: cells[0].length, h: cells.length, cells, pins, hero, gold: 0, goldTotal: gold, kills: 0, events: [] };
}

export function cloneState(s) {
  return {
    ...s,
    cells: s.cells.map((row) => row.map((c) => ({ ...c }))),
    pins: s.pins.map((p) => ({ ...p })),
    hero: { ...s.hero },
    events: [],
  };
}

function pinBlocks(s, y, x) {
  // Is there an unpulled pin on the boundary above row y, covering column x?
  return s.pins.some((p) => !p.pulled && p.y === y && x >= p.x0 && x <= p.x1);
}

function heroAt(s, x, y) {
  return s.hero.alive && s.hero.x === x && s.hero.y === y;
}

function meetHero(s, cell, x, y) {
  const h = s.hero;
  switch (cell.t) {
    case 'G':
      s.gold++;
      s.events.push({ type: 'gold', x, y });
      return true;
    case 'P':
      h.power += POTION;
      s.events.push({ type: 'potion', x, y });
      return true;
    case 'M':
      if (h.power >= cell.power) {
        h.power += Math.floor(cell.power / 2);
        s.kills++;
        s.events.push({ type: 'kill', x, y, power: cell.power });
      } else {
        h.alive = false;
        s.events.push({ type: 'death', x, y, by: 'monster' });
      }
      return true;
    case 'L':
      h.alive = false;
      s.events.push({ type: 'death', x, y, by: 'lava' });
      return false; // lava stays where it is
    default:
      return false; // water flows around the hero
  }
}

/** Advance the world by one tick. Returns true if anything moved. */
export function step(s) {
  let changed = false;
  const empty = (x, y) => y >= 0 && y < s.h && x >= 0 && x < s.w && s.cells[y][x].t === '.' && !heroAt(s, x, y);

  for (let y = s.h - 2; y >= 0; y--) {
    for (let x = 0; x < s.w; x++) {
      const c = s.cells[y][x];
      if (!MOVABLE.has(c.t)) continue;
      const by = y + 1;
      if (pinBlocks(s, by, x)) continue; // resting on a pin: nothing to do, not even spreading
      const below = s.cells[by][x];

      if (heroAt(s, x, by)) {
        if (meetHero(s, c, x, y)) {
          s.cells[y][x] = { t: '.' };
          changed = true;
        }
        continue;
      }
      if (below.t === '.') {
        s.cells[by][x] = c;
        s.cells[y][x] = { t: '.' };
        changed = true;
        continue;
      }
      if (c.t === 'L' && below.t === 'W') {
        s.cells[by][x] = { t: 'S' };
        s.cells[y][x] = { t: '.' };
        s.events.push({ type: 'steam', x, y: by });
        changed = true;
        continue;
      }
      if (c.t === 'W' && below.t === 'L') {
        s.cells[by][x] = { t: 'S' };
        s.cells[y][x] = { t: '.' };
        s.events.push({ type: 'steam', x, y: by });
        changed = true;
        continue;
      }
      if (c.t === 'L' && (below.t === 'G' || below.t === 'P' || below.t === 'M')) {
        s.events.push({ type: 'burn', x, y: by, what: below.t });
        s.cells[by][x] = c;
        s.cells[y][x] = { t: '.' };
        changed = true;
        continue;
      }

      // Resting on something solid. Fluids spread along the floor they rest on: into a
      // neighbouring cell only when that cell also has something under it, so a puddle fills
      // its shelf but does not pour over edges it never reached.
      if (FLUID.has(c.t)) {
        for (const dx of [-1, 1]) {
          const nx = x + dx;
          if (nx < 0 || nx >= s.w) continue;
          const floorUnder = by >= s.h || s.cells[by][nx].t !== '.' || heroAt(s, nx, by) || pinBlocks(s, by, nx);
          if (!floorUnder) continue;
          if (heroAt(s, nx, y)) {
            if (c.t === 'L' && s.hero.alive) {
              s.hero.alive = false;
              s.events.push({ type: 'death', x: nx, y, by: 'lava' });
              changed = true;
            }
            continue;
          }
          const n = s.cells[y][nx];
          if (n.t === '.') {
            s.cells[y][nx] = { t: c.t };
            changed = true;
          } else if (c.t === 'L' && n.t === 'W') {
            s.cells[y][nx] = { t: 'S' };
            s.events.push({ type: 'steam', x: nx, y });
            changed = true;
          } else if (c.t === 'W' && n.t === 'L') {
            s.cells[y][nx] = { t: 'S' };
            s.events.push({ type: 'steam', x: nx, y });
            changed = true;
          } else if (c.t === 'L' && (n.t === 'G' || n.t === 'P' || n.t === 'M')) {
            s.events.push({ type: 'burn', x: nx, y, what: n.t });
            s.cells[y][nx] = { t: 'L' };
            changed = true;
          }
        }
      } else if (s.hero.alive && Math.max(Math.abs(x - s.hero.x), Math.abs(y - s.hero.y)) <= 1) {
        if (meetHero(s, c, x, y)) {
          s.cells[y][x] = { t: '.' };
          changed = true;
        }
      }
    }
  }
  return changed;
}

export function settle(s, max = 200) {
  let n = 0;
  while (n < max && step(s)) n++;
  return n;
}

export function pull(s, index) {
  const p = s.pins[index];
  if (!p || p.pulled) return false;
  p.pulled = true;
  s.events.push({ type: 'pull', index });
  return true;
}

export function isSolved(s) {
  return s.hero.alive && s.gold === s.goldTotal;
}

/** Every ordering of every subset of pins. Small rooms only; the tests keep pins ≤ 6. */
export function* pinSequences(n) {
  const used = new Array(n).fill(false);
  const seq = [];
  function* rec() {
    yield [...seq];
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      seq.push(i);
      yield* rec();
      seq.pop();
      used[i] = false;
    }
  }
  yield* rec();
}

export function runSequence(start, seq) {
  const s = cloneState(start);
  settle(s);
  for (const i of seq) {
    if (!s.hero.alive) break;
    pull(s, i);
    settle(s);
  }
  return s;
}

/** Analyse a room: a solution if any, and whether a wrong order can go badly. */
export function analyse(def) {
  const start = parseRoom(def);
  let solution = null;
  let canFail = false;
  for (const seq of pinSequences(start.pins.length)) {
    const end = runSequence(start, seq);
    if (isSolved(end) && (!solution || seq.length < solution.length)) solution = seq;
    if (!end.hero.alive || (seq.length === start.pins.length && end.gold < end.goldTotal)) canFail = true;
  }
  return { start, solution, canFail };
}
