"""
Enable Banking Auto-Sync — täglich ausführen

Was dieses Script macht:
1. Lädt Transaktionen der letzten 8 Tage via Enable Banking API
2. Dedupliziert gegen bestehende Supabase-Einträge
3. Kategorisiert neue Transaktionen mit Claude Haiku
4. Schreibt in revolut_transactions + aktualisiert expense_summaries
5. Gibt kurze Zusammenfassung aus (für Task Scheduler Log)

Ausführung:
  python analysis/revolut/auto_sync.py
  python analysis/revolut/auto_sync.py --days 30   # mehr Tage zurück

Benötigt in .env.local:
  ENABLE_BANKING_APP_ID
  ENABLE_BANKING_PRIVATE_KEY
  ENABLE_BANKING_SESSION_ID     (von setup_oauth.py)
  ENABLE_BANKING_ACCOUNT_ID     (von setup_oauth.py)
  SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  ANTHROPIC_API_KEY
"""

import argparse
import os
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).parent.parent.parent
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

sys.path.insert(0, str(Path(__file__).parent))
from enable_banking import from_env, normalize_transaction  # noqa: E402

# ── Supabase ──────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# ── Kategorien (identisch mit sync.py) ───────────────────────────────────────

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


def categorize_batch(ai: anthropic.Anthropic, transactions: list[dict]) -> list[str]:
    lines = []
    for i, tx in enumerate(transactions):
        sign = "+" if tx["amount_eur"] >= 0 else ""
        merchant = f" ({tx['merchant']})" if tx.get("merchant") else ""
        lines.append(f"{i+1}. {tx['description']}{merchant} | {sign}{tx['amount_eur']:.2f} {tx['currency']}")

    prompt = "Kategorisiere jede Zeile. Antworte mit einer Kategorie pro Zeile in derselben Reihenfolge.\n\n" + "\n".join(lines)
    msg = ai.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=CATEGORIZE_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text if msg.content else ""
    result_lines = [l.strip() for l in raw.strip().splitlines() if l.strip()]

    categories = []
    for line in result_lines:
        if len(line) > 1 and line[0].isdigit() and ". " in line[:4]:
            line = line.split(". ", 1)[1]
        categories.append(line if line in CATEGORIES else "Transfers & Sonstiges")

    while len(categories) < len(transactions):
        categories.append("Transfers & Sonstiges")

    return categories[: len(transactions)]


def compute_monthly_summaries(transactions: list[dict]) -> list[dict]:
    monthly: dict[tuple, dict] = defaultdict(lambda: {"total_eur": 0.0, "transaction_count": 0})
    for tx in transactions:
        if float(tx.get("amount_eur") or 0) >= 0:
            continue  # Einnahmen nicht in Ausgaben-Summary
        month = tx["date"][:7] if isinstance(tx["date"], str) else tx["date"].strftime("%Y-%m")
        key = (month, tx["category"])
        monthly[key]["total_eur"] += abs(float(tx["amount_eur"]))
        monthly[key]["transaction_count"] += 1

    return [
        {
            "month": month,
            "category": cat,
            "total_eur": round(data["total_eur"], 2),
            "transaction_count": data["transaction_count"],
        }
        for (month, cat), data in monthly.items()
    ]


# ── Session-Validity-Check ────────────────────────────────────────────────────

