// 14-Wochen Trainingsplan für Ute (p1) — 20.06.–26.09.2026
// Pyramidales Modell für Masters-Athletin (60J, 5h/Woche):
//   80% Z2 (Grundlage), 15% Z3, 5% Z4+
//   Max 2 harte Einheiten/Woche, min 48h Abstand
//   Regenerationswochen: KW 4, 8, 12 (Volumen -30%)
//   Intervalle: KW 2, 6, 9, 11, 13
//
// HF-Zonen (HFmax 174):
//   Z1 < 104 | Z2 104–125 (Laufen max 125!) | Z3 126–139 | Z4 140–156 | Z5 > 156
//
// Kern: So Laufen + Di Rolle + Mi Schwimmen + Do Laufen/Intervall
// Optional (2x): Fr Rolle + Sa Kurz-Lauf/OWS

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const USER_ID = 'p1'

// Wochenstartdaten (Sonntag)
// Wo 1: 21.06 | Wo 2: 28.06 | Wo 3: 05.07 | Wo 4: 12.07 (REGEN)
// Wo 5: 19.07 | Wo 6: 26.07 | Wo 7: 02.08 | Wo 8: 09.08 (REGEN)
// Wo 9: 16.08 | Wo10: 23.08 | Wo11: 30.08 | Wo12: 06.09 (REGEN)
// Wo13: 13.09 | Wo14: 20.09

function d(sunday, plusDays) {
  const dt = new Date(sunday)
  dt.setDate(dt.getDate() + plusDays)
  return dt.toISOString().split('T')[0]
}

function session(date, sport, title, duration_min, opts = {}) {
  return {
    user_id: USER_ID,
    date,
    sport,
    title,
    duration_min,
    is_easy: opts.is_easy ?? true,
    hf_zone: opts.hf_zone ?? 'Z2',
    hf_range: opts.hf_range ?? null,
    pace_speed: opts.pace_speed ?? null,
    watts_indoor: opts.watts_indoor ?? null,
    distance_km: opts.distance_km ?? null,
    details: opts.details ?? null,
    intensity_kind: opts.intensity_kind ?? 'endurance',
    is_optional: opts.optional ?? false,
    sort_order: opts.optional ? 10 : 0,
    source: 'plan',
  }
}

const sessions = []

// ───────────────────────────────────────────────
// PHASE 1 — GRUNDLAGE (KW 1–4)
// Fokus: Z2-Gewöhnung, Schwimmtechnik, Rolle einbauen
// ───────────────────────────────────────────────

// KW 1 — Eingewöhnung (21.06.)
const w1 = '2026-06-21'
sessions.push(
  session(d(w1,0), 'running',  'Langer Lauf — locker Z2 (max HF 125)', 65, { hf_range:'104–125', details:'Sehr locker, Schritt zurückhalten. Bei HF > 125 sofort langsamer werden. Keine Ambitionen.' }),
  session(d(w1,2), 'cycling',  'Grundlage Rolle — Z2', 45, { hf_range:'104–122', details:'Gleichmäßige Trittfrequenz 85–90 rpm, locker bleiben, kein Druck.' }),
  session(d(w1,3), 'swimming', 'Technik-Schwimmen — Züge zählen', 40, { hf_zone:'Z1-Z2', hf_range:'<122', details:'10×100m locker, nach jedem 100er Züge zählen (Ziel: gleichbleibende Zahl). Lange Gleitphase.', intensity_kind:'technique' }),
  session(d(w1,4), 'running',  'Lauf Z2 — streng unter HF 125', 55, { hf_range:'104–125', details:'Tempo egal — HF ist die einzige Vorgabe. Gerne gehen wenn nötig.' }),
  session(d(w1,5), 'cycling',  'Locker Rolle (optional)', 35, { hf_range:'<118', details:'Wer Lust hat: ganz leicht, kein Druck.', optional:true }),
  session(d(w1,6), 'running',  'Kurzer lockerer Lauf (optional)', 25, { hf_zone:'Z1', hf_range:'<115', details:'Nur wenn Beine frisch sind.', optional:true })
)

