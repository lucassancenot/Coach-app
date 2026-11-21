import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, formatDuration, formatPace, prettyDate, RETURN, daysBetween, today } from "./dates";
import { acwr, e1rm, intensityDistribution, trimpFromAverage } from "./metrics";
import { gymSessionFor, phaseWeek, weekPlan, zones } from "./plan";
import { asUnit, fromKg } from "./units";
import { getActiveAlerts, getActivities, getAthlete, getTests, getWorkouts, MAIN_LIFTS } from "./data";

const MODEL = "claude-opus-5-5";

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM = `Tu es le coach de préparation physique d'un footballeur (latéral droit / défenseur central) qui vise un retour en compétition à haut niveau à la mi-mai 2027. Il sait s'entraîner : il veut un encadrement, pas un cours.

Style :
- Direct, en français, tutoiement. Court : 3 à 8 lignes sauf si on te demande plus.
- Chiffré : FC en bpm, allures, charges dans l'unité de l'athlète (indiquée dans les données), RIR, distances. Jamais de conseil vague.
- Pas de félicitations ni de formules creuses. Si tout est conforme, dis-le en une phrase et passe à la suite.
- Si quelque chose ne va pas, dis-le clairement et donne l'ajustement précis.

Fond :
- Appuie-toi sur la littérature scientifique (Helgerud 2001, Seiler, Schumann 2022, Périard, Buchheit, Bosquet 2007, van der Horst 2015, Schoenfeld, Helms...). Cite brièvement l'étude quand ça appuie une recommandation. Si les preuves sont faibles ou débattues (ex. ratio aigu/chronique, seuil de dérive à 5 %), dis-le.
- Respecte le plan et ses phases ci-dessous. Tu peux proposer de l'ajuster si les données le justifient, en expliquant pourquoi.
- Ne pose pas de diagnostic médical. Douleur articulaire, douleur qui persiste, malaise à l'effort : il doit consulter.
- Ne te base que sur les données fournies. Si une donnée manque, dis-le au lieu d'inventer.
- Tu es responsable du programme (salle et course) affiché ci-dessous : tu le connais séance par séance et tu l'ajustes quand les données le justifient (fatigue, séance ratée, ballon, chaleur, examens). Donne alors la séance de remplacement complète, chiffrée.
- Le ballon (activités Strava de type Soccer) remplace les séances de conditionnement du jour. Après un match ou du jeu intense : pas de jambes lourdes ni de fractionné dans les 24 h, et décale ce qui doit l'être.
- Principes : séances combinées dans l'ordre sprints/sauts → charges lourdes → endurance (Schumann 2022 : pas d'interférence sur force/hypertrophie, un peu sur l'explosivité) ; pas de fractionné la veille des jambes ; ne propose jamais de doubles séances ; vitesse > 95 % Vmax chaque semaine (Buchheit 2023) ; fractionnés réglés sur la VIFT ; 1 séance lourde/sem suffit à maintenir la force (Rønnestad 2011) ; décharge 1 semaine sur 4.`;

