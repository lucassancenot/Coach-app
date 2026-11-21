/**
 * Moteur de planification. Tout est déterministe et chiffré.
 *
 * Références principales :
 * - Helgerud et al. 2001 (MSSE) : 4×4 min à 90-95 % FCmax, 2×/sem, 8 sem chez des footballeurs
 *   → VO2max +11 %, distance en match +20 %, sprints ×2.
 * - Schumann et al. 2022 (Sports Med) : l'entraînement concurrent n'altère ni la force max ni
 *   l'hypertrophie, mais freine la puissance, surtout si course et muscu sont dans la même séance.
 * - Périard et al. 2015/2021 : acclimatation à la chaleur, 60-90 min/j, l'essentiel en 7-14 j.
 * - Bickel 2011, Spiering 2021 : la force se maintient avec ~1/3 du volume si l'intensité reste.
 * - Buchheit 2008 : 30-15 IFT pour calibrer les intermittents.
 * - van der Horst 2015 : Nordic hamstring → environ moitié moins de blessures aux ischios.
 * - Bosquet 2007 (méta-analyse) : affûtage de 8-14 j, volume -41 à -60 %, intensité maintenue.
 * - Seiler 2010 : la majorité du volume en intensité basse (80/20).
 * - Robineau et al. 2016 : ≥ 6 h (idéalement 24 h) entre force et endurance intense.
 * - Buchheit & Laursen 2013 ; Buchheit 2008-2021 : intermittents réglés sur la VIFT (85-105 %).
 * - Buchheit et al. 2023 : exposition > 95 % Vmax 2 jours avant le match → aucune blessure ischio en match.
 * - Racinais et al. 2015 (consensus) : acclimatation 60-90 min/j sur 1-2 semaines.
 * - Données de match : les latéraux ont les plus gros pics de course à haute vitesse et de sprints.
 */
import { addDays, daysBetween, mondayOf, weekday } from "./dates";
import { gymSession, type GymId } from "./programs";

export type SessionKind = "run" | "gym" | "test" | "rest" | "recovery";

export interface Session {
  kind: SessionKind;
  key: string; // identifiant stable, sert à détecter si la séance a été faite
  title: string;
  lines: string[]; // prescription précise
  hr?: [number, number]; // fourchette FC cible
  durationMin?: number;
  template?: string; // nom de la séance de salle (sert à détecter si elle a été faite)
  gymId?: GymId; // séance de salle du programme du coach
  keySession?: boolean; // séance clé : alerte si elle saute
}

export interface Phase {
  id: "force" | "base" | "foot" | "affutage" | "saison";
  name: string;
  start: string;
  end: string; // inclus
  goal: string;
  rules: string[];
}

