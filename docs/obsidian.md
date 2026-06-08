# Obsidian-Anbindung

Obsidian ist die **lesbare Spiegelung** deiner Daten — der Vault liegt lokal auf dem PC
(`D:\Obsidian Vault`), erreichbar über die **Local REST API** (`localhost:27123`).

> Quelle der Wahrheit bleibt **Supabase**. Obsidian ist die menschenlesbare Sicht + dein
> Recherche-/Lern-Arbeitsplatz. Schreibvorgänge sind best-effort: ist der PC aus, wird
> übersprungen — die Daten sind in Supabase sicher.

---

## Echte Ordnerstruktur (Stand: Vault-Scan 06.06.2026)

```
Vault/
├── _Eingang/                         ← Drop-Ordner für automatischen Ingest
├── Einkauf/                          ← Einkaufsliste (einziger Einkauf-Ordner)
├── Excalidraw/                       ← Whiteboard-Zeichnungen
├── Gesundheit/
│   ├── Dokumente/                    ← Uploads: Blutbild, Laktattest, Leistungsdiagnostik
│   ├── Recherche/                    ← eigene Notizen: Triathlon, Kraft, Ernährung
│   ├── Training/
│   │   ├── 2025/                     ← Garmin-Tagesdateien (Sync-Agent)
│   │   ├── 2026/                     ← Garmin-Tagesdateien (Sync-Agent)
│   │   ├── Garmin Reports/           ← zusammengefasste Reports
│   │   ├── Monatsbericht/            ← Health-Review monatlich (healthReview.ts)
│   │   ├── Halbjährig/               ← Health-Review halbjährlich
│   │   ├── Jahresberichte/           ← Health-Review jährlich
│   │   └── analyse-parameter.md      ← editierbare Steuerdatei für Health-Reviews
│   └── Werte/                        ← Messwerte, Körperdaten
├── KI/                               ← KI-Wissen + gesammelte Skills
│   ├── Marktanalysen/                ← Marktanalyse-Einträge
│   └── Skills/                       ← KI-Skills aus Telegram/Terminal
├── Literatur/
│   ├── Allgemein/                    ← sonstige Bücher (nicht Zahnmedizin)
│   ├── Medizin/
│   │   └── Zahnmedizin/              ← Studium, MKG, PDF-Pipeline (einziger ZM-Ordner)
│   └── Wissen/                       ← Bidirektionaler Sync mit Supabase knowledge_entries
│       └── Zahnmedizin/
│           ├── Aktiv/                ← context:true → im RAG + Chat-Kontext
│           └── Archiv/               ← context:false → sichtbar, nicht im RAG
├── Logbuch/
│   ├── 2026/
│   │   ├── 05/                       ← JJJJ-MM-TT.md Tagesdateien
│   │   └── 06/
│   └── Wochen/                       ← Wochen-Training + Wochen-Digest
├── Musik/                            ← Produktion, FL Studio, Sampling
├── Notes/                            ← freie Notizen
├── Recherche/                        ← Allgemeinwissen / Dumps
├── Reisen/
│   ├── Dokumente/                    ← Flug/Hotel/Mietwagen/Ticket/Buchungsbestätigungen
│   └── Pläne/                        ← Reise-Pläne
└── Verwaltung/
    ├── Amt/
    ├── Arbeit/
    ├── Datenbank/                    ← persönliche Ausweise: Pass, Visum, Personalausweis
    ├── Finanzen/
    ├── Sonstiges/
    ├── Universität/
    ├── Versicherung/
    └── Wohnen/
```

> **Wichtig — `KI/` ist top-level, KEIN Unterordner von `Literatur/Wissen/`.**
> KI-Skills aus Telegram/Terminal landen in `KI/Skills/`, nicht im wissen-sync.
> `Literatur/Wissen/` enthält nur lernfachbezogene Inhalte mit Aktiv/Archiv-Struktur.

