import type { TemplateItem, Workout } from "./data";
import { phaseFor } from "./plan";

const LOWER_HEAVY = ["Hack squat", "Hip thrust", "Presse à cuisses"];

export interface Target {
  weight: number | null;
  reason: string;
  last: string | null; // résumé de la dernière fois
}

/**
 * Double progression : quand toutes les séries atteignent le haut de la fourchette avec RIR ≥ 1,
 * on monte la charge. En phase d'entretien, on garde la charge.
 */
export function targetFor(item: TemplateItem, workouts: Workout[], date: string): Target {
  const lastW = workouts.find((w) => w.sets.some((s) => s.exercise === item.exercise));
  if (!lastW) return { weight: null, reason: "Première fois : trouve une charge à RIR 2.", last: null };
  const sets = lastW.sets.filter((s) => s.exercise === item.exercise);
  const top = Math.max(...sets.map((s) => s.weight));
  const topSets = sets.filter((s) => s.weight === top);
  const last = sets.map((s) => `${s.weight}×${s.reps}${s.rir != null ? ` @${s.rir}` : ""}`).join(", ");
  const phase = phaseFor(date).id;
  if (phase !== "force" && phase !== "saison") {
    return { weight: top, reason: "Entretien : même charge, RIR 2.", last };
  }
  const allTop = topSets.length >= item.sets && topSets.every((s) => s.reps >= item.repsMax);
  const rirOk = topSets.every((s) => s.rir == null || s.rir >= 1);
  if (item.exercise === "Nordic curl") return { weight: 0, reason: "Ajoute 1 répétition par série si tu contrôles toute la descente.", last };
  if (allTop && rirOk) {
    const inc = LOWER_HEAVY.includes(item.exercise) ? 5 : 2.5;
    return { weight: top + inc, reason: `Toutes les séries réussies : +${inc} kg.`, last };
  }
  if (allTop && !rirOk) return { weight: top, reason: "Réussi mais à l'échec : même charge, vise RIR 1.", last };
  return { weight: top, reason: `Même charge, vise ${item.repsMax} répétitions sur chaque série.`, last };
}
