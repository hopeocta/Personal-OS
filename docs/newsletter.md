# Zahnmedizin-Newsletter

Automatischer Literatur-Überblick aus **PubMed**, zusammengefasst von Claude Haiku, per Telegram.

---

## Ablauf (`lib/newsletter.ts`)

1. **`searchPubMed(query, days)`** — NCBI eutils (`esearch` + `esummary`), zahnmedizinische
   Suchbegriffe, Publikationen der letzten Tage (Standard 7), max. 15 Treffer (Titel, Abstract,
   Quelle, Datum, Autoren).
2. **`summariseArticles(...)`** — Claude **Haiku** fasst die Abstracts für einen deutschen
   Zahnarzt prägnant zusammen (max. 1024 Tokens).
3. Versand per Telegram + Eintrag ins Logbuch (`appendToDailyLog`).

Funktionen: `runWeeklyNewsletter()` (Wochen-Digest) und `runMonthlyReview()` (Monats-Rückblick).

---

## Auslöser

| Route | Zeit |
|---|---|
| `GET /api/cron/newsletter?type=weekly` | Cron **Mo 7:00 UTC** |
| `GET /api/cron/newsletter?type=monthly` | Cron **1. d. Monats, 8:00 UTC** |

Auth über `Authorization: Bearer CRON_SECRET`. Kein eigener Speicher in Supabase außer dem
Logbuch-Eintrag (Wissens-Charakter, keine Tabelle).

---

## Dateien

`lib/newsletter.ts`, `app/api/cron/newsletter/route.ts`.

> Externe Abhängigkeit: NCBI eutils (öffentlich, kein Key). Bei Ausfall liefert der Newsletter
> „keine neuen Publikationen".
