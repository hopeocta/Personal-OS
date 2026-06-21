import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function berlinToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}

// POST /api/p/[personId]/sick  { active: boolean }
// active=true  → sick_since = heute (3-Tage-Ramp startet)
// active=false → sick_since = null (wieder normal)
export async function POST(req: NextRequest, { params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params
  const { active } = await req.json().catch(() => ({}))

  const sick_since = active ? berlinToday() : null
  const { error } = await supabaseAdmin
    .from('persons')
    .update({ sick_since })
    .eq('id', personId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, sick_since })
}
