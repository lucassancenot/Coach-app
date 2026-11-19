"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { destroySession, isDemo, requireAuth } from "@/lib/auth";
import { evaluateAlerts } from "@/lib/alerts";
import { activityFeedback, aiEnabled, chatReply, workoutFeedback } from "@/lib/coach";
import { getAthlete, getChat, type TemplateItem } from "@/lib/data";
import { syncActivities } from "@/lib/strava";
import { today } from "@/lib/dates";

export interface SetInput {
  exercise: string;
  weight: number;
  reps: number;
  rir: number | null;
}

export async function saveWorkout(input: {
  templateName: string;
  date: string;
  durationMin: number | null;
  sessionRpe: number | null;
  notes: string;
  sets: SetInput[];
}) {
  await requireAuth();
  const valid = input.sets.filter((s) => s.exercise && Number.isFinite(s.weight) && s.reps > 0);
  if (valid.length === 0) return { error: "Aucune série valide." };
  const [w] = await db
    .insert(schema.workouts)
    .values({
      date: input.date || today(),
      templateName: input.templateName,
      durationMin: input.durationMin,
      sessionRpe: input.sessionRpe,
      notes: input.notes || null,
    })
    .returning({ id: schema.workouts.id });
  const counters = new Map<string, number>();
  await db.insert(schema.sets).values(
    valid.map((s) => {
      const i = (counters.get(s.exercise) ?? 0) + 1;
      counters.set(s.exercise, i);
      return { workoutId: w.id, exercise: s.exercise, setIndex: i, weight: s.weight, reps: s.reps, rir: s.rir };
    }),
  );
  after(async () => {
    await evaluateAlerts();
    await workoutFeedback(w.id).catch((e) => console.error("feedback séance", e));
  });
  revalidatePath("/", "layout");
  redirect(`/salle?saved=${w.id}`);
}

export async function deleteWorkout(id: number) {
  await requireAuth();
  await db.delete(schema.sets).where(eq(schema.sets.workoutId, id));
  await db.delete(schema.workouts).where(eq(schema.workouts.id, id));
  revalidatePath("/salle");
}

export async function saveTemplate(id: number, name: string, items: TemplateItem[]) {
  await requireAuth();
  const clean = items
    .filter((i) => i.exercise.trim())
    .map((i) => ({ ...i, exercise: i.exercise.trim(), sets: Math.max(1, i.sets), repsMax: Math.max(i.repsMin, i.repsMax) }));
  await db.update(schema.templates).set({ name: name.trim() || "Séance", items: JSON.stringify(clean) }).where(eq(schema.templates.id, id));
  revalidatePath("/salle", "layout");
}

export async function addTest(formData: FormData) {
  await requireAuth();
  const value = Number(String(formData.get("value")).replace(",", "."));
  const date = String(formData.get("date") || today());
  if (!(value > 8 && value < 30)) return;
  await db.insert(schema.tests).values({ date, type: "30-15 IFT", value });
  const athlete = await getAthlete();
  await db.update(schema.athlete).set({ vift: value }).where(eq(schema.athlete.id, athlete.id));
  revalidatePath("/", "layout");
}

export async function saveSettings(formData: FormData) {
  await requireAuth();
  const athlete = await getAthlete();
  const hrMax = Number(formData.get("hrMax"));
  const hrRest = Number(formData.get("hrRest"));
  await db
    .update(schema.athlete)
    .set({
      hrMax: hrMax > 150 && hrMax < 230 ? hrMax : athlete.hrMax,
      hrRest: hrRest > 30 && hrRest < 100 ? hrRest : athlete.hrRest,
      unit: formData.get("unit") === "lb" ? "lb" : "kg",
    })
    .where(eq(schema.athlete.id, athlete.id));
  revalidatePath("/", "layout");
}

export async function dismissAlert(id: number) {
  await requireAuth();
  await db.update(schema.alerts).set({ dismissed: true }).where(eq(schema.alerts.id, id));
  revalidatePath("/", "layout");
}

export async function sendChat(message: string): Promise<{ error?: string }> {
  await requireAuth();
  const text = message.trim();
  if (!text) return {};
  if (!aiEnabled()) return { error: "Ajoute ANTHROPIC_API_KEY pour activer le coach IA." };
  await db.insert(schema.chatMessages).values({ role: "user", content: text, createdAt: new Date().toISOString() });
  const history = (await getChat(30)).map((m) => ({ role: m.role, content: m.content }));
  // L'API exige que la conversation commence par un message utilisateur.
  while (history.length && history[0].role !== "user") history.shift();
  try {
    const reply = await chatReply(history);
    await db.insert(schema.chatMessages).values({ role: "assistant", content: reply, createdAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return { error: "Le coach n'a pas pu répondre. Réessaie dans un instant." };
  }
  revalidatePath("/coach");
  return {};
}

export async function clearChat() {
  await requireAuth();
  await db.delete(schema.chatMessages);
  revalidatePath("/coach");
}

export async function syncNow(): Promise<{ created: number; error?: string }> {
  await requireAuth();
  if (isDemo()) return { created: 0, error: "Mode démo : connecte Strava pour synchroniser." };
  try {
    const created = await syncActivities();
    after(async () => {
      await evaluateAlerts();
      // Retour du coach sur les 3 dernières nouvelles activités seulement (coût maîtrisé).
      for (const id of created.slice(-3)) await activityFeedback(id).catch(console.error);
    });
    revalidatePath("/", "layout");
    return { created: created.length };
  } catch (e) {
    console.error(e);
    return { created: 0, error: "Synchronisation Strava impossible." };
  }
}

export async function requestActivityFeedback(id: number) {
  await requireAuth();
  await activityFeedback(id);
  revalidatePath("/course");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
