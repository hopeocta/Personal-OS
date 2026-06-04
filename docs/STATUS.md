# Personal OS — Status

> Hier steht: was funktioniert, was geplant ist, was manuell zu tun ist.
> Details zu jedem Feature → `docs/` Ordner. Gesamtübersicht → [README.md](README.md)

---

## 🔄 Letzter Session-Log

| Datum | Was |
|---|---|
| 04.06.2026 | Audit: 3 Bugs gefixt (Cron-Auth, TELEGRAM_USER_ID, writeObsidianFile) |
| 04.06.2026 | healthReview Phase 1+2+4: Laktattest, SER/Ernährung/Habits, Prüfungswochen |
| 04.06.2026 | healthReview Phase 3: Reviews auf /analyse, Run-Button |
| 04.06.2026 | Vokabeln Phase 5: Unique-Constraint, bidirektional (IT↔DE), /stopp-Befehl |
| 04.06.2026 | Vokabeln: Lernsession in Supabase (überlebt Cold Starts), Tages-Limit 30 |
| 04.06.2026 | Python-Ebene + Revolut + Zahnarzt-Bürokratie geplant → docs/roadmap.md |
| 04.06.2026 | Fix: vercel.json — comment-Felder aus crons entfernt |
| 04.06.2026 | Python-Ebene Schritt 1–4: Migration 0010, analysis/revolut/sync.py, /finanzen Dashboard, Telegram-Cron |
| 04.06.2026 | Python-Ebene Schritt 5–6: scipy Korrelationen + Trends, Korrelations-Block auf /analyse |
| 04.06.2026 | Schritt 7 vorbereitet: Enable Banking Account erstellt (GoCardless seit 07/2025 geschlossen) |
| 04.06.2026 | Schritt 7: Enable Banking Client + setup_oauth.py + auto_sync.py implementiert |
| 04.06.2026 | Vokabeln: IT→DE Tags in DB nachgepflegt, upsert ignoreDuplicates, 50/50 Mix in getDueCards |
| 04.06.2026 | Vokabeln: seed-Script prüft IT→DE und DE→IT separat, fehlende Richtung ohne Claude-Call ergänzt |
| 05.06.2026 | Revolut CSV-Import via Telegram: MIME-Fix, 64-Byte-Callback-Fix, xlsx dynamisch |
| 05.06.2026 | Enable Banking: /privacy + /terms Seiten, ngrok-Setup, setup_oauth.py angepasst |
| 05.06.2026 | Dokument-Pipeline: Foto→PDF (sharp+pdf-lib), extFromMime vollständig, Obsidian bekommt PDF+MD |
| 05.06.2026 | Scripts: supabase-to-obsidian.mjs (Supabase→Vault Sync), eingang-ingest ONLOGON-Task |
| 05.06.2026 | dotenv-"Bug" diagnostiziert: kein Paketproblem, sondern WindowsApps-Stub-python. Fix: alle Python-Scripts mit `py -3.14`, Stub abschalten. Copy-Hack aus STATUS gestrichen |
| 05.06.2026 | **Revolut-Verbindung steht** (Enable Banking, Production/Restricted). Bugs gefixt: JWT iss/aud, /auth statt /sessions, access.valid_until, redirect_url, IPv4-Bind, UTF-8-Konsole. Session AUTHORIZED, Live-Abruf bestätigt (5 Tx/7d) |
| 05.06.2026 | Revolut: normalize_transaction an echtes EB-Format angepasst (remittance_information[list], credit_debit_indicator→+/-, verschachtelte creditor/debtor), Pagination via continuation_key, UTF-8 in auto_sync. Backfill 90 Tage → 91 Tx auf /finanzen |

---

## ❗ Manuelle Schritte ausstehend

- [ ] **Vokabel-Seed neu laufen lassen**: `npx tsx scripts/seed-italian-vocab.ts` — erstellt jetzt IT→DE + DE→IT Karten für alle Topics (bereits vorhandene werden übersprungen)
- [x] **Supabase-Migration 0010 angewendet** ✅
- [x] **Python-Dependencies installiert** (anthropic, supabase, scipy, numpy) ✅
- [ ] **Revolut CSV-Backfill**: CSV per Telegram schicken → "💰 Revolut Import" — oder lokal: `py -3.14 analysis/revolut/sync.py <pfad>.csv`
- [ ] **Korrelationen berechnen**: `py -3.14 analysis/health/correlations.py` — erscheint dann auf /analyse
- [x] **Enable Banking registriert + aktiviert** ✅ App "Personal OS" (Production/Restricted, via "Activate by linking accounts"). Keys in `.env.local`: `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_PRIVATE_KEY` (Pfad zur `.pem` im Root, gitignored), `ENABLE_BANKING_REDIRECT_URI`
- [x] ~~dotenv-Fix (Copy-Item-Hack)~~ — **entfällt**: dotenv ist im User-Site installiert und wird von `C:\Python314\python.exe` automatisch gefunden. Der Fehler kam vom WindowsApps-Store-Stub-`python` (leere Attrappe), nicht von einem fehlenden Paket. Lösung: Scripts immer mit `py -3.14` starten (siehe unten).
- [ ] **Store-Python-Stub abschalten** (einmalig, beendet die PATH-Falle dauerhaft): Einstellungen → Apps → Erweiterte App-Einstellungen → App-Ausführungsaliase → `python.exe` und `python3.exe` AUS. Danach trifft auch nacktes `python` immer das echte 3.14.
- [x] **OAuth-Setup durchgeführt** ✅ `SESSION_ID` + `ACCOUNT_ID` (Konto „Christoph Hoffmann" EUR) in `.env.local`. Session AUTHORIZED, gültig **90 Tage**.
  - **Re-Auth, wenn Session abläuft** (alle ~90 Tage): 1) ngrok-Tunnel starten — `& "C:\Users\Administrator\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe" http --url=https://overdress-starch-gently.ngrok-free.dev 127.0.0.1:8080` ; 2) in 2. Terminal `py -3.14 analysis/revolut/setup_oauth.py` ; 3) Revolut-Login. Schreibt SESSION_ID/ACCOUNT_ID neu.
