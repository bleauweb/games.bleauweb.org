import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makeDeck, newGame, flip, flipBack, done } from '../games/pairs/src/pairs.js';

test('decks have exactly two of every key and the game completes when all pairs are found', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 20; seed++) {
      const deck = makeDeck(level, seed);
      assert.equal(deck.length, level.pairs * 2);
      const counts = {};
      for (const c of deck) counts[c.key] = (counts[c.key] || 0) + 1;
      assert.ok(Object.values(counts).every((n) => n === 2), `${level.id} seed ${seed}: ${JSON.stringify(counts)}`);
      if (level.by === 'shape') {
        const pairs = Object.keys(counts);
        for (const k of pairs) { const two = deck.filter((c) => c.key === k); assert.notEqual(two[0].color, two[1].color); }
      }
      const g = newGame(level, seed);
      // Play perfectly by peeking.
      for (const key of Object.keys(counts)) {
        const [a, b] = g.cards.filter((c) => c.key === key);
        assert.equal(flip(g, a.id), 'first');
        assert.equal(flip(g, b.id), 'match');
      }
      assert.ok(done(g));
      assert.equal(g.turns, level.pairs);
    }
  }
  const g = newGame(LEVELS[0], 3);
  const [a, b] = [g.cards[0], g.cards.find((c) => c.key !== g.cards[0].key)];
  flip(g, a.id);
  assert.equal(flip(g, b.id), 'miss');
  assert.equal(flip(g, g.cards[2].id), 'ignored', 'third flip waits');
  flipBack(g);
  assert.equal(g.up.length, 0);
});
