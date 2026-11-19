import "server-only";
import ical, { type VEvent } from "node-ical";
import { addDays, athleteTimeZone } from "./dates";

export interface CalEvent {
  date: string; // YYYY-MM-DD, jour local de l'athlète
  time: string | null; // "HH:MM" (null = journée entière)
  endTime: string | null;
  title: string;
  calendar: string; // nom de l'agenda (X-WR-CALNAME)
}

/** Les adresses sont stockées une par ligne. */
export function calendarUrls(stored: string | null | undefined): string[] {
  return (stored ?? "").split(/\r?\n/).map((u) => u.trim()).filter(Boolean);
}

function localParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/**
 * Lit un ou plusieurs agendas au format iCal (adresse secrète Google, lien Outlook, etc.), en lecture seule.
 * Réponses mises en cache 15 min. Un agenda en erreur n'empêche pas d'afficher les autres.
 */
export async function getCalendarEvents(stored: string | null | undefined, from: string, to: string): Promise<{ events: CalEvent[]; error?: string }> {
  const urls = calendarUrls(stored);
  const results = await Promise.all(urls.map((u, i) => readOne(u, i + 1, from, to)));
  const events = results.flatMap((r) => r.events);
  events.sort((a, b) => (a.date + (a.time ?? "00:00")).localeCompare(b.date + (b.time ?? "00:00")));
  const errors = results.map((r) => r.error).filter(Boolean);
  return { events, error: errors.length ? errors.join(" ") : undefined };
}

async function readOne(icsUrl: string, n: number, from: string, to: string): Promise<{ events: CalEvent[]; error?: string }> {
  let text: string;
  try {
    const res = await fetch(icsUrl, { next: { revalidate: 900 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { events: [], error: `Agenda ${n} inaccessible (${res.status}) : vérifie son adresse dans Réglages.` };
    text = await res.text();
  } catch {
    return { events: [], error: `Agenda ${n} inaccessible pour le moment.` };
  }
  const calendar = /^X-WR-CALNAME:(.+)$/m.exec(text)?.[1]?.trim() || `Agenda ${n}`;

  const data = ical.sync.parseICS(text);
  const fromD = new Date(`${addDays(from, -1)}T00:00:00Z`);
  const toD = new Date(`${addDays(to, 2)}T00:00:00Z`);
  const out: CalEvent[] = [];

  for (const item of Object.values(data)) {
    if (!item || item.type !== "VEVENT") continue;
    const ev = item as VEvent;
    let instances;
    try {
      instances = ical.expandRecurringEvent(ev, { from: fromD, to: toD, expandOngoing: true });
    } catch {
      continue;
    }
    for (const inst of instances) {
      const title = String(inst.summary ?? "(sans titre)");
      if (inst.isFullDay) {
        // Journée entière : un événement par jour couvert (DTEND exclusif).
        const tz = (inst.start as Date & { tz?: string }).tz ?? "UTC";
        const startDay = localParts(inst.start, tz).day;
        const endDay = inst.end ? localParts(inst.end, tz).day : addDays(startDay, 1);
        for (let d = startDay; d < endDay && d <= to; d = addDays(d, 1)) {
          if (d >= from) out.push({ date: d, time: null, endTime: null, title, calendar });
        }
      } else {
        const tz = athleteTimeZone(inst.start.toISOString().slice(0, 10));
        const s = localParts(inst.start, tz);
        const e = inst.end ? localParts(inst.end, tz) : null;
        if (s.day >= from && s.day <= to) out.push({ date: s.day, time: s.time, endTime: e?.time ?? null, title, calendar });
      }
    }
  }
  return { events: out };
}
