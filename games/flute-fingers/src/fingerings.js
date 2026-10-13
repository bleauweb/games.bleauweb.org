// Standard Boehm flute fingerings for the first two octaves (C4 to C♯6), the range every
// beginner method covers. Key ids: T thumb (B key), Tb the B♭ thumb lever, L1 L2 L3 left-hand
// fingers, Gs the left pinky G♯ lever, R1 R2 R3 right-hand fingers, Eb the right pinky E♭ key,
// Cs and C the foot-joint rollers. Pressing C closes C♯ too, so a pressed Cs is ignored when C
// is down.
import { parseNote, pitchClass, midi, noteName } from '../../treble-maker/src/music.js';

export const KEYS = [
  { id: 'T', label: 'T', name: 'Left thumb (B key)' },
  { id: 'Tb', label: 'B♭', name: 'B♭ thumb lever' },
  { id: 'L1', label: '1', name: 'Left index' },
  { id: 'L2', label: '2', name: 'Left middle' },
  { id: 'L3', label: '3', name: 'Left ring' },
  { id: 'Gs', label: 'G♯', name: 'Left pinky (G♯ lever)' },
  { id: 'R1', label: '1', name: 'Right index' },
  { id: 'R2', label: '2', name: 'Right middle' },
  { id: 'R3', label: '3', name: 'Right ring' },
  { id: 'Eb', label: 'E♭', name: 'Right pinky (E♭ key)' },
  { id: 'Cs', label: 'C♯', name: 'Low C♯ roller' },
  { id: 'C', label: 'C', name: 'Low C roller' },
];

const ALL_LEFT = ['T', 'L1', 'L2', 'L3'];
const ALL_RIGHT = ['R1', 'R2', 'R3'];

export const FINGERINGS = {
  C4: [[...ALL_LEFT, ...ALL_RIGHT, 'C']],
  'C#4': [[...ALL_LEFT, ...ALL_RIGHT, 'Cs']],
  D4: [[...ALL_LEFT, ...ALL_RIGHT]],
  Eb4: [[...ALL_LEFT, ...ALL_RIGHT, 'Eb']],
  E4: [[...ALL_LEFT, 'R1', 'R2', 'Eb']],
  F4: [[...ALL_LEFT, 'R1', 'Eb']],
  'F#4': [[...ALL_LEFT, 'R3', 'Eb']],
  G4: [[...ALL_LEFT, 'Eb']],
  'G#4': [[...ALL_LEFT, 'Gs', 'Eb']],
  A4: [['T', 'L1', 'L2', 'Eb']],
  Bb4: [['T', 'L1', 'R1', 'Eb'], ['Tb', 'L1', 'Eb']],
  B4: [['T', 'L1', 'Eb']],
  C5: [['L1', 'Eb']],
  'C#5': [['Eb']],
  D5: [['T', 'L2', 'L3', ...ALL_RIGHT, 'Eb']],
  Eb5: [[...ALL_LEFT, ...ALL_RIGHT, 'Eb']],
  E5: [[...ALL_LEFT, 'R1', 'R2', 'Eb']],
  F5: [[...ALL_LEFT, 'R1', 'Eb']],
  'F#5': [[...ALL_LEFT, 'R3', 'Eb']],
  G5: [[...ALL_LEFT, 'Eb']],
  'G#5': [[...ALL_LEFT, 'Gs', 'Eb']],
  A5: [['T', 'L1', 'L2', 'Eb']],
  Bb5: [['T', 'L1', 'R1', 'Eb'], ['Tb', 'L1', 'Eb']],
  B5: [['T', 'L1', 'Eb']],
  C6: [['L1', 'Eb']],
  'C#6': [['Eb']],
};

export const NOTES = Object.keys(FINGERINGS);

