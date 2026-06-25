import { TopRail } from '@/components/dashboard/TopRail'
import { Shell } from '@/components/dashboard/Shell'
import { StrengthLogger } from '@/components/dashboard/StrengthLogger'
import { TrainingWeekLive } from '@/components/dashboard/TrainingWeekLive'
import { TrainingNext7 } from '@/components/dashboard/TrainingNext7'
import { TriathlonHistory } from '@/components/dashboard/TriathlonHistory'
import { CalendarRail } from '@/components/dashboard/CalendarRail'
import { localDateKey } from '@/lib/dateUtils'

export default function TrainingPage() {
  const today = localDateKey()

  return (
    <>
      <TopRail />
      <CalendarRail />
      <Shell
        left={<StrengthLogger today={today} />}
        center={
          <>
            <TrainingNext7 />
            <TrainingWeekLive />
          </>
        }
        right={<TriathlonHistory />}
      />
    </>
  )
}