export const PHASES: Phase[] = [
  {
    id: "force",
    name: "Bloc de force",
    start: "2026-11-16",
    end: "2027-01-03",
    goal: "Monter la force maximale (4 séances de salle) et construire la base de course, en 6 séances par semaine, une par jour : la course est collée à la salle.",
    rules: [
      "Exercices de base en vagues : 4×6 → 4×5 → 5×4 → 5×3 → 3×3, charges calculées depuis ton 1RM estimé et le RIR visé.",
      "Séance combinée : sprints et sauts d'abord, charges lourdes ensuite, endurance à la fin. Le fractionné suit le haut du corps, jamais la veille des jambes.",
      "La course monte progressivement depuis tes 2 sorties actuelles pour éviter un pic de charge.",
      "Semaine du 28 déc. = décharge (2 séries, RIR 4) avant le départ.",
    ],
  },
  {
    id: "base",
    name: "Base aérobie + chaleur (Singapour)",
    start: "2027-01-04",
    end: "2027-02-28",
    goal: "Construire un gros moteur aérobie (5 courses/sem) et s'acclimater à la chaleur. Salle : 3 séances, force maintenue lourde. 6 séances, une par jour.",
    rules: [
      "Courses pilotées à la FC et au ressenti, jamais à l'allure : à 30 °C et 80 % d'humidité, l'allure chute normalement.",
      "Courir tôt le matin ou le soir. Boire 500 ml dans l'heure avant, 400-800 ml/h pendant les sorties > 60 min.",
      "≥ 80 % du temps de course en Z1-Z2.",
      "Salle : 3×4 à RIR 2 sur les exercices de base. 1 séance lourde par semaine suffit à maintenir la force (Rønnestad 2011).",
      "Semaine du 8 févr. = décharge.",
    ],
  },
  {
    id: "foot",
    name: "Spécifique foot",
    start: "2027-03-01",
    end: "2027-04-25",
    goal: "Transformer le moteur en capacité à répéter les efforts intenses (profil latéral).",
    rules: [
      "Les intermittents se règlent sur ta VIFT (test 30-15 IFT).",
      "Sprint > 90 % Vmax 1-2×/sem : la meilleure protection connue des ischios.",
      "Semaines du 22 mars et du 19 avril = décharge (volume -30 %).",
      "Le ballon (jeu réduit, matchs) remplace les séances marquées « ou ballon ». Le coach réorganise autour.",
    ],
  },
  {
    id: "affutage",
    name: "Affûtage + retour",
    start: "2027-04-26",
    end: "2027-05-09",
    goal: "Arriver frais à Montréal : volume -40 puis -60 %, intensité conservée.",
    rules: [
      "On garde les séances intenses mais on les raccourcit.",
      "Vol du 8 mai : 12 h de décalage. 2-3 jours faciles avant de reprendre l'intensité.",
    ],
  },
  {
    id: "saison",
    name: "Saison / entretien",
    start: "2027-05-10",
    end: "2099-12-31",
    goal: "Entretenir le moteur et la force. Si tu trouves un club, les entraînements d'équipe remplacent les séances de conditionnement.",
    rules: [
      "Le match ou l'entraînement le plus intense de la semaine compte comme séance clé.",
      "Pas de séance de jambes lourde à moins de 48 h d'un match.",
    ],
  },
];

export function phaseFor(date: string): Phase {
  return PHASES.find((p) => date >= p.start && date <= p.end) ?? PHASES[0];
}

export interface Zones {
  z1: [number, number];
  z2: [number, number];
  z3: [number, number];
  z4: [number, number];
  z5: [number, number];
  helgerud: [number, number];
}

/** Zones en % FCmax (modèle 5 zones). */
export function zones(hrMax: number): Zones {
  const p = (x: number) => Math.round(hrMax * x);
  return {
    z1: [p(0.5), p(0.7) - 1],
    z2: [p(0.7), p(0.8) - 1],
    z3: [p(0.8), p(0.87) - 1],
    z4: [p(0.87), p(0.93) - 1],
    z5: [p(0.93), hrMax],
    helgerud: [p(0.9), p(0.95)],
  };
}

export interface PlanContext {
  hrMax: number;
  vift: number | null; // km/h
}

/** Distance (m) à parcourir en `sec` secondes à un % de la VIFT (ligne droite). */
function dist(vift: number | null, pct: number, sec: number): string {
  if (!vift) return `≈ ${Math.round(pct * 100)} % de ta VIFT (fais le test 30-15 IFT pour avoir la distance exacte ; en attendant, effort très dur mais tenable sur toute la série)`;
  const m = Math.round(((vift * pct) / 3.6) * sec);
  return `${m} m en ${sec} s (${Math.round(pct * 100)} % de ta VIFT ${vift} km/h)`;
}

const REST: Session = { kind: "rest", key: "rest", title: "Repos", lines: ["Repos complet. Sommeil ≥ 8 h, 1,6-2,2 g de protéines/kg/j."] };

