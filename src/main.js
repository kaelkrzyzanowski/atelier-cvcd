// Atelier CVCD — application de calculateurs de pré-dimensionnement, pensée pour le chantier.
// Deux écrans : la liste des outils (#/) et un outil (#/<id>). Tout fonctionne hors ligne.
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './style.css';
import { Capacitor } from '@capacitor/core';
import { CALCS, PHYS } from './calcs.js';
import { showNum, typed } from './inputs.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const main = $('#main');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/* Espace insécable entre un nombre et son unité */
const nbsp = (h) =>
  h.replace(/(\d) (m³\/h|m³\/s|m²|m\/s|kW|kWh|W\/m²|W|Pa\/m|Pa|kPa|°C|%|kg|L\/h|L|bar|g\/kg|kJ\/kg|mm|m|K|ppm|UP|MW|GWh|ans)(?![\wÀ-ÿ])/g, '$1 $2');

/* ---------- Catalogue ---------- */
const GROUPS = [
  ['Puissance, conversions, écoulements', ['puissance', 'conv', 'terminal', 'reynolds']],
  ['Air et ventilation', ['airneuf', 'cta', 'fan', 'gaine', 'psychro']],
  ['Chauffage et climatisation', ['deperd', 'frigo']],
  ['Hydraulique', ['hydro', 'vase']],
  ['Froid', ['en378']],
  ['Désenfumage', ['dfmeca', 'dfnat']],
  ['Réglementaire', ['bacs', 'tertiaire', 'textes']],
];

/* ---------- Mémoire locale : thème, dernières valeurs saisies, outils récents ---------- */
const KEY = 'atelier-cvcd-app-v1';
let S = { theme: null, vals: {}, recent: [] };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) S = Object.assign(S, JSON.parse(raw));
} catch {}
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {}
};
const rawVals = (id) => {
  const c = CALCS[id];
  const v = (S.vals[id] ||= {});
  for (const i of c.inputs) if (v[i.id] === undefined) v[i.id] = i.t === 's' ? i.v : showNum(i.v);
  return v;
};

/* ---------- Plateforme : Android (Capacitor) ou navigateur ---------- */
const native = Capacitor.isNativePlatform() ? import('./native.js') : null;

