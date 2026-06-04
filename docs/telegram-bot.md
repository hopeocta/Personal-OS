# Telegram-Bot

Erfassung & Fragen **vom Handy aus** — schnell, ohne PC. Bewusst simpel: kein KI-Klassifizierer
für das Routing, **du tippst den Ziel-Button selbst.**

- Code: `app/api/telegram/webhook/route.ts`
- Reagiert **nur auf deine** Telegram-User-ID (`TELEGRAM_USER_ID`), prüft Webhook-Secret.
- Gibt immer `200` zurück (Telegram darf nie in einen Timeout laufen).
- `export const maxDuration = 30` — RAG-Antworten brauchen Embedding + bis zu 3 Sonnet-Runden.

---

## Was du schicken kannst

| Eingang | Was passiert |
|---|---|
| **Text** | Bot zeigt das Erfassungs-Keyboard → du wählst das Ziel. |
| **Sprachnotiz** | Whisper transkribiert → Keyboard wie bei Text. |
| **Foto** | Wird als Dokument behandelt (Befund/Verwaltung) — siehe unten. |
| **PDF / Bild-Datei** | Wie Foto. |
| **`/liste`** | Zeigt die Einkaufsliste mit Abhak-Buttons. |

---

## Das Erfassungs-Keyboard

Nach jeder Text-/Sprachnachricht erscheinen diese Buttons:

```
[🏃 Training]  [🎵 Musik]   [📚 Lernen]
[🗓️ Pläne]    [📝 Notiz]
[🛒 Einkauf]   [📅 Kalender]
[❓ Frage beantworten]
```

| Button | Code | Routing |
|---|---|---|
| 🏃 Training | `TR` | → `strength_sessions` (Intensität 2, Notiz = Text) |
| 🎵 Musik | `MU` | → `music_projects` (Status `idea`, Titel = erste 50 Zeichen) |
| 📚 Lernen | `LE` | → `knowledge_entries` Kategorie `Zahnmedizin` |
| 🗓️ Pläne | `PL` | → `knowledge_entries` Kategorie `Projekte`, Obsidian `Logbuch/Pläne und Ideen/`, **kein Claude-Call** |
| 📝 Notiz | `NO` | → `knowledge_entries` + Zeile im Tages-Logbuch `Logbuch/JJJJ/MM/JJJJ-MM-TT.md` (sofort, nicht gesammelt) |
| 🛒 Einkauf | `EK` | → Einkaufsliste (`knowledge_entries`, source `einkauf`) + Obsidian-Liste |
| 📅 Kalender | `KA` | → Claude Haiku parst Termin → Google-Calendar-Event |
| ❓ Frage beantworten | `FR` | → **RAG-Antwort** (`answerQuestion`, siehe unten) |

> **Warum ein Frage-Button statt „?"-Erkennung?** Früher galt: Text mit `?` = Frage.
> Das kollidierte mit der Erfassung (eine Notiz mit „?" wurde fälschlich als Frage behandelt).
> Jetzt entscheidest du per Tap — eindeutig.

---

## Fragen stellen (RAG)

Tippst du **„❓ Frage beantworten"**, läuft `answerQuestion()` aus `lib/answer.ts`:

1. „🤔 Ich schau nach…"
2. Claude Sonnet entscheidet per Tool-Use, ob es **Texte durchsucht** (`search_knowledge`,
   Vektor) oder **Zahlen abfragt** (`query_metrics`, SQL) — oder beides.
3. Antwort auf Deutsch, mit Quellenangabe `(Quelle: Kategorie, Datum)`.

Beispiele:
- „Was weiß ich über Endodontie?" → Vektor-Suche → Notizen mit Quellen.
- „Wie war mein Schlaf-Score diesen Monat?" → SQL → Durchschnitt.

> **Kein Gesprächs-Gedächtnis:** Jede Frage wird einzeln beantwortet, keine Rückfragen.
> Für echten Dialog → Terminal im Dashboard. (Bewusste Entscheidung, siehe [rag-system.md](rag-system.md).)

Details zur Engine: [rag-system.md](rag-system.md).

---

## Dokument-Upload (Foto / PDF)

Logik in `lib/documents.ts` (Gesundheit + Verwaltung). Ablauf:

1. Datei kommt rein → Bot fragt nach dem **Datum** (falls nicht in der Bildunterschrift,
   Format `15.05.2026`).
2. Buttons: **🩺 Gesundheit** oder **📋 Verwaltung**.
3. Bei **Gesundheit:** Claude Vision/PDF liest den Befund, erkennt Typ
   (Blutbild/Laktattest/Befund), extrahiert Werte → `health_labs` + Original in
   Storage-Bucket `documents` (`gesundheit/…`).
4. Bei **Verwaltung:** Ablage in `documents` (`verwaltung/<Kategorie>/…`).

> **Kosten-Bremse:** Claude liest nur einen **Auszug/Bild** pro Dokument (~0,2 Cent),
> nie den Volltext. (Historie: 24.05.2026 kostete „Claude über Volltext" mehrere Dollar.)

---

## Morgen-Briefing (`/api/telegram/briefing`)

**Hauptkanal**, wenn du morgens nicht das Dashboard öffnest:

| Cron (UTC) | Typ | Telegram | Obsidian |
|---|---|---|---|
| `0 6 * * *` (~08:00 Berlin Sommer) | `morning` | ☀️ Schlaf, Termine, Training, Habits | `Logbuch/Zusammenfassungen/YYYY-MM-DD-briefing.md` |
| `5 6 * * 1` (Montag) | `weekly-training` | 📊 Wochen-Training | `Logbuch/Wochen/YYYY-Www-training.md` |

Kein Claude — nur Supabase + Kalender. Manuell testen (lokal oder Vercel):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://DEINE-URL/api/telegram/briefing?type=morning"
```

## Digest (`/api/telegram/digest`)

Abends (~23:50 Berlin): fasst **nur Telegram-Notizen** des Tages mit Haiku zusammen →
`Logbuch/Zusammenfassungen/YYYY-MM-DD-digest.md` (getrennt vom Morgen-Briefing).

---

## Einrichtung (zur Erinnerung)

Env-Vars in Vercel: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USER_ID`, `TELEGRAM_WEBHOOK_SECRET`.
Webhook setzen (einmalig nach Deploy):

```
curl -F "url=https://DEINE-URL.vercel.app/api/telegram/webhook" \
     -F "secret_token=DEIN_WEBHOOK_SECRET" \
     "https://api.telegram.org/botDEIN_TOKEN/setWebhook"
```