/** Résumé compact des données, injecté dans chaque requête. */
export async function buildContext(): Promise<string> {
  const athlete = await getAthlete();
  const now = today();
  const ctx = { hrMax: athlete.hrMax, vift: athlete.vift };
  const z = zones(athlete.hrMax);
  const unit = asUnit(athlete.unit);
  const { phase, week, totalWeeks } = phaseWeek(now);
  const acts = await getActivities(42);
  const workouts = await getWorkouts(42);
  const tests = await getTests();
  const alerts = await getActiveAlerts();

  const tg = gymSessionFor(now, ctx);
  const todayGym = tg
    ? `Séance de salle du jour (${tg.title}) : ${tg.items.map((i) => `${i.exercise} ${i.sets}×${i.reps}${i.type === "plyo" ? "" : ` @RIR${i.rir}`}`).join(", ")}.`
    : "";
  const fmtWeek = (d: string) =>
    weekPlan(d, ctx)
      .map((day) => `  ${prettyDate(day.date)} : ${day.sessions.map((s) => s.title).join(" + ")}`)
      .join("\n");

  const actLines = acts
    .slice(0, 20)
    .map((a) => {
      const zs = a.zoneSeconds ? (JSON.parse(a.zoneSeconds) as number[]).map((s) => Math.round(s / 60)).join("/") : "n/d";
      return `  ${a.startDate.slice(0, 10)} ${a.type} « ${a.name} » ${(a.distance / 1000).toFixed(1)} km, ${formatDuration(a.movingTime)}, ${formatPace(a.avgSpeed)}, FC moy ${a.avgHr ?? "n/d"} / max ${a.maxHr ?? "n/d"}, min par zone Z1-Z5 ${zs}, dérive ${a.decoupling ?? "n/d"} %, TRIMP ${a.trimp ?? "n/d"}`;
    })
    .join("\n");

  const wLines = workouts
    .slice(0, 10)
    .map((w) => {
      const byEx = new Map<string, string[]>();
      for (const s of w.sets) {
        const arr = byEx.get(s.exercise) ?? [];
        arr.push(`${fromKg(s.weight, unit)}×${s.reps}${s.rir != null ? `@RIR${s.rir}` : ""}`);
        byEx.set(s.exercise, arr);
      }
      const ex = [...byEx].map(([k, v]) => `${k} ${v.join(", ")}`).join(" | ");
      return `  ${w.date} ${w.templateName ?? "Séance"}${w.sessionRpe ? ` (RPE séance ${w.sessionRpe})` : ""} : ${ex}`;
    })
    .join("\n");

  const best = MAIN_LIFTS.map((lift) => {
    const all = workouts.flatMap((w) => w.sets.filter((s) => s.exercise === lift).map((s) => e1rm(s.weight, s.reps, s.rir)));
    return all.length ? `${lift} ${fromKg(Math.max(...all), unit)} ${unit}` : null;
  })
    .filter(Boolean)
    .join(", ");

  const loads = acts.map((a) => ({ date: a.startDate, load: a.trimp ?? trimpFromAverage(a.avgHr, a.movingTime, athlete.hrMax) }));
  const ac = acwr(loads, now);
  const runs14 = acts.filter((a) => a.type.includes("Run") && a.startDate >= addDays(now, -14) && a.zoneSeconds);
  const dist = intensityDistribution(runs14.map((r) => JSON.parse(r.zoneSeconds!)));

  return `Date du jour : ${prettyDate(now)} (${now}). Retour à Montréal dans ${daysBetween(now, RETURN)} jours (8 mai 2027). Échange à Singapour du 4 janv. au 8 mai 2027 (chaleur 27-32 °C, ~80 % d'humidité).

Profil : 20 ans, 184 cm, ${athlete.bodyWeight} kg. FCmax ${athlete.hrMax}, FC repos ${athlete.hrRest}. Dispo : 6 séances/sem, UNE par jour (études : il ne veut pas se déplacer deux fois), salle ≤ 75 min. Course et salle sont combinées dans la même séance. Priorité : endurance intermittente, avec de la vitesse. VIFT 30-15 : ${athlete.vift ?? "pas encore testée"}. Programme du coach ci-dessous (salle 4×/sem en phase de force, puis 3, puis 2). Aucune douleur actuelle ; il avait noté des « petites douleurs » ponctuelles passées (hip thrust lourd, curl ischio, dips) : à surveiller. Unité des charges : ${unit}.
Zones FC : Z1 ${z.z1.join("-")}, Z2 ${z.z2.join("-")}, Z3 ${z.z3.join("-")}, Z4 ${z.z4.join("-")}, Z5 ${z.z5.join("-")} ; 4×4 Helgerud ${z.helgerud.join("-")}.

Phase : ${phase.name}, semaine ${week}${totalWeeks ? `/${totalWeeks}` : ""}. Objectif : ${phase.goal}
Règles de la phase :
${phase.rules.map((r) => `  - ${r}`).join("\n")}

Plan de cette semaine :
${fmtWeek(now)}
${todayGym}
Semaine prochaine :
${fmtWeek(addDays(now, 7))}

Activités (6 dernières semaines, les plus récentes d'abord) :
${actLines || "  aucune"}

Séances de salle :
${wLines || "  aucune"}

1RM estimés (Epley + RIR) : ${best || "n/d"}
Charge : 7 j = ${Math.round(ac.acute)} pts, moyenne hebdo 28 j = ${Math.round(ac.chronic)} pts, ratio ${ac.ratio ?? "n/d"}.
Répartition de l'intensité en course sur 14 j : ${dist.totalMin ? `${dist.low} % Z1-2, ${dist.mid} % Z3, ${dist.high} % Z4-5` : "n/d"}.
Tests : ${tests.map((t) => `${t.date} ${t.type} ${t.value}`).join(", ") || "aucun"}.
Alertes actives : ${alerts.map((a) => a.title).join(" ; ") || "aucune"}.`;
}

async function ask(messages: Anthropic.Beta.BetaMessageParam[]): Promise<string> {
  const client = new Anthropic();
  const context = await buildContext();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: [
      { type: "text", text: SYSTEM },
      { type: "text", text: `Données à jour de l'athlète :\n${context}` },
    ],
    messages,
  });
  if (response.stop_reason === "refusal") return "Je ne peux pas répondre à cette demande.";
  return response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function chatReply(history: { role: string; content: string }[]): Promise<string> {
  return ask(history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
}

/** Retour automatique après une activité Strava. */
export async function activityFeedback(activityId: number): Promise<string | null> {
  if (!aiEnabled()) return null;
  const [a] = await db.select().from(schema.activities).where(eq(schema.activities.id, activityId));
  if (!a) return null;
  const text = await ask([
    {
      role: "user",
      content: `Nouvelle activité synchronisée : « ${a.name} » du ${a.startDate.slice(0, 10)}. Compare-la à la séance prévue ce jour-là dans le plan. En 3 à 5 lignes : conforme ou pas (zones, durée, dérive), ce que ça dit de ma forme, et l'ajustement concret pour la prochaine séance s'il y en a un. Si c'est conforme et qu'il n'y a rien à changer, une seule phrase suffit.`,
    },
  ]);
  await db.update(schema.activities).set({ coachNote: text }).where(eq(schema.activities.id, activityId));
  return text;
}

/** Retour automatique après une séance de salle. */
export async function workoutFeedback(workoutId: number): Promise<string | null> {
  if (!aiEnabled()) return null;
  const [w] = await db.select().from(schema.workouts).where(eq(schema.workouts.id, workoutId));
  if (!w) return null;
  const text = await ask([
    {
      role: "user",
      content: `Je viens d'enregistrer ma séance « ${w.templateName} » du ${w.date}. Compare avec mes séances précédentes du même modèle. En 2 à 4 lignes : progression ou pas, et les charges exactes à viser la prochaine fois pour chaque exercice de base. Si rien à signaler, une phrase.`,
    },
  ]);
  await db.update(schema.workouts).set({ coachNote: text }).where(eq(schema.workouts.id, workoutId));
  return text;
}
