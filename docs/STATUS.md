# Personal OS — Status

> Hier steht: was funktioniert, was geplant ist, was manuell zu tun ist.
> Details zu jedem Feature → `docs/` Ordner. Gesamtübersicht → [README.md](README.md)

---

## 🔄 Letzter Session-Log

| Datum | Was |
|---|---|
| 16.06.2026 | **Mobile-App `/m` — Trainingsplan-Fixes (3 Commits).** (1) **Runna-Läufe sichtbar**: `MNextTraining` holt jetzt zusätzlich `/api/calendar?days=14` und filtert Garmin-iCal-Events auf Lauf-Keywords → erscheinen als RUNNA-Badge (kein Verschieben möglich). (2) **Größere Touch-Targets**: Padding 10→14px, Titel 0.82→0.9rem, Mindesthöhe 52px. (3) **Verschieben**: plan-Sessions (nicht RUNNA) haben im Detail `← -1`/`+1 →` Buttons → PATCH `/api/training/session` schreibt neues Datum in Supabase. (4) **Datum-Bug fix**: Garmin-AllDay-Events standen 1 Tag zu früh — UTC-Mitternacht (22:00Z) wurde per `slice(0,10)` als Vortag interpretiert; fix: `toLocaleDateString('en-CA')` in Browserzeit. (5) **Details aus Runna-Titel**: description ist in iCal null → Distanz per Regex + Workout-Typ als Fallback extrahiert. (6) **Multisport-Splits**: `summary/route.ts` holt `triathlon_races`-Splits für `multi_sport`-Aktivitäten → Swim/Bike/Run-Chips korrekt (1.5/93.3/10.1 km statt 0/47/0). `MTraining` nutzt API-Totals statt client-seitig neu zu rechnen. |
| 16.06.2026 | **Mobile-App `/m` — Heute neu geordnet + Trainings-Detail.** Neue Reihenfolge: Schlaf → **Nächste Trainings** (direkt unter Schlaf) → Rückblick → Training letzte 7 Tage → **Heute dran (ganz unten)**. Neue `MNextTraining`-Komponente: geplante Einheiten **anklickbar** → Detail (HF-Zone/-Bereich, Tempo, Dauer, Distanz, Beschreibung). **Rad-Einheiten:** Indoor/Outdoor-Umschalter im Detail — OUTDOOR zeigt HF/Tempo, INDOOR zeigt `watts_indoor` (beide Datenfelder sind je Rad-Session gefüllt, kein Schema-Change). `MTraining` auf „letzte 7 Tage" zurückgebaut (Plan-Teil → `MNextTraining`). Verifiziert: Sektions-Reihenfolge, Aufklappen, Indoor/Outdoor-Toggle (Watt 105–140 W ↔ Tempo), Typecheck sauber, keine Fehler. |
| 16.06.2026 | **Mobile-App `/m` — Phase 5 (PWA) + Nav-Fix.** **Bugfix:** Bottom-Nav rutschte beim Scrollen weg — Layout-Container von `minHeight:100dvh` auf feste `height:100dvh`+`overflow:hidden` umgestellt, nur `main` scrollt intern (`flex:1;minHeight:0`); Masthead + Nav jetzt dauerhaft fix (verifiziert: navBottom = Viewport-Höhe auch nach Scroll). **PWA:** `app/manifest.ts` (name/short_name, `start_url:/m`, `display:standalone`, Theme/BG `#F2EEE3`), echte PNG-Icons (Hermes-Feder auf Clay) via `scripts/gen-mobile-icons.mjs` (sharp → `public/icon-192/512.png` + `apple-touch-icon.png`), Root-`layout.tsx` um `manifest`/`appleWebApp`/`icons.apple` + `viewport` (themeColor, viewportFit cover) ergänzt. **Auto-Redirect:** `app/page.tsx` leitet Handy-User-Agents auf `/m` (Ausstieg via `?desktop=1`). Verifiziert: Manifest 200 `application/manifest+json`, Icons gerendert, Nav-Pinning, Typecheck sauber. Mobile-App damit funktional + installierbar komplett. **Hinweis:** Redirect am echten Handy testbar (UA-basiert); Mikro braucht HTTPS (Vercel). | 
| 16.06.2026 | **Mobile-App `/m` — Phase 4 (Hermes).** `app/m/hermes/page.tsx` (Client): Such-Chat über eigene Daten (`/api/ask`, neueste Antwort oben) mit Mikro-Sprachnotiz, je Frage parallel Dokument-Suche; bei Treffern Buttons **„An Telegram"** (Status idle→sending→done). Neues eigenständiges `lib/telegram.ts` (`searchDocuments` + `sendDocumentToTelegram` an festen `TELEGRAM_USER_ID`, `server-only`) — Webhook bewusst unangetastet gelassen (kein Risiko), daher kleine Logik-Dublette zu `sendDocumentById`. Routen `app/api/m/docs` (GET Suche) + `app/api/m/send-doc` (POST Versand). `DocHit` als `import type` in den Client (server-only bleibt draußen). Verifiziert: Hermes-Snapshot ok, Dokument-Suche echt getestet (2 Treffer), Typecheck sauber; Telegram-Versand + `/api/ask` im Test nicht ausgelöst (outward/Kosten, beide Pfade bewährt). **Offen:** Phase 5 (optional) PWA-Manifest + „Zum Home-Bildschirm" + Auto-Redirect schmaler Schirme. |
| 16.06.2026 | **Mobile-App `/m` — Phase 3 (Erfassen).** `app/m/erfassen/page.tsx` (Client): ESSEN/NOTIZ-Umschalter, großes Textfeld, Mikro-Button (Sprachnotiz → `/api/transcribe` Whisper), großer Speichern-Button + Toast, „Heute erfasst"-Liste. **ESSEN** hängt über neue Route `app/api/m/food/route.ts` an die Tages-`nutrition_logs.notes` an (Berlin-Zeitstempel, upsert nur `notes` → Makros bleiben unberührt) statt zu überschreiben. **NOTIZ** → `/api/knowledge` (source `mobile_capture`, Claude-Kategorisierung). Verifiziert: Erfassen-Snapshot ok, Food-Append echt getestet (2 Einträge angehängt + in Ernährungskarte sichtbar) und Test-Daten wieder gelöscht, Typecheck sauber. **Offen:** Phase 4 Hermes (Suche + „An Telegram senden") · Phase 5 PWA. |
| 15.06.2026 | **Mobile-App `/m` — Phase 2 (Heute).** Heute-Seite (`app/m/page.tsx`, Server Component, `force-dynamic`) mit echten Daten: **Schlaf-Ring** (Whoop-Logik, farbcodierter Score-Ring grün/gelb/rot + HRV/Dauer/Tiefschlaf/Body-Battery-Kacheln, `MSleepRing`), **Heute dran** (Aufgaben abhaken via `/api/tasks`, `MTasks`), **Training letzte 7 Tage** (`/api/training/summary` + `/api/training/plan`: Einheiten/Std + Sport-km-Chips + letzte Einheiten + „Diese Woche geplant", `MTraining`), **Rückblick** (Gelernt = whitelistete Lern-Quellen `chat_session/telegram_note/terminal_capture/learn/zahnmedizin` der letzten 2 Tage, Gegessen = `nutrition_logs`). Geteilte `MCard`. Verifiziert: Snapshot mit Echtdaten korrekt, keine Konsolenfehler, Typecheck sauber. (Preview-Screenshot-Tool hängt am Renderer — am Gerät irrelevant.) **Offen:** Phase 3 Erfassen · Phase 4 Hermes · Phase 5 PWA. |
| 15.06.2026 | **Mobile-App `/m` — Phase 1 (Shell + Designsprache).** Eigener Handy-Startscreen unter `/m` mit Bottom-Nav (3 Tabs: Heute · Erfassen · Hermes), Masthead (Hermes-Flügel-Emblem + „Personal OS" Serif + Claude-Sunburst + Uhr), warmer Claude/Retro-Look aus dem bestehenden Theme. `app/m/layout.tsx` (Client, Inline-SVG-Icons, `100dvh`-Flex mit fixierter Nav + `env(safe-area-inset)`), 3 Gerüst-Seiten (`/m`, `/m/erfassen`, `/m/hermes`) mit `MPagePlaceholder`. Liegt hinter dem Login (Middleware-Matcher). Verifiziert: alle 3 Routen 200, keine Runtime-Fehler, Mobile-Viewport-Snapshot ok (Screenshot-Tool hängt am backdrop-filter). Plan + Email-Idee in `docs/roadmap.md`. **Offen:** Phase 2 Heute (Schlaf-Ring/Whoop-Logik, Aufgaben, Training, Rückblick) · Phase 3 Erfassen · Phase 4 Hermes (+„An Telegram senden") · Phase 5 PWA. |
| 15.06.2026 | **Zahnmedizin-Bereich entfernt.** `ZAHNMEDIZIN`-Tab aus `TopRail` raus, `app/zahnmedizin/` gelöscht (war: Lernfortschritt/Klinische Skills/Prüfungen/Recherche). Daten bleiben erhalten (ZM_-Habits in DB, Skills in localStorage, `lib/config/dentalSkills.ts` ungenutzt aber vorhanden). **Offen:** Terminal-Zukunft entscheiden — am Desktop redundant zur Claude-App, echter Mehrwert nur mobil (SUCHEN über eigene Daten + ERFASSEN); Optionen: aufs Mobile zuspitzen (nur Suchen+Erfassen) oder ganz raus. |
| 15.06.2026 | **Trainings im Kalender + Lauf-Quelle Garmin.** `/api/calendar` mischt geplante Einheiten als ganztägige Events ein (Sport-Farbcode in CalendarCard + CalendarView). **Läufe kommen aus Garmin** (Runna→Garmin→iCal, `GARMIN_ICAL_URL` gesetzt) — DB-Läufe aus dem Merge ausgeschlossen, DB-Lauf-Seeds gelöscht → keine Doppel. `TrainingNext7` führt Garmin-Läufe + DB-Rad/Schwimm/Kraft zusammen. Bugfix: Garmin-Ganztags-Events (UTC `…22:00Z`) lagen 1 Tag zu früh → lokales Datum. DB hält nur noch Rad/Schwimm/Kraft/Ruhe. **Offen:** Musik-Seite visueller Feinschliff; Abhaken in der 7-Tage-Ansicht ist nur lokaler State (keine Persistenz); optional Google-Calendar-Schreib-Sync fürs Handy. |
| 15.06.2026 | **Dashboard-Komplett-Re-Theme (Anthropic + Runna + Retro)** in 5 Phasen: (A) `globals.css` Theme-Layer — warmes Papier/Clay, Fraunces/Inter/Space Mono, Sport-Farb-Variablen, flache Panels; (B) Interaktions-System (`.btn` primary/secondary/ghost mit Hover-Lift/Active-Press/Fokus-Ring, `.nav-link`, `.card-hover`) + `TopRail` neu (Serif-Wortmarke); (C) neue **„Nächste 7 Tage"-Trainingsansicht** (`/api/training/plan` + `TrainingNext7`, farbcodierte Karten, Klick→Detail mit HF-Zone/Watt-Indoor, Abhak-Kreis) auf `/training`; (D) alle 12 Dashboard-Karten von Dark-Era-`oklch` auf warme Palette (0 Rest); (E) Unterseiten Analyse/Finanzen/Musik/Zahnmedizin. Verifiziert via preview_inspect/Compile (Screenshots im Tool gehängt). Migration 0014 `training_plan_sessions` + Typ `TrainingPlanSession`. Block-0 (15.–28.6.) + Block-1 (29.6.–9.8., 54 Einheiten) geseedet. **Offen:** Musik-Seite visueller Feinschliff (war dunkle Mini-App). |
| 15.06.2026 | **Triathlon-Benchmarks: 2 Rennen nacherfasst** — London (Newham, 10.08.2025, Olympisch) + Karlsfeld (20.07.2025, Sprint) in `triathlon_races` + Obsidian-Analysenotizen; `Triathlon-Benchmarks.md` um Cross-Race-Vergleich erweitert (alle 3 Rennen). Karlsfeld-Rad-Höhe verworfen (Garmin +2579m = Baro-Rauschen). **Korrektur** der Erlabrunn-Analyse: Aussage „längster Ritt 23 km" war falsch (nur 6-Wochen-Fenster geprüft) — tatsächlich 78 km (19.06.25) + 49 km (26.04.26); Rad-Grundausdauer steht, es fehlte renn-spezifische hügelige/Schwellen-Radarbeit. Notiz + DB-Notes-Feld gefixt. |
| 14.06.2026 | **Triathlon-Analyse + Benchmark-Speicherung** (Erlabrunn 14.06.). Neues `scripts/garmin-activity-hr.mjs` zieht HF/Höhe/Tempo-Zeitreihen einzelner Aktivitäten direkt aus der Garmin-Detail-API (zerlegt Multisport via `childIds` in Schwimmen/Wechsel/Rad/Wechsel/Laufen) — der normale Sync hat nur Summenwerte. Vollanalyse nach Laborwerten (Spiro 03.03.: HFmax 181, IANS Rad 141, VO2max 53,4, FTP 187W): Rad overbiked (Ø150 > Schwelle, +613hm, untertrainiert), Lauf Negativsplit + Finish 99% HFmax (am Limit), Schwimmen konservativ. Neue Supabase-Tabelle `triathlon_races` (Migration 0013) als Cross-Race-Benchmark + Typ `TriathlonRace`; Rennen eingetragen. Obsidian: `Gesundheit/Training/Triathlon/` mit Analyse-Notiz + `Triathlon-Benchmarks.md` (wächst pro Rennen). 3 unterwegs-Branches in master gemerged. |
| 12.06.2026 | **Marktanalyse Deep-Run W24 + Auswertungs-Schicht** ([docs/marktanalyse.md](marktanalyse.md)): `deep market` ausgeführt — voller Deep-Log (`KI/Marktanalysen/Daily Logs/2026-06-12.md`), Block-16-Retrospektive mit Live-Kursen, neue Signale AVGO (Hoch) + ORCL (Avoid), Profile TSMC+Oracle neu angelegt. **Kernarbeit:** Outcome-Tracking gebaut, weil bisher nur Entry in Supabase lag → alle 14 Signale nachgetragen (`market_investment_signals` mit delta_pct/status), neue Snapshot-Tabelle `market_signal_reviews` (Zeitverlauf je Signal/Woche) + 2 Views (`market_signal_performance_by_tier`, `..._by_factor` = welche Tiers/Analyse-Blöcke treffen). `deepmarketskill` um Pflicht-DB-Writeback in Block 16 erweitert. Ehrlichkeits-Fixes: 3 Schätz-Entries (TSM/ABB/SIE) re-baselined; Intel-Avoid-These zurückgenommen (Daten widerlegt: +187% YTD, BofA-Upgrade). Kein Reminder eingerichtet (auf Userwunsch). |
| 12.06.2026 | **Umfassender Audit** (`docs/audit-2026-06-12.md`): 8 Korrekturen, Typecheck+Lint sauber. Kritisch: Telegram Text-/Sprachnotiz-Kategorisierung (`pendingMessages`) und Einkaufsliste (`shoppingLists`) lagen in In-Memory-Maps → scheiterten auf Vercel nach Lambda-Wechsel. Text jetzt über `telegram_pending_docs`, Einkauf über UUID-Callback. Genauigkeit: HF-Mittelwert im Health-Review war gleitendes `(cur+neu)/2` statt echtem Mittel. Zeitzone: Vokabel-Tageslimit/Fälligkeit rollte auf UTC statt Berlin. Sortierung: **`Universität` fehlte im Telegram-Weg** (nur Drop-Ordner kannte sie) → Kursscheine landeten je nach Kanal verschieden; in `obsidianPaths.ts`+`documents.ts` angeglichen. + 3 Lint-Fixes. Volle Telegram-/Dashboard-/Obsidian-Funktionsprüfung + Cowork-Einsatzideen im Bericht. |
| 12.06.2026 | **Plan: Personal-OS-Plugin** (`docs/plan-personal-os-plugin.md`) — bestehende Abläufe (Tagesabschluss, Health-Review, Wissen-Sync, Briefing-Abruf, Krankenblatt, Lernpartner) als ein Cowork-Plugin mit Slash-Commands bündeln. 4 Phasen, jeweils mit Stopp-Punkt. |
| 11.06.2026 | Fix: `/hol`-Suche fand nie Treffer — `.or()`-Filter nutzte `%` statt `*` als Wildcard (PostgREST-Syntax) |
| 04.06.2026 | Audit: 3 Bugs gefixt (Cron-Auth, TELEGRAM_USER_ID, writeObsidianFile) |
| 04.06.2026 | healthReview Phase 1+2+4: Laktattest, SER/Ernährung/Habits, Prüfungswochen |
| 04.06.2026 | healthReview Phase 3: Reviews auf /analyse, Run-Button |
| 04.06.2026 | Vokabeln Phase 5: Unique-Constraint, bidirektional (IT↔DE), /stopp-Befehl |
| 04.06.2026 | Vokabeln: Lernsession in Supabase (überlebt Cold Starts), Tages-Limit 30 |
| 04.06.2026 | Python-Ebene + Revolut + Zahnarzt-Bürokratie geplant → docs/roadmap.md |
| 04.06.2026 | Fix: vercel.json — comment-Felder aus crons entfernt |
| 04.06.2026 | Python-Ebene Schritt 1–4: Migration 0010, analysis/revolut/sync.py, /finanzen Dashboard, Telegram-Cron |
| 04.06.2026 | Python-Ebene Schritt 5–6: scipy Korrelationen + Trends, Korrelations-Block auf /analyse |
| 04.06.2026 | Schritt 7 vorbereitet: Enable Banking Account erstellt (GoCardless seit 07/2025 geschlossen) |
| 04.06.2026 | Schritt 7: Enable Banking Client + setup_oauth.py + auto_sync.py implementiert |
| 04.06.2026 | Vokabeln: IT→DE Tags in DB nachgepflegt, upsert ignoreDuplicates, 50/50 Mix in getDueCards |
| 04.06.2026 | Vokabeln: seed-Script prüft IT→DE und DE→IT separat, fehlende Richtung ohne Claude-Call ergänzt |
| 05.06.2026 | Revolut CSV-Import via Telegram: MIME-Fix, 64-Byte-Callback-Fix, xlsx dynamisch |
| 08.06.2026 | Fix: Wochentrainingsbericht bezog sich auf laufende statt abgelaufene Vorwoche (überall 0) |
| 08.06.2026 | Fix: Monatsbericht-Vault-Pfad korrigiert (`Gesundheit & Training` existierte nicht) → `Gesundheit/Training/Monatsbericht/`; bereits generierten Bericht 2026-05 manuell nachgetragen |
| 08.06.2026 | Fix: Morgen-Briefing kam nicht in Telegram an — ACWR-Status mit Unterstrich (z. B. `PRODUCTIVE_3`) brach Telegrams Legacy-Markdown-Parser; Unterstriche werden jetzt für Telegram-Text durch Leerzeichen ersetzt |
| 05.06.2026 | Enable Banking: /privacy + /terms Seiten, ngrok-Setup, setup_oauth.py angepasst |
| 05.06.2026 | Dokument-Pipeline: Foto→PDF (sharp+pdf-lib), extFromMime vollständig, Obsidian bekommt PDF+MD |
| 05.06.2026 | Scripts: supabase-to-obsidian.mjs (Supabase→Vault Sync), eingang-ingest ONLOGON-Task |
| 05.06.2026 | dotenv-"Bug" diagnostiziert: kein Paketproblem, sondern WindowsApps-Stub-python. Fix: alle Python-Scripts mit `py -3.14`, Stub abschalten. Copy-Hack aus STATUS gestrichen |
| 05.06.2026 | **Revolut-Verbindung steht** (Enable Banking, Production/Restricted). Bugs gefixt: JWT iss/aud, /auth statt /sessions, access.valid_until, redirect_url, IPv4-Bind, UTF-8-Konsole. Session AUTHORIZED, Live-Abruf bestätigt (5 Tx/7d) |
| 05.06.2026 | Revolut: normalize_transaction an echtes EB-Format angepasst (remittance_information[list], credit_debit_indicator→+/-, verschachtelte creditor/debtor), Pagination via continuation_key, UTF-8 in auto_sync. Backfill 90 Tage → 91 Tx auf /finanzen |
| 05.06.2026 | **Eingang-Ingest gehärtet**: (1) Dateinamen-Kollision gefixt — Hash-Suffix `-<hash8>` im Base-Namen, verhinderte upsert-Überschreibung zweier Docs mit gleichem Titel-Slug. (2) Verify-before-delete: Duplikat-Original wird nur aus `_Eingang` gelöscht, wenn die Archiv-Kopie nachweislich abrufbar ist. (3) Klassifizierung Haiku→**Sonnet** (Haiku hatte 4/7 Kursscheine falsch klassifiziert). (4) Neue Verwaltung-Kategorie **Universität** (routing + Prompt) |
| 05.06.2026 | **Verwaltung-Reorg** (`scripts/reorg-verwaltung-uni.mjs`): neuer Ordner `Verwaltung/Universität` mit 10 Uni-Docs (7 LMU-Kursscheine + 3 Erasmus). 6 Kursscheine mit korrigierten Titeln/Summaries/Echtdaten (Vault+Storage+DB+Re-Embed). 1 durch alte Kollision überschriebenes Doc (Mikroskopisch-anatomischer Kurs WS21/22) aus Foto neu eingelesen — recovered. CSV-Dublette aus `Sonstiges` (bit-identisch zu Finanzen-Kontoauszug) entfernt (Storage+DB; Vault-Restdatei manuell) |
| 05.06.2026 | **Briefing Phase 1**: Labor-Sektion raus (zeigte statische Körpergröße als „letzten Wert"), alte Gewohnheiten-Spalte raus (war immer 0/6), „Nächste Einheit" aus Kalender rein (`isTrainingEvent` in lib/calendar.ts). Cron-Timing: Garmin-Sync 5→6 UTC, Briefing 6→6:10 UTC (=8:00/8:10 Berlin Sommer), damit letzte Nacht beim Briefing gesynct ist. Schlaf+Termine+Wochen-Training bleiben |
| 05.06.2026 | **Logbuch-Diagnose**: Vault-Writes laufen auf Vercel, Obsidian ist aber lokal (`localhost:27123`) → unerreichbar aus der Cloud. Daher landen Briefings/Digests/Tageslog nicht im Vault (nur Supabase). Geplant: lokaler Agent baut Logbuch aus Supabase nach → docs/roadmap.md |
| 05.06.2026 | **Aufgaben-Tracker Phase 2**: fälligkeits-basierte `recurring_tasks` (Migration 0011). lib/tasks.ts (Fälligkeit/Status), API `/api/tasks` (GET Liste + POST erledigt/rückgängig), `TasksCard` ersetzt HabitsCard auf dem Dashboard, „Heute dran" im Briefing. Seed: Kleidung+Geschirr täglich, Putzen wöchentlich, Bettwäsche 28 Tage. Browser-verifiziert (GET/POST-Loop, wöchentliche Kadenz) |
| 05.06.2026 | **Sync-Audit + Lücken geschlossen**: geprüft, was per lokalem Agent wirklich in Obsidian landet. (1) `reisen/`-Storage-Pfad fehlte in beiden Storage-Syncs → Reise-Buchungen (Telegram) erreichten Vault nicht → gefixt (storage-obsidian-sync + supabase-to-obsidian). (2) **Neuer `knowledge-obsidian-sync.mjs`**: erfasste Wissensnotizen (telegram_note/telegram/chat_session) → Kategorie-Ordner (z.B. MKG-Lernnotizen → Literatur/Medizin/Zahnmedizin); in sync-all eingehängt (Schritt 5). (3) ASCII/Umlaut-Bug gefixt: Storage `Universitaet` → Vault `Universität` (sonst Dubletten-Ordner). **Manuell:** stray `Verwaltung/Universitaet`-Ordner löschen |
| 05.06.2026 | **Reisen-Ordner + Pläne-Fix**: neuer top-level `Reisen/` (Dokumente + Pläne; `Reisen-Urlaub` umbenannt). Reise-Buchungen (Flug/Hotel/Mietwagen/Ticket) routen jetzt nach `Reisen/Dokumente` statt Verwaltung/Datenbank (Datenbank = nur noch Pass/Ausweis/Impfung); Reise-Pläne nach `Reisen/Pläne`. Geändert: obsidianPaths.ts, documents.ts (Telegram-Prompt), eingang-ingest.mjs (resolveTarget+Prompt), knowledge.ts (writePlanToObsidian). **Pläne-Ordner erschien nie**, weil der Telegram-Webhook (Vercel) lokales Obsidian nicht erreicht → logbuch-sync.mjs baut Pläne jetzt aus Supabase nach (plan-getaggte Einträge, aus Tageslog-Dokumenten ausgenommen). Sizilien-Plan materialisiert |
| 05.06.2026 | **Logbuch zusammengeführt**: Briefing wird jetzt als oberste Sektion (`## ☀️ Briefing (morgens)`) in die Tagesdatei eingebettet — keine separaten `Zusammenfassungen/`-Dateien mehr (Briefing+Digest waren redundant zum Tageslog). Tages-Digest bleibt reiner Telegram-Push. `logbuch-sync.mjs` umgebaut, tote Vault-Writes in briefingStore.ts + digest-route entfernt. Wochen bleiben. **Manuell:** alten `Logbuch/Zusammenfassungen/`-Ordner in Obsidian löschen |
| 05.06.2026 | **Cleanup + Scheduler**: toten HabitsCard-Code entfernt (HabitsCard.tsx + lib/config/habits.ts; /api/habits+daily_habits bleiben für ZM_-Fächer). Logbuch-Sync als Windows-Logon-Task vorbereitet (`logbuch-sync.bat` + `.xml`, 3-Min-Delay) — Registrierung braucht Admin (siehe manuelle Schritte) |
| 05.06.2026 | **Code-Audit** (`docs/funktionsregister.md`): lückenloser Index aller Seiten/Routen/Crons/lib/Komponenten/Scripts/Python/Tabellen + Doku-Status. README/docs aktualisiert (Cron 5→6 UTC, Env-Namen, Migrationen bis 0011, Roadmap Phase 7+8 ✅). Lücken markiert: Finanzen, Briefing, Vokabeln, Newsletter, Health-Review ohne eigenes Doku-Kapitel |
| 05.06.2026 | **Garmin-Kalender im OS**: `lib/calendar.ts` unterstützt jetzt mehrere iCal-Quellen. Neue Env-Variable `GARMIN_ICAL_URL` in `.env.local` eingetragen (Garmin-Connect-Export). Termine aus Garmin-Kalender erscheinen jetzt in Briefing, CalendarCard und Kalender-Seite |
| 05.06.2026 | **Logbuch-Agent Phase 3** (`scripts/logbuch-sync.mjs`): lokaler Agent baut Logbuch aus Supabase nach (Tageslog aus Garmin+Notizen+Dokumenten, Briefings/Digests/Wochen). Tagesdateien nur Lücken füllen (--force = Rebuild). In `sync-all.mjs` als Schritt 4 eingehängt → läuft bei PC-Start/Scheduler. Bug gefixt: Timeline-Abfrage auf relevante Quellen gefiltert (sonst sprengen 1089 pdf-pipeline-Bücher das 1000er-Limit). 30 Tage Logbuch nachgebaut; Demo-06-03 durch echte Daten ersetzt |
| 06.06.2026 | **Roadmap aufgeräumt** (`docs/roadmap.md`): Stand 04.06. war veraltet — Punkte 1–6 (Laktattest, SER/Habits, /analyse-Anbindung, Korrelations-Cluster, Vokabel-Feinschliff, Python-Ebene Schritt 1–7) längst gebaut, aber als „offen" markiert. Neu strukturiert: Offenes oben (`/finanzen`-Ausbau, Vokabel-Lernansicht, Zahnarzt-Module), Erledigtes als ✅ archiviert. Roadmap wird ab jetzt bei jedem Session-Ende mitgepflegt |
| 06.06.2026 | **`/finanzen`: Fix vs. einmalig** (`9b491ed`). Summary-API erkennt wiederkehrende Ausgaben on-the-fly (gleicher Händler, ≥2–3 Monate, Betrag ±35%) → Fixkosten. **Grundlast Ø/Monat** = Fixkosten + Lebensmittel + Restaurants; **einmalige Käufe** als All-Time-Schnitt geglättet. Kombinierter **Einkäufe-&-Essen-Slot**, gestapelte Monatsbalken (Grundlast/Einmalig), Fixkosten-Liste. Sync-Button verworfen (Enable Banking läuft nur lokal, Vercel kommt nicht an Key+Session → Sync bleibt über Scheduler/`auto_sync.py`). Garmin-Termine im Kalender verifiziert (4 Events kommen an) |
| 06.06.2026 | **Marktanalyse-System** (Obsidian `KI/`): `dailymarketskill` + `deepmarketskill` analysiert. Block D (Interpretation + Top 3 Picks) in Daily Skill eingebaut. 4 Supabase-Tabellen angelegt: `market_daily_macro`, `market_events`, `market_reactions`, `market_investment_signals`. Skill schreibt nach jedem Run automatisch Obsidian-Tageslog + Supabase-Daten. Aktivierung: `daily market` in Claude tippen. |
| 06.06.2026 | **Obsidian-Pfade**: `KI` + `Skills` Kategorien gemappt (`lib/obsidianPaths.ts`). `LITERATUR_WISSEN_FOLDER` = `Literatur/Wissen` + `wissenVaultFolder()` Funktion. |
| 06.06.2026 | **Wissen-Sync bidirektional** (`scripts/wissen-sync.mjs`): Supabase ↔ Obsidian `Literatur/Wissen/{Kategorie}/Aktiv/` (context:true) + `/Archiv/` (context:false). Datei verschieben = context-Feld in Supabase ändert sich beim nächsten `--import`. Neue Dateien ohne id werden in Supabase angelegt. 1000 Einträge exportiert. |
| 06.06.2026 | **Supabase context-Spalte**: `knowledge_entries.context boolean DEFAULT true`. `match_knowledge` RPC filtert nur `context=true`. Chat-Route Lernfach filtert nur `context=true`. RAG + Chat-Kontext zeigt nur aktive Einträge. |
| 06.06.2026 | **Terminal UI**: cremefarben (`#FAF8F3`) mit iOS-Stil — Segmented Control für CHAT/SUCHEN/ERFASSEN, weiße Buttons mit Border + Shadow, iOS-Systemschrift. |
| 06.06.2026 | **Session-Ritual erweitert** (`CLAUDE.md`): Session-Ende schreibt alle betroffenen docs/-Dateien, pusht immer (nicht nur committet), bestätigt Remote+Branch. |
| 06.06.2026 | **Vault-Struktur korrigiert** (`docs/obsidian.md`, `CLAUDE.md`): exakte Ordnerstruktur nach Vault-Scan — `KI/` top-level (Marktanalysen+Skills), `Logbuch/2026/MM`, `Verwaltung/` mit echten Unterordnern. KI+Skills aus `wissen-sync` EXPORT_CATEGORIES entfernt (gehören in `KI/`, nicht `Literatur/Wissen/`). `knowledge-obsidian-sync.mjs`: KI→`KI/`, Skills→`KI/Skills/` (vorher Fallback auf `Recherche/KI/`). |
| 06.06.2026 | **`wissen-sync` in sync-all**: Schritt 6 eingefügt — `wissen-sync.mjs --import` läuft bei PC-Start, spiegelt Aktiv/Archiv-Verschiebungen nach Supabase. |
| 07.06.2026 | **Garmin Indoor-Watt** (Migration 0012, live angewendet): `garmin_activities` hat jetzt `avg_power`/`max_power`/`norm_power`. Sync + Backfill lesen `avgPower`/`maxPower`/`normPower` von der Garmin-API — nur bei Aktivitäten mit `typeKey` enthält `indoor` (z.B. `indoor_cycling`), sonst `null` (Garmin liefert outdoor i.d.R. keine Power-Daten). `/analyse` zeigt bei Indoor-Aktivitäten `avg_watt` + **HF/Watt-Quotient** statt Tempo (Geschwindigkeit ist bei Indoor kein sinnvoller Parameter). Obsidian-Tageslog zeigt `Ø<X> W (NP <Y>)`. |

---

## ❗ Manuelle Schritte ausstehend

- [ ] **Audit-Fixes live testen** (Telegram, nur am Handy prüfbar): (a) Notiz schicken → Kategorie tippen → speichert ohne „nicht mehr verfügbar"; (b) `/liste` → Artikel abhaken → Liste aktualisiert sich; (c) Kursschein-Foto senden → landet in `Verwaltung/Universität` (nicht Amt/Arbeit).
- [x] **Git-Push (Garmin-Kalender-Fix)** ✅ erledigt
- [x] **Garmin-Watt-Backfill** ✅ erledigt — `/api/garmin/backfill?months=12` (4 Batches, 345 Aktivitäten) lokal durchlaufen lassen, Indoor-Cycling-Sessions haben jetzt `avg_power`/`max_power`/`norm_power` (z.B. 06.06.: Ø131/Max142/NP134 W), in Supabase verifiziert

- [ ] **Vokabel-Seed neu laufen lassen**: `npx tsx scripts/seed-italian-vocab.ts` — erstellt jetzt IT→DE + DE→IT Karten für alle Topics (bereits vorhandene werden übersprungen)
- [x] **Supabase-Migration 0010 angewendet** ✅
- [x] **Python-Dependencies installiert** (anthropic, supabase, scipy, numpy) ✅
- [ ] **Revolut CSV-Backfill**: CSV per Telegram schicken → "💰 Revolut Import" — oder lokal: `py -3.14 analysis/revolut/sync.py <pfad>.csv`
- [ ] **Korrelationen berechnen**: `py -3.14 analysis/health/correlations.py` — erscheint dann auf /analyse
- [x] **Enable Banking registriert + aktiviert** ✅ App "Personal OS" (Production/Restricted, via "Activate by linking accounts"). Keys in `.env.local`: `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_PRIVATE_KEY` (Pfad zur `.pem` im Root, gitignored), `ENABLE_BANKING_REDIRECT_URI`
- [x] ~~dotenv-Fix (Copy-Item-Hack)~~ — **entfällt**: dotenv ist im User-Site installiert und wird von `C:\Python314\python.exe` automatisch gefunden. Der Fehler kam vom WindowsApps-Store-Stub-`python` (leere Attrappe), nicht von einem fehlenden Paket. Lösung: Scripts immer mit `py -3.14` starten (siehe unten).
- [ ] **Store-Python-Stub abschalten** (einmalig, beendet die PATH-Falle dauerhaft): Einstellungen → Apps → Erweiterte App-Einstellungen → App-Ausführungsaliase → `python.exe` und `python3.exe` AUS. Danach trifft auch nacktes `python` immer das echte 3.14.
- [x] **OAuth-Setup durchgeführt** ✅ `SESSION_ID` + `ACCOUNT_ID` (Konto „Christoph Hoffmann" EUR) in `.env.local`. Session AUTHORIZED, gültig **90 Tage**.
  - **Re-Auth, wenn Session abläuft** (alle ~90 Tage): 1) ngrok-Tunnel starten — `& "C:\Users\Administrator\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe" http --url=https://overdress-starch-gently.ngrok-free.dev 127.0.0.1:8080` ; 2) in 2. Terminal `py -3.14 analysis/revolut/setup_oauth.py` ; 3) Revolut-Login. Schreibt SESSION_ID/ACCOUNT_ID neu.
