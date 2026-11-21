/**
 * Programme de salle écrit par le coach, phase par phase.
 *
 * Logique :
 * - Exercices de base en vagues (volume puis intensité), charges calculées depuis le 1RM estimé
 *   et le RIR visé (Helms et al. 2016 : prescription par RIR).
 * - Force développée en préparation (2 séances jambes/sem), maintenue ensuite : 1 séance lourde
 *   par semaine suffit à conserver force et sprint pendant 12 semaines (Rønnestad et al. 2011).
 * - Pliométrie 2×/sem : améliore saut, sprint et changements de direction (Ramirez-Campillo 2020,
 *   Oliver 2024, méta-analyses).
 * - Prévention : Nordic (van der Horst 2015) et Copenhagen (Harøy 2019 : -41 % de problèmes à l'aine).
 * - Toujours ≥ 6 h entre une séance de jambes lourde et un travail d'endurance intense (Robineau 2016).
 */
import type { Phase } from "./plan";

export type RxType = "load" | "bodyweight" | "reps" | "plyo"; // reps = au poids du corps, sans charge à calculer

export interface Rx {
  exercise: string;
  sets: number;
  reps: number; // répétitions visées (par jambe/côté si précisé)
  rir: number; // répétitions en réserve visées
  type: RxType;
  note?: string;
  main?: boolean; // exercice de base (vagues)
}

export interface GymSession {
  title: string;
  focus: string;
  items: Rx[];
}

type PhaseId = Phase["id"];

// Vague des exercices de base : [séries, reps, RIR] selon la semaine de la phase.
const FORCE_WAVE: [number, number, number][] = [
  [4, 6, 3], // sem. du 16 nov.
  [4, 6, 3], // 23 nov. : prise en main du nouveau programme
  [4, 5, 2], // 30 nov.
  [5, 4, 2], // 7 déc.
  [5, 3, 1], // 14 déc.
  [3, 3, 1], // 21 déc. : pic d'intensité
  [2, 5, 4], // 28 déc. : décharge + départ
];

function mainWave(phase: PhaseId, week: number, deload: boolean): [number, number, number] {
  if (deload) return [2, 4, 4];
  switch (phase) {
    case "force":
      return FORCE_WAVE[Math.max(0, Math.min(week, FORCE_WAVE.length - 1))];
    case "base":
      return week <= 1 ? [2, 5, 3] : [3, 4, 2];
    case "foot":
      return [3, 3, 2];
    case "affutage":
      return [2, 3, 3];
    default:
      return [2, 3, 2];
  }
}

function main(exercise: string, wave: [number, number, number], type: RxType = "load", note?: string): Rx {
  return { exercise, sets: wave[0], reps: wave[1], rir: wave[2], type, main: true, note };
}

function acc(exercise: string, sets: number, reps: number, rir = 2, note?: string, type: RxType = "load"): Rx {
  return { exercise, sets, reps, rir, type, note };
}

function plyo(exercise: string, sets: number, reps: number, note: string): Rx {
  return { exercise, sets, reps, rir: 0, type: "plyo", note };
}

function nordic(phase: PhaseId, week: number, deload: boolean): Rx {
  let d: [number, number] = [2, 4];
  if (phase === "force") d = week <= 1 ? [2, 4] : week <= 3 ? [3, 4] : [3, 5];
  else if (phase === "base") d = [2, 5];
  else d = [2, 3];
  if (deload) d = [1, 4];
  return { exercise: "Nordic curl", sets: d[0], reps: d[1], rir: 1, type: "reps", note: "Descente la plus lente possible (3-5 s), remontée aidée par les mains." };
}

function copenhague(phase: PhaseId, week: number, deload: boolean): Rx {
  let d: [number, number, string] = [2, 8, "levier long (pied sur le banc)"];
  if (phase === "force") {
    if (week <= 1) d = [2, 5, "levier court (genou sur le banc)"];
    else if (week <= 3) d = [2, 8, "levier court (genou sur le banc)"];
    else d = [3, 6, "levier long (pied sur le banc)"];
  } else if (phase !== "base") d = [2, 6, "levier long (pied sur le banc)"];
  if (deload) d = [1, 6, d[2]];
  return { exercise: "Copenhague", sets: d[0], reps: d[1], rir: 2, type: "reps", note: `Par côté, ${d[2]}. 2 s en haut.` };
}

