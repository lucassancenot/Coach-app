/**
 * Données d'exemple pour tester l'app en local (5 semaines de bloc de force).
 * Usage : npm run seed   (efface les activités, séances et alertes existantes)
 */
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../src/db/schema";

const db = drizzle(createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN }), { schema });

const iso = (d: Date) => d.toISOString().slice(0, 10);
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}
function weekdayOf(s: string) {
  return (new Date(s + "T12:00:00Z").getUTCDay() + 6) % 7;
}

async function main() {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:")) {
    throw new Error("Refus : le seed ne s'exécute que sur la base locale.");
  }
  await db.delete(schema.sets);
  await db.delete(schema.workouts);
  await db.delete(schema.activities);
  await db.delete(schema.alerts);
  await db.delete(schema.chatMessages);
  await db.insert(schema.athlete).values({ id: 0, name: "Athlète" }).onConflictDoNothing();

  let actId = 1000;
  let week = 0;
  const lifts: Record<string, number> = {
    "Chest press": 80, "Développé décliné": 70, "Tractions lestées": 15, "Développé militaire": 50, Rowing: 70,
    "Curl biceps": 14, "Extension triceps": 25, "Hack squat": 120, "Hip thrust": 140, "Presse à cuisses": 180,
    "Curl ischio": 45, "Nordic curl": 0, Mollets: 80,
  };
  const templates: Record<string, string[]> = {
    "Upper A": ["Chest press", "Développé décliné", "Tractions lestées", "Développé militaire", "Rowing", "Curl biceps", "Extension triceps"],
    "Upper B": ["Chest press", "Développé décliné", "Tractions lestées", "Développé militaire", "Rowing"],
    "Lower A": ["Hack squat", "Hip thrust", "Presse à cuisses", "Curl ischio", "Nordic curl", "Mollets"],
    "Lower B": ["Hack squat", "Hip thrust", "Curl ischio", "Nordic curl", "Mollets"],
  };
  const byDay: Record<number, string> = { 0: "Upper A", 1: "Lower A", 3: "Upper B", 4: "Lower B" };

  for (let n = 35; n >= 1; n--) {
    const date = daysAgo(n);
    const wd = weekdayOf(date);
    if (wd === 0) week++;

    const tpl = byDay[wd];
    if (tpl && Math.random() > 0.08) {
      const [w] = await db.insert(schema.workouts).values({ date, templateName: tpl, durationMin: 65 + Math.round(Math.random() * 15), sessionRpe: 7 + Math.round(Math.random() * 2) }).returning();
      for (const ex of templates[tpl]) {
        const nSets = ex === "Développé décliné" || ex.startsWith("Curl b") || ex.startsWith("Ext") || ex === "Presse à cuisses" || ex === "Nordic curl" ? 2 : 3;
        const reps = ex === "Mollets" ? 8 : ex === "Nordic curl" ? 3 + Math.min(week, 3) : ex.startsWith("Curl b") || ex.startsWith("Ext") ? 10 : ex === "Presse à cuisses" ? 8 : 5;
        for (let i = 1; i <= nSets; i++) {
          await db.insert(schema.sets).values({ workoutId: w.id, exercise: ex, setIndex: i, weight: lifts[ex], reps: i === nSets && Math.random() < 0.2 ? reps - 1 : reps, rir: i === nSets ? 1 : 2 });
        }
        // progression hebdo sur les exercices de base (sauf Hack squat qui stagne, pour tester l'alerte)
        if (ex !== "Hack squat" && ex !== "Nordic curl" && Math.random() < 0.5) lifts[ex] += ex === "Hip thrust" || ex === "Presse à cuisses" ? 5 : 2.5;
      }
    }

    if (wd === 2) {
      // Footing Z2 : un peu trop rapide certaines semaines (Z3 + dérive)
      const min = 40 + week * 2;
      const tooFast = week % 2 === 0;
      const zs = tooFast ? [180, min * 60 * 0.55, min * 60 * 0.4, 60, 0] : [240, min * 60 * 0.85, min * 60 * 0.1, 0, 0];
      await db.insert(schema.activities).values({
        id: actId++, startDate: `${date}T07:10:00`, type: "Run", name: "Footing matinal",
        distance: min * 60 * (tooFast ? 3.05 : 2.85), movingTime: min * 60, elevationGain: 35,
        avgHr: tooFast ? 156 : 147, maxHr: tooFast ? 166 : 156, avgSpeed: tooFast ? 3.05 : 2.85, avgCadence: 170,
        zoneSeconds: JSON.stringify(zs.map(Math.round)), decoupling: tooFast ? 6.8 : 3.1,
        trimp: Math.round(zs.reduce((a, s, i) => a + (s / 60) * (i + 1), 0)),
      });
    }
    if (wd === 5) {
      const zs = [600, 900, 420, 360, 600];
      await db.insert(schema.activities).values({
        id: actId++, startDate: `${date}T09:30:00`, type: "Run", name: "4×4 Helgerud",
        distance: 8200, movingTime: 2880, elevationGain: 20, avgHr: 158, maxHr: 182, avgSpeed: 2.85, avgCadence: 176,
        zoneSeconds: JSON.stringify(zs), decoupling: null, trimp: Math.round(zs.reduce((a, s, i) => a + (s / 60) * (i + 1), 0)),
      });
    }
  }
  console.log("Données d'exemple créées.");
}

main();
