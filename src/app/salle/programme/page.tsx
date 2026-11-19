import { requireAuth } from "@/lib/auth";
import { getTemplates } from "@/lib/data";
import TemplateEditor from "@/components/TemplateEditor";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProgrammePage() {
  await requireAuth();
  const templates = await getTemplates();
  return (
    <>
      <PageTitle subtitle="Salle" title="Programme" />
      <p className="mb-4 text-sm text-text-2">Change les exercices, les séries et les fourchettes de répétitions. Les objectifs de charge se recalculent à partir de ton historique.</p>
      <div className="space-y-4">
        {templates.map((t) => (
          <TemplateEditor key={t.id} id={t.id} name={t.name} items={t.items} />
        ))}
      </div>
    </>
  );
}
