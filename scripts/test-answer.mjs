// Testet den vollen answerQuestion()-Loop (Claude Tool-Use).
// Aufruf: node --import=./scripts/_register.mjs scripts/test-answer.mjs
//
// Da lib/answer.ts TypeScript mit @/-Aliasen nutzt, kompilieren wir on-the-fly
// via tsx (wird mit npx geladen, keine Installation nötig).
// Aufruf:  npx tsx scripts/test-answer.mjs

import { config } from 'dotenv'
config({ path: '.env.local', override: true })

// Direkter Inline-Import der benötigten Funktionen (umgeht @/-Alias-Problem).
// Wir rufen die API direkt auf — gleiche Logik wie lib/answer.ts.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const MODEL = 'claude-sonnet-4-6'
const MAX_ROUNDS = 3
const MAX_TOKENS = 1024
const EMBED_MODEL = 'text-embedding-3-small'

async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 6000) }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  return (await res.json()).data[0].embedding
}

const METRIC_MAP = {
  sleep_score: { table: 'garmin_sleep', column: 'sleep_score' },
  hrv: { table: 'garmin_sleep', column: 'hrv_nightly' },
  sleep_minutes: { table: 'garmin_sleep', column: 'total_sleep_min' },
  activity_distance: { table: 'garmin_activities', column: 'distance_km' },
  activity_duration: { table: 'garmin_activities', column: 'duration_min' },
  body_battery_morning: { table: 'garmin_body_battery', column: 'morning_score' },
  vo2max: { table: 'garmin_training', column: 'vo2max' },
  calories: { table: 'nutrition_logs', column: 'calories' },
  protein: { table: 'nutrition_logs', column: 'protein_g' },
}

async function runTools(toolUses) {
  const results = []
  for (const tu of toolUses) {
    let out
    if (tu.name === 'search_knowledge') {
      const emb = await embed(tu.input.query)
      const { data, error } = await sb.rpc('match_knowledge', {
        query_embedding: emb,
        match_count: 6,
        filter_category: tu.input.category ?? null,
      })
      if (error) { out = JSON.stringify({ error: error.message }) }
      else {
        const hits = (data ?? []).map(h => ({
          kategorie: h.category,
          datum: h.created_at?.slice(0, 10),
          relevanz: Math.round(h.similarity * 100) + '%',
          text: (h.summary ? h.summary + '\n' : '') + h.raw_text.slice(0, 1200),
        }))
        out = JSON.stringify({ treffer: hits })
      }
    } else if (tu.name === 'query_metrics') {
      const def = METRIC_MAP[tu.input.metric]
      if (!def) { out = JSON.stringify({ error: `Unbekannte Metrik: ${tu.input.metric}` }) }
      else {
        let q = sb.from(def.table).select(`date, ${def.column}`)
          .gte('date', tu.input.from_date).lte('date', tu.input.to_date)
          .not(def.column, 'is', null).order('date')
        if (def.table === 'garmin_activities' && tu.input.activity_type)
          q = q.eq('type', tu.input.activity_type)
        const { data, error } = await q
        if (error) { out = JSON.stringify({ error: error.message }) }
        else {
          const vals = (data ?? []).map(r => Number(r[def.column])).filter(v => !isNaN(v))
          let value = null
          if (tu.input.aggregate === 'avg' && vals.length)
            value = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length * 10)/10
          else if (tu.input.aggregate === 'sum' && vals.length)
            value = Math.round(vals.reduce((a,b)=>a+b,0) * 10)/10
          else if (tu.input.aggregate === 'latest' && vals.length)
            value = vals[vals.length-1]
          out = JSON.stringify({ metric: tu.input.metric, value, count: vals.length,
            from: tu.input.from_date, to: tu.input.to_date })
        }
      }
    } else {
      out = JSON.stringify({ error: `Unbekanntes Tool: ${tu.name}` })
    }
    console.log(`  → Tool ${tu.name}(${JSON.stringify(tu.input).slice(0,80)}…)`)
    results.push({ type: 'tool_result', tool_use_id: tu.id, content: out })
  }
  return results
}

const tools = [
  { name: 'search_knowledge', description: 'Semantische Suche in Notizen/Wissen.', input_schema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' } }, required: ['query'] } },
  { name: 'query_metrics', description: 'Zahlen aus Garmin/Ernährung/Training.', input_schema: { type: 'object', properties: { metric: { type: 'string', enum: Object.keys(METRIC_MAP) }, from_date: { type: 'string' }, to_date: { type: 'string' }, aggregate: { type: 'string', enum: ['sum','avg','min','max','latest','count'] }, activity_type: { type: 'string' } }, required: ['metric','from_date','to_date','aggregate'] } },
]

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
const system = `Du bist der persönliche Assistent eines Zahnmedizin-Studenten und Triathleten. Heutiges Datum: ${today}. Antworte auf Deutsch, knapp, belege mit Quellen (Kategorie, Datum). Nutze search_knowledge für Texte, query_metrics für Zahlen.`

async function answer(question) {
  console.log(`\n${'='.repeat(60)}\nFrage: "${question}"\n`)
  const messages = [{ role: 'user', content: question }]
  let rounds = 0
  let finalText = ''

  while (rounds < MAX_ROUNDS) {
    rounds++
    const res = await anthropic.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, system, tools, messages })
    const texts = res.content.filter(b => b.type === 'text').map(b => b.text)
    if (texts.length) finalText = texts.join('\n').trim()

    console.log(`  Runde ${rounds}: stop_reason=${res.stop_reason}, tool_calls=${res.content.filter(b=>b.type==='tool_use').length}`)

    if (res.stop_reason !== 'tool_use') break

    const toolUses = res.content.filter(b => b.type === 'tool_use')
    messages.push({ role: 'assistant', content: res.content })
    const toolResults = await runTools(toolUses)
    messages.push({ role: 'user', content: toolResults })

    if (rounds >= MAX_ROUNDS) {
      const wrap = await anthropic.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, system, messages })
      finalText = wrap.content.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim()
      break
    }
  }

  console.log(`\nAntwort (${rounds} Runde${rounds>1?'n':''}):\n${finalText}\n`)
}

// Test 1: Text-Frage → Vektor-Pfad
await answer('Was weiß ich über Endodontie?')

// Test 2: Zahlen-Frage → SQL-Pfad
await answer('Wie war mein durchschnittlicher Schlaf-Score diesen Monat?')