/** Séance de salle du programme (le détail des exercices et des charges est dans l'onglet Salle). */
function gymS(id: GymId, phase: Phase["id"], week: number, deload: boolean, extra: string[] = []): Session {
  const g = gymSession(id, phase, week, deload);
  const mains = g.items.filter((i) => i.main).map((i) => `${i.exercise} ${i.sets}×${i.reps} @RIR${i.rir}`);
  return {
    kind: "gym",
    key: `gym-${id}`,
    title: g.title,
    template: g.title,
    gymId: id,
    keySession: true,
    lines: [g.focus, ...(mains.length ? [`Exercices de base : ${mains.join(" · ")}.`] : []), `${g.items.length} exercices, charges calculées dans l'onglet Salle.`, ...extra],
  };
}

function z2(min: number, ctx: PlanContext, extra: string[] = [], title?: string): Session {
  const z = zones(ctx.hrMax);
  return {
    kind: "run",
    key: "run-z2",
    title: title ?? `Footing Z2 · ${min} min`,
    durationMin: min,
    hr: z.z2,
    lines: [`${min} min entre ${z.z2[0]} et ${z.z2[1]} bpm. Tu dois pouvoir parler en phrases complètes.`, ...extra],
  };
}

function longRun(min: number, ctx: PlanContext, ballon = true): Session {
  const z = zones(ctx.hrMax);
  return {
    kind: "run",
    key: "run-long",
    title: `Sortie longue · ${min} min${ballon ? " (ou ballon)" : ""}`,
    durationMin: min,
    hr: z.z2,
    keySession: true,
    lines: [
      `${min} min en Z2 (${z.z2[0]}-${z.z2[1]} bpm). Si la FC dépasse ${z.z2[1]}, ralentis ou marche.`,
      "Objectif : dérive cardiaque < 5 %.",
      ...(ballon ? ["Si tu as un match ou du ballon (60-90 min) ce jour-là, il remplace cette sortie."] : []),
    ],
  };
}

function helgerud(reps: number, ctx: PlanContext, minutes = 4): Session {
  const z = zones(ctx.hrMax);
  return {
    kind: "run",
    key: "run-hiit",
    title: `Fractionné ${reps}×${minutes} min`,
    durationMin: 15 + reps * (minutes + 3),
    hr: z.helgerud,
    keySession: true,
    lines: [
      "Échauffement 12 min en Z1-Z2 + 3 accélérations de 15 s.",
      `${reps} × ${minutes} min à ${z.helgerud[0]}-${z.helgerud[1]} bpm (90-95 % FCmax, Helgerud 2001)${ctx.vift ? `, soit ~${Math.round(ctx.vift * 0.8 * 10) / 10} km/h (80 % VIFT) sur le plat` : ""}. La FC met 1-2 min à monter : ne pars pas trop vite.`,
      `Récupération 3 min de trot léger (~${Math.round(ctx.hrMax * 0.7)} bpm).`,
      "Retour au calme 5 min.",
    ],
  };
}

function test3015(): Session {
  return {
    kind: "test",
    key: "test-3015",
    title: "Test 30-15 IFT",
    keySession: true,
    lines: [
      "Sur terrain ou salle (40 m minimum) : 3 lignes (A, milieu, B) à 40 m d'écart, zones de tolérance de 3 m.",
      "Paliers de 30 s de course + 15 s de récup, en suivant la bande-son. Départ 8 km/h, +0,5 km/h par palier.",
      "Ta VIFT = la vitesse du dernier palier complété. Entre-la dans l'onglet Course : toutes les distances des fractionnés se recalculent.",
      "Échauffement 15 min avant. Pas de séance intense dans les 48 h qui précèdent.",
    ],
  };
}

