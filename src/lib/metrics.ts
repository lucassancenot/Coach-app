/**
 * Indicateurs calculés. Les sources et leurs limites sont précisées pour chacun.
 */
import { zones } from "./plan";

/** Secondes passées dans chaque zone (Z1..Z5) à partir d'un flux FC. */
export function zoneSeconds(time: number[], hr: number[], hrMax: number): number[] {
  const z = zones(hrMax);
  const bounds = [z.z2[0], z.z3[0], z.z4[0], z.z5[0]];
  const out = [0, 0, 0, 0, 0];
  for (let i = 1; i < time.length; i++) {
    const dt = Math.min(time[i] - time[i - 1], 10); // ignore les pauses
    const h = hr[i];
    if (!h) continue;
    let zi = 0;
    while (zi < 4 && h >= bounds[zi]) zi++;
    out[zi] += dt;
  }
  return out;
}

/** TRIMP d'Edwards (1993) : minutes en zone × coefficient 1 à 5. */
export function edwardsTrimp(zoneSec: number[]): number {
  return zoneSec.reduce((acc, s, i) => acc + (s / 60) * (i + 1), 0);
}

/** Estimation de secours quand il n'y a pas de flux : FC moyenne × durée. */
export function trimpFromAverage(avgHr: number | null, movingTime: number, hrMax: number): number {
  if (!avgHr) return movingTime / 60; // à défaut, 1 point par minute
  const pct = avgHr / hrMax;
  const coef = pct < 0.7 ? 1 : pct < 0.8 ? 2 : pct < 0.87 ? 3 : pct < 0.93 ? 4 : 5;
  return (movingTime / 60) * coef;
}

/**
 * Dérive cardiaque (découplage Pa:HR) : on compare l'efficacité (vitesse/FC) de la 1re et
 * de la 2e moitié de la sortie. > 5 % : signe de fatigue, de chaleur ou de base aérobie
 * insuffisante. Ce seuil de 5 % est un repère de terrain (Friel), pas un seuil validé en
 * laboratoire : on le traite comme un indicateur.
 * Valable uniquement pour les sorties régulières de 30 min et plus.
 */
export function decoupling(time: number[], hr: number[], speed: number[]): number | null {
  const n = time.length;
  if (n < 20 || time[n - 1] - time[0] < 1800) return null;
  const mid = time[0] + (time[n - 1] - time[0]) / 2;
  let s1 = 0, h1 = 0, c1 = 0, s2 = 0, h2 = 0, c2 = 0;
  for (let i = 0; i < n; i++) {
    if (!hr[i] || speed[i] == null) continue;
    if (time[i] < mid) { s1 += speed[i]; h1 += hr[i]; c1++; }
    else { s2 += speed[i]; h2 += hr[i]; c2++; }
  }
  if (!c1 || !c2) return null;
  const ef1 = s1 / c1 / (h1 / c1);
  const ef2 = s2 / c2 / (h2 / c2);
  return Math.round(((ef1 - ef2) / ef1) * 1000) / 10;
}

/**
 * Ratio charge aiguë / chronique (7 j / moyenne hebdo des 28 j).
 * Gabbett 2016 : risque accru au-dessus de ~1,5. Fortement critiqué depuis (Impellizzeri 2020) :
 * on s'en sert comme signal d'alerte sur les hausses brutales, pas comme prédicteur de blessure.
 */
export function acwr(loads: { date: string; load: number }[], today: string): { acute: number; chronic: number; ratio: number | null } {
  const dayMs = 86400000;
  const t = Date.parse(today + "T00:00:00Z");
  let acute = 0, chronic = 0;
  for (const { date, load } of loads) {
    const age = (t - Date.parse(date.slice(0, 10) + "T00:00:00Z")) / dayMs;
    if (age < 0) continue;
    if (age < 7) acute += load;
    if (age < 28) chronic += load;
  }
  const chronicWeekly = chronic / 4;
  return { acute, chronic: chronicWeekly, ratio: chronicWeekly > 0 ? Math.round((acute / chronicWeekly) * 100) / 100 : null };
}

/**
 * 1RM estimé : Epley avec les répétitions en réserve (approche RIR, Helms et al. 2016).
 * Fiable jusqu'à ~10 répétitions effectives.
 */
export function e1rm(weight: number, reps: number, rir: number | null | undefined): number {
  const effective = reps + (rir ?? 0);
  if (effective <= 1) return weight;
  return Math.round(weight * (1 + effective / 30) * 10) / 10;
}

/** Répartition de l'intensité : part du temps en Z1-2, Z3, Z4-5. */
export function intensityDistribution(zoneSecList: number[][]): { low: number; mid: number; high: number; totalMin: number } {
  const sum = [0, 0, 0, 0, 0];
  for (const zs of zoneSecList) zs.forEach((s, i) => (sum[i] += s));
  const total = sum.reduce((a, b) => a + b, 0);
  if (!total) return { low: 0, mid: 0, high: 0, totalMin: 0 };
  return {
    low: Math.round(((sum[0] + sum[1]) / total) * 100),
    mid: Math.round((sum[2] / total) * 100),
    high: Math.round(((sum[3] + sum[4]) / total) * 100),
    totalMin: Math.round(total / 60),
  };
}