// KW 2 — Erstes Intervall (28.06.)
const w2 = '2026-06-28'
sessions.push(
  session(d(w2,0), 'running',  'Langer Lauf Z2', 70, { hf_range:'104–125', details:'Gleiche Regel: HF unter 125 halten. Ruhig und gleichmäßig.' }),
  session(d(w2,2), 'cycling',  'Grundlage Rolle — Z2', 45, { hf_range:'104–122', details:'Locker, gleichmäßig. Vorbereitung für Donnerstag-Intervalle.' }),
  session(d(w2,3), 'swimming', 'Technik: Arm-Zug-Fokus', 40, { hf_zone:'Z1-Z2', details:'8×100m: jede Bahn Fokus auf hohen Ellenbogen beim Zug. Pause zwischen den 100ern.', intensity_kind:'technique' }),
  session(d(w2,4), 'running',  'Intervalle: 4×5 min Z4', 55, { hf_zone:'Z4', hf_range:'140–155', is_easy:false, details:'10 min locker einlaufen (HF < 120). Dann 4×5 min auf 140–155 HF, je 3 min locker traben. 10 min auslaufen.', intensity_kind:'interval' }),
  session(d(w2,5), 'cycling',  'Locker Rolle (optional)', 35, { hf_range:'<118', details:'Optional — Beine auslockernd nach Intervallen.', optional:true }),
  session(d(w2,6), 'running',  'Kurz locker (optional)', 25, { hf_zone:'Z1', optional:true, details:'Nur wenn Erholung gut.' })
)

// KW 3 — Aufbau (05.07.)
const w3 = '2026-07-05'
sessions.push(
  session(d(w3,0), 'running',  'Langer Lauf Z2', 70, { hf_range:'104–125', details:'Ruhig und gleichmäßig. Gerne etwas länger wenn es leicht fällt.' }),
  session(d(w3,2), 'cycling',  'Rolle Z2 — leicht länger', 50, { hf_range:'104–122', details:'5 min länger als letzte Woche. Selbe ruhige Intensität.' }),
  session(d(w3,3), 'swimming', 'Technik: Beinschlag-Fokus', 45, { hf_zone:'Z1-Z2', details:'12×75m: jede 2. Bahn nur mit Beinschlag (Brett). Langsam und effizient.', intensity_kind:'technique' }),
  session(d(w3,4), 'running',  'Lauf Z2 — streng unter HF 125', 60, { hf_range:'104–125', details:'Kein Intervall diese Woche. Fokus: die volle Stunde locker halten.' }),
  session(d(w3,5), 'cycling',  'Locker Rolle (optional)', 40, { hf_range:'<118', optional:true }),
  session(d(w3,6), 'running',  'Kurz locker (optional)', 30, { hf_zone:'Z1', optional:true })
)

// KW 4 — REGENERATION (12.07.)
const w4 = '2026-07-12'
sessions.push(
  session(d(w4,0), 'running',  'Regenerations-Lauf — ganz locker', 50, { hf_zone:'Z1', hf_range:'<115', details:'Kein Tempo, kein Druck. Fühlt sich fast zu langsam an — perfekt.' }),
  session(d(w4,3), 'swimming', 'Lockeres Schwimmen — kein Stress', 30, { hf_zone:'Z1', details:'Technik-Schwimmen, keine Sets. Einfach ruhig Bahnen ziehen.', intensity_kind:'technique' }),
  session(d(w4,4), 'cycling',  'Lockere Rolle — Regeneration', 35, { hf_zone:'Z1', hf_range:'<110', details:'Ganz leicht, Beine auslockern.' })
  // Keine optionalen Einheiten in Regenerationswoche
)