function intermittent(series: number, minutes: number, ctx: PlanContext, pattern: "15/15" | "10/20" | "30/30" = "15/15", rsa = 0): Session {
  const [work] = pattern.split("/").map(Number);
  const pct = pattern === "10/20" ? 1.0 : pattern === "30/30" ? 0.9 : 0.95;
  const lines = [
    "Échauffement 12 min + gammes + 3 accélérations.",
    `${series} séries de ${minutes} min en ${pattern} (s course / s récup) : ${dist(ctx.vift, pct, work)}.`,
    "3 min de récup marchée entre les séries (Buchheit & Laursen 2013).",
  ];
  if (pattern === "30/30") lines[1] += " En navettes de 20 m : retire ~10 % de distance pour les demi-tours.";
  if (rsa > 0) lines.push(`Puis ${rsa} série(s) de 6 × 30 m en navette (15 + 15 m), départ toutes les 25 s, 4 min entre les séries (sprints répétés).`);
  return { kind: "run", key: "run-1515", title: `Intermittent ${pattern} · ${series}×${minutes} min${rsa ? " + sprints répétés" : ""}`, keySession: true, lines };
}

function maxSpeed(reps: number, cod = false, extra: string[] = []): Session {
  const lines = [
    "Échauffement 15 min : footing, gammes (montées de genoux, talons-fesses, foulées bondissantes), 3 accélérations progressives.",
    "3 × 20 m départ arrêté (accélération), récup 90 s.",
    `${reps} × 20 m lancés après 20 m d'élan : vitesse MAX (> 95 % de ta Vmax), récup complète 3 min. Stop si tu ralentis.`,
  ];
  if (cod) lines.push("6 × navette 5-10-5 (changements de direction), récup 90 s.");
  lines.push(
    "Sprinter vraiment vite chaque semaine protège les ischios : aucune blessure en match quand > 95 % Vmax était atteint 2 jours avant (Buchheit 2023).",
    ...extra,
  );
  return { kind: "run", key: "run-sprint", title: cod ? "Vitesse max + changements de direction" : "Vitesse max", keySession: true, lines };
}

function rsaMatch(sets: number, ctx: PlanContext): Session {
  const z = zones(ctx.hrMax);
  return {
    kind: "run",
    key: "run-rsa",
    title: "Simulation de match (ou match)",
    keySession: true,
    lines: [
      "Échauffement 15 min + gammes + 3 accélérations.",
      `${sets} séries de 6 × 30 m (navette 15 + 15 m), départ toutes les 25 s, 4 min de récup active entre les séries.`,
      `Puis 25 min en Z2 (${z.z2[0]}-${z.z2[1]} bpm) : courir fatigué, comme en fin de match.`,
      "Si tu joues un match ce jour-là, il remplace la séance.",
    ],
  };
}

function plyoShort(contacts: number): Session {
  return {
    kind: "run",
    key: "run-sprint",
    title: "Rappel vitesse + pliométrie",
    lines: [
      "Échauffement 12 min + gammes.",
      "3 × 20 m lancés à vitesse max, récup 3 min.",
      `Pliométrie ~${contacts} contacts : sauts groupés, bonds alternés, hops latéraux. Contacts courts, qualité max.`,
      "Séance courte (30 min) : on stimule, on ne fatigue pas.",
    ],
  };
}

function prevention(): string {
  return "Après la course : prévention 15 min (Nordic 2×4, Copenhague 2×6/côté, mollets 2×15).";
}

// ─── Phases ───────────────────────────────────────────────────────
// 6 séances par semaine, un seul déplacement par jour : la course est collée à la salle.
// Ordre dans une séance combinée : neuromusculaire d'abord (sprints, sauts), puis charges lourdes,
// puis endurance. Course + muscu dans la même séance n'altère ni la force ni l'hypertrophie
// (Schumann 2022) ; seule l'explosivité en pâtit un peu, d'où les sprints en début de séance.
// À volume égal, la fréquence change peu les gains (Schoenfeld 2019).

const FIRST = "En début de séance, avant la salle (même déplacement).";
const AFTER = "Juste après la salle, dans la même séance (tapis, vélo ou dehors).";

