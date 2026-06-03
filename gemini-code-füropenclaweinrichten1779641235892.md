# PROJEKT-SPEZIFIKATION: Token-Optimierte Infrastruktur (OpenClaw + Dashboard)

## 1. System-Architektur & Ortsunabhängigkeit (Tailscale/ngrok)
Das System nutzt OpenClaw auf dem lokalen Rechner als zentrales Gateway und verbindet es mit der Anthropic API (`claude-4-6-sonnet-latest`). Um von überall (PC, Laptop, Smartphone) verschlüsselt auf dieselben Dateien und Sessions zuzugreifen, wird folgendes Setup implementiert:

* **Zentraler Server:** OpenClaw läuft als permanenter Daemon auf dem Haupt-PC zu Hause. Wenn der PC aus ist (z.B. im Urlaub), dient TypingMind als manueller Fallback über diese API.
* **Netzwerk-Tunneling:** Der lokale OpenClaw-HTTP-Server (Port `18789`) wird über einen sicheren Tunnel (Tailscale oder ngrok) freigegeben. CORS wird explizit für die Vercel-Dashboard-Domain erlaubt.
* **Kanal 1 (Mobil):** Der OpenClaw-Gateway routet Inputs über deinen Telegram-Bot. Audio-Vorträge (Sprachnachrichten von unterwegs) werden serverseitig transkribiert.
* **Kanal 2 (Desktop/Laptop):** Das Vercel-Dashboard bindet ein Web-Terminal im minimalistischen Claude-Stil ein. Es verbindet sich via Tunnel-URL mit dem lokalen OpenClaw-Server. Das Eingabefeld verfügt über einen voll funktionalen, nativen Audio-Recorder-Button inklusive visuellem Audio-Wellen-Feedback (exakt wie im originalen Sonnet 4.6 Web-UI). Gesprochene Gedanken werden direkt im Browser über die Web Audio API aufgezeichnet, als Audio-Blob an den OpenClaw-Dienst gestreamt und dort nahtlos transkribiert in den Chat-Loop eingespeist.

## 2. Die PDF-Pipeline (Vorbereitung für Obsidian)
Da das Lehrmaterial ausschließlich als PDFs vorliegt, erstellt Claude Code ein einmaliges Vorbereitungsskript:
1.  **Text-Extraktion:** Das Skript liest die medizinischen Fachbuch-PDFs lokal ein.
2.  **Thematische Segmentierung:** Die Inhalte werden kapitelweise an die API übermittelt. Das Modell zerlegt die Bücher in präzise, thematisch fokussierte Einzeldateien (z. B. `Kiefernekrose_MRONJ.md`, `Osteomyelitis.md`).
3.  **Ablage:** Die generierten Dateien werden im lokalen Obsidian-Vault (`~/.openclaw/workspace`) abgelegt, wo bereits deine historischen Session-Protokolle als `.md` liegen.

## 3. Strikte Token-Effizienz & Laufende Überprüfung
Um zu verhindern, dass komplexe medizinische Analysen nach einer gewissen Zeit dein API-Budget sprengen, nutzen wir die nativen Schutzmechanismen von OpenClaw und erweitern sie um ein Stabilitäts-Feature:

* **Gezieltes Caching:** Eine Session wird themenspezifisch gestartet (z. B. „*Starten: Kiefernekrose*“). OpenClaw lädt selektiv nur die passende Datei (z. B. `Kiefernekrose_MRONJ.md`) und die dazugehörigen historischen Protokolle.
* **Prompt Caching:** Die Daten werden im `system`-Array mit `"cache_control": {"type": "ephemeral"}` markiert (90 % Rabatt auf wiederkehrende Eingaben).
* **Automatisches Context Pruning (Die Kostenbremse):** Da Chat-Historien bei langen Sessions anschwellen, aktivieren wir in der `openclaw.json` das native `contextPruning` mit dem Modus `cache-ttl`. Sobald das 5-Minuten-Cache-Fenster abläuft, bereinigt OpenClaw den Hintergrund-Ballast, um die nächste Cache-Write-Größe so klein und günstig wie möglich zu halten.
* **Cache-Keep-Alive-Trigger:** Integration einer automatischen Routine im Hintergrund des Terminals. Wenn während des Lernens für mehr als 4 Minuten keine neue Anfrage gesendet wird, triggert das Web-Terminal einen minimalen, kostenneutralen Ping-Request an OpenClaw, um den Anthropic-Server-Cache aktiv zu halten, damit er bei längeren Denk- oder Lesepausen nicht nach 5 Minuten verfällt.

## 4. Echtzeit Token-Counter
Zur permanenten visuellen Überwachung der Effizienz wird die Token-Kontrolle auf zwei Ebenen integriert:
* **Im Backend/Messenger:** In der OpenClaw-Konfiguration wird der Chat-Befehl `/usage tokens` als Standard definiert. OpenClaw schlüsselt nach jedem Request die exakten API-Rückgabewerte für `cacheRead` (günstige Cache-Treffer) und `cacheWrite` (teure Erst-Einlesungen) auf.
* **Im Dashboard-UI:** Das Web-Terminal liest diese normalisierten Usage-Metadaten (`cacheRead`, `cacheWrite`, `input`, `output`) aus dem API-Response-Payload aus und visualisiert sie als kleine, unaufdringliche Statusanzeige in der Ecke des Terminals (z. B. *"Letzter Request: 92% im Cache"*).

## 5. Integration bestehender Skills
Das System greift für die Logik ausschließlich auf deine zwei bereits vorhandenen Markdown-Dateien zurück. Es werden keine Verhaltensregeln im Skript dupliziert:
1.  **Lernpartner-Modus:** Deine existierende `lernpartner_skill.md` wird beim Session-Start in den System-Prompt geladen.
2.  **Session-Ende-Skill:** Deine existierende `session_ende_skill.md` wird bei Beendigung (z. B. `/end`) aufgerufen. Das Zustandsprotokoll wird als neue, separate Datei im Obsidian-Vault abgelegt und das aktive Chat-Array sofort geleert.