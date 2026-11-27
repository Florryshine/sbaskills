import { NextResponse } from 'next/server';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';
import { planImagePresenter, acquireImagePresenterAssets } from '../../../../stickman-engine/src/image-presenter';

export const runtime = 'nodejs';
export const maxDuration = 60;
const BUCKET = 'lesson-videos';

export async function POST(req) {
  const { response } = await requireAdminApi();
  if (response) return response;
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }

  try {
    const action = body?.action || 'plan';
    const plan = planImagePresenter({
      topic: String(body?.topic || '').slice(0, 300),
      script: String(body?.script || '').slice(0, 12000),
      mode: body?.mode || 'auto',
      aspectRatio: body?.aspectRatio || '9:16',
      presenterId: 'prof',
      maxScenes: Math.max(1, Math.min(12, Number(body?.maxScenes) || 6)),
    });
    if (action === 'plan') return NextResponse.json({ success: true, plan });

    if (action !== 'acquire') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    const workDir = await mkdtemp(join(tmpdir(), 'sba-image-presenter-'));
    const uploaded = [];
    try {
      const acquired = await acquireImagePresenterAssets(plan, {
        publicDir: workDir,
        aspectRatio: plan.aspectRatio,
        candidatesPerNeed: 8,
      });
      const admin = createAdminClient();
      const assets = {};
      for (const [needId, asset] of Object.entries(acquired.assets)) {
        const bytes = await readFile(join(workDir, asset.localFile));
        const storagePath = `stickman-image-presenter/${randomUUID()}/${basename(asset.localFile)}`;
        const { error } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
          contentType: 'image/jpeg', upsert: false,
        });
        if (error) throw new Error(`Image upload failed: ${error.message}`);
        uploaded.push(storagePath);
        const { data } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
        assets[needId] = { ...asset, mediaUrl: data.publicUrl, localFile: storagePath, storageBucket: BUCKET };
      }
      return NextResponse.json({ success: true, plan, assets, warnings: acquired.warnings });
    } catch (error) {
      if (uploaded.length) await createAdminClient().storage.from(BUCKET).remove(uploaded).catch(() => {});
      throw error;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Image Presenter request failed.' }, { status: 400 });
  }
}
