import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

export const runtime = 'nodejs'

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const videoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/x-matroska'])
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const extensionByType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/ogg': 'ogg',
  'video/x-matroska': 'mkv',
}

function detectMimeType(file: File) {
  if (file.type) return file.type

  const name = file.name.toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.mp4')) return 'video/mp4'
  if (name.endsWith('.webm')) return 'video/webm'
  if (name.endsWith('.mov') || name.endsWith('.qt')) return 'video/quicktime'
  if (name.endsWith('.ogg') || name.endsWith('.ogv')) return 'video/ogg'
  if (name.endsWith('.mkv')) return 'video/x-matroska'
  return ''
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const scope = formData.get('scope') === 'banner' ? 'banners' : 'messages'

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Please choose an image or video.' }, { status: 400 })
    }

    const mimeType = detectMimeType(file)
    const mediaType = imageTypes.has(mimeType) ? 'image' : videoTypes.has(mimeType) ? 'video' : null

    if (!mediaType) {
      return NextResponse.json({ error: 'Please choose an image, GIF, or video file.' }, { status: 400 })
    }

    if (mediaType === 'video' && file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: 'Video must be 100 MB or smaller.' }, { status: 400 })
    }

    const directory = path.join(process.cwd(), 'public', 'uploads', scope)
    await mkdir(directory, { recursive: true })

    const id = randomUUID()
    const extension = mediaType === 'image' ? 'webp' : extensionByType[mimeType] || 'mp4'
    const filename = `${id}.${extension}`
    const publicPath = path.join(directory, filename)

    if (mediaType === 'image') {
      const compressed = await sharp(Buffer.from(await file.arrayBuffer()), { animated: mimeType === 'image/gif' })
        .rotate()
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
      await writeFile(publicPath, compressed)
    } else {
      await writeFile(publicPath, Buffer.from(await file.arrayBuffer()))
    }

    return NextResponse.json({ url: `/uploads/${scope}/${filename}`, mediaType })
  } catch (error) {
    console.error('Message media processing failed:', error)
    return NextResponse.json({ error: 'Could not process that media. Please try again.' }, { status: 500 })
  }
}
