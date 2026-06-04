# Status

→ Verschoben von `STATUS.md` im Root.

---

## Health-Analytics Roadmap (4 Phasen)

> Stand: 04.06.2026 — Ergebnis der Architektur-Review-Session.
> Getrennte Systeme beibehalten: `/analyse` = Ad-hoc-Streaming, Cron-HealthReview = archivierte Periodenberichte.

---

### Phase 1 – Laktattest & Leistungsdiagnostik

- Neuesten `health_labs`-Eintrag vom Typ „Laktattest" / Leistungsdiagnostik laden — **unabhängig vom Analysezeitraum** (kein `from`/`to`-Filter).
- HFmax, LT1, LT2, FTP, Critical Power etc. aus `test_name` / `value` / `unit` parsen.
- Werte im `healthReview`-Report explizit ausgeben, z.B. „Laktatschwelle Laufen: 4:30 min/km bei 168 bpm (Test vom …)".
- Trainingsdaten zusätzlich relativ zu LT1/LT2/FTP auswerten (Zeit unter / zwischen / über Schwellen), nicht nur über HF-Karvonen-Zonen.

**Betroffene Dateien:** `lib/healthReview.ts`

---

### Phase 2 – SER, Ernährung & Gewohnheiten ins HealthReview heben

- SER (Stress:Erholungs-Minuten) und Ampel-Logik aus `app/api/analyse/route.ts` in `lib/healthReview.ts` übernehmen.
- Wöchentliche Kalorien- und Protein-Durchschnitte aus `nutrition_logs` im Monats-/Jahresreview kommentieren.
- `daily_habits`-Erfüllungsquoten pro Woche/Monat im Abschnitt „Gesundheit / Lifestyle" ausgeben.
- Warnsignale explizit benennen: HRV unter Baseline, RHR +5 bpm (3+ Tage), SER > 2, Body Battery morgens < 30, ≥ 3 Nächte < 6 h.

**Betroffene Dateien:** `lib/healthReview.ts`

---

### Phase 3 – Dashboard `/analyse` mit HealthReview verbinden

- Neuer API-Endpoint `app/api/analyse/recent/route.ts` — lädt die letzten 3 `knowledge_entries` mit `source LIKE 'health_review_%'` aus Supabase.
- Auf `/analyse` oben einen Block „Letzte Reviews" einbauen: Titel, Zeitraum, Obsidian-Pfad.
- Klare Trennung beibehalten: `/analyse` = Ad-hoc-Korrelationsanalyse, Cron = archivierte Periodenberichte.
- Optional: Button „Aktuelle Monatsanalyse jetzt neu erstellen" → neue Route `app/api/health-review/run/route.ts` (POST), die `runHealthReview('monthly')` aufruft.

**Betroffene Dateien:** `app/analyse/page.tsx`, `app/api/analyse/recent/route.ts`, `app/api/health-review/run/route.ts` (neu)

---

### Phase 4 – Korrelationen im HealthReview verfeinern

- Kombinierte Muster im Systemprompt von `healthReview` ergänzen:
  - Wochen mit ACWR > 1.4 **UND** negativem HRV-Trend explizit als Überlastungs-Cluster markieren.
  - Prüfungswochen aus Kalender mit Schlafdauer, Stress und Trainingsvolumen korrelieren.
- Kalender-Logik (`fetchCalendarEvents` / `isExamEvent`) aus `/api/analyse` abstrahieren und in `healthReview` wiederverwenden.
- Fokus: Trends + Kontext (Prüfungsphasen, Leistungsdiagnostik, Belastungsspitzen im Jahresverlauf).

**Betroffene Dateien:** `lib/healthReview.ts`, ggf. `lib/calendar.ts`
