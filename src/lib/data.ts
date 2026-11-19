import "server-only";
import { asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, today } from "./dates";

export interface TemplateItem {
  exercise: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  note?: string;
}

const UPPER: TemplateItem[] = [
  { exercise: "Chest press", sets: 3, repsMin: 5, repsMax: 5 },
  { exercise: "Développé décliné", sets: 2, repsMin: 5, repsMax: 7 },
  { exercise: "Tractions lestées", sets: 3, repsMin: 5, repsMax: 5, note: "Poids = lest ajouté" },
  { exercise: "Développé militaire", sets: 3, repsMin: 5, repsMax: 5 },
  { exercise: "Rowing", sets: 3, repsMin: 5, repsMax: 8 },
];
const LOWER: TemplateItem[] = [
  { exercise: "Hack squat", sets: 3, repsMin: 5, repsMax: 5 },
  { exercise: "Hip thrust", sets: 3, repsMin: 5, repsMax: 5 },
  { exercise: "Curl ischio", sets: 3, repsMin: 5, repsMax: 5 },
  { exercise: "Nordic curl", sets: 2, repsMin: 3, repsMax: 6, note: "Excentrique lent. Poids = 0" },
  { exercise: "Mollets", sets: 3, repsMin: 8, repsMax: 8 },
];

export const DEFAULT_TEMPLATES: { name: string; items: TemplateItem[] }[] = [
  {
    name: "Upper A",
    items: [
      ...UPPER,
      { exercise: "Curl biceps", sets: 2, repsMin: 8, repsMax: 12 },
      { exercise: "Extension triceps", sets: 2, repsMin: 8, repsMax: 12 },
    ],
  },
  { name: "Upper B", items: UPPER },
  {
    name: "Lower A",
    items: [...LOWER.slice(0, 2), { exercise: "Presse à cuisses", sets: 2, repsMin: 8, repsMax: 10 }, ...LOWER.slice(2)],
  },
  { name: "Lower B", items: LOWER },
];

export const MAIN_LIFTS = [
  "Chest press",
  "Développé couché",
  "Développé incliné",
  "Tractions lestées",
  "Développé militaire",
  "Rowing",
  "Hack squat",
  "Hip thrust",
  "Curl ischio",
];

export async function getAthlete() {
  const rows = await db.select().from(schema.athlete).limit(1);
  if (rows[0]) return rows[0];
  // Première ouverture (mode démo) : on crée un profil par défaut.
  await db.insert(schema.athlete).values({ id: 0, name: "Athlète" }).onConflictDoNothing();
  return (await db.select().from(schema.athlete).limit(1))[0];
}

export async function getTemplates() {
  let rows = await db.select().from(schema.templates).orderBy(asc(schema.templates.position));
  if (rows.length === 0) {
    await db.insert(schema.templates).values(
      DEFAULT_TEMPLATES.map((t, i) => ({ name: t.name, items: JSON.stringify(t.items), position: i })),
    );
    rows = await db.select().from(schema.templates).orderBy(asc(schema.templates.position));
  }
  return rows.map((r) => ({ ...r, items: JSON.parse(r.items) as TemplateItem[] }));
}

export async function getActivities(sinceDays = 120) {
  const since = addDays(today(), -sinceDays);
  return db
    .select()
    .from(schema.activities)
    .where(gte(schema.activities.startDate, since))
    .orderBy(desc(schema.activities.startDate));
}

export type Activity = Awaited<ReturnType<typeof getActivities>>[number];

export async function getWorkouts(sinceDays = 365) {
  const since = addDays(today(), -sinceDays);
  const ws = await db
    .select()
    .from(schema.workouts)
    .where(gte(schema.workouts.date, since))
    .orderBy(desc(schema.workouts.date), desc(schema.workouts.id));
  if (ws.length === 0) return [];
  const allSets = await db
    .select()
    .from(schema.sets)
    .where(inArray(schema.sets.workoutId, ws.map((w) => w.id)))
    .orderBy(asc(schema.sets.id));
  return ws.map((w) => ({ ...w, sets: allSets.filter((s) => s.workoutId === w.id) }));
}

export type Workout = Awaited<ReturnType<typeof getWorkouts>>[number];

export async function getTests() {
  return db.select().from(schema.tests).orderBy(desc(schema.tests.date));
}

export async function getActiveAlerts() {
  return db
    .select()
    .from(schema.alerts)
    .where(eq(schema.alerts.dismissed, false))
    .orderBy(desc(schema.alerts.createdAt));
}

export async function getAllAlerts(limit = 50) {
  return db.select().from(schema.alerts).orderBy(desc(schema.alerts.createdAt)).limit(limit);
}

export async function getChat(limit = 60) {
  const rows = await db.select().from(schema.chatMessages).orderBy(desc(schema.chatMessages.id)).limit(limit);
  return rows.reverse();
}
