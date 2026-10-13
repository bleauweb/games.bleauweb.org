// The music model: notes, where they sit on a staff, what they sound like, and the lessons.
// Pure functions only, so the tests can check every level's notes land on sensible positions.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/** Parse "F#4", "Bb3", "C4" into { letter, acc, octave }. acc: -1 flat, 0 natural, 1 sharp. */
export function parseNote(s) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error(`bad note ${s}`);
  return { letter: m[1], acc: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0, octave: Number(m[3]) };
}

export function noteKey(n) {
  return `${n.letter}${n.acc === 1 ? '#' : n.acc === -1 ? 'b' : ''}${n.octave}`;
}

/** Display name without the octave: "F♯", "B♭", "C". */
export function noteName(n) {
  return `${n.letter}${n.acc === 1 ? '♯' : n.acc === -1 ? '♭' : ''}`;
}

/** Diatonic step number: C0 = 0, D0 = 1, ... C4 = 28. Accidentals do not move a note. */
export function diatonic(n) {
  return n.octave * 7 + LETTERS.indexOf(n.letter);
}

export function midi(n) {
  return 12 * (n.octave + 1) + SEMITONES[LETTERS.indexOf(n.letter)] + n.acc;
}

export function pitchClass(n) {
  return ((midi(n) % 12) + 12) % 12;
}

export function freq(m) {
  return 440 * 2 ** ((m - 69) / 12);
}

// Bottom line of each staff: treble is E4, bass is G2.
export const CLEFS = {
  treble: { name: 'Treble', bottomLine: diatonic(parseNote('E4')), lines: 'Every Good Boy Does Fine', spaces: 'FACE' },
  bass: { name: 'Bass', bottomLine: diatonic(parseNote('G2')), lines: 'Good Boys Do Fine Always', spaces: 'All Cows Eat Grass' },
};

/** Staff position: 0 = bottom line, 1 = first space, 8 = top line, negative below, > 8 above. */
export function staffPos(n, clef) {
  return diatonic(n) - CLEFS[clef].bottomLine;
}

/** Positions of the ledger lines a note needs (even numbers outside 0..8). */
export function ledgerLines(pos) {
  const lines = [];
  if (pos < 0) for (let p = -2; p >= pos; p -= 2) lines.push(p);
  if (pos > 8) for (let p = 10; p <= pos; p += 2) lines.push(p);
  return lines;
}

/** The note sitting at a staff position (natural). */
export function noteAt(pos, clef) {
  const d = CLEFS[clef].bottomLine + pos;
  return { letter: LETTERS[((d % 7) + 7) % 7], acc: 0, octave: Math.floor(d / 7) };
}

const pool = (clef, ...names) => names.map((s) => ({ clef, note: parseNote(s) }));

export const LEVELS = [
  {
    id: 'treble-lines',
    name: 'Treble lines',
    tip: 'The five lines, bottom to top: Every Good Boy Does Fine.',
    items: pool('treble', 'E4', 'G4', 'B4', 'D5', 'F5'),
  },
  {
    id: 'treble-spaces',
    name: 'Treble spaces',
    tip: 'The four spaces spell FACE, bottom to top.',
    items: pool('treble', 'F4', 'A4', 'C5', 'E5'),
  },
  {
    id: 'treble-all',
    name: 'Treble staff',
    tip: 'Lines and spaces together. Neighbours on the staff are neighbours in the alphabet.',
    items: pool('treble', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'),
  },
  {
    id: 'treble-ledger',
    name: 'Treble ledger lines',
    tip: 'Middle C sits on its own little line below the staff. Keep counting the alphabet past the edges.',
    items: pool('treble', 'A3', 'B3', 'C4', 'D4', 'E4', 'G4', 'B4', 'D5', 'F5', 'G5', 'A5', 'B5', 'C6'),
  },
  {
    id: 'bass-lines',
    name: 'Bass lines',
    tip: 'Bass clef lines, bottom to top: Good Boys Do Fine Always. The two dots hug the F line.',
    items: pool('bass', 'G2', 'B2', 'D3', 'F3', 'A3'),
  },
  {
    id: 'bass-spaces',
    name: 'Bass spaces',
    tip: 'Bass clef spaces: All Cows Eat Grass.',
    items: pool('bass', 'A2', 'C3', 'E3', 'G3'),
  },
  {
    id: 'bass-all',
    name: 'Bass staff + ledger',
    tip: 'Middle C is one ledger line above the bass staff. Same note as the treble one.',
    items: pool('bass', 'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4'),
  },
  {
    id: 'grand',
    name: 'Grand staff',
    tip: 'Both clefs, at random. Check the clef before you read the note.',
    items: [
      ...pool('treble', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5'),
      ...pool('bass', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4'),
    ],
  },
  {
    id: 'accidentals',
    name: 'Sharps and flats',
    tip: 'A sharp raises the note to the black key on its right, a flat lowers it to the left. B♭ and A♯ are the same key.',
    items: [
      ...pool('treble', 'F#4', 'C#5', 'G#4', 'D#5', 'A#4', 'Bb4', 'Eb5', 'Ab4', 'Db5', 'Gb4', 'F4', 'B4', 'E5', 'C5'),
      ...pool('bass', 'F#3', 'C#3', 'G#2', 'Bb2', 'Eb3', 'Ab2', 'Db3', 'B2', 'E3', 'A3'),
    ],
  },
];

export function levelIndex(id) {
  return LEVELS.findIndex((l) => l.id === id);
}

/**
 * Pick the next question. Notes you have missed come up more often, and the same note is
 * not asked twice in a row.
 */
export function pickItem(level, stats = {}, rng = Math.random, lastKey = null) {
  const weights = level.items.map((it) => {
    const key = `${it.clef}:${noteKey(it.note)}`;
    const s = stats[key];
    const w = s && s.seen ? 1 + (4 * s.wrong) / s.seen : 1.5;
    return key === lastKey && level.items.length > 1 ? 0 : w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < level.items.length; i++) {
    r -= weights[i];
    if (r <= 0) return level.items[i];
  }
  return level.items[level.items.length - 1];
}

/** Does an answered pitch class match the note? (Enharmonics count: A♯ is B♭.) */
export function isCorrect(item, answeredPitchClass) {
  return pitchClass(item.note) === answeredPitchClass;
}

/** Stars for a practice round. */
export function starsFor(correct, total) {
  const f = total ? correct / total : 0;
  return f >= 0.95 ? 3 : f >= 0.8 ? 2 : f >= 0.6 ? 1 : 0;
}

export const PASS_FRACTION = 0.8;
