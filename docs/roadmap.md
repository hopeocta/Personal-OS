# Roadmap — Personal OS

Stand: 21.06.2026

> Oben steht, was noch offen ist. Erledigtes ist unten archiviert (✅).
> Wird bei jedem Session-Ende gegen den Session-Log in `STATUS.md` abgeglichen.

---

## 🔜 Offen

### ⏭️ Direkt für die nächste Session

**Offene Schritte:**
- [x] **PR #2 gemergt** ✅ (21.06.2026)
- [x] **Migrationen 0017–0020 angewendet** ✅ via Supabase MCP (21.06.2026)
- [ ] **Runna-iCal in Vercel-Produktion verifizieren** — aus der Build-Umgebung nicht erreichbar (Garmin-Allowlist). Nach Deploy `/p/p1` öffnen und prüfen, ob Utes Runna-Läufe als RUNNA-Badge erscheinen.

**Nächste Session: TrainingPeaks MCP für zweiten Athleten**
- Athlet schickt: Option A (TP-Login E-Mail+Passwort) oder Option B (Cookie `Production_tpAuth` aus Chrome DevTools)
- MCP installieren: https://github.com/JamsusMaximus/trainingpeaks-mcp
- Historik ziehen → Supabase (`tp_activities`) → Analyse → Plan → PWA `/p/pX`

