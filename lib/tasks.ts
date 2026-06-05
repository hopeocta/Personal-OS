import 'server-only'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { berlinDateKey } from '@/lib/berlinDate'
import type { RecurringTask, RecurringTaskStatus } from '@/lib/types'

/** Tage zwischen zwei YYYY-MM-DD-Keys (b - a), rein datumsbasiert. */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}

/** Berechnet Fälligkeit einer Aufgabe relativ zu heute (Berlin-Datum). */
export function taskStatus(task: RecurringTask, todayKey = berlinDateKey()): RecurringTaskStatus {
  if (!task.last_done) {
    return { ...task, due: true, days_until: 0 }
  }
  const elapsed = daysBetween(task.last_done, todayKey)
  const remaining = task.interval_days - elapsed
  return { ...task, due: remaining <= 0, days_until: Math.max(0, remaining) }
}

/** Alle aktiven Aufgaben mit Fälligkeits-Status, sortiert (fällig zuerst, dann sort_order). */
export async function listTasksWithStatus(todayKey = berlinDateKey()): Promise<RecurringTaskStatus[]> {
  const { data, error } = await supabaseAdmin
    .from('recurring_tasks')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)

  return (data as RecurringTask[])
    .map((t) => taskStatus(t, todayKey))
    .sort((a, b) => {
      if (a.due !== b.due) return a.due ? -1 : 1
      if (a.days_until !== b.days_until) return a.days_until - b.days_until
      return a.sort_order - b.sort_order
    })
}

/** Nur die heute fälligen Aufgaben (für das Briefing). */
export async function dueTasks(todayKey = berlinDateKey()): Promise<RecurringTaskStatus[]> {
  return (await listTasksWithStatus(todayKey)).filter((t) => t.due)
}

/** Markiert eine Aufgabe als erledigt (last_done = heute) bzw. macht das rückgängig (last_done = null). */
export async function setTaskDone(id: string, done: boolean, todayKey = berlinDateKey()): Promise<RecurringTask> {
  const { data, error } = await supabaseAdmin
    .from('recurring_tasks')
    .update({ last_done: done ? todayKey : null })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as RecurringTask
}
