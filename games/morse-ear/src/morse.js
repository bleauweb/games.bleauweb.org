// Morse code: the table, Koch lesson order, timing, and a decoder for hand-keyed input.

export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.', '=': '-...-',
};

export const REVERSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

/** Koch order: start with two characters at full speed, add one at a time. */
export const KOCH = 'KMRSUAPTLOWI.NJEF0Y,VG5/Q9ZH38B?427C1D6X'.split('');

export function lessonChars(lesson) {
  return KOCH.slice(0, Math.min(KOCH.length, lesson + 1));
}

export const LESSON_COUNT = KOCH.length - 1;

export function encode(text) {
  return text
    .toUpperCase()
    .split(' ')
    .map((word) => word.split('').map((c) => MORSE[c] || '').filter(Boolean).join(' '))
    .join(' / ');
}

export function decode(code) {
  return code
    .trim()
    .split(/\s*\/\s*/)
    .map((word) => word.split(/\s+/).map((c) => REVERSE[c] || '�').join(''))
    .join(' ');
}

/**
 * Timing in ms. Character speed from `wpm` (PARIS: dit = 1200 / wpm). With Farnsworth,
 * characters are sent at `wpm` but the gaps between them are stretched so the overall
 * speed is `effective` words per minute.
 */
export function timing(wpm = 20, effective = wpm) {
  const dit = 1200 / wpm;
  let charGap = 3 * dit;
  let wordGap = 7 * dit;
  if (effective < wpm) {
    // PARIS is 50 units; 31 of them are inside characters at `wpm`, the other 19 are gaps.
    const total = (60000 / effective) * (50 / 50); // ms per word at the effective speed
    const inside = 31 * dit;
    const gapUnit = (total - inside) / 19;
    charGap = 3 * gapUnit;
    wordGap = 7 * gapUnit;
  }
  return { dit, dah: 3 * dit, gap: dit, charGap, wordGap };
}

/** Tone segments for a text: [{ at, dur }] in ms from 0, plus the total length. */
export function schedule(text, wpm = 20, effective = wpm) {
  const t = timing(wpm, effective);
  const tones = [];
  let at = 0;
  const words = text.toUpperCase().split(' ');
  words.forEach((word, wi) => {
    const chars = word.split('').filter((c) => MORSE[c]);
    chars.forEach((c, ci) => {
      const code = MORSE[c];
      for (let i = 0; i < code.length; i++) {
        const dur = code[i] === '.' ? t.dit : t.dah;
        tones.push({ at, dur, char: c });
        at += dur + (i < code.length - 1 ? t.gap : 0);
      }
      if (ci < chars.length - 1) at += t.charGap;
    });
    if (wi < words.length - 1) at += t.wordGap;
  });
  return { tones, total: at };
}

export function randomGroup(chars, len, rng = Math.random) {
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)];
  return s;
}

/** Words made only of learned characters, for the Words mode. */
export const WORDS = 'THE AND FOR ARE BUT NOT YOU ALL ANY CAN HAD HER WAS ONE OUR OUT DAY GET HAS HIM HIS HOW MAN NEW NOW OLD SEE TWO WAY WHO BOY DID ITS LET PUT SAY SHE TOO USE MOM DAD SUN SEA SKY RUN TOP TEA RAT CAT DOG BIG RED HOT SIT SET MAP ART ARM SAW SAT STAR TRAM MARS SOUP ROAM PARK TRAP TOAST SALT MOST LAST ROOM WORK PLAN SLOW TOWN STOP WOOD MOON NOON LOOK LAMP WARM POST LOST SPOT SORT TRUST STORM SPORT STAMP SMART PAINT POINT TRAIL TOWEL WATER PAPER TOTAL SOLAR ROAST RADIO PILOT MOTOR'.split(' ');

export function wordsFrom(chars) {
  const set = new Set(chars);
  return WORDS.filter((w) => w.split('').every((c) => set.has(c)));
}

/**
 * Decode hand keying. `events` is a list of { down: ms, up: ms } presses in order.
 * `unit` is the dit length in ms the keyer is aiming for. Returns the code string with
 * spaces between characters and " / " between words.
 */
export function keyedToCode(events, unit) {
  let code = '';
  events.forEach((e, i) => {
    if (i > 0) {
      const gap = e.down - events[i - 1].up;
      if (gap > unit * 5) code += ' / ';
      else if (gap > unit * 2) code += ' ';
    }
    code += e.up - e.down < unit * 2 ? '.' : '-';
  });
  return code;
}
