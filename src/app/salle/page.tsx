import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { aiEnabled } from "@/lib/coach";
import { getAthlete, getTemplates, getWorkouts, MAIN_LIFTS } from "@/lib/data";
import { asUnit, fromKg } from "@/lib/units";
import { addDays, mondayOf, prettyDate, today } from "@/lib/dates";
import { gymSessionFor } from "@/lib/plan";
import { e1rm } from "@/lib/metrics";
import { deleteWorkout } from "@/app/actions";
import { MuscleVolume, ProgressExplorer, type LiftPoint } from "@/components/interactive";
import { MUSCLE, MUSCLE_GROUPS } from "@/lib/programs";
import { CoachNote, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SallePage({ searchParams }: { searchParams: Promise<{ lift?: string; saved?: string }> }) {
  await requireAuth();
  const { lift: liftParam, saved } = await searchParams;
  const [templates, workouts, athlete] = await Promise.all([getTemplates(), getWorkouts(365), getAthlete()]);
  const unit = asUnit(athlete.unit);
  const now = today();
  const ctx = { hrMax: athlete.hrMax, vift: athlete.vift };
  let next: { date: string; session: NonNullable<ReturnType<typeof gymSessionFor>> } | null = null;
  for (let i = 0; i < 8 && !next; i++) {
    const d = addDays(now, i);
    const g = gymSessionFor(d, ctx);
    const doneToday = workouts.some((w) => w.date === d && w.templateName === g?.title);
    if (g && !doneToday) next = { date: d, session: g };
  }
  // Données de progression : une entrée par séance et par exercice (exercices chargés uniquement).
  const progress: Record<string, LiftPoint[]> = {};
  const bw = athlete.bodyWeight;
  for (const w of [...workouts].reverse()) {
    const byEx = new Map<string, typeof w.sets>();
    for (const st of w.sets) byEx.set(st.exercise, [...(byEx.get(st.exercise) ?? []), st]);
    for (const [ex, ss] of byEx) {
      const lest = ex === "Tractions lestées" || ex === "Dips";
      if (!lest && ss.every((x) => x.weight === 0)) continue;
      const bestSet = ss.reduce((a, b) => (e1rm(b.weight, b.reps, b.rir) > e1rm(a.weight, a.reps, a.rir) ? b : a));
      const e = Math.max(...ss.map((x) => e1rm(x.weight + (lest ? bw : 0), x.reps, x.rir))) - (lest ? bw : 0);
      (progress[ex] ??= []).push({
        date: w.date,
        e1rm: fromKg(e, unit),
        top: fromKg(Math.max(...ss.map((x) => x.weight)), unit),
        volume: Math.round(ss.reduce((acc, x) => acc + fromKg(x.weight, unit) * x.reps, 0)),
        best: `${fromKg(bestSet.weight, unit)}×${bestSet.reps}`,
      });
    }
  }
  // Ordre : exercices de base d'abord, puis les plus fréquents.
  const ordered: Record<string, LiftPoint[]> = {};
  for (const ex of [...MAIN_LIFTS, ...Object.keys(progress).sort((a, b) => progress[b].length - progress[a].length)]) {
    if (progress[ex] && !ordered[ex]) ordered[ex] = progress[ex];
  }

  // Séries par groupe musculaire, 12 dernières semaines.
  const weekStarts = Array.from({ length: 12 }, (_, i) => addDays(mondayOf(now), -7 * (11 - i)));
  const muscleWeeks = weekStarts.map((ws) => {
    const row: Record<string, number | string> = { label: `${Number(ws.slice(8, 10))}/${Number(ws.slice(5, 7))}` };
    for (const g of MUSCLE_GROUPS) row[g] = 0;
    for (const w of workouts.filter((x) => x.date >= ws && x.date < addDays(ws, 7))) {
      for (const st of w.sets) {
        const g = MUSCLE[st.exercise];
        if (g) row[g] = (row[g] as number) + 1;
      }
    }
    return row;
  });

  const records = MAIN_LIFTS.map((ex) => {
    const all = workouts.flatMap((w) => w.sets.filter((s) => s.exercise === ex).map((s) => ({ ...s, date: w.date })));
    if (!all.length) return null;
    const best = all.reduce((a, b) => (e1rm(b.weight, b.reps, b.rir) > e1rm(a.weight, a.reps, a.rir) ? b : a));
    return { ex, best, est: fromKg(e1rm(best.weight, best.reps, best.rir), unit) };
  }).filter((x) => x != null);

  return (
    <>
      <PageTitle subtitle="Upper / Lower" title="Salle" right={<Link href="/salle/programme" className="text-sm text-muted underline">Modifier le programme</Link>} />

      {saved && (
        <p className="card mb-4 !border-good text-sm">
          ✓ Séance enregistrée.{aiEnabled() ? " Le retour du coach apparaît dans l'historique d'ici quelques secondes (recharge la page)." : ""}
        </p>
      )}

      {next && (
        <section className="card mb-4 !border-gym">
          <p className="label">Programme du coach · {next.date === now ? "aujourd'hui" : prettyDate(next.date)}</p>
          <h2 className="mt-1 text-lg font-bold">{next.session.title}</h2>
          <p className="mt-1 text-sm text-text-2">{next.session.focus}</p>
          <ul className="mt-2 space-y-0.5 text-sm text-text-2">
            {next.session.items.map((i) => (
              <li key={i.exercise}>
                <span className="text-text">{i.exercise}</span> {i.sets}×{i.reps}
                {i.type !== "plyo" && ` @RIR${i.rir}`}
              </li>
            ))}
          </ul>
          <Link href={`/salle/seance?date=${next.date}`} className="btn btn-primary mt-3 w-full">
            {next.date === now ? "Démarrer la séance" : "Faire cette séance maintenant"}
          </Link>
        </section>
      )}

      <p className="label mb-2">Séances libres (tes anciens modèles)</p>
      <section className="mb-4 grid grid-cols-2 gap-2">
        {templates.map((t) => (
          <Link key={t.id} href={`/salle/seance?template=${encodeURIComponent(t.name)}`} className="card block active:bg-surface-2">
            <p className="font-semibold">{t.name}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{t.items.map((i) => i.exercise).join(" · ")}</p>
            <p className="mt-2 text-xs font-semibold text-gym">Démarrer →</p>
          </Link>
        ))}
      </section>

      <section className="card mb-4">
        <p className="label mb-2">Progression</p>
        <ProgressExplorer data={ordered} unit={unit} initial={liftParam} />
        <p className="mt-1 text-[11px] text-muted">1RM estimé : Epley corrigé par le RIR (Helms 2016), fiable jusqu&apos;à ~10 répétitions. Glisse la barre du bas pour zoomer.</p>
      </section>

      <section className="card mb-4">
        <p className="label mb-2">Volume par groupe musculaire</p>
        <MuscleVolume weeks={muscleWeeks} groups={MUSCLE_GROUPS} />
      </section>

      {records.length > 0 && (
        <section className="card mb-4">
          <p className="label mb-2">Records (1RM estimé)</p>
          <table className="w-full text-sm tabular-nums">
            <tbody>
              {records.map((r) => (
                <tr key={r.ex} className="border-b border-border last:border-0">
                  <td className="py-2">{r.ex}</td>
                  <td className="py-2 text-right text-muted">
                    {fromKg(r.best.weight, unit)}×{r.best.reps}
                    {r.best.rir != null ? ` @${r.best.rir}` : ""}
                  </td>
                  <td className="py-2 text-right font-semibold">{r.est} {unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="space-y-3">
        <p className="label">Historique</p>
        {workouts.length === 0 && <p className="card text-sm text-muted">Aucune séance enregistrée.</p>}
        {workouts.slice(0, 15).map((w) => {
          const byEx = new Map<string, typeof w.sets>();
          for (const s of w.sets) byEx.set(s.exercise, [...(byEx.get(s.exercise) ?? []), s]);
          return (
            <article key={w.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted">{prettyDate(w.date)}</p>
                  <h3 className="font-semibold">{w.templateName}</h3>
                </div>
                <div className="text-right text-xs text-muted">
                  {w.sessionRpe != null && <p>RPE {w.sessionRpe}</p>}
                  {w.durationMin != null && <p>{w.durationMin} min</p>}
                </div>
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-text-2 tabular-nums">
                {[...byEx].map(([ex, ss]) => (
                  <li key={ex}>
                    <span className="text-text">{ex}</span> {ss.map((s) => `${fromKg(s.weight, unit)}×${s.reps}${s.rir != null ? `@${s.rir}` : ""}`).join(", ")}
                  </li>
                ))}
              </ul>
              {w.notes && <p className="mt-2 text-xs text-muted">{w.notes}</p>}
              {w.coachNote && <CoachNote text={w.coachNote} />}
              <form action={deleteWorkout.bind(null, w.id)} className="mt-2 text-right">
                <button className="text-xs text-muted underline">Supprimer</button>
              </form>
            </article>
          );
        })}
      </section>
    </>
  );
}
