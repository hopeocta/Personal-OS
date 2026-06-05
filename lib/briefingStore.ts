import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { writeObsidianFile } from '@/lib/obsidian'

export async function saveMorningBriefing(dateKey: string, markdown: string): Promise<void> {
  const summary = `Morgen-Briefing ${dateKey}`

  const { data: existing } = await supabaseAdmin
    .from('knowledge_entries')
    .select('id')
    .eq('source', 'morning_briefing')
    .contains('tags', ['briefing', dateKey])
    .maybeSingle()

  if (existing?.id) {
    await supabaseAdmin
      .from('knowledge_entries')
      .update({ raw_text: markdown, summary })
      .eq('id', existing.id)
  } else {
    await supabaseAdmin.from('knowledge_entries').insert({
      raw_text: markdown,
      category: 'Allgemein',
      summary,
      tags: ['briefing', 'morning', dateKey],
      source: 'morning_briefing',
      user_id: 'me',
    })
  }

  // Kein eigener Vault-Write mehr: der lokale logbuch-sync.mjs bettet das Briefing
  // oben in die Tagesdatei (Logbuch/JJJJ/MM/...) ein. Supabase ist die Quelle dafür.
}

export async function saveWeeklyTraining(weekKey: string, markdown: string): Promise<void> {
  const summary = `Training Woche ${weekKey}`

  const { data: existing } = await supabaseAdmin
    .from('knowledge_entries')
    .select('id')
    .eq('source', 'weekly_training')
    .contains('tags', ['training', weekKey])
    .maybeSingle()

  if (existing?.id) {
    await supabaseAdmin
      .from('knowledge_entries')
      .update({ raw_text: markdown, summary })
      .eq('id', existing.id)
  } else {
    await supabaseAdmin.from('knowledge_entries').insert({
      raw_text: markdown,
      category: 'Triathlon',
      summary,
      tags: ['training', 'weekly', weekKey],
      source: 'weekly_training',
      user_id: 'me',
    })
  }

  const obsidianBody = `---\nweek: ${weekKey}\ntype: weekly_training\n---\n\n${markdown}`
  void writeObsidianFile(`Logbuch/Wochen/${weekKey}-training.md`, obsidianBody)
}
