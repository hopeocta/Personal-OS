# Roadmap — Personal OS

Stand: 06.06.2026

> Oben steht, was noch offen ist. Erledigtes ist unten archiviert (✅).
> Wird bei jedem Session-Ende gegen den Session-Log in `STATUS.md` abgeglichen.

---

## 🔜 Offen

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
