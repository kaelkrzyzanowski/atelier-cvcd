// Calculs CVCD : fonctions physiques, tables et définition déclarative des calculateurs.
// Repris tels quels de la version web « Atelier CVCD » (référentiel au 1er octobre 2026).

const PATM = 101325;           // Pa
const RHO_AIR = 1.2;           // kg/m³ (air à ~20 °C) — hypothèse affichée
const PHYS = {
  // Pression de saturation (Magnus, eau liquide), Pa
  psat: t => 610.94 * Math.exp(17.625 * t / (t + 243.04)),
  // Humidité absolue (kg/kg as) depuis θ et HR (%)
  x: (t, hr) => { const pv = hr / 100 * PHYS.psat(t); return 0.622 * pv / (PATM - pv); },
  // Enthalpie kJ/kg as
  h: (t, x) => 1.006 * t + x * (2501 + 1.86 * t),
  // Température depuis h et x
  tFromHX: (h, x) => (h - 2501 * x) / (1.006 + 1.86 * x),
  // HR (%) depuis θ et x
  hr: (t, x) => { const pv = x * PATM / (0.622 + x); return 100 * pv / PHYS.psat(t); },
  // Point de rosée (°C) depuis x
  dew: x => { const pv = x * PATM / (0.622 + x); const g = Math.log(pv / 610.94); return 243.04 * g / (17.625 - g); },
  // Température humide (°C) par dichotomie (psychromètre adiabatique)
  wet: (t, x) => {
    let lo = -20, hi = t;
    for (let i = 0; i < 60; i++) {
      const tw = (lo + hi) / 2, xs = PHYS.x(tw, 100);
      const xc = ((2501 - 2.326 * tw) * xs - 1.006 * (t - tw)) / (2501 + 1.86 * t - 4.186 * tw);
      if (xc > x) hi = tw; else lo = tw;
    }
    return (lo + hi) / 2;
  },
  // Coefficient de frottement (Colebrook, laminaire 64/Re)
  lambda: (Re, relRough) => {
    if (Re < 2300) return 64 / Re;
    let l = 0.25 / Math.pow(Math.log10(relRough / 3.7 + 5.74 / Math.pow(Re, 0.9)), 2); // Swamee-Jain
    for (let i = 0; i < 20; i++) l = Math.pow(-2 * Math.log10(relRough / 3.7 + 2.51 / (Re * Math.sqrt(l))), -2);
    return l;
  },
  // Perte de charge linéaire Pa/m
  J: (v, D, nu, rho, epsMm) => { const Re = v * D / nu; const l = PHYS.lambda(Re, epsMm / 1000 / D); return {Re, l, J: l / D * rho * v * v / 2}; },
  // Diamètre équivalent de Huebscher (m)
  deq: (a, b) => 1.30 * Math.pow(a * b, 0.625) / Math.pow(a + b, 0.25)
};

/* Tables (indicatives) */
const DUCT_D = [100,125,160,200,250,315,355,400,450,500,560,630,710,800,900,1000,1120,1250,1400,1600];
const PIPE = [["DN15",16.1],["DN20",21.7],["DN25",27.3],["DN32",36.0],["DN40",41.9],["DN50",53.1],["DN65",68.9],["DN80",80.9],["DN100",107.1],["DN125",131.7],["DN150",159.3],["DN200",206.5],["DN250",260.4],["DN300",309.7]]; // acier, Ø intérieur mm (indicatif)
const VASES = [8,12,18,25,35,50,80,100,140,200,250,300,400,500,600,800,1000];
const DILAT = {50:0.0121,60:0.0171,70:0.0228,80:0.0290,90:0.0359}; // eau depuis 10 °C (indicatif)
const FLUIDES = { // indicatif — vérifier NF EN 378 et fiche fabricant
  R410A:{cl:"A1",PL:0.44,LFL:null,prg:2088}, R134a:{cl:"A1",PL:0.25,LFL:null,prg:1430}, R744:{cl:"A1",PL:0.10,LFL:null,prg:1},
  R32:{cl:"A2L",PL:0.061,LFL:0.307,prg:675}, R454B:{cl:"A2L",PL:0.059,LFL:0.297,prg:466}, R1234ze:{cl:"A2L",PL:0.061,LFL:0.303,prg:7},
  R290:{cl:"A3",PL:0.008,LFL:0.038,prg:3}
};
const SOLAIRE = {N:120,E:600,S:450,O:650,H:850}; // W/m² pointe été sur vitrage (ordre de grandeur, latitude de Paris)
const SFP_CLASSES = [[300,"SFP 0"],[500,"SFP 1"],[750,"SFP 2"],[1250,"SFP 3"],[2000,"SFP 4"],[3000,"SFP 5"],[4500,"SFP 6"],[Infinity,"SFP 7"]]; // W/(m³/s), NF EN 16798-3 — voir norme

/* Formatage français */
const nf = (n, d = 0) => (isFinite(n) ? n.toLocaleString("fr-FR", {minimumFractionDigits: d, maximumFractionDigits: d}) : "—");
const U = (n, d, u) => nf(n, d) + " " + u;

/* =====================================================================
   CALCULATEURS — définition déclarative
   inputs : {id,l(label),h(aide),t:'n'|'s',v(défaut),o(options),u(unité),w(visible si)}
   run(v) → {rows:[[libellé, valeur, gros?]], st:[[niveau,texte]], ex:[étapes], draw?}
   ===================================================================== */