export const TIPS = {
  C4: 'Everything down, plus the low C roller. Keep the right pinky relaxed and the air slow.',
  'C#4': 'Like low C, but only the C♯ roller. Blow gently; this note loves to go sharp.',
  D4: 'All six fingers and the thumb, no pinky keys at all. The only common note without the E♭ key.',
  Eb4: 'Same as D, with the E♭ key added. From here on up the E♭ key stays down almost always.',
  E4: 'Lift the right ring finger. Keep the E♭ key down.',
  F4: 'Right index only on the right hand.',
  'F#4': 'The right ring finger goes down instead of the index. Easy to mix up with F.',
  G4: 'Left hand only, with the E♭ key. One of the first notes most players learn.',
  'G#4': 'G plus the left pinky lever. Also called A♭.',
  A4: 'Thumb, left index and middle. The tuning note.',
  Bb4: 'Two good ways: thumb, left index and right index ("1 and 1"), or the B♭ thumb lever with the left index.',
  B4: 'Thumb and left index. Usually the very first note.',
  C5: 'Left index only, no thumb. If it sounds like B, your thumb is still down.',
  'C#5': 'Nothing but the E♭ key. Needs a focused air stream or it goes sharp.',
  D5: 'Like low D, but lift the left index finger. That one change makes the second octave speak.',
  Eb5: 'Exactly the same fingering as low E♭: faster air and a smaller aperture take it up the octave.',
  E5: 'Same fingers as low E. Blow faster, aim the air slightly higher.',
  F5: 'Same as low F, faster air.',
  'F#5': 'Same as low F♯, faster air.',
  G5: 'Same as low G, faster air.',
  'G#5': 'Same as low G♯, faster air.',
  A5: 'Same as low A, faster air.',
  Bb5: 'Same as low B♭, faster air.',
  B5: 'Same as low B, faster air.',
  C6: 'Same as C5: left index and the E♭ key, faster air.',
  'C#6': 'All open with the E♭ key, like C♯5, faster air. Watch the pitch.',
};

export const LEVELS = [
  { id: 'bag', name: 'B, A, G', tip: 'The first three notes: left hand only.', notes: ['B4', 'A4', 'G4'] },
  { id: 'bagcd', name: 'Adding C and D', tip: 'C has no thumb. D lifts the left index finger.', notes: ['B4', 'A4', 'G4', 'C5', 'D5'] },
  { id: 'low', name: 'Down to low D', tip: 'The right hand joins in: F, E and D.', notes: ['G4', 'F4', 'E4', 'D4', 'A4', 'B4'] },
  { id: 'octave1', name: 'First octave', tip: 'Every natural note from low C to D.', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5'] },
  { id: 'octave2', name: 'Second octave', tip: 'Same fingers, faster air. Only D changes.', notes: ['D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'] },
  { id: 'acc1', name: 'Sharps and flats', tip: 'F♯, B♭, E♭, G♯ and the two C♯s.', notes: ['F#4', 'Bb4', 'Eb4', 'G#4', 'C#4', 'C#5', 'F#5', 'Bb5'] },
  { id: 'all', name: 'Everything', tip: 'Two octaves, every note.', notes: NOTES },
];

export function parseKey(key) {
  return parseNote(key);
}

export function displayName(key) {
  const n = parseNote(key);
  return `${noteName(n)}${n.octave}`;
}

export function pitchClassOf(key) {
  return pitchClass(parseNote(key));
}

export function midiOf(key) {
  return midi(parseNote(key));
}

export function primary(key) {
  return FINGERINGS[key][0];
}

export function alternatives(key) {
  return FINGERINGS[key];
}

function normalise(pressed) {
  const set = new Set(pressed);
  if (set.has('C')) set.delete('Cs');
  return set;
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

/** Does this set of pressed keys play the note? Any accepted alternative counts. */
export function matches(key, pressed) {
  const p = normalise(pressed);
  return FINGERINGS[key].some((alt) => sameSet(normalise(alt), p));
}

/** Compared with the closest accepted fingering: keys you forgot and keys you added. */
export function diff(key, pressed) {
  const p = normalise(pressed);
  let best = null;
  for (const alt of FINGERINGS[key]) {
    const a = normalise(alt);
    const missing = [...a].filter((k) => !p.has(k));
    const extra = [...p].filter((k) => !a.has(k));
    if (!best || missing.length + extra.length < best.missing.length + best.extra.length) best = { missing, extra, target: alt };
  }
  return best;
}

/** Which notes does a fingering play? Usually two (an octave apart), sometimes none. */
export function notesFor(pressed) {
  return NOTES.filter((k) => matches(k, pressed));
}

export function starsFor(correct, total) {
  const f = total ? correct / total : 0;
  return f >= 0.95 ? 3 : f >= 0.8 ? 2 : f >= 0.6 ? 1 : 0;
}

export const PASS_FRACTION = 0.8;
