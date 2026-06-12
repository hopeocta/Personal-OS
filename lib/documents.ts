import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  normalizeVerwaltungCategory,
  normalizeFinanzenSub,
  verwaltungStoragePath,
  verwaltungVaultFolder,
} from '@/lib/obsidianPaths'
import { saveDocumentKnowledge, findDocumentByHash } from '@/lib/knowledge'
import { resolveCanonical } from '@/lib/metricDefs'
import { photoToDocumentPdf, isPhotoMime } from '@/lib/imageToDocPdf'
import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'

const anthropic = new Anthropic()

const STORAGE_BUCKET = 'documents'

// ── Shared types ──────────────────────────────────────────────────────────────

export type DocKind = 'image' | 'pdf'

export interface IncomingDoc {
  buffer: Buffer
  mimeType: string
  kind: DocKind
  dateIso: string // YYYY-MM-DD, vom User angegebenes Befund-Datum
  caption: string // optionale Notiz aus der Bildunterschrift (ohne Datum)
}

interface ExtractedValue {
  test_name: string
  value: number | null
  unit: string | null
  reference_min: number | null
  reference_max: number | null
  status: 'normal' | 'low' | 'high' | 'unknown'
}

interface GesundheitAnalysis {
  doc_type: 'blutbild' | 'laktattest' | 'befund'
  title: string
  summary: string
  values: ExtractedValue[]
}

interface VerwaltungAnalysis {
  kategorie: string
  title: string
  summary: string
  unterkategorie?: string | null // nur bei Finanzen relevant
}

export interface ProcessResult {
  message: string // fertige Telegram-Antwort (Markdown)
  storagePath: string | null
  obsidianOk: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string, maxLen = 50): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen) || 'dokument'
}

function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'text/csv': 'csv',
    'text/plain': 'txt',
  }
  return map[mimeType] ?? (mimeType.startsWith('image/') ? 'jpg' : 'bin')
}

/** Baut den Claude-Content-Block fuer Bild oder PDF. */
function fileBlock(doc: IncomingDoc): Anthropic.ContentBlockParam {
  const data = doc.buffer.toString('base64')
  if (doc.kind === 'pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data },
    }
  }
  const mediaType = (
    doc.mimeType === 'image/png' || doc.mimeType === 'image/webp' || doc.mimeType === 'image/gif'
      ? doc.mimeType
      : 'image/jpeg'
  ) as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  return {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data },
  }
}

function parseClaudeJson<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned) as T
  } catch (err) {
    console.error('[documents] JSON parse error:', err, raw.slice(0, 200))
    return null
  }
}

/** Wandelt Foto-Dokumente in saubere PDFs um (Ränder weg, Graustufen, komprimiert). */
async function normalizeDoc(doc: IncomingDoc): Promise<IncomingDoc> {
  if (!isPhotoMime(doc.mimeType)) return doc
  try {
    const pdfBuffer = await photoToDocumentPdf(doc.buffer)
    return { ...doc, buffer: pdfBuffer, mimeType: 'application/pdf', kind: 'pdf' }
  } catch (err) {
    console.error('[documents] Foto→PDF fehlgeschlagen, Original wird verwendet:', err)
    return doc
  }
}

/** Laedt das Original in den Supabase-Storage-Tresor (Quelle der Wahrheit). */
async function uploadToStorage(path: string, doc: IncomingDoc): Promise<string | null> {
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, doc.buffer, { contentType: doc.mimeType, upsert: true })
  if (error) {
    console.error('[documents] storage upload error:', error)
    return null
  }
  return path
}

