/** Zentrale Obsidian-Pfade — eine Quelle für Vault-Ordner (CLAUDE.md / docs/obsidian.md). */

/** Einziger Zahnmedizin-Ordner im Vault (unter Literatur/Medizin). */
export const OBSIDIAN_ZAHNMEDIZIN_FOLDER = 'Literatur/Medizin/Zahnmedizin'

/** Legacy-Pfade, die per Migration nach OBSIDIAN_ZAHNMEDIZIN_FOLDER wandern. */
export const LEGACY_ZAHNMEDIZIN_FOLDERS = ['Zahnmedizin', 'Recherche/Zahnmedizin'] as const

/** Einkaufsliste (Telegram + Obsidian-Spiegel). */
export const OBSIDIAN_EINKAUF_FOLDER = 'Einkauf'
export const OBSIDIAN_EINKAUF_LIST_FILE = 'Einkauf/Aktuelle-Liste.md'

/** Legacy: zweiter Einkauf-Ordner — Migration nach OBSIDIAN_EINKAUF_FOLDER. */
export const LEGACY_EINKAUF_FOLDERS = ['Einkauf-Anschaffungen'] as const

/** Verwaltung/Datenbank: persönliche Ausweisdokumente (Pass, Ausweis, Impfpass). */
export const VERWALTUNG_DATENBANK = 'Datenbank'

/** Reisen ist KEIN Verwaltungs-Unterordner, sondern top-level — Reise-Buchungen/-Dokumente. */
export const REISEN_CATEGORY = 'Reisen'
export const REISEN_DOKUMENTE_FOLDER = 'Reisen/Dokumente'
export const REISEN_PLAENE_FOLDER = 'Reisen/Pläne'

export const VERWALTUNG_CATEGORIES = [
  'Versicherung',
  'Arbeit',
  'Amt',
  'Finanzen',
  'Wohnen',
  VERWALTUNG_DATENBANK,
  REISEN_CATEGORY,
  'Sonstiges',
] as const

export type VerwaltungCategory = (typeof VERWALTUNG_CATEGORIES)[number]

const CATEGORY_TO_FOLDER: Record<string, string> = {
  Zahnmedizin: OBSIDIAN_ZAHNMEDIZIN_FOLDER,
  Triathlon: 'Gesundheit/Recherche',
  Krafttraining: 'Gesundheit/Recherche',
  Ernährung: 'Gesundheit/Recherche',
  Musikproduktion: 'Musik',
  'FL Studio': 'Musik',
  Sampling: 'Musik',
  Allgemein: 'Recherche',
  Einkauf: OBSIDIAN_EINKAUF_FOLDER,
}

/** Obsidian-Unterordner für eine knowledge_entries-Kategorie. */
export function obsidianFolderForCategory(category: string): string {
  return CATEGORY_TO_FOLDER[category] ?? `Recherche/${category}`
}

/** Voller Vault-Pfad für einen Wissens-Eintrag. */
export function knowledgeEntryVaultPath(
  category: string,
  date: string,
  slug: string,
): string {
  return `${obsidianFolderForCategory(category)}/${date}-${slug}.md`
}

/** Normalisiert Verwaltungs-Kategorie (inkl. Datenbank für Reise/Personal). */
export function normalizeVerwaltungCategory(kategorie: string | undefined): VerwaltungCategory {
  if (kategorie && (VERWALTUNG_CATEGORIES as readonly string[]).includes(kategorie)) {
    return kategorie as VerwaltungCategory
  }
  return 'Sonstiges'
}

/** Unterordner innerhalb von Verwaltung/Finanzen (bessere Übersicht). */
export const FINANZEN_SUBCATEGORIES = [
  'Rechnungen privat',
  'Rechnungen Arbeit',
  'Steuern',
] as const

export type FinanzenSubcategory = (typeof FINANZEN_SUBCATEGORIES)[number]

/** Gültige Finanzen-Unterkategorie oder null (→ direkt in Finanzen/). */
export function normalizeFinanzenSub(sub: string | undefined | null): FinanzenSubcategory | null {
  if (sub && (FINANZEN_SUBCATEGORIES as readonly string[]).includes(sub)) {
    return sub as FinanzenSubcategory
  }
  return null
}

export function verwaltungVaultFolder(kategorie: string, sub?: string | null): string {
  const kat = normalizeVerwaltungCategory(kategorie)
  if (kat === REISEN_CATEGORY) return REISEN_DOKUMENTE_FOLDER // top-level, nicht unter Verwaltung
  const finanzenSub = kat === 'Finanzen' ? normalizeFinanzenSub(sub) : null
  return `Verwaltung/${kat}${finanzenSub ? `/${finanzenSub}` : ''}`
}

export function verwaltungStoragePath(
  kategorie: string,
  baseName: string,
  ext: string,
  sub?: string | null,
): string {
  const kat = normalizeVerwaltungCategory(kategorie)
  if (kat === REISEN_CATEGORY) return `reisen/dokumente/${baseName}.${ext}`
  const finanzenSub = kat === 'Finanzen' ? normalizeFinanzenSub(sub) : null
  return `verwaltung/${kat}${finanzenSub ? `/${finanzenSub}` : ''}/${baseName}.${ext}`
}
