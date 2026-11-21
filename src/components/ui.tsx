import type { Session } from "@/lib/plan";
import { dismissAlert } from "@/app/actions";
import Markdown from "./Markdown";

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="mb-4 flex items-end justify-between gap-3">
      <div>
        {subtitle && <p className="label">{subtitle}</p>}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card !p-3">
      <p className="label !text-[10px]">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

const KIND_COLOR: Record<string, string> = {
  run: "var(--run)",
  test: "var(--run)",
  gym: "var(--gym)",
  rest: "var(--muted)",
  recovery: "var(--muted)",
};

export function SessionCard({ s, done }: { s: Session; done?: boolean }) {
  return (
    <div className="card relative overflow-hidden">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: KIND_COLOR[s.kind] }} />
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{s.title}</h3>
        {done ? (
          <span className="shrink-0 rounded-full bg-good/15 px-2 py-0.5 text-xs font-semibold text-good">✓ Fait</span>
        ) : s.keySession ? (
          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-2">Séance clé</span>
        ) : null}
      </div>
      {s.hr && (
        <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: KIND_COLOR[s.kind] }}>
          FC {s.hr[0]}–{s.hr[1]} bpm
        </p>
      )}
      <ul className="mt-2 space-y-1 text-sm text-text-2">
        {s.lines.map((l, i) => (
          <li key={i}>• {l}</li>
        ))}
      </ul>
    </div>
  );
}

const SEV = {
  stop: { color: "var(--stop)", icon: "■", label: "Stop" },
  warn: { color: "var(--warn)", icon: "▲", label: "Attention" },
  info: { color: "var(--gym)", icon: "●", label: "Info" },
} as const;

export function AlertCard({ a }: { a: { id: number; severity: string; title: string; message: string; createdAt: string } }) {
  const sev = SEV[a.severity as keyof typeof SEV] ?? SEV.info;
  return (
    <div className="card" style={{ borderColor: sev.color }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold" style={{ color: sev.color }}>
          {sev.icon} {sev.label}
        </p>
        <form action={dismissAlert.bind(null, a.id)}>
          <button className="text-xs text-muted underline">Compris</button>
        </form>
      </div>
      <h3 className="mt-1 font-semibold">{a.title}</h3>
      <p className="mt-1 text-sm text-text-2">{a.message}</p>
    </div>
  );
}

export function ZoneBar({ zoneSeconds }: { zoneSeconds: number[] }) {
  const total = zoneSeconds.reduce((a, b) => a + b, 0);
  if (!total) return null;
  return (
    <div>
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={zoneSeconds.map((s, i) => `Z${i + 1} ${Math.round(s / 60)} min`).join(", ")}>
        {zoneSeconds.map((s, i) =>
          s > 0 ? (
            <span key={i} title={`Z${i + 1} · ${Math.round(s / 60)} min`} style={{ width: `${(s / total) * 100}%`, background: `var(--z${i + 1})` }} />
          ) : null,
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted tabular-nums">
        {zoneSeconds.map((s, i) => (
          <span key={i}>
            Z{i + 1} {Math.round(s / 60)}′
          </span>
        ))}
      </div>
    </div>
  );
}

export function CoachNote({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-2 p-3">
      <p className="label mb-1 !text-[10px]">Coach</p>
      <Markdown text={text} />
    </div>
  );
}
