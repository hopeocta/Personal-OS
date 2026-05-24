export type SkillLevel = 'Vorklinik' | 'Klinik'

export type DentalSkill = {
  id: string
  label: string
  level: SkillLevel
}

export const DENTAL_SKILLS: DentalSkill[] = [
  { id: 'phantom_karies',  label: 'Kariesbehandlung am Phantom',        level: 'Vorklinik' },
  { id: 'phantom_fuell',   label: 'Kompositfüllung am Phantom',          level: 'Vorklinik' },
  { id: 'phantom_endo',    label: 'Endodontie am Phantom',               level: 'Vorklinik' },
  { id: 'phantom_krone',   label: 'Kronenpräparation am Phantom',        level: 'Vorklinik' },
  { id: 'phantom_bruecke', label: 'Brückenpräparation am Phantom',       level: 'Vorklinik' },
  { id: 'endo_basic',      label: 'Endodontische Grundbehandlung',       level: 'Klinik' },
  { id: 'paro_basic',      label: 'Parodontale Basistherapie (UPT)',     level: 'Klinik' },
  { id: 'extraction',      label: 'Einfache Extraktion',                 level: 'Klinik' },
  { id: 'crown_prep',      label: 'Kronenpräparation am Patient',        level: 'Klinik' },
  { id: 'composite_fill',  label: 'Kompositfüllung am Patient',          level: 'Klinik' },
  { id: 'scaling',         label: 'Professionelle Zahnreinigung',        level: 'Klinik' },
  { id: 'local_anesthesia','label': 'Lokalanästhesie',                   level: 'Klinik' },
  { id: 'surgical_ext',    label: 'Chirurgische Extraktion',             level: 'Klinik' },
  { id: 'suture',          label: 'Naht setzen und entfernen',           level: 'Klinik' },
]
