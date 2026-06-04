"""
Enable Banking OAuth Setup — einmalig ausführen

Was dieses Script macht:
1. Startet lokalen HTTP-Server auf Port 8080
2. Erstellt Enable Banking Session für Revolut
3. Öffnet Browser → Bank-Login
4. Empfängt OAuth-Callback
5. Liest Konten aus der Session
6. Speichert SESSION_ID + ACCOUNT_ID in .env.local

Ausführung:
  python analysis/revolut/setup_oauth.py

Benötigt in .env.local:
  ENABLE_BANKING_APP_ID
  ENABLE_BANKING_PRIVATE_KEY   (PEM-Inhalt oder Pfad zur .pem)

Danach in .env.local gesetzt:
  ENABLE_BANKING_SESSION_ID
  ENABLE_BANKING_ACCOUNT_ID
"""

import os
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent.parent
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

sys.path.insert(0, str(Path(__file__).parent))
from enable_banking import from_env  # noqa: E402

REDIRECT_URI = os.environ.get("ENABLE_BANKING_REDIRECT_URI", "https://overdress-starch-gently.ngrok-free.dev/callback")
CALLBACK_TIMEOUT = 180  # Sekunden


callback_event = threading.Event()
callback_params: dict = {}


class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/callback":
            qs = parse_qs(parsed.query)
            callback_params.update({k: v[0] for k, v in qs.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                b"<html><body><h2>Autorisierung erfolgreich!</h2>"
                b"<p>Du kannst dieses Fenster schlie&szlig;en.</p></body></html>"
            )
            callback_event.set()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args):
        pass  # Server-Logs unterdrücken


def update_env_file(path: Path, updates: dict) -> None:
    """Schlüssel in .env.local einfügen oder überschreiben."""
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    existing = {line.split("=", 1)[0]: i for i, line in enumerate(lines) if "=" in line and not line.startswith("#")}

    for key, value in updates.items():
        entry = f"{key}={value}"
        if key in existing:
            lines[existing[key]] = entry
        else:
            lines.append(entry)

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  → .env.local aktualisiert: {', '.join(updates.keys())}")


def pick_account(accounts: list[dict]) -> dict:
    """Bestes Revolut-Konto auswählen (EUR bevorzugt)."""
    if not accounts:
        raise RuntimeError("Keine Konten in der Session gefunden.")

    eur = [a for a in accounts if a.get("currency") == "EUR"]
    if eur:
        return eur[0]

    print("\nVerfügbare Konten:")
    for i, acc in enumerate(accounts):
        iban = acc.get("account_id", {}).get("iban", "")
        currency = acc.get("currency", "?")
        name = acc.get("name", "")
        print(f"  [{i}] {name} {iban} ({currency})")

    idx = int(input("Kontonummer wählen [0]: ") or "0")
    return accounts[idx]


def main():
    print("=== Enable Banking OAuth Setup ===\n")

    client = from_env()

    # Session starten
    print("1. Enable Banking Session erstellen …")
    session = client.start_session(redirect_uri=REDIRECT_URI)
    session_id = session["session_id"]
    auth_url = session["url"]
    print(f"   Session ID: {session_id}")

    # Lokalen Callback-Server starten
    # Explizit IPv4 (127.0.0.1): ngrok leitet localhost sonst ueber IPv6 (::1)
    # weiter und der Server lauscht nur auf IPv4 -> ERR_NGROK_8012. ngrok muss
    # entsprechend mit "ngrok http 127.0.0.1:8080" gestartet werden.
    server = HTTPServer(("127.0.0.1", 8080), CallbackHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    # Browser öffnen
    print(f"\n2. Browser öffnet sich → bitte bei deiner Bank einloggen …")
    print(f"   URL: {auth_url}")
    webbrowser.open(auth_url)

    # Auf Callback warten
    print(f"\n3. Warte auf Callback (max. {CALLBACK_TIMEOUT}s) …")
    received = callback_event.wait(timeout=CALLBACK_TIMEOUT)
    server.shutdown()

    if not received:
        print("\n❌ Timeout — kein Callback erhalten. Bitte erneut versuchen.")
        sys.exit(1)

    print(f"   Callback empfangen: {callback_params}")

    # Konten aus Session laden
    print("\n4. Konten aus Session laden …")
    import time
    time.sleep(2)  # Kurz warten, damit die Bank die Session abschließt

    try:
        accounts = client.get_accounts(session_id)
    except Exception as e:
        print(f"\n❌ Session konnte nicht gelesen werden: {e}")
        print("   Prüfe ob die Bank-Authentifizierung erfolgreich war.")
        sys.exit(1)

    if not accounts:
        print("\n⚠ Keine Konten gefunden. Session ggf. noch nicht aktiv.")
        print(f"   Session ID: {session_id}")
        print("   Speichere Session ID trotzdem — auto_sync.py prüft Status erneut.")
        account_id = ""
    else:
        account = pick_account(accounts)
        account_id = account.get("uid") or account.get("id") or account.get("account_id", {}).get("iban", "")
        currency = account.get("currency", "EUR")
        name = account.get("name", "Revolut")
        print(f"\n   Gewähltes Konto: {name} ({currency}) — ID: {account_id}")

    # .env.local aktualisieren
    print("\n5. .env.local aktualisieren …")
    env_path = ROOT / ".env.local"
    updates = {"ENABLE_BANKING_SESSION_ID": session_id}
    if account_id:
        updates["ENABLE_BANKING_ACCOUNT_ID"] = account_id
    update_env_file(env_path, updates)

    print("\n✅ Setup abgeschlossen!")
    print("   Nächster Schritt: python analysis/revolut/auto_sync.py")
    print("\n   Für täglichen Auto-Sync → Windows Task Scheduler:")
    print("   Action: python analysis\\revolut\\auto_sync.py")
    print("   Trigger: täglich 06:00 Uhr")


if __name__ == "__main__":
    main()
