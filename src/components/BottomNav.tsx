"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Aujourd'hui", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/course", label: "Course", icon: "M13 4a2 2 0 110 4 2 2 0 010-4zM7 21l3-6 3 2v5M10 15l1-5 4 3 3-1M8 10l3-2" },
  { href: "/salle", label: "Salle", icon: "M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12" },
  { href: "/coach", label: "Coach", icon: "M4 5h16v11H8l-4 4V5z" },
];

export default function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium ${active ? "text-text" : "text-muted"}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
