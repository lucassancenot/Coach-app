import type { TemplateItem, Workout } from "./data";
import { phaseFor } from "./plan";
import { fromKg, increment, type Unit } from "./units";

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