function phaseForce(week: number, day: number, ctx: PlanContext): Session[] {
  const deload = week >= 6; // semaine du 28 déc.
  const z2min = [30, 30, 35, 40, 40, 40, 30][Math.min(week, 6)];
  const long = [45, 45, 50, 55, 60, 60, 40][Math.min(week, 6)];
  const hiit: Session = deload
    ? helgerud(3, ctx)
    : week === 3
      ? helgerud(5, ctx, 3)
      : week === 5
        ? intermittent(2, 8, ctx, "15/15")
        : helgerud(4, ctx);
  const withNote = (s: Session, note: string): Session => ({ ...s, lines: [note, ...s.lines] });
  switch (day) {
    case 0:
      return [maxSpeed(deload ? 2 : 4, false, [FIRST, "Pas d'espace pour sprinter à la salle : fais-les juste avant d'entrer, ou 6 × 8 s en côte."]), gymS("basA", "force", week, deload)];
    case 1:
      return [gymS("hautA", "force", week, deload), withNote(hiit, AFTER)];
    case 2:
      return [{ ...REST, lines: ["Repos (études). 48 h entre le fractionné et la séance de jambes de jeudi."] }];
    case 3:
      return [gymS("basB", "force", week, deload)];
    case 4:
      return [gymS("hautB", "force", week, deload), z2(z2min, ctx, [AFTER, "4 accélérations progressives de 20 s à la fin."])];
    case 5:
      return [longRun(long, ctx)];
    default:
      return [REST];
  }
}

function phaseBase(week: number, day: number, ctx: PlanContext, date: string): Session[] {
  const z = zones(ctx.hrMax);
  // Semaine 1 : vol, décalage horaire (13 h) et chaleur. Pas d'intensité (Racinais 2015 : 60-90 min/j d'exposition).
  if (week === 0) {
    const heat = (min: number, extra: string[] = []): Session => ({
      kind: "run",
      key: "run-z2",
      title: `Footing chaleur · ${min} min`,
      durationMin: min,
      hr: [z.z1[0], z.z2[1] - 5],
      lines: [
        ...extra,
        `${min} min sous ${z.z2[1] - 5} bpm, dehors, tôt le matin. Marche si la FC dépasse.`,
        "Acclimatation : 60-90 min/jour d'exposition à la chaleur pendant 1 à 2 semaines (consensus Racinais 2015). L'exposition compte plus que la vitesse.",
      ],
    });
    return [
      [{ kind: "rest", key: "rest", title: "Vol Montréal → Singapour", lines: ["Bois beaucoup, marche dans l'avion toutes les 2 h. Cale-toi sur l'heure de Singapour dès l'embarquement."] } as Session],
      [{ kind: "recovery", key: "recovery", title: "Arrivée · marche 30-45 min dehors", lines: ["Lumière du jour le matin pour recaler l'horloge (13 h de décalage). Pas de sieste > 20 min."] } as Session],
      [heat(45)],
      [gymS("hautA", "base", week, false), heat(30, [AFTER])],
      [heat(55)],
      [gymS("basA", "base", week, false)],
      [heat(60)],
    ][day];
  }
  if (week === 1) {
    return [
      [maxSpeed(3, false, [FIRST]), gymS("basA", "base", week, false)],
      [gymS("hautA", "base", week, false), { ...helgerud(3, ctx), lines: [AFTER, ...helgerud(3, ctx).lines] }],
      [z2(55, ctx, [prevention()], "Footing Z2 · 55 min (ou ballon)")],
      [gymS("basB", "base", week, false)],
      [z2(45, ctx)],
      [longRun(65, ctx)],
      [REST],
    ][day];
  }
  const deload = week === 5; // semaine du 8 févr.
  const isTestDay = date === "2027-01-21" || date === "2027-02-25";
  const long = [0, 0, 70, 75, 80, 55, 85, 90][week];
  const hiitLong = [null, null, helgerud(4, ctx), helgerud(5, ctx), helgerud(6, ctx, 3), helgerud(3, ctx), helgerud(5, ctx), helgerud(6, ctx)][week]!;
  const fri: Session =
    week === 2 ? z2(50, ctx) : intermittent(deload ? 2 : week >= 6 ? 3 : 2, deload ? 6 : week >= 6 ? 7 : 8, ctx, "15/15");
  switch (day) {
    case 0:
      return [maxSpeed(deload ? 3 : 5, true, [FIRST]), gymS("basA", "base", week, deload)];
    case 1:
      return [gymS("hautA", "base", week, deload), { ...hiitLong, lines: [AFTER, ...hiitLong.lines] }];
    case 2:
      return [z2(deload ? 40 : 55, ctx, [prevention()], `Footing Z2 · ${deload ? 40 : 55} min (ou ballon)`)];
    case 3:
      return isTestDay
        ? [test3015(), gymS("basB", "base", week, true, ["Après le test, dans la même séance : version allégée, saute la pliométrie."])]
        : [gymS("basB", "base", week, deload)];
    case 4:
      return [fri];
    case 5:
      return [longRun(long, ctx)];
    default:
      return [REST];
  }
}

