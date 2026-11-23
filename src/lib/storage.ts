// SBA Social Publishing — storage layer.
//
// Two drivers behind one interface:
// - LocalDriver: writes to public/uploads (sandbox / self-hosted fallback).
// - SupabaseDriver: activates automatically when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//   are set (production). Uses the Supabase Storage REST API directly via fetch —
//   NO new dependencies introduced.
//
// Media binaries are NEVER stored in database rows — only bucket + storagePath +
// publicUrl are persisted in `media_files` (as the existing SBA architecture does).

import { promises as fs } from 'fs'
import path from 'path'

export interface PutOptions {
  bucket: string
  path: string // path inside the bucket, e.g. "thumbnails/<assetId>/<uuid>.jpg"
  contentType: string
}

export interface PutResult {
  bucket: string
  storagePath: string
  publicUrl: string
  sizeBytes: number
}

export interface StorageDriver {
  readonly name: 'local' | 'supabase'
  put(buffer: Buffer, opts: PutOptions): Promise<PutResult>
  remove(bucket: string, storagePath: string): Promise<void>
  read(bucket: string, storagePath: string): Promise<Buffer>
  /** Absolute URL when possible; app-relative for the local driver. */
  getPublicUrl(bucket: string, storagePath: string): string
  /** True if publicUrl points to a location the platform servers can fetch. */
  isPubliclyReachable(publicUrl: string): boolean
}

// ---------------------------------------------------------------------------
// Local driver
// ---------------------------------------------------------------------------
const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads')

class LocalDriver implements StorageDriver {
  readonly name = 'local' as const

  private filePath(bucket: string, storagePath: string): string {
    // sanitize: no traversal outside UPLOAD_ROOT
    const safe = path.normalize(storagePath).replace(/^(\.\.[/\\])+/, '')
    return path.join(UPLOAD_ROOT, bucket, safe)
  }

  async put(buffer: Buffer, opts: PutOptions): Promise<PutResult> {
    const target = this.filePath(opts.bucket, opts.path)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, buffer)
    return {
      bucket: opts.bucket,
      storagePath: opts.path,
      publicUrl: this.getPublicUrl(opts.bucket, opts.path),
      sizeBytes: buffer.length,
    }
  }

  async remove(bucket: string, storagePath: string): Promise<void> {
    try {
      await fs.unlink(this.filePath(bucket, storagePath))
    } catch {
      // already gone — removal is idempotent
    }
  }

  async read(bucket: string, storagePath: string): Promise<Buffer> {
    return fs.readFile(this.filePath(bucket, storagePath))
  }

  getPublicUrl(bucket: string, storagePath: string): string {
    return `/uploads/${bucket}/${storagePath}`
  }

  isPubliclyReachable(publicUrl: string): boolean {
    return /^https?:\/\//i.test(publicUrl)
  }
}

// ---------------------------------------------------------------------------
// Supabase driver (production) — REST API, no SDK dependency
// ---------------------------------------------------------------------------
class SupabaseDriver implements StorageDriver {
  readonly name = 'supabase' as const
  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceKey}`,
      apikey: this.serviceKey,
      ...extra,
    }
  }

  async put(buffer: Buffer, opts: PutOptions): Promise<PutResult> {
    const url = `${this.baseUrl}/storage/v1/object/${opts.bucket}/${encodeURI(opts.path)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': opts.contentType, 'x-upsert': 'true' }),
      body: new Uint8Array(buffer),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Supabase storage upload failed (${res.status}): ${text.slice(0, 300)}`)
    }
    return {
      bucket: opts.bucket,
      storagePath: opts.path,
      publicUrl: this.getPublicUrl(opts.bucket, opts.path),
      sizeBytes: buffer.length,
    }
  }

  async remove(bucket: string, storagePath: string): Promise<void> {
    const url = `${this.baseUrl}/storage/v1/object/${bucket}/${encodeURI(storagePath)}`
    await fetch(url, { method: 'DELETE', headers: this.headers() }).catch(() => undefined)
  }

  async read(bucket: string, storagePath: string): Promise<Buffer> {
    const url = `${this.baseUrl}/storage/v1/object/${bucket}/${encodeURI(storagePath)}`
    const res = await fetch(url, { headers: this.headers() })
    if (!res.ok) throw new Error(`Supabase storage read failed (${res.status}) for ${bucket}/${storagePath}`)
    return Buffer.from(await res.arrayBuffer())
  }

  getPublicUrl(bucket: string, storagePath: string): string {
    return `${this.baseUrl}/storage/v1/object/public/${bucket}/${storagePath}`
  }

  isPubliclyReachable(publicUrl: string): boolean {
    return /^https:\/\//i.test(publicUrl)
  }
}

export function getStorage(): StorageDriver {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && supabaseKey) {
    return new SupabaseDriver(supabaseUrl.replace(/\/+$/, ''), supabaseKey)
  }
  return new LocalDriver()
}

export const MEDIA_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'media'

/** Build a deterministic, collision-free storage path. */
export function mediaPath(kind: 'primary' | 'thumbnail', assetId: string | null, filename: string): string {
  const id = assetId || 'unattached'
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  return `${kind}/${id}/${Date.now()}-${safeName}`
}
