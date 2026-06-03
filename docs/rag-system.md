# RAG / Wissens-Suche

Das Herzstück: dein System kann nicht nur Daten **erfassen**, sondern Fragen darüber
**beantworten** — semantisch über Texte **und** als Zahlen-Abfrage über Garmin/Ernährung.

**Hybrid-Ansatz:** Vektor-Suche für Inhalte + typisiertes SQL für Zahlen.

---

## Die Engine: `lib/answer.ts` → `answerQuestion(frage)`

Eine wiederverwendbare Funktion, genutzt von **Telegram** (Frage-Button) und später vom Dashboard.

- **Orchestrator:** Claude **Sonnet** (`claude-sonnet-4-6`), Tool-Use.
- **Heutiges Datum (Berlin)** steht im System-Prompt → Claude löst „diesen Monat" selbst auf.
- **Loop-Deckel:** max. 3 Runden, `max_tokens: 1024` (Kosten-/Latenz-Bremse).
- **Cache:** nur der statische System-/Tool-Block wird gecacht, **nie** die wechselnden Tool-Results.
- Antwort auf Deutsch, jede Aussage mit `(Quelle: Kategorie, Datum)`.

### Zwei Tools

| Tool | Zweck | Implementierung |
|---|---|---|
| `search_knowledge(query, category?)` | Inhaltliche Fragen (Notizen, Recherche, Befunde) | Embedding → RPC `match_knowledge` → Top-8 |
| `query_metrics(metric, from, to, aggregate, …)` | Zahlen (Schlaf, Training, HRV, Ernährung, Labor) | `lib/metrics.ts`, **typisierte Enum, kein freies SQL** |

> **Sicherheitsregel:** Claude bekommt **niemals** rohes SQL. `query_metrics` wählt aus einer
> festen Metrik-Enum + Datumsbereich + Aggregat. `supabaseAdmin` umgeht RLS — deshalb darf
> hier nichts frei interpolierbar sein.

---

## Metrik-Dispatcher: `lib/metrics.ts`

Jede Metrik mappt auf genau eine Tabelle + Zahlen-Spalte. Aggregate werden in JS gerechnet
(`sum/avg/min/max/count/latest/list`).

| Metrik | Tabelle.Spalte |
|---|---|
| `sleep_score`, `hrv`, `sleep_minutes`, `deep_sleep_minutes`, `rem_sleep_minutes`, `resting_hr` | `garmin_sleep` |
| `activity_duration`, `activity_distance`, `activity_hr`, `activity_calories` | `garmin_activities` (+ `activity_type`-Filter) |
| `body_battery_morning`, `stress` | `garmin_body_battery` |
| `vo2max`, `acwr`, `ctl`, `atl` | `garmin_training` |
| `calories`, `protein`, `carbs`, `fat` | `nutrition_logs` |
| `strength_intensity` | `strength_sessions` |
| `lab_value` | `health_labs` (+ `test_name`-Filter) |

Aktivitätstypen-Filter: `running, cycling, swimming, strength_training, walking, other`.

---

## Vektor-Fundament (Phase 1)

- **Spalte:** `knowledge_entries.embedding` = `vector(1536)` (`NULL` = noch nicht embedded).
- **Index:** HNSW (`vector_cosine_ops`) — baut inkrementell auf, passt zu „embed-on-write".
- **RPC `match_knowledge(query_embedding, match_count, filter_category)`** — Cosine-Similarity,
  liefert `id, raw_text, summary, category, source, created_at, similarity`.
- **Embeddings:** `lib/embeddings.ts` → OpenAI `text-embedding-3-small` (1536d).
  Input = `${summary}\n\n${raw_text}`. Konstanten `EMBED_MODEL`, `EMBED_DIM`.

> **Dimension-Pin:** `vector(1536)` ist hart an `text-embedding-3-small` gekoppelt.
> Modellwechsel = neue Spalte + **kompletter Re-Embed**. Konstanten überall referenzieren.

---

## Auto-Embedding neuer Einträge (Phase 2)

In `lib/knowledge.ts` rufen `saveKnowledgeEntry`, `saveNoteEntry` und `savePlanEntry` nach
dem Insert `embedAndStore(id, summary, rawText)` auf.

> **Vercel-Falle (wichtig):** `await` statt `void` — Vercel friert die Serverless-Function
> nach der Response ein; „fire-and-forget" läuft dort **nicht** zu Ende. Bei künftigen
> Hintergrund-Tasks beachten. Fehlt mal ein Embedding (OpenAI down), bleibt die Zeile `NULL`
> → der idempotente Backfill heilt es.

---

## Frage stellen (Phase 4)

Telegram: Button **„❓ Frage beantworten"** → `routeByType('FR')` → `answerQuestion()`.
Siehe [telegram-bot.md](telegram-bot.md).

**Kein Gesprächs-Gedächtnis in Telegram** — bewusste Entscheidung:
- Jede Frage ist eigenständig (stateless). Folgefragen wie „erklär genauer" funktionieren nicht.
- Grund: echtes Gedächtnis bräuchte DB-Verlauf (In-Memory geht auf Vercel wegen Cold Starts
  verloren) und bringt für den schnellen „Frage rein → Antwort raus"-Kanal wenig Mehrwert.
- Für Dialog → **Terminal** im Dashboard (hat Verlauf + Caching).

---

## Kosten & Grenzen

- ~$0,03 pro Frage (mit Cache weniger).
- Tool-Loop-Deckel (3 Runden) ist die Kostenbremse.
- `maxDuration = 30`, `runtime = nodejs`, keine persistenten DB-Connections (alles PostgREST).

---

## Verifizierung / Test ohne UI

```
npx tsx scripts/test-answer.mjs      # voller answerQuestion-Loop (braucht ANTHROPIC_API_KEY)
node scripts/test-rag.mjs            # nur Datenschicht (Vektor + SQL), ohne Anthropic-Key
```

> Hinweis: `ANTHROPIC_API_KEY` liegt in `.env.local`, aber Claude Code überschreibt ihn in
> seiner Prozess-Umgebung → `dotenv.config({ override: true })` nötig für lokale Node-Tests.
