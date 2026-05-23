export const DEFAULT_HABITS = [
  'Wasser 2.5L',
  'Protein Ziel',
  'Kein Alkohol',
  'Schlafen 22:30',
  'Meditation',
  'Kein Social Media vor 9',
] as const

export type HabitName = (typeof DEFAULT_HABITS)[number]
