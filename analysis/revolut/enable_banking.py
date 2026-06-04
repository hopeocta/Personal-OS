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

    def start_session(
        self,
        redirect_uri: str,
        aspsp_name: str = "Revolut",
        country: str = "DE",
        state: str | None = None,
    ) -> dict:
        """Startet PSU-Auth-Session. Gibt {session_id, url, state} zurück."""
        import secrets as _secrets

        if state is None:
            state = _secrets.token_urlsafe(16)

        body = {
            "access": {"balances": True, "transactions": True},
            "aspsp": {"name": aspsp_name, "country": country},
            "state": state,
            "redirect_uri": redirect_uri,
            "psu_type": "personal",
        }
        data = self._post("/sessions", body)
        return {
            "session_id": data["session_id"],
            "url": data["url"],
            "state": state,
        }

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
        """Transaktionen für einen Zeitraum laden."""
        params = {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
        }
        data = self._get(
            f"/accounts/{account_id}/transactions",
            params=params,
            extra_headers={"PSU-Consent-ID": session_id},
        )
        return data.get("transactions", [])


def normalize_transaction(raw: dict) -> dict:
    """Enable Banking Transaktionsformat → DB-Schema."""
    amount_info = raw.get("transaction_amount", {})
    try:
        amount = float(amount_info.get("amount", "0"))
    except ValueError:
        amount = 0.0
    currency = amount_info.get("currency", "EUR")

    # Währungsumrechnung falls vorhanden
    if currency != "EUR":
        exchange = raw.get("currency_exchange", {})
        exchanged_amount = exchange.get("exchanged_amount")
        amount_eur = float(exchanged_amount) if exchanged_amount else amount
    else:
        amount_eur = amount

    date_str = raw.get("booking_date") or raw.get("value_date", "")
    try:
        tx_date = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
    except ValueError:
        tx_date = date.today()

    description = (
        raw.get("remittance_information_unstructured")
        or (raw.get("remittance_information_structured") or {}).get("reference")
        or raw.get("creditor_name")
        or raw.get("debtor_name")
        or "Transaktion"
    )

    merchant = raw.get("creditor_name") or raw.get("debtor_name") or None
    entry_ref = raw.get("entry_reference", "")

    return {
        "date": tx_date,
        "description": description.strip(),
        "merchant": merchant,
        "amount_eur": round(amount_eur, 2),
        "currency": currency,
        "original_amount": round(amount, 2) if currency != "EUR" else None,
        "original_currency": currency if currency != "EUR" else None,
        "type": "ENABLE_BANKING",
        "state": "COMPLETED",
        "raw_category": entry_ref,  # Entry-Reference als Dedup-Hilfe
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
