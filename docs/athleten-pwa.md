# Athleten-PWA (`/p/[personId]`)

Passwortfreie Trainingsplan-Ansicht für einzelne Personen (z.B. Ute = `p1`).
Eine Person bookmarkt `/p/p1` auf dem iPhone. Liest **nur** aus `training_plan_sessions`
(kein Claude beim Page-Load).

Vercel-Link: `personal-os-ten-iota.vercel.app/p/p1`

## Seiten

| Pfad | Inhalt |
|---|---|
| `app/p/[personId]/page.tsx` | **Anstehend** — nächste 4 Wochen als Tag-Slots (Mo–So) |
| `app/p/[personId]/done/page.tsx` | **Erledigt** — letzte 60 Tage + Statistik |
| `app/p/[personId]/layout.tsx` | Header (Name) + Tabs |

Namen-Mapping liegt in `layout.tsx` (`NAMES = { p1: 'Ute', p2: 'Arthur' }`).

## API

| Route | Zweck |
|---|---|
| `GET  /api/p/[personId]/plan?mode=upcoming\|done` | Einheiten lesen + Garmin-Auto-Done-Abgleich + **Runna-Läufe einmischen** |
| `POST /api/p/[personId]/done` `{sessionId,done}` | Einheit als erledigt markieren / zurücknehmen |
| `POST /api/p/[personId]/move` `{sessionId,date}` | **Einheit per Drag-and-Drop auf anderen Tag verschieben** |

Alle Routen sind ohne Auth (bewusst — die PWA ist eine reine Person-Ansicht).
`move` setzt `sort_order` ans Ende des Zieltags (höchste + 10).

## Drag-and-Drop (Touch)

- **Modell**: Jede Woche zeigt 7 Tag-Slots (`data-date`). Karten liegen in ihrem Tag-Slot,
  leere Tage sind ebenfalls Drop-Ziele („Ruhetag" / beim Ziehen „Hier ablegen").
- **Greifen**: ☰-Griff rechts auf jeder Karte. Pointer Events + `setPointerCapture`
  (kein HTML5-Drag — funktioniert zuverlässig auf iOS Safari). Während des Ziehens
  schwebt eine Karten-Kopie unter dem Finger, der Ziel-Slot wird grün umrandet.
- **Speichern**: Beim Loslassen über einem anderen Tag → optimistisches Update +
  `POST /move`. Schlägt der Request fehl, wird zurückgerollt.
- **Tippen** auf die Karte (nicht den Griff) klappt Details auf — kein Konflikt mit Drag,
  weil Griff und Karten-Body getrennte Pointer-Handler haben.
- Auto-Scroll an Viewport-Ober-/Unterkante, damit auch entfernte Tage erreichbar sind.
- Vergangene Tage ohne Einheit werden ausgeblendet, „heute" ist markiert.

## Einheiten-Darstellung (`training_plan_sessions`)

| Spalte | Wirkung in der PWA |
|---|---|
| `sport` (`running`/`cycling`/`swimming`) | Farbe + Icon + Label (Laufen/Rolle/Schwimmen) |
| `is_optional` | gedämpftes „Optional"-Styling |
| `is_event` | 🏁-Badge, rotes Wettkampf-Styling, fetter Titel (Migration 0017) |
| `intensity_kind` (`interval`/`technique`/…) | ⚡ Intervall- bzw. 🎯 Technik-Badge |
| `outdoor_alt` | grüner „🌳 Outdoor-Alternative"-Absatz beim Aufklappen (Migration 0017) |
| `completed_at` / Garmin-Auto-Done | Häkchen + durchgestrichener Titel |

### Wettkampf + Taper (Beispiel Ute, 27.06.2026)

Wettkämpfe werden als normale `running`/`cycling`-Einheit mit `is_event = true` gepflegt.
Für den 10-km-Lauf am Sa 27.06. wurde die Woche getapert: Fr = lockeres Ausrollen (optional),
Sa = Wettkampf, So = Regeneration statt langem Lauf (optional).

### Outdoor-Alternative

Indoor-Rolle-Einheiten tragen in `outdoor_alt` eine Freitext-Alternative (Dauer + HF-Bereich +
Terrain-Hinweis). Reiner Zusatz-Text, kein Watt-Ersatz — wird nur beim Aufklappen angezeigt.

## Runna-Integration (pro Person)

Geplante Runna-Läufe einer Person kommen wie beim eigenen Account über den
**Garmin-iCal-Export** (Runna → Garmin-Trainingskalender → iCal). Die URL liegt
pro Person in `persons.garmin_ical_url` (Migration 0018, RLS deny-all — nur
Service-Role liest sie).

- `/api/p/[personId]/plan` (mode=upcoming) holt die iCal-Läufe (`fetchFromIcalUrl`
  aus `lib/calendar.ts`, 5-min In-Memory-Cache, Lauf-Filter `isRunTitle`).
- **Runna ersetzt Plan-Läufe**: werden Runna-Läufe gefunden, fallen die festen
  Haupt-Lauf-Einheiten (`sport='running' AND NOT is_event AND NOT is_optional`) aus
  der Anzeige; **Event-Läufe (Wettkampf) und optionale Plan-Läufe bleiben erhalten**
  (z.B. ein optionaler Freitags-Lauf). Die Runna-Läufe kommen als **gesperrte**
  Einheiten rein (`locked: true`,
  `source: 'runna'`): RUNNA-Badge, kein Greifgriff, kein manueller Done-Button —
  Garmin-Auto-Done greift weiterhin über Datum+Typ.
- **Wettkampf** (`is_event`) hat Vorrang: an Wettkampf-Tagen wird kein Runna-Lauf
  eingemischt.
- **Fehlersicher**: liefert der iCal nichts (Fetch-Fehler oder leer), bleiben die
  Plan-Läufe unverändert sichtbar — die Person steht nie ohne Läufe da. Die
  generierten Plan-Läufe bleiben als Fallback in der DB; entfernt man die
  iCal-URL, erscheinen sie sofort wieder.

## Migrationen

- `0014_training_plan_sessions.sql` — Basistabelle
- `0016_multi_person.sql` — `intensity_kind`, person-aware Indizes
- `0017_training_plan_event_outdoor.sql` — `is_event`, `outdoor_alt`
- `0018_persons_garmin_ical_url.sql` — `persons.garmin_ical_url` (Runna pro Person)
- `0019_persons_athlete_profile.sql` — `persons.age/hf_max/hf_rest/hr_zones/profile_notes` (Athleten-Profil)

## Athleten-Profil (`persons`)

Damit die Trainingssteuerung strukturiert hinterlegt ist (statt nur als Fließtext
im Session-Log): `age`, `hf_max`, `hf_rest`, `hr_zones` (jsonb), `profile_notes`.

Ute (p1): Alter 60, HFmax 175 (gemessen), Ruhepuls 56. HF-Zonen:
Z1 ≤120 · **Z2 (Grundlage) 121–135** · Z3 136–148 · Z4 149–161 · Z5 162–175.
Beim Laufen unteres Z2 (~125–130) anpeilen — die Garmin-Historie zeigt 58% der
Läufe in der grauen Z3-Zone (zu hart fürs Basis-Ziel). `hf_range` aller Rad-/
Schwimm-Einheiten ist konsistent aus diesen Zonen gesetzt; die optionale
Sa-Grundlagenausfahrt steigt progressiv (60→120 min) mit Deload in Regenerationswochen.

(`is_optional` + `completed_at` wurden am 20.06. direkt per SQL ergänzt.)
