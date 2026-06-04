"""
Revolut CSV / Excel → Supabase

Verwendung:
  python analysis/revolut/sync.py path/to/revolut-export.csv
  python analysis/revolut/sync.py path/to/revolut-export.xlsx

Benötigt .env im Projekt-Root:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  ANTHROPIC_API_KEY

Revolut-Export-Spalten (CSV + Excel identisch):
  Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance
"""

import csv
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import anthropic
from dotenv import load_dotenv
from supabase import create_client

# .env aus Projekt-Root laden
load_dotenv(Path(__file__).parent.parent.parent / ".env.local")
load_dotenv(Path(__file__).parent.parent.parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"] or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

if not SUPABASE_URL:
    SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")

CATEGORIES = [
    "Lebensmittel",
    "Restaurants & Cafés",
    "Transport",
    "Gesundheit & Sport",
    "Studium & Bücher",
    "Musik & Technik",
    "Wohnen & Nebenkosten",
    "Shopping & Freizeit",
    "Reisen",
    "Einnahmen",
    "Transfers & Sonstiges",
]

CATEGORIZE_SYSTEM = f"""Du kategorisierst Banktransaktionen. Antworte NUR mit dem Kategorienamen — kein Satz, keine Erklärung.

Verfügbare Kategorien:
{chr(10).join(f'- {c}' for c in CATEGORIES)}

Regeln:
- Positive Beträge = Einnahmen → Kategorie "Einnahmen"
- Revolut-interne Transfers (Top-up, Wechsel) → "Transfers & Sonstiges"
- Lieferando, Uber Eats, McDonald's etc. → "Restaurants & Cafés"
- DB Bahn, MVG, BVG, Uber → "Transport"
- Amazon ohne klaren Kontext → "Shopping & Freizeit"
- Medikamente, Apotheke, Sport-Equipment → "Gesundheit & Sport"
"""


def _parse_rows(rows: list[dict]) -> list[dict]:
    """Gemeinsame Logik für CSV- und Excel-Rows (normalisierte Spaltennamen)."""
    result = []
    for normalized in rows:
        date_str = normalized.get("completed date") or normalized.get("started date", "")
        try:
            tx_date = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        except ValueError:
            try:
                tx_date = datetime.strptime(date_str[:10], "%d.%m.%Y").date()
            except ValueError:
                print(f"  ⚠ Datum übersprungen: {date_str}")
                continue

        state = normalized.get("state", "COMPLETED").upper()
        if state not in ("COMPLETED", "REVERTED"):
            continue

        amount_str = str(normalized.get("amount", "0")).replace(",", ".")
        try:
            amount = float(amount_str)
        except ValueError:
            continue

        currency = normalized.get("currency", "EUR").upper()
        result.append(
            {
                "date": tx_date,
                "description": normalized.get("description", ""),
                "amount_eur": amount,
                "currency": currency,
                "type": normalized.get("type", ""),
                "state": state,
                "raw_category": normalized.get("category", ""),
            }
        )
    return result


def parse_revolut_csv(filepath: str) -> list[dict]:
    with open(filepath, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = [{k.strip().lower(): v.strip() for k, v in row.items()} for row in reader]
    return _parse_rows(rows)


def parse_revolut_excel(filepath: str) -> list[dict]:
    import openpyxl
    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb.active
    headers = None
    rows = []
    for row in ws.iter_rows(values_only=True):
        if headers is None:
            headers = [str(c).strip().lower() if c else "" for c in row]
            continue
        normalized = {headers[i]: (str(v).strip() if v is not None else "") for i, v in enumerate(row) if i < len(headers)}
        rows.append(normalized)
    wb.close()
    return _parse_rows(rows)


def categorize_batch(client: anthropic.Anthropic, transactions: list[dict]) -> list[str]:
    """Kategorisiert bis zu 50 Transaktionen in einem einzigen Claude-Aufruf."""
    lines = []
    for i, tx in enumerate(transactions):
        sign = "+" if tx["amount_eur"] > 0 else ""
        lines.append(f"{i+1}. {tx['description']} | {sign}{tx['amount_eur']:.2f} {tx['currency']}")

    prompt = "Kategorisiere jede Zeile. Antworte mit einer Kategorie pro Zeile in derselben Reihenfolge.\n\n" + "\n".join(lines)

    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=CATEGORIZE_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = msg.content[0].text if msg.content else ""
    result_lines = [l.strip() for l in raw.strip().splitlines() if l.strip()]

    # Zeilen-Nummerierung entfernen falls vorhanden ("1. Lebensmittel" → "Lebensmittel")
    categories = []
    for line in result_lines:
        if ". " in line[:4]:
            line = line.split(". ", 1)[1]
        # Validieren
        if line in CATEGORIES:
            categories.append(line)
        else:
            categories.append("Transfers & Sonstiges")

    # Falls Claude weniger Zeilen zurückgab als erwartet, auffüllen
    while len(categories) < len(transactions):
        categories.append("Transfers & Sonstiges")

    return categories[: len(transactions)]


def compute_monthly_summaries(transactions: list[dict]) -> list[dict]:
    from collections import defaultdict

    monthly: dict[tuple[str, str], dict] = defaultdict(lambda: {"total_eur": 0.0, "transaction_count": 0})

    for tx in transactions:
        if tx["amount_eur"] >= 0:
            continue  # Einnahmen nicht in Ausgaben-Summary
        month = tx["date"].strftime("%Y-%m")
        key = (month, tx["category"])
        monthly[key]["total_eur"] += abs(tx["amount_eur"])
        monthly[key]["transaction_count"] += 1

    summaries = []
    for (month, category), data in monthly.items():
        summaries.append(
            {
                "month": month,
                "category": category,
                "total_eur": round(data["total_eur"], 2),
                "transaction_count": data["transaction_count"],
            }
        )
    return summaries


def main():
    if len(sys.argv) < 2:
        print("Verwendung: python analysis/revolut/sync.py <revolut-export.csv>")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        print(f"Datei nicht gefunden: {csv_path}")
        sys.exit(1)

    ext = Path(csv_path).suffix.lower()
    print(f"📂 Lese {csv_path} …")
    if ext in (".xlsx", ".xls"):
        transactions = parse_revolut_excel(csv_path)
    else:
        transactions = parse_revolut_csv(csv_path)
    print(f"  → {len(transactions)} Transaktionen (COMPLETED)")

    if not transactions:
        print("Keine Transaktionen gefunden.")
        sys.exit(0)

    # Supabase-Client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Bereits importierte Transaktionen prüfen (anhand Datum + Beschreibung + Betrag)
    existing_keys: set[tuple] = set()
    res = supabase.table("revolut_transactions").select("date,description,amount_eur").execute()
    for row in res.data or []:
        existing_keys.add((row["date"], row["description"], float(row["amount_eur"])))

    new_transactions = [
        tx for tx in transactions
        if (str(tx["date"]), tx["description"], float(tx["amount_eur"])) not in existing_keys
    ]
    print(f"  → {len(new_transactions)} neu (noch nicht importiert)")

    if not new_transactions:
        print("Nichts zu importieren.")
        sys.exit(0)

    # Claude kategorisieren (Batches à 50)
    print("🤖 Kategorisiere mit Claude Haiku …")
    ai = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    batch_size = 50
    for i in range(0, len(new_transactions), batch_size):
        batch = new_transactions[i : i + batch_size]
        categories = categorize_batch(ai, batch)
        for tx, cat in zip(batch, categories):
            tx["category"] = cat
        print(f"  → Batch {i//batch_size + 1}: {len(batch)} Transaktionen kategorisiert")

    # In Supabase schreiben
    print("💾 Schreibe in Supabase …")
    rows = [
        {
            "date": str(tx["date"]),
            "description": tx["description"],
            "amount_eur": tx["amount_eur"],
            "currency": tx["currency"],
            "type": tx["type"],
            "state": tx["state"],
            "category": tx["category"],
            "raw_category": tx["raw_category"],
            "month": tx["date"].strftime("%Y-%m"),
        }
        for tx in new_transactions
    ]

    # In Chunks à 500 einfügen
    for i in range(0, len(rows), 500):
        chunk = rows[i : i + 500]
        supabase.table("revolut_transactions").insert(chunk).execute()
    print(f"  → {len(rows)} Transaktionen gespeichert")

    # Monatliche Summaries neu berechnen (alle importierten Daten, nicht nur neue)
    print("📊 Berechne Monats-Summaries …")
    all_res = supabase.table("revolut_transactions").select("date,amount_eur,category").execute()
    all_tx = [
        {"date": datetime.strptime(r["date"], "%Y-%m-%d").date(), "amount_eur": float(r["amount_eur"]), "category": r["category"]}
        for r in (all_res.data or [])
        if r.get("category")
    ]
    summaries = compute_monthly_summaries(all_tx)

    # Upsert (month + category ist UNIQUE)
    for summary in summaries:
        supabase.table("expense_summaries").upsert(summary, on_conflict="month,category").execute()
    print(f"  → {len(summaries)} Monats-Einträge aktualisiert")

    print("\n✅ Fertig!")


if __name__ == "__main__":
    main()
