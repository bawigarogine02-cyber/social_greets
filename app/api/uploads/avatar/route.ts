import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Please choose an image file.' }, { status: 400 })
    }
    if (!extensions[file.type]) {
      return NextResponse.json({ error: 'Please choose a JPG, PNG, GIF, or WebP image.' }, { status: 400 })
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: 'Image must be 2 MB or smaller.' }, { status: 413 })
    }

    const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', 'avatars')
    await mkdir(uploadDirectory, { recursive: true })

    const filename = `${randomUUID()}.${extensions[file.type]}`
    await writeFile(path.join(uploadDirectory, filename), Buffer.from(await file.arrayBuffer()))

    return NextResponse.json({ url: `/uploads/avatars/${filename}` })
  } catch {
    return NextResponse.json({ error: 'Could not save that image.' }, { status: 500 })
  }
}
