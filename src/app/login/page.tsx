import { redirect } from "next/navigation";
import { currentAthleteId, isDemo } from "@/lib/auth";

const ERRORS: Record<string, string> = {
  annule: "Connexion annulée.",
  scope: "Il faut autoriser l'accès à tes activités (y compris privées) pour que le coach les analyse.",
  strava: "Strava n'a pas répondu. Réessaie.",
  refuse: "Ce compte Strava n'est pas autorisé sur cette app.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (isDemo() || (await currentAthleteId()) != null) redirect("/");
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-bold">Coach</h1>
      <p className="mt-2 max-w-xs text-sm text-text-2">Course, salle et plan de préparation, au même endroit.</p>
      {error && <p className="mt-4 max-w-xs text-sm text-stop">{ERRORS[error] ?? "Erreur de connexion."}</p>}
      <a href="/api/auth/strava" className="btn mt-8 !bg-[#fc4c02] !border-[#fc4c02] px-6 text-white">
        Se connecter avec Strava
      </a>
    </div>
  );
}