def check_session_validity(client, session_id: str) -> bool:
    """Prüft ob die Enable Banking Session noch aktiv ist."""
    try:
        session = client.get_session(session_id)
        status = session.get("status", "")
        if status in ("AUTHORIZED", "ACTIVE"):
            valid_until = session.get("valid_until")
            if valid_until:
                exp = datetime.fromisoformat(valid_until.replace("Z", "+00:00"))
                days_left = (exp.date() - date.today()).days
                if days_left < 14:
                    print(f"  ⚠ Session läuft in {days_left} Tagen ab → setup_oauth.py neu ausführen!")
            return True
        print(f"  ⚠ Session-Status: {status} — evtl. neu autorisieren: python analysis/revolut/setup_oauth.py")
        return False
    except Exception as e:
        print(f"  ❌ Session-Check fehlgeschlagen: {e}")
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=8, help="Wie viele Tage zurück (default: 8)")
    args = parser.parse_args()

    session_id = os.environ.get("ENABLE_BANKING_SESSION_ID", "")
    account_id = os.environ.get("ENABLE_BANKING_ACCOUNT_ID", "")

    if not session_id:
        print("❌ ENABLE_BANKING_SESSION_ID fehlt → zuerst setup_oauth.py ausführen")
        sys.exit(1)
    if not account_id:
        print("❌ ENABLE_BANKING_ACCOUNT_ID fehlt → zuerst setup_oauth.py ausführen")
        sys.exit(1)
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase-Credentials fehlen")
        sys.exit(1)

    date_from = date.today() - timedelta(days=args.days)
    date_to = date.today()
    print(f"📡 Enable Banking Sync: {date_from} → {date_to}")

    # Enable Banking Client
    try:
        client = from_env()
    except EnvironmentError as e:
        print(f"❌ {e}")
        sys.exit(1)

    # Session prüfen
    print("🔑 Session prüfen …")
    if not check_session_validity(client, session_id):
        sys.exit(1)

    # Transaktionen laden
    print(f"📥 Transaktionen laden (Konto: {account_id[:8]}…) …")
    try:
        raw_txns = client.get_transactions(account_id, session_id, date_from, date_to)
    except Exception as e:
        print(f"❌ API-Fehler: {e}")
        sys.exit(1)

    print(f"  → {len(raw_txns)} Transaktionen von API")

    if not raw_txns:
        print("Keine Transaktionen im Zeitraum.")
        sys.exit(0)

    # Normalisieren
    transactions = [normalize_transaction(tx) for tx in raw_txns]

    # Supabase-Client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Bereits importierte prüfen (date + description + amount_eur als Dedup-Key)
    res = supabase.table("revolut_transactions") \
        .select("date,description,amount_eur") \
        .gte("date", str(date_from)) \
        .execute()
    existing_keys: set[tuple] = {
        (row["date"], row["description"], float(row["amount_eur"]))
        for row in (res.data or [])
    }

    new_txns = [
        tx for tx in transactions
        if (str(tx["date"]), tx["description"], float(tx["amount_eur"])) not in existing_keys
    ]
    print(f"  → {len(new_txns)} neu (noch nicht importiert)")

    if not new_txns:
        print("✅ Nichts zu importieren — alles aktuell.")
        sys.exit(0)

    # Claude kategorisieren (Batches à 50)
    print("🤖 Kategorisiere mit Claude Haiku …")
    if not ANTHROPIC_KEY:
        print("  ⚠ ANTHROPIC_API_KEY fehlt — Kategorie wird 'Transfers & Sonstiges'")
        for tx in new_txns:
            tx["category"] = "Transfers & Sonstiges"
    else:
        ai = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
        batch_size = 50
        for i in range(0, len(new_txns), batch_size):
            batch = new_txns[i : i + batch_size]
            cats = categorize_batch(ai, batch)
            for tx, cat in zip(batch, cats):
                tx["category"] = cat
            print(f"  → Batch {i // batch_size + 1}: {len(batch)} kategorisiert")

    # Supabase schreiben
    print("💾 Schreibe in Supabase …")
    rows = [
        {
            "date": str(tx["date"]),
            "description": tx["description"],
            "merchant": tx.get("merchant"),
            "amount_eur": tx["amount_eur"],
            "currency": tx["currency"],
            "original_amount": tx.get("original_amount"),
            "original_currency": tx.get("original_currency"),
            "type": tx["type"],
            "state": tx["state"],
            "category": tx["category"],
            "raw_category": tx.get("raw_category", ""),
            "month": tx["month"],
        }
        for tx in new_txns
    ]

    for i in range(0, len(rows), 500):
        supabase.table("revolut_transactions").insert(rows[i : i + 500]).execute()
    print(f"  → {len(rows)} Transaktionen gespeichert")

    # Monats-Summaries neu berechnen (alle Daten, nicht nur neue)
    print("📊 Monats-Summaries aktualisieren …")
    all_res = supabase.table("revolut_transactions") \
        .select("date,amount_eur,category") \
        .execute()
    all_tx = [
        {
            "date": r["date"],
            "amount_eur": float(r["amount_eur"]),
            "category": r["category"],
        }
        for r in (all_res.data or [])
        if r.get("category")
    ]
    summaries = compute_monthly_summaries(all_tx)
    for s in summaries:
        supabase.table("expense_summaries").upsert(s, on_conflict="month,category").execute()
    print(f"  → {len(summaries)} Monats-Einträge aktualisiert")

    # Kurze Zusammenfassung
    total_new = sum(abs(float(tx["amount_eur"])) for tx in new_txns if float(tx["amount_eur"]) < 0)
    by_cat: dict[str, float] = defaultdict(float)
    for tx in new_txns:
        if float(tx["amount_eur"]) < 0:
            by_cat[tx["category"]] += abs(float(tx["amount_eur"]))
    top = sorted(by_cat.items(), key=lambda x: x[1], reverse=True)[:3]
    top_str = ", ".join(f"{cat}: {amt:.0f}€" for cat, amt in top)

    print(f"\n✅ Fertig! {len(new_txns)} neue Transaktionen, {total_new:.0f}€ Ausgaben")
    if top_str:
        print(f"   Top-Kategorien: {top_str}")


if __name__ == "__main__":
    main()
