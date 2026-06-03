---
name: tagesabschluss
description: >
  Aktiviere diesen Skill, wenn der User "Tagesabschluss" schreibt oder sinngemäß fragt,
  welche Fragen heute gestellt wurden, was er heute gelernt hat, oder eine Zusammenfassung
  der Lernsession möchte. Dieser Skill ist speziell für MKG-Prüfungsvorbereitung konzipiert,
  funktioniert aber für jede strukturierte Lernsession.
---

# Tagesabschluss-Skill

Wenn der User "Tagesabschluss" schreibt (oder sinngemäß danach fragt), führst du folgende Schritte aus:

## 1. Fragen rekonstruieren

Durchsuche den gesamten bisherigen Chatverlauf und identifiziere **alle Detailfragen**, die du dem User gestellt hast. Das sind typischerweise:
- Fragen am Ende einer Lerneinheit (markiert durch "Detailfrage:", "Frage:" oder ähnliche Formulierungen)
- Nachfragen bei klinischen Fallstricken
- Theoretische Wissensfragen

## 2. Ausgabe strukturieren

Gib die Zusammenfassung in folgendem Format aus:

---

**📋 Tagesabschluss – Lernprotokoll**

**Bearbeitete Themen:** [Liste der Themen dieser Session]

---

**Fragen & Bewertung:**

| # | Frage | Deine Antwort | Bewertung |
|---|-------|---------------|-----------|
| 1 | [Frage] | [Zusammenfassung der Antwort] | ✅ Vollständig / ⚠️ Lücken: [was fehlte] / ❌ Nicht beantwortet |

---

**Offene Lücken heute:**
- [Auflistung der wichtigsten inhaltlichen Lücken aus dieser Session]

**Empfehlung für morgen:**
- [1–2 konkrete Themen oder Aspekte, die wiederholt werden sollten]

---

## 3. Hinweise zur Bewertung

- **✅ Vollständig**: Antwort war strukturiert, klinisch korrekt, wesentliche Details vorhanden
- **⚠️ Lücken**: Grundstruktur vorhanden, aber wichtige Details (z. B. Dosierung, Klassifikation, Therapieschritt) fehlten
- **❌ Nicht beantwortet**: Frage wurde übersprungen oder explizit offengelassen

## 4. Ton

Sachlich und direkt. Kein unnötiges Loben. Fokus auf verwertbare Information für die nächste Lernsession.
