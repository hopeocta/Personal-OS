import { TopRail } from '@/components/dashboard/TopRail'
import { Shell } from '@/components/dashboard/Shell'
import { SleepCard } from '@/components/dashboard/SleepCard'
import { TasksCard } from '@/components/dashboard/TasksCard'
import { NutritionCard } from '@/components/dashboard/NutritionCard'
import { TrainingCard } from '@/components/dashboard/TrainingCard'
import { StrengthLogger } from '@/components/dashboard/StrengthLogger'
import { QuickCapture } from '@/components/dashboard/QuickCapture'
import { MusikSnapshot } from '@/components/dashboard/MusikSnapshot'
import { CalendarCard } from '@/components/dashboard/CalendarCard'
import { BriefingCard } from '@/components/dashboard/BriefingCard'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { localDateKey } from '@/lib/dateUtils'
import { buildMorningBriefing } from '@/lib/briefing'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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

  const [{ data: sleepData }, { data: batteryData }, { data: musikProjects }, briefing] =
    await Promise.all([
    supabaseAdmin
      .from('garmin_sleep')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('garmin_body_battery')
      .select('*')
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
  ])

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
            <StrengthLogger today={today} />
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
