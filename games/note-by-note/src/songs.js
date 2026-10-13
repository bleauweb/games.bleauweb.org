// Public-domain melodies, written out with bar lines so the tests can check every bar.
//
// Format: tokens separated by spaces, "|" between bars. A token is PITCH:DURATION, where the
// pitch is like C4, F#5, Bb3 or "r" for a rest, and the duration is w h q e s (whole, half,
// quarter, eighth, sixteenth), with a trailing "." for dotted. `pickup` is the length of the
// opening partial bar in quarter beats. Tempo is quarter notes per minute.
import { parseNote, pitchClass, midi, staffPos } from '../../treble-maker/src/music.js';

const DUR = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };

export const SONGS = [
  {
    id: 'hot-cross-buns',
    title: 'Hot Cross Buns',
    origin: 'English street cry, 18th century',
    level: 'Beginner',
    time: '4/4',
    tempo: 96,
    notes: 'E4:q D4:q C4:h | E4:q D4:q C4:h | C4:e C4:e C4:e C4:e D4:e D4:e D4:e D4:e | E4:q D4:q C4:h',
  },
  {
    id: 'mary-lamb',
    title: 'Mary Had a Little Lamb',
    origin: 'Lowell Mason, 1830',
    level: 'Beginner',
    time: '4/4',
    tempo: 100,
    notes: 'E4:q D4:q C4:q D4:q | E4:q E4:q E4:h | D4:q D4:q D4:h | E4:q G4:q G4:h | E4:q D4:q C4:q D4:q | E4:q E4:q E4:q E4:q | D4:q D4:q E4:q D4:q | C4:w',
  },
  {
    id: 'twinkle',
    title: 'Twinkle, Twinkle, Little Star',
    origin: 'French melody, 1761',
    level: 'Beginner',
    time: '4/4',
    tempo: 100,
    notes: 'C4:q C4:q G4:q G4:q | A4:q A4:q G4:h | F4:q F4:q E4:q E4:q | D4:q D4:q C4:h | G4:q G4:q F4:q F4:q | E4:q E4:q D4:h | G4:q G4:q F4:q F4:q | E4:q E4:q D4:h | C4:q C4:q G4:q G4:q | A4:q A4:q G4:h | F4:q F4:q E4:q E4:q | D4:q D4:q C4:h',
  },
  {
    id: 'row-boat',
    title: 'Row, Row, Row Your Boat',
    origin: 'American round, 1852',
    level: 'Beginner',
    time: '6/8',
    tempo: 120,
    notes: 'C4:q. C4:q. | C4:q D4:e E4:q. | E4:q D4:e E4:q F4:e | G4:h. | C5:e C5:e C5:e G4:e G4:e G4:e | E4:e E4:e E4:e C4:e C4:e C4:e | G4:q F4:e E4:q D4:e | C4:h.',
  },
  {
    id: 'london-bridge',
    title: 'London Bridge Is Falling Down',
    origin: 'English nursery rhyme',
    level: 'Beginner',
    time: '4/4',
    tempo: 104,
    notes: 'G4:q. A4:e G4:q F4:q | E4:q F4:q G4:h | D4:q E4:q F4:h | E4:q F4:q G4:h | G4:q. A4:e G4:q F4:q | E4:q F4:q G4:h | D4:h G4:h | E4:q C4:h.',
  },
  {
    id: 'frere-jacques',
    title: 'Frère Jacques',
    origin: 'French round, 18th century',
    level: 'Easy',
    time: '4/4',
    tempo: 108,
    notes: 'C4:q D4:q E4:q C4:q | C4:q D4:q E4:q C4:q | E4:q F4:q G4:h | E4:q F4:q G4:h | G4:e A4:e G4:e F4:e E4:q C4:q | G4:e A4:e G4:e F4:e E4:q C4:q | C4:q G3:q C4:h | C4:q G3:q C4:h',
  },
  {
    id: 'old-macdonald',
    title: 'Old MacDonald Had a Farm',
    origin: 'American folk song',
    level: 'Easy',
    time: '4/4',
    tempo: 110,
    notes: 'G4:q G4:q G4:q D4:q | E4:q E4:q D4:h | B4:q B4:q A4:q A4:q | G4:h. D4:q | G4:q G4:q G4:q D4:q | E4:q E4:q D4:h | B4:q B4:q A4:q A4:q | G4:w',
  },
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    origin: 'Ludwig van Beethoven, 1824',
    level: 'Easy',
    time: '4/4',
    tempo: 108,
    notes: 'E4:q E4:q F4:q G4:q | G4:q F4:q E4:q D4:q | C4:q C4:q D4:q E4:q | E4:q. D4:e D4:h | E4:q E4:q F4:q G4:q | G4:q F4:q E4:q D4:q | C4:q C4:q D4:q E4:q | D4:q. C4:e C4:h | D4:q D4:q E4:q C4:q | D4:q E4:e F4:e E4:q C4:q | D4:q E4:e F4:e E4:q D4:q | C4:q D4:q G3:h | E4:q E4:q F4:q G4:q | G4:q F4:q E4:q D4:q | C4:q C4:q D4:q E4:q | D4:q. C4:e C4:h',
  },
  {
    id: 'jingle-bells',
    title: 'Jingle Bells (chorus)',
    origin: 'James Lord Pierpont, 1857',
    level: 'Easy',
    time: '4/4',
    tempo: 120,
    notes: 'E4:q E4:q E4:h | E4:q E4:q E4:h | E4:q G4:q C4:q. D4:e | E4:w | F4:q F4:q F4:q. F4:e | F4:q E4:q E4:q E4:e E4:e | E4:q D4:q D4:q E4:q | D4:h G4:h | E4:q E4:q E4:h | E4:q E4:q E4:h | E4:q G4:q C4:q. D4:e | E4:w | F4:q F4:q F4:q. F4:e | F4:q E4:q E4:q E4:e E4:e | G4:q G4:q F4:q D4:q | C4:w',
  },
  {
    id: 'yankee-doodle',
    title: 'Yankee Doodle',
    origin: 'American, 18th century',
    level: 'Easy',
    time: '2/4',
    tempo: 112,
    notes: 'C4:e C4:e D4:e E4:e | C4:e E4:e D4:e G3:e | C4:e C4:e D4:e E4:e | C4:q B3:q | C4:e C4:e D4:e E4:e | F4:e E4:e D4:e C4:e | B3:e G3:e A3:e B3:e | C4:q C4:q',
  },
  {
    id: 'pop-weasel',
    title: 'Pop Goes the Weasel',
    origin: 'English, 1850s',
    level: 'Easy',
    time: '6/8',
    tempo: 116,
    notes: 'C4:q C4:e D4:q D4:e | E4:e G4:e E4:e C4:q. | C4:q C4:e D4:q D4:e | E4:q. C4:q. | C4:q C4:e D4:q D4:e | E4:e G4:e E4:e C4:q. | A4:q. D4:q F4:e | E4:q. C4:q.',
  },
  {
    id: 'happy-birthday',
    title: 'Happy Birthday to You',
    origin: 'Mildred and Patty Hill, 1893',
    level: 'Medium',
    time: '3/4',
    tempo: 100,
    pickup: 1,
    notes: 'G4:e G4:e | A4:q G4:q C5:q | B4:h G4:e G4:e | A4:q G4:q D5:q | C5:h G4:e G4:e | G5:q E5:q C5:q | B4:q A4:q F5:e F5:e | E5:q C5:q D5:q | C5:h.',
  },
  {
    id: 'oh-susanna',
    title: 'Oh! Susanna',
    origin: 'Stephen Foster, 1848',
    level: 'Medium',
    time: '2/4',
    tempo: 112,
    pickup: 1,
    notes: 'C4:e D4:e | E4:q G4:q | G4:q A4:q | G4:q E4:q | C4:q. D4:e | E4:q E4:q | D4:q C4:q | D4:h | r:q C4:e D4:e | E4:q G4:q | G4:q A4:q | G4:q E4:q | C4:q. D4:e | E4:q E4:q | D4:q D4:q | C4:h',
  },
  {
    id: 'saints',
    title: 'When the Saints Go Marching In',
    origin: 'American spiritual',
    level: 'Medium',
    time: '4/4',
    tempo: 116,
    pickup: 3,
    notes: 'C4:q E4:q F4:q | G4:w | r:q C4:q E4:q F4:q | G4:w | r:q C4:q E4:q F4:q | G4:h E4:h | C4:h E4:h | D4:w | r:q E4:q E4:q D4:q | C4:h. E4:q | G4:q G4:q F4:h | r:q E4:q F4:q G4:q | E4:q C4:q D4:h | C4:w',
  },
  {
    id: 'silent-night',
    title: 'Silent Night',
    origin: 'Franz Xaver Gruber, 1818',
    level: 'Medium',
    time: '3/4',
    tempo: 90,
    notes: 'G4:q. A4:e G4:q | E4:h. | G4:q. A4:e G4:q | E4:h. | D5:h D5:q | B4:h. | C5:h C5:q | G4:h. | A4:h A4:q | C5:q. B4:e A4:q | G4:q. A4:e G4:q | E4:h. | A4:h A4:q | C5:q. B4:e A4:q | G4:q. A4:e G4:q | E4:h. | D5:h D5:q | F5:q. D5:e B4:q | C5:h. | E5:h. | C5:q G4:q E4:q | G4:q. F4:e D4:q | C4:h. | C4:h.',
  },
  {
    id: 'auld-lang-syne',
    title: 'Auld Lang Syne',
    origin: 'Scottish, words by Robert Burns, 1788',
    level: 'Medium',
    time: '4/4',
    tempo: 96,
    pickup: 1,
    notes: 'C4:q | F4:q. E4:e F4:q A4:q | G4:q. F4:e G4:q A4:q | F4:q. F4:e A4:q C5:q | D5:h. D5:q | C5:q. A4:e A4:q F4:q | G4:q. F4:e G4:q A4:q | F4:q. D4:e D4:q C4:q | F4:h. D5:q | C5:q. A4:e A4:q F4:q | G4:q. F4:e G4:q D5:q | C5:q. A4:e A4:q C5:q | D5:h. D5:q | C5:q. A4:e A4:q F4:q | G4:q. F4:e G4:q A4:q | F4:q. D4:e D4:q C4:q | F4:h.',
  },
  {
    id: 'we-wish',
    title: 'We Wish You a Merry Christmas',
    origin: 'English carol, 16th century',
    level: 'Medium',
    time: '3/4',
    tempo: 120,
    pickup: 1,
    notes: 'C4:q | F4:q F4:e G4:e F4:e E4:e | D4:q D4:q D4:q | G4:q G4:e A4:e G4:e F4:e | E4:q C4:q C4:q | A4:q A4:e Bb4:e A4:e G4:e | F4:q D4:q C4:e C4:e | D4:q G4:q E4:q | F4:h.',
  },
  {
    id: 'eine-kleine',
    title: 'Eine kleine Nachtmusik (opening)',
    origin: 'Wolfgang Amadeus Mozart, 1787',
    level: 'Hard',
    time: '4/4',
    tempo: 120,
    notes: 'G4:q r:e D4:e G4:q r:e D4:e | G4:e D4:e G4:e B4:e D5:h | C5:q r:e A4:e C5:q r:e A4:e | C5:e A4:e F#4:e A4:e D4:h',
  },
  {
    id: 'minuet-g',
    title: 'Minuet in G',
    origin: 'Christian Petzold, c. 1725',
    level: 'Hard',
    time: '3/4',
    tempo: 112,
    notes: 'D5:q G4:e A4:e B4:e C5:e | D5:q G4:q G4:q | E5:q C5:e D5:e E5:e F#5:e | G5:q G4:q G4:q | C5:q D5:e C5:e B4:e A4:e | B4:q C5:e B4:e A4:e G4:e | F#4:q G4:e A4:e B4:e G4:e | A4:h. | D5:q G4:e A4:e B4:e C5:e | D5:q G4:q G4:q | E5:q C5:e D5:e E5:e F#5:e | G5:q G4:q G4:q | C5:q D5:e C5:e B4:e A4:e | B4:q C5:e B4:e A4:e G4:e | A4:q B4:e A4:e G4:e F#4:e | G4:h.',
  },
  {
    id: 'fur-elise',
    title: 'Für Elise (opening)',
    origin: 'Ludwig van Beethoven, 1810',
    level: 'Hard',
    time: '3/8',
    tempo: 72,
    pickup: 0.5,
    notes: 'E5:s D#5:s | E5:s D#5:s E5:s B4:s D5:s C5:s | A4:e r:s C4:s E4:s A4:s | B4:e r:s E4:s G#4:s B4:s | C5:e r:s E4:s E5:s D#5:s | E5:s D#5:s E5:s B4:s D5:s C5:s | A4:e r:s C4:s E4:s A4:s | B4:e r:s E4:s C5:s B4:s | A4:q.',
  },
];

