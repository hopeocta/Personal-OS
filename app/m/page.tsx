import { localDateKey } from '@/lib/dateUtils'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { MCard } from '@/components/mobile/MCard'
import { MSleepRing } from '@/components/mobile/MSleepRing'
import { MLetztesTraining } from '@/components/mobile/MLetztesTraining'
import { MNextTraining } from '@/components/mobile/MNextTraining'
import { MTasks } from '@/components/mobile/MTasks'
import { MTraining } from '@/components/mobile/MTraining'
import { MTrainingTrend } from '@/components/mobile/MTrainingTrend'
import { MLiteratur } from '@/components/mobile/MLiteratur'
import { MWochenrueckblick } from '@/components/mobile/MWochenrueckblick'
import { MMarktSignals } from '@/components/mobile/MMarktSignals'
import type { GarminSleep, GarminBodyBattery, NutritionLog, KnowledgeEntry, LiteraturEntry, MarktSignal } from '@/lib/types'

export const dynamic = 'force-dynamic'

function berlinHour(): number {
  return parseInt(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false }).format(new Date()),
    10,
  )
}
function greeting(h: number): string {
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

export default async function MobileHeute() {
  const today = localDateKey()

  const [sleepRes, batteryRes, nutritionRes, knowledgeRes, literaturRes, signalsRes] = await Promise.all([
    supabaseAdmin.from('garmin_sleep').select('*').eq('user_id', 'me').not('sleep_score', 'is', null).order('date', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('garmin_body_battery').select('*').eq('user_id', 'me').not('morning_score', 'is', null).order('date', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('nutrition_logs').select('*').eq('date', today).maybeSingle(),
    supabaseAdmin
      .from('knowledge_entries')
      .select('id, summary, raw_text, category, source, created_at')
      .in('source', ['chat_session', 'telegram_note', 'terminal_capture', 'learn', 'zahnmedizin'])
      .order('created_at', { ascending: false })
      .limit(6),
    supabaseAdmin
      .from('literatur_entries')
      .select('id, kw, jahr, title, summary, sections_de, source_url, source_name, category, tags, created_at')
      .eq('user_id', 'me')
      .order('jahr', { ascending: false })
      .order('kw', { ascending: false })
      .limit(30),
    supabaseAdmin
      .from('market_investment_signals')
      .select('id, signal_id, date, ticker, company, tier, confidence, status, entry_price, delta_pct, thesis, main_risk, review_date')
      .not('status', 'eq', 'Closed')
      .order('date', { ascending: false })
      .limit(50),
  ])

  const sleep = (sleepRes.data ?? null) as GarminSleep | null
  const battery = (batteryRes.data ?? null) as GarminBodyBattery | null
  const nutrition = (nutritionRes.data ?? null) as NutritionLog | null
  const learned = ((knowledgeRes.data ?? []) as KnowledgeEntry[]).filter(
    (k) => new Date(k.created_at).getTime() > Date.now() - 2 * 86400000,
  )
  const allLiteratur = (literaturRes.data ?? []) as LiteraturEntry[]
  const signals = (signalsRes.data ?? []) as MarktSignal[]
  const latestKw = allLiteratur[0]?.kw ?? 0
  const latestJahr = allLiteratur[0]?.jahr ?? 0
  const literatur = allLiteratur.filter((e) => e.kw === latestKw && e.jahr === latestJahr)

  const dateLabel = new Date(today + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '1.5rem', color: 'var(--ink-0)' }}>
          {greeting(berlinHour())}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.66rem',
            letterSpacing: '0.1em',
            color: 'var(--ink-3)',
            marginTop: 3,
            textTransform: 'uppercase',
          }}
        >
          {dateLabel}
        </div>
      </div>

      <MSleepRing sleep={sleep} bodyBattery={battery} />
      <MLetztesTraining />
      <MNextTraining />

      <MCard label="Rückblick">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 4 }}>
          GELERNT
        </div>
        {learned.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)', marginBottom: 12 }}>—</div>
        ) : (
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {learned.slice(0, 3).map((k) => (
              <div key={k.id} style={{ fontSize: '0.78rem', color: 'var(--ink-2)', lineHeight: 1.45 }}>
                · {k.summary ?? k.raw_text.slice(0, 80)}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 4 }}>
          GEGESSEN
        </div>
        {nutrition && (nutrition.calories || nutrition.notes) ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-2)', lineHeight: 1.45 }}>
            {nutrition.calories ? `~${nutrition.calories} kcal` : ''}
            {nutrition.calories && nutrition.notes ? ' · ' : ''}
            {nutrition.notes ? nutrition.notes.slice(0, 90) : ''}
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>—</div>
        )}
      </MCard>

      <MWochenrueckblick />
      <MMarktSignals signals={signals} />
      <MTraining />
      <MTrainingTrend />
      <MTasks />
      <MLiteratur articles={literatur} kw={latestKw} year={latestJahr} />
    </div>
  )
}
