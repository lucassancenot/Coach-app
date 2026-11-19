import "server-only";
import { db, schema } from "@/db";
import { addDays, mondayOf, prettyDate, today } from "./dates";
import { acwr, e1rm, intensityDistribution, trimpFromAverage } from "./metrics";
import { phaseFor, weekPlan } from "./plan";
import { getActivities, getAthlete, getWorkouts, MAIN_LIFTS } from "./data";

type Severity = "info" | "warn" | "stop";
interface NewAlert {
  key: string;
  severity: Severity;
  title: string;
  message: string;
}

/**
 * Règles déterministes. Le coach ne parle que lorsqu'un seuil est franchi.
 * Chaque alerte a une clé : elle n'est créée qu'une fois.
 */
export async function evaluateAlerts(): Promise<number> {
  const athlete = await getAthlete();
  const now = today();
  const ctx = { hrMax: athlete.hrMax, vift: athlete.vift };
  const acts = await getActivities(60);
  const runs = acts.filter((a) => a.type === "Run" || a.type === "TrailRun" || a.type === "VirtualRun");
  const workouts = await getWorkouts(60);
  const out: NewAlert[] = [];
  const week = mondayOf(now);

  // 1. Hausse brutale de charge (ACWR)
  const loads = acts.map((a) => ({
    date: a.startDate,
    load: a.trimp ?? trimpFromAverage(a.avgHr, a.movingTime, athlete.hrMax),
  }));
  const { ratio, acute, chronic } = acwr(loads, now);
  if (ratio && chronic > 50 && ratio > 1.5) {
    out.push({
      key: `acwr-${week}`,
      severity: "stop",
      title: `Charge en hausse brutale (ratio ${ratio})`,
      message: `7 derniers jours : ${Math.round(acute)} pts contre ${Math.round(chronic)} pts/sem en moyenne sur 4 semaines. Au-dessus de 1,5, le risque de blessure augmente (Gabbett 2016, à prendre comme un signal). Remplace la prochaine séance intense par 30 min en Z1 et garde le reste de la semaine en Z2.`,
    });
  } else if (ratio && chronic > 50 && ratio < 0.7 && phaseFor(now).id !== "affutage") {
    out.push({
      key: `acwr-low-${week}`,
      severity: "info",
      title: `Charge en baisse (ratio ${ratio})`,
      message: `Tu fais nettement moins que ta moyenne des 4 dernières semaines. Si ce n'est pas voulu (décharge, maladie), reviens progressivement au plan : un saut trop brusque derrière fera monter le ratio au-dessus de 1,5.`,
    });
  }

  // 2. Dérive cardiaque sur les footings
  for (const r of runs.slice(0, 5)) {
    if (r.decoupling != null && r.decoupling > 5 && r.startDate >= addDays(now, -7)) {
      out.push({
        key: `decoupling-${r.id}`,
        severity: "warn",
        title: `Dérive cardiaque de ${r.decoupling} % sur « ${r.name} »`,
        message: `Ta FC a monté de plus de 5 % à vitesse égale entre la 1re et la 2e moitié. Causes probables : départ trop rapide, chaleur, déshydratation ou fatigue. Prochaine sortie Z2 : pars 10-15 s/km plus lentement et bois avant de partir.`,
      });
    }
  }

  // 3. Répartition de l'intensité sur 14 jours
  const recent = runs.filter((r) => r.startDate >= addDays(now, -14) && r.zoneSeconds);
  if (recent.length >= 3) {
    const dist = intensityDistribution(recent.map((r) => JSON.parse(r.zoneSeconds!)));
    const phase = phaseFor(now).id;
    if (dist.mid > 25 && (phase === "base" || phase === "force")) {
      out.push({
        key: `zone3-${week}`,
        severity: "warn",
        title: `${dist.mid} % de ton temps en Z3`,
        message: `Sur 14 jours : ${dist.low} % en Z1-2, ${dist.mid} % en Z3, ${dist.high} % en Z4-5. La Z3 fatigue sans apporter ce que donnent le vrai facile ou le vrai dur (Seiler 2010). Tes footings sont trop rapides : respecte le plafond Z2 de ta montre, même s'il faut marcher en côte.`,
      });
    }
  }

  // 4. Stagnation d'un exercice de base (3 séances sans progrès du 1RM estimé)
  const chrono = [...workouts].reverse();
  for (const lift of MAIN_LIFTS) {
    const bests = chrono
      .map((w) => {
        const s = w.sets.filter((x) => x.exercise === lift);
        return s.length ? Math.max(...s.map((x) => e1rm(x.weight, x.reps, x.rir))) : null;
      })
      .filter((x): x is number => x != null);
    if (bests.length >= 5) {
      const before = Math.max(...bests.slice(0, -3));
      const last3 = bests.slice(-3);
      if (Math.max(...last3) <= before && phaseFor(now).id === "force") {
        out.push({
          key: `stall-${lift}-${week}`,
          severity: "warn",
          title: `${lift} : pas de progrès sur 3 séances`,
          message: `Meilleur 1RM estimé récent ${Math.max(...last3)} kg contre ${before} kg avant. Fais 1 semaine à -10 % sur cet exercice, puis repars avec des séries de 4 répétitions à RIR 2. Si ça bloque encore, vérifie ton sommeil et tes apports (≥ 1,6 g de protéines/kg/j, Morton 2018).`,
        });
      }
    }
  }

  // 5. Séances clés manquées la semaine dernière (vérifié à partir de lundi)
  const lastWeek = weekPlan(addDays(week, -7), ctx);
  const missed: string[] = [];
  for (const day of lastWeek) {
    for (const s of day.sessions) {
      if (!s.keySession) continue;
      const done =
        s.kind === "gym"
          ? workouts.some((w) => w.date >= addDays(day.date, -1) && w.date <= addDays(day.date, 1) && w.templateName === s.template)
          : acts.some((a) => a.startDate.slice(0, 10) >= addDays(day.date, -1) && a.startDate.slice(0, 10) <= addDays(day.date, 1));
      if (!done) missed.push(`${s.title} (${prettyDate(day.date)})`);
    }
  }
  if (missed.length >= 2 && lastWeek[0].date >= "2026-11-16") {
    out.push({
      key: `missed-${week}`,
      severity: "warn",
      title: `${missed.length} séances clés manquées la semaine dernière`,
      message: `${missed.join(", ")}. Ne les rattrape pas en les empilant cette semaine. Priorité : la séance intense de course et les séances Lower. Le reste peut sauter.`,
    });
  }

  let created = 0;
  for (const a of out) {
    const res = await db
      .insert(schema.alerts)
      .values({ ...a, createdAt: new Date().toISOString() })
      .onConflictDoNothing({ target: schema.alerts.key });
    if (res.rowsAffected > 0) created++;
  }
  return created;
}