- [x] **Erster Sync (Backfill) erledigt** ✅ 91 Transaktionen (10.03.–04.06.) in `revolut_transactions`, 18 Monats-Summaries, sichtbar auf `/finanzen`. Wiederholen/erweitern: `py -3.14 analysis/revolut/auto_sync.py --days N`
- [ ] **Täglicher Auto-Sync einrichten** (optional): `analysis/revolut/auto_sync.py` (default 8 Tage) per Windows Task Scheduler täglich laufen lassen — Aufruf `py -3.14 analysis\revolut\auto_sync.py`. Hält `/finanzen` automatisch aktuell.
- [ ] **Windows Task Scheduler — Eingang-Ingest**: Admin-PowerShell → `schtasks /create /tn "Eingang-Ingest" /xml "C:\Users\Administrator\Documents\Claude\Personal OS\scripts\eingang-ingest-task.xml" /f`
- [ ] **Obsidian Autostart**: Obsidian-Verknüpfung in `shell:startup` legen

---

## ✅ Was funktioniert (muss immer laufen)

### 📱 Telegram Bot → [telegram-bot.md](telegram-bot.md)
- Text schicken → Kategorie wählen (Training, Musik, Lernen, Plan, Notiz, Einkauf, Kalender, Frage)
- Foto / PDF / Word / Excel / TXT hochladen → Gesundheit oder Verwaltung
- Sprachnotiz → Whisper → selbe Pipeline
- `/lernen` → max. 30 Karten/Tag (Wiederholungen zuerst, dann neue), `/antwort`, `/stopp`, `/liste`, `/hol`
- Session überlebt Vercel Cold Starts (in Supabase gespeichert)
- Bidirektional: 🇮🇹→🇩🇪 und 🇩🇪→🇮🇹 je nach Karte
- Automatische Nachrichten: Briefing 06:00, Digest 21:50, Vokabel-Reminder 07:00, Newsletter Mo, Gesundheitsanalysen

### ⌚ Garmin → [garmin-sync.md](garmin-sync.md)
- Täglicher Cron 05:00 UTC → `garmin_activities`, `garmin_sleep`, `garmin_body_battery`, `garmin_training`
- Backfill-Scripts für Lücken (lokal)

### 📊 Analyse → [dashboard.md](dashboard.md)
- `/analyse`: Ad-hoc 4/8/12/52 Wochen, Streaming, Wochenampel, Kalender-Korrelation
- Block „Letzte Reviews" mit Obsidian-Pfad + Button „Monatsbericht jetzt"
- Automatische Periodenberichte: monatlich (1.), halbjährlich (1.Jan/Jul), jährlich (1.Jan)
  → Laktattest, SER, Ernährung, Habits, Prüfungswochen, ACWR+HRV-Cluster im Report
- Parameter editierbar in Obsidian: `Gesundheit & Training/analyse-parameter.md`

### 🧠 RAG / Wissen → [rag-system.md](rag-system.md)
- Semantische Suche (Embeddings) + SQL-Abfragen (Garmin/Ernährung)
- Via Telegram Frage-Button oder `/terminal` im Dashboard

### 📥 Dokument-Ingest → [ingestion.md](ingestion.md)
- `_Eingang/` Ordner (PC) + Telegram-Upload → Obsidian + Supabase (RAG)

### 📚 Vokabeltrainer (Italienisch)
- SM-2 Spaced Repetition, max. 30 Karten/Tag, Wiederholungen vor neuen Karten
- Bidirektional IT↔DE, Session in Supabase, `/lernen` `/antwort` `/stopp`
- Seed: `scripts/seed-italian-vocab.ts` (IT→DE + DE→IT, Skip wenn schon vorhanden)

### 📰 Newsletter / Literatur
- Wöchentlich Mo 07:00: PubMed-Zahnmedizin → Telegram
- Monatlich 1.: Literatur-Rückblick → Telegram

---

## 🗺️ Geplant → [roadmap.md](roadmap.md)

### Nächste Priorität: /finanzen Dashboard fertigstellen
- Monatsvergleich (Balkendiagramm oder Tabelle mehrerer Monate)
- Einnahmen vs. Ausgaben Saldo pro Monat
- Top-Kategorien Trend über Zeit
- Manueller Sync-Button im Dashboard (ruft auto_sync.py oder CSV-Import auf)

### Schritt 7 — Enable Banking Auto-Sync
- ✅ Schritt 1: Migration 0010
- ✅ Schritt 2: `analysis/revolut/sync.py` (CSV-Fallback)
- ✅ Schritt 3: Dashboard `/finanzen`
- ✅ Schritt 4: Telegram Monats-Cron
- ✅ Schritt 5: `analysis/health/correlations.py` (scipy)
- ✅ Schritt 6: Korrelations-Block auf `/analyse`
- [x] Schritt 7: Enable Banking OAuth → automatischer Revolut-Sync (implementiert, API-Keys + OAuth-Setup noch manuell)

Vollständiger Plan: [roadmap.md](roadmap.md)
