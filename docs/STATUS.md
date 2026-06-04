# Personal OS — Projektstatus

> Zuletzt aktualisiert: 04.06.2026

---

## ✅ Fertig gebaut & aktiv

### 🏃 Gesundheit & Training

| Feature | Datei | Beschreibung |
|---|---|---|
| Garmin-Sync | `app/api/garmin/*/route.ts` | Schlaf, Aktivitäten, Body Battery, Training täglich per Cron |
| Manuelle Garmin-Eingabe | `app/api/garmin/manual/route.ts` | Einzelwerte manuell eintragen |
| Gesundheitsdokumente | `app/api/health-docs/route.ts` | Blutbild, Laktattest, Leistungsdiagnostik → `health_labs` |
| Dashboard Analyse `/analyse` | `app/api/analyse/route.ts` | Ad-hoc-Analyse 4/8/12/52 Wochen, Streaming, SER-Ampel, Gewohnheiten, Ernährung, Kalender |
| **HealthReview Cron** | `lib/healthReview.ts` | Automatische Perioden-Analyse: monatlich (1.), halbjährlich (1. Jan/Jul), jährlich (1. Jan) |
| HealthReview Obsidian-Export | `lib/healthReview.ts` | Berichte in `Gesundheit & Training/Monatsberichte\|Halbjährig\|Jahresberichte/` |
| HealthReview Supabase-Archiv | `lib/healthReview.ts` | Gespeichert in `knowledge_entries` mit `source: health_review_*` |
| Analyse-Parameter Obsidian | `Gesundheit & Training/analyse-parameter.md` | Editierbar: HFmax, Karvonen-Zonen, Normen, ACWR-Grenzen, Empfehlungsformat |
| Wissenschaftliche Kennzahlen | `lib/healthReview.ts` | Karvonen-Zonen, Polarisierungsindex (80/20), ACWR, Lauf-Effizienz, HRV-Trend, Schlafphasen |
| Wochenampel 🟢🟡🔴 | `app/api/analyse/route.ts` | 6 Warnsignale: HRV, RHR, Body Battery, Schlafdauer, SER, Volumensprung |
| Consecutive-Run-Warnung | `app/api/analyse/route.ts` | 3+ Tage HRV unter Baseline oder RHR +5 bpm explizit gemeldet |

### 📚 Italienisch-Vokabeln

| Feature | Datei | Beschreibung |
|---|---|---|
| Vokabel-Seed-Skript | `scripts/seed-italian-vocab.ts` | Generiert 1000+ Karten via Claude, 10 Themen, in `flashcards` Supabase |
| Robustes JSON-Parsing | `scripts/seed-italian-vocab.ts` | 2-Versuch-Cleanup: kaputtes JSON reparieren, Fehler loggen statt Crash, Thema überspringen statt Abbruch |
| Anki-kompatibles Format | `scripts/seed-italian-vocab.ts` | Felder: `front`, `back`, `example_sentence` + Tags pro Thema |

### 🗓️ Kalender & Planung

| Feature | Datei | Beschreibung |
|---|---|---|
| Kalender-Events | `lib/calendar.ts` | Prüfungswochen erkennen (`isExamEvent`) |
| Kalender-Korrelation | `app/api/analyse/route.ts` | Prüfungswochen mit Schlaf, Stress, Volumen korrelieren |

### 🗃️ Obsidian-Integration

| Feature | Datei | Beschreibung |
|---|---|---|
| Obsidian-Datei schreiben | `lib/obsidian.ts` | `writeObsidianFile()` via Obsidian REST API |
| Daily Log | `lib/obsidian.ts` | `appendToDailyLog()` mit Zeitstempel Berlin |
| Analyse-Parameter | `lib/obsidian.ts` | Params aus Vault laden, Datei automatisch erstellen wenn fehlend |

---

## 🔧 Offen / Nächste Schritte

### Phase 1 — Laktattest automatisch einlesen (Priorität: hoch)

- Neuesten `health_labs`-Eintrag unabhängig vom Zeitraum laden (kein `from`/`to`-Filter).
- HFmax, LT1, LT2, FTP, Critical Power aus gespeicherten Testergebnissen parsen.
- In `healthReview`-Report explizit ausgeben: „Laktatschwelle Laufen: 4:30 min/km bei 168 bpm (Test vom …)".
- Trainingsdaten relativ zu LT1/LT2/FTP auswerten, nicht nur Karvonen.

**Betroffene Dateien:** `lib/healthReview.ts`

---

### Phase 2 — SER, Ernährung & Gewohnheiten ins HealthReview

- SER (Stress:Erholungs-Minuten) und Ampel-Logik aus `app/api/analyse/route.ts` übernehmen.
- Wöchentliche Kalorien- und Protein-Durchschnitte aus `nutrition_logs` ausgeben.
- `daily_habits`-Erfüllungsquoten pro Woche/Monat im Abschnitt Lifestyle.

**Betroffene Dateien:** `lib/healthReview.ts`

---

### Phase 3 — Dashboard `/analyse` mit HealthReview verbinden

- API `app/api/analyse/recent/route.ts` — letzte 3 gespeicherte Reviews aus `knowledge_entries`.
- Auf `/analyse` Block „Letzte Reviews" (Titel, Zeitraum, Obsidian-Pfad).
- Optional: Button „Monatsanalyse jetzt neu erstellen" → `app/api/health-review/run/route.ts`.

**Betroffene Dateien:** `app/analyse/page.tsx`, neue API-Routen

---

### Phase 4 — Korrelationen verfeinern

- ACWR > 1.4 + negativer HRV-Trend als Überlastungs-Cluster markieren.
- Prüfungswochen aus Kalender mit Schlafdauer, Stress, Volumen korrelieren.
- `fetchCalendarEvents` aus `/api/analyse` in `lib/calendar.ts` abstrahieren und in `healthReview` wiederverwenden.

**Betroffene Dateien:** `lib/healthReview.ts`, `lib/calendar.ts`

---

### Vokabeln — offene Punkte

- Skript testen mit kleinen `count`-Werten (z.B. 30 pro Thema), dann auf volle Anzahl hochdrehen.
- Prüfen ob duplizierte Karten entstehen wenn Skript mehrfach läuft (Deduplizierung nötig?).
- Optional: Dashboard-Ansicht für Vokabeln mit Lernfortschritt.

---

## 📁 Relevante Dateien Übersicht

```
lib/
  healthReview.ts        # Automatische Perioden-Analyse (monatlich/halbjährlich/jährlich)
  obsidian.ts            # Obsidian REST API Integration
  calendar.ts            # Kalender-Events & Prüfungswochen
  supabaseAdmin.ts       # Supabase Service Role Client
  types.ts               # Typdefinitionen

app/api/
  analyse/route.ts       # Ad-hoc Dashboard-Analyse (Streaming)
  garmin/*/route.ts      # Garmin Sync Endpoints
  health-docs/route.ts   # Gesundheitsdokumente / Laborwerte
  cron/health-review/    # Cron-Trigger für healthReview

scripts/
  seed-italian-vocab.ts  # Vokabel-Generator (Claude → Supabase)

docs/
  STATUS.md              # Diese Datei
```
