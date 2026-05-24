import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST() {
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: rows, error } = await supabaseAdmin
    .from('nutrition_logs')
    .select('calories, protein_g, carbs_g, fat_g')
    .gte('date', sinceStr)

  if (error) console.error('[einkauf] nutrition fetch error:', error)

  const validRows = (rows ?? []).filter(
    (r) => r.calories != null || r.protein_g != null
  )

  const avgKcal =
    validRows.length > 0
      ? Math.round(validRows.reduce((a, r) => a + (r.calories ?? 0), 0) / validRows.length)
      : null
  const avgProtein =
    validRows.length > 0
      ? Math.round(validRows.reduce((a, r) => a + (r.protein_g ?? 0), 0) / validRows.length)
      : null

  const nutritionContext =
    avgKcal != null
      ? `Aktuelle Durchschnittsernährung (letzte Woche, ${validRows.length} geloggte Tage): ${avgKcal} kcal/Tag, ${avgProtein}g Protein/Tag`
      : 'Keine Ernährungsdaten für letzte Woche vorhanden.'

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `${nutritionContext}

Meine Ziele: 2500 kcal/Tag, 160g Protein/Tag, clean eating, einfache Zubereitung.

Erstelle eine praktische Wocheneinkaufsliste die mir hilft meine Protein- und Kalorienziele zu erreichen. Formatiere als Markdown-Liste mit diesen Kategorien: **Protein-Quellen**, **Kohlenhydrate**, **Gemüse & Obst**, **Sonstiges**. Mengenangaben für eine Woche. Halte es kurz und praktisch.`,
      },
    ],
  })

  const textBlock = msg.content.find((c) => c.type === 'text')
  const list = textBlock?.type === 'text' ? textBlock.text : 'Fehler beim Generieren der Liste.'

  return NextResponse.json({ list, avgKcal, avgProtein })
}
