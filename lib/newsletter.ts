import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabaseAdmin'
import { appendToDailyLog, berlinNow } from './obsidian'

const anthropic = new Anthropic()

// ── PubMed Suche ──────────────────────────────────────────────────────────────

interface PubMedArticle {
  uid: string
  title: string
  abstract: string
  source: string
  pubdate: string
  authors: string[]
}

async function searchPubMed(query: string, days = 7): Promise<PubMedArticle[]> {
  const minDate = new Date()
  minDate.setDate(minDate.getDate() - days)
  const minDateStr = minDate.toISOString().slice(0, 10).replace(/-/g, '/')
  const searchUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=15` +
    `&term=${encodeURIComponent(query)}&mindate=${minDateStr}&datetype=pdat`
  const searchRes = await fetch(searchUrl)
  const searchJson = await searchRes.json()
  const ids: string[] = searchJson.esearchresult?.idlist ?? []
  if (ids.length === 0) return []

  const summaryUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`
  const summaryRes = await fetch(summaryUrl)
  const summaryJson = await summaryRes.json()
  const results = summaryJson.result ?? {}

  return ids
    .filter((id) => results[id])
    .map((id) => ({
      uid: id,
      title: results[id].title ?? '',
      abstract: results[id].summary ?? '',
      source: results[id].source ?? '',
      pubdate: results[id].pubdate ?? '',
      authors: (results[id].authors ?? []).slice(0, 3).map((a: { name: string }) => a.name),
    }))
}

// ── Claude Zusammenfassung ────────────────────────────────────────────────────

async function summariseArticles(articles: PubMedArticle[], kw: number, year: number): Promise<string> {
  if (articles.length === 0) return '_Keine neuen Publikationen diese Woche gefunden._'
  const articleText = articles
    .map((a, i) => `${i + 1}. **${a.title}** (${a.source}, ${a.pubdate})\n${a.abstract}`)
    .join('\n\n')
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `Du bist ein zahnmedizinischer Wissenschaftsredakteur. Fasse die folgenden PubMed-Abstracts für einen deutschen Zahnarzt prägnant zusammen. 
Format:
- 3-5 Bullet Points mit den wichtigsten klinisch relevanten Erkenntnissen
- Jeder Bullet max. 2 Sätze
- Sprache: Deutsch, fachlich aber verständlich
- Keine Einleitung, kein Fazit-Abschnitt`,
    messages: [{ role: 'user', content: `KW ${kw}/${year}:\n\n${articleText}` }],
  })
  return message.content[0].type === 'text' ? message.content[0].text : ''
}

// ── Wöchentlicher Newsletter ──────────────────────────────────────────────────

export async function runWeeklyNewsletter(): Promise<string> {
  const now = new Date()
  const kw = getISOWeek(now)
  const year = now.getFullYear()

  const queries = [
    'oral maxillofacial surgery',
    'orthognathic surgery jaw',
    'medication related osteonecrosis jaw MRONJ',
    'dental implant peri-implantitis',
    'head neck reconstruction free flap',
    'temporomandibular joint disorder',
    'cleft palate lip surgery',
    'mandible fracture trauma',
    'periodontal treatment systematic review',
    'endodontics root canal technique',
  ]

  const results = await Promise.all(queries.map((q) => searchPubMed(q, 14)))
  const allArticles = results.flat()

  // Deduplizieren
  const unique = Array.from(new Map(allArticles.map((a) => [a.uid, a])).values()).slice(0, 25)
  const summary = await summariseArticles(unique, kw, year)

  // In Supabase speichern (upsert nach source_url um Duplikate bei Retry zu vermeiden)
  await supabaseAdmin.from('literatur_entries').upsert(
    unique.map((article) => ({
      user_id: 'me',
      kw,
      jahr: year,
      title: article.title.slice(0, 200),
      summary: article.abstract.slice(0, 500) || article.title,
      source_url: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`,
      source_name: 'PubMed',
      category: 'Zahnmedizin',
      tags: ['newsletter', `kw${kw}`],
    })),
    { onConflict: 'source_url' },
  )

  // Obsidian Daily Log
  const { dateKey, timeBerlin } = berlinNow()
  void appendToDailyLog({ kind: 'note', timeBerlin, dateKey, content: `Zahnmedizin Newsletter KW ${kw} generiert (${unique.length} Artikel)` })

  return `📰 *Zahnmedizin-Update KW ${kw}/${year}*\n\n${summary}\n\n_${unique.length} Artikel aus PubMed_`
}

// ── Monatlicher Rückblick ─────────────────────────────────────────────────────

export async function runMonthlyReview(): Promise<string> {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  // Alle Einträge des vergangenen Monats
  const startKw = getISOWeek(new Date(year, month - 2, 1))
  const endKw = getISOWeek(new Date(year, month - 1, 0))

  const { data, error } = await supabaseAdmin
    .from('literatur_entries')
    .select('title, summary, source_url, kw')
    .eq('user_id', 'me')
    .eq('jahr', year)
    .gte('kw', startKw)
    .lte('kw', endKw)
    .order('kw', { ascending: true })
  if (error) throw error

  const entries = data ?? []
  if (entries.length === 0) return ''

  const text = entries.map((e) => `KW ${e.kw}: ${e.title}\n${e.summary}`).join('\n\n')
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: 'Du erstellst einen monatlichen Zahnmedizin-Literaturrückblick auf Deutsch. Strukturiere nach Themengebieten (Implantologie, Parodontologie, Endodontie, etc.). Hebe 3 besonders wichtige Erkenntnisse hervor.',
    messages: [{ role: 'user', content: `Monat ${month}/${year}:\n\n${text}` }],
  })
  const review = message.content[0].type === 'text' ? message.content[0].text : ''

  // Als knowledge_entry speichern
  await supabaseAdmin.from('knowledge_entries').insert({
    user_id: 'me',
    raw_text: review,
    summary: `Zahnmedizin Monatsbericht ${month}/${year}`,
    category: 'Literatur',
    source: 'literatur_monthly',
    tags: ['zahnmedizin', 'monatsbericht', `${year}-${String(month).padStart(2, '0')}`],
  })

  return review
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
