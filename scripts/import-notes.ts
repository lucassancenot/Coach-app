/**
 * Import de l'historique de salle depuis les notes iPhone (transcrites à la main, charges en lb).
 * Les séances n'ont pas de date : la dernière entrée de chaque exercice = séance la plus récente
 * de ce type, puis une semaine en arrière par numéro de séance.
 *
 * Usage : npx tsx scripts/import-notes.ts         (base définie par DATABASE_URL)
 * Relançable : supprime d'abord les séances importées précédemment (notes « [import] »).
 */
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq, like } from "drizzle-orm";
import * as schema from "../src/db/schema";

const LB = 0.45359237;
const db = drizzle(createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN }), { schema });

type S = [reps: number, lb: number];
interface Entry { n: number; sets: S[]; note?: string }
interface Exercise { name: string; template: string; entries: Entry[] }

// Notation des notes : « 10x90 » = reps×charge, « 50x8 » = charge×reps selon l'exercice.
const rw = (...xs: [number, number][]): S[] => xs.map(([r, w]) => [r, w]);
const wr = (...xs: [number, number][]): S[] => xs.map(([w, r]) => [r, w]);
const same = (n: number, r: number, w: number): S[] => Array.from({ length: n }, () => [r, w]);
const bw = (lest: number, ...reps: number[]): S[] => reps.filter((r) => r > 0).map((r) => [r, lest]);

