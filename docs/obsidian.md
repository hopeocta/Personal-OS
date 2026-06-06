# Obsidian-Anbindung

Obsidian ist die **lesbare Spiegelung** deiner Daten — der Vault liegt lokal auf dem PC
(`D:\Obsidian Vault`), erreichbar über die **Local REST API** (`localhost:27123`).

> Quelle der Wahrheit bleibt **Supabase**. Obsidian ist die menschenlesbare Sicht + dein
> Recherche-/Lern-Arbeitsplatz. Schreibvorgänge sind best-effort: ist der PC aus, wird
> übersprungen — die Daten sind in Supabase sicher.

---

## Finale Ordnerstruktur (verbindlich für neue Writes)

```
Vault/
├── Logbuch/JJJJ/MM/JJJJ-MM-TT.md     ← Tagesdatei: Briefing (oben) + Garmin + Notizen + Dokumente
│   ├── Wochen/                       ← Wochen-Training + Wochen-Digest
│   └── Pläne und Ideen/Projekte/     ← Projekt-Pläne („Pläne"-Button → projekte)
├── Reisen/                           ← alles rund um Reisen/Urlaub
│   ├── Dokumente/                    ← Flug/Hotel/Mietwagen/Ticket/Buchungsbestätigungen
│   └── Pläne/                        ← Reise-Pläne („Pläne"-Button → reisen)
├── Gesundheit/
│   ├── Training/JJJJ/MM/             ← Garmin-Tagesdateien (Sync-Agent) ✅
│   ├── Dokumente/                    ← Uploads: Blutbild, Laktattest, Leistungsdiagnostik
│   └── Recherche/                    ← eigene Notizen: Triathlon, Kraft, Ernährung
├── KI/                               ← KI- und Skills-Einträge (Telegram, Terminal, Markt)
├── Musik/                            ← Produktion, FL Studio, Sampling
├── Recherche/                        ← Allgemeinwissen / Dumps (ohne Zahnmedizin)
├── Literatur/
│   ├── Medizin/Zahnmedizin/          ← Studium, MKG, PDF-Pipeline (einziger ZM-Ordner)
│   │   └── …/Allgemein/              ← sonstige Bücher
│   └── Wissen/                       ← Bidirektionaler Sync mit Supabase knowledge_entries
│       ├── Zahnmedizin/
│       │   ├── Aktiv/                ← context:true → im RAG + Chat-Kontext
│       │   └── Archiv/               ← context:false → sichtbar, nicht im RAG
│       ├── KI/
│       │   ├── Aktiv/
│       │   └── Archiv/
│       └── <Kategorie>/Aktiv|Archiv/ ← weitere Kategorien nach Bedarf
├── Verwaltung/
│   ├── Datenbank/                    ← persönliche Ausweise: Pass, Visum, Impfung, Personalausweis
│   ├── Universität/                  ← Uni-/Studiendokumente (Kursscheine, Erasmus, …)
│   └── <Kategorie>/                  ← Versicherung, Amt, Arbeit, Finanzen, Wohnen, …
└── Einkauf/                          ← Einkaufsliste (einziger Einkauf-Ordner)
```

> **`Literatur/Wissen/` — bidirektionaler Sync:**
> Dateien in `Aktiv/` landen mit `context=true` in Supabase (RAG + Lernfach-Kontext).
> Dateien in `Archiv/` = `context=false` — sichtbar in Obsidian, nicht im RAG.
> Verschieben zwischen Aktiv/Archiv → nach `node scripts/wissen-sync.mjs --import` gespiegelt.

> Briefing/Digest werden **nicht** mehr als eigene `Zusammenfassungen/`-Dateien abgelegt — das
> Briefing steckt oben in der Tagesdatei, der Tages-Digest bleibt Telegram-only.

---

## Kategorie → Ordner-Mapping

| Quelle / Kategorie | Obsidian-Ziel | Status |
|---|---|---|
| Garmin-Tagesdaten | `Gesundheit/Training/JJJJ/MM/` | ✅ aktiv (Sync-Agent) |
| Telegram „Pläne" (Projekt) | `Logbuch/Pläne und Ideen/Projekte/` | ✅ (lokaler Agent baut nach) |
| Telegram „Pläne" (Reise) | `Reisen/Pläne/` | ✅ (lokaler Agent baut nach) |
| Reise-Buchung (Upload/_Eingang) | `Reisen/Dokumente/` | ✅ |
| Telegram „Notiz" / Dokument | Tagesdatei `Logbuch/JJJJ/MM/TT.md` | ✅ (lokaler Agent) |
| Telegram „Lernen" | `knowledge_entries` + `Literatur/Wissen/<Kat>/Aktiv/` | ✅ |
| KI / Skills (Telegram, Terminal) | `KI/` + `Literatur/Wissen/KI/Aktiv/` | ✅ |
| PDF-Pipeline (Bücher) | `Literatur/Wissen/<Kat>/Archiv/` (context:false) | ✅ wissen-sync |
| Triathlon/Kraft/Ernährung | `Gesundheit/Recherche/` | ✅ |
| Musikproduktion/FL Studio/Sampling | `Musik/` | ✅ |
| Bücher (PDF-Pipeline, `source='literatur'`) | `Literatur/Medizin\|Allgemein/` | ✅ |
| Befund-Upload (Gesundheit) | `Gesundheit/Dokumente/` + Supabase | ✅ |
| Verwaltungs-Upload | `Verwaltung/<Kategorie>/` (Reisedocs → **Datenbank**) | ✅ |
| Einkaufsliste (Telegram) | `Einkauf/Aktuelle-Liste.md` | ✅ |

> **Hinweis:** Die Pfad-Konstanten sollen laut Roadmap künftig zentral in `lib/obsidian.ts`
> liegen (noch nicht umgesetzt). Aktuell sind sie über `lib/knowledge.ts`, `lib/documents.ts`
> und `scripts/garmin-obsidian-sync.mjs` verteilt.

---

## Wie Daten in den Vault kommen

| Kanal | Mechanismus | Erreicht Obsidian wann |
|---|---|---|
| Garmin | Lokaler Sync-Agent (Scheduler, `sync-all.mjs`) | bei PC-Start + alle 2 Tage |
| `_Eingang/`-Ordner (PC) | Lokaler Agent (`eingang-ingest.mjs`) — klassifiziert + sortiert | bei PC-Start + alle 2 Tage |
| Telegram-Notiz/Plan | Vercel-Webhook → Obsidian-PUT | nur wenn PC/Obsidian erreichbar (sonst nur Supabase) |
| PDF-Bücher | `scripts/pdf-to-knowledge.mjs` (lokal) | beim Lauf |
| Telegram-Dokument-Originale | Phase 6 (offen): Storage → Obsidian | künftig automatisch via Agent |

Siehe [ingestion.md](ingestion.md) für den `_Eingang/`-Flow.

---

## Local REST API

- Plugin in Obsidian: **Community Plugins → Local REST API** installieren + aktivieren.
- `OBSIDIAN_API_URL` (= `http://localhost:27123`) + `OBSIDIAN_API_KEY` in `.env.local`.
- Schreiben: `PUT /vault/<pfad>` mit `Authorization: Bearer <key>`. Legt Zwischenordner automatisch an.

> **Pet Peeve:** Obsidian-Writes immer asynchron & nicht-blockierend — das Dashboard wartet nie
> darauf. Fehler werden geloggt, aber lassen den Haupt-Request nie fehlschlagen.
