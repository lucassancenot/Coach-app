import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl } from "@/lib/strava";

export function GET(req: NextRequest) {
  return NextResponse.redirect(authorizeUrl(req.nextUrl.origin));
}
