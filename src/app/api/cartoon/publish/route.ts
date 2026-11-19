import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/cartoon/server/admin";

export const maxDuration = 60;

// GET: publishing dashboard data (assets + jobs joined with channels)
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const assets = await db.contentAsset.findMany({
    where: { assetType: "cartoon_video" },
    include: {
      mediaFiles: true,
      project: { select: { id: true, orientation: true, title: true, durationSeconds: true } },
      publishJobs: { include: { channel: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const channels = await db.socialChannel.findMany({ orderBy: { platform: "asc" } });
  return NextResponse.json({ assets, channels });
}

// POST actions:
//  { action: "approve", contentAssetId, channelIds[] }  -> content_asset approved + publish_jobs queued
//  { action: "publish", jobId }                          -> execute one publish job now
//  { action: "cancel", jobId }
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "approve") {
    const { contentAssetId, channelIds } = body;
    const asset = await db.contentAsset.findUnique({ where: { id: contentAssetId }, include: { mediaFiles: true } });
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    const primary = asset.mediaFiles.find((m) => m.role === "primary" && m.mediaType === "video");
    if (!primary || !primary.url) {
      return NextResponse.json({ error: "Refusing to approve: the actual video file for this asset does not exist." }, { status: 409 });
    }
    if (!asset.projectId) {
      return NextResponse.json({ error: "Refusing to approve: asset has no linked cartoon project." }, { status: 409 });
    }
    const project = await db.cartoonProject.findUnique({ where: { id: asset.projectId } });
    if (!project || !project.videoPath) {
      return NextResponse.json({ error: "Refusing to approve: the rendered video file is missing." }, { status: 409 });
    }
    if (channelIds.length === 0) return NextResponse.json({ error: "Pick at least one channel" }, { status: 400 });
    const channels = await db.socialChannel.findMany({ where: { id: { in: channelIds }, isActive: true } });
    if (channels.length === 0) return NextResponse.json({ error: "No active channels found" }, { status: 400 });

    await db.contentAsset.update({ where: { id: contentAssetId }, data: { status: "approved" } });
    const jobs = [];
    for (const ch of channels) {
      const existing = await db.publishJob.findFirst({
        where: { contentAssetId, channelId: ch.id, status: { in: ["queued", "publishing", "published"] } },
      });
      if (existing) { jobs.push(existing); continue; }
      jobs.push(await db.publishJob.create({ data: { contentAssetId, channelId: ch.id, status: "queued" } }));
    }
    return NextResponse.json({ ok: true, jobs });
  }

  if (action === "publish") {
    const job = await db.publishJob.findUnique({ where: { id: body.jobId }, include: { channel: true, contentAsset: { include: { mediaFiles: true } } } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (job.status === "published") return NextResponse.json({ ok: true, job });
    if (job.attemptCount >= job.maxAttempts) {
      return NextResponse.json({ error: "Job exceeded max attempts" }, { status: 409 });
    }
    const primary = job.contentAsset.mediaFiles.find((m) => m.role === "primary" && m.mediaType === "video");
    if (!primary) {
      await db.publishJob.update({ where: { id: job.id }, data: { status: "failed", lastError: "No primary video file on asset", attemptCount: job.attemptCount + 1 } });
      return NextResponse.json({ error: "No video file on asset — job failed" }, { status: 409 });
    }

    await db.publishJob.update({ where: { id: job.id }, data: { status: "publishing", attemptCount: job.attemptCount + 1 } });
    await db.contentAsset.update({ where: { id: job.contentAssetId }, data: { status: "publishing" } });

    try {
      // In the sbaskills port this call is:
      //   const { executePublishJob } = await import("@/lib/publish-engine");
      //   await executePublishJob(job.id);
      // Here (sandbox, no real OAuth credentials) we run a faithful simulation
      // implementing the same adapter contract and audit trail.
      const simulated = job.channel.simulated === true;
      if (!simulated) {
        throw new Error("Real channel credentials are not configured in this sandbox. Connect channels in production to publish for real.");
      }
      const externalId = `${job.channel.platform}-${Date.now().toString(36)}`;
      const externalUrl = `https://social.example/${job.channel.platform}/${externalId}`;
      const updated = await db.publishJob.update({
        where: { id: job.id },
        data: { status: "published", publishedAt: new Date(), externalPostId: externalId, externalUrl },
      });
      await db.publishHistory.create({ data: { contentAssetId: job.contentAssetId, platform: job.channel.platform, status: "success", response: JSON.stringify({ simulated: true, videoUrl: primary.url }) } });
      const remaining = await db.publishJob.findMany({ where: { contentAssetId: job.contentAssetId } });
      const allDone = remaining.every((j) => j.status === "published" || j.status === "failed" || j.status === "cancelled");
      if (allDone) {
        const anyPublished = remaining.some((j) => j.status === "published");
        await db.contentAsset.update({ where: { id: job.contentAssetId }, data: { status: anyPublished ? "published" : "failed" } });
      } else {
        await db.contentAsset.update({ where: { id: job.contentAssetId }, data: { status: "approved" } });
      }
      return NextResponse.json({ ok: true, job: updated });
    } catch (e) {
      const attempt = job.attemptCount + 1;
      const failed = attempt >= job.maxAttempts;
      const updated = await db.publishJob.update({
        where: { id: job.id },
        data: { status: failed ? "failed" : "queued", lastError: e instanceof Error ? e.message.slice(0, 300) : String(e), attemptCount: attempt },
      });
      await db.publishHistory.create({ data: { contentAssetId: job.contentAssetId, platform: job.channel.platform, status: "error", error: updated.lastError } });
      return NextResponse.json({ error: updated.lastError, job: updated }, { status: failed ? 409 : 500 });
    }
  }

  if (action === "cancel") {
    const job = await db.publishJob.update({ where: { id: body.jobId }, data: { status: "cancelled" } }).catch(() => null);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ ok: true, job });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
