import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ── Typen ──────────────────────────────────────────────────────────────────────

type ExpenseTx = {
  date: string
  description: string
  merchant: string | null
  amount_eur: number
  category: string | null
  currency: string
  month: string | null
}

type RecurringItem = {
  label: string
  category: string
  monthlyAvg: number
  months: number
}

// Kategorien, die immer zur monatlichen Grundlast zählen (Grundlagen: Einkäufe + Essen)
const GRUNDLAST_KATEGORIEN = new Set(['Lebensmittel', 'Restaurants & Cafés'])
// Kombinierter „Einkäufe & Essen"-Slot
const FOOD_KATEGORIEN = new Set(['Lebensmittel', 'Restaurants & Cafés'])

/** Händler-Schlüssel zum Gruppieren: Zahlen + Sonderzeichen raus, klein, getrimmt. */
function merchantKey(tx: ExpenseTx): string {
  const base = (tx.merchant || tx.description || '').toLowerCase()
  return base
    .replace(/[0-9]/g, '')
    .replace(/[^a-zäöüß& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function monthOf(tx: ExpenseTx): string {
  return tx.month || tx.date.slice(0, 7)
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((v) => (v - m) ** 2)))
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const months = parseInt(req.nextUrl.searchParams.get('months') ?? '6', 10)

  // Fenster (für Balken + Kategorien-Anzeige)
  const now = new Date()
  const fromDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
  const fromMonth = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`

  // ALLE Ausgaben laden (amount < 0) — Fix-Erkennung braucht die volle Historie.
  const { data: txData, error } = await supabaseAdmin
    .from('revolut_transactions')
    .select('date, description, merchant, amount_eur, category, currency, month')
    .lt('amount_eur', 0)
    .order('date', { ascending: false })

  if (error) {
    console.error('[finanzen/summary] transactions error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const allTx = (txData ?? []) as ExpenseTx[]

  // ── Fix-Erkennung (über die ganze Historie) ──────────────────────────────────
  // Ein Händler ist „fix", wenn er in ≥ Schwelle verschiedenen Monaten auftaucht
  // UND die Beträge ähnlich sind (niedrige relative Streuung → Abo/Miete, nicht variabel).
  const allMonths = new Set(allTx.map(monthOf))
  const monthsInData = allMonths.size
  const recurringThreshold = monthsInData >= 4 ? 3 : 2

  const groups = new Map<string, ExpenseTx[]>()
  for (const tx of allTx) {
    const key = merchantKey(tx)
    if (!key) continue
    const arr = groups.get(key) ?? []
    arr.push(tx)
    groups.set(key, arr)
  }

  const recurringKeys = new Set<string>()
  const recurring: RecurringItem[] = []
  for (const [key, txs] of groups) {
    const distinctMonths = new Set(txs.map(monthOf))
    if (distinctMonths.size < recurringThreshold) continue
    const amounts = txs.map((t) => Math.abs(t.amount_eur))
    const m = mean(amounts)
    if (m <= 0) continue
    const relSpread = stddev(amounts) / m
    if (relSpread > 0.35) continue // zu variabel → kein Fixkosten-Charakter

    recurringKeys.add(key)
    // monatlicher Durchschnitt = Gesamtsumme / Anzahl belegter Monate
    const totalAbs = amounts.reduce((s, v) => s + v, 0)
    const label = txs[0].merchant || txs[0].description
    recurring.push({
      label,
      category: txs[0].category ?? '—',
      monthlyAvg: totalAbs / distinctMonths.size,
      months: distinctMonths.size,
    })
  }
  recurring.sort((a, b) => b.monthlyAvg - a.monthlyAvg)

  /** Grundlast = Lebensmittel/Restaurants ODER als fix erkannter Händler. */
  function isBaseline(tx: ExpenseTx): boolean {
    if (tx.category && GRUNDLAST_KATEGORIEN.has(tx.category)) return true
    return recurringKeys.has(merchantKey(tx))
  }

  // ── All-Time-Aggregate ───────────────────────────────────────────────────────
  let einmaligAllTimeTotal = 0
  for (const tx of allTx) {
    if (!isBaseline(tx)) einmaligAllTimeTotal += Math.abs(tx.amount_eur)
  }
  const einmaligAllTimeAvg = monthsInData > 0 ? einmaligAllTimeTotal / monthsInData : 0

  // ── Fenster-Aggregate (für Balken/Kategorien) ────────────────────────────────
  const windowTx = allTx.filter((tx) => monthOf(tx) >= fromMonth)
  const windowMonths = new Set(windowTx.map(monthOf))
  const windowMonthCount = windowMonths.size

  const monthTotals: Record<string, number> = {}
  const baselineByMonth: Record<string, number> = {}
  const einmaligByMonth: Record<string, number> = {}
  const categoryTotals: Record<string, number> = {}
  let baselineWindowTotal = 0
  let foodGroceriesTotal = 0

  for (const tx of windowTx) {
    const month = monthOf(tx)
    const abs = Math.abs(tx.amount_eur)
    monthTotals[month] = (monthTotals[month] ?? 0) + abs
    if (tx.category) categoryTotals[tx.category] = (categoryTotals[tx.category] ?? 0) + abs
    if (tx.category && FOOD_KATEGORIEN.has(tx.category)) foodGroceriesTotal += abs
    if (isBaseline(tx)) {
      baselineByMonth[month] = (baselineByMonth[month] ?? 0) + abs
      baselineWindowTotal += abs
    } else {
      einmaligByMonth[month] = (einmaligByMonth[month] ?? 0) + abs
    }
  }

  const baselineMonthlyAvg = windowMonthCount > 0 ? baselineWindowTotal / windowMonthCount : 0
  const foodGroceriesMonthlyAvg = windowMonthCount > 0 ? foodGroceriesTotal / windowMonthCount : 0

  // Letzte Transaktionen (unverändert)
  const recentTransactions = allTx.slice(0, 20).map((tx) => ({
    date: tx.date,
    description: tx.description,
    amount_eur: tx.amount_eur,
    category: tx.category,
    currency: tx.currency,
  }))

  return NextResponse.json({
    months,
    monthsInData,
    monthTotals,
    baselineByMonth,
    einmaligByMonth,
    categoryTotals,
    baselineMonthlyAvg,
    einmaligAllTimeAvg,
    foodGroceriesTotal,
    foodGroceriesMonthlyAvg,
    recurring,
    recentTransactions,
  })
}