const DATA: Exercise[] = [
  // ─── HAUT A ───
  {
    name: "Chest press", template: "Upper A", entries: [
      { n: 1, sets: rw([10, 90], [8, 90], [6, 90]) },
      { n: 2, sets: rw([8, 110], [8, 110], [6, 110]) },
      { n: 3, sets: rw([6, 120], [5, 120], [4, 120]) },
      { n: 4, sets: rw([4, 130], [4, 120], [4, 120]) },
      { n: 5, sets: rw([9, 130], [8, 140], [7, 140]) },
      { n: 6, sets: same(3, 6, 150) },
      { n: 7, sets: rw([5, 150], [4, 150], [4, 150]) },
      { n: 8, sets: rw([12, 150], [8, 180], [6, 180]) },
      { n: 9, sets: rw([6, 140], [7, 140], [7, 140]) },
    ],
  },
  { name: "Chest press unilatéral", template: "Upper A", entries: [{ n: 1, sets: wr([55, 10], [55, 10], [55, 10]) }] },
  {
    name: "Tractions lestées", template: "Upper A", entries: [
      { n: 1, sets: bw(0, 5, 4, 4) },
      { n: 2, sets: bw(0, 6, 6, 5, 4) },
      { n: 3, sets: bw(0, 4, 4, 3), note: "prise large" },
      { n: 4, sets: bw(0, 6, 6, 5, 4) },
      { n: 5, sets: bw(0, 5, 6, 4, 3) },
      { n: 6, sets: bw(0, 5, 5, 5, 5) },
      { n: 7, sets: bw(0, 7, 6, 5) },
      { n: 8, sets: bw(10, 7, 6, 5) },
      { n: 9, sets: bw(20, 5, 5, 4) },
      { n: 10, sets: bw(35, 5, 4, 3) },
      { n: 11, sets: bw(20, 5, 4, 4), note: "lest : haltère 20 lb" },
      { n: 12, sets: bw(0, 6, 6, 5), note: "prise large" },
      { n: 13, sets: bw(35, 5, 4, 4) },
      { n: 14, sets: bw(0, 7, 7, 5) },
    ],
  },
  {
    name: "Développé militaire", template: "Upper A", entries: [
      { n: 1, sets: wr([50, 8], [50, 7], [50, 6]) },
      { n: 2, sets: same(3, 8, 50) },
      { n: 3, sets: wr([60, 8], [60, 6], [60, 5]) },
      { n: 4, sets: wr([65, 10], [65, 8], [65, 5]) },
      { n: 5, sets: wr([70, 6], [70, 5], [70, 3]) },
      { n: 6, sets: wr([70, 6], [70, 6], [70, 4]) },
      { n: 7, sets: wr([70, 6], [70, 6], [70, 5]) },
      { n: 8, sets: same(3, 6, 70) },
      { n: 9, sets: wr([70, 8], [70, 6], [70, 6]) },
      { n: 10, sets: same(3, 5, 80) },
      { n: 11, sets: same(2, 4, 80) },
      { n: 12, sets: same(2, 6, 80) },
      { n: 13, sets: wr([90, 3], [80, 6]) },
      { n: 14, sets: same(2, 6, 80) },
    ],
  },
  {
    name: "Rowing", template: "Upper A", entries: [
      { n: 1, sets: same(3, 8, 90) },
      { n: 2, sets: same(4, 5, 70), note: "rowing T-bar (ac)" },
      { n: 3, sets: same(4, 5, 85) },
      { n: 4, sets: wr([95, 4], [95, 3], [95, 3]) },
      { n: 5, sets: same(3, 5, 95) },
      { n: 6, sets: same(3, 5, 95) },
      { n: 7, sets: wr([95, 6], [95, 5]) },
    ],
  },
  { name: "Arrière d'épaule", template: "Upper A", entries: [{ n: 1, sets: wr([105, 9], [105, 8], [105, 8]) }] },
  {
    name: "Face pull", template: "Upper A", entries: [
      { n: 1, sets: rw([11, 60], [15, 60], [15, 60]) },
      { n: 2, sets: same(3, 15, 70) },
      { n: 3, sets: same(3, 15, 80) },
      { n: 4, sets: same(3, 10, 95) },
      { n: 5, sets: same(3, 12, 95) },
    ],
  },

  // ─── BAS A ───
  {
    name: "Hack squat", template: "Lower A", entries: [
      { n: 1, sets: same(4, 10, 360) },
      { n: 2, sets: same(4, 10, 405) },
      { n: 3, sets: same(4, 5, 450) },
      { n: 4, sets: same(3, 5, 470) },
      { n: 5, sets: same(4, 5, 500) },
      { n: 6, sets: same(4, 8, 500) },
      { n: 7, sets: same(4, 5, 540) },
      { n: 8, sets: same(4, 5, 590) },
      { n: 9, sets: same(3, 5, 630) },
    ],
  },
  {
    name: "Hip thrust", template: "Lower A", entries: [
      { n: 1, sets: same(3, 8, 225) },
      { n: 2, sets: rw([8, 225], [8, 245], [8, 245]) },
      { n: 3, sets: rw([7, 295], [6, 295], [6, 295]) },
      { n: 4, sets: rw([7, 315], [6, 315], [6, 315]) },
      { n: 5, sets: same(3, 6, 365) },
      { n: 6, sets: rw([4, 405], [4, 405], [1, 405]), note: "petite douleur" },
      { n: 7, sets: same(3, 5, 385) },
      { n: 8, sets: same(3, 6, 385) },
      { n: 9, sets: same(3, 5, 385) },
    ],
  },
  {
    name: "Curl ischio", template: "Lower A", entries: [
      { n: 1, sets: wr([165, 6], [165, 5], [165, 4]) },
      { n: 2, sets: wr([165, 5], [150, 6]), note: "fds" },
      { n: 3, sets: same(4, 6, 165) },
      { n: 4, sets: wr([180, 6], [180, 5], [180, 5], [180, 5]) },
      { n: 5, sets: wr([180, 6], [180, 5], [180, 5], [180, 5]) },
      { n: 6, sets: same(3, 6, 180) },
      { n: 7, sets: same(3, 5, 180) },
      { n: 8, sets: same(3, 5, 185) },
      { n: 9, sets: wr([185, 5]), note: "petite douleur" },
      { n: 10, sets: wr([180, 5], [180, 5], [180, 4]) },
    ],
  },
  {
    name: "Mollets", template: "Lower A", entries: [
      { n: 1, sets: wr([200, 12], [200, 12], [180, 12], [180, 10]) },
      { n: 2, sets: same(4, 12, 220) },
      { n: 3, sets: wr([240, 12], [240, 12], [240, 10]) },
      { n: 4, sets: same(3, 12, 260) },
    ],
  },

  // ─── HAUT B ───
  {
    name: "Développé couché", template: "Upper B", entries: [
      { n: 1, sets: wr([140, 6], [140, 4], [135, 5], [135, 5], [135, 4]) },
      { n: 2, sets: wr([140, 6], [140, 6], [140, 5], [140, 4], [135, 4]) },
      { n: 3, sets: wr([140, 6], [140, 5], [140, 3], [135, 5], [135, 5]) },
    ],
  },
  {
    name: "Développé incliné", template: "Upper B", entries: [
      { n: 1, sets: rw([10, 70], [10, 75], [10, 75], [10, 75]) },
      { n: 2, sets: same(4, 10, 80) },
      { n: 3, sets: rw([11, 80], [10, 80], [9, 80]) },
      { n: 4, sets: rw([8, 90], [8, 90], [7, 90]) },
      { n: 5, sets: rw([7, 100], [6, 100], [5, 100]) },
      { n: 6, sets: rw([7, 110], [8, 110]) },
      { n: 7, sets: rw([3, 120], [4, 110]) },
      { n: 8, sets: rw([3, 120], [8, 110]) },
      { n: 9, sets: rw([6, 120], [5, 120]) },
      { n: 10, sets: rw([4, 130], [4, 120]) },
      { n: 11, sets: same(2, 4, 120) },
      { n: 12, sets: rw([6, 120], [4, 120]) },
      { n: 13, sets: rw([5, 120], [4, 120]) },
      { n: 14, sets: same(2, 8, 120) },
      { n: 15, sets: rw([6, 120], [4, 120]) },
    ],
  },
  {
    name: "Rowing haltère unilatéral", template: "Upper B", entries: [
      { n: 1, sets: same(3, 10, 35) },
      { n: 2, sets: same(3, 10, 40) },
      { n: 3, sets: rw([10, 50], [10, 55], [10, 55]) },
      { n: 4, sets: same(4, 8, 60) },
      { n: 5, sets: rw([8, 65]) },
    ],
  },
  {
    name: "Dips", template: "Upper B", entries: [
      { n: 1, sets: bw(0, 2, 2, 0) },
      { n: 2, sets: bw(0, 5, 5, 3) },
      { n: 3, sets: bw(0, 8, 5, 4) },
      { n: 4, sets: bw(0, 6), note: "petite douleur" },
      { n: 5, sets: bw(0, 6, 5) },
    ],
  },
  {
    name: "Curl biceps", template: "Upper B", entries: [
      { n: 1, sets: rw([12, 80], [12, 80], [10, 80]) },
      { n: 2, sets: rw([12, 90], [10, 90], [10, 90]) },
      { n: 3, sets: same(2, 8, 105) },
      { n: 4, sets: rw([8, 110], [7, 105], [8, 90]) },
      { n: 5, sets: rw([7, 115], [6, 110]) },
      { n: 6, sets: same(2, 10, 105) },
      { n: 7, sets: rw([6, 125], [5, 125]) },
    ],
  },
  {
    name: "Extension triceps", template: "Upper B", entries: [
      { n: 1, sets: rw([12, 60], [7, 60], [10, 40]) },
      { n: 2, sets: same(3, 12, 60) },
      { n: 3, sets: rw([12, 75], [10, 75], [10, 75]) },
      { n: 4, sets: rw([11, 90], [9, 90]) },
      // séance 5 illisible sur la capture : à compléter
      { n: 6, sets: rw([8, 95], [6, 90]) },
      { n: 7, sets: same(2, 10, 90) },
    ],
  },
];

