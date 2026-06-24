import { TopRail } from '@/components/dashboard/TopRail'
import { Shell } from '@/components/dashboard/Shell'
import { SleepCard } from '@/components/dashboard/SleepCard'
import { TasksCard } from '@/components/dashboard/TasksCard'
import { NutritionCard } from '@/components/dashboard/NutritionCard'
import { TrainingCard } from '@/components/dashboard/TrainingCard'
import { AthletenUbersicht } from '@/components/dashboard/AthletenUbersicht'
import { QuickCapture } from '@/components/dashboard/QuickCapture'
import { MusikSnapshot } from '@/components/dashboard/MusikSnapshot'
import { CalendarCard } from '@/components/dashboard/CalendarCard'
import { BriefingCard } from '@/components/dashboard/BriefingCard'
import { LiteraturCard } from '@/components/dashboard/LiteraturCard'
import { MarktSignalsCard } from '@/components/dashboard/MarktSignalsCard'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { localDateKey } from '@/lib/dateUtils'
import { buildMorningBriefing } from '@/lib/briefing'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { LiteraturEntry, MarktSignal } from '@/lib/types'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ desktop?: string }>
}) {
  // Handys auf die Mobile-App leiten (außer mit ?desktop=1 bewusst umgangen).
  const { desktop } = await searchParams
  if (!desktop) {
    const ua = (await headers()).get('user-agent') ?? ''
    if (/iPhone|Android.*Mobile|Windows Phone|iPod/i.test(ua)) redirect('/m')
  }

  const today = localDateKey()

  const [{ data: sleepData }, { data: batteryData }, { data: musikProjects }, briefing, { data: literaturData }, { data: signalsData }] =
    await Promise.all([
    supabaseAdmin
      .from('garmin_sleep')
      .select('*')
      .eq('user_id', 'me')
      .not('sleep_score', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('garmin_body_battery')
      .select('*')
      .eq('user_id', 'me')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('music_projects')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(3),
    buildMorningBriefing(today).catch((err) => {
      console.error('[home] briefing error:', err)
      return null
    }),
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

  const allLiteratur = (literaturData ?? []) as LiteraturEntry[]
  const signals = (signalsData ?? []) as MarktSignal[]
  const latestKw = allLiteratur[0]?.kw ?? 0
  const latestJahr = allLiteratur[0]?.jahr ?? 0
  const literatur = allLiteratur.filter((e) => e.kw === latestKw && e.jahr === latestJahr)

  return (
    <>
      <TopRail />
      <Shell
        left={
          <>
            {briefing ? (
              <BriefingCard markdown={briefing.markdown} dateKey={briefing.dateKey} />
            ) : null}
            <SleepCard sleep={sleepData} bodyBattery={batteryData} />
            <TasksCard />
            <NutritionCard date={today} />
          </>
        }
        center={
          <>
            <TrainingCard />
            <AthletenUbersicht />
            <MarktSignalsCard signals={signals} />
            <LiteraturCard articles={literatur} kw={latestKw} year={latestJahr} />
          </>
        }
        right={
          <>
            <CalendarCard />
            <QuickCapture />
            <MusikSnapshot projects={musikProjects ?? []} />
          </>
        }
      />
    </>
  )
}