export const LEVEL_ORDER = ['Beginner', 'Easy', 'Medium', 'Hard'];

export function parseDuration(d) {
  const dotted = d.endsWith('.');
  const base = DUR[dotted ? d.slice(0, -1) : d];
  if (!base) throw new Error(`bad duration ${d}`);
  return dotted ? base * 1.5 : base;
}

/**
 * Turn a song definition into a timeline: events with start beat, duration, pitch
 * (null for rests), and the bar they belong to. Beats are quarter notes throughout.
 */
export function parseSong(def) {
  const [num, den] = def.time.split('/').map(Number);
  const beatsPerBar = (num * 4) / den;
  const pickup = def.pickup || 0;
  const bars = def.notes.split('|').map((b) => b.trim()).filter(Boolean);
  const events = [];
  const barStarts = [];
  let t = 0;
  let noteIndex = 0;
  bars.forEach((bar, bi) => {
    barStarts.push(t);
    for (const tok of bar.split(/\s+/)) {
      const [p, d] = tok.split(':');
      const dur = parseDuration(d);
      if (p === 'r') {
        events.push({ t, dur, note: null, bar: bi, rest: true });
      } else {
        const note = parseNote(p);
        events.push({ t, dur, note, pc: pitchClass(note), midi: midi(note), pos: staffPos(note, 'treble'), bar: bi, rest: false, index: noteIndex++ });
      }
      t += dur;
    }
  });
  const barLines = [];
  // The first full bar starts after the pickup; before that only the pickup bar exists.
  let x = pickup || beatsPerBar;
  while (x < t - 1e-6) {
    barLines.push(x);
    x += beatsPerBar;
  }
  return {
    ...def,
    beatsPerBar,
    pickup,
    events,
    noteCount: noteIndex,
    total: t,
    barStarts,
    barLines,
    barCount: bars.length,
  };
}

