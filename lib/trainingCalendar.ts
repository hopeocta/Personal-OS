// Gemeinsame Hilfsfunktionen für Kalender-Trainingserkennung.
// Beide Komponenten (MNextTraining + TrainingNext7) importieren von hier —
// nie lokal duplizieren, damit Desktop und Mobile identisch filtern.

// Lauf-Keywords DE+EN (Runna sendet teils Deutsch, teils Englisch).
const RUN_KW = [
  'run', 'lauf', 'jog', 'marathon',
  'intervals', 'intervall',
  'tempo run', 'tempo',
  'long run', 'recovery run',
  'zeitlauf', 'wiederhol', 'fahrtspiel',
  'pace',
]

// Eindeutig andere Sportarten im Titel → kein Lauf.
const NON_RUN_KW = ['schwimm', 'swim', 'rad', 'bike', 'cycl', 'kraft', 'gym', 'strength', 'spinning']

/**
 * Gibt true zurück wenn der Kalender-Event-Titel nach einem Lauf aussieht.
 * Weder Desktop noch Mobile dürfen eigene Listen pflegen — immer diese Funktion nutzen.
 */
export function isCalendarRunEvent(title: string): boolean {
  const t = title.toLowerCase()
  if (NON_RUN_KW.some((kw) => t.includes(kw))) return false
  return RUN_KW.some((kw) => t.includes(kw))
}