/** Schreibt eine Binaerdatei in den Obsidian-Vault (best effort). */
async function writeBinaryToObsidian(vaultPath: string, doc: IncomingDoc): Promise<boolean> {
  const url = process.env.OBSIDIAN_API_URL
  const key = process.env.OBSIDIAN_API_KEY
  if (!url || !key) return false
  const encoded = vaultPath.split('/').map(encodeURIComponent).join('/')
  try {
    const res = await fetch(`${url}/vault/${encoded}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': doc.mimeType },
      body: new Uint8Array(doc.buffer),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[documents] Obsidian binary write failed:', res.status)
      return false
    }
    return true
  } catch (err) {
    console.error('[documents] Obsidian unreachable (binary):', err)
    return false
  }
}

/** Schreibt eine Markdown-Notiz in den Obsidian-Vault (best effort). */
async function writeMarkdownToObsidian(vaultPath: string, content: string): Promise<boolean> {
  const url = process.env.OBSIDIAN_API_URL
  const key = process.env.OBSIDIAN_API_KEY
  if (!url || !key) return false
  const encoded = vaultPath.split('/').map(encodeURIComponent).join('/')
  try {
    const res = await fetch(`${url}/vault/${encoded}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'text/markdown' },
      body: content,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[documents] Obsidian markdown write failed:', res.status)
      return false
    }
    return true
  } catch (err) {
    console.error('[documents] Obsidian unreachable (markdown):', err)
    return false
  }
}

// ── Gesundheit: lesen, Werte extrahieren, ablegen ─────────────────────────────

const GESUNDHEIT_SYSTEM = `Du bist ein medizinischer Dokumenten-Parser fuer ein persoenliches Gesundheits-Archiv.
Du bekommst ein Bild oder PDF: entweder ein Blutbild/Laborbefund, eine Leistungsdiagnostik (Laktattest/Spiroergometrie) oder einen sonstigen Arztbefund/Termin.

Gib AUSSCHLIESSLICH valides JSON zurueck, keine Erklaerung, kein Markdown:
{
  "doc_type": "blutbild" | "laktattest" | "befund",
  "title": "kurzer deutscher Titel, max 60 Zeichen, z.B. 'Grosses Blutbild Hausarzt'",
  "summary": "1-2 Saetze deutsche Zusammenfassung des Dokuments",
  "values": [
    {
      "test_name": "Name des Wertes, z.B. 'Ferritin' oder 'Laktat @ 200W'",
      "value": Zahl oder null,
      "unit": "Einheit als String oder null",
      "reference_min": Zahl oder null,
      "reference_max": Zahl oder null,
      "status": "normal" | "low" | "high" | "unknown"
    }
  ]
}

Regeln:
- doc_type "blutbild" fuer Laborwerte/Blutbild, "laktattest" fuer Leistungsdiagnostik, "befund" fuer alles andere (Arzttermin, Ueberweisung, Attest ohne Messwerte).
- Extrahiere JEDEN messbaren Wert mit Referenzbereich. Status anhand des Referenzbereichs: unter Min = "low", ueber Max = "high", sonst "normal". Kein Referenzbereich = "unknown".
- Wenn das Dokument keine messbaren Werte enthaelt (reiner Termin/Befundtext): "values": [] und doc_type "befund".
- Zahlen als echte JSON-Zahlen (Punkt als Dezimaltrenner), nicht als String.`

function statusEmoji(status: string): string {
  if (status === 'low') return '🔽'
  if (status === 'high') return '🔼'
  if (status === 'normal') return '✅'
  return '•'
}

