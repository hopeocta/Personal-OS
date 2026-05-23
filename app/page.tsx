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

const DAY_NAMES = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'] as const

export default function Home() {
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

  return (
    <>
      <TopRail />
      <Shell
        left={
          <>
            <SleepCard
              sleepScore={78}
              hrv={52}
              totalSleepMin={432}
              deepSleepMin={78}
              bodyBattery={72}
            />
            <HabitsCard
              date={today}
              habits={[
                { name: 'Wasser 2.5L', completed: true },
                { name: 'Protein Ziel', completed: true },
                { name: 'Kein Alkohol', completed: true },
                { name: 'Schlafen 22:30', completed: false },
                { name: 'Meditation', completed: false },
                { name: 'Kein Social Media vor 9', completed: true },
              ]}
            />
            <NutritionCard
              calories={1840}
              targetCalories={2500}
              proteinG={95}
              carbsG={180}
              fatG={55}
              targetProtein={160}
              targetCarbs={280}
              targetFat={80}
            />
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
            <StrengthLogger
              today={today}
              recentSessions={[
                { date: '22.05', sessionType: 'Oberkörper', intensity: 3 },
                { date: '20.05', sessionType: 'Ganzkörper', intensity: 2 },
                { date: '18.05', sessionType: 'Unterkörper', intensity: 3 },
              ]}
            />
          </>
        }
        right={
          <>
            <CalendarCard />
            <QuickCapture />
            <MusikSnapshot
              projects={[
                { id: '1', title: 'Dark Summer', bpm: 140, musicalKey: 'A minor', genre: 'Drill', status: 'wip' },
                { id: '2', title: 'Drill 140', bpm: 140, musicalKey: 'F# minor', genre: null, status: 'mixing' },
                { id: '3', title: 'Chill Beat', bpm: 90, musicalKey: null, genre: 'Lofi', status: 'idea' },
              ]}
            />
          </>
        }
      />
    </>
  )
}
