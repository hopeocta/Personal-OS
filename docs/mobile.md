# Mobile-App `/m`

PWA-fähige Handy-Oberfläche unter `/m`. Auto-Redirect für mobile User-Agents (Ausstieg via `?desktop=1`).

---

## Architektur

| Schicht | Details |
|---|---|
| Route | `app/m/` — eigenes Layout mit Bottom-Nav |
| Layout | `app/m/layout.tsx` (Client) — `height:100dvh`, nur `main` scrollt, Nav + Masthead fix |
| Tabs | Heute (`/m`), Erfassen (`/m/erfassen`), Hermes (`/m/hermes`) |
| PWA | `app/manifest.ts`, Icons `public/icon-192/512.png`, `apple-touch-icon.png` |

---

## Komponenten

### `MNextTraining` — Nächste Trainings
- Fetcht parallel `/api/training/plan?days=14` (plan-Sessions, gescopt auf `user_id='me'`) + `/api/calendar?days=14` (Kalender-Events)
- **Struktur (aus Utes PWA übernommen)**: 2 Wochen als **Tag-Slots** (Mo–So, „Diese/Nächste Woche"), vergangene Tage ausgeblendet, „heute" markiert, leere Tage zeigen „frei" und sind Drop-Ziele. Eigene Theme-Farben (CSS-Variablen `--sport-*`), **nicht** Utes Mint/Creme.
- **Emoji-Icons** je Sport (🏊🚴🏃🏋) statt nur farbiger Punkt
- **Touch-Drag-and-Drop**: ☰-Greifgriff je Karte → Pointer Events + `setPointerCapture` (iOS-tauglich), schwebende Karten-Kopie, Ziel-Slot hervorgehoben, Auto-Scroll. Loslassen über anderem Tag → optimistisches Update + `PATCH /api/training/session` (Rollback bei Fehler). Ersetzt die alten `−1/+1`-Buttons.
- **Optional-Einheiten**: `is_optional`-Sessions zeigen `➕ optional`-Badge und sortieren ans Tagesende. `is_event` → `🏁`, `intensity_kind` → `⚡`/`🎯`.
- Kalender-Events werden auf Lauf-Keywords gefiltert (`run`, `lauf`, `jog`, `marathon`, `pace`, `easy`, `tempo run` …) → Runna-Läufe aus Garmin-iCal
- **RUNNA-Badge**: calendar-Läufe sind `locked: true` → kein Greifgriff, kein Verschieben
- **Datum-Fix**: AllDay-Events aus Garmin-iCal kommen als UTC-Mitternacht (z.B. `2026-06-16T22:00Z` für DE-Termin am 17.6.) → `toLocaleDateString('en-CA')` gibt korrektes Berliner Datum
- **Details aus Runna-Titeln**: `description` ist im iCal null → Distanz per Regex `\((\d+[,.]\d*) km\)` extrahiert, Workout-Typ aus Titelformat `… - <Typ> (<Distanz>)` als Fallback
- **Rad Indoor/Outdoor-Toggle**: zeigt `watts_indoor` vs. HF/Tempo je nach Modus; `outdoor_alt` (Freitext) wird zusätzlich angezeigt

### `MTraining` — Training letzte 7 Tage
- Fetcht `/api/training/summary?days=7`
- Nutzt **API-berechnete Totals** (`swimKm`, `bikeKm`, `runKm`) statt client-seitig neu zu rechnen
- `multi_sport`-Aktivitäten werden in der Summary-API über `triathlon_races`-Splits aufgeteilt (korrekte Swim/Bike/Run-km)
- `actSport()` erkennt `multi_sport` → `brick`-Farbe in der Aktivitätsliste

### `MSleepRing` — Schlaf & Erholung
- Score-Ring (grün ≥ 80 / gelb ≥ 60 / rot < 60), HRV, Schlafdauer, Tiefschlaf, Body Battery

### `MTasks` — Heute dran
- Recurring Tasks aus `/api/tasks`, abhaken in-place

### `MLiteratur` — Zahnmedizin-Literatur
- Zeigt Artikel der aktuellen Kalenderwoche aus `literatur_entries`
- Daten werden in `app/m/page.tsx` geladen: `SELECT id, kw, jahr, title, summary, sections_de, source_url, ...`
- Filtert auf neueste KW/Jahr-Kombination (max. 30 Artikel)
- **Aufklapp-Struktur**: Karte → Fachbereich → Artikel → 4 deutsche Sektionen
- **4 Sektionen** (Tab-Buttons): Untersucht (`hintergrund`), Methodik (`methodik_ergebnisse`), Ergebnis (`schlussfolgerung`), Fortschritt (`fortschritt`)
- Fallback auf englischen `summary` wenn `sections_de` null (Artikel noch nicht verarbeitet)
- Fachbereich-Gruppierung via Keyword-Match auf Titel: MKG/Chirurgie, Implantologie, Parodontologie, Endodontie, Kiefergelenk, Onkologie, Sportmedizin, Allgemein

### `MWochenrueckblick` — Wochenrückblick
- Claude Haiku fasst letzte 7 Tage (Notizen/Training/Ernährung) + nächste 7 Tage (Trainingsplan) zusammen
- Nur auf Klick (~0.1 Cent), nicht automatisch beim Laden

---

## API-Routen

### `GET /api/training/plan?days=N`
- Liest `training_plan_sessions` ab heute für N Tage
- Sortiert nach `date`, `sort_order`

### `PATCH /api/training/session`
- Body: `{ id: string, date: string }` (YYYY-MM-DD)
- Verschiebt `training_plan_sessions.date` für eine Einheit
- Nur für plan-Sessions, nicht für Runna/Kalender-Events

### `GET /api/training/summary?days=N`
- Liest `garmin_activities` + `triathlon_races` parallel
- `multi_sport`-Aktivitäten: Splits aus `triathlon_races` (gleiche Date) → swim/bike/run getrennt
- Gibt `{ swimKm, bikeKm, runKm, totalHours, activities }` zurück

---

## Datenquellen für Trainingsplan

| Quelle | Sport | Wie |
|---|---|---|
| `training_plan_sessions` (source=plan) | swim, bike, strength, rest | `/api/training/plan` |
| Garmin-iCal (`GARMIN_ICAL_URL`) via `/api/calendar` | run (Runna) | Lauf-Keyword-Filter, `locked: true` |
| `triathlon_races` | swim/bike/run splits | Nur für multi_sport-Summary-Berechnung |

---

## Hinweise
- Garmin-iCal AllDay-Events: UTC-Mitternacht = Berliner Datum vom Folgetag → immer `toLocaleDateString('en-CA')` statt `.slice(0,10)` für allDay-Events
- Runna sendet keine `description` im iCal — Details kommen aus Titel-Parsing
- `multi_sport` in `garmin_activities` hat nur Gesamtdistanz; Splits kommen aus `triathlon_races` (muss manuell befüllt sein)
