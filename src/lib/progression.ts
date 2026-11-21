import type { TemplateItem, Workout } from "./data";
import { addDays } from "./dates";
import { e1rm } from "./metrics";
import { phaseFor } from "./plan";
import type { Rx } from "./programs";
import { fromKg, increment, LB_IN_KG, type Unit } from "./units";

/**
 * Charge prescrite pour un exercice du programme du coach.
 * 1RM estimé = meilleur Epley+RIR des 8 dernières semaines (sinon tout l'historique).
 * Charge = 1RM / (1 + (reps + RIR)/30), arrondie à 5 lb ou 2,5 kg.
 * Pour les exercices au poids du corps lestés, le calcul se fait sur (poids du corps + lest).
 */
export function prescribe(rx: Rx, workouts: Workout[], unit: Unit, bodyWeightKg: number, today: string): Target {
  const all = workouts.flatMap((w) => w.sets.filter((s) => s.exercise === rx.exercise).map((s) => ({ ...s, date: w.date })));
  const lastW = workouts.find((w) => w.sets.some((s) => s.exercise === rx.exercise));
  const last = lastW
    ? lastW.sets
        .filter((s) => s.exercise === rx.exercise)
        .map((s) => `${fromKg(s.weight, unit)}×${s.reps}${s.rir != null ? ` @${s.rir}` : ""}`)
        .join(", ")
    : null;
  const scheme = `${rx.sets}×${rx.reps}${rx.type === "plyo" ? "" : ` @RIR${rx.rir}`}`;
  if (rx.type === "plyo") return { weight: null, reason: "", last };
  if (rx.type === "reps") return { weight: 0, reason: `${scheme} · au poids du corps`, last };

  const bw = rx.type === "bodyweight" ? bodyWeightKg : 0;
  const recent = all.filter((s) => s.date >= addDays(today, -56) && s.reps <= 12);
  const pool = recent.length ? recent : all.filter((s) => s.reps <= 15);
  if (!pool.length) {
    return { weight: rx.type === "bodyweight" ? 0 : null, reason: `${scheme} · première fois : choisis une charge qui laisse ${rx.rir} reps en réserve.`, last };
  }
  const best = Math.max(...pool.map((s) => e1rm(s.weight + bw, s.reps, s.rir)));
  const totalKg = best / (1 + (rx.reps + rx.rir) / 30);
  const loadKg = Math.max(0, totalKg - bw);
  const step = unit === "lb" ? 5 : 2.5;
  const display = unit === "lb" ? loadKg / LB_IN_KG : loadKg;
  const weight = Math.round(display / step) * step;
  const pct = Math.round((totalKg / best) * 100);
  return { weight, reason: `${scheme} · ≈${pct} % de ton 1RM estimé`, last };
}

const LOWER_HEAVY = ["Hack squat", "Hip thrust", "Presse à cuisses"];

export interface Target {
  weight: number | null; // dans l'unité d'affichage
  reason: string;
  last: string | null; // résumé de la dernière fois (unité d'affichage)
}

/**
 * Double progression : quand toutes les séries atteignent le haut de la fourchette avec RIR ≥ 1,
 * on monte la charge. En phase d'entretien, on garde la charge.
 */
export function targetFor(item: TemplateItem, workouts: Workout[], date: string, unit: Unit): Target {
  const lastW = workouts.find((w) => w.sets.some((s) => s.exercise === item.exercise));
  if (!lastW) return { weight: null, reason: "Première fois : trouve une charge à RIR 2.", last: null };
  const sets = lastW.sets.filter((s) => s.exercise === item.exercise);
  const topKg = Math.max(...sets.map((s) => s.weight));
  const top = fromKg(topKg, unit);
  const topSets = sets.filter((s) => s.weight === topKg);
  const last = sets.map((s) => `${fromKg(s.weight, unit)}×${s.reps}${s.rir != null ? ` @${s.rir}` : ""}`).join(", ");
  const phase = phaseFor(date).id;
  if (phase !== "force" && phase !== "saison") {
    return { weight: top, reason: "Entretien : même charge, RIR 2.", last };
  }
  const allTop = topSets.length >= item.sets && topSets.every((s) => s.reps >= item.repsMax);
  const rirOk = topSets.every((s) => s.rir == null || s.rir >= 1);
  if (item.exercise === "Nordic curl") return { weight: 0, reason: "Ajoute 1 répétition par série si tu contrôles toute la descente.", last };
  if (allTop && rirOk) {
    const inc = increment(unit, LOWER_HEAVY.includes(item.exercise));
    return { weight: top + inc, reason: `Toutes les séries réussies : +${inc} ${unit}.`, last };
  }
  if (allTop && !rirOk) return { weight: top, reason: "Réussi mais à l'échec : même charge, vise RIR 1.", last };
  return { weight: top, reason: `Même charge, vise ${item.repsMax} répétitions sur chaque série.`, last };
}
