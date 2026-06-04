"""
Enable Banking API Client
https://enablebanking.com/docs/api/reference

Env vars benötigt:
  ENABLE_BANKING_APP_ID      — Application ID aus dem Dashboard
  ENABLE_BANKING_PRIVATE_KEY — PEM-Inhalt oder Pfad zur .pem-Datei

Nach setup_oauth.py auch:
  ENABLE_BANKING_SESSION_ID  — gesetzt von setup_oauth.py
  ENABLE_BANKING_ACCOUNT_ID  — gesetzt von setup_oauth.py
"""

import os
import time
from datetime import date, datetime
from typing import Optional

import jwt
import requests


BASE_URL = "https://api.enablebanking.com"


def _load_private_key(raw: str) -> str:
    """PEM-Inhalt oder Dateipfad akzeptieren."""
    if raw.strip().startswith("-----BEGIN"):
        return raw.strip()
    path = os.path.expanduser(raw.strip())
    with open(path) as f:
        return f.read()


class EnableBankingClient:
    def __init__(self, app_id: str, private_key: str):
        self.app_id = app_id
        self.private_key = _load_private_key(private_key)
        self._token: Optional[str] = None
        self._token_exp: int = 0

    def _bearer(self) -> str:
        now = int(time.time())
        if self._token and now < self._token_exp - 60:
            return self._token
        exp = now + 3600
        # Enable Banking verlangt aud="api.enablebanking.com" im JWT-Body,
        # sonst 401 "aud is missing in JWT body".
        payload = {
            "iss": "enablebanking.com",
            "aud": "api.enablebanking.com",
            "iat": now,
            "exp": exp,
        }
        self._token = jwt.encode(
            payload,
            self.private_key,
            algorithm="RS256",
            headers={"kid": self.app_id, "typ": "JWT"},
        )
        self._token_exp = exp
        return self._token

    def _headers(self, extra: dict | None = None) -> dict:
        h = {"Authorization": f"Bearer {self._bearer()}", "Content-Type": "application/json"}
        if extra:
            h.update(extra)
        return h

    def _get(self, path: str, params: dict | None = None, extra_headers: dict | None = None) -> dict:
        resp = requests.get(f"{BASE_URL}{path}", headers=self._headers(extra_headers), params=params)
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, body: dict) -> dict:
        resp = requests.post(f"{BASE_URL}{path}", headers=self._headers(), json=body)
        resp.raise_for_status()
        return resp.json()

    def start_authorization(
        self,
        redirect_url: str,
        aspsp_name: str = "Revolut",
        country: str = "DE",
        valid_days: int = 90,
        state: str | None = None,
    ) -> dict:
        """Schritt 1: PSU-Autorisierung starten (POST /auth).

        Gibt {url, authorization_id, state} zurück. Der User öffnet `url`,
        autorisiert bei der Bank und wird mit ?code=… auf `redirect_url`
        weitergeleitet. Der Code wird dann via create_session() eingelöst.
        """
        import secrets as _secrets
        from datetime import datetime, timedelta, timezone

        if state is None:
            state = _secrets.token_urlsafe(16)

        valid_until = (datetime.now(timezone.utc) + timedelta(days=valid_days)).strftime(
            "%Y-%m-%dT%H:%M:%S.000Z"
        )
        body = {
            "access": {"valid_until": valid_until},
            "aspsp": {"name": aspsp_name, "country": country},
            "state": state,
            "redirect_url": redirect_url,
            "psu_type": "personal",
        }
        data = self._post("/auth", body)
        return {
            "url": data["url"],
            "authorization_id": data["authorization_id"],
            "state": state,
        }

    def create_session(self, code: str) -> dict:
        """Schritt 2: Session aus dem Callback-Code erstellen (POST /sessions).

        Gibt die volle Session zurück, inkl. session_id und accounts.
        """
        return self._post("/sessions", {"code": code})

    def get_session(self, session_id: str) -> dict:
        """Session-Status und verknüpfte Konten laden."""
        return self._get(f"/sessions/{session_id}")

    def get_accounts(self, session_id: str) -> list[dict]:
        data = self.get_session(session_id)
        return data.get("accounts", [])

    def get_transactions(
        self,
        account_id: str,
        session_id: str,
        date_from: date,
        date_to: date,
    ) -> list[dict]:
        """Transaktionen für einen Zeitraum laden (mit Pagination).

        Enable Banking liefert max. 50 pro Seite + einen continuation_key.
        Wir folgen dem Key, bis alle Seiten geladen sind.
        """
        all_txns: list[dict] = []
        continuation_key: str | None = None
        for _ in range(200):  # Sicherheitslimit gegen Endlosschleife
            params = {
                "date_from": date_from.isoformat(),
                "date_to": date_to.isoformat(),
            }
            if continuation_key:
                params["continuation_key"] = continuation_key
            data = self._get(
                f"/accounts/{account_id}/transactions",
                params=params,
                extra_headers={"PSU-Consent-ID": session_id},
            )
            all_txns.extend(data.get("transactions", []))
            continuation_key = data.get("continuation_key")
            if not continuation_key:
                break
        return all_txns


