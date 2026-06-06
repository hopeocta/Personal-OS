# Garmin-Sync

Garmin-Daten fließen über **zwei getrennte Wege**:

1. **Garmin → Supabase** (Cloud, automatisch, zuverlässig) — die Quelle der Wahrheit.
2. **Garmin → Obsidian** (lokal, auf dem PC) — als lesbare Markdown-Tagesdateien.

Der zweite Weg läuft lokal, **weil Obsidian auf `localhost` hört und die Cloud das nicht
erreichen kann.** Siehe Erklärung unten.

---

## 1. Garmin → Supabase (Cloud-Cron)

- Route: `app/api/garmin/sync/route.ts`, **Cron täglich 5 Uhr UTC** (`vercel.json`).
- Login mit `GARMIN_EMAIL` / `GARMIN_PASSWORD` (`lib/garminClient.ts`).
- Holt die letzten ~2 Tage (Zeitzonen-Edge-Cases) und schreibt in vier Tabellen:

| Tabelle | Felder |
|---|---|
| `garmin_activities` | Typ, Dauer, Distanz, Ø/Max-HR, Kalorien, Höhenmeter, Pace, **Watt (Ø/Max/Norm — nur bei Indoor-Aktivitäten, z.B. `indoor_cycling`)**, Name |
| `garmin_sleep` | Score, Phasen, HRV nächtlich + Baseline/Status, Ruhepuls, 7-Tage-RHR |
| `garmin_body_battery` | morgens/abends, Stress Ø, Stressminuten (niedrig/mittel/hoch), Erholung |
| `garmin_training` | VO2max, ATL/CTL/ACWR + Status, Training-Status |

- **Watt-Werte:** Garmin liefert `avgPower`/`maxPower`/`normPower` nur für Indoor-Aktivitäten
  (Smarttrainer/Powermeter, `typeKey` enthält `indoor`, z.B. `indoor_cycling`) — bei Outdoor-Sessions
  bleibt das Feld `null`. `/analyse` zeigt für Indoor-Sessions `avg_watt` + **HF/Watt-Quotient**
  statt Tempo (Geschwindigkeit ist dort kein sinnvoller Parameter).
- Erweiterte Wellness-Daten: `lib/garminWellness.ts` (`fetchDailyStress`, `fetchHrvSummary`,
  `fetchDailySummary`, `fetchTrainingStatus`).
- Status-Check: `GET /api/garmin/status`.
- **Historie nachladen:** `node scripts/garmin-backfill-sleep.mjs` (treibt `/api/garmin/backfill-sleep`
  lokal gegen den Dev-Server, kein Vercel-300s-Limit). Siehe [scripts.md](scripts.md).

---

## 2. Garmin → Obsidian (lokaler Sync-Agent)

- Script: `scripts/garmin-obsidian-sync.mjs` (self-contained Node, liest Supabase, schreibt Vault).
- **Eine kombinierte Datei pro Tag:** `Gesundheit/Training/JJJJ/MM/JJJJ-MM-TT.md`
  mit Abschnitten `## 🏃 Aktivitäten`, `## 😴 Schlaf`, `## ❤️ HRV & Erholung`, `## 📈 Training Load`.
- **Idempotent:** Datei pro Kalendertag hat einen festen Namen → erneuter Lauf **überschreibt**
  dieselbe Datei, **keine Duplikate.**
- **Kein Embedding für Garmin** — Zahlen-Fragen laufen exakt über `query_metrics` (SQL),
  RAG über Zahlen bringt keinen Mehrwert.

### Aufruf

```
node scripts/garmin-obsidian-sync.mjs            # letzte 30 Tage (Standard)
node scripts/garmin-obsidian-sync.mjs --days 7
node scripts/garmin-obsidian-sync.mjs --all      # gesamte Historie (einmalig, ~377 Tage)
node scripts/garmin-obsidian-sync.mjs --dry-run  # nur anzeigen, nichts schreiben
```

Voraussetzung: Obsidian läuft mit **Local-REST-API-Plugin** (`OBSIDIAN_API_URL` = `http://localhost:27123`).

---

## Warum lokal? (die `localhost`-Erklärung)

- **Vercel** (Garmin-Cron, Telegram-Bot) läuft in der **Cloud**.
- **Obsidian** mit der Local-REST-API hört auf **`localhost`** = nur auf deinem PC erreichbar.
- Die Cloud kann `localhost` auf deinem PC **nicht** erreichen → ein Cloud-Job kann nicht
  direkt in deinen Vault schreiben.

**Konsequenz:** Das Schreiben nach Obsidian muss ein Programm auf deinem **PC** übernehmen.
Das ist der Sync-Agent oben, automatisiert über den Windows-Scheduler unten. Deine Daten
sind dabei nie in Gefahr — sie liegen immer in Supabase; Obsidian ist nur die lesbare Spiegelung.

---

## Der Scheduler (Windows-Aufgabenplanung)

Eine Windows-Aufgabe führt den **lokalen Auto-Agenten** automatisch aus. Einstiegspunkt ist
**`scripts/sync-all.mjs`** — der Orchestrator, der nacheinander läuft:
1. Garmin → Obsidian (`garmin-obsidian-sync.mjs`)
2. `_Eingang/` → Obsidian + Supabase (`eingang-ingest.mjs`, siehe [ingestion.md](ingestion.md))

So macht **eine** Aufgabe alles. Details/Trigger:

- **Trigger:** bei Anmeldung **+** alle 2 Tage um 9:00 (nach dem 5-Uhr-UTC-Cloud-Sync).
- `-StartWhenAvailable`: war der PC zur geplanten Zeit aus, holt Windows den Lauf beim nächsten
  Hochfahren **automatisch** nach.
- Garmin-Schritt deckt die **letzten 30 Tage** ab; `_Eingang`-Schritt verarbeitet, was im Ordner liegt.
- **Aus deiner Sicht:** einmal einrichten, danach vollautomatisch, kein manueller Schritt.

### Einrichten (in **als Administrator** gestarteter PowerShell)

```powershell
$node = "C:\Program Files\nodejs\node.exe"
$proj = "C:\Users\Administrator\Documents\Claude\Personal OS"
$action   = New-ScheduledTaskAction -Execute $node -Argument "scripts\sync-all.mjs" -WorkingDirectory $proj
$trigger1 = New-ScheduledTaskTrigger -AtLogOn
$trigger2 = New-ScheduledTaskTrigger -Daily -At 9:00am -DaysInterval 2
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName "Personal-OS-Sync" -Action $action -Trigger $trigger1,$trigger2 -Settings $settings -Description "Lokaler Auto-Agent: Garmin-MD + _Eingang-Ingestion in Obsidian/Supabase."
```

> **Hast du vorher die alte Aufgabe `Garmin-Obsidian-Sync` registriert?** Erst entfernen:
> ```powershell
> Unregister-ScheduledTask -TaskName "Garmin-Obsidian-Sync" -Confirm:$false
> ```
> Dann den Block oben ausführen (neue Aufgabe `Personal-OS-Sync`).

### Prüfen / manuell testen

```powershell
Get-ScheduledTask -TaskName "Personal-OS-Sync" | Select-Object TaskName, State
Start-ScheduledTask -TaskName "Personal-OS-Sync"     # sofort ausführen
```

### Scheduler entfernen

```powershell
Unregister-ScheduledTask -TaskName "Personal-OS-Sync" -Confirm:$false
```

> Das entfernt nur die **Automatik**. Die Scripts bleiben und können jederzeit manuell laufen
> (`node scripts/sync-all.mjs`). Garmin → Supabase (Cloud) läuft unabhängig weiter.
