import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { embedText } from '@/lib/embeddings'
import {
  queryMetric,
  METRIC_NAMES,
  AGGREGATES,
  ACTIVITY_TYPES,
  type MetricQuery,
} from '@/lib/metrics'

const anthropic = new Anthropic()

const MODEL = 'claude-sonnet-4-6'
const MAX_ROUNDS = 4 // Kosten-/Latenz-Deckel; 4 erlaubt search → fetch_document → Antwort
const MAX_TOKENS = 1024

export type AnswerResult = {
  text: string
  rounds: number
}

// ── Tool-Definitionen (statisch → cachebar) ───────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: 'search_knowledge',
    description:
      'Durchsucht die gesamte persönliche Wissensbasis semantisch per Vektor-Suche: Notizen, Recherche, Lernstoff, Telegram-Notizen UND alle hochgeladenen Dokumente (Gesundheits-/Laborbefunde, Leistungsdiagnostik, Verwaltungs-/Amtsdokumente — jeweils mit Titel, Zusammenfassung und ausgelesenen Werten als Text). Nutze dies für inhaltliche Fragen zu JEDEM Dokument ("Was stand in meinem Befund?", "Was war bei der Leistungsdiagnostik?", "Wann läuft meine Versicherung?", "Was hat der Arzt empfohlen?"). Für präzise Zahlen-Verläufe über die Zeit zusätzlich query_metrics.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Die Suchanfrage auf Deutsch, semantisch formuliert.',
        },
        category: {
          type: 'string',
          description:
            'Optionaler Kategorie-Filter, z.B. "Zahnmedizin", "Triathlon", "Musikproduktion". Weglassen für Suche über alles.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'query_metrics',
    description:
      'Fragt numerische Gesundheits-/Trainings-/Ernährungsdaten aus der Datenbank ab (Garmin Schlaf, Aktivitäten, HRV, Stress, Training Load, Laborwerte, Ernährung, Krafttraining). Nutze dies für ALLE Zahlen-Fragen ("Wie war mein Schlaf?", "Wie viel bin ich gelaufen?", "Wie ist mein VO2max?"). Gib immer einen Datumsbereich an. Das heutige Datum steht im System-Prompt.',
    input_schema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: METRIC_NAMES,
          description: 'Welche Messgröße abgefragt wird.',
        },
        from_date: { type: 'string', description: 'Startdatum YYYY-MM-DD (inklusive).' },
        to_date: { type: 'string', description: 'Enddatum YYYY-MM-DD (inklusive).' },
        aggregate: {
          type: 'string',
          enum: AGGREGATES,
          description:
            'sum=Summe, avg=Durchschnitt, min/max, count=Anzahl Tage, latest=neuester Wert, list=Einzelwerte pro Tag.',
        },
        activity_type: {
          type: 'string',
          enum: ACTIVITY_TYPES,
          description: 'Nur bei activity_*-Metriken: Sportart-Filter (z.B. running, swimming).',
        },
        test_name: {
          type: 'string',
          description: 'Nur bei metric=lab_value: Teil des Laborwert-Namens (Teilstring-Suche, z.B. "Ferritin", "Leistung", "Laktat", "Herzfrequenz"). Laborwerte/Leistungsdiagnostik liegen oft Monate zurück — wähle bei lab_value einen WEITEN Datumsbereich (z.B. das ganze letzte Jahr), wenn der Nutzer keinen Zeitpunkt nennt.',
        },
      },
      required: ['metric', 'from_date', 'to_date', 'aggregate'],
    },
  },
  {
    name: 'fetch_document',
    description:
      'Lädt den VOLLSTÄNDIGEN Text eines einzelnen Wissens-Eintrags anhand seiner id (aus einem search_knowledge-Treffer). Nutze dies, wenn der Snippet aus search_knowledge nicht ausreicht — z.B. bei "fasse das ganze Dokument zusammen", bei langen Befunden/Verträgen/Plänen oder wenn das gesuchte Detail im gekürzten Auszug fehlt ("gekuerzt": true). Für kurze Punktfragen reicht der Snippet — dann NICHT nachladen (spart Tokens).',
    input_schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Die id eines Treffers aus search_knowledge.',
        },
      },
      required: ['id'],
    },
  },
]

// ── Tool-Ausführung ───────────────────────────────────────────────────────────
async function runSearchKnowledge(input: {
  query: string
  category?: string
}): Promise<string> {
  const embedding = await embedText(input.query)
  const { data, error } = await supabaseAdmin.rpc('match_knowledge', {
    query_embedding: embedding,
    match_count: 8,
    filter_category: input.category ?? null,
  })
  if (error) {
    console.error('[answer] match_knowledge error:', error)
    return JSON.stringify({ error: error.message })
  }
  type Hit = {
    id: string
    summary: string | null
    raw_text: string
    category: string | null
    created_at: string
    similarity: number
  }
  const hits = ((data ?? []) as Hit[]).map((h) => ({
    id: h.id,
    kategorie: h.category ?? 'unbekannt',
    datum: h.created_at?.slice(0, 10) ?? '',
    relevanz: Math.round(h.similarity * 100) / 100,
    // Snippet (gekappt) hält den Tool-Result kompakt. Reicht der Auszug nicht,
    // lädt Claude den Volltext gezielt über fetch_document(id) nach.
    text: (h.summary ? h.summary + '\n' : '') + h.raw_text.slice(0, 1500),
    gekuerzt: h.raw_text.length > 1500,
  }))
  return JSON.stringify({ treffer: hits })
}