function plyoContacts(phase: PhaseId, week: number, deload: boolean): number {
  let c = 60;
  if (phase === "force") c = week <= 2 ? 40 : 60;
  else if (phase === "base") c = 70;
  else if (phase === "foot") c = 90;
  else c = 40;
  return deload ? Math.round(c / 2) : c;
}

export type GymId = "basA" | "hautA" | "basB" | "hautB";

/** Séance de salle du programme pour une phase et une semaine données. */
export function gymSession(id: GymId, phase: PhaseId, week: number, deload: boolean): GymSession {
  const w = mainWave(phase, week, deload);
  const contacts = plyoContacts(phase, week, deload);
  const half = Math.round(contacts / 2);

  if (phase === "force") {
    switch (id) {
      case "basA":
        return {
          title: "Bas A · Force",
          focus: "Force maximale des jambes, chaîne postérieure, prévention ischios.",
          items: [
            plyo("Box jump", 3, 3, "Potentialisation : saut max, réception douce, 60 s de récup. Qualité avant tout."),
            main("Hack squat", w),
            acc("RDL", 3, 6, 2, "Dos neutre, descente jusqu'à mi-tibia, hanches vers l'arrière."),
            acc("Fentes bulgares", 3, 6, 2, "Par jambe. Charge = haltères (total ou par main, reste constant)."),
            nordic(phase, week, deload),
            acc("Mollets", 3, 10, 2, "Pause 1 s en bas, montée explosive."),
          ],
        };
      case "hautA":
        return {
          title: "Haut A · Force",
          focus: "Force du haut du corps, équilibre poussée/tirage, gainage.",
          items: [
            main("Développé couché", w),
            main("Tractions lestées", w, "bodyweight", "Charge = lest ajouté. Amplitude complète."),
            acc("Développé militaire", 3, 6, 2),
            acc("Rowing", 3, 6, 2, "Rowing T-bar, pause 1 s contre la poitrine."),
            acc("Face pull", 3, 12, 2),
            acc("Pallof press", 3, 10, 2, "Par côté. Anti-rotation : le bassin ne bouge pas."),
          ],
        };
      case "basB":
        return {
          title: "Bas B · Puissance",
          focus: "Puissance, élasticité, unilatéral, adducteurs.",
          items: [
            plyo("Bonds horizontaux", 3, Math.max(3, Math.round(half / 3)), `~${contacts} contacts au total avec les hops. Enchaîne 3 bonds, stabilise la réception.`),
            plyo("Hops latéraux", 3, Math.max(4, Math.round(half / 3)), "Par jambe, contacts courts et réactifs."),
            main("Hip thrust", w, "load", "Pause 1 s en haut, bassin en rétroversion."),
            acc("Presse à cuisses", 3, 8, 2),
            acc("Curl ischio iso 4 s", 3, 6, 2, "Tenir 4 s en position raccourcie à chaque répétition."),
            copenhague(phase, week, deload),
            acc("Mollets assis", 3, 12, 2),
          ],
        };
      default:
        return {
          title: "Haut B · Hypertrophie",
          focus: "Volume pour la masse musculaire du haut du corps.",
          items: [
            acc("Développé incliné", deload ? 2 : 3, 8, deload ? 4 : 2),
            acc("Rowing haltère unilatéral", deload ? 2 : 3, 8, deload ? 4 : 2, "Par bras."),
            acc("Chest press", deload ? 2 : 3, 10, deload ? 4 : 2),
            acc("Dips", deload ? 2 : 3, 8, deload ? 4 : 2, "Charge = lest ajouté (0 au poids du corps).", "bodyweight"),
            acc("Curl biceps", 2, 10, 2),
            acc("Extension triceps", 2, 10, 2),
            acc("Arrière d'épaule", 3, 12, 2),
          ],
        };
    }
  }

  // Phases suivantes : 3 séances (base), puis 2 (foot, affûtage, saison).
  if (id === "basA" || id === "basB") {
    if (phase === "base" && id === "basB") {
      return {
        title: "Bas B · Puissance",
        focus: "Puissance et élasticité, entretien de la force unilatérale.",
        items: [
          plyo("Bonds horizontaux", 3, Math.max(3, Math.round(half / 3)), `~${contacts} contacts au total avec les hops.`),
          plyo("Hops latéraux", 3, Math.max(4, Math.round(half / 3)), "Par jambe, contacts courts."),
          main("Hip thrust", w),
          acc("Fentes bulgares", deload ? 2 : 3, 6, 2, "Par jambe."),
          acc("Curl ischio iso 4 s", 2, 6, 2),
          copenhague(phase, week, deload),
          acc("Mollets assis", 2, 12, 2),
        ],
      };
    }
    return {
      title: phase === "base" ? "Bas A · Force" : "Bas · Force-puissance",
      focus:
        phase === "base"
          ? "Maintenir la force lourde avec un volume réduit (Rønnestad 2011)."
          : "Contraste : charge lourde puis saut, pour transférer la force en vitesse.",
      items: [
        plyo("Box jump", 3, 3, phase === "base" ? "Potentialisation, 60 s de récup." : "En contraste : 1 série de box jump juste après chaque série de hack squat."),
        main("Hack squat", w),
        phase === "base" ? acc("RDL", deload ? 2 : 3, 5, 2) : main("Hip thrust", w),
        ...(phase === "base" ? [] : [acc("Fentes bulgares", 2, 6, 2, "Par jambe.")]),
        nordic(phase, week, deload),
        copenhague(phase, week, deload),
        acc("Mollets", 2, 10, 2),
      ],
    };
  }
  return {
    title: phase === "base" ? "Haut · Complet" : "Haut · Maintien",
    focus: "Maintenir la force du haut du corps avec un minimum de fatigue.",
    items: [
      main("Développé couché", w),
      main("Tractions lestées", w, "bodyweight", "Charge = lest ajouté."),
      acc("Développé militaire", 2, 6, 2),
      acc("Rowing haltère unilatéral", phase === "base" ? 3 : 2, 8, 2, "Par bras."),
      acc("Face pull", 2, 12, 2),
      ...(phase === "base" ? [acc("Pallof press", 2, 10, 2, "Par côté.")] : []),
    ],
  };
}

