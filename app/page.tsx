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

const DAY_NAMES = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'] as const

export default async function Home() {
  const today = localDateKey()

  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7 // 0=Monday … 6=Sunday

  const week = DAY_NAMES.map((short, i) => ({
    short,
    isToday: i === dayOfWeek,
    status: (
      i < dayOfWeek ? 'done' : i === dayOfWeek ? 'today' : 'future'
    ) as 'done' | 'today' | 'future',
  }))

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
            <TrainingCard
              week={week}
              plan={[
                { title: '🏊 Schwimmen 2km', detail: 'Kalender', status: 'pending' },
                { title: '🚴 Radfahren 45min', detail: 'Garmin — 42.3 km, Ø 148 bpm', status: 'done' },
                { title: 'Krafttraining', detail: 'Geplant für morgen', status: 'later' },
              ]}
              summary={{ swimKm: 3.2, bikeKm: 127, runKm: 18.4, totalHours: 8.67 }}
            />
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