/** Beat lengths of every bar, for the tests. */
export function barLengths(def) {
  const bars = def.notes.split('|').map((b) => b.trim()).filter(Boolean);
  return bars.map((bar) => bar.split(/\s+/).reduce((sum, tok) => sum + parseDuration(tok.split(':')[1]), 0));
}

/** Phrases: groups of bars to practise. Four bars each, aligned to the pickup. */
export function phrasesOf(song, barsPerPhrase = 4) {
  const phrases = [];
  const firstFull = song.pickup ? 1 : 0;
  let start = 0;
  let b = firstFull;
  while (b < song.barCount) {
    const end = Math.min(song.barCount, b + barsPerPhrase);
    phrases.push({ fromBar: start, toBar: end }); // bars [fromBar, toBar)
    start = end;
    b = end;
  }
  if (phrases.length === 0) phrases.push({ fromBar: 0, toBar: song.barCount });
  // A lonely last bar joins the phrase before it.
  if (phrases.length > 1 && phrases[phrases.length - 1].toBar - phrases[phrases.length - 1].fromBar === 1) {
    phrases[phrases.length - 2].toBar = song.barCount;
    phrases.pop();
  }
  return phrases;
}

export function eventsIn(song, phrase) {
  return song.events.filter((e) => e.bar >= phrase.fromBar && e.bar < phrase.toBar);
}

export function starsFor(accuracy) {
  return accuracy >= 0.95 ? 3 : accuracy >= 0.8 ? 2 : accuracy >= 0.6 ? 1 : 0;
}