function phaseFoot(week: number, day: number, ctx: PlanContext, date: string): Session[] {
  const deload = week === 3 || week === 7;
  const plan: [number, number, "15/15" | "10/20"][] = [
    [2, 8, "15/15"], [3, 7, "15/15"], [3, 8, "10/20"], [2, 6, "15/15"], [3, 8, "15/15"], [3, 8, "10/20"], [4, 7, "15/15"], [2, 6, "10/20"],
  ];
  const [s, m, pat] = plan[week];
  const rsa = deload ? 1 : week >= 4 ? 3 : 2;
  const isTestDay = date === "2027-03-25" || date === "2027-04-22";
  const i3030 = intermittent(deload ? 2 : 3, 6, ctx, "30/30");
  switch (day) {
    case 0:
      return [maxSpeed(deload ? 3 : 5, false, [FIRST]), gymS("basA", "foot", week, deload)];
    case 1:
      return [intermittent(s, m, ctx, pat, deload ? 0 : 1)];
    case 2:
      return [gymS("hautA", "foot", week, deload), z2(deload ? 25 : 30, ctx, [AFTER, prevention()])];
    case 3:
      return isTestDay
        ? [test3015()]
        : [{ ...i3030, title: "Intermittent 30/30 navettes (ou ballon)", lines: [...i3030.lines, "Si tu fais du ballon ou du jeu réduit ce jour-là, il remplace cette séance."] }];
    case 4:
      return [{ ...REST, lines: ["Repos (études). La séance de samedi est la plus dure de la semaine."] }];
    case 5:
      return [{ ...rsaMatch(rsa, ctx), lines: [...rsaMatch(rsa, ctx).lines, `Avant les sprints répétés : 3 × 20 m lancés + pliométrie ~${deload ? 20 : 40} contacts (sauts groupés, bonds, hops).`] }];
    default:
      return [REST];
  }
}

function phaseAffutage(week: number, day: number, ctx: PlanContext): Session[] {
  // Bosquet 2007 : volume -41 à -60 %, intensité maintenue, 8-14 jours.
  if (week === 0) {
    return [
      [maxSpeed(4, false, [FIRST]), gymS("basA", "affutage", week, false)],
      [intermittent(2, 6, ctx, "15/15")],
      [gymS("hautA", "affutage", week, false), z2(30, ctx, [AFTER])],
      [maxSpeed(3, true)],
      [REST],
      [rsaMatch(1, ctx)],
      [REST],
    ][day];
  }
  return [
    [maxSpeed(3, false, [FIRST]), gymS("basA", "affutage", week, true)],
    [intermittent(1, 6, ctx, "15/15")],
    [z2(30, ctx, ["4 lignes droites."])],
    [plyoShort(20)],
    [REST],
    [{ kind: "rest", key: "rest", title: "Vol Singapour → Montréal", lines: ["Bois beaucoup, marche dans l'avion toutes les 2 h."] } as Session],
    [{ kind: "recovery", key: "run-z1", title: "Décalage · 20 min Z1 + marche", lines: ["Exposition à la lumière le matin, footing très facile."] } as Session],
  ][day];
}

