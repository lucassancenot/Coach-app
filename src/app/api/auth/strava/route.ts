import { NextResponse, type NextRequest } from "next/server";
import { appOrigin, authorizeUrl } from "@/lib/strava";

export function GET(req: NextRequest) {
  // Ouverte via une autre URL Vercel : on renvoie d'abord sur le domaine principal,
  // pour que le cookie de session soit posé au bon endroit.
  const main = appOrigin(req.nextUrl.origin);
  if (main !== req.nextUrl.origin) return NextResponse.redirect(`${main}/api/auth/strava`);
  return NextResponse.redirect(authorizeUrl(req.nextUrl.origin));
}