// Dernière séance de chaque type (semaine du 16 nov. 2026, rythme Upper/Lower).
const LAST: Record<string, string> = { "Upper A": "2026-11-16", "Lower A": "2026-11-17", "Upper B": "2026-11-12" };

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const old = await db.select({ id: schema.workouts.id }).from(schema.workouts).where(like(schema.workouts.notes, "[import]%"));
  for (const w of old) {
    await db.delete(schema.sets).where(eq(schema.sets.workoutId, w.id));
    await db.delete(schema.workouts).where(eq(schema.workouts.id, w.id));
  }

  // Regroupe par (modèle, date)
  const sessions = new Map<string, { template: string; date: string; notes: string[]; sets: { exercise: string; reps: number; lb: number }[] }>();
  for (const ex of DATA) {
    const max = Math.max(...ex.entries.map((e) => e.n));
    for (const e of ex.entries) {
      const date = addDays(LAST[ex.template], -7 * (max - e.n));
      const key = `${ex.template}|${date}`;
      const s = sessions.get(key) ?? { template: ex.template, date, notes: [], sets: [] };
      if (e.note) s.notes.push(`${ex.name} : ${e.note}`);
      for (const [reps, lb] of e.sets) s.sets.push({ exercise: ex.name, reps, lb });
      sessions.set(key, s);
    }
  }

  let nSets = 0;
  for (const s of [...sessions.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    const [w] = await db
      .insert(schema.workouts)
      .values({ date: s.date, templateName: s.template, notes: `[import] date approximative${s.notes.length ? " · " + s.notes.join(" · ") : ""}` })
      .returning();
    const idx = new Map<string, number>();
    await db.insert(schema.sets).values(
      s.sets.map((x) => {
        const i = (idx.get(x.exercise) ?? 0) + 1;
        idx.set(x.exercise, i);
        nSets++;
        return { workoutId: w.id, exercise: x.exercise, setIndex: i, weight: x.lb * LB, reps: x.reps, rir: null };
      }),
    );
  }
  await db.update(schema.athlete).set({ unit: "lb" });
  console.log(`${sessions.size} séances, ${nSets} séries importées. Unité réglée sur lb.`);
}

main();
