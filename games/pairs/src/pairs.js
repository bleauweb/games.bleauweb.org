// Pairs: turn over two cards; matching pairs stay up. No timer, no lives, only completion.
import { mulberry32 } from '../../sequence-lab/src/sequences.js';

export const SYMBOLS = ['circle', 'square', 'triangle', 'star', 'hexagon', 'diamond', 'heart', 'moon', 'cross', 'ring', 'drop', 'leaf'];
export const COLORS = ['#e05a5a', '#e8a33d', '#e6d84a', '#4cc25e', '#2dd4bf', '#4f8fff', '#b26ee6', '#f472b6'];

export const LEVELS = [
  { id: 'six', name: 'Six cards', tip: 'Three pairs. Shapes and colours both match.', pairs: 3, cols: 3 },
  { id: 'twelve', name: 'Twelve cards', tip: 'Six pairs.', pairs: 6, cols: 4 },
  { id: 'twenty', name: 'Twenty cards', tip: 'Ten pairs.', pairs: 10, cols: 5 },
  { id: 'shapes', name: 'Match the shape', tip: 'Colours vary. Only the shape has to match.', pairs: 8, cols: 4, by: 'shape' },
  { id: 'colours', name: 'Match the colour', tip: 'Shapes vary. Only the colour has to match.', pairs: 8, cols: 4, by: 'color' },
  { id: 'thirty', name: 'Thirty cards', tip: 'Fifteen pairs. A long, quiet one.', pairs: 15, cols: 6 },
];

export function makeDeck(level, seed) {
  const rng = mulberry32(seed);
  const cards = [];
  const symbols = [...SYMBOLS].sort(() => rng() - 0.5);
  const colors = [...COLORS].sort(() => rng() - 0.5);
  for (let i = 0; i < level.pairs; i++) {
    const sym = symbols[i % symbols.length];
    const col = colors[i % colors.length];
    if (level.by === 'shape') {
      const other = colors[(i + 3) % colors.length];
      cards.push({ id: cards.length, key: sym, symbol: sym, color: col }, { id: cards.length + 1, key: sym, symbol: sym, color: other });
    } else if (level.by === 'color') {
      const otherSym = symbols[(i + 5) % symbols.length];
      cards.push({ id: cards.length, key: col, symbol: sym, color: col }, { id: cards.length + 1, key: col, symbol: otherSym, color: col });
    } else {
      const key = `${sym}|${col}`;
      cards.push({ id: cards.length, key, symbol: sym, color: col }, { id: cards.length + 1, key, symbol: sym, color: col });
    }
  }
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}

export function newGame(level, seed) {
  return { level, cards: makeDeck(level, seed), up: [], matched: new Set(), turns: 0, pairsFound: 0 };
}

/** Flip a card. Returns 'ignored' | 'first' | 'match' | 'miss'. On a miss the two stay up until flipBack(). */
export function flip(state, id) {
  if (state.matched.has(id) || state.up.includes(id) || state.up.length === 2) return 'ignored';
  state.up.push(id);
  if (state.up.length < 2) return 'first';
  state.turns++;
  const [a, b] = state.up.map((i) => state.cards.find((c) => c.id === i));
  if (a.key === b.key) {
    state.matched.add(a.id);
    state.matched.add(b.id);
    state.pairsFound++;
    state.up = [];
    return 'match';
  }
  return 'miss';
}

export function flipBack(state) {
  state.up = [];
}

export function done(state) {
  return state.pairsFound === state.level.pairs;
}
