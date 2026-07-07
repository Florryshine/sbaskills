import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request) {
  try {
    const { 
      knowledgeAssetId, 
      engines = [] // ['blog', 'podcast', 'quiz', 'boss_battle', 'flashcard', 'study_note', 'social']
    } = await request.json();

    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }

    if (!engines || engines.length === 0) {
      return NextResponse.json({ error: 'At least one engine must be selected' }, { status: 400 });
    }

    // 1. Fetch the knowledge asset to get the keyword
    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('keyword')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    // 2. Create the generation job
    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .insert({
        knowledge_asset_id: knowledgeAssetId,
        keyword: asset.keyword,
        overall_status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    // 3. Define the API endpoints for each engine
    const engineEndpoints = {
      quiz: '/api/engines/quiz',
      boss_battle: '/api/engines/boss-battle',
      flashcard: '/api/engines/flashcards',
      study_note: '/api/engines/study-notes',
      social: '/api/engines/social',
    };

    // 4. Run each selected engine in parallel
    const results = await Promise.allSettled(
      engines.map(async (engine) => {
        // Special handling for blog (uses existing generate route)
        if (engine === 'blog') {
          // You'd call your existing blog generator here
          return { engine, status: 'skipped', message: 'Blog generation not implemented in this route' };
        }

        // Special handling for podcast
        if (engine === 'podcast') {
          return { engine, status: 'skipped', message: 'Podcast generation not implemented in this route' };
        }

        // For other engines, call the API route
        const endpoint = engineEndpoints[engine];
        if (!endpoint) {
          return { engine, status: 'failed', error: `Unknown engine: ${engine}` };
        }

        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ knowledgeAssetId }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
          }

          const data = await response.json();
          return { engine, status: 'completed', data };
        } catch (error) {
          return { engine, status: 'failed', error: error.message };
        }
      })
    );

    // 5. Update the job with results
    const completedEngines = results.filter(r => r.status === 'fulfilled' && r.value.status === 'completed');
    const failedEngines = results.filter(r => r.status === 'rejected' || r.value.status === 'failed');
    const skippedEngines = results.filter(r => r.status === 'fulfilled' && r.value.status === 'skipped');

    // Build the job item records
    const jobItems = results.map((result, index) => {
      const engine = engines[index];
      let status = 'pending';
      let error = null;

      if (result.status === 'rejected') {
        status = 'failed';
        error = result.reason?.message || 'Unknown error';
      } else if (result.value.status === 'completed') {
        status = 'completed';
      } else if (result.value.status === 'failed') {
        status = 'failed';
        error = result.value.error || 'Unknown error';
      } else if (result.value.status === 'skipped') {
        status = 'skipped';
      }

      return {
        generation_job_id: job.id,
        engine: engine,
        status: status,
        started_at: new Date().toISOString(),
        finished_at: status !== 'pending' ? new Date().toISOString() : null,
        error: error,
      };
    });

    // Insert job items – we're using the service role client, so RLS is bypassed
    const { error: itemsError } = await supabase
      .from('generation_job_items')
      .insert(jobItems);

    if (itemsError) {
      console.error('Failed to insert job items:', itemsError);
    }

    // 6. Update overall job status
    let overallStatus = 'completed';
    if (failedEngines.length > 0 && completedEngines.length === 0) {
      overallStatus = 'failed';
    } else if (failedEngines.length > 0) {
      overallStatus = 'completed_with_errors';
    }

    await supabase
      .from('generation_jobs')
      .update({
        overall_status: overallStatus,
        finished_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      summary: {
        total: engines.length,
        completed: completedEngines.length,
        failed: failedEngines.length,
        skipped: skippedEngines.length,
      },
      results: results.map(r => {
        if (r.status === 'rejected') {
          return { engine: engines[results.indexOf(r)], status: 'failed', error: r.reason?.message };
        }
        return r.value;
      }),
    });
  } catch (error) {
    console.error('❌ Generation job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}