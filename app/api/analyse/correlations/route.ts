import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(): Promise<NextResponse> {
  const [corrRes, trendRes] = await Promise.all([
    supabaseAdmin
      .from('health_analysis_results')
      .select('results, period_start, period_end, computed_at')
      .eq('type', 'correlations')
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('health_analysis_results')
      .select('results, period_start, period_end, computed_at')
      .eq('type', 'trends')
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (corrRes.error) console.error('[correlations] corr error:', corrRes.error)
  if (trendRes.error) console.error('[correlations] trend error:', trendRes.error)

  return NextResponse.json({
    correlations: corrRes.data?.results ?? null,
    trends: trendRes.data?.results ?? null,
    period: corrRes.data
      ? { start: corrRes.data.period_start, end: corrRes.data.period_end, computed_at: corrRes.data.computed_at }
      : null,
  })
}
