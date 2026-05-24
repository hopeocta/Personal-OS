import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })
  }

  const audioFile = formData.get('audio')
  if (!audioFile || !(audioFile instanceof Blob)) {
    return NextResponse.json({ error: 'audio field required' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
  }

  const whisperForm = new FormData()
  whisperForm.append('file', audioFile, 'recording.webm')
  whisperForm.append('model', 'whisper-1')
  whisperForm.append('language', 'de')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: whisperForm,
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[transcribe] Whisper error:', res.status, errText)
    return NextResponse.json(
      { error: `Whisper error: ${res.status}` },
      { status: 502 }
    )
  }

  const json = await res.json() as { text: string }
  return NextResponse.json({ text: json.text })
}
