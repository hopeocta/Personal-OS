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

// ── Deutsche Abschnitte pro Artikel ──────────────────────────────────────────

async function generateSectionsDe(article: PubMedArticle): Promise<object | null> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `Du bist medizinischer Wissenschaftsjournalist. Analysiere diesen PubMed-Artikel und antworte NUR mit validem JSON, ohne Markdown-Blöcke oder Erklärungen.

JSON-Format:
{
  "hintergrund": "Warum wurde diese Studie gemacht? Was war die Forschungsfrage? (2-3 Sätze)",
  "methodik_ergebnisse": "Wie wurde geforscht, wie viele Patienten/Probanden, was kam konkret raus? (3-4 Sätze)",
  "schlussfolgerung": "Was bedeutet das klinisch? Was sollte ein Arzt daraus mitnehmen? (2-3 Sätze)",
  "fortschritt": "Was ist das Neue an dieser Studie? Was ändert sich dadurch in der Medizin oder Praxis? (2-3 Sätze)"
}

Sprache: Deutsch. Fachlich korrekt aber verständlich.`,
      messages: [{
        role: 'user',
        content: `Titel: ${article.title}\n\nAbstract: ${article.abstract || 'Kein Abstract verfügbar.'}`,
      }],
    })
    let text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    // Haiku umschließt das JSON oft mit ```json ... ``` trotz Prompt → Fences strippen,
    // notfalls das erste {...}-Objekt herausschneiden (sonst bleibt sections_de null).
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    if (!text.startsWith('{')) {
      const m = text.match(/\{[\s\S]*\}/)
      if (m) text = m[0]
    }
    return JSON.parse(text)
  } catch {
    return null
  }
}

// ── Obsidian: Artikel als Dateien speichern ───────────────────────────────────

interface ArticleWithSections extends PubMedArticle {
  sections_de: object | null
}

function obsidianFolderForArticle(title: string): { folder: string; category: string } {
  const t = title.toLowerCase()
  const ZM = 'Literatur/Medizin/Zahnmedizin'
  if (t.includes('triathlon') || t.includes('endurance') || t.includes('exercise') ||
    t.includes('sport') || t.includes('troponin') || t.includes('tendinopathy') ||
    t.includes('rehabilitation') || t.includes('pacing') || t.includes('running') ||
    t.includes('cycling') || t.includes('swimming') || t.includes('vo2') || t.includes('lactate'))
    return { folder: 'Literatur/Medizin/Sportmedizin', category: 'Sportmedizin' }
  if (t.includes('implant'))
    return { folder: `${ZM}/Implantologie`, category: 'Implantologie' }
  if (t.includes('periodont') || t.includes('gingiv') || t.includes('peri-implant'))
    return { folder: `${ZM}/Parodontologie`, category: 'Parodontologie' }
  if (t.includes('endodont') || t.includes('root canal') || t.includes('pulp'))
    return { folder: `${ZM}/Endodontie`, category: 'Endodontie' }
  if (t.includes('temporomandibular') || t.includes('tmj'))
    return { folder: `${ZM}/Kiefergelenk`, category: 'Kiefergelenk' }
  if (t.includes('cancer') || t.includes('carcinoma') || t.includes('tumor') ||
    t.includes('immunotherapy') || t.includes('oncol') || t.includes('malignant') || t.includes('squamous'))
    return { folder: 'Literatur/Medizin/Onkologie', category: 'Onkologie' }
  if (t.includes('surgery') || t.includes('surgical') || t.includes('maxillofac') ||
    t.includes('trauma') || t.includes('fracture') || t.includes('flap') ||
    t.includes('reconstruction') || t.includes('orthognath') || t.includes('osteonecrosis') || t.includes('mronj'))
    return { folder: `${ZM}/MKG-Chirurgie`, category: 'MKG / Chirurgie' }
  if (t.includes('dental') || t.includes('tooth') || t.includes('teeth') || t.includes('oral') || t.includes('jaw') || t.includes('mandib') || t.includes('maxill'))
    return { folder: ZM, category: 'Zahnmedizin' }
  return { folder: 'Literatur/Medizin', category: 'Medizin' }
}

