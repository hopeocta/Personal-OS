# Marktanalyse-System

> Zwei Claude-Skills (`dailymarketskill`, `deepmarketskill`) im Obsidian-Vault unter `KI/Skills/`.
> Analysieren Markt-Events in Gaming, AI, AI-Infrastruktur, Healthcare/MedTech, Industrial AI.
> Schreiben nach jedem Run automatisch in Obsidian (`KI/Marktanalysen/`) **und** Supabase.

Aktivierung: `daily market` bzw. `deep market` in Claude tippen. Daily = täglich möglich, Deep = 1×/Woche (empfohlen Freitag/Sonntag), baut auf Daily auf (Blocks 0–11 + D, dann 6–16).

---

## Obsidian-Artefakte (`D:\Obsidian Vault\KI\Marktanalysen\`)

| Datei/Ordner | Inhalt |
|---|---|
| `Daily Logs/YYYY-MM-DD.md` | Vollständiger Output je Run |
| `Company Profiles/*.md` | Pro Unternehmen: Macro-Sensitivität, Supply-Chain, Event-Log, Pattern Library |
| `_investment-signals-log.md` | Kumulatives Signal-Register (Block 15 schreibt, Block 16 wertet aus) |
| `_company-profile-template.md` | Vorlage für neue Profile |

**Regel:** Jedes in einem Run genannte Unternehmen bekommt ein Profil (neu oder Event-Log-Update). Jedes Block-15-Signal-Unternehmen ohne Profil → sofort anlegen.

---

## Supabase-Tabellen (project_id `pypwgmmavnbudyrtykqg`)

| Tabelle | Befüllt von | Inhalt |
|---|---|---|
| `market_daily_macro` | Block 0 / D | Makro-Snapshot (VIX, Yields, DXY, HY, Öl) + Interpretation, `ON CONFLICT (date)` |
| `market_events` | Block 1–5 | Einzelne Events (company NOT NULL — bei reinen Makro-Events `company='Markt (Macro)'`) |
| `market_reactions` | Block 10 | Kursreaktionen je Event |
| `market_investment_signals` | Block 15 | Alle Signale mit Entry, **Outcome** (delta_pct, status, exit, post_mortem, pattern_learned) |
| `market_signal_reviews` | Block 16 | **Wöchentlicher Snapshot** je Signal → Zeitverlauf |

---

## Auswertungs-Schicht (eingeführt 12.06.2026)

Ziel: langfristig sehen, **ob Prognosen gut/schlecht waren und welche Signale/Faktoren überwogen**.

Die Lücke davor: `market_investment_signals` enthielt nur den Entry; Δ%/Status standen nur im Markdown. Block 16 schreibt jetzt die Outcomes in die DB zurück (siehe `deepmarketskill` → „File & Database Write Instructions (Deep-Run)"). Pflicht pro Deep-Run:

1. **Signale updaten** — `delta_pct`, `status`, ggf. `exit_price`/`exit_date`/`post_mortem`/`pattern_learned`. Neue Signale immer voll INSERTen (auch Mittel/Niedrig + Avoid, nicht nur Block-D-Hoch).
2. **Snapshot schreiben** — eine Zeile pro Signal in `market_signal_reviews` (`ON CONFLICT (review_date, signal_id)`).
3. **Performance prüfen** — Block 16d aus den Views statt manueller Zählung.

### Views

| View | Antwortet |
|---|---|
| `market_signal_performance_by_tier` | Win-Rate + Ø-Δ% je Tier (Kurzfristig/Mittelfristig/Stabil/Avoid) |
| `market_signal_performance_by_factor` | Ø-Δ% je Trigger-Block — welche Analyse-Bausteine die besten Signale liefern |

Beispiel-Abfragen:
```sql
-- Welches Tier performt?
SELECT tier, total, mixed, open_signals, avg_delta_pct, win_rate_closed
FROM market_signal_performance_by_tier;

-- Welche Analyse-Blöcke treffen?
SELECT trigger_block, signals, avg_delta_pct, positive, negative
FROM market_signal_performance_by_factor
ORDER BY avg_delta_pct DESC;

-- Zeitverlauf eines Signals
SELECT review_date, price, delta_pct, status
FROM market_signal_reviews WHERE signal_id = '2026-23-K1' ORDER BY review_date;
```

**Status-Vokabular** (für saubere Aggregation): `Open` · `Open (re-baselined)` · `Playing out` · `Mixed` · `Closed-Win` · `Closed-Loss` · `Invalidated`. Win-Rate zählt nur geschlossene Signale.

**Aussagekraft:** Erste belastbare Auswertung ab ~8–12 Wochen (vorher Rauschen — alle Signale <2 Wochen).

---

## Signal-ID-Schema

`YYYY-WW-[Tier][Rank]` — z.B. `2026-24-K2` (Woche 24, Kurzfristig, Rank 2). Tiers: `K` Kurzfristig (1–4 Wo.), `M` Mittelfristig (1–3 Mo.), `S` Stabil (1–3 J.), `A` Avoid.

## Datenqualitäts-Regel (aus Audit 12.06.2026)

Entry-Preise **immer live abrufen** (Yahoo Finance), nie schätzen. Falls ein Alt-Signal mit Schätz-Entry existiert → re-baselinen: `entry_price`/`entry_date` auf den Re-Baseline-Tag, Grund in `thesis`. (Betraf 12.06. die Signale TSM 23-M2/S2, ABB 23-M3, SIE 23-S3.)

---

*Hinweis: Das Marktanalyse-System lebt im Vault + Supabase, nicht in der Next.js-App. Kein Reminder eingerichtet (Stand 12.06.2026) — manueller Start via `deep market`.*