/** Groupe musculaire principal de chaque exercice (pour le volume hebdomadaire). */
export const MUSCLE: Record<string, string> = {
  "Hack squat": "Quadriceps",
  "Presse à cuisses": "Quadriceps",
  "Fentes bulgares": "Quadriceps",
  RDL: "Ischios-fessiers",
  "Hip thrust": "Ischios-fessiers",
  "Curl ischio": "Ischios-fessiers",
  "Curl ischio iso 4 s": "Ischios-fessiers",
  "Nordic curl": "Ischios-fessiers",
  Copenhague: "Tronc-adducteurs",
  "Pallof press": "Tronc-adducteurs",
  Mollets: "Mollets",
  "Mollets assis": "Mollets",
  "Développé couché": "Pectoraux",
  "Développé incliné": "Pectoraux",
  "Chest press": "Pectoraux",
  "Chest press unilatéral": "Pectoraux",
  "Développé décliné": "Pectoraux",
  Dips: "Pectoraux",
  "Tractions lestées": "Dos",
  Rowing: "Dos",
  "Rowing haltère unilatéral": "Dos",
  "Développé militaire": "Épaules",
  "Face pull": "Épaules",
  "Arrière d'épaule": "Épaules",
  "Curl biceps": "Bras",
  "Extension triceps": "Bras",
};

export const MUSCLE_GROUPS = ["Quadriceps", "Ischios-fessiers", "Mollets", "Tronc-adducteurs", "Pectoraux", "Dos", "Épaules", "Bras"];
