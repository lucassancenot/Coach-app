import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { evaluateAlerts } from "@/lib/alerts";
import { getActiveAlerts, getActivities, getAthlete, getWorkouts } from "@/lib/data";
import { RETURN, daysBetween, mondayOf, prettyDate, shortDay, today } from "@/lib/dates";
import { acwr, trimpFromAverage } from "@/lib/metrics";
import { phaseWeek, sessionsFor, weekPlan } from "@/lib/plan";
import { isDone } from "@/lib/progress";
import { AlertCard, PageTitle, SessionCard, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  await requireAuth();
  await evaluateAlerts();
  const [athlete, acts, workouts, alerts] = await Promise.all([getAthlete(), getActivities(60), getWorkouts(60), getActiveAlerts()]);
  const now = today();
  const ctx = { hrMax: athlete.hrMax, vift: athlete.vift };
  const { phase, week, totalWeeks } = phaseWeek(now);
  const todaySessions = sessionsFor(now, ctx);
  const week7 = weekPlan(now, ctx);
  const mon = mondayOf(now);

  const runsWeek = acts.filter((a) => a.type.includes("Run") && a.startDate.slice(0, 10) >= mon);
  const kmWeek = runsWeek.reduce((s, a) => s + a.distance, 0) / 1000;
  const gymWeek = workouts.filter((w) => w.date >= mon).length;
  const gymPlanned = week7.flatMap((d) => d.sessions).filter((s) => s.kind === "gym").length;
  const runPlanned = week7.flatMap((d) => d.sessions).filter((s) => s.kind === "run" || s.kind === "test").length;
  const loads = acts.map((a) => ({ date: a.startDate, load: a.trimp ?? trimpFromAverage(a.avgHr, a.movingTime, athlete.hrMax) }));
  const { ratio } = acwr(loads, now);
  const daysLeft = daysBetween(now, RETURN);

  return (
    <>
      <PageTitle subtitle={prettyDate(now)} title="Aujourd'hui" right={<Link href="/reglages" className="text-sm text-muted underline">Réglages</Link>} />

      <section className="card mb-4">
        <div className="flex items-baseline justify-between">
          <p className="label">
            Phase · semaine {week}
            {totalWeeks ? `/${totalWeeks}` : ""}
          </p>
          {daysLeft > 0 && <p className="text-xs text-muted tabular-nums">Retour Montréal J-{daysLeft}</p>}
        </div>
        <h2 className="mt-1 text-lg font-bold">{phase.name}</h2>
        <p className="mt-1 text-sm text-text-2">{phase.goal}</p>
        <details className="mt-2 text-sm text-text-2">
          <summary className="cursor-pointer text-muted">Règles de la phase</summary>
          <ul className="mt-2 space-y-1">
            {phase.rules.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </details>
      </section>

      {alerts.length > 0 && (
        <section className="mb-4 space-y-3">
          {alerts.slice(0, 3).map((a) => (
            <AlertCard key={a.id} a={a} />
          ))}
        </section>
      )}

      <section className="mb-4 space-y-3">
        <p className="label">Séance du jour</p>
        {todaySessions.map((s, i) => (
          <SessionCard key={i} s={s} done={isDone(s, now, acts, workouts)} />
        ))}
        {todaySessions.some((s) => s.kind === "gym") && (
          <Link href={`/salle/seance?date=${now}`} className="btn btn-primary w-full">
            Démarrer la séance
          </Link>
        )}
      </section>

      <section className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Course" value={`${kmWeek.toFixed(1)} km`} sub={`${runsWeek.length}/${runPlanned} sorties`} />
        <Stat label="Salle" value={`${gymWeek}/${gymPlanned}`} sub="séances" />
        <Stat label="Charge 7j/28j" value={ratio ? ratio.toFixed(2) : "–"} sub={ratio ? (ratio > 1.5 ? "trop haut" : ratio < 0.8 ? "bas" : "ok (0,8-1,3)") : "pas assez de données"} />
      </section>

      <section>
        <p className="label mb-2">Cette semaine</p>
        <div className="card !p-0">
          {week7.map((d) => {
            const isToday = d.date === now;
            return (
              <div key={d.date} className={`flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 ${isToday ? "bg-surface-2" : ""}`}>
                <span className={`w-9 text-sm font-semibold ${isToday ? "text-text" : "text-muted"}`}>{shortDay(d.date)}</span>
                <div className="flex-1 text-sm">
                  {d.sessions.map((s, i) => {
                    const done = isDone(s, d.date, acts, workouts);
                    return (
                      <span key={i} className={`${done ? "text-good" : d.date < now && s.kind !== "rest" && s.kind !== "recovery" ? "text-muted line-through" : ""}`}>
                        {i > 0 && " + "}
                        {s.title}
                        {done && " ✓"}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
