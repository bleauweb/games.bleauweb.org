// Question building: weighted by what you have missed, with distractors from the same part of the world.
import { COUNTRIES, countriesFor, flag } from './data.js';

export const MODES = {
  capital: { name: 'Capital?', ask: (c) => `What is the capital of ${c.name}?`, answer: (c) => c.capital, options: (c) => c.capital },
  country: { name: 'Country?', ask: (c) => `${c.capital} is the capital of…`, answer: (c) => c.name, options: (c) => c.name },
  flag: { name: 'Flag?', ask: (c) => `${flag(c.code)}`, answer: (c) => c.name, options: (c) => c.name, big: true },
  pickflag: { name: 'Which flag?', ask: (c) => `Which flag is ${c.name}?`, answer: (c) => flag(c.code), options: (c) => flag(c.code), flags: true },
};

export function pickCountry(pool, stats = {}, rng = Math.random, lastCode = null) {
  const weights = pool.map((c) => {
    if (c.code === lastCode && pool.length > 1) return 0;
    const st = stats[c.code];
    return st && st.seen ? 1 + (4 * st.wrong) / st.seen : 1.5;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Four options: the answer plus three distractors, preferring the same region. */
export function makeQuestion(level, modeId, stats = {}, rng = Math.random, lastCode = null) {
  const pool = countriesFor(level);
  const target = pickCountry(pool, stats, rng, lastCode);
  const mode = MODES[modeId];
  const same = COUNTRIES.filter((c) => c.region === target.region && c.code !== target.code);
  const others = COUNTRIES.filter((c) => c.region !== target.region);
  const distractors = [];
  const used = new Set([target.code]);
  const take = (from) => {
    const candidates = from.filter((c) => !used.has(c.code));
    if (!candidates.length) return false;
    const c = candidates[Math.floor(rng() * candidates.length)];
    used.add(c.code);
    distractors.push(c);
    return true;
  };
  while (distractors.length < 3 && take(same));
  while (distractors.length < 3 && take(others));
  const options = [target, ...distractors].map((c) => ({ code: c.code, label: mode.options(c) }));
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { target, mode: modeId, prompt: mode.ask(target), answer: mode.answer(target), options };
}

export function starsFor(correct, total) {
  const f = total ? correct / total : 0;
  return f >= 0.95 ? 3 : f >= 0.8 ? 2 : f >= 0.6 ? 1 : 0;
}