async function runQueryMetrics(input: Record<string, unknown>): Promise<string> {
  try {
    const result = await queryMetric(input as unknown as MetricQuery)
    return JSON.stringify(result)
  } catch (err) {
    console.error('[answer] query_metrics error:', err)
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
  }
}

async function runFetchDocument(input: { id: string }): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .select('summary, raw_text, category, created_at')
    .eq('id', input.id)
    .maybeSingle()
  if (error) {
    console.error('[answer] fetch_document error:', error)
    return JSON.stringify({ error: error.message })
  }
  if (!data) {
    return JSON.stringify({ error: `Kein Eintrag mit id ${input.id} gefunden.` })
  }
  return JSON.stringify({
    kategorie: data.category ?? 'unbekannt',
    datum: data.created_at?.slice(0, 10) ?? '',
    zusammenfassung: data.summary ?? '',
    volltext: data.raw_text,
  })
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === 'search_knowledge') {
    return runSearchKnowledge(input as { query: string; category?: string })
  }
  if (name === 'query_metrics') {
    return runQueryMetrics(input)
  }
  if (name === 'fetch_document') {
    return runFetchDocument(input as { id: string })
  }
  return JSON.stringify({ error: `Unbekanntes Tool: ${name}` })
}

// ── Haupt-Funktion ────────────────────────────────────────────────────────────
export type AnswerOptions = {
  /** Optional: RAG-Suche bevorzugt in dieser knowledge_entries-Kategorie. */
  searchCategory?: string
}

export async function answerQuestion(
  question: string,
  options: AnswerOptions = {},
): Promise<AnswerResult> {
  // Heutiges Datum in Berlin-Zeit → Claude löst "diesen Monat" etc. selbst auf.
  const todayBerlin = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const categoryHint = options.searchCategory
    ? `\nBevorzugte Kategorie für search_knowledge: "${options.searchCategory}" (wenn passend).`
    : ''

  const system = `Du bist der persönliche Assistent eines Zahnmedizin-Studenten und Triathleten.
Heutiges Datum (Europe/Berlin): ${todayBerlin}.${categoryHint}

Beantworte seine Frage auf Deutsch, knapp und konkret. Nutze die Tools:
- search_knowledge für inhaltliche/Text-Fragen (Notizen, Recherche, Lernstoff, Arzt-Empfehlungen). Liefert Snippets mit id.
- fetch_document(id) für den VOLLTEXT eines Treffers, wenn der Snippet nicht reicht (Zusammenfassung ganzer Dokumente, lange Befunde/Verträge, "gekuerzt": true, oder gesuchtes Detail fehlt im Auszug).
- query_metrics für Zahlen (Schlaf, Training, HRV, Stress, VO2max, Ernährung, Laborwerte).
Für gemischte Fragen mehrere Tools nutzen.

Regeln:
- Bei Punktfragen reicht der Snippet — lade NICHT unnötig den Volltext nach (spart Tokens). Bei "fasse zusammen"/Vollkontext-Fragen fetch_document nutzen.
- Löse relative Zeitangaben ("diese Woche", "letzten Monat") selbst zu Datumsbereichen auf.
- Belege jede inhaltliche Aussage mit Quelle im Format (Quelle: <Kategorie>, <Datum>).
- Wenn die Tools nichts liefern, sage das ehrlich — erfinde nichts.
- Fasse dich kurz. Keine Floskeln.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }]

  let rounds = 0
  let finalText = ''

  while (rounds < MAX_ROUNDS) {
    rounds++
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools,
      messages,
    })

    // Text aus dieser Runde einsammeln.
    const textParts = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
    if (textParts.length) finalText = textParts.join('\n').trim()

    if (response.stop_reason !== 'tool_use') {
      break
    }

    // Tool-Calls ausführen und Ergebnisse anhängen.
    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )

    messages.push({ role: 'assistant', content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      const out = await executeTool(tu.name, tu.input as Record<string, unknown>)
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: out })
    }
    messages.push({ role: 'user', content: toolResults })

    // Nach der letzten erlaubten Runde keine weiteren Tools mehr → einmal final antworten.
    if (rounds >= MAX_ROUNDS) {
      const wrap = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages, // ohne tools → erzwingt Text-Antwort
      })
      const wrapText = wrap.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      if (wrapText) finalText = wrapText
      break
    }
  }

  if (!finalText) {
    finalText = 'Ich konnte dazu leider nichts finden.'
  }

  return { text: finalText, rounds }
}