const CALCS = {

conv:{t:"Convertisseur rapide",ref:"Unités SI",ind:false,
 inputs:[{id:"p",l:"Puissance",u:"kW",v:100},{id:"q",l:"Débit d'air ou d'eau",u:"m³/h",v:3600},{id:"pa",l:"Pression",u:"Pa",v:250}],
 f:"1 kW = 859,8 kcal/h = 3 412 BTU/h = 0,2843 TR · 1 m³/s = 3 600 m³/h = 1 000 L/s · 1 mmCE = 9,807 Pa · 1 mbar = 100 Pa",
 run:v=>({rows:[["Puissance",U(v.p*859.845,0,"kcal/h")],["",U(v.p*3412.14,0,"BTU/h")],["",U(v.p/3.51685,2,"TR")],["Débit",U(v.q/3600,3,"m³/s")],["",U(v.q/3.6,1,"L/s")],["Pression",U(v.pa/9.80665,1,"mmCE")],["",U(v.pa/100,2,"mbar")]],st:[],
 ex:[`${U(v.p,1,"kW")} × 859,845 = ${U(v.p*859.845,0,"kcal/h")}`,`${U(v.p,1,"kW")} × 3 412,14 = ${U(v.p*3412.14,0,"BTU/h")}`,`${U(v.p,1,"kW")} / 3,51685 = ${U(v.p/3.51685,2,"TR")}`,`${U(v.q,0,"m³/h")} / 3 600 = ${U(v.q/3600,3,"m³/s")} ; / 3,6 = ${U(v.q/3.6,1,"L/s")}`,`${U(v.pa,0,"Pa")} / 9,80665 = ${U(v.pa/9.80665,1,"mmCE")}`]})},

puissance:{t:"Puissance, débit, ΔT (air ou eau)",ref:"P = qv·c·ΔT",
 inputs:[{id:"fl",l:"Fluide",t:"s",v:"eau",o:[["eau","Eau (c = 1,163 kWh/m³·K)"],["air","Air (c = 0,34 Wh/m³·K)"]]},{id:"ca",l:"Grandeur à calculer",t:"s",v:"p",o:[["p","Puissance P"],["q","Débit qv"],["dt","Écart de température ΔT"]]},
 {id:"p",l:"Puissance",u:"kW",v:10,w:v=>v.ca!=="p"},{id:"q",l:"Débit",u:"m³/h",v:1.72,w:v=>v.ca!=="q"},{id:"dt",l:"ΔT (départ − retour, ou soufflage − reprise)",u:"K",v:5,w:v=>v.ca!=="dt"}],
 f:"P = qv × c × ΔT · qv = P / (c × ΔT) · ΔT = P / (qv × c) · eau : c = 1,163 kWh/(m³·K) · air : c = 0,34 Wh/(m³·K) (ρ 1,2 kg/m³ × cp 1,006 kJ/kg·K / 3 600)",
 run:v=>{const eau=v.fl==="eau";const c=eau?1.163:0.34/1000;const cTxt=eau?"1,163":"0,00034";let P=v.p,q=v.q,dt=v.dt,ex;
  if(v.ca==="p"){P=q*c*dt;ex=[`P = qv × c × ΔT = ${nf(q,2)} × ${cTxt} × ${nf(dt,1)} = ${U(P,2,"kW")}`];}
  else if(v.ca==="q"){q=P/(c*dt);ex=[`qv = P / (c × ΔT) = ${nf(P,2)} / (${cTxt} × ${nf(dt,1)}) = ${U(q,eau?3:0,"m³/h")}`];}
  else{dt=P/(q*c);ex=[`ΔT = P / (qv × c) = ${nf(P,2)} / (${nf(q,2)} × ${cTxt}) = ${U(dt,2,"K")}`];}
  ex.unshift(eau?"Eau : c = ρ × cp = 1 000 kg/m³ × 4,186 kJ/kg·K / 3 600 = 1,163 kWh/(m³·K)":"Air : c = ρ × cp = 1,2 kg/m³ × 1,006 kJ/kg·K / 3 600 ≈ 0,34 Wh/(m³·K), soit 0,000 34 kWh/(m³·K)");
  const rows=[["Puissance",U(P,2,"kW"),v.ca==="p"],["",U(P*1000,0,"W")],["Débit",U(q,eau?3:0,"m³/h"),v.ca==="q"],eau?["",U(q*1000,0,"L/h")]:["",U(q/3600,3,"m³/s")],["ΔT",U(dt,1,"K"),v.ca==="dt"]];
  const st=[];if(!isFinite(P)||!isFinite(q)||!isFinite(dt)||q<=0||dt<=0||P<0)st.push(["bad","Débit et ΔT doivent être strictement positifs (division par zéro sinon)."]);
  else if(eau)st.push(dt>20?["warn","ΔT eau > 20 K : inhabituel en CVC (chaud 5 à 20 K, eau glacée 5 à 6 K)."]:["ok","Eau glacée : ΔT 5 à 6 K courant · eau chaude : 5 à 20 K selon les émetteurs."]);
  else st.push(dt>12?["warn","ΔT air > 12 K : soufflage très froid ou très chaud, risque d'inconfort (vérifier la diffusion)."]:["ok","ΔT air courant (8 à 12 K en froid, jusqu'à ~15 K en chaud)."]);
  return {rows,st,ex};}},

reynolds:{t:"Reynolds et perte de charge linéaire",ref:"Darcy-Weisbach · Colebrook",
 inputs:[{id:"fl",l:"Fluide",t:"s",v:"air",o:[["air","Air à 20 °C"],["ef","Eau à 10 °C"],["ec","Eau à 45 °C"]]},{id:"v",l:"Vitesse",u:"m/s",v:5},{id:"d",l:"Diamètre intérieur",u:"mm",v:400},{id:"e",l:"Rugosité ε",h:"tôle galva 0,15 · acier 0,045",u:"mm",v:0.15}],
 f:"Re = v·D/ν · 1/√λ = −2 log(ε/3,7D + 2,51/(Re√λ)) · J = λ/D · ρv²/2",
 run:v=>{const P={air:[15.1e-6,1.2],ef:[1.31e-6,1000],ec:[0.60e-6,990]}[v.fl];const D=v.d/1000;const r=PHYS.J(v.v,D,P[0],P[1],v.e);
  const reg=r.Re<2300?"laminaire":r.Re<4000?"transitoire":"turbulent";
  return {rows:[["Nombre de Reynolds",nf(r.Re,0),true],["Régime",reg],["λ (Colebrook)",nf(r.l,4)],["Perte de charge linéaire",U(r.J,2,"Pa/m"),true]],
  st:[[reg==="turbulent"?"ok":"warn",reg==="turbulent"?"Écoulement turbulent : cas habituel en CVC.":"Régime non turbulent : vérifier les hypothèses (vitesse très faible ?)."]],
  ex:[`ν = ${P[0].toExponential(2)} m²/s, ρ = ${U(P[1],0,"kg/m³")}`,`Re = ${nf(v.v,2)} × ${nf(D,3)} / ${P[0].toExponential(2)} = ${nf(r.Re,0)}`,`ε/D = ${nf(v.e/1000/D,6)} → λ = ${nf(r.l,4)} (itérations de Colebrook)`,`J = ${nf(r.l,4)} / ${nf(D,3)} × ${nf(P[1],1)} × ${nf(v.v,2)}² / 2 = ${U(r.J,2,"Pa/m")}`]};}},

psychro:{t:"Air humide : point, mélange, batterie",ref:"Diagramme de l'air humide · 101 325 Pa",chart:true,
 inputs:[{id:"t1",l:"Air 1 (ex. air neuf) θ",u:"°C",v:32},{id:"h1",l:"Air 1 HR",u:"%",v:40},{id:"q1",l:"Air 1 débit",u:"m³/h",v:2000},
 {id:"t2",l:"Air 2 (ex. reprise) θ",u:"°C",v:26},{id:"h2",l:"Air 2 HR",u:"%",v:50},{id:"q2",l:"Air 2 débit",u:"m³/h",v:6000},
 {id:"ts",l:"Sortie batterie θ",u:"°C",v:14},{id:"hs",l:"Sortie batterie HR",h:"≈ 90-95 % après une batterie froide",u:"%",v:95}],
 f:"x = 0,622·pv/(p − pv) · h = 1,006θ + x(2 501 + 1,86θ) · mélange : moyenne pondérée des débits massiques · P = ṁ·Δh · condensats = ṁ·Δx",
 run:v=>{const x1=PHYS.x(v.t1,v.h1),x2=PHYS.x(v.t2,v.h2),h1=PHYS.h(v.t1,x1),h2=PHYS.h(v.t2,x2);
  const m1=v.q1*RHO_AIR/3600,m2=v.q2*RHO_AIR/3600,m=m1+m2;const xm=(m1*x1+m2*x2)/m,hm=(m1*h1+m2*h2)/m,tm=PHYS.tFromHX(hm,xm);
  let xs=PHYS.x(v.ts,v.hs);const hs=PHYS.h(v.ts,xs);const P=m*(hm-hs);const cond=Math.max(0,m*(xm-xs)*3600);
  const st=[];if(xs>xm&&hs<hm)st.push(["warn","La sortie demandée est plus humide que l'entrée : ce n'est pas une batterie froide seule (humidification ?)."]);
  if(P>0)st.push(["ok",`Batterie froide : ${U(P,1,"kW")} dont latent ≈ ${U(m*(xm-Math.min(xm,xs))*2501,1,"kW")}.`]);else st.push(["ok",`Batterie chaude : ${U(-P,1,"kW")}.`]);
  if(cond>0)st.push(["warn",`Prévoir bac à condensats et évacuation : ${U(cond,1,"kg/h")}.`]);
  return {rows:[["Air 1 : x / h",`${U(x1*1000,2,"g/kg")} · ${U(h1,1,"kJ/kg")}`],["Air 1 : rosée / humide",`${U(PHYS.dew(x1),1,"°C")} · ${U(PHYS.wet(v.t1,x1),1,"°C")}`],["Air 2 : x / h",`${U(x2*1000,2,"g/kg")} · ${U(h2,1,"kJ/kg")}`],["Mélange M : θ / HR",`${U(tm,1,"°C")} · ${U(PHYS.hr(tm,xm),0,"%")}`,true],["Mélange M : x / h",`${U(xm*1000,2,"g/kg")} · ${U(hm,1,"kJ/kg")}`],["Sortie S : x / h",`${U(xs*1000,2,"g/kg")} · ${U(hs,1,"kJ/kg")}`],["Puissance batterie (M → S)",U(Math.abs(P),1,"kW"),true],["Condensats",U(cond,1,"kg/h")]],st,
  ex:[`psat(${v.t1} °C) = ${U(PHYS.psat(v.t1),0,"Pa")} ; pv = ${v.h1} % × psat = ${U(v.h1/100*PHYS.psat(v.t1),0,"Pa")}`,`x1 = 0,622 × pv / (101 325 − pv) = ${U(x1*1000,2,"g/kg")} ; h1 = ${U(h1,2,"kJ/kg")}`,`ṁ1 = ${nf(v.q1,0)} × 1,2 / 3 600 = ${U(m1,3,"kg/s")} ; ṁ2 = ${U(m2,3,"kg/s")}`,`xM = (ṁ1x1 + ṁ2x2)/ṁ = ${U(xm*1000,2,"g/kg")} ; hM = ${U(hm,2,"kJ/kg")} → θM = ${U(tm,2,"°C")}`,`P = ṁ × (hM − hS) = ${nf(m,3)} × (${nf(hm,2)} − ${nf(hs,2)}) = ${U(P,2,"kW")}`,`Condensats = ṁ × (xM − xS) × 3 600 = ${U(cond,2,"kg/h")}`],
  draw:{pts:[{t:v.t1,x:x1,l:"1"},{t:v.t2,x:x2,l:"2"},{t:tm,x:xm,l:"M"},{t:v.ts,x:xs,l:"S"}],lines:[[0,1],[2,3]]}};}},

deperd:{t:"Déperditions simplifiées d'un local",ref:"Principe NF EN 12831-1 (simplifié)",ind:true,
 inputs:[{id:"ti",l:"Température intérieure",u:"°C",v:20},{id:"te",l:"Température extérieure de base",h:"selon site (indicatif)",u:"°C",v:-7},{id:"s",l:"Surface du local",u:"m²",v:30},
 {id:"am",l:"Murs opaques A",u:"m²",v:6},{id:"um",l:"Murs U",u:"W/m²·K",v:0.25},{id:"av",l:"Vitrages A",u:"m²",v:6},{id:"uv",l:"Vitrages Uw",u:"W/m²·K",v:1.4},
 {id:"at",l:"Toiture / plancher bas A",h:"0 si local intermédiaire",u:"m²",v:0},{id:"ut",l:"Toiture U",u:"W/m²·K",v:0.15},
 {id:"pl",l:"Ponts thermiques : longueur",u:"m",v:10},{id:"psi",l:"Ponts thermiques : ψ",u:"W/m·K",v:0.3},
 {id:"qv",l:"Débit d'air neuf",u:"m³/h",v:50},{id:"eta",l:"Efficacité du récupérateur",u:"%",v:75},{id:"rel",l:"Surpuissance de relance",u:"%",v:10}],
 f:"Φ = (Σ U·A + Σ ψ·L) × ΔT + 0,34 × qv × ΔT × (1 − η) ; Φ_total = Φ × (1 + relance)",
 run:v=>{const dT=v.ti-v.te;const fm=v.um*v.am*dT,fv=v.uv*v.av*dT,ft=v.ut*v.at*dT,fp=v.psi*v.pl*dT,fa=0.34*v.qv*dT*(1-v.eta/100);const sum=fm+fv+ft+fp+fa,tot=sum*(1+v.rel/100),r=tot/v.s;
  return {rows:[["ΔT de base",U(dT,0,"K")],["Murs",U(fm,0,"W")],["Vitrages",U(fv,0,"W")],["Toiture / plancher",U(ft,0,"W")],["Ponts thermiques",U(fp,0,"W")],["Air neuf (après récupération)",U(fa,0,"W")],["Total avec relance",U(tot,0,"W"),true],["Ratio",U(r,0,"W/m²"),true]],
  st:[r>80?["warn","Ratio élevé pour du tertiaire neuf : vérifier U, vitrages et air neuf."]:r<15?["warn","Ratio très faible : vérifier les surfaces saisies."]:["ok","Ordre de grandeur cohérent (30 à 50 W/m² courants en neuf, indicatif)."]],
  ex:[`ΔT = ${v.ti} − (${v.te}) = ${dT} K`,`Murs : ${v.um} × ${v.am} × ${dT} = ${nf(fm,1)} W`,`Vitrages : ${v.uv} × ${v.av} × ${dT} = ${nf(fv,1)} W`,`Toiture : ${v.ut} × ${v.at} × ${dT} = ${nf(ft,1)} W`,`Ponts : ${v.psi} × ${v.pl} × ${dT} = ${nf(fp,1)} W`,`Air neuf : 0,34 × ${v.qv} × ${dT} × (1 − ${v.eta/100}) = ${nf(fa,1)} W`,`Somme = ${nf(sum,1)} W ; × (1 + ${v.rel/100}) = ${nf(tot,1)} W ; / ${v.s} m² = ${nf(r,1)} W/m²`]};}},

frigo:{t:"Bilan frigorifique simplifié (pointe)",ref:"Méthode enveloppe — ordres de grandeur",ind:true,
 inputs:[{id:"s",l:"Surface du local",u:"m²",v:30},{id:"np",l:"Occupants",u:"pers",v:3},{id:"ps",l:"Apport sensible / personne",u:"W",v:75},{id:"pl",l:"Apport latent / personne",u:"W",v:55},
 {id:"ec",l:"Éclairage",u:"W/m²",v:7},{id:"eq",l:"Équipements",u:"W/m²",v:12},
 {id:"av",l:"Surface vitrée",u:"m²",v:6},{id:"or",l:"Orientation",t:"s",v:"O",o:[["N","Nord"],["E","Est"],["S","Sud"],["O","Ouest"],["H","Horizontale"]]},{id:"sw",l:"Facteur solaire du vitrage Sw",u:"",v:0.4},{id:"fc",l:"Facteur des protections Fc",h:"1 = aucune · 0,3 = store extérieur",u:"",v:0.4},
 {id:"qv",l:"Débit d'air neuf",u:"m³/h",v:75},{id:"te",l:"θ extérieure",u:"°C",v:32},{id:"ti",l:"θ intérieure",u:"°C",v:26},{id:"xe",l:"x extérieur",u:"g/kg",v:11.9},{id:"xi",l:"x intérieur",u:"g/kg",v:10.5},{id:"eta",l:"Récupération sensible",u:"%",v:0}],
 f:"P = occupants + éclairage + équipements + A·I·Sw·Fc + 0,34·qv·ΔT·(1−η) ; latent = occupants + 0,83·qv·Δx",
 run:v=>{const I=SOLAIRE[v.or];const oS=v.np*v.ps,oL=v.np*v.pl,ec=v.ec*v.s,eq=v.eq*v.s,so=v.av*I*v.sw*v.fc,aS=0.34*v.qv*(v.te-v.ti)*(1-v.eta/100),aL=0.83*v.qv*(v.xe-v.xi);
  const S=oS+ec+eq+so+aS,L=oL+Math.max(0,aL),T=S+L,r=T/v.s;
  return {rows:[["Occupants (sensible)",U(oS,0,"W")],["Éclairage",U(ec,0,"W")],["Équipements",U(eq,0,"W")],[`Solaire (${I} W/m² indicatif)`,U(so,0,"W")],["Air neuf sensible",U(aS,0,"W")],["Puissance sensible",U(S,0,"W"),true],["Puissance latente",U(L,0,"W")],["Puissance totale",U(T,0,"W"),true],["Ratio",U(r,0,"W/m²"),true]],
  st:[r>150?["warn","Ratio élevé : protections solaires ? densité d'équipements ?"]:["ok","Bureaux : 60 à 100 W/m² courants (indicatif)."],so>0.4*S?["warn","Le solaire dépasse 40 % du sensible : travaille les protections avec l'architecte."]:["ok","Apports solaires maîtrisés."]],
  ex:[`Occupants : ${v.np} × ${v.ps} = ${oS} W sensible ; ${v.np} × ${v.pl} = ${oL} W latent`,`Éclairage + équipements : (${v.ec} + ${v.eq}) × ${v.s} = ${nf(ec+eq,0)} W`,`Solaire : ${v.av} × ${I} × ${v.sw} × ${v.fc} = ${nf(so,0)} W`,`Air neuf sensible : 0,34 × ${v.qv} × ${v.te-v.ti} × (1 − ${v.eta/100}) = ${nf(aS,0)} W`,`Air neuf latent : 0,83 × ${v.qv} × ${nf(v.xe-v.xi,1)} = ${nf(aL,0)} W`,`Total = ${nf(S,0)} + ${nf(L,0)} = ${nf(T,0)} W ; ${nf(r,0)} W/m²`]};}},

vase:{t:"Vase d'expansion",ref:"Méthode courante (indicatif)",ind:true,
 inputs:[{id:"vi",l:"Volume d'eau de l'installation",u:"L",v:2000},{id:"tm",l:"Température maximale",t:"s",v:"70",o:[["50","50 °C"],["60","60 °C"],["70","70 °C"],["80","80 °C"],["90","90 °C"]]},{id:"hs",l:"Hauteur statique au-dessus du vase",u:"m",v:15},{id:"ps",l:"Tarage de la soupape",u:"bar",v:3}],
 f:"Ve = V × e ; réserve = max(0,5 % V ; 3 L) ; Pi = H/10 + 0,2 ; Pf = Ps − 0,5 ; Vn = (Ve + réserve) / (1 − (Pi+1)/(Pf+1))",
 run:v=>{const e=DILAT[v.tm];const Ve=v.vi*e,res=Math.max(0.005*v.vi,3),Pi=v.hs/10+0.2,Pf=v.ps-0.5;const k=1-(Pi+1)/(Pf+1);const Vn=k>0?(Ve+res)/k:NaN;const std=VASES.find(s=>s>=Vn);
  return {rows:[["Coefficient de dilatation",nf(e,4)],["Volume dilaté Ve",U(Ve,1,"L")],["Réserve d'eau",U(res,1,"L")],["Pression initiale Pi",U(Pi,2,"bar")],["Pression finale Pf",U(Pf,2,"bar")],["Volume nominal calculé",U(Vn,0,"L"),true],["Vase proposé",std?U(std,0,"L"):"plusieurs vases",true]],
  st:[k<=0?["bad","Pf ≤ Pi : soupape trop basse ou hauteur trop grande."]:k<0.2?["warn","Facteur de pression faible : vase volumineux, revoir le point de raccordement ou le tarage."]:["ok","Dimensionnement cohérent (vérifier la gamme fabricant et la DESP)."]],
  ex:[`e(10 → ${v.tm} °C) = ${e}`,`Ve = ${v.vi} × ${e} = ${nf(Ve,1)} L ; réserve = ${nf(res,1)} L`,`Pi = ${v.hs}/10 + 0,2 = ${nf(Pi,2)} bar ; Pf = ${v.ps} − 0,5 = ${nf(Pf,2)} bar`,`Vn = ${nf(Ve+res,1)} / (1 − ${nf(Pi+1,2)}/${nf(Pf+1,2)}) = ${nf(Vn,0)} L`]};}},

terminal:{t:"Débits d'un terminal (eau et air)",ref:"P = 1,163·q·ΔT · P = 0,34·qv·ΔT",
 inputs:[{id:"p",l:"Puissance sensible",u:"kW",v:2.5},{id:"dte",l:"ΔT eau",h:"froid 5 K · chaud 5 à 10 K",u:"K",v:5},{id:"dta",l:"ΔT air (reprise − soufflage)",u:"K",v:10}],
 f:"q_eau [m³/h] = P / (1,163 × ΔT_eau) · qv_air [m³/h] = 1 000 × P / (0,34 × ΔT_air)",
 run:v=>{const qe=v.p/(1.163*v.dte),qa=1000*v.p/(0.34*v.dta);return {rows:[["Débit d'eau",U(qe,3,"m³/h"),true],["",U(qe/3.6*1000,0,"L/h")],["Débit d'air",U(qa,0,"m³/h"),true]],
  st:[v.dta>12?["warn","ΔT air > 12 K en froid : risque d'inconfort (air trop froid au soufflage)."]:["ok","ΔT air courant."]],
  ex:[`q eau = ${v.p} / (1,163 × ${v.dte}) = ${nf(qe,3)} m³/h`,`qv air = ${v.p} × 1 000 / (0,34 × ${v.dta}) = ${nf(qa,0)} m³/h`]};}},

en378:{t:"Charge maximale de fluide frigorigène",ref:"NF EN 378 — simplifié",ind:true,
 inputs:[{id:"fl",l:"Fluide",t:"s",v:"R32",o:Object.keys(FLUIDES).map(k=>[k,`${k} (${FLUIDES[k].cl}, PRG ${FLUIDES[k].prg})`])},{id:"s",l:"Surface du plus petit local desservi",u:"m²",v:20},{id:"hp",l:"Hauteur sous plafond",u:"m",v:2.7},
 {id:"h0",l:"Hauteur d'installation de l'unité h0",t:"s",v:"2.2",o:[["0.6","Au sol (0,6 m)"],["1.8","Murale (1,8 m)"],["2.2","Plafond (2,2 m)"]]},{id:"m",l:"Charge du système",u:"kg",v:3}],
 f:"Approche limite pratique : m ≤ PL × V · Approche inflammabilité (A2L/A3, confort) : m_max = 2,5 × LFL^1,25 × h0 × √A · on retient ici la plus contraignante",
 run:v=>{const F=FLUIDES[v.fl];const V=v.s*v.hp;const mPL=F.PL*V;const mF=F.LFL?2.5*Math.pow(F.LFL,1.25)*parseFloat(v.h0)*Math.sqrt(v.s):null;const lim=mF?Math.min(mPL,mF):mPL;
  const rows=[["Classe de sécurité",F.cl],["Volume du local",U(V,1,"m³")],["Limite pratique PL (indicatif)",U(F.PL,3,"kg/m³")],["Charge max (PL × V)",U(mPL,2,"kg"),true]];if(mF)rows.push(["Charge max (formule LFL)",U(mF,2,"kg"),true]);
  const st=[[v.m<=lim?"ok":"bad",v.m<=lim?`Charge de ${U(v.m,1,"kg")} sous la limite la plus contraignante (${U(lim,2,"kg")}) — à confirmer selon la catégorie d'accès et l'emplacement.`:`Charge de ${U(v.m,1,"kg")} supérieure aux limites calculées : réduire la charge, changer de fluide ou ajouter des mesures (ventilation, détection, vannes d'isolement).`]];
  if(F.cl!=="A1")st.push(["warn","Fluide inflammable : zones, détection, ventilation et marquage selon NF EN 378 et fiche fabricant."]);
  if(F.prg>=2500)st.push(["bad","PRG ≥ 2 500 : maintenance interdite avec du fluide vierge (F-gas III)."]);else if(F.prg>750)st.push(["warn","PRG > 750 : vérifier les interdictions F-gas III pour la catégorie d'équipement."]);
  return {rows,st,ex:[`V = ${v.s} × ${v.hp} = ${nf(V,1)} m³`,`PL × V = ${F.PL} × ${nf(V,1)} = ${nf(mPL,2)} kg`,mF?`2,5 × ${F.LFL}^1,25 × ${v.h0} × √${v.s} = ${nf(mF,2)} kg`:"Fluide non inflammable : pas de formule LFL",`Valeurs PL/LFL indicatives : vérifier l'annexe de la NF EN 378 en vigueur.`]};}},

cta:{t:"Prédimensionnement d'une CTA",ref:"Bilans d'enthalpie",
 inputs:[{id:"qv",l:"Débit soufflé (air neuf)",u:"m³/h",v:7500},{id:"vf",l:"Vitesse frontale cible",h:"≤ 2,5 m/s indicatif",u:"m/s",v:2.5},{id:"eta",l:"Efficacité du récupérateur",u:"%",v:75},{id:"tr",l:"θ reprise hiver",u:"°C",v:20},
 {id:"teh",l:"Hiver : θ extérieure",u:"°C",v:-7},{id:"tsh",l:"Hiver : θ soufflage",u:"°C",v:19},
 {id:"tee",l:"Été : θ extérieure",u:"°C",v:32},{id:"hre",l:"Été : HR extérieure",u:"%",v:40},{id:"tre",l:"Été : θ reprise",u:"°C",v:26},{id:"tbf",l:"Été : θ sortie batterie froide",u:"°C",v:13},{id:"hbf",l:"Été : HR sortie batterie",u:"%",v:95}],
 f:"A = qv / (3 600 · v) · θ_récup = θe + η(θr − θe) · P_chaud = 0,34·qv·(θs − θ_récup) · P_froid = ṁ·(h_entrée − h_sortie)",
 run:v=>{const A=v.qv/3600/v.vf;const e=v.eta/100;const trH=v.teh+e*(v.tr-v.teh);const Pc=0.34*v.qv*(v.tsh-trH)/1000;
  const trE=v.tee>v.tre?v.tee-e*(v.tee-v.tre):v.tee;const xe=PHYS.x(v.tee,v.hre),hin=PHYS.h(trE,xe);const xs=Math.min(PHYS.x(v.tbf,v.hbf),xe),hout=PHYS.h(v.tbf,xs);const m=v.qv*RHO_AIR/3600;const Pf=m*(hin-hout);const cond=m*(xe-xs)*3600;
  return {rows:[["Section de passage",U(A,2,"m²"),true],["Hiver : θ après récupération",U(trH,1,"°C")],["Batterie chaude",U(Pc,1,"kW"),true],["Été : θ après récupération",U(trE,1,"°C")],["Été : h entrée / sortie batterie",`${U(hin,1,"kJ/kg")} → ${U(hout,1,"kJ/kg")}`],["Batterie froide",U(Pf,1,"kW"),true],["Condensats",U(cond,1,"kg/h")]],
  st:[trH<5?["warn","Air après récupération < 5 °C : protection antigel du récupérateur et de la batterie."]:["ok","Pas de risque de gel immédiat après récupération (vérifier le givrage côté extraction)."],v.vf>2.8?["warn","Vitesse frontale élevée : pertes de charge et entraînement de gouttelettes sur la batterie froide."]:["ok","Vitesse frontale raisonnable."]],
  ex:[`A = ${v.qv} / 3 600 / ${v.vf} = ${nf(A,2)} m²`,`Hiver : ${v.teh} + ${e} × (${v.tr} − (${v.teh})) = ${nf(trH,2)} °C`,`P chaud = 0,34 × ${v.qv} × (${v.tsh} − ${nf(trH,2)}) = ${nf(Pc,2)} kW`,`Été : ${v.tee} − ${e} × (${v.tee} − ${v.tre}) = ${nf(trE,2)} °C (récupération sensible, x inchangé = ${nf(xe*1000,2)} g/kg)`,`h entrée = ${nf(hin,2)} kJ/kg ; h sortie (${v.tbf} °C, ${v.hbf} %) = ${nf(hout,2)} kJ/kg`,`ṁ = ${v.qv} × 1,2 / 3 600 = ${nf(m,3)} kg/s → P froid = ${nf(m,3)} × ${nf(hin-hout,2)} = ${nf(Pf,2)} kW`,`Condensats = ${nf(m,3)} × (${nf(xe*1000,2)} − ${nf(xs*1000,2)})/1 000 × 3 600 = ${nf(cond,1)} kg/h`]};}},

fan:{t:"Ventilateur : puissance, SFP, similitude",ref:"NF EN 16798-3 (classes SFP — voir norme)",
 inputs:[{id:"qv",l:"Débit",u:"m³/h",v:7500},{id:"dp",l:"Pression totale (réseau + CTA)",u:"Pa",v:800},{id:"eta",l:"Rendement global (moteur + roue)",u:"%",v:60},{id:"n1",l:"Vitesse actuelle",u:"tr/min",v:1450},{id:"n2",l:"Nouvelle vitesse",u:"tr/min",v:1160}],
 f:"P = qv[m³/s] × Δp / η · SFP = P / qv[m³/s] · q₂ = q₁·n₂/n₁ · Δp₂ = Δp₁·(n₂/n₁)² · P₂ = P₁·(n₂/n₁)³",
 run:v=>{const q=v.qv/3600;const P=q*v.dp/(v.eta/100);const sfp=P/q;const cl=SFP_CLASSES.find(c=>sfp<=c[0])[1];const r=v.n2/v.n1;
  return {rows:[["Puissance absorbée",U(P/1000,2,"kW"),true],["SFP",U(sfp,0,"W/(m³/s)"),true],["Classe (indicatif)",cl],["Après changement de vitesse : débit",U(v.qv*r,0,"m³/h")],["Pression",U(v.dp*r*r,0,"Pa")],["Puissance",U(P*r*r*r/1000,2,"kW"),true]],
  st:[sfp>1250?["warn","SFP élevé pour un ventilateur seul : revoir pertes de charge (filtres, vitesses) ou rendement."]:["ok","SFP courant pour un ventilateur de CTA."]],
  ex:[`qv = ${v.qv}/3 600 = ${nf(q,3)} m³/s`,`P = ${nf(q,3)} × ${v.dp} / ${v.eta/100} = ${nf(P,0)} W`,`SFP = ${nf(P,0)} / ${nf(q,3)} = ${nf(sfp,0)} W/(m³/s) → ${cl}`,`Rapport de vitesse = ${nf(r,3)} ; P₂ = P × ${nf(r,3)}³ = ${nf(P*r*r*r,0)} W`]};}},

gaine:{t:"Dimensionnement d'un tronçon de gaine",ref:"Darcy-Weisbach · Colebrook · Huebscher",
 inputs:[{id:"qv",l:"Débit",u:"m³/h",v:3000},{id:"me",l:"Méthode",t:"s",v:"v",o:[["v","Vitesse imposée"],["j","Perte de charge linéaire imposée"]]},{id:"vc",l:"Vitesse cible",u:"m/s",v:5,w:v=>v.me==="v"},{id:"jc",l:"Perte de charge cible",u:"Pa/m",v:1,w:v=>v.me==="j"},
 {id:"fo",l:"Forme",t:"s",v:"c",o:[["c","Circulaire (diamètres normalisés)"],["r","Rectangulaire (hauteur imposée)"]]},{id:"b",l:"Hauteur imposée",u:"mm",v:300,w:v=>v.fo==="r"},
 {id:"ty",l:"Type de tronçon",t:"s",v:"s",o:[["p","Principal (gaine technique)"],["s","Distribution (faux plafond)"],["t","Terminal (près des locaux)"]]},{id:"L",l:"Longueur du tronçon",u:"m",v:20},{id:"z",l:"Σζ des singularités",u:"",v:1.5}],
 f:"D = √(4qv/πv) · De = 1,30(ab)^0,625/(a+b)^0,25 · Δp = J·L + Σζ·ρv²/2",
 run:v=>{const q=v.qv/3600,nu=15.1e-6,rho=1.2,eps=0.15;let Dth;
  if(v.me==="v")Dth=Math.sqrt(4*q/(Math.PI*v.vc));else{let lo=0.05,hi=3;for(let i=0;i<60;i++){const D=(lo+hi)/2;const vv=4*q/(Math.PI*D*D);if(PHYS.J(vv,D,nu,rho,eps).J>v.jc)lo=D;else hi=D;}Dth=hi;}
  let De,label,vel,a=null;
  if(v.fo==="c"){const Dn=DUCT_D.find(d=>d/1000>=Dth)||DUCT_D[DUCT_D.length-1];De=Dn/1000;label="Ø "+Dn+" mm";vel=4*q/(Math.PI*De*De);}
  else{const b=v.b/1000;let lo=0.05,hi=5;for(let i=0;i<60;i++){const m=(lo+hi)/2;if(PHYS.deq(m,b)<Dth)lo=m;else hi=m;}a=Math.ceil(hi*1000/50)*50;De=PHYS.deq(a/1000,b);label=a+" × "+v.b+" mm";vel=q/(a/1000*b);}
  const vc=4*q/(Math.PI*De*De);const r=PHYS.J(vc,De,nu,rho,eps);const dps=v.z*rho*vel*vel/2;const dp=r.J*v.L+dps;const vmax={p:7,s:5,t:3.5}[v.ty];
  return {rows:[["Diamètre théorique",U(Dth*1000,0,"mm")],["Section retenue",label,true],["Diamètre équivalent",U(De*1000,0,"mm")],["Vitesse réelle",U(vel,2,"m/s"),true],["Perte de charge linéaire",U(r.J,2,"Pa/m")],["Singularités",U(dps,1,"Pa")],["Perte de charge du tronçon",U(dp,1,"Pa"),true]],
  st:[vel>vmax?["warn",`Vitesse > ${nf(vmax,1)} m/s pour ce type de tronçon (indicatif) : risque de bruit régénéré.`]:["ok",`Vitesse acceptable pour ce type de tronçon (≤ ${nf(vmax,1)} m/s indicatif).`],a&&a/v.b>4?["warn","Rapport de côtés > 4 : gaine très aplatie, pertes et bruit augmentent."]:["ok","Géométrie acceptable."]],
  ex:[`q = ${v.qv}/3 600 = ${nf(q,3)} m³/s`,v.me==="v"?`D = √(4 × ${nf(q,3)} / (π × ${v.vc})) = ${nf(Dth*1000,0)} mm`:`D recherché par itération pour J = ${v.jc} Pa/m → ${nf(Dth*1000,0)} mm`,v.fo==="c"?`Diamètre normalisé supérieur : ${label}`:`a tel que De(a, ${v.b}) ≥ ${nf(Dth*1000,0)} mm, arrondi à 50 mm → ${label}`,`Re = ${nf(r.Re,0)}, λ = ${nf(r.l,4)}, J = ${nf(r.J,2)} Pa/m (ε = 0,15 mm)`,`Δp = ${nf(r.J,2)} × ${v.L} + ${v.z} × 1,2 × ${nf(vel,2)}²/2 = ${nf(dp,1)} Pa`]};}},

hydro:{t:"Réseau hydraulique : débit, DN, pompe",ref:"Darcy-Weisbach · tubes acier (indicatif)",
 inputs:[{id:"p",l:"Puissance transportée",u:"kW",v:360},{id:"dt",l:"ΔT",u:"K",v:5},{id:"fl",l:"Fluide",t:"s",v:"ef",o:[["ef","Eau glacée (~10 °C)"],["ec","Eau chaude (~45 °C)"]]},{id:"rc",l:"Perte de charge linéaire maximale",u:"Pa/m",v:150},{id:"vm",l:"Vitesse maximale",u:"m/s",v:2},
 {id:"L",l:"Longueur aller + retour (circuit défavorisé)",u:"m",v:200},{id:"sg",l:"Majoration singularités",u:"%",v:30},{id:"eq",l:"Équipements (batterie, vanne, échangeur…)",u:"kPa",v:80},{id:"eta",l:"Rendement de la pompe",u:"%",v:60}],
 f:"q = P/(1,163·ΔT) · DN = plus petit diamètre tel que R ≤ R_max et v ≤ v_max · Δp = R·L·(1 + sing.) + équipements · P_pompe = q·Δp/η",
 run:v=>{const q=v.p/(1.163*v.dt);const Q=q/3600;const P={ef:[1.31e-6,1000],ec:[0.60e-6,990]}[v.fl];let pick=null,res=null;
  for(const [dn,di] of PIPE){const D=di/1000;const vel=4*Q/(Math.PI*D*D);const r=PHYS.J(vel,D,P[0],P[1],0.045);if(r.J<=v.rc&&vel<=v.vm){pick=[dn,di];res={vel,...r};break;}}
  if(!pick)return {rows:[["Débit",U(q,1,"m³/h"),true]],st:[["bad","Aucun DN de la table ne convient : débit trop élevé, prévoir plusieurs réseaux ou un DN > 300."]],ex:[]};
  const dpl=res.J*v.L*(1+v.sg/100);const dpt=dpl+v.eq*1000;const H=dpt/(P[1]*9.81);const Pp=Q*dpt/(v.eta/100);
  return {rows:[["Débit",U(q,1,"m³/h"),true],["DN retenu",`${pick[0]} (Ø int. ${nf(pick[1],1)} mm)`,true],["Vitesse",U(res.vel,2,"m/s")],["Perte de charge linéaire",U(res.J,0,"Pa/m")],["Pertes réseau",U(dpl/1000,1,"kPa")],["Δp totale",U(dpt/1000,1,"kPa")],["HMT",U(H,1,"mCE"),true],["Puissance hydraulique absorbée",U(Pp/1000,2,"kW")]],
  st:[["ok",`${pick[0]} est le plus petit diamètre respectant ${v.rc} Pa/m et ${v.vm} m/s.`],H>30?["warn","HMT élevée : vérifier les équipements et la longueur du circuit."]:["ok","HMT dans une plage courante."]],
  ex:[`q = ${v.p} / (1,163 × ${v.dt}) = ${nf(q,2)} m³/h`,`Essai des DN croissants : ${pick[0]} → v = ${nf(res.vel,2)} m/s, R = ${nf(res.J,0)} Pa/m (Re = ${nf(res.Re,0)})`,`Réseau = ${nf(res.J,1)} × ${v.L} × ${1+v.sg/100} = ${nf(dpl/1000,2)} kPa ; + ${v.eq} kPa d'équipements = ${nf(dpt/1000,1)} kPa`,`HMT = ${nf(dpt,0)} / (${P[1]} × 9,81) = ${nf(H,2)} mCE`,`P = ${nf(Q,4)} × ${nf(dpt,0)} / ${v.eta/100} = ${nf(Pp,0)} W`]};}},

airneuf:{t:"Débit d'air neuf réglementaire",ref:"Code du travail R.4222-6 · RSDT art. 64",ind:true,
 inputs:[{id:"ty",l:"Type de local",t:"s",v:"ct25",o:[["ct25","Code du travail — bureaux (25)"],["ct30","Code du travail — réunion, vente, restauration (30)"],["ct45","Code du travail — atelier, travail léger (45)"],["ct60","Code du travail — autres ateliers (60)"],["rb18","RSDT — bureaux (18, indicatif)"],["rr18","RSDT — réunion, spectacle (18, indicatif)"],["rv22","RSDT — vente (22, indicatif)"],["rs22","RSDT — restauration (22, indicatif)"]]},
 {id:"s",l:"Surface",u:"m²",v:500},{id:"d",l:"Densité d'occupation",u:"m²/pers",v:10},{id:"n",l:"Effectif imposé (0 = calcul par densité)",u:"pers",v:0},
 {id:"g",l:"Production de CO₂ par personne",u:"L/h",v:18},{id:"ce",l:"CO₂ extérieur",u:"ppm",v:420},{id:"ci",l:"CO₂ intérieur visé",u:"ppm",v:1000}],
 f:"q = effectif × débit unitaire · équivalent CO₂ : q/pers = G / (Ci − Ce)",
 run:v=>{const unit=parseInt(v.ty.slice(2));const n=v.n>0?v.n:Math.ceil(v.s/v.d);const q=n*unit;const qco2=(v.g/1000)/((v.ci-v.ce)*1e-6);
  return {rows:[["Effectif retenu",U(n,0,"pers")],["Débit unitaire",U(unit,0,"m³/h/pers")],["Débit d'air neuf",U(q,0,"m³/h"),true],["Débit pour tenir le CO₂ visé",U(qco2,1,"m³/h/pers")],["Soit pour l'effectif",U(qco2*n,0,"m³/h")]],
  st:[v.ty.startsWith("r")?["warn","Valeurs RSDT indicatives : lire le RSD de ton département et l'article CH applicable."]:["ok","Valeur réglementaire du code du travail (R.4222-6)."],qco2>unit?["warn",`Pour tenir ${v.ci} ppm il faut plus que le minimum réglementaire.`]:["ok",`Le minimum réglementaire suffit à tenir ${v.ci} ppm en régime établi.`]],
  ex:[v.n>0?`Effectif imposé : ${n}`:`Effectif = ${v.s} / ${v.d} = ${nf(v.s/v.d,1)} → ${n} pers`,`q = ${n} × ${unit} = ${nf(q,0)} m³/h`,`CO₂ : ${v.g/1000} / ((${v.ci} − ${v.ce}) × 10⁻⁶) = ${nf(qco2,1)} m³/h/pers`]};}},

dfmeca:{t:"Désenfumage mécanique",ref:"IT 246 — valeurs à vérifier",ind:true,
 inputs:[{id:"mo",l:"Cas",t:"s",v:"loc",o:[["loc","Local / canton / mail"],["cir","Circulation horizontale"]]},
 {id:"s",l:"Surface du canton",u:"m²",v:1333,w:v=>v.mo==="loc"},{id:"h",l:"Hauteur moyenne",u:"m",v:8,w:v=>v.mo==="loc"},{id:"tx",l:"Taux de renouvellement",h:"IT 246 : 12 vol/h",u:"vol/h",v:12,w:v=>v.mo==="loc"},{id:"cap",l:"Plafond de débit",h:"IT 246 : 3 m³/s pour 100 m²",u:"m³/s/100 m²",v:3,w:v=>v.mo==="loc"},{id:"mn",l:"Débit minimal par local",h:"IT 246 : 1,5 m³/s",u:"m³/s",v:1.5,w:v=>v.mo==="loc"},
 {id:"up",l:"Largeur de la circulation",u:"UP",v:2,w:v=>v.mo==="cir"},{id:"kup",l:"Débit par UP",h:"IT 246 : 0,5 m³/s",u:"m³/s",v:0.5,w:v=>v.mo==="cir"},{id:"mx",l:"Débit maximal d'une circulation",h:"IT 246 : 8 m³/s",u:"m³/s",v:8,w:v=>v.mo==="cir"},
 {id:"am",l:"Amenée d'air",t:"s",v:"nat",o:[["nat","Naturelle"],["mec","Mécanique (soufflage)"]]},{id:"ra",l:"Rapport soufflage / extraction",h:"≈ 0,6",u:"",v:0.6,w:v=>v.am==="mec"},{id:"va",l:"Vitesse max aux amenées",u:"m/s",v:5},
 {id:"fr",l:"Fuites du réseau",h:"ordre de grandeur",u:"%",v:20},{id:"nv",l:"Volets fermés sur le réseau",u:"u",v:0},{id:"fv",l:"Fuite par volet fermé",h:"donnée fabricant",u:"m³/s",v:0.05}],
 f:"Local : Q = max(taux × V / 3 600 ; minimum), limité au plafond × S/100 · Circulation : Q = k × UP ≤ max · Amenée : S ≥ Q_amenée / v_max · Q_vent = Q × (1 + fuites) + n × fuite volet",
 run:v=>{let Q,ex=[];
  if(v.mo==="loc"){const V=v.s*v.h;const q12=v.tx*V/3600;const cap=v.cap*v.s/100;Q=Math.max(Math.min(q12,cap),v.mn);ex.push(`V = ${v.s} × ${v.h} = ${nf(V,0)} m³ ; ${v.tx} vol/h → ${nf(q12,2)} m³/s`,`Plafond = ${v.cap} × ${v.s}/100 = ${nf(cap,2)} m³/s ; minimum ${v.mn} m³/s`,`Q extraction = ${nf(Q,2)} m³/s`);}
  else{Q=Math.min(v.kup*v.up,v.mx);ex.push(`Q = ${v.kup} × ${v.up} UP = ${nf(v.kup*v.up,2)} m³/s, limité à ${v.mx} → ${nf(Q,2)} m³/s`);}
  const Qa=v.am==="mec"?Q*v.ra:Q;const Sa=Qa/v.va;const Qv=Q*(1+v.fr/100)+v.nv*v.fv;
  ex.push(v.am==="mec"?`Soufflage = ${v.ra} × ${nf(Q,2)} = ${nf(Qa,2)} m³/s`:`Amenée naturelle : débit entrant ≈ débit extrait = ${nf(Qa,2)} m³/s`,`Section libre d'amenée ≥ ${nf(Qa,2)} / ${v.va} = ${nf(Sa,2)} m²`,`Ventilateur : ${nf(Q,2)} × ${1+v.fr/100} + ${v.nv} × ${v.fv} = ${nf(Qv,2)} m³/s`);
  return {rows:[["Débit d'extraction",U(Q,2,"m³/s"),true],["",U(Q*3600,0,"m³/h")],[v.am==="mec"?"Débit de soufflage":"Débit d'amenée naturelle",U(Qa,2,"m³/s")],["Section libre d'amenée minimale",U(Sa,2,"m²"),true],["Débit du ventilateur (fuites incluses)",U(Qv,2,"m³/s"),true],["",U(Qv*3600,0,"m³/h")]],
  st:[["warn","Valeurs IT 246 relevées dans des sources secondaires : vérifier le texte en vigueur, le type d'ERP et l'avis du préventionniste."],v.mo==="cir"&&v.kup*v.up>v.mx?["warn","Débit plafonné : découper la circulation en plusieurs zones de désenfumage."]:["ok","Débit dans le domaine courant."],["ok","Ventilateurs : tenue aux fumées à 400 °C (IT 246), alimentation de sécurité, câbles résistants au feu."]],ex};}},

dfnat:{t:"Désenfumage naturel",ref:"IT 246 — valeurs à vérifier",ind:true,
 inputs:[{id:"mo",l:"Cas",t:"s",v:"loc",o:[["loc","Local / canton"],["cir","Circulation horizontale"],["esc","Escalier encloisonné"]]},
 {id:"s",l:"Superficie du local ou du canton",u:"m²",v:800,w:v=>v.mo==="loc"},{id:"lg",l:"Longueur du canton",u:"m",v:40,w:v=>v.mo==="loc"},{id:"rt",l:"Ratio SUE",h:"IT 246 : 1/200",u:"1/…",v:200,w:v=>v.mo==="loc"},{id:"su",l:"SUE d'un exutoire choisi",u:"m²",v:1.2,w:v=>v.mo==="loc"},{id:"cv",l:"Coefficient SUE / surface géométrique",h:"donnée fabricant (ex. 0,6)",u:"",v:0.6,w:v=>v.mo==="loc"},
 {id:"up",l:"Largeur de la circulation",u:"UP",v:2,w:v=>v.mo==="cir"},{id:"lc",l:"Longueur de la circulation",u:"m",v:45,w:v=>v.mo==="cir"},{id:"dr",l:"Parcours rectiligne ?",t:"s",v:"o",o:[["o","Oui (≤ 10 m entre bouches)"],["n","Non (≤ 7 m)"]],w:v=>v.mo==="cir"}],
 f:"Local : SUE ≥ S / 200 ; canton ≤ 1 600 m² et ≤ 60 m ; amenées ≥ surface géométrique des évacuations · Circulation : 0,10 m² par UP et par bouche, distance amenée/évacuation ≤ 10 m (7 m) · Escalier : 1 m² en haut, 1 m² en bas",
 run:v=>{if(v.mo==="loc"){const SUE=v.s/v.rt;const n=Math.ceil(SUE/v.su);const geo=n*v.su/v.cv;const st=[];
   st.push(v.s>1600||v.lg>60?["bad",`Canton hors limites (≤ 1 600 m² et ≤ 60 m) : recouper en ${Math.ceil(Math.max(v.s/1600,v.lg/60))} cantons.`]:["ok","Canton dans les limites de surface et de longueur."]);
   if(v.s>1000)st.push(["warn","Local > 1 000 m² : règles de cantonnement de l'IT 246 à appliquer (le ratio 1/200 vaut pour les locaux ≤ 1 000 m² — vérifier)."]);
   st.push(["warn","Répartition : vérifier dans l'IT 246 les distances maximales et le nombre minimal d'exutoires par canton."]);
   return {rows:[["SUE minimale",U(SUE,2,"m²"),true],["Nombre d'exutoires",U(n,0,"u"),true],["SUE installée",U(n*v.su,2,"m²")],["Surface géométrique des évacuations",U(geo,2,"m²")],["Amenées d'air (surface libre) ≥",U(geo,2,"m²"),true]],st,
   ex:[`SUE = ${v.s} / ${v.rt} = ${nf(SUE,2)} m²`,`n = ⌈${nf(SUE,2)} / ${v.su}⌉ = ${n}`,`Surface géométrique ≈ ${n} × ${v.su} / ${v.cv} = ${nf(geo,2)} m²`,`Amenées ≥ surface géométrique des évacuations = ${nf(geo,2)} m²`]};}
  if(v.mo==="cir"){const sb=0.10*v.up;const dmax=v.dr==="o"?10:7;const nb=Math.ceil(v.lc/dmax)+1;
   return {rows:[["Surface libre par bouche (amenée et évacuation)",U(sb,2,"m²"),true],["Distance maximale amenée / évacuation",U(dmax,0,"m")],["Nombre minimal de bouches alternées",U(nb,0,"u"),true]],
   st:[["warn","Amenées en partie basse (haut ≤ 1 m du sol), évacuations en partie haute (bas ≥ 1,80 m) : à vérifier dans l'IT 246."]],
   ex:[`Bouche = 0,10 × ${v.up} = ${nf(sb,2)} m²`,`Bouches = ⌈${v.lc} / ${dmax}⌉ + 1 = ${nb} (alternance amenée / évacuation)`]};}
  return {rows:[["Exutoire en partie haute",U(1,0,"m²"),true],["Amenée d'air en partie basse",U(1,0,"m²"),true]],st:[["warn","Valeurs IT 246 pour un escalier encloisonné : vérifier le texte et les dispositions particulières."]],ex:["Escalier encloisonné : 1 m² de SUE en partie haute et 1 m² d'amenée en partie basse (IT 246)."]};}},

bacs:{t:"Éligibilité au décret BACS",ref:"Décret 2020-887 modifié · décret 2025-1343",
 inputs:[{id:"p",l:"Puissance nominale utile CVC (chauffage ou clim, + ventilation)",u:"kW",v:180},{id:"st",l:"Bâtiment",t:"s",v:"ex",o:[["ex","Existant"],["ne","Neuf (permis récent)"]]},{id:"te",l:"Usage tertiaire ?",t:"s",v:"o",o:[["o","Oui"],["n","Non"]]}],
 f:"> 290 kW : obligation depuis le 1er janvier 2025 · 70 à 290 kW (existant) : 1er janvier 2030 · neuf : dès la construction (vérifier date du PC)",
 run:v=>{const r=[],st=[];
  if(v.te==="n"){st.push(["ok","Bâtiment non tertiaire : décret BACS non applicable à ce titre."]);r.push(["Obligation","Non (hors tertiaire)",true]);}
  else if(v.p>290){r.push(["Obligation","Oui",true],["Échéance",v.st==="ex"?"1er janvier 2025 (dépassée)":"Dès la construction"]);st.push(["bad",v.st==="ex"?"Échéance dépassée : mettre en conformité sans attendre (sauf dérogation justifiée par le temps de retour).":"Prévoir la GTB conforme dans le projet."]);}
  else if(v.p>70){r.push(["Obligation","Oui",true],["Échéance",v.st==="ex"?"1er janvier 2030":"Selon date du permis — vérifier le décret modifié"]);st.push(["warn",v.st==="ex"?"Report au 1er janvier 2030 (décret n° 2025-1343). Anticiper avec le décret tertiaire.":"Neuf entre 70 et 290 kW : vérifier les seuils et dates applicables selon le dépôt du permis."]);}
  else{r.push(["Obligation","Non (≤ 70 kW)",true]);st.push(["ok","Sous le seuil : la GTB reste recommandée pour le décret tertiaire."]);}
  r.push(["Classe GTB visée (indicatif)","B (NF EN ISO 52120-1)"]);st.push(["warn","Dérogation possible si le temps de retour dépasse le seuil du décret : à démontrer par une étude."]);
  return {rows:r,st,ex:[`Puissance saisie : ${v.p} kW`,"Seuils : 290 kW (2025) et 70 kW (2030 pour l'existant)","Fonctions : suivi horaire par zone, conservation des données, détection des dérives, interopérabilité, arrêt manuel, gestion autonome"]};}},

tertiaire:{t:"Trajectoire décret tertiaire",ref:"Décret 2019-771 · objectifs relatifs",
 inputs:[{id:"cr",l:"Consommation de référence",u:"kWh/an",v:1200000},{id:"s",l:"Surface",u:"m²",v:6000},{id:"ca",l:"Consommation actuelle",u:"kWh/an",v:950000}],
 f:"Objectif année N = Cref × (1 − 40 % | 50 % | 60 %) · écart = Cactuelle − objectif",
 run:v=>{const o=[[2030,0.6],[2040,0.5],[2050,0.4]].map(([y,k])=>[y,v.cr*k]);const g=v.ca-o[0][1];const red=1-v.ca/v.cr;
  return {rows:[["Référence",`${U(v.cr,0,"kWh")} · ${U(v.cr/v.s,0,"kWh/m²")}`],...o.map(([y,c])=>[`Objectif ${y}`,`${U(c,0,"kWh")} · ${U(c/v.s,0,"kWh/m²")}`,y===2030]),["Réduction déjà obtenue",U(red*100,1,"%"),true],["Écart à combler pour 2030",U(Math.max(0,g),0,"kWh/an"),true]],
  st:[g<=0?["ok","Objectif 2030 déjà atteint en valeur relative."]:["warn",`Il reste ${U(g/v.ca*100,0,"%")} de la consommation actuelle à économiser d'ici 2030 (ou viser la valeur absolue de l'activité).`]],
  ex:[`2030 : ${nf(v.cr,0)} × 0,6 = ${nf(o[0][1],0)} kWh`,`2040 : × 0,5 = ${nf(o[1][1],0)} kWh ; 2050 : × 0,4 = ${nf(o[2][1],0)} kWh`,`Réduction actuelle = 1 − ${nf(v.ca,0)}/${nf(v.cr,0)} = ${nf(red*100,1)} %`]};}},

textes:{t:"Quels textes s'appliquent ?",ref:"Aide au classement — à confirmer avec le bureau de contrôle",
 inputs:[{id:"ty",l:"Bâtiment",t:"s",v:"M",o:[["B","Bureaux (code du travail)"],["W","ERP type W (administrations, banques, bureaux)"],["L","ERP type L (salles de réunion, spectacles)"],["N","ERP type N (restauration)"],["M","ERP type M (magasins, centre commercial)"],["PS","Parc de stationnement couvert"]]},{id:"ca",l:"Catégorie ERP",t:"s",v:"1",o:[["1","1re"],["2","2e"],["3","3e"],["4","4e"],["5","5e"],["-","Sans objet"]]},{id:"ne",l:"Opération",t:"s",v:"n",o:[["n","Neuf"],["e","Existant / rénovation"]]},{id:"s",l:"Surface tertiaire",u:"m²",v:25000},{id:"p",l:"Puissance CVC",u:"kW",v:2200}],
 f:"Synthèse pédagogique des textes à ouvrir en premier",
 run:v=>{const t=[];const erp=v.ty!=="B";
  if(erp){t.push("Arrêté du 25 juin 1980 modifié (GN, CO, DF, CH, GC, MS) — versions 2025-2026 des articles CH");t.push("IT 246 (désenfumage)");if(v.ty==="M")t.push("Dispositions particulières type M (mails, réserves) ; IT 263 en cas d'atrium");if(v.ty==="PS")t.push("Dispositions PS (ventilation, détection CO, désenfumage)");if(v.ty==="N")t.push("Articles GC (cuisines) modifiés au 1er janvier 2026 ; NF EN 16282");if(v.ca!=="5"&&v.ca!=="-")t.push(`Catégorie ${v.ca} : SSI selon le règlement, NF S 61-932 et 61-970 (révisions décembre 2024)`);else t.push("5e catégorie : assouplissements CH (arrêté du 29 juillet 2025)");t.push("RSDT pour la ventilation côté public ; code du travail pour le personnel");}
  else{t.push("Code du travail R.4222-1 à 26 (aération), R.4216-13 et arrêté du 5 août 1992 (désenfumage)");}
  t.push(v.ne==="n"?(v.ty==="B"?"RE2020 (bureaux, depuis 2022)":"RE2020 tertiaire étendue si permis déposé depuis le 1er mai 2026 (vérifier l'usage)"):"Décret 2023-444 (régulation, calorifugeage) — existant : 2030");
  if(v.s>=1000)t.push("Décret tertiaire (OPERAT, affichage depuis le 1er juillet 2026)");
  if(v.p>70)t.push(v.p>290?"Décret BACS : GTB obligatoire (> 290 kW)":"Décret BACS : GTB obligatoire au 1er janvier 2030 si existant (70–290 kW)");
  t.push("F-gas III et NF EN 378 pour les productions frigorifiques");
  return {rows:t.map((x,i)=>[String(i+1),x]),st:[["warn","Liste d'aide : le classement définitif est validé par la commission de sécurité et le bureau de contrôle."]],ex:["Le classement (type, catégorie) pilote les textes de sécurité ; la surface et la puissance pilotent les obligations énergétiques."]};}}
};

export { PATM, RHO_AIR, PHYS, nf, U, CALCS };
