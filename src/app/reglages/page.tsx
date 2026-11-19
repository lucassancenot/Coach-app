import { isDemo, requireAuth } from "@/lib/auth";
import { aiEnabled } from "@/lib/coach";
import { getAthlete } from "@/lib/data";
import { zones } from "@/lib/plan";
import { logout, saveSettings } from "@/app/actions";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReglagesPage() {
  await requireAuth();
  const a = await getAthlete();
  const z = zones(a.hrMax);
  return (
    <>
      <PageTitle subtitle={a.name} title="Réglages" />
      <form action={saveSettings} className="card mb-4 space-y-3">
        <label className="block">
          <span className="label">FC max (bpm)</span>
          <input name="hrMax" className="input mt-1" inputMode="numeric" defaultValue={a.hrMax} />
        </label>
        <label className="block">
          <span className="label">FC repos (bpm)</span>
          <input name="hrRest" className="input mt-1" inputMode="numeric" defaultValue={a.hrRest} />
        </label>
        <button className="btn w-full">Enregistrer</button>
      </form>

      <section className="card mb-4">
        <p className="label mb-2">Tes zones (% FCmax)</p>
        <table className="w-full text-sm tabular-nums">
          <tbody>
            {(
              [
                ["Z1 · récup", z.z1, "< 70 %"],
                ["Z2 · endurance", z.z2, "70-80 %"],
                ["Z3 · tempo", z.z3, "80-87 %"],
                ["Z4 · seuil", z.z4, "87-93 %"],
                ["Z5 · VO2max", z.z5, "> 93 %"],
                ["4×4 Helgerud", z.helgerud, "90-95 %"],
              ] as const
            ).map(([n, r, p], i) => (
              <tr key={n} className="border-b border-border last:border-0">
                <td className="py-2">
                  {i < 5 && <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: `var(--z${i + 1})` }} />}
                  {n}
                </td>
                <td className="py-2 text-right text-muted">{p}</td>
                <td className="py-2 text-right font-semibold">
                  {r[0]}–{r[1]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-muted">Mets les mêmes zones dans ta montre pour que les alertes de FC correspondent.</p>
      </section>

      <section className="card mb-4 space-y-1 text-sm">
        <p>Strava : {isDemo() ? "mode démo (non connecté)" : "connecté"}</p>
        <p>Coach IA : {aiEnabled() ? "actif" : "inactif (clé API manquante)"}</p>
      </section>

      {!isDemo() && (
        <form action={logout}>
          <button className="btn w-full">Se déconnecter</button>
        </form>
      )}
    </>
  );
}
