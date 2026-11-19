import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { aiEnabled } from "@/lib/coach";
import { getTemplates, getWorkouts, MAIN_LIFTS } from "@/lib/data";
import { prettyDate } from "@/lib/dates";
import { e1rm } from "@/lib/metrics";
import { deleteWorkout } from "@/app/actions";
import { LineSeries } from "@/components/charts";
import { CoachNote, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SallePage({ searchParams }: { searchParams: Promise<{ lift?: string; saved?: string }> }) {
  await requireAuth();
  const { lift: liftParam, saved } = await searchParams;
  const [templates, workouts] = await Promise.all([getTemplates(), getWorkouts(365)]);
  const lift = liftParam && MAIN_LIFTS.includes(liftParam) ? liftParam : MAIN_LIFTS[0];

  const series = [...workouts]
    .reverse()
    .map((w) => {
      const s = w.sets.filter((x) => x.exercise === lift);
      if (!s.length) return null;
      return { label: `${Number(w.date.slice(8, 10))}/${Number(w.date.slice(5, 7))}`, value: Math.max(...s.map((x) => e1rm(x.weight, x.reps, x.rir))) };
    })
    .filter((x): x is { label: string; value: number } => x != null);

  const records = MAIN_LIFTS.map((ex) => {
    const all = workouts.flatMap((w) => w.sets.filter((s) => s.exercise === ex).map((s) => ({ ...s, date: w.date })));
    if (!all.length) return null;
    const best = all.reduce((a, b) => (e1rm(b.weight, b.reps, b.rir) > e1rm(a.weight, a.reps, a.rir) ? b : a));
    return { ex, best, est: e1rm(best.weight, best.reps, best.rir) };
  }).filter((x) => x != null);

  return (
    <>
      <PageTitle subtitle="Upper / Lower" title="Salle" right={<Link href="/salle/programme" className="text-sm text-muted underline">Modifier le programme</Link>} />

      {saved && (
        <p className="card mb-4 !border-good text-sm">
          ✓ Séance enregistrée.{aiEnabled() ? " Le retour du coach apparaît dans l'historique d'ici quelques secondes (recharge la page)." : ""}
        </p>
      )}

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
        <p className="label">1RM estimé</p>
        <div className="my-2 flex flex-wrap gap-1">
          {MAIN_LIFTS.map((l) => (
            <Link key={l} href={`/salle?lift=${encodeURIComponent(l)}`} className={`rounded-full px-3 py-1 text-xs ${l === lift ? "bg-gym text-white" : "bg-surface-2 text-text-2"}`}>
              {l}
            </Link>
          ))}
        </div>
        {series.length >= 2 ? <LineSeries data={series} color="var(--gym)" unit="kg" /> : <p className="py-6 text-center text-sm text-muted">Pas encore assez de séances pour {lift}.</p>}
        <p className="text-[11px] text-muted">Epley corrigé par le RIR (Helms 2016). Fiable jusqu&apos;à ~10 répétitions effectives.</p>
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
                    {r.best.weight}×{r.best.reps}
                    {r.best.rir != null ? ` @${r.best.rir}` : ""}
                  </td>
                  <td className="py-2 text-right font-semibold">{r.est} kg</td>
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
                    <span className="text-text">{ex}</span> {ss.map((s) => `${s.weight}×${s.reps}${s.rir != null ? `@${s.rir}` : ""}`).join(", ")}
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
