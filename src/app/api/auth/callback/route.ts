import { NextResponse, after, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { createSession } from "@/lib/auth";
import { evaluateAlerts } from "@/lib/alerts";
import { exchangeCode, syncActivities } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const scope = req.nextUrl.searchParams.get("scope") ?? "";
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, req.url));
  if (!code) return fail("annule");
  if (!scope.includes("activity:read")) return fail("scope");

  let t;
  try {
    t = await exchangeCode(code);
  } catch {
    return fail("strava");
  }
  const athleteId = t.athlete?.id;
  if (!athleteId) return fail("strava");

  // Un seul propriétaire : le premier compte connecté (ou celui défini par ALLOWED_ATHLETE_ID).
  const allowed = process.env.ALLOWED_ATHLETE_ID ? Number(process.env.ALLOWED_ATHLETE_ID) : null;
  const [existing] = await db.select().from(schema.athlete).limit(1);
  const ownerId = allowed ?? (existing && existing.id !== 0 ? existing.id : athleteId);
  if (athleteId !== ownerId) return fail("refuse");

  const values = {
    name: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(" ") || "Athlète",
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_at,
  };
  if (existing && existing.id === 0) {
    // On remplace le profil démo en gardant les réglages.
    await db.delete(schema.athlete);
    await db.insert(schema.athlete).values({ ...existing, ...values, id: athleteId });
  } else if (existing) {
    await db.update(schema.athlete).set(values);
  } else {
    await db.insert(schema.athlete).values({ id: athleteId, ...values });
  }

  await createSession(athleteId);
  after(async () => {
    try {
      await syncActivities();
      await evaluateAlerts();
    } catch (e) {
      console.error("synchro initiale", e);
    }
  });
  return NextResponse.redirect(new URL("/", req.url));
}
