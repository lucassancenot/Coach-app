"use client";
import { useState, useTransition } from "react";
import { syncNow } from "@/app/actions";

export default function SyncButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end">
      <button
        className="btn !py-2 text-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await syncNow();
            setMsg(r.error ?? (r.created ? `${r.created} nouvelle(s) activité(s)` : "À jour"));
          })
        }
      >
        {pending ? "Synchro…" : "↻ Strava"}
      </button>
      {msg && <span className="mt-1 text-[11px] text-muted">{msg}</span>}
    </div>
  );
}
