Zuletzt abgeschlossen: Terminal — Dashboard-native Claude Chat mit Skills + Lernfach-Kontext
Nächster Schritt: Skill-Dateien einfügen + PDF-Pipeline (scripts/pdf-to-knowledge.mjs)
Datum: 2026-05-24

Was heute gemacht wurde:
- app/terminal/page.tsx: Claude-Chat-UI (Sonnet Streaming)
  - Skill-Selector: Lernpartner / Session Ende (System-Prompt-Erweiterung)
  - Lernfach-Selector: lädt alle knowledge_entries der Kategorie in den Kontext (wie Claude Projects)
  - Dokument-Badge: zeigt Anzahl geladener Dokumente
  - 🎤 Audio-Recorder: MediaRecorder → Whisper → Text im Eingabefeld
  - Token-Counter: cache-read / cache-write / output nach jeder Antwort
  - "Sitzung speichern" → POST /api/knowledge → erscheint in /wissen
  - Streaming mit AbortController (Abbrechen-Button)
- app/api/chat/route.ts: Claude Sonnet Streaming API
  - Prompt Caching: 3 System-Blocks mit cache_control ephemeral
  - Lernfach-Dokumente: SELECT aus knowledge_entries (max 50), gecacht pro Session
  - Usage-Metadaten: als letzter Stream-Chunk (null-byte separator)
- app/api/transcribe/route.ts: OpenAI Whisper Transkription (language: de)
- lib/config/skills.ts: Skill-Config-Placeholder (Inhalt noch einfügen)
- components/dashboard/TopRail.tsx: TERMINAL Tab
- CLAUDE.md: "Never make assumptions" als Pet Peeve

Offene Punkte (manuelle Schritte):
1. lib/config/skills.ts öffnen → Inhalt aus lernpartner_skill.md + session_ende_skill.md einfügen
2. Nächste Session: scripts/pdf-to-knowledge.mjs bauen (lokales Node-Script, postet PDFs → /api/knowledge)
3. Dashboard auf Vercel deployen (git push origin master)