async function writeArticlesToObsidian(articles: ArticleWithSections[], kw: number, year: number): Promise<void> {
  const obsidianUrl = process.env.OBSIDIAN_API_URL
  const obsidianKey = process.env.OBSIDIAN_API_KEY
  if (!obsidianUrl || !obsidianKey) return

  await Promise.all(articles.map(async (article) => {
    const slug = article.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50)

    const { folder, category } = obsidianFolderForArticle(article.title)
    const vaultPath = `${folder}/KW${kw}-${year}-${slug}.md`
    const encodedPath = vaultPath.split('/').map(encodeURIComponent).join('/')

    const s = article.sections_de as Record<string, string> | null
    const content = [
      `---`,
      `kw: ${kw}`,
      `jahr: ${year}`,
      `category: ${category}`,
      `source_url: https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`,
      `tags: [newsletter, kw${kw}, zahnmedizin]`,
      `---`,
      ``,
      `# ${article.title}`,
      ``,
      `## Was wurde untersucht?`,
      s?.hintergrund ?? article.abstract ?? '—',
      ``,
      `## Methodik & Ergebnisse`,
      s?.methodik_ergebnisse ?? '—',
      ``,
      `## Schlussfolgerung`,
      s?.schlussfolgerung ?? '—',
      ``,
      `## Medizinischer Fortschritt`,
      s?.fortschritt ?? '—',
    ].join('\n')

    try {
      const res = await fetch(`${obsidianUrl}/vault/${encodedPath}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${obsidianKey}`, 'Content-Type': 'text/markdown' },
        body: content,
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) console.error(`[newsletter] Obsidian write failed for "${article.title}":`, res.status)
    } catch (err) {
      console.error(`[newsletter] Obsidian unreachable for "${article.title}":`, err)
    }
  }))
}

// ── Wöchentlicher Newsletter ──────────────────────────────────────────────────

export async function runWeeklyNewsletter(): Promise<string> {
  const now = new Date()
  const kw = getISOWeek(now)
  const year = now.getFullYear()

  const queries = [
    'oral maxillofacial surgery',
    'orthognathic surgery jaw dysgnathia',
    'medication related osteonecrosis jaw MRONJ BRONJ',
    'dental implant osseointegration',
    'peri-implantitis treatment systematic review',
    'oral cancer squamous cell carcinoma treatment',
    'head neck cancer immunotherapy survival',
    'temporomandibular joint disorder therapy',
    'cleft palate lip surgery outcome',
    'mandible fracture reconstruction',
    'free flap head neck reconstruction',
    'periodontal regeneration treatment',
    'endodontics root canal technique',
    'sports medicine exercise recovery performance',
    'triathlon cycling running swimming endurance physiology',
  ]

  const results = await Promise.all(queries.map((q) => searchPubMed(q, 14)))
  const allArticles = results.flat()

  // Deduplizieren
  const unique = Array.from(new Map(allArticles.map((a) => [a.uid, a])).values()).slice(0, 25)

  // Deutsche Abschnitte für alle Artikel parallel generieren
  const sectionsDeList = await Promise.all(unique.map((a) => generateSectionsDe(a)))

  const articlesWithSections = unique.map((a, i) => ({ ...a, sections_de: sectionsDeList[i] ?? null }))

  const [summary] = await Promise.all([
    summariseArticles(unique, kw, year),
    writeArticlesToObsidian(articlesWithSections, kw, year),
    // In Supabase speichern (upsert nach source_url um Duplikate bei Retry zu vermeiden)
    supabaseAdmin.from('literatur_entries').upsert(
      unique.map((article, i) => ({
        user_id: 'me',
        kw,
        jahr: year,
        title: article.title.slice(0, 200),
        summary: article.abstract.slice(0, 500) || article.title,
        source_url: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`,
        source_name: 'PubMed',
        category: 'Zahnmedizin',
        tags: ['newsletter', `kw${kw}`],
        sections_de: sectionsDeList[i] ?? null,
      })),
      { onConflict: 'source_url' },
    ),
  ])

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