// ───────────────────────────────────────────────
// PHASE 2 — AUFBAU (KW 5–9)
// Fokus: Volumen steigt, Schwimm-Ausdauer, Intervalle alle 2 Wochen
// ───────────────────────────────────────────────

// KW 5 — Aufbau (19.07.)
const w5 = '2026-07-19'
sessions.push(
  session(d(w5,0), 'running',  'Langer Lauf Z2', 75, { hf_range:'104–125', details:'5 min länger als letzter langer Lauf. Locker bleiben.' }),
  session(d(w5,2), 'cycling',  'Rolle mit Fahrtspiel', 50, { hf_zone:'Z2-Z3', hf_range:'104–135', details:'35 min Z2, dann 3×3 min Z3 (bis 135 HF), je 2 min locker.', intensity_kind:'endurance' }),
  session(d(w5,3), 'swimming', 'Ausdauer-Schwimmen: 3×400m', 45, { hf_zone:'Z2', details:'Einchwimmen 300m, dann 3×400m gleichmäßig Z2, je 45 Sek Pause. Kein Sprint.', intensity_kind:'endurance' }),
  session(d(w5,4), 'running',  'Lauf Z2 — gleichmäßig', 60, { hf_range:'104–125', details:'Kein Intervall. Fokus: 60 min komplett in Z2 halten.' }),
  session(d(w5,5), 'cycling',  'Locker Rolle (optional)', 40, { hf_range:'<118', optional:true }),
  session(d(w5,6), 'running',  'Kurz locker (optional)', 30, { hf_zone:'Z1', optional:true })
)

// KW 6 — Intervall (26.07.)
const w6 = '2026-07-26'
sessions.push(
  session(d(w6,0), 'running',  'Langer Lauf Z2 — locker bleiben', 80, { hf_range:'104–125', details:'Längster Lauf bisher. Ganz ruhig. Bei Hitze kürzer machen.' }),
  session(d(w6,2), 'cycling',  'Grundlage Rolle Z2', 50, { hf_range:'104–122', details:'Locker — Beine frisch halten für Donnerstag.' }),
  session(d(w6,3), 'swimming', '3×500m gleichmäßig', 45, { hf_zone:'Z2', details:'500m locker einschwimmen, dann 3×500m mit gleichmäßigem Tempo, je 60 Sek Pause.', intensity_kind:'endurance' }),
  session(d(w6,4), 'running',  'Intervalle: 3×8 min Z4', 60, { hf_zone:'Z4', hf_range:'140–155', is_easy:false, details:'10 min einlaufen. Dann 3×8 min Z4 (140–155 HF), je 4 min locker traben. 10 min auslaufen.', intensity_kind:'interval' }),
  session(d(w6,5), 'cycling',  'Locker Rolle (optional)', 40, { hf_range:'<118', optional:true }),
  session(d(w6,6), 'running',  'Kurz locker (optional)', 30, { hf_zone:'Z1', optional:true })
)

// KW 7 — Aufbau (02.08.)
const w7 = '2026-08-02'
sessions.push(
  session(d(w7,0), 'running',  'Langer Lauf Z2', 80, { hf_range:'104–125', details:'Gleiche Länge wie letzte Woche. Diesmal vielleicht etwas flüssiger.' }),
  session(d(w7,2), 'cycling',  'Rolle: 20 min Z3-Block', 55, { hf_zone:'Z2-Z3', hf_range:'104–138', details:'15 min einfahren, dann 20 min Z3 (125–138 HF) am Stück, 20 min locker ausfahren.', intensity_kind:'endurance' }),
  session(d(w7,3), 'swimming', '4×400m — Tempo stabil halten', 50, { hf_zone:'Z2', details:'Einschwimmen 300m, dann 4×400m. Ziel: alle 4 in gleicher Zeit. Keine Pace-Einbrüche.', intensity_kind:'endurance' }),
  session(d(w7,4), 'running',  'Lauf Z2 — 65 min', 65, { hf_range:'104–125', details:'Kein Intervall. Die längere Strecke locker durchlaufen.' }),
  session(d(w7,5), 'cycling',  'Locker Rolle (optional)', 45, { hf_range:'<118', optional:true }),
  session(d(w7,6), 'running',  'Kurz locker oder OWS (optional)', 35, { hf_zone:'Z1-Z2', optional:true })
)