function phaseSaison(day: number, ctx: PlanContext): Session[] {
  return [
    [maxSpeed(4, false, [FIRST]), gymS("basA", "saison", 0, false, ["Pas à moins de 48 h d'un match."])],
    [intermittent(2, 8, ctx, "15/15", 1)],
    [gymS("hautA", "saison", 0, false), z2(30, ctx, [AFTER, prevention()])],
    [maxSpeed(3, true, ["2 jours avant le match : la meilleure fenêtre pour sprinter (Buchheit 2023)."])],
    [{ ...REST, lines: ["Veille de match : repos ou 20 min très facile."] }],
    [{ ...rsaMatch(2, ctx), title: "Match (ou simulation de match)" }],
    [REST],
  ][day];
}

export function sessionsFor(date: string, ctx: PlanContext): Session[] {
  const phase = phaseFor(date);
  const week = Math.floor(daysBetween(mondayOf(phase.start), mondayOf(date)) / 7);
  const day = weekday(date);
  switch (phase.id) {
    case "force":
      return phaseForce(week, day, ctx);
    case "base":
      return phaseBase(week, day, ctx, date);
    case "foot":
      return phaseFoot(week, day, ctx, date);
    case "affutage":
      return phaseAffutage(week, day, ctx);
    default:
      return phaseSaison(day, ctx);
  }
}

/** Semaine de la phase et décharge, pour retrouver la séance de salle d'un jour donné. */
export function gymSessionFor(date: string, ctx: PlanContext) {
  const s = sessionsFor(date, ctx).find((x) => x.kind === "gym" && x.gymId);
  if (!s || !s.gymId) return null;
  const phase = phaseFor(date);
  const week = Math.floor(daysBetween(mondayOf(phase.start), mondayOf(date)) / 7);
  const deload =
    (phase.id === "force" && week >= 6) ||
    (phase.id === "base" && week === 5) ||
    (phase.id === "foot" && (week === 3 || week === 7)) ||
    (phase.id === "affutage" && week === 1);
  return gymSession(s.gymId, phase.id, phase.id === "saison" ? 0 : week, deload);
}

/** Étiquette courte pour la vue calendrier. */
export function shortLabel(s: Session): string {
  if (s.kind === "gym") return (s.template ?? "Salle").split(" · ")[0].replace("Upper", "Haut").replace("Lower", "Bas");
  switch (s.key) {
    case "run-z2":
      return s.durationMin ? `Z2 ${s.durationMin}′` : "Z2";
    case "run-long":
      return s.durationMin ? `Long ${s.durationMin}′` : "Long";
    case "run-hiit":
      return s.title.replace("Fractionné ", "");
    case "run-1515":
      return /30\/30/.test(s.title) ? "30/30" : /10\/20/.test(s.title) ? "10/20" : "15/15";
    case "run-rsa":
      return "Match";
    case "run-sprint":
      return s.title.startsWith("Rappel") ? "Vitesse+plio" : "Vitesse";
    case "test-3015":
      return "Test IFT";
    case "run-z1":
    case "recovery":
      return "Récup";
    default:
      return s.title.startsWith("Vol") ? "Vol" : "Repos";
  }
}

export interface DayPlan {
  date: string;
  sessions: Session[];
}

export function weekPlan(anyDate: string, ctx: PlanContext): DayPlan[] {
  const mon = mondayOf(anyDate);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(mon, i);
    return { date, sessions: sessionsFor(date, ctx) };
  });
}

export function phaseWeek(date: string): { phase: Phase; week: number; totalWeeks: number } {
  const phase = phaseFor(date);
  const week = Math.floor(daysBetween(mondayOf(phase.start), mondayOf(date)) / 7) + 1;
  // Phase « saison » sans fin : pas de nombre total de semaines (0).
  const totalWeeks = phase.id === "saison" ? 0 : Math.ceil((daysBetween(phase.start, phase.end) + 1) / 7);
  return { phase, week, totalWeeks };
}
