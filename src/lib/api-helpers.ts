// SBA Social Publishing — API helpers: consistent JSON envelopes + error guarding.

import { NextResponse } from 'next/server'

export function ok<T>(data: T, init?: number): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: init || 200 })
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status })
}

export async function guard(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api]', message)
    return fail(message, 500)
  }
}

export function zodMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'issues' in err) {
    const issues = (err as { issues: { message: string; path: (string | number)[] }[] }).issues
    return issues.map((i) => `${i.path.join('.') || 'field'}: ${i.message}`).join('; ')
  }
  return err instanceof Error ? err.message : String(err)
}
