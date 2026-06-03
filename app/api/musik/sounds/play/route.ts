import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

const MIME_TYPES: Record<string, string> = {
  '.wav':  'audio/wav',
  '.mp3':  'audio/mpeg',
  '.aif':  'audio/aiff',
  '.aiff': 'audio/aiff',
  '.flac': 'audio/flac',
  '.ogg':  'audio/ogg',
  '.m4a':  'audio/mp4',
  '.mp4':  'audio/mp4',
}

function nodeStreamToWeb(stream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(chunk as Uint8Array))
      stream.on('end', () => controller.close())
      stream.on('error', (err) => controller.error(err))
    },
    cancel() {
      stream.destroy()
    },
  })
}

export async function GET(req: NextRequest) {
  const libraryPath = process.env.SAMPLE_LIBRARY_PATH
  if (!libraryPath) {
    return new NextResponse('SAMPLE_LIBRARY_PATH not configured', { status: 400 })
  }

  const filePath = req.nextUrl.searchParams.get('path')
  if (!filePath) {
    return new NextResponse('Missing path param', { status: 400 })
  }

  // Security: path must be inside the configured library root
  const resolved = path.resolve(filePath)
  const libraryResolved = path.resolve(libraryPath)
  if (!resolved.startsWith(libraryResolved)) {
    return new NextResponse('Access denied', { status: 403 })
  }

  if (!fs.existsSync(resolved)) {
    return new NextResponse('File not found', { status: 404 })
  }

  const stat = fs.statSync(resolved)
  const fileSize = stat.size
  const ext = path.extname(resolved).toLowerCase()
  const contentType = MIME_TYPES[ext] ?? 'audio/octet-stream'
  const range = req.headers.get('range')

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/)
    if (!match) return new NextResponse('Invalid range', { status: 416 })
    const start = parseInt(match[1], 10)
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
    const chunkSize = end - start + 1

    const nodeStream = fs.createReadStream(resolved, { start, end })
    return new NextResponse(nodeStreamToWeb(nodeStream), {
      status: 206,
      headers: {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type':   contentType,
      },
    })
  }

  const nodeStream = fs.createReadStream(resolved)
  return new NextResponse(nodeStreamToWeb(nodeStream), {
    status: 200,
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type':   contentType,
      'Accept-Ranges':  'bytes',
    },
  })
}
