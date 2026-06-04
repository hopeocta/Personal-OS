# Offene Implementierungen — Personal OS

Stand: 04.06.2026

---

## 1. Laktattest & Leistungsdiagnostik in HealthReview

- Neuesten `health_labs`-Eintrag vom Typ „Laktattest" / Leistungsdiagnostik laden.
  - Wichtig: unabhängig vom Analysezeitraum (kein `from`/`to`-Filter).
- Aus Tests extrahieren:
  - HFmax
  - LT1 / LT2 (Schwellen)
  - FTP
  - Critical Power
  - ggf. sportartspezifische Schwellen (Laufen/Radfahren getrennt).
- Im HealthReview-Report klar ausgeben, z.B.:
  - „Laktatschwelle Laufen: 4:30 min/km bei 168 bpm (Test vom …)".
- Trainingsdaten zusätzlich relativ zu diesen Werten auswerten:
  - Zeit/Volumen unter / um / über LT1/LT2/FTP.
  - Ergänzend zu den existierenden HF-Zonen (Karvonen).

**Ziel:** Leistungsdiagnostik aus den Gesundheitsdokumenten fließt direkt in die Auswertung ein.

---

## 2. SER, Ernährung & Gewohnheiten ins HealthReview heben

- SER (Stress:Erholungs-Minuten-Ratio) in `lib/healthReview.ts` übernehmen:
  - Analog zur Logik in `/api/analyse` (Stress-Minuten vs. Erholungs-Minuten).
- Warnlogik integrieren:
  - SER > 2 als Warnsignal im Bericht nennen.
  - HRV unter Baseline ≥ 3 Tage.
  - Ruhepuls +5 bpm über 7-Tage-Ø ≥ 3 Tage.
  - Body Battery morgens < 30.
  - ≥ 3 Nächte < 6 Stunden Schlaf.
- Ernährung:
  - Wöchentliche Kalorien- und Protein-Durchschnitte aus `nutrition_logs`.
  - Kurz im HealthReview kommentieren (z.B. Unterversorgung vs. Zielbereich).
- Gewohnheiten:
  - `daily_habits`-Erfüllungsquoten pro Woche/Monat berechnen.
  - Im Abschnitt „Lifestyle / Gewohnheiten" aufnehmen.

**Ziel:** HealthReview liefert ein vollständiges Bild aus Belastung, Erholung, Ernährung und Verhalten.

---

## 3. Dashboard `/analyse` mit HealthReview verbinden

- Neuer API-Endpoint:
  - `app/api/analyse/recent/route.ts`
  - Lädt die letzten 3 `knowledge_entries` mit `source LIKE 'health_review_%'`.