- [x] **Erster Sync (Backfill) erledigt** ✅ 91 Transaktionen (10.03.–04.06.) in `revolut_transactions`, 18 Monats-Summaries, sichtbar auf `/finanzen`. Wiederholen/erweitern: `py -3.14 analysis/revolut/auto_sync.py --days N`
- [ ] **Täglicher Auto-Sync einrichten** (optional): `analysis/revolut/auto_sync.py` (default 8 Tage) per Windows Task Scheduler täglich laufen lassen — Aufruf `py -3.14 analysis\revolut\auto_sync.py`. Hält `/finanzen` automatisch aktuell.
- [x] **`sync-all` um `wissen-sync.mjs` ergänzen** ✅ — Schritt 6 eingehängt
- [x] **Windows Task Scheduler — `sync-all` (EIN Task für ALLES)** ✅ **registriert & aktiv** (`Personal-OS-Sync`, State Ready, lief zuletzt 06.06. 09:00 mit Ergebnis 0x0). Führt bei jeder Anmeldung **alle 5 Schritte** aus: Garmin→Obsidian, _Eingang-Ingest, Storage→Obsidian, Logbuch-Nachbau, Knowledge-Nachbau (`scripts\sync-all.bat`). Die 3 alten Einzel-Tasks (Eingang-Ingest, Garmin-Obsidian-Sync, Supabase-Obsidian-Sync) sind korrekt **deaktiviert**. *Trigger = nur „bei Anmeldung" — kein Zeitplan. Bei tagelangem Durchlauf ohne Neuanmeldung läuft kein neuer Sync; ggf. Zeit-Trigger ergänzen.*
- [ ] **Stray-Ordner löschen** (Obsidian): `Verwaltung/Universitaet` (ASCII-Dublette von `Universität`), `Neuer Ordner`, `Logbuch/Zusammenfassungen` (alte Briefing/Digest-Dateien).
- [ ] **Obsidian Autostart**: Obsidian-Verknüpfung in `shell:startup` legen

