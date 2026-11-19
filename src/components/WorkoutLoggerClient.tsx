"use client";
import dynamic from "next/dynamic";

// Rendu côté navigateur uniquement (lecture du brouillon dans localStorage).
const WorkoutLoggerClient = dynamic(() => import("./WorkoutLogger"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted">Chargement…</p>,
});

export default WorkoutLoggerClient;
