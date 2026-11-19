import type { Activity, Workout } from "./data";
import { addDays } from "./dates";
import type { Session } from "./plan";

/** Une séance prévue est-elle faite ? (tolérance ±1 jour, même type d'activité) */
export function isDone(s: Session, date: string, acts: Activity[], workouts: Workout[]): boolean {
  const lo = addDays(date, -1);
  const hi = addDays(date, 1);
  if (s.kind === "gym") return workouts.some((w) => w.date >= lo && w.date <= hi && w.templateName === s.template);
  if (s.kind === "run" || s.kind === "test" || s.key === "run-z1")
    return acts.some((a) => a.type.includes("Run") && a.startDate.slice(0, 10) === date);
  return false;
}
