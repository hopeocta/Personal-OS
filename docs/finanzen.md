# Finanzen (Revolut)

Ausgaben-Tracking auf Basis von Revolut-Transaktionen. Import läuft über die **Python-Ebene**
(`analysis/revolut/`), Auswertung auf der Seite `/finanzen`.

> Hintergrund: GoCardless (Bank-Account-Data) wurde 07/2025 geschlossen → Umstieg auf
> **Enable Banking** (PSD2-Aggregator). Details im Session-Log (`STATUS.md`) + Memory.

---

## Datenfluss

```
Revolut ──(Enable Banking API / CSV)──► analysis/revolut/ ──► Supabase
                                                              ├─ revolut_transactions
                                                              └─ expense_summaries (Monats-Aggregate)
                                                                      │
                                          /api/finanzen/summary ◄─────┘
                                                      │
                                              /finanzen (Seite)
```

---

## Python-Scripts (`analysis/revolut/`)

| Script | Zweck |
|---|---|
| `enable_banking.py` | API-Client: JWT-Auth (App-ID + Private Key), Konten & Transaktionen abrufen |
| `setup_oauth.py` | Einmal-/Re-Auth-Flow: ngrok-Callback → schreibt `SESSION_ID` + `ACCOUNT_ID` in `.env.local` |
| `auto_sync.py` | Täglich: letzte 8 Tage abrufen, gegen Supabase deduplizieren, mit **Claude Haiku** kategorisieren, `revolut_transactions` + `expense_summaries` schreiben |
| `sync.py` | CSV-Import (Revolut-Export, z.B. per Telegram „💰 Revolut Import") |

**Aufruf** (immer mit `py -3.14`, nie nacktes `python` — WindowsApps-Stub-Falle):
```
py -3.14 analysis/revolut/auto_sync.py            # 8 Tage
py -3.14 analysis/revolut/auto_sync.py --days 30  # mehr Historie
```

### Re-Auth (Session läuft ~90 Tage)
1. ngrok-Tunnel starten (fester Pfad in STATUS.md / Memory).
2. `py -3.14 analysis/revolut/setup_oauth.py` → Revolut-Login → schreibt SESSION_ID/ACCOUNT_ID neu.

Benötigte Env: `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_PRIVATE_KEY` (Pfad zur `.pem`, gitignored),
`ENABLE_BANKING_SESSION_ID`, `ENABLE_BANKING_ACCOUNT_ID`, `ENABLE_BANKING_REDIRECT_URI`.

---

## Web-Seite & Routen

- **`/finanzen`** — Monats-Gesamtausgaben, Kategorie-Aufschlüsselung, letzte 20 Ausgaben.
- **`GET /api/finanzen/summary?months=6`** — liest `expense_summaries` + letzte Transaktionen,
  rechnet Monats- und Kategorie-Summen.
- **`GET /api/cron/finanzen`** — Cron **2. d. Monats, 10:00 UTC** — Monats-Auswertung.

---

## Tabellen

| Tabelle | Inhalt |
|---|---|
| `revolut_transactions` | Einzeltransaktionen (Betrag, Merchant, Kategorie, `month`) |
| `expense_summaries` | Monats-Summe je Kategorie (von Python vorberechnet) |

(Migration `0010`.) Kategorisierung der Transaktionen via Claude Haiku im Sync-Script.
