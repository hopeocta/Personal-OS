import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

type Phase = { name: string; goal: string; from: number; to: number }

const PHASES: Record<string, Phase[]> = {
  p1: [
    { name: 'Grundlage', goal: 'Umfang aufbauen · locker in Z2',      from: 1,  to: 3  },
    { name: 'Aufbau',    goal: 'Intervalle einführen · mehr Rad',      from: 4,  to: 7  },
    { name: 'Spezifisch',goal: 'Wettkampftempo · Brick-Training',      from: 8,  to: 10 },
    { name: 'Taper',     goal: 'Formerhalt · Sprint-Vorbereitung',     from: 11, to: 14 },
  ],
  p2: [
    { name: 'Grundlage', goal: 'Z2-Basis · FTP-Blöcke aufbauen',      from: 1,  to: 3  },
    { name: 'Aufbau',    goal: 'VO2max · Over-Unders · Schwelle',      from: 4,  to: 7  },
    { name: 'Spezifisch',goal: 'Wettkampfintensität · Bricks',         from: 8,  to: 10 },
    { name: 'Taper',     goal: 'Formerhalt · Sprint-Tri-Vorbereitung', from: 11, to: 12 },
  ],
  me: [
    { name: 'Grundlage', goal: 'Aerob-Basis · Volumen aufbauen',       from: 1,  to: 3  },
    { name: 'Aufbau',    goal: 'Erste Intervalle · Umfang steigern',   from: 4,  to: 7  },
    { name: 'Spezifisch',goal: 'Wettkampfspezifisch · Bricks',         from: 8,  to: 10 },
    { name: 'Taper',     goal: 'Formerhalt · Vorbereitung',            from: 11, to: 14 },
  ],
  p3: [],
}

function weekStartOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

