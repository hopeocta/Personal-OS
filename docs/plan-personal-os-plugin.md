# Plan — Personal-OS als Cowork-Plugin bündeln

> Ziel: Deine wiederkehrenden Abläufe als **ein** Claude-Plugin verpacken, sodass sie überall
> (Desktop, Web, Mobile/Cowork) mit denselben Slash-Commands abrufbar sind — statt verstreut über
> Windows-Scheduler, lokale Scripts und einzeln installierte Skills.
>
> Arbeitsweise (CLAUDE.md): Nach **jeder** Phase stoppen → testen → committen → fragen ob weiter.

---

## Warum überhaupt

Heute sind deine Abläufe auf drei Ebenen verteilt:

| Ebene | Beispiele | Problem |
|---|---|---|
| Windows-Scheduler | `sync-all.bat` (Garmin→Obsidian, Eingang, Logbuch) | nur bei PC-Anmeldung, PC-gebunden |
| Einzelne Skills | `tagesabschluss`, `lernpartner-universell`, `krankenblatt-mkg` | je separat aufzurufen, kein gemeinsamer Einstieg |
| Vercel-Crons | Briefing, Digest, Health-Review, Newsletter | laufen autonom, aber nicht von dir auslösbar |

Ein Plugin bündelt die **von dir auslösbaren** Abläufe (nicht die Crons) hinter klaren
Slash-Commands mit einheitlichem Namespace, z. B. `/pos:tagesabschluss`, `/pos:health-review`,
`/pos:sync`, `/pos:krankenblatt`.

---

## Scope

**Im Plugin (von dir per Command auslösbar):**
1. `tagesabschluss` — bestehender Skill, 1:1 übernehmen
2. `lernpartner` — bestehender Skill (`lernpartner-universell`)
3. `krankenblatt` — bestehender Skill (`krankenblatt-mkg`)
4. `health-review` — ruft den bestehenden Endpoint `/api/health-review/run` (Monats-/Halbjahr-/Jahresbericht on demand)
5. `briefing` — liest das gespeicherte Tages-Briefing (`/api/briefing/today`) statt es neu zu bauen
6. `sync` — stößt `sync-all` an (bleibt lokal, weil Obsidian auf `localhost` läuft — der Command dokumentiert/prüft nur und ruft das lokale Script)

**NICHT im Plugin (bleibt wie es ist):**
- Vercel-Crons (laufen autonom, kein User-Trigger nötig)
- Telegram-Bot (eigener Kanal)
- Der eigentliche `sync-all`-Mechanismus (PC-gebunden; Plugin ruft ihn nur)

---

## Phasen

### Phase 0 — Entscheidungen (Rückfragen, kein Code)
Vor dem Bauen klären:
- **a)** Namespace-Kürzel: `pos` (Personal OS)? Oder lieber `me` / `os`?
- **b)** Welche der 6 Commands willst du wirklich? (Minimal-Set vs. alle)
- **c)** Sollen die drei MKG/Lern-Skills **kopiert** ins Plugin oder nur **referenziert** werden?
  (Kopie = ein Bundle, aber doppelte Pflege; Referenz = DRY, aber Skills müssen installiert bleiben.)
- **d)** Soll der Cloud-Teil (Health-Review/Briefing on demand) über die **Vercel-Prod-URL** laufen
  (von überall, braucht `CRON_SECRET`) oder nur lokal?

→ **Stopp, auf Antworten warten.**

### Phase 1 — Plugin-Gerüst
- Plugin-Verzeichnis + Manifest anlegen (Name, Beschreibung, Version, Namespace).
- Ein No-Op-Command `/pos:hilfe` als Smoke-Test (listet die geplanten Commands).
- **Test:** Plugin lädt, `/pos:hilfe` erscheint. **Commit.** Stopp.

### Phase 2 — Cloud-Commands (read-only zuerst)
- `/pos:briefing` → GET `/api/briefing/today`, formatiert ausgeben.
- `/pos:health-review <monthly|halfyear|annual>` → POST `/api/health-review/run` mit Secret.
- Secret/URL aus einer Plugin-Config (nicht hartkodiert).
- **Test:** Beide Commands liefern echte Daten aus Prod. **Commit.** Stopp.

### Phase 3 — Skill-Commands (MKG/Lernen)
- `tagesabschluss`, `lernpartner`, `krankenblatt` als Plugin-Commands einhängen
  (Kopie oder Referenz je nach Phase-0-Entscheidung).
- **Test:** Jeder Command startet den richtigen Ablauf mit Vault-Kontext. **Commit.** Stopp.

### Phase 4 — Lokaler Sync-Command + Doku
- `/pos:sync` → prüft, ob der lokale Dienst läuft, stößt `sync-all.bat` an, meldet Ergebnis.
  (Mit klarer Meldung, falls von einem Nicht-PC-Kontext aufgerufen → „nur lokal".)
- `docs/` + `README` + STATUS aktualisieren, `.claude/` Plugin-Eintrag dokumentieren.
- **Test:** End-to-end alle Commands. **Commit + Push.** Stopp.

---

## Offene Risiken / Grenzen
- **Interaktiv authentifizierte Connectors** (claude.ai) fehlen in Headless/Cron — die Cloud-Commands
  müssen über Secret+URL laufen, nicht über Session-Auth.
- **`localhost`-Obsidian** ist nicht aus der Cloud erreichbar — `/pos:sync` bleibt PC-gebunden.
- **Doppelte Skill-Pflege** bei Kopie statt Referenz (Phase-0-Entscheidung c).

---

## Nächster konkreter Schritt
Phase 0 beantworten (a–d). Danach baue ich Phase 1 (reines Gerüst, risikofrei) und stoppe zum Testen.
