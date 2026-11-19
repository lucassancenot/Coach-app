// Dates manipulées en chaînes locales "YYYY-MM-DD" pour éviter les pièges de fuseau.

export const DEPARTURE = "2027-01-04"; // départ Singapour
export const RETURN = "2027-05-08"; // retour Montréal

/** Fuseau de l'athlète selon le calendrier (Montréal / Singapour). */
export function athleteTimeZone(isoDate?: string): string {
  const d = isoDate ?? new Date().toISOString().slice(0, 10);
  return d >= DEPARTURE && d < RETURN ? "Asia/Singapore" : "America/Toronto";
}

/** Date du jour dans le fuseau de l'athlète. */
export function today(): string {
  const utc = new Date().toISOString().slice(0, 10);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: athleteTimeZone(utc),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

/** Date locale (fuseau de l'athlète) d'un horodatage ISO. */
export function localDateOf(timestamp: string): string {
  const utcDay = timestamp.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: athleteTimeZone(utcDay),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}

/** 0 = lundi ... 6 = dimanche */
export function weekday(iso: string): number {
  return (toDate(iso).getUTCDay() + 6) % 7;
}

export function mondayOf(iso: string): string {
  return addDays(iso, -weekday(iso));
}

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function shortDay(iso: string): string {
  return JOURS[weekday(iso)];
}

export function prettyDate(iso: string): string {
  const d = toDate(iso);
  return `${JOURS[weekday(iso)]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

export function formatPace(speedMs: number | null | undefined): string {
  if (!speedMs || speedMs <= 0) return "–";
  const secPerKm = 1000 / speedMs;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}
