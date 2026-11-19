import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decoupling, edwardsTrimp, trimpFromAverage, zoneSeconds } from "./metrics";

const API = "https://www.strava.com/api/v3";

export function authorizeUrl(origin: string): string {
  const p = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
  });
  return `https://www.strava.com/oauth/authorize?${p}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Strava token ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code" });
}

/** Jeton valide pour l'athlète (rafraîchi si besoin). */
async function accessToken(): Promise<string> {
  const [a] = await db.select().from(schema.athlete).limit(1);
  if (!a?.refreshToken) throw new Error("Compte Strava non connecté.");
  if (a.accessToken && a.expiresAt && a.expiresAt > Date.now() / 1000 + 120) return a.accessToken;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: a.refreshToken });
  await db
    .update(schema.athlete)
    .set({ accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at })
    .where(eq(schema.athlete.id, a.id));
  return t.access_token;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!res.ok) throw new Error(`Strava ${path} ${res.status}`);
  return res.json();
}

interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  average_cadence?: number;
  has_heartrate?: boolean;
}

interface Streams {
  time?: { data: number[] };
  heartrate?: { data: number[] };
  velocity_smooth?: { data: number[] };
}

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

/** Enregistre (ou met à jour) une activité, avec les indicateurs calculés depuis les flux. */
export async function upsertActivity(a: StravaActivity, hrMax: number): Promise<boolean> {
  const type = a.sport_type ?? a.type;
  let zs: number[] | null = null;
  let dec: number | null = null;
  let trimp = trimpFromAverage(a.average_heartrate ?? null, a.moving_time, hrMax);
  if (a.has_heartrate) {
    try {
      const s = await get<Streams>(`/activities/${a.id}/streams?keys=time,heartrate,velocity_smooth&key_by_type=true`);
      if (s.time && s.heartrate) {
        zs = zoneSeconds(s.time.data, s.heartrate.data, hrMax);
        trimp = edwardsTrimp(zs);
        if (RUN_TYPES.has(type) && s.velocity_smooth) dec = decoupling(s.time.data, s.heartrate.data, s.velocity_smooth.data);
      }
    } catch {
      // flux indisponibles : on garde l'estimation par la FC moyenne
    }
  }
  const values = {
    id: a.id,
    startDate: a.start_date_local.replace("Z", ""),
    type,
    name: a.name,
    distance: a.distance,
    movingTime: a.moving_time,
    elevationGain: a.total_elevation_gain,
    avgHr: a.average_heartrate ?? null,
    maxHr: a.max_heartrate ?? null,
    avgSpeed: a.average_speed ?? null,
    avgCadence: a.average_cadence ? a.average_cadence * 2 : null, // Strava donne des foulées/min par jambe
    zoneSeconds: zs ? JSON.stringify(zs) : null,
    decoupling: dec,
    trimp: Math.round(trimp),
  };
  const existing = await db.select({ id: schema.activities.id }).from(schema.activities).where(eq(schema.activities.id, a.id));
  if (existing.length) {
    await db.update(schema.activities).set(values).where(eq(schema.activities.id, a.id));
    return false;
  }
  await db.insert(schema.activities).values(values);
  return true;
}

/** Synchronise les activités depuis la dernière synchro (120 jours la première fois). */
export async function syncActivities(): Promise<number[]> {
  const [athlete] = await db.select().from(schema.athlete).limit(1);
  const after = athlete.lastSyncAt ? athlete.lastSyncAt - 3 * 86400 : Math.floor(Date.now() / 1000) - 120 * 86400;
  const created: number[] = [];
  for (let page = 1; page <= 5; page++) {
    const list = await get<StravaActivity[]>(`/athlete/activities?after=${after}&per_page=100&page=${page}`);
    for (const a of list) if (await upsertActivity(a, athlete.hrMax)) created.push(a.id);
    if (list.length < 100) break;
  }
  await db.update(schema.athlete).set({ lastSyncAt: Math.floor(Date.now() / 1000) }).where(eq(schema.athlete.id, athlete.id));
  return created;
}

/** Appelé par le webhook pour une activité précise. */
export async function syncOne(activityId: number): Promise<boolean> {
  const [athlete] = await db.select().from(schema.athlete).limit(1);
  const a = await get<StravaActivity>(`/activities/${activityId}`);
  return upsertActivity(a, athlete.hrMax);
}
