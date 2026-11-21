import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getAthlete, getTemplates, getWorkouts, type TemplateItem } from "@/lib/data";
import { prettyDate, today } from "@/lib/dates";
import { gymSessionFor, sessionsFor } from "@/lib/plan";
import { prescribe, targetFor, type Target } from "@/lib/progression";
import { asUnit } from "@/lib/units";
import WorkoutLogger from "@/components/WorkoutLoggerClient";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SeancePage({ searchParams }: { searchParams: Promise<{ template?: string; date?: string }> }) {
  await requireAuth();
  const sp = await searchParams;
  const [templates, workouts, athlete] = await Promise.all([getTemplates(), getWorkouts(365), getAthlete()]);
  const now = today();
  const unit = asUnit(athlete.unit);
  const ctx = { hrMax: athlete.hrMax, vift: athlete.vift };

  let title: string;
  let focus: string | null = null;
  let items: (TemplateItem & { target: Target })[];
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;

  if (date || !sp.template) {
    // Séance du programme du coach (par défaut : celle du jour, sinon la prochaine).
    let d = date ?? now;
    let g = gymSessionFor(d, ctx);
    if (!g && !date) {
      for (let i = 1; i <= 7 && !g; i++) {
        const next = new Date(`${now}T12:00:00Z`);
        next.setUTCDate(next.getUTCDate() + i);
        d = next.toISOString().slice(0, 10);
        g = gymSessionFor(d, ctx);
      }
    }
    if (!g) notFound();
    title = g.title;
    focus = `${prettyDate(d)} · ${g.focus}`;
    items = g.items.map((rx) => ({
      exercise: rx.exercise,
      sets: rx.sets,
      repsMin: rx.reps,
      repsMax: rx.reps,
      note: rx.note,
      rir: rx.type === "plyo" ? 0 : rx.rir,
      target: prescribe(rx, workouts, unit, athlete.bodyWeight, now),
    }));
  } else {
    const t = templates.find((x) => x.name === sp.template) ?? templates[0];
    if (!t) notFound();
    title = t.name;
    const planned = sessionsFor(now, ctx).find((s) => s.template === t.name);
    focus = planned ? planned.lines.join(" ") : "Séance libre (hors programme).";
    items = t.items.map((item) => ({ ...item, target: targetFor(item, workouts, now, unit) }));
  }

  return (
    <>
      <PageTitle subtitle="Séance" title={title} />
      {focus && <p className="card mb-4 text-sm text-text-2">{focus}</p>}
      <WorkoutLogger templateName={title} date={date ?? now} items={items} unit={unit} otherTemplates={templates.map((x) => x.name)} />
    </>
  );
}
