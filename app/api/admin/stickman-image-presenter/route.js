import { NextResponse } from 'next/server';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';
import { planImagePresenter, acquireImagePresenterAssets, validateImagePresenterProject } from '../../../../stickman-engine/src/image-presenter';

export const runtime = 'nodejs';
export const maxDuration = 60;
const BUCKET = 'lesson-videos';

export async function POST(req) {
  const { user, response } = await requireAdminApi();
  if (response) return response;
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }

  try {
    const action = body?.action || 'plan';
    const planned = planImagePresenter({
      topic: String(body?.topic || '').slice(0, 300),
      script: String(body?.script || '').slice(0, 12000),
      mode: body?.mode || 'auto',
      aspectRatio: body?.aspectRatio || '9:16',
      presenterId: 'prof',
      maxScenes: Math.max(1, Math.min(12, Number(body?.maxScenes) || 6)),
    });
    const plan = action === 'acquire' && body?.plan && Array.isArray(body.plan.scenes) ? body.plan : planned;
    if (action === 'plan') return NextResponse.json({ success: true, plan: planned });

    if (action === 'enqueue') {
      const project = body?.project;
      const validation = validateImagePresenterProject(project);
      if (!validation.valid) return NextResponse.json({ error: 'Image Presenter project is invalid.', issues: validation.issues }, { status: 400 });
      const admin = createAdminClient();
      const subject = ['biology', 'chemistry', 'physics', 'mathematics', 'general'].includes(body?.subject) ? body.subject : 'general';
      const { data: existing, error: lookupError } = await admin.from('knowledge_assets').select('id').eq('keyword', String(project.title).slice(0, 200)).eq('subject', subject).limit(1);
      if (lookupError) throw new Error('Knowledge Asset lookup failed: ' + lookupError.message);
      let knowledgeAssetId = existing?.[0]?.id;
      if (!knowledgeAssetId) {
        const { data: created, error: createError } = await admin.from('knowledge_assets').insert({ keyword: String(project.title).slice(0, 200), topic_type: subject === 'general' ? 'creator_video' : 'curriculum_topic', subject, summary: 'Image Presenter lesson: ' + project.title, raw_content: JSON.stringify(project).slice(0, 12000), learning_objectives: [], key_concepts: project.scenes.map(scene => scene.title).slice(0, 20), definitions: [], examples: [], facts: [], common_mistakes: [], sub_topics: [], status: 'draft', source: 'stickman_image_presenter' }).select('id').single();
        if (createError) throw new Error('Knowledge Asset creation failed: ' + createError.message);
        knowledgeAssetId = created.id;
      }
      const { data: job, error: jobError } = await admin.from('stickman_jobs').insert({
        title: String(project.title).slice(0, 200), topic: String(project.subject || project.title).slice(0, 300), subject,
        knowledge_asset_id: knowledgeAssetId, auto_publish: body?.autoPublish !== false,
        image_presenter_project: project, script_text: '', status: 'queued', stage: 'queued',
        stage_message: 'Waiting for Stickman worker to narrate and render Image Presenter project',
        stage_updated_at: new Date().toISOString(), created_by: user?.id ?? null,
      }).select('id, title, status, stage').single();
      if (jobError) {
        if (/image_presenter_project|column/i.test(jobError.message)) throw new Error('Image Presenter database migration is not applied yet. Apply the new Phase 7 migration in Supabase.');
        throw new Error('Could not queue Image Presenter render: ' + jobError.message);
      }
      return NextResponse.json({ success: true, job }, { status: 201 });
    }
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
