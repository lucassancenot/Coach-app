# Coach : course + salle

App perso de suivi d'entraînement : plan périodisé jusqu'au retour au foot (mai 2027), synchronisation Strava, saisie des séances de salle, alertes basées sur des seuils et coach IA (Claude).

## Lancer en local

```powershell
npm install
npx drizzle-kit push      # crée la base locale (local.db)
npm run seed              # optionnel : 5 semaines de données d'exemple
npm run dev               # http://localhost:3000
```

Sans `.env.local`, l'app tourne en **mode démo** : pas de connexion, pas de Strava, pas de chat IA. Le planning, la salle et les alertes fonctionnent quand même.

## Mise en ligne (Vercel + Turso + Strava + Claude)

1. **Code sur GitHub** : crée un dépôt privé et pousse ce dossier.
2. **Base de données Turso** : dans Vercel → *Storage* → *Marketplace* → **Turso** (gratuit). Récupère `DATABASE_URL` (`libsql://…`) et `DATABASE_AUTH_TOKEN`.
   Crée ensuite les tables depuis ton PC :
   ```powershell
   $env:DATABASE_URL="libsql://..."; $env:DATABASE_AUTH_TOKEN="..."; npx drizzle-kit push
   ```
3. **Vercel** : *Add New Project* → importe le dépôt GitHub. Avant de déployer, ajoute les variables d'environnement de `.env.example` (sauf `STRAVA_*` si l'app Strava n'est pas encore créée).
4. **App Strava** : sur https://www.strava.com/settings/api, crée une application.
   - *Authorization Callback Domain* : le domaine Vercel, sans `https://` (ex. `coach-xxx.vercel.app`).
   - Copie le Client ID et le Client Secret dans Vercel (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`), invente un `STRAVA_VERIFY_TOKEN`, puis redéploie.
5. **Clé Claude** : sur https://console.anthropic.com, crée une clé API et mets-la dans `ANTHROPIC_API_KEY`.
6. **Webhook Strava** (synchronisation automatique après chaque course), une seule fois :
   ```powershell
   $env:STRAVA_CLIENT_ID="..."; $env:STRAVA_CLIENT_SECRET="..."; $env:STRAVA_VERIFY_TOKEN="..."; npx tsx scripts/strava-webhook.ts https://ton-app.vercel.app
   ```
7. Sur le téléphone, ouvre l'URL, connecte-toi avec Strava, puis *Partager → Sur l'écran d'accueil* (iPhone) ou *Installer l'application* (Android).

## Où est quoi

| Fichier | Rôle |
|---|---|
| `src/lib/plan.ts` | Phases, dates et séances chiffrées, avec les références scientifiques |
| `src/lib/metrics.ts` | Zones, TRIMP, dérive cardiaque, ratio aigu/chronique, 1RM estimé |
| `src/lib/alerts.ts` | Règles qui déclenchent les interventions du coach |
| `src/lib/progression.ts` | Objectifs de charge en salle (double progression) |
| `src/lib/coach.ts` | Prompt et appels à Claude (`claude-opus-5-5`) |
| `src/lib/strava.ts` | OAuth, synchronisation, calculs sur les flux FC |
