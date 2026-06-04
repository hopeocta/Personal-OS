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

### 6.2 Zukunft als Zahnarzt — Bürokratie & Praxisdaten

- Python-Ebene auch für deinen zukünftigen Job als Zahnarzt nutzen.
- Mögliche Module:
  - **Abrechnung & GOZ/BEMA-Auswertung**: Import von Leistungsdaten, Analyse von Häufigkeiten, Umsatz pro Leistungsart.
  - **Recall- und Termin-Management**: No-Show-Raten, Terminpünktlichkeit, Auslastung.
  - **Dokumentations-Compliance**: Prüfen ob alle Pflichtdokumentationen vorliegen.
  - **Berichtserstellung**: Python → Claude → Obsidian-Berichte / Dashboard-KPIs.
