import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function GET() {
  const [latestAct, latestSleep, latestBB, countAct, countSleep, countBB] = await Promise.all([
    supabaseAdmin
      .from('garmin_activities')
      .select('date, created_at')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('garmin_sleep')
      .select('date, created_at')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('garmin_body_battery')
      .select('date, created_at')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from('garmin_activities').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('garmin_sleep').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('garmin_body_battery').select('*', { count: 'exact', head: true }),
  ])

  return NextResponse.json({
    activities: {
      latest_date: latestAct.data?.date ?? null,
      last_synced: latestAct.data?.created_at ?? null,
      count: countAct.count ?? 0,
    },
    sleep: {
      latest_date: latestSleep.data?.date ?? null,
      last_synced: latestSleep.data?.created_at ?? null,
      count: countSleep.count ?? 0,
    },
    body_battery: {
      latest_date: latestBB.data?.date ?? null,
      last_synced: latestBB.data?.created_at ?? null,
      count: countBB.count ?? 0,
    },
  })
}
