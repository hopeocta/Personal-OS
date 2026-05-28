import { TopRail } from '@/components/dashboard/TopRail'
import { CalendarView } from '@/components/dashboard/CalendarView'

export default function KalenderPage() {
  return (
    <>
      <TopRail />
      <main style={{ padding: '1rem 1.5rem', maxWidth: '720px', margin: '0 auto' }}>
        <CalendarView />
      </main>
    </>
  )
}
