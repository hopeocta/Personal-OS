import { NextRequest, NextResponse } from 'next/server'
import { listTasksWithStatus, setTaskDone } from '@/lib/tasks'

export async function GET() {
  try {
    const tasks = await listTasksWithStatus()
    return NextResponse.json(tasks)
  } catch (err) {
    console.error('[tasks] GET error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { id, done } = body as { id?: string; done?: boolean }
    if (!id || typeof done !== 'boolean') {
      return NextResponse.json({ error: 'id and done(boolean) required' }, { status: 400 })
    }
    const task = await setTaskDone(id, done)
    return NextResponse.json(task)
  } catch (err) {
    console.error('[tasks] POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
