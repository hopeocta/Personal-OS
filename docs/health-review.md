# Gesundheits-Reviews

Automatische, längerfristige Auswertungen (Monat / Halbjahr / Jahr) über Schlaf, Training,
Erholung, Labor, Ernährung und Habits — per Telegram, generiert von Claude.

---

## Kern: `lib/healthReview.ts`

`runHealthReview(period)` mit `period ∈ {monthly, halfyear, annual}`:

1. **Editierbare Analyse-Parameter** aus Obsidian laden:
   `Gesundheit/Training/analyse-parameter.md`. Diese Datei steuert Trainingsprofil,
   HF-Zonen (Karvonen), Normwerte etc. — **Änderungen dort wirken sofort, ohne Code-Änderung.**
   Fehlt sie (oder Obsidian nicht erreichbar) → eingebaute Default-Parameter (Triathlon-Profil).
2. Daten des Zeitraums aggregieren: `garmin_*`, `health_labs`, `nutrition_logs`, `daily_habits`,
   plus Prüfungstermine aus dem Kalender (`isExamEvent`).
3. **Claude** erstellt die Review (Trends, Ampeln, Empfehlungen).
4. Versand per Telegram (`sendTelegramMessage`) + Ablage im Vault (`writeObsidianFile` /
   `appendToDailyLog`).

`maxDuration = 60` (mehrstufige Aggregation + Claude).

> Verwandt, aber separat: **`/analyse`** macht eine *on-demand* Korrelations-Analyse (4/8/12
> Wochen) — siehe [dashboard.md](dashboard.md). Health-Reviews sind die *automatischen*
> Langzeit-Berichte.

---

## Auslöser

| Route | Zeit |
|---|---|
| `GET /api/cron/health-review?type=monthly` | Cron **1. d. Monats, 8:30 UTC** |
| `GET /api/cron/health-review?type=halfyear` | Cron **1.1. & 1.7., 9:00 UTC** |
| `GET /api/cron/health-review?type=annual` | Cron **1.1., 9:30 UTC** |
| `POST /api/health-review/run` | manuell auslösen |

Cron-Auth: `Authorization: Bearer CRON_SECRET`.

---

## Parameter-Datei pflegen

Die Steuerdatei `Gesundheit/Training/analyse-parameter.md` liegt im Obsidian-Vault und ist
bewusst vom Code entkoppelt: Trainingsziele, Alter, HFmax, Saison, Normwerte dort anpassen →
nächste Review nutzt die neuen Werte. Beim ersten Lauf wird sie ggf. mit den Defaults beschrieben.

Die generierten Berichte landen unter `Gesundheit/Training/<Ordner>/<Label>.md`, wobei `<Ordner>`
je nach Periode `Monatsbericht`, `Halbjährig` oder `Jahresberichte` ist.

---

## Dateien

`lib/healthReview.ts`, `app/api/cron/health-review/route.ts`, `app/api/health-review/run/route.ts`.
