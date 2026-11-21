"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveWorkout, type SetInput } from "@/app/actions";
import type { TemplateItem } from "@/lib/data";
import type { Target } from "@/lib/progression";
import { toKg, type Unit } from "@/lib/units";

type Item = TemplateItem & { target: Target };
interface Row {
  weight: string;
  reps: string;
  rir: string;
  done: boolean;
}

function initialRows(items: Item[]): Row[][] {
  return items.map((it) =>
    Array.from({ length: it.sets }, () => ({
      weight: it.target.weight != null ? String(it.target.weight) : "",
      reps: String(it.repsMax),
      rir: it.rir != null ? String(it.rir) : "2",
      done: false,
    })),
  );
}

function SetRow({ r, onChange, idx }: { r: Row; onChange: (p: Partial<Row>) => void; idx: number }) {
  return (
    <div className={`grid grid-cols-[24px_1fr_1fr_1fr_44px] items-center gap-2 ${r.done ? "opacity-100" : "opacity-80"}`}>
      <span className="text-xs text-muted">{idx + 1}</span>
      <input className="input text-center tabular-nums" inputMode="decimal" value={r.weight} onChange={(e) => onChange({ weight: e.target.value })} aria-label="Charge" />
      <input className="input text-center tabular-nums" inputMode="numeric" value={r.reps} onChange={(e) => onChange({ reps: e.target.value })} aria-label="Répétitions" />
      <select className="input text-center" value={r.rir} onChange={(e) => onChange({ rir: e.target.value })} aria-label="RIR">
        {["0", "1", "2", "3", "4", "5"].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChange({ done: !r.done })}
        className={`h-10 rounded-lg border text-lg font-bold ${r.done ? "border-good bg-good text-white" : "border-border bg-surface-2 text-muted"}`}
        aria-label="Série faite"
      >
        ✓
      </button>
    </div>
  );
}

const Header = ({ unit }: { unit: Unit }) => (
    <div className="grid grid-cols-[24px_1fr_1fr_1fr_44px] gap-2 text-[10px] uppercase tracking-wide text-muted">
      <span>#</span>
      <span className="text-center">{unit}</span>
      <span className="text-center">reps</span>
      <span className="text-center">RIR</span>
      <span />
    </div>
  );

export default function WorkoutLogger({ templateName, date, items, unit, otherTemplates }: { templateName: string; date: string; items: Item[]; unit: Unit; otherTemplates: string[] }) {
  const router = useRouter();
  const storageKey = `draft-${templateName}-${date}`;
  // Brouillon local : rien n'est perdu si le téléphone se verrouille pendant la séance.
  // (Ce composant est rendu uniquement côté navigateur, voir WorkoutLoggerClient.)
  const [draft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "null");
    } catch {
      return null;
    }
  });
  const [rows, setRows] = useState<Row[][]>(() => (draft?.rows?.length === items.length ? draft.rows : initialRows(items)));
  const [extra, setExtra] = useState<{ exercise: string; rows: Row[] }[]>(() => draft?.extra ?? []);
  const [rpe, setRpe] = useState("7");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ rows, extra }));
    } catch {}
  }, [rows, extra, storageKey]);

  const update = (i: number, j: number, patch: Partial<Row>) =>
    setRows((r) => r.map((sets, a) => (a === i ? sets.map((s, b) => (b === j ? { ...s, ...patch } : s)) : sets)));

  const submit = () => {
    const collect = (exercise: string, rs: Row[]): SetInput[] =>
      rs
        .filter((r) => r.done)
        .map((r) => ({ exercise, weight: toKg(Number(r.weight.replace(",", ".")) || 0, unit), reps: Number(r.reps), rir: r.rir === "" ? null : Number(r.rir) }));
    const sets = [...items.flatMap((it, i) => collect(it.exercise, rows[i])), ...extra.flatMap((e) => collect(e.exercise.trim(), e.rows))];
    if (!sets.length) {
      setError("Coche au moins une série (✓) avant d'enregistrer.");
      return;
    }
    start(async () => {
      const elapsed = Math.round((Date.now() - startedAt) / 60000);
      const res = await saveWorkout({
        templateName,
        date,
        durationMin: duration ? Number(duration) : elapsed > 10 ? elapsed : null,
        sessionRpe: rpe ? Number(rpe) : null,
        notes,
        sets,
      });
      if (res?.error) setError(res.error);
      else {
        try {
          localStorage.removeItem(storageKey);
        } catch {}
      }
    });
  };

  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <section key={it.exercise} className="card space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-semibold">{it.exercise}</h3>
            <span className="text-xs text-muted tabular-nums">
              {it.sets}×{it.repsMin === it.repsMax ? it.repsMax : `${it.repsMin}-${it.repsMax}`}
            </span>
          </div>
          <p className="text-xs text-gym">{it.target.weight ? `Objectif ${it.target.weight} ${unit} · ` : ""}{it.target.reason}</p>
          {it.target.last && <p className="text-[11px] text-muted">Dernière fois : {it.target.last}</p>}
          {it.note && <p className="text-[11px] text-muted">{it.note}</p>}
          <Header unit={unit} />
          {rows[i].map((r, j) => (
            <SetRow key={j} r={r} idx={j} onChange={(p) => update(i, j, p)} />
          ))}
          <button type="button" className="text-xs text-muted underline" onClick={() => setRows((rs) => rs.map((s, a) => (a === i ? [...s, { ...s[s.length - 1], done: false }] : s)))}>
            + série
          </button>
        </section>
      ))}

      {extra.map((e, k) => (
        <section key={k} className="card space-y-2">
          <input className="input font-semibold" placeholder="Nom de l'exercice" value={e.exercise} onChange={(ev) => setExtra((x) => x.map((y, a) => (a === k ? { ...y, exercise: ev.target.value } : y)))} />
          <Header unit={unit} />
          {e.rows.map((r, j) => (
            <SetRow key={j} r={r} idx={j} onChange={(p) => setExtra((x) => x.map((y, a) => (a === k ? { ...y, rows: y.rows.map((z, b) => (b === j ? { ...z, ...p } : z)) } : y)))} />
          ))}
          <button type="button" className="text-xs text-muted underline" onClick={() => setExtra((x) => x.map((y, a) => (a === k ? { ...y, rows: [...y.rows, { ...y.rows[y.rows.length - 1], done: false }] } : y)))}>
            + série
          </button>
        </section>
      ))}
      <button type="button" className="btn w-full" onClick={() => setExtra((x) => [...x, { exercise: "", rows: [{ weight: "", reps: "8", rir: "2", done: false }] }])}>
        + Exercice hors programme
      </button>

      <section className="card space-y-3">
        <label className="block">
          <span className="label">RPE de la séance (0-10)</span>
          <input className="input mt-1" inputMode="decimal" value={rpe} onChange={(e) => setRpe(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Durée (min) · auto si vide</span>
          <input className="input mt-1" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Notes</span>
          <textarea className="input mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sensations, douleur, sommeil…" />
        </label>
      </section>

      {error && <p className="text-sm text-stop">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={() => router.push("/salle")}>
          Annuler
        </button>
        <button type="button" className="btn btn-primary flex-1" disabled={pending} onClick={submit}>
          {pending ? "Enregistrement…" : "Enregistrer la séance"}
        </button>
      </div>
      {otherTemplates.length > 1 && <p className="text-center text-[11px] text-muted">Mauvaise séance ? Reviens à l&apos;onglet Salle pour en choisir une autre.</p>}
    </div>
  );
}
