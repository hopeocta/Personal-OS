Zuletzt abgeschlossen: Abend 7 — Musik Section (Project Tracker + Sound Library)
Nächster Schritt: Abend 8 — Zahnmedizin Section
Datum: 2026-05-24
Offene Punkte: keine

Was gebaut wurde (Abend 7):
- 5 API-Routen für Musik:
  - GET/POST /api/musik/projects → music_projects Tabelle
  - PATCH/DELETE /api/musik/projects/[id] → einzelnes Projekt updaten/löschen
  - GET/POST /api/musik/sounds → sound_library Tabelle (mit Filtern: category, search, bpm_min, bpm_max, key, tag)
  - POST /api/musik/sounds/bulk → Bulk-Import: Claude Haiku kategorisiert Dateinamen,
    BPM (60-200) und Tonart werden aus Dateinamen geparst
  - DELETE /api/musik/sounds/[id] → einzelnen Sound löschen
- app/musik/page.tsx: vollständige Musik-Seite ('use client') mit:
  - Tab-Switcher: PROJEKTE | SOUND LIBRARY
  - Projekte-View:
    - Status-Filter-Pills (ALLE / IDEE / WIP / MIXING / DONE / RELEASED)
    - Genre-Dropdown (dynamisch aus vorhandenen Projekten)
    - Quick-Add-Formular (Inline, Titel + BPM + Tonart + Scale + Genre + Mood)
    - Project-Grid (responsive, auto-fill min 280px)
    - Edit-Drawer (fixed right, 380px, mit Backdrop-Overlay)
    - Alle CRUD-Operationen (create, update, delete mit confirm())
  - Sound Library-View:
    - Kategorie-Sidebar (ALLE + 8 Kategorien mit Live-Counts)
    - Suchfeld (name/key/tags), BPM min-max Filter
    - Dense-List mit Header-Row
    - Dateipfad-Copy-Button (clipboard)
    - Add-Sound-Formular (inline)
    - Bulk-Import-Modal (Claude Haiku, mit Importanzahl-Feedback)
- components/dashboard/MusikSnapshot.tsx: nutzt MusicProject aus lib/types
  (musical_key statt musicalKey — war Naming-Mismatch)
- app/page.tsx: lädt echte Musik-Projekte aus Supabase (top 3 by updated_at)
- Fix: .next Build-Cache nach npx next build gelöscht (chunk-Kollision mit Dev-Server behoben)
