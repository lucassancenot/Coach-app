import { requireAuth } from "@/lib/auth";
import { aiEnabled } from "@/lib/coach";
import { getAllAlerts, getChat } from "@/lib/data";
import { localDateOf, prettyDate } from "@/lib/dates";
import Chat from "@/components/Chat";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  await requireAuth();
  const [messages, alerts] = await Promise.all([getChat(60), getAllAlerts(20)]);
  return (
    <>
      <PageTitle subtitle="Claude" title="Coach" />
      <Chat initial={messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))} enabled={aiEnabled()} />
      {alerts.length > 0 && (
        <section className="mt-6">
          <p className="label mb-2">Historique des alertes</p>
          <ul className="card !p-0">
            {alerts.map((a) => (
              <li key={a.id} className="border-b border-border px-4 py-3 last:border-0">
                <p className="text-xs text-muted">
                  {prettyDate(localDateOf(a.createdAt))}
                  {a.dismissed ? " · lu" : ""}
                </p>
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="text-xs text-text-2">{a.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
