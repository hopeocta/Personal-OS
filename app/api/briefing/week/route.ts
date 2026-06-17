import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const maxDuration = 30

const anthropic = new Anthropic()

function berlinDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
}

export async function GET() {
  try {
    const from = berlinDate(-7)
    const today = berlinDate(0)
    const future = berlinDate(7)

    const [notesRes, activitiesRes, nutritionRes, planRes] = await Promise.all([
      supabaseAdmin
        .from('knowledge_entries')
        .select('summary, category, created_at')
        .in('source', ['telegram_note', 'mobile_capture'])
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('garmin_activities')
        .select('activity_type, duration_seconds, distance_meters, date')
        .gte('date', from)
        .lte('date', today)
        .order('date', { ascending: false }),
      supabaseAdmin
        .from('nutrition_logs')
        .select('date, calories, notes')
        .gte('date', from)
        .lte('date', today)
        .not('calories', 'is', null),
      supabaseAdmin
        .from('training_plan_sessions')
        .select('date, sport, description, duration_min')
        .gt('date', today)
        .lte('date', future)
        .order('date', { ascending: true })
        .limit(10),
    ])

    const notes = (notesRes.data ?? [])
      .map((n) => `- ${n.category}: ${n.summary}`)
      .join('\n') || '—'

    const activities = (activitiesRes.data ?? [])
      .map((a) => {
        const km = a.distance_meters ? ` ${(a.distance_meters / 1000).toFixed(1)} km` : ''
        const min = a.duration_seconds ? ` ${Math.round(a.duration_seconds / 60)} min` : ''
        return `- ${a.date} ${a.activity_type}${km}${min}`
      })
      .join('\n') || '—'

    const nutrition = (nutritionRes.data ?? [])
      .map((n) => `- ${n.date}: ${n.calories} kcal${n.notes ? ` (${String(n.notes).slice(0, 40)})` : ''}`)
      .join('\n') || '—'

    const plan = (planRes.data ?? [])
      .map((p) => `- ${p.date} ${p.sport}${p.description ? ` (${String(p.description).slice(0, 40)})` : ''}`)
      .join('\n') || '—'

    const userPrompt = `Letzte 7 Tage — Notizen:\n${notes}\n\nTraining:\n${activities}\n\nErnährung:\n${nutrition}\n\nNächste 7 Tage — geplante Einheiten:\n${plan}`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `Du bist ein persönlicher Assistent. Fasse die letzte Woche in 3-4 kurzen deutschen Sätzen zusammen (was war, was wurde trainiert, was ist aufgefallen). Dann 1-2 Sätze Ausblick auf die nächste Woche. Kein Aufzählung, fließender Text. Kein Intro wie "Diese Woche..." — direkt loslegen.`,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const summary = msg.content[0].type === 'text' ? msg.content[0].text : ''
    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[briefing/week] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
