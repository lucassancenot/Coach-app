import type { Activity, Workout } from "./data";
import { addDays } from "./dates";
import type { Session } from "./plan";

const CONDITIONING = new Set(["run-z2", "run-long", "run-1515", "run-hiit", "run-rsa"]);

export function isFootball(type: string): boolean {
  return type === "Soccer" || type === "Football" || type === "Futsal";
}

/** Une séance prévue est-elle faite ? (tolérance ±1 jour, même type d'activité) */
export function isDone(s: Session, date: string, acts: Activity[], workouts: Workout[]): boolean {
  const lo = addDays(date, -1);
  const hi = addDays(date, 1);
  if (s.kind === "gym") return workouts.some((w) => w.date >= lo && w.date <= hi && w.templateName === s.template);
  const sameDay = acts.filter((a) => a.startDate.slice(0, 10) === date);
  // Le ballon (match, jeu réduit) remplace les séances de conditionnement du jour.
  const football = sameDay.some((a) => isFootball(a.type) && a.movingTime >= 40 * 60);
  if (football && CONDITIONING.has(s.key)) return true;
  if (s.kind === "run" || s.kind === "test" || s.key === "run-z1") return sameDay.some((a) => a.type.includes("Run"));
  return false;
}