def normalize_transaction(raw: dict) -> dict:
    """Enable Banking Transaktionsformat → DB-Schema.

    Vorzeichen-Konvention (vom Rest des Codes erwartet):
      DBIT (Geld raus) → negativer amount_eur (Ausgabe)
      CRDT (Geld rein) → positiver amount_eur (Einnahme)
    """
    amount_info = raw.get("transaction_amount") or {}
    try:
        amount = float(amount_info.get("amount", "0"))
    except (ValueError, TypeError):
        amount = 0.0
    currency = amount_info.get("currency", "EUR")

    # Vorzeichen aus credit_debit_indicator (CRDT=+, sonst Ausgabe=-)
    indicator = raw.get("credit_debit_indicator", "")
    sign = 1.0 if indicator == "CRDT" else -1.0
    signed = sign * abs(amount)

    # Account ist EUR; Fremdwaehrung best-effort (Original separat festhalten)
    if currency != "EUR":
        amount_eur = signed  # ohne verlaessliche FX-Info best-effort 1:1
    else:
        amount_eur = signed

    date_str = raw.get("booking_date") or raw.get("value_date") or raw.get("transaction_date") or ""
    try:
        tx_date = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        tx_date = date.today()

    # Gegenpartei: bei Ausgabe der creditor, bei Einnahme der debtor
    creditor_name = (raw.get("creditor") or {}).get("name")
    debtor_name = (raw.get("debtor") or {}).get("name")
    if indicator == "CRDT":
        merchant = debtor_name or creditor_name
    else:
        merchant = creditor_name or debtor_name

    # Beschreibung: remittance_information ist eine Liste von Strings
    remit = raw.get("remittance_information")
    if isinstance(remit, list):
        description = " ".join(s for s in remit if s).strip()
    elif isinstance(remit, str):
        description = remit.strip()
    else:
        description = ""

    btc = raw.get("bank_transaction_code") or {}
    if not description:
        description = (
            (raw.get("note") or "").strip()
            or merchant
            or btc.get("description")
            or btc.get("code")
            or "Transaktion"
        )

    return {
        "date": tx_date,
        "description": description,
        "merchant": merchant,
        "amount_eur": round(amount_eur, 2),
        "currency": currency,
        "original_amount": round(signed, 2) if currency != "EUR" else None,
        "original_currency": currency if currency != "EUR" else None,
        "type": "ENABLE_BANKING",
        "state": raw.get("status") or "BOOK",
        "raw_category": btc.get("code") or "",  # z.B. TOPUP, CARD_PAYMENT
        "month": tx_date.strftime("%Y-%m"),
    }


def from_env() -> EnableBankingClient:
    """Client aus Umgebungsvariablen erstellen."""
    app_id = os.environ.get("ENABLE_BANKING_APP_ID", "")
    private_key = os.environ.get("ENABLE_BANKING_PRIVATE_KEY", "")
    if not app_id or not private_key:
        raise EnvironmentError(
            "ENABLE_BANKING_APP_ID und ENABLE_BANKING_PRIVATE_KEY müssen gesetzt sein."
        )
    return EnableBankingClient(app_id, private_key)
