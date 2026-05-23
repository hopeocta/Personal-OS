import { TopRail } from '@/components/dashboard/TopRail'
import { Shell } from '@/components/dashboard/Shell'
import { StrengthLogger } from '@/components/dashboard/StrengthLogger'
import { TrainingWeekLive } from '@/components/dashboard/TrainingWeekLive'
import { TriathlonHistory } from '@/components/dashboard/TriathlonHistory'
import { localDateKey } from '@/lib/dateUtils'

export default function TrainingPage() {
  const today = localDateKey()

  return (
    <>
      <TopRail />
      <Shell
        left={<StrengthLogger today={today} />}
        center={<TrainingWeekLive />}
        right={<TriathlonHistory />}
      />
    </>
  )
}