---

## ✅ Was funktioniert (muss immer laufen)

### 📱 Mobile-App `/m` → [mobile.md](mobile.md)
- Bottom-Nav (Heute / Erfassen / Hermes), PWA-installierbar, Auto-Redirect vom Handy
- **Heute**: Schlaf-Ring (Score/HRV/Dauer/Tiefschlaf/Body Battery), Nächste Trainings, Rückblick, Training letzte 7 Tage, Heute dran
- **Nächste Trainings**: plan-Sessions (swim/bike/strength/rest) + Runna-Läufe aus Garmin-iCal (RUNNA-Badge); anklickbar → Detail (HF-Zone, Watt, Tempo, Dauer, Distanz); Verschieben `← -1 / +1 →` für plan-Sessions; Indoor/Outdoor-Toggle für Rad
- **Training letzte 7 Tage**: Swim/Bike/Run-Chips korrekt — multi_sport wird über `triathlon_races`-Splits aufgeteilt
- **Erfassen**: ESSEN (append an nutrition_logs.notes) + NOTIZ (→ knowledge_entries), Mikro-Sprachnotiz via Whisper
- **Hermes**: RAG-Suche über eigene Daten, Dokument-Treffer per Button an Telegram senden

### 📱 Telegram Bot → [telegram-bot.md](telegram-bot.md)
- Text schicken → Kategorie wählen (Training, Musik, Lernen, Plan, Notiz, Einkauf, Kalender, Frage)
- Foto / PDF / Word / Excel / TXT hochladen → Gesundheit oder Verwaltung
- Sprachnotiz → Whisper → selbe Pipeline
- `/lernen` → max. 30 Karten/Tag (Wiederholungen zuerst, dann neue), `/antwort`, `/stopp`, `/liste`, `/hol`
- Session überlebt Vercel Cold Starts (in Supabase gespeichert)
- Bidirektional: 🇮🇹→🇩🇪 und 🇩🇪→🇮🇹 je nach Karte
- Automatische Nachrichten: Briefing 06:00, Digest 21:50, Vokabel-Reminder 07:00, Newsletter Mo, Gesundheitsanalysen