export async function processGesundheitDoc(rawDoc: IncomingDoc): Promise<ProcessResult> {
  // 0. Foto-Dokumente → saubere PDF (Ränder weg, Graustufen)
  const doc = await normalizeDoc(rawDoc)
  const ext = extFromMime(doc.mimeType)

  // Duplikat-Schutz: identische Datei schon archiviert? (vor dem teuren Claude-Call)
  const contentHash = createHash('sha256').update(new Uint8Array(doc.buffer)).digest('hex')
  const existing = await findDocumentByHash(contentHash)
  if (existing) {
    return {
      message: `⏭ Dieses Dokument ist bereits archiviert (Duplikat erkannt):\n*${existing.summary ?? 'Befund'}*\nNichts doppelt gespeichert.`,
      storagePath: null,
      obsidianOk: true,
    }
  }

  // 1. Claude liest das Dokument
  let analysis: GesundheitAnalysis | null = null
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      // 8192 statt 2048: grosse Labor-/Leistungsdiagnostik-Dokumente haben viele Werte.
      // Bei 2048 brach das JSON mitten im String ab → Parsing scheiterte → Werte gingen
      // still verloren (genau der Fehlfall der zweiten Leistungsdiagnostik).
      max_tokens: 8192,
      system: GESUNDHEIT_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            fileBlock(doc),
            {
              type: 'text',
              text: doc.caption
                ? `Analysiere dieses Gesundheitsdokument. Notiz des Nutzers: "${doc.caption}"`
                : 'Analysiere dieses Gesundheitsdokument.',
            },
          ],
        },
      ],
    })
    const textBlock = msg.content.find((c) => c.type === 'text')
    if (textBlock && textBlock.type === 'text') {
      analysis = parseClaudeJson<GesundheitAnalysis>(textBlock.text)
    }
  } catch (err) {
    console.error('[documents] Claude Gesundheit error:', err)
  }

  const docType = analysis?.doc_type ?? 'befund'
  const title = analysis?.title?.trim() || (doc.caption || 'Befund')
  const summary = analysis?.summary?.trim() || ''
  const values = Array.isArray(analysis?.values) ? analysis!.values : []

  const slug = slugify(`${title}`)
  const baseName = `${doc.dateIso}-${slug}`

  // 2. In den Tresor (Supabase Storage) — bei Fotos bereits als PDF normalisiert
  const storagePath = await uploadToStorage(`gesundheit/${baseName}.${ext}`, doc)

  // 3. Werte strukturiert speichern (health_labs).
  //    Vom storagePath ENTKOPPELT: wenn der Tresor-Upload scheitert, sollen die Werte
  //    trotzdem in die DB (storage_path ist nullable). Sonst gehen sie still verloren.
  if (values.length > 0) {
    const rows = values.map((v) => ({
      user_id: 'me',
      date: doc.dateIso,
      source_type: docType,
      test_name: resolveCanonical(v.test_name),
      value: typeof v.value === 'number' ? v.value : null,
      unit: v.unit ?? null,
      reference_min: typeof v.reference_min === 'number' ? v.reference_min : null,
      reference_max: typeof v.reference_max === 'number' ? v.reference_max : null,
      status: v.status ?? 'unknown',
      storage_path: storagePath,
    }))
    const { error } = await supabaseAdmin.from('health_labs').insert(rows)
    if (error) console.error('[documents] health_labs insert error:', error)
  }

  // 3b. RAG-Index: IMMER eine knowledge_entries-Zeile schreiben (auch ohne Werte),
  //     damit das Dokument über search_knowledge auffindbar ist. Die komplette
  //     Wertetabelle steht als Text drin → "Wie war meine maximale Leistung?" findet 290 W.
  const valuesAsText = values
    .map((v) => {
      const ref =
        v.reference_min != null || v.reference_max != null
          ? ` (Ref ${v.reference_min ?? ''}–${v.reference_max ?? ''})`
          : ''
      return `${v.test_name}: ${v.value ?? ''} ${v.unit ?? ''}${ref} [${v.status}]`
    })
    .join('\n')
  const ragText = [
    `${title} (${docType}, ${doc.dateIso})`,
    summary,
    valuesAsText,
    doc.caption ? `Notiz: ${doc.caption}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  await saveDocumentKnowledge({
    raw_text: ragText,
    category: 'Gesundheit',
    summary: summary || title,
    tags: [docType, 'gesundheit'],
    source: 'telegram_gesundheit',
    contentHash,
    storagePath,
  })

  // 4. Obsidian: PDF + Markdown-Notiz (best effort)
  void writeBinaryToObsidian(`Gesundheit/Dokumente/${baseName}.${ext}`, doc)
  const valueTable =
    values.length > 0
      ? '\n## Werte\n\n| Wert | Ergebnis | Referenz | Status |\n|---|---|---|---|\n' +
        values
          .map((v) => {
            const ref =
              v.reference_min != null || v.reference_max != null
                ? `${v.reference_min ?? ''}–${v.reference_max ?? ''}`
                : ''
            return `| ${v.test_name} | ${v.value ?? ''} ${v.unit ?? ''} | ${ref} | ${v.status} |`
          })
          .join('\n') +
        '\n'
      : ''
  const note = `---
date: ${doc.dateIso}
category: Gesundheit
doc_type: ${docType}
source: telegram
storage_path: ${storagePath ?? ''}
---
# ${title}

${summary}
${valueTable}${doc.caption ? `\n> Notiz: ${doc.caption}\n` : ''}`
  const mdOk = await writeMarkdownToObsidian(`Gesundheit/Dokumente/${baseName}.md`, note)

  // 5. Telegram-Antwort bauen
  const typeLabel =
    docType === 'blutbild' ? '🩸 Blutbild' : docType === 'laktattest' ? '🚴 Leistungsdiagnostik' : '📄 Befund'
  let message = `✅ *${title}*\n${typeLabel} · 📅 ${doc.dateIso}`
  if (summary) message += `\n\n${summary}`

  if (values.length > 0) {
    const abnormal = values.filter((v) => v.status === 'low' || v.status === 'high')
    message += `\n\n*${values.length} Werte erkannt*`
    if (abnormal.length > 0) {
      message += `\n⚠️ Auffällig:`
      for (const v of abnormal.slice(0, 12)) {
        message += `\n${statusEmoji(v.status)} ${v.test_name}: ${v.value ?? ''} ${v.unit ?? ''}`
      }
    } else {
      message += ` — alle im Normbereich ✅`
    }
  }

  if (!storagePath) message += `\n\n❗ Konnte Original nicht im Tresor sichern.`

  return { message, storagePath, obsidianOk: mdOk }
}

// ── Verwaltung: nur ablegen + grob kategorisieren, keine Analyse ──────────────

const VERWALTUNG_SYSTEM = `Du sortierst offizielle/buerokratische Dokumente in ein Archiv ein.
Du bekommst ein Bild oder PDF. Bestimme die Ablage und fasse den Inhalt KURZ zusammen
(damit man das Dokument spaeter per Frage wiederfindet — keine tiefe Analyse).

Gib AUSSCHLIESSLICH valides JSON zurueck:
{
  "kategorie": "Versicherung" | "Arbeit" | "Universität" | "Amt" | "Finanzen" | "Wohnen" | "Datenbank" | "Reisen" | "Sonstiges",
  "title": "kurzer deutscher Dateiname-tauglicher Titel, max 60 Zeichen",
  "summary": "1-2 Saetze: worum geht es, wichtigste Eckdaten (Namen, Datum, Betraege, Nummern)",
  "unterkategorie": null
}

NUR wenn kategorie = "Finanzen": setze "unterkategorie" auf genau einen Wert:
- "Rechnungen privat": private Rechnung/Quittung/Kassenbon (Einkauf, Arzt-Privatrechnung, Abo, Handwerker privat).
- "Rechnungen Arbeit": berufliche/geschaeftliche Rechnung, Spesen, Bewirtungsbeleg, beruflich absetzbare Ausgabe.
- "Steuern": Steuerbescheid, Steuererklaerung, Lohnsteuerbescheinigung, alles vom Finanzamt.
Wenn keins davon klar passt (z.B. Kontoauszug, Gehaltsabrechnung): "unterkategorie": null.
Bei allen anderen kategorie-Werten: "unterkategorie": null.

Regeln fuer "kategorie" (waehle die EINE beste):
- "Finanzen": Rechnung, Quittung, Kassenbon, Kontoauszug, Steuerbescheid/Steuererklaerung, Gehaltsabrechnung, Mahnung, Kreditvertrag.
- "Versicherung": Versicherungspolice/-schein/-brief, Beitrags-/Leistungsabrechnung einer Versicherung, Schadensmeldung (nicht nur Reisebeleg).
- "Universität": Uni-/Studiendokumente: Immatrikulation, Studienbescheinigung, Kursscheine/Zeugnisse der Uni, Erasmus, Learning Agreement, Diploma Supplement.
- "Amt": Behoerdenbescheid, Urkunde (Geburt/Heirat), Meldebescheinigung, Bescheinigung einer Behoerde (NICHT Uni — die geht nach Universität).
- "Arbeit": Arbeitsvertrag, Schulungsnachweis/Zertifikat, Lernvereinbarung, Praktikums-/Arbeitszeugnis (NUR beruflich, NICHT Uni).
- "Wohnen": Mietvertrag, Nebenkostenabrechnung, Energievertrag, Handwerkerrechnung fuer die Wohnung.
- "Datenbank": persoenliche Ausweisdokumente, z.B. Reisepass, Personalausweis, Impfpass/Impfnachweis, Visum.
- "Reisen": konkrete Reise-Buchungen und Urlaubsunterlagen, z.B. Flugticket/Boarding Pass, Hotelbuchung, Bahn-/Zug-Ticket, Mietwagen-Buchung, Reiseversicherungsnachweis, Buchungsbestaetigung fuer einen Urlaub/eine Reise.
- "Sonstiges": nur wenn wirklich nichts passt.
Bei Ueberschneidung gewinnt die spezifischste Kategorie (z.B. Versicherungs-Rechnung → Versicherung, nicht Finanzen).`

export async function processVerwaltungDoc(rawDoc: IncomingDoc): Promise<ProcessResult> {
  // 0. Foto-Dokumente → saubere PDF (Ränder weg, Graustufen)
  const doc = await normalizeDoc(rawDoc)
  const ext = extFromMime(doc.mimeType)

  // Duplikat-Schutz: identische Datei schon archiviert?
  const contentHash = createHash('sha256').update(new Uint8Array(doc.buffer)).digest('hex')
  const existing = await findDocumentByHash(contentHash)
  if (existing) {
    return {
      message: `⏭ Dieses Dokument ist bereits archiviert (Duplikat erkannt):\n*${existing.summary ?? 'Dokument'}*\nNichts doppelt gespeichert.`,
      storagePath: null,
      obsidianOk: true,
    }
  }

  let analysis: VerwaltungAnalysis | null = null
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: VERWALTUNG_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            fileBlock(doc),
            {
              type: 'text',
              text: doc.caption
                ? `Ordne dieses Dokument ein. Notiz des Nutzers: "${doc.caption}"`
                : 'Ordne dieses Dokument ein.',
            },
          ],
        },
      ],
    })
    const textBlock = msg.content.find((c) => c.type === 'text')
    if (textBlock && textBlock.type === 'text') {
      analysis = parseClaudeJson<VerwaltungAnalysis>(textBlock.text)
    }
  } catch (err) {
    console.error('[documents] Claude Verwaltung error:', err)
  }

  const kategorie = normalizeVerwaltungCategory(analysis?.kategorie)
  const title = analysis?.title?.trim() || (doc.caption || 'Dokument')
  const summary = analysis?.summary?.trim() || ''
  // Finanzen-Unterordner (Rechnungen privat/Arbeit, Steuern) — sonst null.
  const finanzenSub = kategorie === 'Finanzen' ? normalizeFinanzenSub(analysis?.unterkategorie) : null

  const slug = slugify(title)
  const baseName = `${doc.dateIso}-${slug}`
  const vaultFolder = verwaltungVaultFolder(kategorie, finanzenSub)

  // 1. Tresor — bei Fotos bereits als PDF normalisiert
  const storagePath = await uploadToStorage(
    verwaltungStoragePath(kategorie, baseName, ext, finanzenSub),
    doc,
  )

  // 2. Obsidian: PDF + Markdown-Notiz (best effort)
  void writeBinaryToObsidian(`${vaultFolder}/${baseName}.${ext}`, doc)
  const note = `---
date: ${doc.dateIso}
category: Verwaltung
kategorie: ${kategorie}
source: telegram
storage_path: ${storagePath ?? ''}
---
# ${title}

${summary}
${doc.caption ? `\n> Notiz: ${doc.caption}\n` : ''}`
  const mdOk = await writeMarkdownToObsidian(`${vaultFolder}/${baseName}.md`, note)

  // 3. RAG-Index: Verwaltungsdokument auffindbar machen (Titel + Zusammenfassung).
  const ragText = [
    `${title} (Verwaltung/${kategorie}, ${doc.dateIso})`,
    summary,
    doc.caption ? `Notiz: ${doc.caption}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  await saveDocumentKnowledge({
    raw_text: ragText,
    category: 'Verwaltung',
    summary: summary || title,
    tags: [kategorie.toLowerCase(), 'verwaltung'],
    source: 'telegram_verwaltung',
    contentHash,
    storagePath,
  })

  let message = `✅ *${title}*\n📋 Verwaltung · ${kategorie}${finanzenSub ? ` / ${finanzenSub}` : ''} · 📅 ${doc.dateIso}`
  if (!storagePath) message += `\n\n❗ Konnte Original nicht im Tresor sichern.`

  return { message, storagePath, obsidianOk: mdOk }
}
