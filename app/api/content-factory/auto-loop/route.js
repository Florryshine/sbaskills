// app/api/content-factory/auto-loop/route.js
//
// THE MISSING PIECE: every other content-factory route requires a human to
// open the admin panel, pick a knowledge asset, and click generate. This
// route is what makes posting *consistent* instead of bursty — a daily cron
// hit turns it into "pick fresh topics -> generate -> (optionally approve)
// -> schedule at good times", so a human's job becomes reviewing a queue
// instead of starting from zero every day.
//
// Two modes, controlled by the LOOP_MODE env var:
//   'review' (default) - generates + drafts land in content_assets as
//     status='draft', same as manual generation. Nothing gets scheduled or
//     published without a human approving in /admin/social-engine first.
//     Safest option while you're still trusting the output quality.
//   'auto' - generates AND auto-approves AND auto-schedules publish_jobs at
//     the WAT posting windows below. Fully hands-off. Only flip to this once
//     you've reviewed a week or two of 'review'-mode output and you're happy
//     with it unsupervised.
//
// Runs once/day (Vercel Hobby-compatible - see vercel.json). The actual
// publishing at the scheduled times is handled separately by the existing
// /api/publish/cron-worker (every 15 min via GitHub Actions on Hobby, or
// vercel.json cron on Pro) - this route only ever creates/schedules jobs,
// it never calls a platform API directly.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { runContentFactory } from '@/lib/content-factory';

// The four platforms this month's growth push is about. LinkedIn is
// intentionally excluded from weekend runs further down - its audience
// (educators/investors) is a weekday-office audience, not a weekend one.
const TARGET_PLATFORMS = ['facebook', 'tiktok', 'youtube', 'linkedin'];

// How many *new* topics to pull into the loop per day. Keep this small and
// let the review queue build confidence before raising it - going from 0 to
// "8 topics x 4 platforms" in one day is how a founder ends up with 30
// unreviewed drafts and stops trusting the system.
const TOPICS_PER_RUN = parseInt(process.env.LOOP_TOPICS_PER_RUN || '2', 10);

// Don't reuse a topic for social content within this many days, so the
// same JAMB concept doesn't repeat across FB/TikTok/YouTube every week.
const COOLDOWN_DAYS = parseInt(process.env.LOOP_COOLDOWN_DAYS || '21', 10);

// Posting windows tuned for a Nigerian student/education audience, stored
// as WAT (UTC+1) hours -> converted to UTC below since scheduled_at is
// always stored/compared in UTC. Adjust these once you have real
// engagement-by-hour data from each platform's own analytics.
const POSTING_WINDOWS_WAT = {
  facebook: 7.5,  // 7:30am WAT - before school/commute scrolling
  tiktok: 16,     // 4:00pm WAT - after school, peak Gen-Z scroll time
  youtube: 18,    // 6:00pm WAT - evening watch time
  linkedin: 9,    // 9:00am WAT - weekday office-open scrolling
};

function watHourToUtcIso(hourWat, dayOffset = 0) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset));
  const utcHour = hourWat - 1; // WAT is UTC+1
  d.setUTCHours(Math.floor(utcHour), Math.round((utcHour % 1) * 60), 0, 0);
  // If that time already passed today (UTC "now"), push to tomorrow so we
  // never schedule a job in the past.
  if (d.getTime() <= Date.now()) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function isWeekendUtc(iso) {
  const day = new Date(iso).getUTCDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

/**
 * Picks up to `limit` knowledge_assets that either have never had social
 * content generated for them, or haven't in the last COOLDOWN_DAYS - so the
 * loop keeps working through the full topic pool instead of hammering the
 * same handful of assets every run.
 */
async function pickFreshTopics(supabase, limit) {
  const cutoff = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Assets that DO have a recent social content_assets row - excluded below.
  const { data: recentlyUsed, error: recentError } = await supabase
    .from('content_assets')
    .select('knowledge_asset_id')
    .in('platform', TARGET_PLATFORMS)
    .gte('created_at', cutoff);
  if (recentError) throw recentError;

  const excludeIds = [...new Set((recentlyUsed || []).map((r) => r.knowledge_asset_id))];

  let query = supabase
    .from('knowledge_assets')
    .select('id, keyword, subject')
    .order('created_at', { ascending: true }) // oldest-untouched-first, simple FIFO through the pool
    .limit(limit + excludeIds.length); // overselect, filter below, in case the "not in" list is large

  const { data: candidates, error: candError } = await query;
  if (candError) throw candError;

  const excludeSet = new Set(excludeIds);
  return (candidates || []).filter((a) => !excludeSet.has(a.id)).slice(0, limit);
}

async function autoApproveAndSchedule(supabase, contentAssetId, platform) {
  const { data: channel } = await supabase
    .from('social_channels_v2')
    .select('id')
    .eq('platform', platform)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!channel) {
    return { ok: false, reason: `No active ${platform} channel connected - skipped auto-schedule, draft still saved` };
  }

  await supabase.from('content_assets').update({ status: 'approved' }).eq('id', contentAssetId);

  const { data: job, error: jobError } = await supabase
    .from('publish_jobs')
    .insert({ content_asset_id: contentAssetId, channel_id: channel.id, status: 'queued' })
    .select()
    .single();
  if (jobError) return { ok: false, reason: jobError.message };

  let scheduledAt = watHourToUtcIso(POSTING_WINDOWS_WAT[platform]);
  if (platform === 'linkedin') {
    // Skip forward past any weekend slot - LinkedIn audience is weekday-only.
    let guard = 0;
    while (isWeekendUtc(scheduledAt) && guard < 7) {
      scheduledAt = watHourToUtcIso(POSTING_WINDOWS_WAT[platform], guard + 1);
      guard += 1;
    }
  }

  const { error: schedError } = await supabase
    .from('publish_jobs')
    .update({ status: 'scheduled', scheduled_at: scheduledAt })
    .eq('id', job.id);
  if (schedError) return { ok: false, reason: schedError.message };

  return { ok: true, scheduledAt };
}

export async function GET(req) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const mode = process.env.LOOP_MODE === 'auto' ? 'auto' : 'review';
  const supabase = createAdminClient();
  const report = { mode, topics: [] };

  try {
    const topics = await pickFreshTopics(supabase, TOPICS_PER_RUN);

    if (topics.length === 0) {
      return NextResponse.json({
        ...report,
        message: `No fresh topics available (all knowledge_assets used within the last ${COOLDOWN_DAYS} days). Add more knowledge_assets, or lower LOOP_COOLDOWN_DAYS.`,
      });
    }

    for (const topic of topics) {
      const topicReport = { knowledgeAssetId: topic.id, keyword: topic.keyword, generated: [], scheduled: [] };
      try {
        const results = await runContentFactory(topic.id, TARGET_PLATFORMS);
        topicReport.generated = results.succeeded;
        topicReport.failed = results.failed;

        if (mode === 'auto') {
          for (const success of results.succeeded) {
            for (const contentAssetId of success.ids) {
              const outcome = await autoApproveAndSchedule(supabase, contentAssetId, success.platform);
              topicReport.scheduled.push({ contentAssetId, platform: success.platform, ...outcome });
            }
          }
        }
      } catch (err) {
        topicReport.error = err.message;
      }
      report.topics.push(topicReport);
    }

    return NextResponse.json(report);
  } catch (err) {
    console.error('Content loop error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
