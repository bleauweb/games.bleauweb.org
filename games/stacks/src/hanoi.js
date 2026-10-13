// Stacks: the Tower of Hanoi. Move the whole stack to another peg; a bigger disc never goes on
// a smaller one. Pure state and the optimal next move, used for hints.

export const LEVELS = [
  { id: 'three', name: 'Three discs', tip: 'Seven moves is the fewest. Small disc first.', discs: 3 },
  { id: 'four', name: 'Four discs', tip: 'Fifteen moves. Notice the pattern repeats.', discs: 4 },
  { id: 'five', name: 'Five discs', tip: 'Thirty-one moves.', discs: 5 },
  { id: 'six', name: 'Six discs', tip: 'Sixty-three moves. Take your time.', discs: 6 },
  { id: 'seven', name: 'Seven discs', tip: 'One hundred and twenty-seven moves.', discs: 7 },
];

export function newGame(discs) {
  return { discs, pegs: [Array.from({ length: discs }, (_, i) => discs - i), [], []], moves: 0, history: [] };
}

export function canMove(state, from, to) {
  const a = state.pegs[from];
  const b = state.pegs[to];
  if (!a.length || from === to) return false;
  return !b.length || b[b.length - 1] > a[a.length - 1];
}

export function move(state, from, to) {
  if (!canMove(state, from, to)) return false;
  state.pegs[to].push(state.pegs[from].pop());
  state.moves++;
  state.history.push([from, to]);
  return true;
}

export function undo(state) {
  const last = state.history.pop();
  if (!last) return false;
  const [from, to] = last;
  state.pegs[from].push(state.pegs[to].pop());
  state.moves = Math.max(0, state.moves - 1);
  return true;
}

export function solved(state) {
  return state.pegs[2].length === state.discs || state.pegs[1].length === state.discs;
}

export function optimal(discs) {
  return 2 ** discs - 1;
}

/**
 * The next move of the optimal solution from any legal position (target: the right peg).
 * Classic recursive reasoning: find the largest disc not yet in place and move the sub-tower
 * above it out of the way.
 */
export function nextMove(state, target = 2) {
  const n = state.discs;
  const where = new Array(n + 1);
  state.pegs.forEach((peg, p) => peg.forEach((d) => { where[d] = p; }));
  let goal = target;
  for (let d = n; d >= 1; d--) {
    if (where[d] === goal) continue;
    // Disc d must go to `goal`; everything smaller must first sit on the third peg.
    const other = 3 - where[d] - goal;
    let allOnOther = true;
    for (let k = d - 1; k >= 1; k--) if (where[k] !== other) { allOnOther = false; break; }
    if (allOnOther) return [where[d], goal];
    goal = other;
  }
  return null;
}
