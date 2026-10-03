// Saisie des calculateurs : lecture des nombres « à la française » et valeurs par défaut.
import { CALCS } from './calcs.js';

/** « 2,5 » → 2.5 ; « 1 200 » → 1200 ; « −7 » → -7 ; texte vide ou invalide → NaN. */
export function parseNum(raw) {
  const s = String(raw ?? '')
    .replace(/[\s  ]/g, '')
    .replace(/[−–]/g, '-')
    .replace(',', '.');
  return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN;
}

/** Valeurs par défaut d'un calculateur, typées (nombre ou option). */
export function defaults(id) {
  return Object.fromEntries(CALCS[id].inputs.map((i) => [i.id, i.t === 's' ? i.v : Number(i.v)]));
}

/** Valeurs saisies (texte) → valeurs typées passées à run(). */
export function typed(id, raw) {
  return Object.fromEntries(CALCS[id].inputs.map((i) => [i.id, i.t === 's' ? raw[i.id] : parseNum(raw[i.id])]));
}

/** Nombre affiché dans un champ (virgule décimale). */
export const showNum = (n) => String(n).replace('.', ',');