- Frontend-Erweiterung:
  - Auf `/analyse` oben einen Block „Letzte Reviews":
    - Titel (z.B. „Gesundheits- & Trainingsanalyse 2026-05").
    - Zeitraum.
    - Obsidian-Pfad / Hinweis, wo die Datei im Vault liegt.
- Optionaler Trigger:
  - Neue Route `app/api/health-review/run/route.ts` (POST).
  - Ruft `runHealthReview('monthly')` manuell aus dem Dashboard auf.
  - Button: „Monatsanalyse jetzt neu erstellen".

**Ziel:** Dashboard-Analyse (Ad-hoc) + HealthReview (Archiv) sind auf einer Oberfläche sichtbar, aber logisch getrennt.

---

## 4. Korrelationen im HealthReview verfeinern

- Systemprompt von `healthReview` erweitern um:
  - ACWR > 1.4 **und** negativer HRV-Trend als Überlastungs-Cluster.
  - Prüfungswochen (Kalender) + Schlafdauer + Stress + Trainingsvolumen.
- Kalender-Einbindung:
  - `fetchCalendarEvents` / `isExamEvent` aus `/api/analyse` abstrahieren.
  - In `lib/healthReview.ts` wiederverwenden.
- Fokus im Bericht:
  - Explizite Beschreibung solcher Muster im Abschnitt „Korrelationen":
    - z.B. „In Prüfungswochen fiel die Schlafdauer im Mittel um X h und HRV um Y ms."

**Ziel:** HealthReview zeigt nicht nur Einzeltrends, sondern auch Zusammenspiel von Stressoren (Training, Prüfungen, Schlaf).

---

## 5. Italienisch-Vokabeln — Feinschliff

- `scripts/seed-italian-vocab.ts`:
  - Mit kleinen `count`-Werten testen (z.B. 30 pro Thema).
  - Prüfen, ob doppelte Karten entstehen, wenn das Skript mehrfach läuft:
    - ggf. Deduplizierung nach `front` + `deck_id`.
- Optional später:
  - Einfache Ansicht im Dashboard:
    - Übersicht über Decks, Anzahl Karten, Lernfortschritt.

**Ziel:** Stabiler Vokabel-Seed ohne Duplikate, Grundlage für spätere Lern-Ansicht.

---

## 6. Python-Analyseebene

### 6.1 Gesundheit & Training

- Neues Verzeichnis, z.B. `analysis/health_python/`.
- Python-Skripte/Service, der:
  - Garmin-, Labor- und Kalenderdaten aus Supabase lädt.
  - Quantitative Analysen berechnet:
    - Korrelationen (z.B. ACWR ↔ HRV ↔ Schlafdauer).
    - Zeitreihen-Trends (z.B. HRV- und RHR-Regression über Monate).
    - Verteilungen (z.B. Intensitätszonen, Schlafdauer-Histogramme).
  - Ergebnisse als kompaktes JSON in eine Tabelle wie `health_analysis_results` schreibt.
- Integration:
  - HealthReview liest diese Ergebnisse und ergänzt sie im Abschnitt „Korrelationen".
  - Dashboard `/analyse` kann eine „Advanced"-Ansicht anzeigen (z.B. numerische Korrelationen, Trendstärken).

**Ziel:** Harte Zahlen (Python) + verständliche Interpretation (Claude/HealthReview).

### 6.2 Zukunft als Zahnarzt — Praxisbürokratie & Abrechnungs-Analytics

#### Kontext: Was dich erwartet

Als angestellter Zahnarzt oder Praxisinhaber in Deutschland hast du es mit zwei Abrechnungssystemen zu tun:
- **BEMA** (Bewertungsmaßstab zahnärztlicher Leistungen) — für GKV-Patienten, quartalsweise Abrechnung über die KZV
- **GOZ** (Gebührenordnung für Zahnärzte) — für PKV/Selbstzahler, nach Steigerungsfaktor (1,0–3,5fach)

Dazu: Quartalsabrechnung, Hygienedokumentation, Behandlungspläne, Röntgenaufzeichnungen, QM-Pflichten.

Die meisten Zahnärzte machen das manuell in ihrer Praxissoftware (Dampsoft, DS-Win, Evident etc.) — Python + Claude kann daraus ein automatisches Analyse- und Berichtssystem machen.

---

#### Was Python hier löst

**Datenquelle:** CSV/XML-Export aus der Praxissoftware (jede Software kann das)

**Python verarbeitet → Claude interpretiert → Dashboard/Obsidian zeigt**

---

#### Module

**Modul A — GOZ/BEMA Abrechnungs-Analyse**
- Import der Quartalsdaten als CSV
- Welche Leistungsziffern (GOZ/BEMA-Nummern) kommen am häufigsten vor?
- Umsatz pro Ziffer, Steigerungsfaktor-Verteilung bei GOZ
- Vergleich: Ist-Abrechnung vs. theoretisches Potenzial (z.B. wird GOZ 4 immer mit 2,3fach abgerechnet obwohl 3,5fach möglich?)
- KZV-Plausibilitätsprüfung: Auffälligkeiten bevor die KZV sie findet

**Modul B — Recall & Terminauslastung**
- Recall-Rate: wie viele Patienten kommen zur Prophylaxe zurück?
- No-Show-Analyse: welcher Wochentag / welche Uhrzeit hat die meisten Ausfälle?
- Auslastungskurve: Morgens voll, nachmittags leer?
- Durchschnittliche Behandlungszeit pro Leistungsart

**Modul C — Hygiene & Compliance-Checker**
- Röntgenaufzeichnungen vollständig? (jede Aufnahme braucht Indikation + Befund)
- Behandlungspläne unterschrieben?
- DSGVO: Aufbewahrungsfristen Patientendaten korrekt?
- QM-Pflichten: wurden alle vorgeschriebenen Audits durchgeführt?
- Output: wöchentlicher Compliance-Report per Telegram

**Modul D — Monatlicher Praxis-Report (Claude)**
- Python aggregiert alle KPIs
- Claude schreibt einen strukturierten Monatsbericht:
  - Umsatz GKV vs. PKV
  - Top-5 Leistungen nach Häufigkeit und Umsatz
  - Recall-Performance
  - Ausfälle & Auslastung
  - 1 Empfehlung (z.B. „Steigerungsfaktor GOZ 4 liegt Ø bei 2.1 — Potenzial für 2.3")
- Bericht landet in Obsidian + Telegram

---

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

---

#### Verbindung zum bestehenden System

| Bestehend | Neu (Zahnarzt) | Verbindung |
|---|---|---|
| HealthReview (monatlich) | Praxis-Report (monatlich) | Selbes Format, selber Cron-Mechanismus |
| `health_analysis_results` | `practice_kpis` | Selbes Prinzip: Python rechnet, Claude interpretiert |
| Telegram-Digest | Compliance-Report | Selber Telegram-Bot, neue Nachrichtenart |
| Obsidian Gesundheit/ | Obsidian Praxis/ | Selber Vault, neuer Unterordner |

**Wichtig:** Patientendaten kommen **anonymisiert** rein — nur Patient-ID (intern), keine Namen. DSGVO-konform von Anfang an.

---

#### Wann relevant

Jetzt noch nicht — du bist im Studium. Aber:
- **Ab Famulatur/PJ**: Recall-Analyse und Terminauslastung lassen sich schon üben
- **Ab Assistenzzeit**: Abrechnungs-Analyse sofort nutzbar (CSV-Export aus Praxissoftware)
- **Praxiseröffnung/-kauf**: Alle Module produktiv

Das Gerüst (Python-Infrastruktur, Supabase-Tabellen, Dashboard-Pattern) wird mit den Finanz- und Gesundheitsmodulen aufgebaut — die Zahnarzt-Module sind dann ein weiteres Plugin auf derselben Basis.
