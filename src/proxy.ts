import { NextResponse, type NextRequest } from "next/server";

// Vérification rapide : pas de cookie de session → page de connexion.
// La vraie vérification (signature du jeton) est faite dans chaque page et action (requireAuth).
export function proxy(req: NextRequest) {
  if (!process.env.STRAVA_CLIENT_ID) return NextResponse.next(); // mode démo
  if (!req.cookies.get("session")) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/auth|api/strava/webhook|_next|favicon.ico|pwa-icon|manifest.webmanifest).*)"],
};
