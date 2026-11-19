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
 */
import { addDays, daysBetween, mondayOf, weekday } from "./dates";

export type SessionKind = "run" | "gym" | "test" | "rest" | "recovery";

export interface Session {
  kind: SessionKind;
  key: string; // identifiant stable, sert à détecter si la séance a été faite
  title: string;
  lines: string[]; // prescription précise
  hr?: [number, number]; // fourchette FC cible
  durationMin?: number;
  template?: string; // modèle de salle à utiliser
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
    goal: "Finir le bloc de force en gardant le cardio. La salle est la priorité.",
    rules: [
      "Exercices de base en 3×5 à RIR 1-2. Toutes les séries au haut de la fourchette avec RIR ≥ 1 → +2,5 kg (haut du corps) / +5 kg (bas du corps).",
      "Jamais de fractionné la veille d'une séance Lower.",
      "Semaine du 28 déc. = décharge (charges -10 %, séries ÷2) avant le départ.",
    ],
  },
  {
    id: "base",
    name: "Base aérobie + chaleur (Singapour)",
    start: "2027-01-04",
    end: "2027-02-28",
    goal: "Construire un gros moteur aérobie et s'acclimater à la chaleur. Salle en entretien.",
    rules: [
      "Courses pilotées à la FC et au ressenti, jamais à l'allure : à 30 °C et 80 % d'humidité, l'allure chute normalement.",
      "Courir tôt le matin ou le soir. Boire 500 ml dans l'heure avant, 400-800 ml/h pendant les sorties > 60 min.",
      "≥ 80 % du temps de course en Z1-Z2.",
      "Salle : 2 séries par exercice de base, mêmes charges, RIR 2. On maintient, on ne pousse pas.",
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

/** Distance (m) à parcourir en 15 s à un % de la VIFT. */
function dist15(vift: number | null, pct: number): string {
  if (!vift) return "fais le test 30-15 IFT pour obtenir tes distances exactes";
  const m = Math.round(((vift * pct) / 3.6) * 15);
  return `${m} m en 15 s (${Math.round(pct * 100)} % de ta VIFT ${vift} km/h)`;
}

const REST: Session = { kind: "rest", key: "rest", title: "Repos", lines: ["Repos complet. Sommeil ≥ 8 h."] };

function nordicDose(week: number): string {
  const doses = ["2×3", "2×4", "2×5", "3×4", "3×5", "3×6", "2×4"];
  return doses[Math.min(week, doses.length - 1)];
}

function gym(template: string, lines: string[]): Session {
  return { kind: "gym", key: `gym-${template}`, title: template, template, lines, keySession: true };
}

function z2(min: number, ctx: PlanContext, extra: string[] = []): Session {
  const z = zones(ctx.hrMax);
  return {
    kind: "run",
    key: "run-z2",
    title: `Footing Z2 · ${min} min`,
    durationMin: min,
    hr: z.z2,
    lines: [`${min} min entre ${z.z2[0]} et ${z.z2[1]} bpm. Tu dois pouvoir parler en phrases complètes.`, ...extra],
  };
}

function longRun(min: number, ctx: PlanContext): Session {
  const z = zones(ctx.hrMax);
  return {
    kind: "run",
    key: "run-long",
    title: `Sortie longue · ${min} min`,
    durationMin: min,
    hr: z.z2,
    keySession: true,
    lines: [
      `${min} min en Z2 (${z.z2[0]}-${z.z2[1]} bpm). Si la FC dépasse ${z.z2[1]}, ralentis ou marche.`,
      "Objectif : dérive cardiaque < 5 % sur la sortie.",
    ],
  };
}

function helgerud(reps: number, ctx: PlanContext): Session {
  const z = zones(ctx.hrMax);
  return {
    kind: "run",
    key: "run-hiit",
    title: `Fractionné ${reps}×4 min`,
    durationMin: 10 + reps * 7 + 5,
    hr: z.helgerud,
    keySession: true,
    lines: [
      `Échauffement 10 min en Z1-Z2, puis 3 accélérations de 15 s.`,
      `${reps} × 4 min à ${z.helgerud[0]}-${z.helgerud[1]} bpm (90-95 % FCmax). La FC met 1-2 min à monter : ne pars pas trop vite.`,
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
      "Sur piste ou terrain : 3 lignes (A, milieu, B) à 40 m d'écart, zones de tolérance de 3 m.",
      "Paliers de 30 s de course + 15 s de récup, en suivant la bande-son. Départ 8 km/h, +0,5 km/h par palier.",
      "Ta VIFT = la vitesse du dernier palier complété. Entre-la dans l'onglet Course.",
      "Échauffement 15 min avant. Pas de séance intense dans les 48 h qui précèdent.",
    ],
  };
}

function intermittent(series: number, minutes: number, ctx: PlanContext): Session {
  return {
    kind: "run",
    key: "run-1515",
    title: `Intermittent 15/15 · ${series}×${minutes} min`,
    keySession: true,
    lines: [
      "Échauffement 12 min + gammes + 3 accélérations.",
      `${series} séries de ${minutes} min en 15 s course / 15 s récup passive : ${dist15(ctx.vift, 0.95)}.`,
      "3 min de récup marchée entre les séries.",
    ],
  };
}

function sprints(rsaSets: number, cod = true): Session {
  const lines = [
    "Échauffement 15 min : footing, gammes, 3 accélérations progressives.",
    "5 × 30 m à vitesse max (> 90 % Vmax), récup complète 2-3 min.",
  ];
  if (cod) lines.push("6 × navette 5-10-5 (changements de direction), récup 90 s.");
  if (rsaSets > 0)
    lines.push(`${rsaSets} série(s) de 6 × 30 m, départ toutes les 25 s (sprints répétés), 4 min entre les séries.`);
  return { kind: "run", key: "run-sprint", title: "Sprint + changements de direction", keySession: true, lines };
}

// ─── Phases ───────────────────────────────────────────────────────

function phaseForce(week: number, day: number, ctx: PlanContext): Session[] {
  const deload = week >= 6; // semaine du 28 déc.
  const compound = deload
    ? "Décharge : charges -10 %, 2 séries par exercice au lieu de 3, RIR 3."
    : "Exercices de base 3×5 à RIR 1-2. Progression si toutes les séries sont réussies avec RIR ≥ 1.";
  const z2min = [40, 40, 45, 45, 50, 50, 35][Math.min(week, 6)];
  switch (day) {
    case 0:
      return [gym("Upper A", [compound, "Rowing 3×5-8. Bras 2×8-12."])];
    case 1:
      return [gym("Lower A", [compound, `Nordic curl ${nordicDose(week)} (excentrique lent, 3-5 s).`])];
    case 2:
      return [z2(z2min, ctx, week >= 2 ? ["Finir par 4 accélérations progressives de 20 s."] : [])];
    case 3:
      return [gym("Upper B", [compound, "Rowing 3×5-8."])];
    case 4:
      return [gym("Lower B", [compound, `Nordic curl ${nordicDose(week)}.`])];
    case 5:
      return [helgerud(deload ? 3 : 4, ctx)];
    default:
      return [REST];
  }
}

function phaseBase(week: number, day: number, ctx: PlanContext, date: string): Session[] {
  const maint = "Entretien : 2 séries par exercice de base, mêmes charges qu'en décembre, RIR 2.";
  const z = zones(ctx.hrMax);
  // Semaine 1 : décalage horaire (13 h) + chaleur. Pas d'intensité.
  if (week === 0) {
    const heat = (min: number): Session => ({
      kind: "run",
      key: "run-z2",
      title: `Footing chaleur · ${min} min`,
      durationMin: min,
      hr: [z.z1[0], z.z2[1] - 5],
      lines: [
        `${min} min sous ${z.z2[1] - 5} bpm, dehors, tôt le matin. Marche si la FC dépasse.`,
        "Acclimatation : l'exposition à la chaleur compte plus que la vitesse.",
      ],
    });
    return [
      [{ kind: "rest", key: "rest", title: "Vol Montréal → Singapour", lines: ["Bois beaucoup, marche dans l'avion toutes les 2 h. Cale-toi sur l'heure de Singapour dès l'embarquement."] } as Session],
      [{ kind: "recovery", key: "recovery", title: "Arrivée · marche 30-45 min dehors", lines: ["Lumière du jour le matin pour recaler l'horloge (13 h de décalage). Pas de sieste > 20 min."] } as Session],
      [heat(30)],
      [gym("Upper A", [maint])],
      [heat(40)],
      [gym("Lower A", [maint, "Nordic curl 2×4."])],
      [heat(45)],
    ][day];
  }
  if (week === 1) {
    return [
      [gym("Upper A", [maint])],
      [z2(50, ctx, ["6 lignes droites de 80 m en fin de séance."])],
      [gym("Lower A", [maint, "Nordic curl 3×4."])],
      [z2(50, ctx)],
      [gym("Upper B", [maint])],
      [helgerud(3, ctx)],
      [z2(55, ctx)],
    ][day];
  }
  const deload = week === 7;
  const longMin = [0, 0, 60, 70, 75, 80, 90, 60][week];
  const isTestDay = date === "2027-01-21" || date === "2027-02-25";
  switch (day) {
    case 0:
      return [gym("Upper A", [maint])];
    case 1:
      return [z2(deload ? 40 : 55, ctx, ["6 lignes droites de 80 m en fin de séance."])];
    case 2:
      return [gym("Lower A", [maint, "Nordic curl 3×5."])];
    case 3:
      return isTestDay ? [test3015()] : [helgerud(deload ? 3 : 4, ctx)];
    case 4:
      return [gym("Upper B", [maint])];
    case 5:
      return [longRun(longMin, ctx)];
    default:
      return [
        {
          kind: "recovery",
          key: "run-z1",
          title: "Footing récup Z1 · 30 min (optionnel)",
          durationMin: 30,
          hr: z.z1,
          lines: [`30 min sous ${z.z1[1]} bpm. Saute-le si tu te sens lourd.`],
        },
      ];
  }
}

function phaseFoot(week: number, day: number, ctx: PlanContext, date: string): Session[] {
  const deload = week === 3 || week === 7;
  const plan1515: [number, number][] = [[2, 8], [2, 8], [3, 7], [2, 6], [3, 8], [3, 8], [3, 8], [2, 6]];
  const [s, m] = plan1515[week];
  const isTestDay = date === "2027-03-25" || date === "2027-04-22";
  switch (day) {
    case 0:
      return [
        gym("Lower A", [
          "Avant le hack squat : 3×5 sauts en contre-mouvement (récup complète, qualité max).",
          deload ? "Hack squat 2×3, hip thrust 2×5 à RIR 3." : "Hack squat 3×3 lourd à RIR 2, hip thrust 2×6.",
          "Nordic curl 3×5. Mollets 3×8.",
        ]),
      ];
    case 1:
      return [intermittent(s, m, ctx)];
    case 2:
      return [z2(deload ? 35 : 45, ctx, ["6 lignes droites de 80 m."])];
    case 3:
      return isTestDay
        ? [test3015()]
        : [gym("Upper A", ["Entretien : 2 séries par exercice de base, RIR 2.", "Finir par 3×6 bonds latéraux par jambe."])];
    case 4:
      return [sprints(deload ? 1 : week >= 2 ? 2 : 0)];
    case 5:
      return [longRun(deload ? 50 : week < 4 ? 60 : 70, ctx)];
    default:
      return [REST];
  }
}

function phaseAffutage(week: number, day: number, ctx: PlanContext): Session[] {
  if (week === 0) {
    return [
      [gym("Lower A", ["Sauts 3×3, hack squat 2×3 à RIR 3, Nordic 2×4."])],
      [intermittent(2, 6, ctx)],
      [z2(35, ctx)],
      [gym("Upper A", ["2 séries par exercice de base, RIR 3."])],
      [sprints(1, false)],
      [z2(45, ctx)],
      [REST],
    ][day];
  }
  return [
    [gym("Lower A", ["Sauts 2×3, hack squat 2×3 léger. Rien jusqu'à l'échec."])],
    [intermittent(1, 6, ctx)],
    [z2(30, ctx, ["4 lignes droites."])],
    [sprints(0, false)],
    [REST],
    [{ kind: "rest", key: "rest", title: "Vol Singapour → Montréal", lines: ["Bois beaucoup, marche dans l'avion toutes les 2 h."] } as Session],
    [{ kind: "recovery", key: "run-z1", title: "Décalage · 20 min Z1 + marche", lines: ["Exposition à la lumière le matin, footing très facile."] } as Session],
  ][day];
}

function phaseSaison(day: number, ctx: PlanContext): Session[] {
  return [
    [gym("Lower A", ["Sauts 3×5, hack squat 3×3 RIR 2, Nordic 2×5. Pas à moins de 48 h d'un match."])],
    [intermittent(2, 8, ctx)],
    [gym("Upper A", ["Entretien : 2-3 séries, RIR 2."])],
    [z2(40, ctx)],
    [sprints(2)],
    [{ ...longRun(60, ctx), title: "Match ou sortie longue 60 min" }],
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
