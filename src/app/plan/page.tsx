import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActivities, getAthlete, getWorkouts } from "@/lib/data";
import { addDays, daysBetween, mondayOf, prettyDate, today } from "@/lib/dates";
import { getCalendarEvents } from "@/lib/gcal";
import { PHASES, phaseFor, sessionsFor, shortLabel, type Session } from "@/lib/plan";
import { isDone } from "@/lib/progress";
import { PageTitle, SessionCard } from "@/components/ui";

export const dynamic = "force-dynamic";

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const PHASE_COLOR: Record<string, string> = {
  force: "var(--gym)",
  base: "var(--z2)",
  foot: "var(--run)",
  affutage: "var(--warn)",
  saison: "var(--good)",
};
const KIND_COLOR: Record<string, string> = { run: "var(--run)", test: "var(--run)", gym: "var(--gym)" };

function monthStart(m: string) {
  return `${m}-01`;
}
function shiftMonth(m: string, n: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  await requireAuth();
  const now = today();
  const sp = await searchParams;
  const month = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : now.slice(0, 7);
  const selected = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : now.slice(0, 7) === month ? now : monthStart(month);

  const first = monthStart(month);
  const gridStart = mondayOf(first);
  const nextMonth = monthStart(shiftMonth(month, 1));
  const gridEnd = addDays(mondayOf(addDays(nextMonth, -1)), 6);
  const days = Array.from({ length: daysBetween(gridStart, gridEnd) + 1 }, (_, i) => addDays(gridStart, i));

  const [athlete, acts, workouts] = await Promise.all([getAthlete(), getActivities(400), getWorkouts(400)]);
  const ctx = { hrMax: athlete.hrMax, vift: athlete.vift };
  const { events, error } = await getCalendarEvents(athlete.calendarUrl, gridStart, gridEnd);

  // Frise des phases : du début du bloc de force à 1 semaine après le retour
  const tlStart = PHASES[0].start;
  const tlEnd = "2027-05-16";
  const tlDays = daysBetween(tlStart, tlEnd);
  const pct = (d: string) => Math.min(100, Math.max(0, (daysBetween(tlStart, d) / tlDays) * 100));

  const selSessions = sessionsFor(selected, ctx);
  const selEvents = events.filter((e) => e.date === selected);
  const status = (s: Session, d: string) =>
    s.kind === "rest" || s.kind === "recovery" ? "neutral" : isDone(s, d, acts, workouts) ? "done" : d < now ? "missed" : "todo";

  return (
    <>
      <PageTitle subtitle="Organisation" title="Plan" />

      {/* Frise des phases */}
      <section className="card mb-4">
        <p className="label mb-3">Phases jusqu&apos;au retour</p>
        <div className="relative">
          <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
            {PHASES.filter((p) => p.start < tlEnd).map((p) => {
              const end = p.end < tlEnd ? p.end : tlEnd;
              return <span key={p.id} title={p.name} style={{ width: `${pct(end) - pct(p.start)}%`, background: PHASE_COLOR[p.id] }} />;
            })}
          </div>
          {now >= tlStart && now <= tlEnd && (
            <span className="absolute -top-1 h-5 w-[3px] rounded bg-text" style={{ left: `calc(${pct(now)}% - 1px)` }} aria-label="Aujourd'hui" />
          )}
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {PHASES.filter((p) => p.start < tlEnd).map((p) => {
            const current = phaseFor(now).id === p.id;
            return (
              <li key={p.id} className="flex items-baseline gap-2">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PHASE_COLOR[p.id] }} />
                <span className={current ? "font-semibold" : "text-text-2"}>
                  {p.name}
                  {current && " · en cours"}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">
                  {prettyDate(p.start).slice(4)}
                  {p.id !== "saison" && ` → ${prettyDate(p.end).slice(4)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Vue mois */}
      <section className="card mb-4 !p-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <Link href={`/plan?m=${shiftMonth(month, -1)}`} className="btn !px-3 !py-1.5" aria-label="Mois précédent">
            ‹
          </Link>
          <p className="font-semibold">
            {MOIS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
          </p>
          <Link href={`/plan?m=${shiftMonth(month, 1)}`} className="btn !px-3 !py-1.5" aria-label="Mois suivant">
            ›
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-[3px] text-center text-[10px] uppercase text-muted">
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
            <span key={i} className="pb-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-[3px]">
          {days.map((d) => {
            const inMonth = d.startsWith(month);
            const ss = sessionsFor(d, ctx).filter((s) => s.kind !== "rest");
            const ev = events.filter((e) => e.date === d);
            const isSel = d === selected;
            return (
              <Link
                key={d}
                href={`/plan?m=${month}&d=${d}`}
                scroll={false}
                className={`flex min-h-[74px] flex-col rounded-lg border p-1 text-left ${isSel ? "border-text" : "border-border"} ${inMonth ? "bg-surface-2" : "opacity-40"}`}
                style={{ borderTopWidth: 3, borderTopColor: PHASE_COLOR[phaseFor(d).id] }}
              >
                <span className={`text-[11px] tabular-nums ${d === now ? "font-bold text-text" : "text-muted"}`}>{Number(d.slice(8, 10))}</span>
                {ss.map((s, i) => {
                  const st = status(s, d);
                  return (
                    <span
                      key={i}
                      className={`mt-0.5 truncate text-[9.5px] font-semibold leading-tight ${st === "missed" ? "line-through opacity-50" : ""}`}
                      style={{ color: KIND_COLOR[s.kind] ?? "var(--muted)" }}
                    >
                      {st === "done" ? "✓ " : ""}
                      {shortLabel(s)}
                    </span>
                  );
                })}
                {ev.length > 0 && (
                  <span className="mt-auto truncate text-[9px] leading-tight text-text-2">
                    ● {ev.length > 1 ? `${ev.length} évts` : ev[0].title}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-muted">
          <span>
            <b style={{ color: "var(--run)" }}>■</b> Course
          </span>
          <span>
            <b style={{ color: "var(--gym)" }}>■</b> Salle
          </span>
          <span>✓ fait · <s>barré</s> manqué</span>
          <span>● Google Agenda</span>
        </div>
      </section>

      {/* Détail du jour sélectionné */}
      <section className="space-y-3">
        <p className="label">
          {prettyDate(selected)} · {phaseFor(selected).name}
        </p>
        {selEvents.length > 0 && (
          <div className="card">
            <p className="label mb-2 !text-[10px]">Google Agenda</p>
            <ul className="space-y-1 text-sm">
              {selEvents.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-24 shrink-0 text-muted tabular-nums">{e.time ? `${e.time}${e.endTime ? `–${e.endTime}` : ""}` : "Journée"}</span>
                  <span>{e.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {selSessions.map((s, i) => (
          <SessionCard key={i} s={s} done={isDone(s, selected, acts, workouts)} />
        ))}
        {error && <p className="text-xs text-warn">▲ {error}</p>}
        {!athlete.calendarUrl && (
          <p className="text-xs text-muted">
            Ajoute ton Google Agenda dans{" "}
            <Link href="/reglages" className="underline">
              Réglages
            </Link>{" "}
            pour voir tes cours, examens et matchs ici.
          </p>
        )}
      </section>
    </>
  );
}
