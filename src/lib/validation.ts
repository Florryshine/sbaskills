// SBA Social Publishing — media validation (thumbnails and uploads).
// Uses sharp (already a project dependency) for real image inspection —
// no trust in client-supplied dimensions.

import sharp from 'sharp'
import { PLATFORM_META, type Platform } from './types'

export const THUMB_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
export const THUMB_MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB upload ceiling
export const THUMB_PLATFORM_LIMIT: Record<string, number> = {
  // YouTube hard limit: 2 MB
  youtube: 2 * 1024 * 1024,
}
export const THUMB_MIN_WIDTH = 640 // YouTube minimum width
export const IMAGE_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024 // file upload ceiling; larger videos should use URL import

export interface ImageMeta {
  width: number
  height: number
  format: string
  sizeBytes: number
}

export interface ValidationResult {
  ok: boolean
  error?: string
  guidance?: string
  meta?: ImageMeta
  warnings: string[]
}

async function inspect(buffer: Buffer): Promise<ImageMeta | null> {
  try {
    const s = sharp(buffer)
    const m = await s.metadata()
    if (!m.width || !m.height || !m.format) return null
    return { width: m.width, height: m.height, format: m.format, sizeBytes: buffer.length }
  } catch {
    return null
  }
}

/** Validate an uploaded custom thumbnail (no auto-fixing — report problems). */
export async function validateThumbnail(buffer: Buffer, mimeType: string): Promise<ValidationResult> {
  const warnings: string[] = []
  if (!(THUMB_ALLOWED_MIME as readonly string[]).includes(mimeType)) {
    return {
      ok: false,
      error: `Unsupported image type "${mimeType}".`,
      guidance: 'Upload a JPG, PNG or WEBP image. You can export these from Canva or Photoshop.',
      warnings,
    }
  }
  if (buffer.length > THUMB_MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `Image is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — the upload limit is ${THUMB_MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      guidance: 'Export the image at a smaller size (e.g. 1280×720 JPG) and try again.',
      warnings,
    }
  }
  const meta = await inspect(buffer)
  if (!meta) {
    return { ok: false, error: 'The file could not be read as an image.', guidance: 'Re-export the image and upload it again.', warnings }
  }
  if (meta.width < THUMB_MIN_WIDTH) {
    return {
      ok: false,
      error: `Image width is ${meta.width}px — thumbnails must be at least ${THUMB_MIN_WIDTH}px wide.`,
      guidance: 'Recommended thumbnail size: 1280×720 (16:9).',
      warnings,
    }
  }
  // Aspect ratio + size advisories per target platform are handled by callers
  if (Math.abs(meta.width / meta.height - 16 / 9) > 0.2) {
    warnings.push(`Aspect ratio is ${meta.width}×${meta.height} — 1280×720 (16:9) displays best on video platforms.`)
  }
  return { ok: true, meta, warnings }
}

/** Prepare a thumbnail for a specific platform: convert/compress if the platform needs it. */
export interface PreparedThumb {
  buffer: Buffer
  mimeType: string
  meta: ImageMeta
  warnings: string[]
}

export async function prepareThumbnailForPlatform(
  buffer: Buffer,
  mimeType: string,
  platform: Platform,
): Promise<PreparedThumb> {
  const meta = await inspect(buffer)
  if (!meta) throw new Error('Thumbnail could not be read as an image')
  const warnings: string[] = []
  let out = buffer
  let outMime = mimeType
  let outMeta = meta

  const limit = THUMB_PLATFORM_LIMIT[platform]
  const needsJpeg = platform === 'youtube' && mimeType !== 'image/jpeg' // YouTube accepts JPG/PNG but not WEBP
  const tooBig = limit !== undefined && buffer.length > limit

  if (needsJpeg || tooBig) {
    const maxW = Math.min(meta.width, 1280)
    const resized = sharp(buffer).resize({ width: maxW, withoutEnlargement: true })
    let quality = 85
    let jpeg = await resized.jpeg({ quality }).toBuffer()
    // Compress progressively until under the platform limit
    while (limit !== undefined && jpeg.length > limit && quality >= 40) {
      quality -= 10
      jpeg = await sharp(buffer).resize({ width: maxW, withoutEnlargement: true }).jpeg({ quality }).toBuffer()
    }
    if (limit !== undefined && jpeg.length > limit) {
      throw new Error(
        `Thumbnail could not be compressed below ${(limit / 1024 / 1024).toFixed(1)} MB for ${PLATFORM_META[platform].label}`,
      )
    }
    out = jpeg
    outMime = 'image/jpeg'
    const m = await sharp(out).metadata()
    outMeta = { width: m.width || 0, height: m.height || 0, format: 'jpeg', sizeBytes: out.length }
    if (needsJpeg) warnings.push(`Converted to JPG for ${PLATFORM_META[platform].label} compatibility.`)
    if (tooBig) warnings.push(`Compressed to ${(out.length / 1024).toFixed(0)} KB (platform limit ${(limit / 1024 / 1024).toFixed(1)} MB).`)
  }

  return { buffer: out, mimeType: outMime, meta: outMeta, warnings }
}

/** Validate a primary media image upload. */
export async function validateImageUpload(buffer: Buffer, mimeType: string): Promise<ValidationResult> {
  const warnings: string[] = []
  if (!(IMAGE_ALLOWED_MIME as readonly string[]).includes(mimeType)) {
    return { ok: false, error: `Unsupported image type "${mimeType}".`, guidance: 'Use JPG, PNG, WEBP or GIF.', warnings }
  }
  if (buffer.length > IMAGE_MAX_BYTES) {
    return { ok: false, error: `Image exceeds the ${IMAGE_MAX_BYTES / 1024 / 1024} MB upload limit.`, guidance: 'Compress or resize the image first.', warnings }
  }
  const meta = await inspect(buffer)
  if (!meta) return { ok: false, error: 'File is not a readable image.', warnings }
  return { ok: true, meta, warnings }
}