### ⌚ Garmin → [garmin-sync.md](garmin-sync.md)
- Täglicher Cron 05:00 UTC → `garmin_activities`, `garmin_sleep`, `garmin_body_battery`, `garmin_training`
- Backfill-Scripts für Lücken (lokal)

### 📊 Analyse → [dashboard.md](dashboard.md)
- `/analyse`: Ad-hoc 4/8/12/52 Wochen, Streaming, Wochenampel, Kalender-Korrelation
- Block „Letzte Reviews" mit Obsidian-Pfad + Button „Monatsbericht jetzt"
- Automatische Periodenberichte: monatlich (1.), halbjährlich (1.Jan/Jul), jährlich (1.Jan)
  → Laktattest, SER, Ernährung, Habits, Prüfungswochen, ACWR+HRV-Cluster im Report
- Parameter editierbar in Obsidian: `Gesundheit/Training/analyse-parameter.md`
- Berichte landen in `Gesundheit/Training/Monatsbericht/` bzw. `Halbjährig`/`Jahresberichte`

### 🧠 RAG / Wissen → [rag-system.md](rag-system.md)
- Semantische Suche (Embeddings) + SQL-Abfragen (Garmin/Ernährung)
- Via Telegram Frage-Button oder `/terminal` im Dashboard

### 📥 Dokument-Ingest → [ingestion.md](ingestion.md)
- `_Eingang/` Ordner (PC) + Telegram-Upload → Obsidian + Supabase (RAG)

