// Pipeline orchestrator — mirrors sbaskills whiteboard_jobs patterns:
//   * stage tracking (scripting -> narrating -> ready / rendering -> done)
//   * attempt caps + poison-job handling
//   * render claim token (prevents duplicate render jobs)
//   * stale job recovery
//   * idempotent content_assets/media_files save (recovery key)
import { db } from "@/lib/db";
import { generateStoryboard, validateStoryboard, type KALike } from "./storyboard";
import { synthesizeScene, deleteProjectAudio, type NarrationResult } from "./narration";
import { runRenderJob, SIZE_BY_ORIENTATION } from "./renderJob";
import { discoverForScenes } from "@/assets/server/discovery";
import { assetFileExists } from "@/assets/server/storage";
import type { CartoonProjectProps, Storyboard, Orientation, StoryboardScene, SceneAssetProp } from "../engine/types";

const RENDER_MAX_ATTEMPTS = 3;
const RENDER_STALE_MS = 25 * 60 * 1000;

export async function setStage(projectId: string, stage: string, message: string, progress?: number, extra?: Record<string, unknown>) {
  await db.cartoonProject.update({
    where: { id: projectId },
    data: { stage, stageMessage: message.slice(0, 300), ...(progress !== undefined ? { progress } : {}), ...extra },
  });
}

// ---------------- script + narration pipeline ----------------
export async function runScriptPipeline(projectId: string) {
  try {
    const project = await db.cartoonProject.findUnique({ where: { id: projectId }, include: { knowledgeAsset: true } });
    if (!project) return;

    // 1) storyboard
    await setStage(projectId, "scripting", "Writing the cartoon storyboard...", 0.05);
    let spec: Storyboard;
    let note = "";
    if (project.knowledgeAsset) {
      const ka: KALike = {
        keyword: project.knowledgeAsset.keyword,
        subject: project.knowledgeAsset.subject,
        summary: project.knowledgeAsset.summary,
        subTopics: project.knowledgeAsset.subTopics,
        keyConcepts: project.knowledgeAsset.keyConcepts,
        definitions: project.knowledgeAsset.definitions,
        facts: project.knowledgeAsset.facts,
      };
      const r = await generateStoryboard(ka, project.customTopic || undefined);
      spec = r.spec;
      note = r.usedFallback ? " (template storyboard — LLM unavailable)" : "";
    } else {
      const topic = project.customTopic || project.title;
      const pseudoKa: KALike = { keyword: topic, subject: "General", summary: topic };
      const r = await generateStoryboard(pseudoKa, topic);
      spec = r.spec;
      note = r.usedFallback ? " (template storyboard — LLM unavailable)" : "";
    }
    await db.cartoonProject.update({
      where: { id: projectId },
      data: {
        spec: JSON.stringify(spec),
        rawScript: JSON.stringify(spec),
        title: spec.title || project.title,
        status: "narrating",
      },
    });

    // 1b) Shared Visual Asset Library: auto-discover scene assets
    // (library reuse first, then local catalog SVG generation — no network,
    // no LLM, no stock during automation; admin can refine per scene later)
    try {
      await setStage(projectId, "scripting", "Choosing visuals from the asset library...", 0.22);
      const subject = project.knowledgeAsset?.subject || "General";
      const attachments = await discoverForScenes(
        spec.scenes.map((s) => ({
          id: s.id, heading: s.heading, narration: s.narration,
          visualConcept: s.visualConcept, layout: s.layout,
        })),
        { subject, maxPerScene: 2 },
      );
      const byScene = new Map(attachments.map((a) => [a.sceneId, a.assets]));
      spec.scenes = spec.scenes.map((s) => ({
        ...s,
        customAssets: byScene.get(s.id) ?? [],
      }));
      // persist the enriched spec
      await db.cartoonProject.update({
        where: { id: projectId },
        data: { spec: JSON.stringify(spec), rawScript: JSON.stringify(spec) },
      });
    } catch {
      // asset enrichment is an enhancement — never block production
    }

    await setStage(projectId, "narration", `Storyboard ready with ${spec.scenes.length} scenes${note}. Generating narration...`, 0.3);

    // 2) narration for every scene
    await narrateProjectScenes(projectId, spec.scenes.map((s) => s.id));
    await db.cartoonProject.update({ where: { id: projectId }, data: { status: "cast_ready", progress: 1 } });
    await setStage(projectId, "done", "Script and narration ready. Review, then render.", 1);
  } catch (e) {
    await db.cartoonProject.update({
      where: { id: projectId },
      data: { status: "failed", error: e instanceof Error ? e.message.slice(0, 500) : String(e) },
    });
    await setStage(projectId, "failed", `Pipeline failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown"}`);
  }
}

