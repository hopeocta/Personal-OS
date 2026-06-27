"""
Gesundheits-Korrelationen & Trends — scipy

Berechnet Pearson-Korrelationen und lineare Trends aus Garmin-Daten
und schreibt die Ergebnisse in health_analysis_results.

Verwendung:
  python analysis/health/correlations.py           # letzte 90 Tage
  python analysis/health/correlations.py --days 180

Benötigt .env.local im Projekt-Root:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import argparse
import os
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from scipy import stats
from supabase import create_client

load_dotenv(Path(__file__).parent.parent.parent / ".env.local")
load_dotenv(Path(__file__).parent.parent.parent / ".env")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def pearson(x: list[float], y: list[float]) -> dict | None:
    """Pearson-Korrelation mit p-Wert. None wenn zu wenig Daten."""
    pairs = [(a, b) for a, b in zip(x, y) if a is not None and b is not None and not (np.isnan(a) or np.isnan(b))]
    if len(pairs) < 10:
        return None
    xs, ys = zip(*pairs)
    r, p = stats.pearsonr(xs, ys)
    return {"r": round(float(r), 3), "p": round(float(p), 4), "n": len(pairs)}


def trend(values: list[float | None]) -> dict | None:
    """Linearer Trend über Index. Gibt slope/r pro Tag zurück."""
    clean = [(i, v) for i, v in enumerate(values) if v is not None and not np.isnan(v)]
    if len(clean) < 14:
        return None
    xs, ys = zip(*clean)
    slope, intercept, r, p, _ = stats.linregress(xs, ys)
    # Slope pro 30 Tage (für lesbarere Zahlen)
    return {
        "slope_per_30d": round(float(slope) * 30, 2),
        "r": round(float(r), 3),
        "p": round(float(p), 4),
        "direction": "up" if slope > 0 else "down",
        "n": len(clean),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=90)
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    since = (date.today() - timedelta(days=args.days)).isoformat()
    period_start = since
    period_end = date.today().isoformat()

    print(f"📊 Lade Garmin-Daten seit {since} …")

    sleep_res = supabase.table("garmin_sleep").select(
        "date,hrv_nightly,total_sleep_min,sleep_score,resting_hr,deep_sleep_min,rem_sleep_min"
    ).eq("user_id", "me").gte("date", since).order("date").execute()

    training_res = supabase.table("garmin_training").select(
        "date,acwr,vo2max,ctl,atl"
    ).eq("user_id", "me").gte("date", since).order("date").execute()

    battery_res = supabase.table("garmin_body_battery").select(
        "date,morning_score,stress_avg"
    ).eq("user_id", "me").gte("date", since).order("date").execute()

    sleep_by_date = {r["date"]: r for r in (sleep_res.data or [])}
    training_by_date = {r["date"]: r for r in (training_res.data or [])}
    battery_by_date = {r["date"]: r for r in (battery_res.data or [])}

    all_dates = sorted(set(sleep_by_date) | set(training_by_date) | set(battery_by_date))
    print(f"  → {len(all_dates)} Tage mit Daten")

    if len(all_dates) < 10:
        print("  ⚠ Zu wenig Daten für sinnvolle Korrelationen.")
        return

    # Zeitreihen aufbauen
    hrv = [sleep_by_date.get(d, {}).get("hrv_nightly") for d in all_dates]
    sleep_min = [sleep_by_date.get(d, {}).get("total_sleep_min") for d in all_dates]
    sleep_score = [sleep_by_date.get(d, {}).get("sleep_score") for d in all_dates]
    rhr = [sleep_by_date.get(d, {}).get("resting_hr") for d in all_dates]
    deep_sleep = [sleep_by_date.get(d, {}).get("deep_sleep_min") for d in all_dates]
    rem_sleep = [sleep_by_date.get(d, {}).get("rem_sleep_min") for d in all_dates]
    acwr = [training_by_date.get(d, {}).get("acwr") for d in all_dates]
    vo2max = [training_by_date.get(d, {}).get("vo2max") for d in all_dates]
    ctl = [training_by_date.get(d, {}).get("ctl") for d in all_dates]
    atl = [training_by_date.get(d, {}).get("atl") for d in all_dates]
    tsb = [
        (c - a) if c is not None and a is not None else None
        for c, a in zip(ctl, atl)
    ]
    battery = [battery_by_date.get(d, {}).get("morning_score") for d in all_dates]
    stress = [battery_by_date.get(d, {}).get("stress_avg") for d in all_dates]

    # ── Korrelationen ────────────────────────────────────────────────────────
    print("🔗 Berechne Korrelationen …")
    correlations: dict[str, dict] = {}

    pairs = [
        ("hrv_x_acwr",        hrv,         acwr,        "HRV ↔ ACWR"),
        ("hrv_x_sleep_min",   hrv,         sleep_min,   "HRV ↔ Schlafdauer"),
        ("hrv_x_sleep_score", hrv,         sleep_score, "HRV ↔ Schlafqualität"),
        ("hrv_x_stress",      hrv,         stress,      "HRV ↔ Stress"),
        ("rhr_x_sleep_score", rhr,         sleep_score, "Ruhe-HF ↔ Schlafqualität"),
        ("rhr_x_acwr",        rhr,         acwr,        "Ruhe-HF ↔ ACWR"),
        ("acwr_x_sleep_min",  acwr,        sleep_min,   "ACWR ↔ Schlafdauer"),
        ("battery_x_sleep",   battery,     sleep_score, "Body Battery ↔ Schlaf"),
        ("battery_x_stress",  battery,     stress,      "Body Battery ↔ Stress"),
        ("ctl_x_hrv",         ctl,         hrv,         "CTL ↔ HRV"),
        # Neu: Trainingsbelastung & Fitness
        ("tsb_x_hrv",         tsb,         hrv,         "TSB (Frische) ↔ HRV"),
        ("tsb_x_battery",     tsb,         battery,     "TSB (Frische) ↔ Body Battery"),
        ("atl_x_hrv",         atl,         hrv,         "ATL (akute Last) ↔ HRV"),
        ("rhr_x_ctl",         rhr,         ctl,         "Ruhe-HF ↔ CTL (Fitness)"),
        ("vo2max_x_ctl",      vo2max,      ctl,         "VO2max ↔ CTL"),
        # Neu: Schlafphasen
        ("deep_x_hrv",        deep_sleep,  hrv,         "Tiefschlaf ↔ HRV"),
        ("rem_x_hrv",         rem_sleep,   hrv,         "REM-Schlaf ↔ HRV"),
        ("deep_x_battery",    deep_sleep,  battery,     "Tiefschlaf ↔ Body Battery"),
    ]

    for key, x, y, label in pairs:
        result = pearson(x, y)
        if result:
            correlations[key] = {**result, "label": label}
            direction = "positiv" if result["r"] > 0 else "negativ"
            strength = "stark" if abs(result["r"]) > 0.5 else "moderat" if abs(result["r"]) > 0.3 else "schwach"
            sig = "signifikant" if result["p"] < 0.05 else "nicht sig."
            print(f"  {label}: r={result['r']:+.3f} ({strength}, {direction}, {sig}, n={result['n']})")
        else:
            valid = sum(1 for a, b in zip(x, y) if a is not None and b is not None)
            print(f"  ⚠ {label}: übersprungen (nur {valid} gültige Paare)")

    # ── Trends ───────────────────────────────────────────────────────────────
    print("📈 Berechne Trends …")
    trends: dict[str, dict] = {}

    trend_series = [
        ("hrv_trend",        hrv,        "HRV"),
        ("rhr_trend",        rhr,        "Ruhe-HF"),
        ("vo2max_trend",     vo2max,     "VO2max"),
        ("sleep_trend",      sleep_score,"Schlafqualität"),
        ("sleep_min_trend",  sleep_min,  "Schlafdauer"),
        ("deep_sleep_trend", deep_sleep, "Tiefschlaf"),
        ("rem_sleep_trend",  rem_sleep,  "REM-Schlaf"),
        ("ctl_trend",        ctl,        "CTL (Fitness)"),
        ("atl_trend",        atl,        "ATL (akute Last)"),
        ("tsb_trend",        tsb,        "TSB (Frische)"),
        ("battery_trend",    battery,    "Body Battery"),
    ]

    for key, values, label in trend_series:
        result = trend(values)
        if result:
            trends[key] = {**result, "label": label}
            arrow = "↑" if result["direction"] == "up" else "↓"
            print(f"  {label}: {arrow} {result['slope_per_30d']:+.1f}/Monat (r={result['r']:+.2f})")

    # ── In Supabase schreiben (alte Zeilen ersetzen) ─────────────────────────
    print("💾 Schreibe in health_analysis_results …")

    supabase.table("health_analysis_results").delete().eq("type", "correlations").execute()
    supabase.table("health_analysis_results").insert({
        "type": "correlations",
        "period_start": period_start,
        "period_end": period_end,
        "results": correlations,
    }).execute()

    supabase.table("health_analysis_results").delete().eq("type", "trends").execute()
    supabase.table("health_analysis_results").insert({
        "type": "trends",
        "period_start": period_start,
        "period_end": period_end,
        "results": trends,
    }).execute()

    print(f"\n✅ Fertig — {len(correlations)} Korrelationen, {len(trends)} Trends gespeichert.")


if __name__ == "__main__":
    main()