// KW 8 — REGENERATION (09.08.)
const w8 = '2026-08-09'
sessions.push(
  session(d(w8,0), 'running',  'Regenerations-Lauf', 55, { hf_zone:'Z1', hf_range:'<115', details:'Sehr locker. Kein Druck nach den zwei harten Wochen.' }),
  session(d(w8,3), 'swimming', 'Lockeres Schwimmen', 30, { hf_zone:'Z1', details:'Einfach ruhig Bahnen ziehen.', intensity_kind:'technique' }),
  session(d(w8,4), 'cycling',  'Lockere Rolle', 40, { hf_zone:'Z1-Z2', hf_range:'<118', details:'Sehr leicht, Beine auslockern.' })
)

// KW 9 — Intervall (16.08.)
const w9 = '2026-08-16'
sessions.push(
  session(d(w9,0), 'running',  'Langer Lauf Z2 — Peak-Basis', 85, { hf_range:'104–125', details:'Längster Grundlagen-Lauf. Ganz locker. Verpflegung mitnehmen.' }),
  session(d(w9,2), 'cycling',  'Rolle: 2×10 min Z3', 55, { hf_zone:'Z2-Z3', hf_range:'104–138', details:'15 min einfahren, 2×10 min Z3 (125–138 HF), 5 min locker dazwischen, 15 min ausfahren.', intensity_kind:'endurance' }),
  session(d(w9,3), 'swimming', '3×600m + 200m schnell', 50, { hf_zone:'Z2-Z3', details:'Einschwimmen, dann 3×600m Z2, kurze Pause, 1×200m zügiger (Z3). Technik halten!', intensity_kind:'endurance' }),
  session(d(w9,4), 'running',  'Intervalle: 5×4 min Z4-Z5', 65, { hf_zone:'Z4-Z5', hf_range:'140–165', is_easy:false, details:'10 min einlaufen. 5×4 min Z4-Z5 (140–165 HF), je 3 min locker. 12 min auslaufen.', intensity_kind:'interval' }),
  session(d(w9,5), 'cycling',  'Locker Rolle (optional)', 45, { hf_range:'<118', optional:true }),
  session(d(w9,6), 'running',  'Kurz locker (optional)', 35, { hf_zone:'Z1', optional:true })
)

// ───────────────────────────────────────────────
// PHASE 3 — SPEZIFISCH (KW 10–12)
// Fokus: Wettkampf-nahe Intensität, Schwimm-Pace, längere Rolle
// ───────────────────────────────────────────────

// KW 10 — Spezifisch (23.08.)
const w10 = '2026-08-23'
sessions.push(
  session(d(w10,0), 'running',  'Langer Lauf — Peak', 85, { hf_range:'104–125', details:'Längster Lauf des Plans. Wasser mitnehmen. Letzte 20 min dürfen etwas zügiger werden (bis 130 HF).' }),
  session(d(w10,2), 'cycling',  'Lange Rolle: 30 min Z3-Block', 60, { hf_zone:'Z2-Z3', hf_range:'104–138', details:'15 min einfahren, 30 min Z3 am Stück (125–138 HF), 15 min ausfahren. Konzentration auf gleichmäßige Leistung.', intensity_kind:'endurance' }),
  session(d(w10,3), 'swimming', 'Wettkampf-Pace: 5×200m', 50, { hf_zone:'Z3', hf_range:'125–138', details:'Einschwimmen 400m. Dann 5×200m mit ~90% Tempo — schneller als Z2 aber kontrolliert. Pause 45 Sek.', intensity_kind:'interval', is_easy:false }),
  session(d(w10,4), 'running',  'Lauf Z2 — 65 min', 65, { hf_range:'104–125', details:'Kein Intervall. Lange Grundlage nach harter Woche.' }),
  session(d(w10,5), 'cycling',  'Locker Rolle (optional)', 45, { hf_range:'<118', optional:true }),
  session(d(w10,6), 'running',  'Kurz locker (optional)', 35, { hf_zone:'Z1', optional:true })
)

