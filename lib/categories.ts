// Reine Konstanten — KEINE Server-Imports (kein Anthropic SDK).
// Diese Datei ist sicher in Client Components importierbar.
// lib/knowledge.ts (server-only, zieht das Anthropic SDK) re-exportiert von hier.

export const VALID_CATEGORIES = [
  'Zahnmedizin', 'Triathlon', 'Krafttraining', 'Ernährung',
  'Musikproduktion', 'FL Studio', 'Sampling', 'Allgemein',
] as const

export const NOTE_CATEGORIES = [
  'Training-relevant', 'Soziales', 'Arbeit-Uni', 'Recherche', 'Projekte',
] as const
