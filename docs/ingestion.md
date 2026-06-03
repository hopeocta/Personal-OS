# Dokument-Ingestion (`_Eingang/` & Telegram-Uploads)

Ziel: Dokumente landen **automatisch sortiert** in Obsidian (Original) **und** durchsuchbar in
Supabase (Text + Embedding). Zwei Eingangskanäle, dieselbe Idee.

| Kanal | Transport | Original landet | Status |
|---|---|---|---|
| 📁 **`_Eingang/`** (PC) | lokaler Agent (`eingang-ingest.mjs`) | **direkt** in Obsidian-Unterordner | ✅ gebaut |
| 📱 **Telegram** (Handy) | Vercel → Supabase Storage (Puffer) → lokaler Agent | Obsidian, sobald PC online | 🟡 Storage-Sync folgt |

---

## `_Eingang/` — Datei vom PC reinlegen

**So nutzt du es:** Eine Datei in `D:\Obsidian Vault\_Eingang\` legen. Beim nächsten Agent-Lauf
(automatisch über den Scheduler, oder manuell) passiert pro Datei:

1. **Text extrahieren** — PDF via `pdf-parse`, Textdatei direkt, Bild/Scan via Claude Vision.
2. **Claude Haiku klassifiziert** (~0,2 Cent) → `{ area, category, title, summary, tags }`.
3. **Original** wandert in den passenden Obsidian-Unterordner (siehe Mapping unten) +
   eine Index-Notiz (`.md`) mit Frontmatter + Zusammenfassung + Einbettung (`![[…]]`).
4. **Text + OpenAI-Embedding** → Supabase `knowledge_entries` (`source: 'eingang'`) → **RAG-suchbar**.
5. **Original wird aus `_Eingang/` entfernt** (nach erfolgreichem Schreiben).

Unterstützte Typen: `.pdf`, `.txt`, `.md`, `.jpg/.jpeg/.png/.webp`.

### Bereich → Obsidian-Ordner

| `area` | Ziel-Ordner | knowledge_entries.category |
|---|---|---|
| `gesundheit` | `Gesundheit/Dokumente/` | `Gesundheit` |
| `verwaltung` | `Verwaltung/<Kategorie>/` | `Verwaltung` |
| `literatur` (medizinisch) | `Literatur/Medizin/` | Fach (z.B. Zahnmedizin) |
| `literatur` (sonst) | `Literatur/Allgemein/` | Kategorie |
| `recherche` Zahnmedizin | `Zahnmedizin/` | `Zahnmedizin` |
| `recherche` Musik | `Musik/` | Musik-Kategorie |
| `recherche` Triathlon/Kraft/Ernährung | `Gesundheit/Recherche/` | Kategorie |
| `recherche` sonst | `Recherche/` | `Allgemein` |

### Aufruf

```
node scripts/eingang-ingest.mjs            # alles in _Eingang verarbeiten
node scripts/eingang-ingest.mjs --dry-run  # nur klassifizieren + Plan zeigen
node scripts/eingang-ingest.mjs --keep     # Original NICHT löschen (zum Testen)
node scripts/eingang-ingest.mjs --vault "D:\Obsidian Vault"
```

Läuft automatisch als Teil des Auto-Agenten (`sync-all.mjs`) → [garmin-sync.md](garmin-sync.md#der-scheduler-windows-aufgabenplanung).

---

## Telegram-Uploads (Foto/PDF)

Beim Upload über Telegram (siehe [telegram-bot.md](telegram-bot.md#dokument-upload-foto--pdf)):
- Claude liest den Befund, extrahiert Werte → `health_labs`, Original → **Supabase Storage** (`documents`-Bucket).
- Der **direkte** Obsidian-Write aus Vercel scheitert in Produktion (localhost unerreichbar).

**Implementiert:** `scripts/storage-obsidian-sync.mjs` — listet den `documents`-Bucket,
lädt neue Dateien herunter, schreibt Original + Index-`.md`-Notiz in den Vault.
Idempotent: bereits vorhandene Dateien werden übersprungen.
Läuft automatisch als Schritt 3 in `sync-all.mjs`.

---

## Noch offen in Phase 6

| Teil | Status |
|---|---|
| `_Eingang/` → Obsidian + Supabase | ✅ gebaut |
| Telegram-Storage → Obsidian-Spiegelung | ✅ gebaut (`storage-obsidian-sync.mjs`) |
| Obsidian → Supabase-Watcher (manuell geschriebene `.md` indexieren) | ⏳ nächster Schritt |
