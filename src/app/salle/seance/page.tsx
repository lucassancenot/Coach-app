import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getTemplates, getWorkouts } from "@/lib/data";
import { today } from "@/lib/dates";
import { targetFor } from "@/lib/progression";
import { asUnit } from "@/lib/units";
import { sessionsFor } from "@/lib/plan";
import { getAthlete } from "@/lib/data";
import WorkoutLogger from "@/components/WorkoutLoggerClient";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SeancePage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  await requireAuth();
  const { template } = await searchParams;
  const [templates, workouts, athlete] = await Promise.all([getTemplates(), getWorkouts(180), getAthlete()]);
  const t = templates.find((x) => x.name === template) ?? templates[0];
  if (!t) notFound();
  const now = today();
  const planned = sessionsFor(now, { hrMax: athlete.hrMax, vift: athlete.vift }).find((s) => s.template === t.name);

  const unit = asUnit(athlete.unit);
  const items = t.items.map((item) => ({ ...item, target: targetFor(item, workouts, now, unit) }));

  return (
    <>
      <PageTitle subtitle="Séance" title={t.name} />
      {planned && (
        <div className="card mb-4 text-sm text-text-2">
          <p className="label mb-1">Consignes du jour</p>
          <ul className="space-y-1">
            {planned.lines.map((l, i) => (
              <li key={i}>• {l}</li>
            ))}
          </ul>
        </div>
      )}
      <WorkoutLogger templateName={t.name} date={now} items={items} unit={unit} otherTemplates={templates.map((x) => x.name)} />
    </>
  );
}
