import { TopRail } from '@/components/dashboard/TopRail'
import { Shell } from '@/components/dashboard/Shell'
import { StrengthLogger } from '@/components/dashboard/StrengthLogger'
import { TrainingWeekLive } from '@/components/dashboard/TrainingWeekLive'
import { TrainingNext7 } from '@/components/dashboard/TrainingNext7'
import { TriathlonHistory } from '@/components/dashboard/TriathlonHistory'
import { CalendarCard } from '@/components/dashboard/CalendarCard'
import { localDateKey } from '@/lib/dateUtils'

export default function TrainingPage() {
  const today = localDateKey()

  return (
    <>
      <TopRail />
      <div style={{ maxWidth: '720px', margin: '1.5rem auto 0', padding: '0 1.5rem' }}>
        <TrainingWeekLive />
      </div>
      <Shell
        left={<StrengthLogger today={today} />}
        center={<TrainingNext7 />}
        right={
          <>
            <CalendarCard />
            <TriathlonHistory />
          </>
        }
      />
    </>
  )
}