// KW 11 — Schwellen-Lauf (30.08.)
const w11 = '2026-08-30'
sessions.push(
  session(d(w11,0), 'running',  'Peak-Lauf — ganz locker', 90, { hf_range:'104–125', details:'90 min ist viel — ganz bewusst locker bleiben. Kein Druck. Wer müde ist: 75 min reicht.' }),
  session(d(w11,2), 'cycling',  'Lange Rolle Z2-Z3', 60, { hf_zone:'Z2-Z3', hf_range:'104–135', details:'Gleichmäßig 60 min, letzte 20 min leicht zügiger (bis 135 HF).' }),
  session(d(w11,3), 'swimming', '1000m Dauerlauf + 3×200m', 50, { hf_zone:'Z2-Z3', details:'Einschwimmen 200m. Dann 1×1000m gleichmäßig Z2. Pause. 3×200m etwas schneller (Z3). Ausschwimmen.', intensity_kind:'endurance' }),
  session(d(w11,4), 'running',  'Schwellen-Lauf: 2×15 min Z4', 65, { hf_zone:'Z4', hf_range:'140–155', is_easy:false, details:'10 min einlaufen. 2×15 min Z4 (140–155 HF), 5 min locker traben dazwischen. 10 min auslaufen. Das ist die härteste Einheit des Plans.', intensity_kind:'interval' }),
  session(d(w11,5), 'cycling',  'Locker Rolle (optional)', 45, { hf_range:'<118', optional:true }),
  session(d(w11,6), 'running',  'Kurz locker oder OWS (optional)', 35, { hf_zone:'Z1', optional:true })
)

// KW 12 — REGENERATION (06.09.)
const w12 = '2026-09-06'
sessions.push(
  session(d(w12,0), 'running',  'Regenerations-Lauf', 55, { hf_zone:'Z1', hf_range:'<115', details:'Nach den harten Wochen dringend nötige Erholung. Sehr locker.' }),
  session(d(w12,3), 'swimming', 'Lockeres Schwimmen', 35, { hf_zone:'Z1', details:'Technik, keine Sets, kein Druck.', intensity_kind:'technique' }),
  session(d(w12,4), 'cycling',  'Lockere Rolle', 40, { hf_zone:'Z1-Z2', hf_range:'<118', details:'Ganz leicht. Körper erholen lassen.' })
)

// ───────────────────────────────────────────────
// PHASE 4 — KONSOLIDIERUNG (KW 13–14)
// Kein Rennen — Ziel: Form festigen, Effizienz spüren.
// Gleiche Leistung bei niedrigerer HF = der Plan hat gewirkt.
// ───────────────────────────────────────────────

// KW 13 — Konsolidierung mit Intensität (13.09.)
const w13 = '2026-09-13'
sessions.push(
  session(d(w13,0), 'running',  'Langer Lauf Z2 — Effizienz spüren', 80, { hf_range:'104–125', details:'Vergleich mit KW 1: gleiche HF, höheres Tempo? Dann hat der Plan gewirkt. Locker und gleichmäßig.' }),
  session(d(w13,2), 'cycling',  'Rolle: Z3-Block', 55, { hf_zone:'Z2-Z3', hf_range:'104–138', details:'15 min einfahren, 25 min Z3 (125–138 HF), 15 min ausfahren. Gleichmäßige Leistung ohne zu kämpfen.', intensity_kind:'endurance' }),
  session(d(w13,3), 'swimming', 'Ausdauer + 3×100m zügig', 45, { hf_zone:'Z2-Z3', details:'600m locker einschwimmen. 3×100m mit kontrolliertem Zug (Z3). 200m ausschwimmen.', intensity_kind:'endurance' }),
  session(d(w13,4), 'running',  'Intervalle: 4×5 min Z4', 60, { hf_zone:'Z4', hf_range:'140–155', is_easy:false, details:'10 min einlaufen. 4×5 min Z4 (140–155 HF), 3 min locker traben. 10 min auslaufen.', intensity_kind:'interval' }),
  session(d(w13,5), 'cycling',  'Locker Rolle (optional)', 40, { hf_range:'<118', optional:true }),
  session(d(w13,6), 'running',  'Kurz locker (optional)', 30, { hf_zone:'Z1', optional:true })
)