/** (Re)narrate given scenes of a project; keeps other scenes untouched. */
export async function narrateProjectScenes(projectId: string, sceneIds: string[]): Promise<Record<string, NarrationResult>> {
  const project = await db.cartoonProject.findUnique({ where: { id: projectId } });
  if (!project || !project.spec) throw new Error("project has no spec");
  const spec = JSON.parse(project.spec) as Storyboard;
  const existing: Record<string, NarrationResult> = project.narration ? JSON.parse(project.narration) : {};

  const todo = spec.scenes.filter((s) => sceneIds.includes(s.id));
  for (let i = 0; i < todo.length; i++) {
    const scene = todo[i];
    await setStage(projectId, "narration", `Narrating scene ${i + 1}/${todo.length}: "${scene.heading}"`, 0.3 + (0.6 * i) / Math.max(1, todo.length));
    const speaker = scene.cast.find((c) => c.speaking);
    // slight per-character speed variation = distinct voices (free, no extra TTS)
    const voiceSeed = (speaker?.ref || "a").split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const speed = 1.0 + ((voiceSeed % 5) - 2) * 0.02;
    // gentle pacing: small pause between scenes avoids provider rate limits
    if (i > 0) await new Promise((r) => setTimeout(r, 1600));
    const result = await synthesizeScene({ projectId, sceneId: scene.id, text: scene.narration, speed });
    existing[scene.id] = result;
    await db.cartoonProject.update({ where: { id: projectId }, data: { narration: JSON.stringify(existing) } });
  }
  return existing;
}

