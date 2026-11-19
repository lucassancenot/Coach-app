"use client";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { clearChat, sendChat } from "@/app/actions";

interface Msg {
  id: number;
  role: string;
  content: string;
}

const SUGGESTIONS = [
  "Fais le bilan de ma semaine.",
  "Je suis fatigué aujourd'hui, j'adapte comment ?",
  "Mes footings sont-ils vraiment en Z2 ?",
  "Comment je gère ma première semaine à Singapour ?",
];

export default function Chat({ initial, enabled }: { initial: Msg[]; enabled: boolean }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [messages, addOptimistic] = useOptimistic(initial, (state, m: Msg) => [...state, m]);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending]);

  const send = (msg: string) => {
    if (!msg.trim() || pending) return;
    setError(null);
    setText("");
    start(async () => {
      addOptimistic({ id: -Date.now(), role: "user", content: msg });
      const r = await sendChat(msg);
      if (r.error) {
        setError(r.error);
        setText(msg);
      }
    });
  };

  if (!enabled)
    return (
      <div className="card text-sm text-text-2">
        Le chat du coach s&apos;active dès que la clé <code>ANTHROPIC_API_KEY</code> est configurée. Les alertes automatiques, elles, fonctionnent déjà.
      </div>
    );

  return (
    <div>
      <div className="space-y-3">
        {messages.length === 0 && (
          <div className="card text-sm text-text-2">
            <p>Je connais ton plan, tes courses Strava et tes séances. Pose-moi une question précise.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="rounded-full bg-surface-2 px-3 py-1.5 text-xs text-text" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-run text-white" : "border border-border bg-surface text-text"}`}>{m.content}</div>
          </div>
        ))}
        {pending && <p className="text-sm text-muted">Le coach analyse tes données…</p>}
        {error && <p className="text-sm text-stop">{error}</p>}
        <div ref={bottom} />
      </div>
      <form
        className="sticky bottom-24 mt-4 flex gap-2 rounded-2xl border border-border bg-bg p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input className="input !border-0 !bg-transparent" placeholder="Ta question…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary !px-4" disabled={pending || !text.trim()}>
          ↑
        </button>
      </form>
      {messages.length > 0 && (
        <form action={clearChat} className="mt-2 text-right">
          <button className="text-xs text-muted underline">Nouvelle conversation</button>
        </form>
      )}
    </div>
  );
}
