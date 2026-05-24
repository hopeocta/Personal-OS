Zuletzt abgeschlossen: Abend 9 — Telegram Bot (Voice Capture + Notiz-System)
Nächster Schritt: Abend 10 — Analyse-Seite (Korrelationen + Einkaufsliste)
Datum: 2026-05-24
Offene Punkte: keine — Webhook ist registriert, alle Env Vars in Vercel eingetragen

Was gebaut wurde (Abend 9):
- lib/knowledge.ts: geteilte saveKnowledgeEntry() — kein HTTP Self-Call mehr
- app/api/knowledge/route.ts: auf geteilte Funktion umgestellt
- app/api/telegram/webhook/route.ts: vollständiger Bot
  - Voice → Whisper-Transkription (OpenAI) → Inline-Keyboard
  - Text → sofort Inline-Keyboard
  - 6 Buttons: 🏃 Training / 🎵 Musik / 📚 Lernen / 💡 Idee / 🍎 Essen / 📝 Notiz
  - Training → strength_sessions (intensity=2, notes)
  - Musik → music_projects (status=idea, title=erste 50 Zeichen)
  - Lernen → knowledge_entries (category=Zahnmedizin)
  - Idee → knowledge_entries (Claude kategorisiert frei)
  - Essen → nutrition_logs (notes, Makros manuell im Dashboard)
  - Notiz → saveNoteEntry() → kategorisiert in 5 Unterkategorien
- lib/knowledge.ts: saveNoteEntry() mit NOTE_CATEGORIES:
  Training-relevant / Soziales / Arbeit-Uni / Recherche / Projekte
  Schreibt nach Obsidian: Tagebuch/{YYYY-MM-DD}-{slug}.md
- app/api/telegram/digest/route.ts: GET+POST Handler
  - type=daily: alle heutigen telegram_notes → Claude Haiku → Bullet-Summary
    → knowledge_entries (source=daily_digest) + Obsidian Tagebuch/Zusammenfassungen/
    → per Telegram gesendet
  - type=weekly: alle Wochen-Digests → Claude Haiku → Weekly Summary
    → knowledge_entries (source=weekly_digest) + Obsidian Tagebuch/Wochen/
    → per Telegram gesendet
- vercel.json: 3 Crons:
  - Garmin Sync: täglich 05:00 UTC
  - Tages-Digest: täglich 21:50 UTC (= 23:50 Berlin CEST)
  - Wochen-Digest: Sonntag 21:55 UTC (= 23:55 Berlin CEST)

Diskutiert (noch nicht gebaut):
- Abend 10: Analyse-Seite (Korrelationen Schlaf/Training/Ernährung via Claude Sonnet)
- Abend 11 (revidiert): MCP-Setup — Supabase MCP + Obsidian MCP für Claude Desktop App
  → Digest-Dateien automatisch zugänglich ohne manuellen Upload