> **`Literatur/Wissen/` — bidirektionaler Sync:**
> Dateien in `Aktiv/` landen mit `context=true` in Supabase (RAG + Lernfach-Kontext).
> Dateien in `Archiv/` = `context=false` — sichtbar in Obsidian, nicht im RAG.
> Verschieben zwischen Aktiv/Archiv → nach `node scripts/wissen-sync.mjs --import` gespiegelt.
> Aktuell nur `Zahnmedizin/` vorhanden. Neue Kategorien durch Ordner anlegen + Sync starten.

> **Tagesdateien** liegen unter `Logbuch/JJJJ/MM/JJJJ-MM-TT.md`.
> Briefing/Digest werden nicht als eigene Dateien abgelegt — das Briefing steckt oben in der Tagesdatei.

> **`Verwaltung/Universitaet/`** (ohne Umlaut) ist ein Duplikat von `Universität/` — kann gelöscht werden.

---

## Kategorie → Ordner-Mapping

| Quelle / Kategorie | Obsidian-Ziel | Status |
|---|---|---|
| Garmin-Tagesdaten | `Gesundheit/Training/JJJJ/` | ✅ aktiv (Sync-Agent) |
| Telegram „Pläne" (Reise) | `Reisen/Pläne/` | ✅ (lokaler Agent) |
| Reise-Buchung (Upload/_Eingang) | `Reisen/Dokumente/` | ✅ |
| Telegram „Notiz" / Dokument | Tagesdatei `Logbuch/JJJJ/MM/TT.md` | ✅ (lokaler Agent) |
| Telegram „Lernen" (Zahnmedizin) | `knowledge_entries` + `Literatur/Wissen/Zahnmedizin/Aktiv/` | ✅ |
| Telegram „Lernen" (KI/Skills) | `knowledge_entries` + `KI/Skills/` | ✅ |
| PDF-Pipeline (Bücher) | `Literatur/Wissen/Zahnmedizin/Archiv/` (context:false) | ✅ wissen-sync |
| Triathlon/Kraft/Ernährung | `Gesundheit/Recherche/` | ✅ |
| Musikproduktion/FL Studio/Sampling | `Musik/` | ✅ |
| Bücher (PDF-Pipeline, `source='literatur'`) | `Literatur/Medizin/Zahnmedizin/` | ✅ |
| Befund-Upload (Gesundheit) | `Gesundheit/Dokumente/` + Supabase | ✅ |
| Verwaltungs-Upload | `Verwaltung/<Kategorie>/` | ✅ |
| Einkaufsliste (Telegram) | `Einkauf/Aktuelle-Liste.md` | ✅ |
| Marktanalysen | `KI/Marktanalysen/` | ✅ |

---

## Wie Daten in den Vault kommen

| Kanal | Mechanismus | Erreicht Obsidian wann |
|---|---|---|
| Garmin | Lokaler Sync-Agent (Scheduler, `sync-all.mjs`) | bei PC-Start + alle 2 Tage |
| `_Eingang/`-Ordner (PC) | Lokaler Agent (`eingang-ingest.mjs`) — klassifiziert + sortiert | bei PC-Start + alle 2 Tage |
| Telegram-Notiz/Plan | Vercel-Webhook → Obsidian-PUT | nur wenn PC/Obsidian erreichbar (sonst nur Supabase) |
| PDF-Bücher | `scripts/pdf-to-knowledge.mjs` (lokal) | beim Lauf |
| Obsidian → Supabase (context) | `scripts/wissen-sync.mjs --import` | bei PC-Start (Schritt 6 in sync-all.mjs) |

Siehe [ingestion.md](ingestion.md) für den `_Eingang/`-Flow.

---

## Local REST API

- Plugin in Obsidian: **Community Plugins → Local REST API** installieren + aktivieren.
- `OBSIDIAN_API_URL` (= `http://localhost:27123`) + `OBSIDIAN_API_KEY` in `.env.local`.
- Schreiben: `PUT /vault/<pfad>` mit `Authorization: Bearer <key>`. Legt Zwischenordner automatisch an.

> **Pet Peeve:** Obsidian-Writes immer asynchron & nicht-blockierend — das Dashboard wartet nie
> darauf. Fehler werden geloggt, aber lassen den Haupt-Request nie fehlschlagen.