### 📚 Vokabeltrainer (Italienisch)
- SM-2 Spaced Repetition, max. 30 Karten/Tag, Wiederholungen vor neuen Karten
- Bidirektional IT↔DE, Session in Supabase, `/lernen` `/antwort` `/stopp`
- Seed: `scripts/seed-italian-vocab.ts` (IT→DE + DE→IT, Skip wenn schon vorhanden)

### 📰 Newsletter / Literatur
- Wöchentlich Mo 07:00: PubMed-Zahnmedizin → Telegram
- Monatlich 1.: Literatur-Rückblick → Telegram

---

## 🗺️ Geplant → [roadmap.md](roadmap.md)

### ✅ /finanzen Dashboard (06.06.2026)
- Monatsvergleich als gestapelte Balken (Grundlast/Einmalig) ✅
- Fix vs. einmalig statt Einnahmen-Saldo (auf Wunsch): Grundlast Ø/Monat + einmalige Käufe All-Time ✅
- Top-Kategorien + kombinierter Einkäufe-&-Essen-Slot ✅
- Sync-Button verworfen — Enable Banking läuft nur lokal (`auto_sync.py` via Scheduler), Vercel kommt nicht an Key+Session

### Nächste Priorität: Vokabel-Lernansicht im Dashboard
- Übersicht Decks, Anzahl Karten, Lernfortschritt (bisher nur via Telegram)

### Schritt 7 — Enable Banking Auto-Sync
- ✅ Schritt 1: Migration 0010
- ✅ Schritt 2: `analysis/revolut/sync.py` (CSV-Fallback)
- ✅ Schritt 3: Dashboard `/finanzen`
- ✅ Schritt 4: Telegram Monats-Cron
- ✅ Schritt 5: `analysis/health/correlations.py` (scipy)
- ✅ Schritt 6: Korrelations-Block auf `/analyse`
- [x] Schritt 7: Enable Banking OAuth → automatischer Revolut-Sync (implementiert, API-Keys + OAuth-Setup noch manuell)

Vollständiger Plan: [roadmap.md](roadmap.md)
