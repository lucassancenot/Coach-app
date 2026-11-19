// Les charges sont stockées en kg en base ; l'affichage et la saisie suivent le réglage de l'athlète.
export type Unit = "kg" | "lb";

export const LB_IN_KG = 0.45359237;

export function asUnit(u: string | null | undefined): Unit {
  return u === "lb" ? "lb" : "kg";
}

/** kg (base) → unité d'affichage, arrondi au 0,5. */
export function fromKg(kg: number, unit: Unit): number {
  const v = unit === "lb" ? kg / LB_IN_KG : kg;
  return Math.round(v * 2) / 2;
}

/** Valeur saisie dans l'unité d'affichage → kg (base), sans arrondi pour ne rien perdre. */
export function toKg(value: number, unit: Unit): number {
  return unit === "lb" ? value * LB_IN_KG : value;
}

/** Sauts de progression usuels selon l'unité. */
export function increment(unit: Unit, lowerHeavy: boolean): number {
  if (unit === "lb") return lowerHeavy ? 10 : 5;
  return lowerHeavy ? 5 : 2.5;
}

export function fmt(kg: number, unit: Unit): string {
  return `${String(fromKg(kg, unit)).replace(".", ",")} ${unit}`;
}
