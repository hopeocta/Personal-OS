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
├── Logbuch/JJJJ/MM/JJJJ-MM-TT.md     ← Tages-Timeline; Telegram-Notizen (Phase 7, geplant)
│   ├── Zusammenfassungen/            ← Tages-Digest
│   ├── Wochen/                       ← Wochen-Digest
│   └── Pläne und Ideen/             ← „Pläne"-Button aus Telegram
├── Gesundheit/
│   ├── Training/JJJJ/MM/             ← Garmin-Tagesdateien (Sync-Agent) ✅
│   ├── Dokumente/                    ← Uploads: Blutbild, Laktattest, Leistungsdiagnostik
│   ├── Werte/                        ← extrahierte Laborwerte (health_labs)
│   └── Recherche/                    ← eigene Notizen: Triathlon, Kraft, Ernährung
├── Zahnmedizin/                      ← Arbeit/Studium (eigene Recherche)
├── Musik/                            ← Produktion, FL Studio, Sampling
├── Recherche/                        ← Allgemeinwissen / Dumps
├── Literatur/{Medizin, Allgemein}/   ← Quell-Dokumente, Bücher (PDF-Pipeline)
├── Verwaltung/<Kategorie>/           ← Versicherung, Amt, Arbeit, Finanzen
└── Einkauf/                          ← Einkaufsliste
```

---

## Kategorie → Ordner-Mapping

| Quelle / Kategorie | Obsidian-Ziel | Status |
|---|---|---|
| Garmin-Tagesdaten | `Gesundheit/Training/JJJJ/MM/` | ✅ aktiv (Sync-Agent) |
| Telegram „Pläne" | `Logbuch/Pläne und Ideen/` | ✅ aktiv |
| Telegram „Notiz" | `Tagebuch/` (Phase 7: → Tages-Logbuch) | 🟡 noch alt |
| Telegram „Lernen" | `knowledge_entries` Zahnmedizin + Recherche-Ordner | ✅ |
| Triathlon/Kraft/Ernährung | `Gesundheit/Recherche/` | geplant zentralisieren |
| Musikproduktion/FL Studio/Sampling | `Musik/` | geplant zentralisieren |
| Bücher (PDF-Pipeline, `source='literatur'`) | `Literatur/Medizin\|Allgemein/` | ✅ |
| Befund-Upload (Gesundheit) | `Gesundheit/Dokumente/` + Supabase | ✅ |
| Verwaltungs-Upload | `Verwaltung/<Kategorie>/` | ✅ |

> **Hinweis:** Die Pfad-Konstanten sollen laut Roadmap künftig zentral in `lib/obsidian.ts`
> liegen (noch nicht umgesetzt). Aktuell sind sie über `lib/knowledge.ts`, `lib/healthDocs.ts`
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
