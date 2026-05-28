import { TopRail } from '@/components/dashboard/TopRail'
import { Shell } from '@/components/dashboard/Shell'
import { SleepCard } from '@/components/dashboard/SleepCard'
import { HabitsCard } from '@/components/dashboard/HabitsCard'
import { NutritionCard } from '@/components/dashboard/NutritionCard'
import { TrainingCard } from '@/components/dashboard/TrainingCard'
import { StrengthLogger } from '@/components/dashboard/StrengthLogger'
import { QuickCapture } from '@/components/dashboard/QuickCapture'
import { MusikSnapshot } from '@/components/dashboard/MusikSnapshot'
import { CalendarCard } from '@/components/dashboard/CalendarCard'
import { localDateKey } from '@/lib/dateUtils'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export default async function Home() {
  const today = localDateKey()

  const [{ data: sleepData }, { data: batteryData }, { data: musikProjects }] = await Promise.all([
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
  ])

  return (
    <>
      <TopRail />
      <Shell
        left={
          <>
            <SleepCard sleep={sleepData} bodyBattery={batteryData} />
            <HabitsCard date={today} />
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