// ---------------- render ----------------
export async function startRender(projectId: string): Promise<{ ok: boolean; message: string }> {
  const project = await db.cartoonProject.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, message: "Project not found" };
  if (!project.spec) return { ok: false, message: "No script yet — generate the script first." };

  if (project.status === "rendering") {
    const started = project.renderStartedAt?.getTime() ?? 0;
    if (Date.now() - started < RENDER_STALE_MS) {
      return { ok: false, message: "A render is already running for this project." };
    }
    // stale render — reclaim
  }
  if (project.attemptCount >= RENDER_MAX_ATTEMPTS && project.status === "failed" && project.stage === "render") {
    return { ok: false, message: `Render failed ${project.attemptCount} times. Download the error details or re-generate the script first.` };
  }

  const token = `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.cartoonProject.update({
    where: { id: projectId },
    data: {
      status: "rendering",
      stage: "render",
      stageMessage: "Queued for rendering...",
      progress: 0,
      renderJobToken: token,
      renderStartedAt: new Date(),
      heartbeatAt: new Date(),
      attemptCount: project.status === "failed" ? project.attemptCount + 1 : project.attemptCount,
      error: null,
    },
  });

  // fire-and-forget (sandbox server is persistent; in sbaskills this becomes the worker loop)
  void doRender(projectId, token).catch(async (e) => {
    await db.cartoonProject.update({
      where: { id: projectId },
      data: {
        status: "failed",
        error: e instanceof Error ? e.message.slice(0, 800) : String(e),
        stageMessage: `Render failed: ${e instanceof Error ? e.message.slice(0, 180) : "unknown"}`,
      },
    });
  });
  return { ok: true, message: "Render started" };
}

async function doRender(projectId: string, token: string) {
  const project = await db.cartoonProject.findUnique({ where: { id: projectId } });
  if (!project || !project.spec || project.renderJobToken !== token) return; // superseded
  const spec = JSON.parse(project.spec) as Storyboard;
  const narration = (project.narration ? JSON.parse(project.narration) : {}) as CartoonProjectProps["narration"];

  // integrity pass: drop library assets whose files vanished since attach
  // (a deleted asset must never stall a render)
  spec.scenes = spec.scenes.map((s: StoryboardScene) => ({
    ...s,
    customAssets: (s.customAssets || []).filter(
      (a: SceneAssetProp) => !!a.url && assetFileExists(a.url.replace(/^\//, "")),
    ),
  }));

  const props: CartoonProjectProps = {
    spec,
    narration,
    orientation: (project.orientation as Orientation) || "9:16",
    brandLine: "Shiney Brain Academy",
    subtitles: project.subtitles,
  };

  await setStage(projectId, "render", "Starting the render worker...", 0.02, { heartbeatAt: new Date() });
  const result = await runRenderJob({
    projectId,
    props,
    onProgress: (p) => {
      void db.cartoonProject.update({
        where: { id: projectId },
        data: {
          progress: p.progress,
          stageMessage: p.message || "Rendering...",
          heartbeatAt: new Date(),
        },
      }).catch(() => {});
    },
  });
  if (!result.ok || !result.videoPath) {
    throw new Error(result.error || "Render worker failed without an error message");
  }

  // guard: superseded while rendering?
  const fresh = await db.cartoonProject.findUnique({ where: { id: projectId } });
  if (!fresh || fresh.renderJobToken !== token) return;

  await setStage(projectId, "saving", "Saving video and registering with Social Engine...", 0.94);
  const publicUrl = `/api/cartoon/video/${projectId}.mp4`;
  await db.cartoonProject.update({
    where: { id: projectId },
    data: {
      status: "ready",
      stage: "done",
      stageMessage: `Video ready (${(result.sizeBytes / 1024 / 1024).toFixed(1)} MB, ${result.durationSeconds}s)`,
      progress: 1,
      videoPath: result.videoPath,
      videoUrl: publicUrl,
      videoSizeBytes: result.sizeBytes,
      durationSeconds: result.durationSeconds,
      renderJobToken: null,
      error: null,
    },
  });

  // idempotent artifact registration (content_assets + media_files contract)
  await registerWithPublishing(projectId, {
    spec,
    videoUrl: publicUrl,
    durationSeconds: result.durationSeconds,
    sizeBytes: result.sizeBytes,
  });
}

async function registerWithPublishing(projectId: string, info: {
  spec: Storyboard; videoUrl: string; durationSeconds: number; sizeBytes: number;
}) {
  const project = await db.cartoonProject.findUnique({ where: { id: projectId } });
  if (!project) return;
  const recoveryKey = projectId;
  const existing = await db.contentAsset.findFirst({
    where: { assetType: "cartoon_video", metadata: { contains: recoveryKey } },
    include: { mediaFiles: true },
  });

  const metadata = JSON.stringify({
    engine: "cartoon-studio",
    cartoon_project_id: recoveryKey,
    video_url: info.videoUrl,
    durationSeconds: info.durationSeconds,
    mime: "video/mp4",
    title: info.spec.title,
    description: info.spec.description || info.spec.caption,
    tags: info.spec.hashtags.map((h) => h.replace("#", "")),
    hashtags: info.spec.hashtags,
    orientation: project.orientation,
  });

  let assetId = existing?.id;
  if (existing) {
    await db.contentAsset.update({
      where: { id: existing.id },
      data: { title: info.spec.title, body: info.spec.caption, metadata },
    });
  } else {
    const created = await db.contentAsset.create({
      data: {
        knowledgeAssetId: project.knowledgeAssetId,
        projectId,
        assetType: "cartoon_video",
        platform: null, // format-agnostic → Social Engine offers all video platforms
        format: "video",
        title: info.spec.title,
        body: info.spec.caption,
        metadata,
        status: "draft",
      },
    });
    assetId = created.id;
  }

  const primary = await db.mediaFile.findFirst({ where: { contentAssetId: assetId as string, role: "primary" } });
  const size = SIZE_BY_ORIENTATION[(project.orientation as Orientation) || "9:16"];
  if (primary) {
    await db.mediaFile.update({
      where: { id: primary.id },
      data: {
        url: info.videoUrl,
        durationSeconds: info.durationSeconds,
        fileSizeBytes: info.sizeBytes,
        width: size.w, height: size.h,
        mimeType: "video/mp4", source: "render", altText: info.spec.title,
      },
    });
  } else {
    await db.mediaFile.create({
      data: {
        contentAssetId: assetId as string,
        mediaType: "video", role: "primary", position: 0,
        url: info.videoUrl,
        mimeType: "video/mp4",
        width: size.w, height: size.h,
        durationSeconds: info.durationSeconds,
        fileSizeBytes: info.sizeBytes,
        source: "render",
        altText: info.spec.title,
      },
    });
  }
}

// ---------------- maintenance ----------------
const TASK_STALE_MS = 10 * 60 * 1000;

/** Recover jobs stuck in `rendering` with stale heartbeats, plus script/
 * narration runs that died with the process (they have no heartbeat of their
 * own, so staleness is judged on updatedAt), and stale stage labels left by
 * crashed re-narrations. Called on overview/list/status reads. */
export async function recoverStaleRenders() {
  // (a) interrupted renders (heartbeat-based)
  const staleBefore = new Date(Date.now() - RENDER_STALE_MS);
  const stale = await db.cartoonProject.findMany({
    where: { status: "rendering", heartbeatAt: { lt: staleBefore } },
  });
  for (const job of stale) {
    if (job.attemptCount >= RENDER_MAX_ATTEMPTS) {
      await db.cartoonProject.update({
        where: { id: job.id },
        data: { status: "failed", error: "Render timed out repeatedly (stale job marked failed after max attempts)." },
      });
    } else {
      await db.cartoonProject.update({
        where: { id: job.id },
        data: {
          status: "failed",
          error: "Render interrupted (server restarted or job stalled). You can retry — narration and script are preserved.",
        },
      });
    }
  }

  // (b) script/narration runs that died with the process (fire-and-forget
  // promise lost on restart). The UI would otherwise poll them forever.
  const taskStaleBefore = new Date(Date.now() - TASK_STALE_MS);
  const stuckTasks = await db.cartoonProject.findMany({
    where: { status: { in: ["scripting", "narrating"] }, updatedAt: { lt: taskStaleBefore } },
  });
  for (const job of stuckTasks) {
    await db.cartoonProject.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: "Script/narration was interrupted (server restarted or the AI call failed). Retry or regenerate — existing progress is kept.",
      },
    });
    await setStage(job.id, "failed", "Interrupted. Click Retry or Fresh storyboard to continue.");
  }

  // (c) produced projects stranded in a working stage by a crashed side task
  // (e.g. a re-narration that never reset the stage). The video is intact —
  // heal the label so the UI shows the real state.
  const staleLabels = await db.cartoonProject.findMany({
    where: {
      status: { in: ["ready", "cast_ready"] },
      stage: { in: ["scripting", "narration", "saving", "render"] },
      updatedAt: { lt: taskStaleBefore },
    },
  });
  for (const job of staleLabels) {
    if (!job.videoPath) continue;
    const sizeMb = job.videoSizeBytes ? ` (${(job.videoSizeBytes / 1024 / 1024).toFixed(1)} MB${job.durationSeconds ? `, ${job.durationSeconds}s` : ""})` : "";
    await db.cartoonProject.update({
      where: { id: job.id },
      data: { stage: "done", stageMessage: `Video ready${sizeMb}` },
    });
  }
}
