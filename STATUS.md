Zuletzt abgeschlossen: Abend 9 — Telegram Bot komplett (Voice + Notizen + Einkaufsliste)
Nächster Schritt: Abend 10 — Analyse-Seite (Korrelationen + Einkaufsliste via Claude Sonnet)
Datum: 2026-05-24
Offene Punkte: keine — alles deployed und getestet

Was gebaut wurde (Abend 9):
- lib/knowledge.ts: geteilte saveKnowledgeEntry() — kein HTTP Self-Call mehr
- lib/knowledge.ts: saveNoteEntry() mit NOTE_CATEGORIES:
  Training-relevant / Soziales / Arbeit-Uni / Recherche / Projekte
  Schreibt nach Obsidian: Tagebuch/{YYYY-MM-DD}-{slug}.md
- app/api/knowledge/route.ts: auf geteilte Funktion umgestellt
- app/api/telegram/webhook/route.ts: vollständiger Bot mit 7 Buttons:
  🏃 Training → strength_sessions (intensity=2)
  🎵 Musik → music_projects (status=idea)
  📚 Lernen → knowledge_entries (category=Zahnmedizin)
  💡 Idee → knowledge_entries (Claude kategorisiert frei)
  🍎 Essen → nutrition_logs (notes, Makros manuell im Dashboard)
  📝 Notiz → saveNoteEntry() → 5 Unterkategorien, Obsidian Tagebuch/
  🛒 Einkauf → knowledge_entries (source=einkauf) + Obsidian Einkauf-Anschaffungen/Aktuelle-Liste.md
- /liste Befehl → zeigt Einkaufsliste mit ✅-Button pro Artikel (live-update beim Abhaken)
- app/api/telegram/digest/route.ts: Tages- und Wochen-Digest
  - type=daily: alle telegram_notes → Claude Haiku → Bullet-Summary → Telegram + Obsidian Tagebuch/Zusammenfassungen/
  - type=weekly: alle Wochen-Digests → Weekly Summary → Telegram + Obsidian Tagebuch/Wochen/
- vercel.json: 3 Crons:
  - Garmin Sync: täglich 05:00 UTC
  - Tages-Digest: täglich 21:50 UTC (= 23:50 Berlin CEST)
  - Wochen-Digest: Sonntag 21:55 UTC (= 23:55 Berlin CEST)

Env Vars alle in Vercel eingetragen:
  ANTHROPIC_API_KEY, OPENAI_API_KEY, TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET, TELEGRAM_USER_ID

Diskutiert (noch nicht gebaut):
- Abend 10: Analyse-Seite (Korrelationen Schlaf/Training/Ernährung via Claude Sonnet + Einkaufsliste)
- Abend 11 (revidiert): MCP-Setup — Supabase MCP + Obsidian MCP für Claude Desktop App
  → Digest-Dateien automatisch zugänglich ohne manuellen Upload
