// Kanonische Metrik-Definitionen für health_labs.test_name.
// Gleiche Laborwerte erscheinen je nach Labor unter verschiedenen Namen
// (DE/IT/EN, Abkürzungen vs. Langformen). Diese Datei mappt alle bekannten
// Varianten auf einen einheitlichen deutschen Kurznamen.
//
// WICHTIG: Änderungen hier müssen SYNCHRON in scripts/normalize-health-labs.mjs
// (METRIC_DEFS-Array) nachgezogen werden — das Script braucht eine .mjs-Kopie.

export type MetricDef = {
  canonical: string // kanonischer Name — wird in health_labs gespeichert
  aliases: string[] // alle bekannten Varianten (case-insensitiv beim Matching)
  category: 'blutbild' | 'laktattest' | 'allgemein'
}

export const METRIC_DEFS: MetricDef[] = [
  // ── Blutbild ──────────────────────────────────────────────────────────────
  {
    canonical: 'Hämoglobin',
    aliases: ['HGB', 'Hb', 'Hemoglobin', 'Hemoglobina'],
    category: 'blutbild',
  },
  { canonical: 'Leukozyten', aliases: ['WBC'], category: 'blutbild' },
  { canonical: 'Erythrozyten', aliases: ['RBC'], category: 'blutbild' },
  { canonical: 'Thrombozyten', aliases: ['PLT'], category: 'blutbild' },
  {
    canonical: 'Hämatokrit',
    aliases: ['Ematocrito', 'HKT', 'Hct'],
    category: 'blutbild',
  },
  { canonical: 'MCH', aliases: ['HbE (MCH)', 'HbE'], category: 'blutbild' },
  {
    canonical: 'Glukose',
    aliases: ['Blutzucker (NaF)', 'Glicemia', 'Blutzucker', 'Glucose'],
    category: 'blutbild',
  },
  {
    canonical: 'Kreatinin',
    aliases: ['Creatininemia', 'Creatinin', 'Creatinine'],
    category: 'blutbild',
  },
  {
    canonical: 'ALT',
    aliases: ['GPT', 'Alanin-Aminotransferase', 'ALAT'],
    category: 'blutbild',
  },
  {
    canonical: 'AST',
    aliases: ['GOT', 'Aspartat-Aminotransferase', 'ASAT'],
    category: 'blutbild',
  },
  { canonical: 'Lymphozyten', aliases: ['Linfociti'], category: 'blutbild' },
  { canonical: 'Eosinophile', aliases: ['Eosinofili'], category: 'blutbild' },
  { canonical: 'Basophile', aliases: ['Basofili'], category: 'blutbild' },
  { canonical: 'Monozyten', aliases: ['Monociti'], category: 'blutbild' },
  {
    canonical: 'Neutrophile',
    aliases: ['Neutrophile Granulozyten', 'Neutrofili'],
    category: 'blutbild',
  },
  {
    canonical: 'Gesamtcholesterin',
    aliases: ['Ges.-Cholesterin', 'Cholesterol totale', 'Cholesterol', 'Gesamt-Cholesterin'],
    category: 'blutbild',
  },
  {
    canonical: 'Bilirubin',
    aliases: ['Bilirubin totale', 'Gesamtbilirubin'],
    category: 'blutbild',
  },
  // ── Allgemein (kommt in Blutbild und Laktattest vor) ──────────────────────
  {
    canonical: 'BMI',
    aliases: ['Body-Mass-Index (BMI)', 'Body Mass Index'],
    category: 'allgemein',
  },
  {
    canonical: 'Körpergröße',
    aliases: ['Körpergroesse', 'Koerpergröße', 'Körperhöhe'],
    category: 'allgemein',
  },
  { canonical: 'Körpergewicht', aliases: ['Gewicht'], category: 'allgemein' },
]

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/** Löst einen rohen Laborwert-Namen auf den kanonischen Namen auf.
 *  Unbekannte Namen werden unverändert zurückgegeben. */
export function resolveCanonical(raw: string): string {
  const lower = raw.toLowerCase().trim()
  for (const def of METRIC_DEFS) {
    if (def.canonical.toLowerCase() === lower) return def.canonical
    if (def.aliases.some((a) => a.toLowerCase() === lower)) return def.canonical
  }
  return raw
}

/** Gibt kanonischen Namen + alle Aliases zurück (für IN-Queries über mehrere Dokumente).
 *  Falls unbekannt: nur der Input selbst → Fallback auf ILIKE. */
export function expandAliases(name: string): string[] {
  const lower = name.toLowerCase().trim()
  for (const def of METRIC_DEFS) {
    if (
      def.canonical.toLowerCase() === lower ||
      def.aliases.some((a) => a.toLowerCase() === lower)
    ) {
      return [def.canonical, ...def.aliases]
    }
  }
  return [name]
}
