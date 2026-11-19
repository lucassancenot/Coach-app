"use client";
import { useState, useTransition } from "react";
import { saveTemplate } from "@/app/actions";
import type { TemplateItem } from "@/lib/data";

export default function TemplateEditor({ id, name: initialName, items: initialItems }: { id: number; name: string; items: TemplateItem[] }) {
  const [name, setName] = useState(initialName);
  const [items, setItems] = useState(initialItems);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const set = (i: number, patch: Partial<TemplateItem>) => {
    setSaved(false);
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };
  const move = (i: number, d: number) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const c = [...xs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  return (
    <section className="card space-y-2">
      <input className="input font-semibold" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom de la séance" />
      <div className="grid grid-cols-[1fr_44px_44px_44px_56px] gap-1 text-[10px] uppercase text-muted">
        <span>Exercice</span>
        <span className="text-center">Séries</span>
        <span className="text-center">Min</span>
        <span className="text-center">Max</span>
        <span />
      </div>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_44px_44px_44px_56px] items-center gap-1">
          <input className="input !px-2 text-sm" value={it.exercise} onChange={(e) => set(i, { exercise: e.target.value })} />
          <input className="input !px-1 text-center" inputMode="numeric" value={it.sets} onChange={(e) => set(i, { sets: Number(e.target.value) || 0 })} />
          <input className="input !px-1 text-center" inputMode="numeric" value={it.repsMin} onChange={(e) => set(i, { repsMin: Number(e.target.value) || 0 })} />
          <input className="input !px-1 text-center" inputMode="numeric" value={it.repsMax} onChange={(e) => set(i, { repsMax: Number(e.target.value) || 0 })} />
          <div className="flex justify-end gap-1 text-muted">
            <button type="button" onClick={() => move(i, -1)} aria-label="Monter">↑</button>
            <button type="button" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label="Supprimer" className="px-1">
              ✕
            </button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button type="button" className="text-sm text-muted underline" onClick={() => setItems((xs) => [...xs, { exercise: "", sets: 3, repsMin: 8, repsMax: 10 }])}>
          + Exercice
        </button>
        <button
          type="button"
          className="btn !py-2 text-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await saveTemplate(id, name, items);
              setSaved(true);
            })
          }
        >
          {pending ? "…" : saved ? "✓ Enregistré" : "Enregistrer"}
        </button>
      </div>
    </section>
  );
}
