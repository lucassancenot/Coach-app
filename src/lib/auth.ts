import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "session";

/** Sans identifiants Strava configurés, l'app tourne en mode démo, sans connexion. */
export function isDemo(): boolean {
  return !process.env.STRAVA_CLIENT_ID;
}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET manquant (32 caractères minimum).");
  return new TextEncoder().encode(s);
}

export async function createSession(athleteId: number) {
  const token = await new SignJWT({ sub: String(athleteId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentAthleteId(): Promise<number | null> {
  if (isDemo()) return 0;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return Number(payload.sub);
  } catch {
    return null;
  }
}

/** À appeler en tête de chaque page, action et route protégée. */
export async function requireAuth(): Promise<number> {
  const id = await currentAthleteId();
  if (id == null) redirect("/login");
  return id;
}