// KW 14 — Abschluss (20.09.)
const w14 = '2026-09-20'
sessions.push(
  session(d(w14,0), 'running',  'Langer Lauf Z2 — Abschluss-Runde', 80, { hf_range:'104–125', details:'Letzter langer Lauf des Blocks. Locker genießen. Wer mag, vergleicht das Tempo mit Woche 1.' }),
  session(d(w14,2), 'cycling',  'Rolle Z2-Z3', 55, { hf_zone:'Z2-Z3', hf_range:'104–135', details:'Gleichmäßig und sauber. Kein Druck, aber auch kein Schlendern.' }),
  session(d(w14,3), 'swimming', 'Schwimmen — Technik & Ausdauer', 45, { hf_zone:'Z2', details:'3×400m gleichmäßig. Fokus auf Zugqualität — was hat sich in 14 Wochen verbessert?', intensity_kind:'endurance' }),
  session(d(w14,4), 'running',  'Abschluss-Lauf Z2', 55, { hf_range:'104–125', details:'Letzter strukturierter Lauf. Locker und mit gutem Gefühl abschließen.' }),
  session(d(w14,5), 'cycling',  'Locker Rolle (optional)', 35, { hf_range:'<118', optional:true }),
  session(d(w14,6), 'running',  'Kurz locker (optional)', 30, { hf_zone:'Z1', optional:true })
)

// ───────────────────────────────────────────────
// INSERT
// ───────────────────────────────────────────────

console.log(`\n=== Seed Trainingsplan Ute (p1) — ${sessions.length} Einheiten ===\n`)

// Erst bestehende p1-Plan-Einträge löschen
const { error: delErr } = await sb
  .from('training_plan_sessions')
  .delete()
  .eq('user_id', USER_ID)
  .eq('source', 'plan')

if (delErr) {
  console.error('Fehler beim Löschen alter Einträge:', delErr.message)
  process.exit(1)
}
console.log('Alte Plan-Einträge gelöscht.')

const { data, error } = await sb
  .from('training_plan_sessions')
  .insert(sessions)
  .select('id')

if (error) {
  console.error('Insert-Fehler:', error.message)
  process.exit(1)
}

console.log(`${data.length} Einheiten eingefügt.\n`)

// Übersicht
const phases = [
  { name: 'Phase 1 Grundlage', weeks: 'KW 1–4  (21.06.–18.07.)' },
  { name: 'Phase 2 Aufbau',    weeks: 'KW 5–9  (19.07.–22.08.)' },
  { name: 'Phase 3 Spezifisch',weeks: 'KW 10–12 (23.08.–12.09.)'},
  { name: 'Phase 4 Konsolidierung', weeks: 'KW 13–14 (13.09.–26.09.)'},
]
phases.forEach(p => console.log(`  ${p.name}: ${p.weeks}`))

const kern = sessions.filter(s => !s.is_optional).length
const opt  = sessions.filter(s => s.is_optional).length
const intervalle = sessions.filter(s => s.intensity_kind === 'interval').length
console.log(`\n  Kern-Einheiten: ${kern} | Optionale: ${opt} | Intervall-Sessions: ${intervalle}`)
console.log('\n=== Fertig ===\n')
