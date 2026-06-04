import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const months = parseInt(req.nextUrl.searchParams.get('months') ?? '6', 10)

  // Zeitraum berechnen
  const now = new Date()
  const fromDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
  const fromMonth = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`

  const [summariesRes, recentRes] = await Promise.all([
    supabaseAdmin
      .from('expense_summaries')
      .select('month, category, total_eur, transaction_count')
      .gte('month', fromMonth)
      .order('month', { ascending: true }),
    supabaseAdmin
      .from('revolut_transactions')
      .select('date, description, amount_eur, category, currency')
      .lt('amount_eur', 0)
      .order('date', { ascending: false })
      .limit(20),
  ])

  if (summariesRes.error) {
    console.error('[finanzen/summary] summaries error:', summariesRes.error)
    return NextResponse.json({ error: summariesRes.error.message }, { status: 500 })
  }
  if (recentRes.error) {
    console.error('[finanzen/summary] recent error:', recentRes.error)
    return NextResponse.json({ error: recentRes.error.message }, { status: 500 })
  }

  // Monatliche Gesamtausgaben berechnen
  const monthTotals: Record<string, number> = {}
  for (const row of summariesRes.data ?? []) {
    monthTotals[row.month] = (monthTotals[row.month] ?? 0) + row.total_eur
  }

  // Kategorien über alle Monate aggregieren
  const categoryTotals: Record<string, number> = {}
  for (const row of summariesRes.data ?? []) {
    categoryTotals[row.category] = (categoryTotals[row.category] ?? 0) + row.total_eur
  }

  return NextResponse.json({
    summaries: summariesRes.data ?? [],
    monthTotals,
    categoryTotals,
    recentTransactions: recentRes.data ?? [],
  })
}