/* ---------- Thème ---------- */
const isDark = () => (S.theme ? S.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
function applyTheme() {
  if (S.theme) document.documentElement.setAttribute('data-theme', S.theme);
  else document.documentElement.removeAttribute('data-theme');
  native?.then((n) => n.setBarsStyle());
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
$('#themeBtn').addEventListener('click', () => {
  S.theme = isDark() ? 'light' : 'dark';
  applyTheme();
  save();
});

/* ---------- Toast ---------- */
let toastT;
function toast(msg) {
  let t = $('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 3000);
}

/* ---------- Accueil ---------- */
let query = '';
const chev = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const toolLink = (id) => {
  const c = CALCS[id];
  return `<a class="tool" href="#/${id}"><span class="txt"><b>${esc(c.t)}</b><small>${esc(c.ref)}</small></span>${chev}</a>`;
};
function pageHome() {
  return `<div class="search" role="search"><input id="q" type="search" placeholder="Rechercher un outil (gaine, vase, CTA…)" aria-label="Rechercher un outil" autocomplete="off" value="${esc(query)}"></div>
  <div id="lists"></div>
  <p class="foot">Pré-dimensionnement indicatif · référentiel au 1<sup>er</sup> octobre 2026 · à confirmer par une note de calcul.</p>`;
}
function fillLists() {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const match = (id) => {
    const c = CALCS[id];
    const x = norm([c.t, c.ref, c.f, ...c.inputs.map((i) => i.l)].join(' '));
    return words.every((w) => x.includes(w));
  };
  let h = '';
  if (!words.length) {
    const recent = S.recent.filter((id) => CALCS[id]).slice(0, 3);
    if (recent.length) h += `<section class="group"><h2>Récents</h2><div class="list">${recent.map(toolLink).join('')}</div></section>`;
  }
  for (const [g, ids] of GROUPS) {
    const hit = ids.filter((id) => CALCS[id] && match(id));
    if (hit.length) h += `<section class="group"><h2>${esc(g)}</h2><div class="list">${hit.map(toolLink).join('')}</div></section>`;
  }
  $('#lists').innerHTML = h || `<div class="list"><p class="empty">Aucun outil pour « ${esc(query)} ».</p></div>`;
}

/* ---------- Outil ---------- */
const NEG_UNITS = new Set(['°C']); // grandeurs pouvant être négatives : bouton ± (le clavier numérique n'a pas toujours de « − »)
function pageTool(id) {
  const c = CALCS[id];
  const vals = rawVals(id);
  const fields = c.inputs
    .map((i) => {
      const fid = `f-${i.id}`;
      const unit = i.u ? ` <span class="u">(${esc(i.u)})</span>` : '';
      const label = `<label for="${fid}">${esc(i.l)}${unit}${i.h ? `<small>${esc(i.h)}</small>` : ''}</label>`;
      if (i.t === 's') {
        const opts = i.o.map((o) => `<option value="${esc(o[0])}" ${String(vals[i.id]) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('');
        const wide = i.o.some((o) => o[1].length > 22) ? ' wide' : '';
        return `<div class="field${wide}" data-f="${i.id}">${label}<div class="ctl"><select id="${fid}" data-i="${i.id}">${opts}</select></div></div>`;
      }
      const signed = NEG_UNITS.has(i.u);
      const input = `<input id="${fid}" data-i="${i.id}" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" value="${esc(vals[i.id])}">`;
      return `<div class="field" data-f="${i.id}">${label}<div class="ctl${signed ? ' signed' : ''}">${signed ? `<button type="button" class="sign" data-sign="${i.id}" aria-label="Changer le signe">±</button>` : ''}${input}</div></div>`;
    })
    .join('');
  return `<div class="tool-head"><span class="ref">${esc(c.ref)}</span>${c.ind ? '<span class="tag-ind">indicatif</span>' : ''}</div>
  <section class="card" aria-labelledby="h-in"><div class="card-head"><h2 id="h-in">Données</h2><button class="btn small" type="button" data-act="reset">Valeurs par défaut</button></div>
    <div class="card-body">${fields}</div></section>
  <section class="card" id="results" aria-labelledby="h-out"><div class="card-head"><h2 id="h-out">Résultats</h2></div>
    <div class="card-body" id="out" aria-live="polite"></div></section>
  ${c.chart ? `<section class="card"><div class="card-body"><figure class="chart"><div class="figure" id="chart"></div><figcaption class="note">Diagramme simplifié à 101 325 Pa : courbes d'HR, isenthalpes en pointillés, points saisis et évolutions. Faire glisser pour voir tout le diagramme.</figcaption></figure></div></section>` : ''}
  <details class="card more"><summary>Formules et détail du calcul</summary><div class="card-body">
    <div class="formula">${esc(c.f)}</div><ol class="explain" id="explain"></ol>
    <p class="note">Hypothèses : air ρ = 1,2 kg/m³, cp = 1,006 kJ/kg·K ; eau 1,163 kWh/m³·K. Valeurs indicatives à confirmer par une note de calcul.</p>
  </div></details>`;
}

let current = null; // { id, result }
function runTool() {
  const { id } = current;
  const c = CALCS[id];
  const v = typed(id, rawVals(id));
  for (const i of c.inputs) {
    const f = $(`[data-f="${i.id}"]`, main);
    if (f) f.hidden = i.w ? !i.w(v) : false;
  }
  const shown = (i) => !i.w || i.w(v);
  const bad = c.inputs.filter((i) => i.t !== 's' && shown(i) && !Number.isFinite(v[i.id]));
  for (const i of c.inputs) if (i.t !== 's') $(`#f-${i.id}`, main)?.setAttribute('aria-invalid', String(bad.includes(i)));
  const out = $('#out', main);
  current.result = null;
  if (bad.length) {
    out.innerHTML = `<div class="status bad"><span>Valeur manquante ou invalide : ${bad.map((b) => esc(b.l)).join(', ')}.</span></div>`;
    return renderSummary();
  }
  let r;
  try {
    r = c.run(v);
  } catch (e) {
    out.innerHTML = `<div class="status bad"><span>Calcul impossible avec ces valeurs (${esc(e.message)}).</span></div>`;
    return renderSummary();
  }
  current.result = r;
  out.innerHTML = nbsp(
    `<div class="res-main">${r.rows.map((x) => `<div class="res ${x[2] ? 'big' : ''} ${x[0] ? '' : 'cont'}"><span>${esc(x[0])}</span><span>${esc(x[1])}</span></div>`).join('')}</div>` +
      r.st.map((s) => `<div class="status ${s[0]}"><span>${esc(s[1])}</span></div>`).join(''),
  );
  if (r.draw) drawPsy($('#chart', main), r.draw);
  $('#explain', main).innerHTML = nbsp(r.ex.map((e) => `<li>${esc(e)}</li>`).join(''));
  renderSummary();
}

/* Résumé collant : jusqu'à 3 résultats clés, masqué quand la carte Résultats est à l'écran. */
let resultsVisible = false;
function renderSummary() {
  const sum = $('#summary');
  if (!current) return (sum.hidden = true);
  const r = current.result;
  if (!r) {
    sum.className = 'summary bad';
    sum.innerHTML = '<span class="k"><b>Saisie incomplète</b></span>';
  } else {
    const big = r.rows.filter((x) => x[2] && x[0]).slice(0, 3);
    const rows = big.length ? big : r.rows.slice(0, 2);
    sum.className = 'summary';
    sum.innerHTML = nbsp(rows.map((x) => `<span class="k"><span>${esc(x[0])}</span><b>${esc(x[1])}</b></span>`).join(''));
  }
  sum.hidden = resultsVisible;
}
const io = new IntersectionObserver((entries) => {
  for (const e of entries) resultsVisible = e.isIntersecting;
  renderSummary();
}, { rootMargin: '0px 0px -140px 0px' }); // la carte doit dépasser la zone couverte par le résumé
$('#summary').addEventListener('click', () => $('#results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

/* Diagramme de l'air humide (SVG généré) */
function drawPsy(el, d) {
  const W = 800, H = 420, L = 50, R = 60, T = 20, B = 40, tmin = -10, tmax = 45, xmax = 25;
  const X = (t) => L + ((t - tmin) / (tmax - tmin)) * (W - L - R), Y = (x) => H - B - (x / xmax) * (H - T - B);
  let s = '';
  for (let t = -10; t <= 45; t += 5) s += `<line x1="${X(t)}" y1="${T}" x2="${X(t)}" y2="${H - B}" style="stroke:var(--line)"/><text x="${X(t)}" y="${H - B + 16}" text-anchor="middle" font-size="11">${t}</text>`;
  for (let x = 0; x <= 25; x += 5) s += `<line x1="${L}" y1="${Y(x)}" x2="${W - R}" y2="${Y(x)}" style="stroke:var(--line)"/><text x="${W - R + 6}" y="${Y(x) + 4}" font-size="11">${x}</text>`;
  for (let hr = 10; hr <= 100; hr += 10) {
    const pts = [];
    for (let t = tmin; t <= tmax; t += 0.5) {
      const xx = PHYS.x(t, hr) * 1000;
      if (xx > xmax) break;
      pts.push(X(t).toFixed(1) + ',' + Y(xx).toFixed(1));
    }
    s += `<polyline points="${pts.join(' ')}" fill="none" style="stroke:${hr === 100 ? 'var(--fg)' : 'var(--muted)'}" stroke-width="${hr === 100 ? 2 : 0.8}"/>`;
    const last = pts[pts.length - 1].split(',');
    if (hr % 20 === 0 || hr === 100) s += `<text x="${+last[0] - 4}" y="${+last[1] - 4}" font-size="10" text-anchor="end" class="t-muted">${hr} %</text>`;
  }
  for (const h of [0, 20, 40, 60, 80]) {
    const pts = [];
    for (let t = tmin; t <= tmax; t += 1) {
      const x = (h - 1.006 * t) / (2501 + 1.86 * t);
      if (x < 0 || x * 1000 > xmax || x > PHYS.x(t, 100)) continue;
      pts.push(X(t).toFixed(1) + ',' + Y(x * 1000).toFixed(1));
    }
    if (pts.length > 1) s += `<polyline points="${pts.join(' ')}" fill="none" style="stroke:var(--accent)" stroke-dasharray="4 4" stroke-width=".8"/><text x="${pts[0].split(',')[0]}" y="${+pts[0].split(',')[1] - 5}" font-size="10" style="fill:var(--accent)">${h} kJ/kg</text>`;
  }
  for (const [a, b] of d.lines || []) {
    const p = d.pts[a], q = d.pts[b];
    s += `<line x1="${X(p.t)}" y1="${Y(p.x * 1000)}" x2="${X(q.t)}" y2="${Y(q.x * 1000)}" style="stroke:var(--net-df)" stroke-width="2"/>`;
  }
  for (const p of d.pts) s += `<circle cx="${X(p.t)}" cy="${Y(p.x * 1000)}" r="5.5" style="fill:var(--accent);stroke:var(--surface)" stroke-width="1.5"/><text x="${X(p.t) + 8}" y="${Y(p.x * 1000) - 8}" font-size="13" font-weight="600">${p.l}</text>`;
  s += `<text x="${(W - R + L) / 2}" y="${H - 6}" text-anchor="middle" font-size="12">θ sèche (°C)</text><text x="${W - 12}" y="${T + 10}" font-size="12" text-anchor="end">x (g/kg)</text>`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagramme de l'air humide">${s}</svg>`;
  // Sur un écran étroit, centrer la vue sur les points saisis.
  const svg = el.querySelector('svg');
  const ts = d.pts.map((p) => p.t);
  const mid = (X(Math.min(...ts)) + X(Math.max(...ts))) / 2;
  el.scrollLeft = Math.max(0, (mid / W) * svg.clientWidth - el.clientWidth / 2);
}

/* ---------- Partage des résultats (texte pour SMS, mail, notes de chantier) ---------- */
function shareText() {
  const { id, result: r } = current;
  const c = CALCS[id];
  const raw = rawVals(id);
  const v = typed(id, raw);
  const lines = [`${c.t} — Atelier CVCD`, '', 'Données :'];
  for (const i of c.inputs) {
    if (i.w && !i.w(v)) continue;
    const val = i.t === 's' ? i.o.find((o) => String(o[0]) === String(raw[i.id]))?.[1] : `${raw[i.id]}${i.u ? ' ' + i.u : ''}`;
    lines.push(`• ${i.l} : ${val}`);
  }
  lines.push('', 'Résultats :');
  for (const x of r.rows) {
    if (x[0]) lines.push(`• ${x[0]} : ${x[1]}`);
    else lines[lines.length - 1] += ` (${x[1]})`;
  }
  for (const s of r.st) lines.push(`${s[0] === 'ok' ? '✓' : '⚠'} ${s[1]}`);
  lines.push('', `Pré-dimensionnement indicatif (${c.ref}).`);
  return lines.join('\n').replace(/[  ]/g, ' ');
}
$('#shareBtn').addEventListener('click', async () => {
  if (!current?.result) return toast('Complète la saisie avant de partager.');
  const title = CALCS[current.id].t;
  const text = shareText();
  try {
    if (native) return await (await native).shareText(title, text);
    if (navigator.share) return await navigator.share({ title, text });
    await navigator.clipboard.writeText(text);
    toast('Résultats copiés dans le presse-papiers.');
  } catch (e) {
    if (!/cancel|abort/i.test(String(e?.message || e))) toast('Partage impossible sur cet appareil.');
  }
});

/* ---------- Routeur ---------- */
let fromHome = false; // l'outil a été ouvert depuis la liste : « retour » = retour arrière de l'historique
function route() {
  const id = location.hash.replace(/^#\/?/, '');
  io.disconnect();
  resultsVisible = false;
  if (CALCS[id]) {
    current = { id, result: null };
    S.recent = [id, ...S.recent.filter((x) => x !== id)].slice(0, 5);
    save();
    $('#title').textContent = CALCS[id].t;
    $('#title').classList.toggle('long', CALCS[id].t.length > 22);
    document.title = `${CALCS[id].t} — Atelier CVCD`;
    main.innerHTML = nbsp(pageTool(id));
    runTool();
    io.observe($('#results', main));
  } else {
    current = null;
    $('#title').textContent = 'Atelier CVCD';
    $('#title').classList.remove('long');
    document.title = 'Atelier CVCD';
    main.innerHTML = pageHome();
    fillLists();
    renderSummary();
  }
  $('#backBtn').hidden = !current;
  $('#shareBtn').hidden = !current;
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}
window.addEventListener('hashchange', route);
$('#backBtn').addEventListener('click', () => (fromHome ? history.back() : location.replace('#/')));
main.addEventListener('click', (e) => {
  if (e.target.closest('a.tool')) fromHome = true;
});
window.addEventListener('hashchange', () => {
  if (!current) fromHome = false;
});

/* ---------- Saisie ---------- */
function setVal(key, value) {
  rawVals(current.id)[key] = value;
  save();
  runTool();
}
main.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'q') {
    query = t.value;
    return fillLists();
  }
  if (current && t.dataset.i) setVal(t.dataset.i, t.value);
});
main.addEventListener('change', (e) => {
  if (current && e.target.dataset.i) setVal(e.target.dataset.i, e.target.value);
});
main.addEventListener('click', (e) => {
  if (!current) return;
  const sign = e.target.closest('[data-sign]');
  if (sign) {
    const input = $(`#f-${sign.dataset.sign}`, main);
    const s = input.value.trim();
    input.value = /^[-−]/.test(s) ? s.replace(/^[-−]\s*/, '') : '-' + s;
    return setVal(sign.dataset.sign, input.value);
  }
  if (e.target.closest('[data-act="reset"]')) {
    delete S.vals[current.id];
    save();
    const y = window.scrollY;
    main.innerHTML = nbsp(pageTool(current.id));
    runTool();
    io.disconnect();
    io.observe($('#results', main));
    window.scrollTo(0, y);
    toast('Valeurs par défaut rétablies.');
  }
});
/* « Suivant » du clavier : passe au champ visible suivant */
main.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.matches('input[data-i]')) return;
  e.preventDefault();
  const all = $$('input[data-i], select[data-i]', main).filter((x) => !x.closest('[hidden]'));
  const next = all[all.indexOf(e.target) + 1];
  if (next) next.focus();
  else e.target.blur();
});
main.addEventListener('focusin', (e) => {
  if (e.target.matches('input[data-i]')) e.target.select();
});

native?.then((n) => n.init());
route();
