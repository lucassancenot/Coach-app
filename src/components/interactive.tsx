"use client";
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Palette catégorielle validée (thème sombre), dans un ordre fixe.
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"];

const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = {
  contentStyle: { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 12 },
  labelStyle: { color: "var(--text-2)" },
  itemStyle: { color: "var(--text)" },
};
const dm = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

type RangeKey = "1M" | "3M" | "6M" | "Tout";
const RANGE_DAYS: Record<RangeKey, number> = { "1M": 31, "3M": 92, "6M": 183, Tout: 100000 };

function cutoff(range: RangeKey, last: string | undefined): string {
  if (!last || range === "Tout") return "0000-00-00";
  const d = new Date(`${last}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - RANGE_DAYS[range]);
  return d.toISOString().slice(0, 10);
}

export function Segmented<T extends string>({ options, value, onChange, size = "sm" }: { options: readonly T[]; value: T; onChange: (v: T) => void; size?: "sm" | "xs" }) {
  return (
    <div className="inline-flex rounded-lg bg-surface-2 p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o}
          role="tab"
          aria-selected={o === value}
          onClick={() => onChange(o)}
          className={`rounded-md ${size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} font-medium transition ${o === value ? "bg-text text-bg" : "text-text-2"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Toggles({ items, hidden, onToggle }: { items: { key: string; label: string; color: string }[]; hidden: Set<string>; onToggle: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const off = hidden.has(it.key);
        return (
          <button
            key={it.key}
            onClick={() => onToggle(it.key)}
            aria-pressed={!off}
            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${off ? "border-border text-muted" : "border-transparent bg-surface-2 text-text"}`}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: off ? "transparent" : it.color, border: `1.5px solid ${it.color}` }} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function useHidden() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  return [hidden, toggle] as const;
}

// ─── Progression par exercice ──────────────────────────────────────────

export interface LiftPoint {
  date: string;
  e1rm: number;
  top: number;
  volume: number; // charge × reps sur la séance
  best: string; // meilleure série, ex. "630×5"
}

const METRICS = ["1RM estimé", "Charge max", "Volume"] as const;
type Metric = (typeof METRICS)[number];
const METRIC_KEY: Record<Metric, keyof LiftPoint> = { "1RM estimé": "e1rm", "Charge max": "top", Volume: "volume" };

export function ProgressExplorer({ data, unit, initial }: { data: Record<string, LiftPoint[]>; unit: string; initial?: string }) {
  const lifts = Object.keys(data).filter((k) => data[k].length > 0);
  const [lift, setLift] = useState(initial && data[initial]?.length ? initial : lifts[0]);
  const [metric, setMetric] = useState<Metric>("1RM estimé");
  const [range, setRange] = useState<RangeKey>("Tout");
  const series = useMemo(() => {
    const all = data[lift] ?? [];
    const c = cutoff(range, all.at(-1)?.date);
    return all.filter((p) => p.date >= c);
  }, [data, lift, range]);
  if (!lifts.length) return <p className="py-6 text-center text-sm text-muted">Pas encore de séances enregistrées.</p>;

  const key = METRIC_KEY[metric];
  const values = series.map((p) => p[key] as number);
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? 0;
  const maxV = Math.max(...values);
  const maxP = series.find((p) => (p[key] as number) === maxV);
  const delta = first ? Math.round(((last - first) / first) * 1000) / 10 : 0;
  const u = metric === "Volume" ? `${unit}·reps` : unit;

  return (
    <div>
      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {lifts.map((l) => (
          <button key={l} onClick={() => setLift(l)} className={`shrink-0 rounded-full px-3 py-1 text-xs ${l === lift ? "bg-gym text-white" : "bg-surface-2 text-text-2"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Segmented options={METRICS} value={metric} onChange={setMetric} size="xs" />
        <Segmented options={["1M", "3M", "6M", "Tout"] as const} value={range} onChange={setRange} size="xs" />
      </div>
      <div className="mb-1 flex items-baseline gap-3">
        <p className="text-2xl font-bold tabular-nums">
          {last} <span className="text-sm font-normal text-muted">{u}</span>
        </p>
        {series.length > 1 && (
          <p className={`text-sm font-semibold tabular-nums ${delta > 0 ? "text-good" : delta < 0 ? "text-stop" : "text-muted"}`}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(delta)} % sur la période
          </p>
        )}
      </div>
      {series.length >= 2 ? (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={dm} {...axis} minTickGap={24} />
              <YAxis {...axis} width={48} domain={["auto", "auto"]} />
              <Tooltip
                {...tip}
                labelFormatter={(d) => dm(String(d))}
                formatter={(v, _n, item) => [`${v} ${u}  ·  meilleure série ${(item.payload as LiftPoint).best}`, metric]}
                cursor={{ stroke: "var(--muted)" }}
              />
              <Line type="monotone" dataKey={key as string} stroke="var(--gym)" strokeWidth={2} dot={{ r: 3.5, fill: "var(--gym)", stroke: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
              {maxP && <ReferenceDot x={maxP.date} y={maxV} r={7} fill="var(--warn)" stroke="var(--surface)" strokeWidth={2} label={{ value: "Record", position: "top", fill: "var(--text-2)", fontSize: 10 }} />}
              {series.length > 8 && <Brush dataKey="date" height={18} travellerWidth={8} stroke="var(--muted)" fill="var(--surface-2)" tickFormatter={dm} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted">Pas assez de séances sur cette période.</p>
      )}
    </div>
  );
}

// ─── Volume par groupe musculaire ─────────────────────────────────────

export function MuscleVolume({ weeks, groups }: { weeks: Record<string, number | string>[]; groups: string[] }) {
  const [hidden, toggle] = useHidden();
  const items = groups.map((g, i) => ({ key: g, label: g, color: SERIES[i % SERIES.length] }));
  return (
    <div>
      <Toggles items={items} hidden={hidden} onToggle={toggle} />
      <div className="mt-2 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" {...axis} minTickGap={16} />
            <YAxis {...axis} width={40} allowDecimals={false} />
            <Tooltip {...tip} cursor={{ fill: "var(--surface-2)" }} formatter={(v, n) => [`${v} séries`, n]} />
            {items
              .filter((it) => !hidden.has(it.key))
              .map((it, i, arr) => (
                <Bar key={it.key} dataKey={it.key} stackId="s" fill={it.color} stroke="var(--surface)" strokeWidth={1} radius={i === arr.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={26} isAnimationActive={false} />
              ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-muted">Séries de travail par semaine. Repère hypertrophie : ~10-20 séries/groupe/sem (Schoenfeld 2017).</p>
    </div>
  );
}

// ─── Forme / fatigue / fraîcheur ──────────────────────────────────────

export function FitnessChart({ data }: { data: { date: string; ctl: number; atl: number; tsb: number }[] }) {
  const [range, setRange] = useState<RangeKey>("3M");
  const [hidden, toggle] = useHidden();
  const series = useMemo(() => data.filter((p) => p.date >= cutoff(range, data.at(-1)?.date)), [data, range]);
  const last = data.at(-1);
  const items = [
    { key: "ctl", label: "Forme (42 j)", color: SERIES[0] },
    { key: "atl", label: "Fatigue (7 j)", color: SERIES[1] },
    { key: "tsb", label: "Fraîcheur", color: "#8b8a83" },
  ];
  const state = !last ? "" : last.tsb < -25 ? "très chargé : surveille la récupération" : last.tsb < -10 ? "en charge (normal en bloc)" : last.tsb <= 5 ? "équilibré" : "frais";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Toggles items={items} hidden={hidden} onToggle={toggle} />
        <Segmented options={["1M", "3M", "6M"] as const} value={range as "1M" | "3M" | "6M"} onChange={setRange} size="xs" />
      </div>
      {last && (
        <div className="mb-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-muted">Forme</p>
            <p className="font-bold tabular-nums">{Math.round(last.ctl)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted">Fatigue</p>
            <p className="font-bold tabular-nums">{Math.round(last.atl)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted">Fraîcheur</p>
            <p className="font-bold tabular-nums">{Math.round(last.tsb)}</p>
          </div>
        </div>
      )}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={dm} {...axis} minTickGap={28} />
            <YAxis {...axis} width={40} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Tooltip {...tip} labelFormatter={(d) => dm(String(d))} formatter={(v, n) => [v, items.find((i) => i.key === n)?.label ?? n]} />
            {!hidden.has("tsb") && <Area type="monotone" dataKey="tsb" fill="#8b8a83" fillOpacity={0.25} stroke="#8b8a83" strokeWidth={1} isAnimationActive={false} />}
            {!hidden.has("ctl") && <Line type="monotone" dataKey="ctl" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />}
            {!hidden.has("atl") && <Line type="monotone" dataKey="atl" stroke={SERIES[1]} strokeWidth={2} dot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {state && <b className="text-text-2">Aujourd&apos;hui : {state}. </b>}
        Modèle de Banister appliqué au TRIMP (course + ballon). Une tendance, pas une prédiction.
      </p>
    </div>
  );
}

// ─── Zones cardio par semaine ─────────────────────────────────────────

const ZONE_COLORS = ["var(--z1)", "var(--z2)", "var(--z3)", "var(--z4)", "var(--z5)"];

export function ZoneWeeks({ weeks }: { weeks: { label: string; z1: number; z2: number; z3: number; z4: number; z5: number }[] }) {
  const [hidden, toggle] = useHidden();
  const items = ["z1", "z2", "z3", "z4", "z5"].map((k, i) => ({ key: k, label: `Z${i + 1}`, color: ZONE_COLORS[i] }));
  return (
    <div>
      <Toggles items={items} hidden={hidden} onToggle={toggle} />
      <div className="mt-2 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" {...axis} minTickGap={16} />
            <YAxis {...axis} width={40} />
            <Tooltip {...tip} cursor={{ fill: "var(--surface-2)" }} formatter={(v, n) => [`${v} min`, String(n).toUpperCase()]} />
            {items
              .filter((it) => !hidden.has(it.key))
              .map((it, i, arr) => (
                <Bar key={it.key} dataKey={it.key} stackId="z" fill={it.color} stroke="var(--surface)" strokeWidth={1} radius={i === arr.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={26} isAnimationActive={false} />
              ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-muted">Minutes par zone et par semaine. Cible en base : ≥ 80 % en Z1-Z2 (Seiler 2010).</p>
    </div>
  );
}

// ─── Série temporelle simple avec période et zoom ─────────────────────

export function TimeSeries({ data, unit, color, label }: { data: { date: string; value: number; info?: string }[]; unit: string; color: string; label: string }) {
  const [range, setRange] = useState<RangeKey>("Tout");
  const series = useMemo(() => data.filter((p) => p.date >= cutoff(range, data.at(-1)?.date)), [data, range]);
  if (data.length < 2) return <p className="py-6 text-center text-sm text-muted">Pas encore assez de données.</p>;
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Segmented options={["1M", "3M", "6M", "Tout"] as const} value={range} onChange={setRange} size="xs" />
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={dm} {...axis} minTickGap={24} />
            <YAxis {...axis} width={44} domain={["auto", "auto"]} />
            <Tooltip {...tip} labelFormatter={(d) => dm(String(d))} formatter={(v, _n, item) => [`${v} ${unit}${(item.payload as { info?: string }).info ? ` · ${(item.payload as { info?: string }).info}` : ""}`, label]} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3.5, fill: color, stroke: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
            {series.length > 10 && <Brush dataKey="date" height={18} travellerWidth={8} stroke="var(--muted)" fill="var(--surface-2)" tickFormatter={dm} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
