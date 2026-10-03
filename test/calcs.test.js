// Valeurs attendues reprises de l'auto-test de la version web (ATELIER_SELFTEST, tolérance ± 1 %).
import { describe, expect, it } from 'vitest';
import { CALCS, PHYS } from '../src/calcs.js';
import { defaults, parseNum } from '../src/inputs.js';

const run = (id, over = {}) => CALCS[id].run({ ...defaults(id), ...over });
/** Valeur numérique d'une ligne de résultat (« 1 234,5 kW » → 1234.5). */
const val = (r, label, n = 0) => {
  const rows = r.rows.filter((x) => x[0] === label);
  expect(rows.length, `ligne « ${label} »`).toBeGreaterThan(n);
  return parseNum(rows[n][1].split(/[  ]/).find((p) => /^[-−]?\d/.test(p)));
};
const near = (got, want) => expect(Math.abs(got - want)).toBeLessThanOrEqual(Math.abs(want) * 0.01 + 1e-9);

describe('physique de l’air humide', () => {
  it('26 °C / 50 %', () => {
    const x = PHYS.x(26, 50);
    near(x * 1000, 10.5);
    near(PHYS.h(26, x), 52.9);
    near(PHYS.dew(x), 14.8);
    near(PHYS.wet(26, x), 18.7);
  });
});

describe('calculateurs (valeurs par défaut)', () => {
  it('conv', () => {
    const r = run('conv');
    near(r.rows[1][1].replace(/\D/g, '') * 1, 341214);
  });
  it('reynolds', () => {
    const r = run('reynolds');
    near(val(r, 'Nombre de Reynolds'), 132450);
    near(val(r, 'λ (Colebrook)'), 0.0191);
    near(val(r, 'Perte de charge linéaire'), 0.71);
  });
  it('psychro', () => {
    const r = run('psychro');
    expect(r.rows.find((x) => x[0] === 'Mélange M : θ / HR')[1]).toMatch(/^27,5/);
    near(val(r, 'Puissance batterie (M → S)'), 46.2);
    near(val(r, 'Condensats'), 13.2);
  });
  it('deperd', () => {
    const r = run('deperd');
    near(val(r, 'Total avec relance'), 509);
    near(val(r, 'Ratio'), 17);
  });
  it('frigo', () => {
    const r = run('frigo');
    near(val(r, 'Puissance sensible'), 1572);
    near(val(r, 'Puissance totale'), 1824);
    near(val(r, 'Ratio'), 61);
  });
  it('vase', () => {
    const r = run('vase');
    near(val(r, 'Volume nominal calculé'), 243);
    near(val(r, 'Vase proposé'), 250);
  });
  it('terminal', () => {
    const r = run('terminal');
    near(val(r, "Débit d'eau"), 0.43);
    near(val(r, "Débit d'air"), 735);
  });
  it('en378', () => {
    const r = run('en378');
    near(val(r, 'Charge max (PL × V)'), 3.29);
    near(val(r, 'Charge max (formule LFL)'), 5.62);
  });
  it('cta', () => {
    const r = run('cta');
    near(val(r, 'Section de passage'), 0.83);
    near(val(r, 'Batterie chaude'), 14.7);
    near(val(r, 'Batterie froide'), 56.5);
    near(val(r, 'Condensats'), 27.4);
  });
  it('fan', () => {
    const r = run('fan');
    near(val(r, 'Puissance absorbée'), 2.78);
    near(val(r, 'SFP'), 1333);
    near(val(r, 'Puissance'), 1.42);
  });
  it('gaine', () => {
    const r = run('gaine');
    expect(r.rows.find((x) => x[0] === 'Section retenue')[1]).toBe('Ø 500 mm');
    near(val(r, 'Vitesse réelle'), 4.24);
  });
  it('hydro', () => {
    const r = run('hydro');
    near(val(r, 'Débit'), 61.9);
    expect(r.rows.find((x) => x[0] === 'DN retenu')[1]).toMatch(/^DN125/);
    near(val(r, 'Perte de charge linéaire'), 115);
    near(val(r, 'HMT'), 11.2);
  });
  it('airneuf', () => {
    const r = run('airneuf');
    near(val(r, "Débit d'air neuf"), 1250);
    near(val(r, 'Débit pour tenir le CO₂ visé'), 31);
  });
  it('dfmeca', () => {
    const r = run('dfmeca');
    near(val(r, "Débit d'extraction"), 35.55);
    near(val(r, "Section libre d'amenée minimale"), 7.11);
    near(val(r, 'Débit du ventilateur (fuites incluses)'), 42.7);
  });
  it('dfnat', () => {
    const r = run('dfnat');
    near(val(r, 'SUE minimale'), 4);
    near(val(r, "Nombre d'exutoires"), 4);
  });
  it('tertiaire', () => {
    near(val(run('tertiaire'), 'Objectif 2030'), 720000);
  });
  it('puissance : eau, air et les trois inconnues', () => {
    near(val(run('puissance', { fl: 'eau', ca: 'p', q: 1, dt: 5 }), 'Puissance'), 5.815);
    near(val(run('puissance', { fl: 'air', ca: 'p', q: 1000, dt: 10 }), 'Puissance'), 3.4);
    near(val(run('puissance', { fl: 'eau', ca: 'q', p: 360, dt: 5 }), 'Débit'), 61.91); // même résultat que l'outil hydro
    near(val(run('puissance', { fl: 'air', ca: 'q', p: 2.5, dt: 10 }), 'Débit'), 735); // même résultat que l'outil terminal
    near(val(run('puissance', { fl: 'air', ca: 'dt', p: 3.4, q: 1000 }), 'ΔT'), 10);
    expect(run('puissance', { ca: 'q', dt: 0 }).st[0][0]).toBe('bad');
  });
  it('tous les calculateurs tournent sans erreur', () => {
    for (const id of Object.keys(CALCS)) expect(() => run(id), id).not.toThrow();
  });
});

describe('saisie', () => {
  it('accepte la virgule, les espaces et le signe moins typographique', () => {
    expect(parseNum('2,5')).toBe(2.5);
    expect(parseNum('1 200 000')).toBe(1200000);
    expect(parseNum('−7')).toBe(-7);
    expect(parseNum('-7')).toBe(-7);
    expect(Number.isNaN(parseNum(''))).toBe(true);
    expect(Number.isNaN(parseNum('abc'))).toBe(true);
  });
});
