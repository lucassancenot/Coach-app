import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Un seul athlète (toi). Stocke aussi les jetons Strava et les réglages.
export const athlete = sqliteTable("athlete", {
  id: integer("id").primaryKey(), // ID athlète Strava (0 en mode démo)
  name: text("name").notNull().default("Athlète"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at"), // epoch secondes
  hrMax: integer("hr_max").notNull().default(193),
  hrRest: integer("hr_rest").notNull().default(55),
  vift: real("vift"), // vitesse finale 30-15 IFT en km/h
  unit: text("unit").notNull().default("kg"), // unité d'affichage des charges : "kg" | "lb"
  lastSyncAt: integer("last_sync_at"),
});

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey(), // ID activité Strava
  startDate: text("start_date").notNull(), // ISO, heure locale
  type: text("type").notNull(), // Run, Ride, Soccer, ...
  name: text("name").notNull(),
  distance: real("distance").notNull().default(0), // m
  movingTime: integer("moving_time").notNull().default(0), // s
  elevationGain: real("elevation_gain").default(0),
  avgHr: real("avg_hr"),
  maxHr: real("max_hr"),
  avgSpeed: real("avg_speed"), // m/s
  avgCadence: real("avg_cadence"),
  zoneSeconds: text("zone_seconds"), // JSON [z1..z5] en secondes
  decoupling: real("decoupling"), // % dérive Pa:HR (null si non pertinent)
  trimp: real("trimp"), // TRIMP d'Edwards
  coachNote: text("coach_note"),
});

export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // "Upper A"
  // JSON: [{ exercise, sets, repsMin, repsMax, note? }]
  items: text("items").notNull(),
  position: integer("position").notNull().default(0),
});

export const workouts = sqliteTable("workouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  templateName: text("template_name"),
  durationMin: integer("duration_min"),
  sessionRpe: real("session_rpe"), // RPE de séance (Foster)
  notes: text("notes"),
  coachNote: text("coach_note"),
});

export const sets = sqliteTable("sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workoutId: integer("workout_id").notNull(),
  exercise: text("exercise").notNull(),
  setIndex: integer("set_index").notNull(),
  weight: real("weight").notNull(), // kg (lest pour les tractions)
  reps: integer("reps").notNull(),
  rir: real("rir"), // répétitions en réserve
});

export const tests = sqliteTable("tests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  type: text("type").notNull(), // "30-15 IFT"
  value: real("value").notNull(),
});

export const alerts = sqliteTable("alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(), // déduplication
  createdAt: text("created_at").notNull(),
  severity: text("severity").notNull(), // "info" | "warn" | "stop"
  title: text("title").notNull(),
  message: text("message").notNull(),
  dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});