export async function GET() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const from28 = new Date()
  from28.setDate(from28.getDate() - 28)
  const fromStr = from28.toISOString().split('T')[0]

  const { data: persons } = await supabaseAdmin
    .from('persons')
    .select('id, display_name, data_source')
    .eq('active', true)
    .order('id')

  if (!persons?.length) return NextResponse.json({ athletes: [] })

  const athletes = await Promise.all(persons.map(async (p) => {
    const pid = p.id as string
    const dataSource = (p.data_source as string | null) ?? 'garmin'

    const [{ data: firstSession }, { data: sessions }, { data: training }, { data: lastAct }, { data: garminActs }, { data: tpActs }] = await Promise.all([
      supabaseAdmin.from('training_plan_sessions').select('date').eq('user_id', pid)
        .order('date', { ascending: true }).limit(1).maybeSingle(),
      supabaseAdmin.from('training_plan_sessions').select('date, sport, is_optional')
        .eq('user_id', pid).eq('is_optional', false).not('sport', 'eq', 'rest')
        .gte('date', fromStr).lte('date', today),
      supabaseAdmin.from('garmin_training').select('ctl, atl, acwr, acwr_status, training_status, date').eq('user_id', pid)
        .order('date', { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from('garmin_activities').select('date, type, duration_min, name')
        .eq('user_id', pid).not('type', 'in', '("walking","uncategorized_activity","generic")')
        .order('date', { ascending: false }).limit(1).maybeSingle(),
      // Garmin: alle Aktivitäten der letzten 4 Wochen für done-Erkennung
      dataSource !== 'tp'
        ? supabaseAdmin.from('garmin_activities').select('date, type').eq('user_id', pid)
            .not('type', 'in', '("walking","uncategorized_activity","generic")')
            .gte('date', fromStr).lte('date', today)
        : Promise.resolve({ data: null }),
      // TP: alle completed Workouts der letzten 4 Wochen
      dataSource === 'tp'
        ? supabaseAdmin.from('tp_activities').select('workout_day, sport').eq('person_id', pid)
            .eq('status', 'completed').gte('workout_day', fromStr).lte('workout_day', today)
        : Promise.resolve({ data: null }),
    ])

    const planStart = firstSession?.date as string | null
    const todayDate = new Date(today + 'T12:00:00')
    const planWeek = planStart
      ? Math.max(1, Math.ceil((todayDate.getTime() - new Date(planStart + 'T12:00:00').getTime()) / (7 * 864e5)))
      : null

    const phases = PHASES[pid] ?? []
    const currentPhase = planWeek
      ? (phases.find(ph => planWeek >= ph.from && planWeek <= ph.to) ?? null)
      : null

    // Sport-Mapping Garmin
    const SPORT_GARMIN: Record<string, string[]> = {
      running:  ['running', 'trail_running', 'treadmill_running'],
      cycling:  ['cycling', 'indoor_cycling', 'road_biking', 'e_bike_fitness', 'virtual_ride'],
      swimming: ['lap_swimming', 'open_water_swimming'],
      strength: ['strength_training', 'functional_strength_training'],
    }
    const TP_SPORT: Record<string, string[]> = {
      running: ['Run'], cycling: ['Bike'], swimming: ['Swim'], strength: ['Strength'],
    }

    // Lookup-Maps: Datum → Sportarten (was tatsächlich gemacht wurde)
    const garminByDate: Record<string, string[]> = {}
    for (const a of garminActs ?? []) {
      const d = String(a.date); if (!garminByDate[d]) garminByDate[d] = []; garminByDate[d].push(String(a.type))
    }
    const tpByDate: Record<string, string[]> = {}
    for (const a of tpActs ?? []) {
      const d = String(a.workout_day); if (!tpByDate[d]) tpByDate[d] = []; tpByDate[d].push(String(a.sport))
    }

    // Group sessions by week — done via Aktivitäts-Match (nicht completed_at).
    // Nur vergangene Sessions zählen: zukünftige Einheiten in der laufenden Woche
    // sollen die Compliance nicht drücken (Woche noch nicht abgeschlossen).
    const weekMap: Record<string, { planned: number; done: number }> = {}
    for (const s of sessions ?? []) {
      if (String(s.date) > today) continue  // Zukunft ausschließen
      const wk = weekStartOf(String(s.date))
      if (!weekMap[wk]) weekMap[wk] = { planned: 0, done: 0 }
      weekMap[wk].planned++
      const sport = String(s.sport)
      let isDone = false
      if (dataSource === 'tp') {
        const tpSports = TP_SPORT[sport] ?? []
        isDone = (tpByDate[String(s.date)] ?? []).some(t => tpSports.includes(t))
      } else {
        const garminTypes = SPORT_GARMIN[sport] ?? []
        isDone = (garminByDate[String(s.date)] ?? []).some(t => garminTypes.includes(t))
      }
      if (isDone) weekMap[wk].done++
    }
    const weeks4 = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-4)
      .map(([week, { planned, done }]) => ({
        week,
        planned,
        done,
        pct: planned > 0 ? Math.round(done / planned * 100) : null,
      }))

    const thisWeekKey = weekStartOf(today)
    const thisWeek = weeks4.find(w => w.week === thisWeekKey) ?? { planned: 0, done: 0, pct: null }

    // Garmin-Athleten: echte Aktivitäten diese Woche (aus garminByDate ableiten)
    const garminActsThisWeek = dataSource !== 'tp'
      ? Object.entries(garminByDate).filter(([d]) => d >= thisWeekKey && d <= today).reduce((n, [, types]) => n + types.length, 0)
      : null

    // Phase health: avg compliance over all 4 weeks
    const pctsWithData = weeks4.map(w => w.pct).filter((v): v is number => v !== null)
    const avgCompliance = pctsWithData.length
      ? Math.round(pctsWithData.reduce((a, b) => a + b, 0) / pctsWithData.length)
      : null
    const phaseHealth: 'good' | 'ok' | 'behind' | null =
      avgCompliance === null ? null :
      avgCompliance >= 80 ? 'good' :
      avgCompliance >= 60 ? 'ok' : 'behind'

    // TP-specific: last TSS
    let lastTss: number | null = null
    if (dataSource === 'tp') {
      const { data: tpAct } = await supabaseAdmin
        .from('tp_activities').select('tss_actual').eq('person_id', pid)
        .eq('status', 'completed').order('workout_day', { ascending: false }).limit(1).maybeSingle()
      lastTss = tpAct?.tss_actual as number | null
    }

    const GARMIN_STATUS_LABEL: Record<number, string> = {
      0: 'Unbekannt', 1: 'Überbelastet', 2: 'Deload', 3: 'Unproduktiv',
      4: 'Aktiv', 5: 'Produktiv', 6: 'Peak', 7: 'Erhaltend', 8: 'Recovery',
    }
    const ACWR_LABEL: Record<string, string> = {
      OPTIMAL: 'Optimal', LOW: 'Zu wenig', HIGH: 'Zu viel',
    }
    const acwrStatus = training?.acwr_status as string | null
    const trainingStatusNum = training?.training_status as number | null

    return {
      id: pid,
      name: p.display_name as string,
      dataSource,
      planWeek,
      currentPhase: currentPhase ? { name: currentPhase.name, goal: currentPhase.goal } : null,
      thisWeek,
      weeks4,
      avgCompliance,
      phaseHealth,
      garminActsThisWeek,
      lastCtl: training?.ctl ? Math.round(training.ctl as number) : null,
      lastAtl: training?.atl ? Math.round(training.atl as number) : null,
      lastAcwr: training?.acwr ? Number((training.acwr as number).toFixed(2)) : null,
      acwrStatus,
      acwrLabel: acwrStatus ? (ACWR_LABEL[acwrStatus] ?? acwrStatus) : null,
      trainingStatusLabel: trainingStatusNum !== null ? (GARMIN_STATUS_LABEL[trainingStatusNum] ?? null) : null,
      lastTss: lastTss ? Math.round(lastTss) : null,
      lastActivity: lastAct
        ? { date: String(lastAct.date), type: String(lastAct.type), name: lastAct.name as string | null }
        : null,
    }
  }))

  return NextResponse.json({ athletes })
}
