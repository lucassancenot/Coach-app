import { requireAuth } from "@/lib/auth";
import { aiEnabled } from "@/lib/coach";
import { getActivities, getAthlete, getTests } from "@/lib/data";
import { addDays, formatDuration, formatPace, mondayOf, prettyDate, today } from "@/lib/dates";
import { banister, intensityDistribution, trimpFromAverage } from "@/lib/metrics";
import { zones } from "@/lib/plan";
import { addTest, requestActivityFeedback } from "@/app/actions";
import { BarSeries } from "@/components/charts";
import { FitnessChart, TimeSeries, ZoneWeeks } from "@/components/interactive";
import SyncButton from "@/components/SyncButton";
import { CoachNote, PageTitle, Stat, ZoneBar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CoursePage() {
  await requireAuth();
  const [athlete, acts, tests] = await Promise.all([getAthlete(), getActivities(120), getTests()]);
  const now = today();
  const runs = acts.filter((a) => a.type.includes("Run"));
  const z = zones(athlete.hrMax);

  // Km par semaine sur 12 semaines
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(mondayOf(now), -7 * (11 - i)));
  const kmPerWeek = weeks.map((w) => ({
    label: `${Number(w.slice(8, 10))}/${Number(w.slice(5, 7))}`,
    value: Math.round(runs.filter((r) => r.startDate.slice(0, 10) >= w && r.startDate.slice(0, 10) < addDays(w, 7)).reduce((s, r) => s + r.distance, 0) / 100) / 10,
  }));

  // Vitesse sur les footings faits en Z2 (FC moyenne dans la zone) : le meilleur indicateur de progrès aérobie
  const z2Runs = runs
    .filter((r) => r.avgHr && r.avgSpeed && r.avgHr >= z.z2[0] && r.avgHr <= z.z2[1] && r.movingTime >= 1500)
    .slice(0, 20)
    .reverse();
  const efficiency = z2Runs.map((r) => ({
    date: r.startDate.slice(0, 10),
    value: Math.round((r.avgSpeed! * 3.6) * 10) / 10,
    info: `FC moy ${Math.round(r.avgHr!)} · ${(r.distance / 1000).toFixed(1)} km`,
  }));

  // Forme / fatigue (Banister) sur 6 mois, à partir du TRIMP de toutes les activités cardio.
  const loads = acts.map((a) => ({ date: a.startDate, load: a.trimp ?? trimpFromAverage(a.avgHr, a.movingTime, athlete.hrMax) }));
  const fitness = banister(loads, addDays(now, -180), now);

  // Zones par semaine (12 semaines)
  const zoneWeeks = weeks.map((w) => {
    const row = { label: `${Number(w.slice(8, 10))}/${Number(w.slice(5, 7))}`, z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
    for (const r of acts.filter((x) => x.zoneSeconds && x.startDate.slice(0, 10) >= w && x.startDate.slice(0, 10) < addDays(w, 7))) {
      const zs = JSON.parse(r.zoneSeconds!) as number[];
      row.z1 += Math.round(zs[0] / 60);
      row.z2 += Math.round(zs[1] / 60);
      row.z3 += Math.round(zs[2] / 60);
      row.z4 += Math.round(zs[3] / 60);
      row.z5 += Math.round(zs[4] / 60);
    }
    return row;
  });

  const recent14 = runs.filter((r) => r.startDate >= addDays(now, -14) && r.zoneSeconds);
  const dist = intensityDistribution(recent14.map((r) => JSON.parse(r.zoneSeconds!)));
  const km28 = runs.filter((r) => r.startDate >= addDays(now, -28)).reduce((s, r) => s + r.distance, 0) / 1000;

  return (
    <>
      <PageTitle subtitle="Strava" title="Course" right={<SyncButton />} />

      <section className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Moy. 4 sem." value={`${(km28 / 4).toFixed(1)} km`} sub="par semaine" />
        <Stat label="14 j · Z1-2" value={dist.totalMin ? `${dist.low} %` : "–"} sub={dist.totalMin ? `Z3 ${dist.mid} % · Z4-5 ${dist.high} %` : "pas de données FC"} />
        <Stat label="VIFT" value={athlete.vift ? `${athlete.vift}` : "–"} sub={athlete.vift ? "km/h (30-15)" : "à tester"} />
      </section>

      <section className="card mb-4">
        <p className="label mb-2">Forme · fatigue · fraîcheur</p>
        <FitnessChart data={fitness} />
      </section>

      <section className="card mb-4">
        <p className="label mb-2">Zones cardio par semaine</p>
        <ZoneWeeks weeks={zoneWeeks} />
      </section>

      <section className="card mb-4">
        <p className="label">Kilomètres par semaine</p>
        <BarSeries data={kmPerWeek} color="var(--run)" unit="km" />
      </section>

      <section className="card mb-4">
        <p className="label">Vitesse en footing Z2 ({z.z2[0]}-{z.z2[1]} bpm)</p>
        <p className="mb-1 text-xs text-muted">Plus vite à FC égale = moteur aérobie qui progresse. À Singapour, attends-toi à une baisse les 2 premières semaines (chaleur).</p>
        <TimeSeries data={efficiency} color="var(--run)" unit="km/h" label="Vitesse en Z2" />
      </section>

      <section className="card mb-4">
        <p className="label mb-2">Test 30-15 IFT</p>
        <form action={addTest} className="flex gap-2">
          <input name="date" type="date" defaultValue={now} className="input !w-auto" />
          <input name="value" inputMode="decimal" placeholder="VIFT km/h" className="input" required />
          <button className="btn">OK</button>
        </form>
        {tests.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-text-2">
            {tests.map((t) => (
              <li key={t.id} className="flex justify-between tabular-nums">
                <span>{prettyDate(t.date)}</span>
                <span className="font-semibold text-text">{t.value} km/h</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <p className="label">Activités</p>
        {acts.length === 0 && <p className="card text-sm text-muted">Aucune activité. Connecte Strava puis appuie sur ↻.</p>}
        {acts.slice(0, 30).map((a) => (
          <article key={a.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted">
                  {prettyDate(a.startDate.slice(0, 10))} · {a.type}
                </p>
                <h3 className="font-semibold">{a.name}</h3>
              </div>
              {a.trimp != null && <span className="text-xs text-muted tabular-nums">{a.trimp} pts</span>}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-sm tabular-nums">
              <div>
                <p className="text-[10px] text-muted">Distance</p>
                {(a.distance / 1000).toFixed(2)} km
              </div>
              <div>
                <p className="text-[10px] text-muted">Durée</p>
                {formatDuration(a.movingTime)}
              </div>
              <div>
                <p className="text-[10px] text-muted">Allure</p>
                {formatPace(a.avgSpeed)}
              </div>
              <div>
                <p className="text-[10px] text-muted">FC moy</p>
                {a.avgHr ? Math.round(a.avgHr) : "–"}
              </div>
            </div>
            {a.zoneSeconds && (
              <div className="mt-3">
                <ZoneBar zoneSeconds={JSON.parse(a.zoneSeconds)} />
              </div>
            )}
            {a.decoupling != null && (
              <p className={`mt-2 text-xs ${a.decoupling > 5 ? "text-warn" : "text-muted"}`}>
                {a.decoupling > 5 ? "▲ " : ""}Dérive cardiaque {a.decoupling} %{a.decoupling > 5 ? " (> 5 %)" : ""}
              </p>
            )}
            {a.coachNote ? (
              <CoachNote text={a.coachNote} />
            ) : (
              aiEnabled() && (
                <form action={requestActivityFeedback.bind(null, a.id)} className="mt-2">
                  <button className="text-xs text-muted underline">Analyse du coach</button>
                </form>
              )
            )}
          </article>
        ))}
      </section>
    </>
  );
}
