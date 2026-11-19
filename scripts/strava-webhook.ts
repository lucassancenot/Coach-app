/**
 * Crée l'abonnement webhook Strava (à faire une seule fois, après le déploiement).
 * Usage : npx tsx scripts/strava-webhook.ts https://ton-app.vercel.app
 * Variables requises : STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_VERIFY_TOKEN
 */
const base = process.argv[2];
if (!base) throw new Error("Donne l'URL de l'app, ex. https://ton-app.vercel.app");

async function main() {
  const body = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    client_secret: process.env.STRAVA_CLIENT_SECRET!,
    callback_url: `${base.replace(/\/$/, "")}/api/strava/webhook`,
    verify_token: process.env.STRAVA_VERIFY_TOKEN!,
  });
  const res = await fetch("https://www.strava.com/api/v3/push_subscriptions", { method: "POST", body });
  console.log(res.status, await res.text());
}

main();