**Noch zu bauen (aus dieser Session offen geblieben):**
- [ ] **Erlabrunn-Triathlon: exakte Distanzen** statt Schätzung. Lokal laufen lassen:
  `node scripts/garmin-activity-hr.mjs 23246687349 --person p1`
  → aus dem Tempo-Stream die Wechselzonen (Geschwindigkeitssprünge) erkennen → echte Swim/Bike/Run-Distanzen berechnen → `triathlon_races` updaten. (User: „nicht schätzen, Wechsel erkennbar".)
- [ ] **4-Wochen-Compliance-Review (Ute)**: erledigte Einheiten erfassen, Ist-HF vs. Ziel-Zonen vergleichen, nach 4 Wochen Anpassungs-Empfehlungen generieren. Erste sinnvolle Auswertung ~19.07. Basis dafür (Athleten-Profil in `persons`) liegt bereits.
- [ ] **Garmin-Workout-Versand (zurückgestellt)** — User: „erstmal nicht". Optionale Einheiten/Plan an Garmin pushen liegt auf Eis.

### 🏊 Athleten-PWA — Multi-Person Trainingsplan (19.06.2026, in Arbeit)

3 Personen als read-only Handy-Dashboards (PWA) + täglicher Garmin-Sync + Analyse + Plan-Generierung.
Trainings-Methodik aus 3-Linsen-Recherche festgezurrt (pyramidal für 60J/5-7h, polarisiert ab 10h, Masters max. 2 Intensiveinheiten/Woche, LTHR/FTP/CSS-Zonen aus Feldtests).

- ✅ Phase 1: DB-Migration 0016 (persons-Tabelle, Garmin-Unique-Keys, intensity_kind)
- ✅ Phase 2: Garmin-Client + Sync-Cron person-aware, Setup-Script
- ✅ Backfill-Infrastruktur: `backfill/route.ts` + `backfill-sleep/route.ts` person-aware + volle History (5J Aktivitäten, 4J Schlaf)
- ✅ Ute (p1): Login, Backfill, Garmin-Analyse, 14-Wochen-Plan, PWA live (`/p/p1`)
- ✅ PWA-Ausbau (21.06.): Touch-DnD, Wettkampf-Event + Taper, Outdoor-Alternative, Runna-Integration, Athleten-Profil, Krank-Knopf (3-Tage-Ramp) — alles auf Branch, PR #2 offen
- ⏳ Arthur (p2): Login-Daten ausstehend
- 🔜 Phase 6: Coach-Ansicht `app/coach/*` (Plan anpassen, Drag-and-drop)
- 🔜 Später: Arthur (p2) einrichten + Plan generieren



### 🧹 Audit-Nachlauf — Entscheidungen offen (18.06.2026)
System-Audit durchgeführt + aufgeräumt (toter Code, Sync-Pfade gehärtet, Doku-Drift behoben — s. STATUS 18.06.). **Wartet auf Entscheidung:**
- **`/musik` + `/terminal`-Desktop** — als nicht genutzt eingestuft. Rausnehmen/archivieren oder behalten? (größerer Eingriff als Tot-Code, daher offen gelassen)
- **`daily_habits` / `/api/habits`** — Route ohne Aufrufer, Tabelle aber noch von `healthReview`+`/api/analyse` gelesen (liefert leer). Aufräumen würde Health-Review-Logik berühren.
- **Status-Badges** (Garmin/Revolut/Logbuch „zuletzt synct") — Sync-Frische im Dashboard sichtbar machen statt Vertrauenssache. Fürs Sport-Daten-Vertrauen sinnvoll, Frontend-Arbeit.
- **Fokus ab jetzt:** Triathlon/Sport, bald Zahnarzt-Arbeit, Projekte generell (statt Markt/Musik-Ausbau).

### ✅ Markt-Signale auf Dashboard + Mobile (18.06.2026)
`MarktSignalsCard` (Desktop Center) + `MMarktSignals` (Mobile) — Top Picks KZ/MF/LZ + Avoid-Liste. Aktualisiert sich nach jedem `dailymarket`/`deepmarket`-Run automatisch.

**Optional nächste Schritte:**
- Täglicher Cron der nur `delta_pct` (aktuelle Kurse) aller offenen Signale aktualisiert (~5 API Calls Yahoo Finance)
- `status = 'Closed'` Workflow für abgeschlossene Signale

### ✅ Mobile-App `/m` — fertig (Phasen 1–5, 15.–16.06.2026)

Eigener Handy-Startscreen unter `/m` (kein TopRail, Bottom-Nav, App-Gefühl via „Zum Home-Bildschirm").
Design: warmer Claude-Look + Retro + Hermes-Emblem, Jotform-Klarheit, Whoop-Logik für Fitness
(Schlaf als farbcodierter Score-Ring + Metrik-Kacheln). **3 Tabs:**
- **Heute** — Briefing kompakt: Schlaf/Erholung-Ring, „Heute dran" (fälligkeits-basiert via `/api/tasks`),
  Training (letzte 7 Tage + diese Woche geplant), Rückblick (gelernt/gegessen).
- **Erfassen** — Essen/Notiz per Text **oder Sprachnotiz** (Whisper → `/api/transcribe`), `/api/nutrition` + `/api/knowledge`.
- **Hermes** — Suche über eigene Daten (`/api/ask`); bei Dokument-Treffern „An Telegram senden"
  (neue Route + `lib/telegram.ts`-Refactor aus dem Webhook).

Phasen (alle erledigt): **1** Shell + Designsprache (Masthead, Bottom-Nav, 3 Seiten) ✅ ·
**2** Heute (Schlaf-Ring/Aufgaben/Training/Rückblick) ✅ · **3** Erfassen (Essen/Notiz + Sprache) ✅ ·
**4** Hermes (Suche + „An Telegram senden") ✅ · **5** PWA (Manifest, Hermes-Feder-Icons,
Home-Screen, Handy-Auto-Redirect, fixe Bottom-Nav) ✅.
Offen/optional als Nächstes: Email-Karte in „Heute" (siehe unten), Feinschliff am echten Gerät.

### 📧 Email-Posteingang im Dashboard — geplant (nach Mobile-App)

Recherche-Fazit: verbreitetes Feature (vgl. [Inbox Zero](https://github.com/elie222/inbox-zero), Homelab-Dashboards).
**Kein** voller Email-Client (Gmail/Mail können das besser) — stattdessen drei zugeschnittene Bausteine:
1. **Gefilterter Posteingang** — nur Handlungs-relevante Mails (Uni/LMU, Amt/Verwaltung, Finanzen), read-only Karte.
2. **Antworten via Claude-Entwurf** — Button erzeugt Antwort-Entwurf, User bestätigt/sendet (Gmail-API `gmail.send`/`compose`).
3. **Anhänge auto-ingest** — Mails mit Anhang (Befunde/Rechnungen/Kursscheine) → bestehende `_Eingang`→Wissens-Pipeline.
   Email wird damit 4. Eingangskanal neben Drop-Ordner/Telegram/Terminal.

Technik: Gmail-API + OAuth (Google-Cloud-Projekt, Consent-Screen, Refresh-Token in Supabase/Env, Token-Refresh auf Vercel).
Architektur-Regel beachten: kein Email-Fetch beim Page-Load — eigene API-Route, gecacht.
Auf dem Handy als **Karte in „Heute"** („Posteingang · wichtig"), nicht als 4. Tab.

### ✅ UI-Polish Phase 2 — Karten-Typografie (17.06.2026)

SleepCard: Score 3.5rem Serif bold, Body-Battery-Bar → progress-fill ok/warn/danger.
TrainingCard: Wochentotals 1.6rem bold. NutritionCard: Kalorien-Bar → progress-fill.
TasksCard: 2.25rem Apple-Stack. BriefingCard: Serif + lineHeight 1.75.

### ✅ Literatur — Deutsche Artikel-Aufbereitung + Obsidian-Sync (18.06.2026)

`sections_de` (4 Felder) bereits in Supabase + LiteraturCard Desktop. Neu: Mobile MLiteratur zeigt dieselben Tabs, Obsidian-Write pro Artikel bei Cron-Lauf (Montag 07:00 UTC).

### 00a. AI-Chat im Dashboard — Plan steht (17.06.2026)

Chat-Fenster direkt in `/m/chat` (Mobile-first, Desktop später) mit Drei-Schichten-Memory:
- **Working Memory** — Nachrichten nur im React State, nichts live in DB
- **Episodic Memory** — `chat_sessions` Tabelle: kompakter Summary (~200 Wörter) nach Session-Ende
- **Semantic Memory** — `user_memory` Tabelle: atomare Fakten + pgvector-Embedding

**Phasen:**
1. Chat-Grundgerüst + Streaming + Model-Selector (Claude Sonnet / GLM 5.2 / Haiku) + Compact-Button → `chat_sessions`
2. Memory-System: Auto-Fact-Extraktion → `user_memory`, About-Me hinterlegen, System-Prompt aus Memory zusammengesetzt
3. Daten-Tools: `get_training_data` (Garmin), `search_knowledge` (RAG), `get_today_habits`, `web_search` (Tavily Free)
4. Modi: `general` / `lernpartner` (Skill-Prompt 1:1 übernommen) / `training` (Coach-Prompt + Garmin-Kontext) / `research`
5. Erweitert: Bildgenerierung (CogView/Flux), Telegram-Bridge aus Chat heraus

**Kosten:** GLM Lite ~3-6$/Monat + bestehender Anthropic Key (pay-per-use) + Tavily Free (1000 Req/Monat)
**Wartet auf:** Z.ai API-Key (öffnet KW 25/26, Juni 2026)

### 00. Personal-OS-Plugin (Cowork) — Plan steht
Bestehende Abläufe (Tagesabschluss, Health-Review, Wissen-Sync, Briefing, Krankenblatt, Lernpartner)
als ein Plugin mit Slash-Commands bündeln. Detaillierter 4-Phasen-Plan: [plan-personal-os-plugin.md](plan-personal-os-plugin.md).
Wartet auf Phase-0-Entscheidungen.

### 0. Terminal — Obsidian-Integration Phase 2+3 (nächste Session)

**Phase 2 — Datei-Picker im Terminal:**
- Browse `Literatur/Wissen/` direkt im Terminal (Ordner expandieren, Dateien auswählen)
- Ausgewählte `.md`-Dateien per Obsidian Local API in den Chat-Kontext laden
- Ersetzt den Lernfach-Selektor für gezielte Lern-Sessions

**Phase 3 — Obsidian-Dateien aus Terminal schreiben:**
- Chat-Antwort als neue Notiz in Obsidian speichern (Ordner wählen)
- Bestehende Datei öffnen, editieren, direkt zurückspeichern

---

### 1. `/finanzen` Dashboard fertigstellen

- Monatsvergleich (Balkendiagramm oder Tabelle mehrerer Monate).
- Einnahmen vs. Ausgaben — Saldo pro Monat.
- Top-Kategorien-Trend über Zeit.
- Manueller Sync-Button im Dashboard (ruft `auto_sync.py` oder CSV-Import auf).

**Ziel:** `/finanzen` wird vom reinen Transaktions-Import zur echten Auswertungsseite.

---

### 2. Vokabel-Lernansicht im Dashboard (optional)

- Einfache Ansicht: Übersicht über Decks, Anzahl Karten, Lernfortschritt.
- Aufbauend auf dem stabilen, deduplizierten Seed (IT↔DE).

**Ziel:** Lernfortschritt der Italienisch-Vokabeln auch im Dashboard sichtbar, nicht nur via Telegram.

---

### 3. Zahnarzt-Module — Praxisbürokratie & Abrechnungs-Analytics (später)

Bewusst vertagt bis Famulatur/PJ bzw. Assistenzzeit. Gerüst (Python-Infrastruktur, Supabase-Tabellen, Dashboard-Pattern) entsteht mit den Finanz- und Gesundheitsmodulen; die Zahnarzt-Module sind dann ein weiteres Plugin auf derselben Basis.

#### Kontext

Als angestellter Zahnarzt oder Praxisinhaber in Deutschland: zwei Abrechnungssysteme —
- **BEMA** (Bewertungsmaßstab zahnärztlicher Leistungen) — GKV-Patienten, quartalsweise über die KZV
- **GOZ** (Gebührenordnung für Zahnärzte) — PKV/Selbstzahler, nach Steigerungsfaktor (1,0–3,5fach)

Dazu: Quartalsabrechnung, Hygienedokumentation, Behandlungspläne, Röntgenaufzeichnungen, QM-Pflichten.
Datenquelle: CSV/XML-Export aus der Praxissoftware (Dampsoft, DS-Win, Evident etc.).
Prinzip: **Python verarbeitet → Claude interpretiert → Dashboard/Obsidian zeigt.**

#### Module

**Modul A — GOZ/BEMA Abrechnungs-Analyse**
- Import der Quartalsdaten als CSV.
- Häufigste Leistungsziffern (GOZ/BEMA), Umsatz pro Ziffer, Steigerungsfaktor-Verteilung bei GOZ.
- Ist-Abrechnung vs. theoretisches Potenzial (z.B. GOZ 4 immer 2,3fach obwohl 3,5fach möglich?).
- KZV-Plausibilitätsprüfung: Auffälligkeiten finden, bevor die KZV sie findet.

**Modul B — Recall & Terminauslastung**
- Recall-Rate, No-Show-Analyse (Wochentag/Uhrzeit), Auslastungskurve, Ø-Behandlungszeit pro Leistungsart.

**Modul C — Hygiene & Compliance-Checker**
- Röntgenaufzeichnungen vollständig (Indikation + Befund)? Behandlungspläne unterschrieben?
- DSGVO-Aufbewahrungsfristen, QM-Audits. Output: wöchentlicher Compliance-Report per Telegram.

**Modul D — Monatlicher Praxis-Report (Claude)**
- Python aggregiert KPIs, Claude schreibt Monatsbericht (Umsatz GKV vs. PKV, Top-5 Leistungen, Recall, Ausfälle, 1 Empfehlung). Landet in Obsidian + Telegram.

#### Supabase-Tabellen (geplant)

```sql
-- Abrechnungsdaten (Import aus Praxissoftware)
CREATE TABLE practice_billing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quarter TEXT,              -- '2027-Q1'
  patient_id TEXT,           -- anonymisiert
  system TEXT,               -- 'GOZ' oder 'BEMA'
  ziffer TEXT,               -- Leistungsziffer z.B. '4' (GOZ) oder '01a' (BEMA)
  description TEXT,
  factor NUMERIC,            -- Steigerungsfaktor (nur GOZ)
  amount_eur NUMERIC,
  date DATE
);

-- Recall & Termine
CREATE TABLE practice_appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMPTZ,
  type TEXT,                 -- 'ZE', 'PA', 'KFO', 'Prophylaxe', 'Notfall', ...
  duration_min INT,
  showed_up BOOLEAN,
  patient_type TEXT          -- 'GKV' oder 'PKV'
);

-- Monatliche KPIs (vorberechnet)
CREATE TABLE practice_kpis (
  month TEXT PRIMARY KEY,    -- '2027-03'
  revenue_gkv NUMERIC,
  revenue_goz NUMERIC,
  appointments_total INT,
  no_show_rate NUMERIC,
  recall_rate NUMERIC,
  top_ziffern JSONB,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Verbindung zum bestehenden System

| Bestehend | Neu (Zahnarzt) | Verbindung |
|---|---|---|
| HealthReview (monatlich) | Praxis-Report (monatlich) | Selbes Format, selber Cron-Mechanismus |
| `health_analysis_results` | `practice_kpis` | Selbes Prinzip: Python rechnet, Claude interpretiert |
| Telegram-Digest | Compliance-Report | Selber Telegram-Bot, neue Nachrichtenart |
| Obsidian Gesundheit/ | Obsidian Praxis/ | Selber Vault, neuer Unterordner |

**Wichtig:** Patientendaten kommen **anonymisiert** rein — nur Patient-ID (intern), keine Namen. DSGVO-konform von Anfang an.

#### Wann relevant
- **Ab Famulatur/PJ**: Recall-Analyse und Terminauslastung lassen sich schon üben.
- **Ab Assistenzzeit**: Abrechnungs-Analyse sofort nutzbar (CSV-Export aus Praxissoftware).
- **Praxiseröffnung/-kauf**: Alle Module produktiv.

---

## ✅ Erledigt (Archiv)

> Umgesetzt am 04.–05.06.2026. Details im Session-Log in [`STATUS.md`](STATUS.md).

### Laktattest & Leistungsdiagnostik in HealthReview ✅
Neuesten `health_labs`-Eintrag (Laktattest/Leistungsdiagnostik) zeitraum-unabhängig laden; HFmax, LT1/LT2, FTP, Critical Power extrahieren; im Report ausgeben und Trainingsdaten relativ zu diesen Schwellen auswerten (ergänzend zu Karvonen-HF-Zonen). → healthReview Phase 1.

### SER, Ernährung & Gewohnheiten ins HealthReview ✅
SER (Stress:Erholungs-Ratio) in `lib/healthReview.ts`; Warnlogik (SER > 2, HRV < Baseline ≥ 3 Tage, RHR +5 bpm, Body Battery < 30, ≥ 3 Nächte < 6 h); wöchentliche Kalorien/Protein aus `nutrition_logs`; `daily_habits`-Erfüllungsquoten. → healthReview Phase 2.

### Dashboard `/analyse` mit HealthReview verbinden ✅
`/api/analyse/recent` lädt letzte Reviews (`source LIKE 'health_review_%'`); Block „Letzte Reviews" auf `/analyse` mit Obsidian-Pfad; Button „Monatsbericht jetzt" (`/api/health-review/run`). → healthReview Phase 3.

### Korrelationen im HealthReview verfeinern ✅
ACWR > 1.4 + negativer HRV-Trend als Überlastungs-Cluster; Prüfungswochen (Kalender) × Schlaf × Stress × Trainingsvolumen; `fetchCalendarEvents`/`isExamEvent` wiederverwendet. → healthReview Phase 4.

### Italienisch-Vokabeln — Feinschliff ✅
Unique-Constraint + Deduplizierung (`front` + `deck_id`), bidirektional IT↔DE, Seed prüft beide Richtungen separat und ergänzt fehlende ohne Claude-Call. (Dashboard-Lernansicht → siehe „Offen 2".)

### Python-Analyseebene — Schritt 1–7 ✅
- **1** Migration 0010 (`revolut_transactions`, `expense_summaries`, `health_analysis_results`).
- **2** `analysis/revolut/sync.py` — CSV-Import + Claude-Kategorisierung → Supabase.
- **3** Dashboard `/finanzen` (Grundgerüst; Ausbau → „Offen 1").
- **4** Telegram Monats-Cron für Finanzen.
- **5** `analysis/health/correlations.py` — scipy Korrelationen (HRV↔ACWR etc.) → Supabase.
- **6** Korrelations-Block auf `/analyse` (numerische r-Werte ergänzen Claude-Text).
- **7** Enable Banking OAuth — automatischer Revolut-Sync (Production/Restricted). Re-Auth alle ~90 Tage manuell (ngrok + `setup_oauth.py`).
