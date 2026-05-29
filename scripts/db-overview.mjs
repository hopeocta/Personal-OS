import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tables = [
  "knowledge_entries",
  "music_projects",
  "sound_library",
  "strength_sessions",
  "nutrition_logs",
  "daily_habits",
  "garmin_activities",
  "garmin_sleep",
  "garmin_body_battery",
];

console.log("\n=== Zeilen pro Tabelle ===");
for (const t of tables) {
  const { count, error } = await sb
    .from(t)
    .select("*", { count: "exact", head: true });
  console.log(`${t.padEnd(22)} ${error ? "FEHLER: " + error.message : count}`);
}

console.log("\n=== knowledge_entries nach Kategorie ===");
const { data, error } = await sb
  .from("knowledge_entries")
  .select("category, source, raw_text");
if (error) {
  console.log("FEHLER:", error.message);
} else {
  const byCat = {};
  const bySource = {};
  let totalChars = 0;
  for (const row of data) {
    const c = row.category || "(keine)";
    const s = row.source || "(keine)";
    byCat[c] = (byCat[c] || 0) + 1;
    bySource[s] = (bySource[s] || 0) + 1;
    totalChars += (row.raw_text || "").length;
  }
  for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(20)} ${v}`);
  console.log("\n=== nach Quelle (source) ===");
  for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(20)} ${v}`);
  console.log(
    `\nGesamt-Text: ~${Math.round(totalChars / 1000)}k Zeichen (~${Math.round(
      totalChars / 5
    )} Wörter)`
  );
}
