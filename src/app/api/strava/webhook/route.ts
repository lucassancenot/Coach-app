import { NextResponse, after, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { evaluateAlerts } from "@/lib/alerts";
import { activityFeedback } from "@/lib/coach";
import { syncOne } from "@/lib/strava";

// Validation de l'abonnement webhook par Strava.
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.STRAVA_VERIFY_TOKEN) {
    return NextResponse.json({ "hub.challenge": p.get("hub.challenge") });
  }
  return new NextResponse("forbidden", { status: 403 });
}

interface StravaEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
}

// Strava exige une réponse en moins de 2 s : le traitement se fait après la réponse.
export async function POST(req: NextRequest) {
  const ev = (await req.json()) as StravaEvent;
  const [athlete] = await db.select().from(schema.athlete).limit(1);
  if (!athlete || ev.owner_id !== athlete.id || ev.object_type !== "activity") return NextResponse.json({ ok: true });

  after(async () => {
    try {
      if (ev.aspect_type === "delete") {
        await db.delete(schema.activities).where(eq(schema.activities.id, ev.object_id));
        return;
      }
      const created = await syncOne(ev.object_id);
      await evaluateAlerts();
      if (created) await activityFeedback(ev.object_id);
    } catch (e) {
      console.error("webhook", e);
    }
  });
  return NextResponse.json({ ok: true });
}
