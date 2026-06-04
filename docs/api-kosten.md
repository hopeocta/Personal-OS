# API-Kostenübersicht — Personal OS

> Stand: Juni 2026

Dieses Dokument listet alle Stellen im Projekt, an denen externe API-Kosten entstehen — strukturiert nach Anbieter, Modell, Aufgabe und Begründung für die Modellwahl.

---

## 🟠 Anthropic (Claude)

### `claude-haiku-4-5-20251001` — schnell & günstig

| Datei | Aufgabe | Warum Haiku? |
|---|---|---|
| `lib/documents.ts` → `processGesundheitDoc()` | Blutbild/Befund lesen, Werte extrahieren, JSON strukturieren | Dokument-Parsing ist klar definiert und regelbasiert — kein komplexes Reasoning nötig. Haiku ist ~15× günstiger als Sonnet. |
| `lib/documents.ts` → `processVerwaltungDoc()` | Verwaltungsdokument kategorisieren (Versicherung, Finanzen, Amt…) | Gleiche Begründung: klar umrissene Klassifikationsaufgabe. |
| `app/api/telegram/webhook/route.ts` → `parseCalendarIntent()` | Natürlichsprachlichen Text in strukturierten Kalender-Intent umwandeln (Titel, Datum, Uhrzeit) | Kurzer Input, klares Ausgabe-Schema — Haiku reicht vollständig. |

### `claude-sonnet-4-6` — mittlere Stärke

| Datei | Aufgabe | Warum Sonnet? |
|---|---|---|
| `lib/answer.ts` → `answerQuestion()` | RAG-Fragen aus der Knowledge Base beantworten (z.B. "Wie war mein Ferritin im März?") | Antworten müssen kontextuell korrekt und gut formuliert sein — Haiku macht hier öfter Fehler bei komplexen Zusammenhängen. |
| `lib/briefing.ts` | Tages-Briefing generieren (Gesundheit, Training, Kalender, Todos zusammenfassen) | Längerer Output (~500 Tokens), mehrere Datenquellen kombinieren — Sonnet produziert konsistentere Ergebnisse. |
| `lib/newsletter.ts` → Wochenbericht | Wöchentliche Zusammenfassung aller Aktivitäten | Mittlere Komplexität, läuft nur 1× pro Woche — Sonnet-Kosten vertretbar. |

### `claude-opus-4-8` — stärkstes Modell

| Datei | Aufgabe | Warum Opus? |
|---|---|---|
| `lib/newsletter.ts` → Monatsbericht | Monatlicher Rückblick mit Trends, Muster-Erkennung, persönlichen Insights | Läuft nur 1× pro Monat. Opus erkennt Zusammenhänge über Wochen hinweg besser (z.B. Training ↔ Schlaf ↔ Blutbild). |
| `scripts/seed-italian-vocab.ts` | ~1000 Vokabeln mit Beispielsätzen generieren | Einmalig ausgeführt. Qualität der Vokabeln bestimmt direkt die Lernqualität — Opus generiert natürlichere Sätze und B1-C1-konforme Einträge. |

---

## 🟢 OpenAI

### `whisper-1` — Sprache zu Text

| Datei | Aufgabe | Warum Whisper? |
|---|---|---|
| `app/api/telegram/webhook/route.ts` → `transcribeVoice()` | Sprachnachrichten aus Telegram in Text umwandeln | Whisper ist der Standard für Audio-Transkription. Kein Claude-Äquivalent verfügbar. Preis: $0.006/Minute — bei kurzen Voice-Memos praktisch kostenlos. |

### `text-embedding-3-small` — Vektor-Embeddings

| Datei | Aufgabe | Warum dieses Modell? |
|---|---|---|
| `lib/embeddings.ts` | Text-Einträge in Vektoren umwandeln für semantische Suche (RAG) | Günstigstes OpenAI Embedding-Modell (0.02$/1M Tokens), ausreichende Qualität für persönliche Notizen. Läuft bei jedem neuen Eintrag in die Knowledge Base. |

---

## 📊 Kostenschätzung pro Monat (Normalbetrieb)

| Aufgabe | Frequenz | Geschätzte Kosten |
|---|---|---|
| Dokument-Parsing (Haiku) | ~20 Dokumente/Monat | ~$0.05 |
| Kalender-Parsing (Haiku) | ~30 Einträge/Monat | ~$0.02 |
| RAG-Antworten (Sonnet) | ~50 Fragen/Monat | ~$0.30 |
| Tages-Briefing (Sonnet) | 30× täglich | ~$1.50 |
| Wochenbericht (Sonnet) | 4× pro Monat | ~$0.20 |
| Monatsbericht (Opus) | 1× pro Monat | ~$0.30 |
| Whisper Transkription | ~20 Voice-Memos/Monat | ~$0.01 |
| Embeddings | ~100 neue Einträge/Monat | ~$0.01 |
| **Gesamt** | | **~$2.40/Monat** |

> Seed-Script (Opus, ~1000 Vokabeln): einmalig ~$0.80 — danach nie wieder, außer du erweiterst Themen.

---

## 💡 Prinzip der Modellwahl

- **Haiku** für alles Strukturierte: Parsing, Klassifikation, kurze Intents → günstigste Option
- **Sonnet** für Zusammenfassungen, Antworten und längere Outputs → gutes Preis-Leistungs-Verhältnis  
- **Opus** nur für seltene, hochwertige Tasks (monatlich oder einmalig) → Qualität rechtfertigt Preis
- **Whisper** für Audio → kein Ersatz vorhanden
- **Embeddings** für semantische Suche → laufen bei jedem Eintrag, aber extrem günstig
