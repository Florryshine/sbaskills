// Render job runner: spawns the standalone render worker process and
// polls its progress file (keeps Chrome/Remotion out of the Next bundle —
// the same serverless-safe split the sbaskills whiteboard engine uses).
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import type { CartoonProjectProps } from "../engine/types";

const MEDIA_ROOT = path.join(process.cwd(), "media");
const WORKER = path.join(process.cwd(), "scripts", "cartoon-render-worker.mjs");

export const SIZE_BY_ORIENTATION: Record<string, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1920, h: 1080 },
  "1:1": { w: 1080, h: 1080 },
};

export interface RenderResult {
  ok: boolean;
  videoPath?: string;
  durationSeconds?: number;
  sizeBytes?: number;
  error?: string;
}

function nodeBin(): string {
  return process.execPath || "node";
}

export async function runRenderJob(opts: {
  projectId: string;
  props: CartoonProjectProps;
  onProgress?: (p: { progress: number; message: string }) => void;
}): Promise<RenderResult> {
  const outDir = path.join(MEDIA_ROOT, "cartoon-videos");
  fs.mkdirSync(outDir, { recursive: true });
  const tmpDir = path.join(MEDIA_ROOT, "render-jobs");
  fs.mkdirSync(tmpDir, { recursive: true });
  const jobId = `${opts.projectId}-${Date.now()}`;
  const jobFile = path.join(tmpDir, `${jobId}.job.json`);
  const progressFile = path.join(tmpDir, `${jobId}.progress.json`);
  const output = path.join(outDir, `${opts.projectId}.mp4`);

  fs.writeFileSync(jobFile, JSON.stringify({
    projectId: opts.projectId,
    props: opts.props,
    output,
    progressFile,
  }));

  return new Promise<RenderResult>((resolve) => {
    const child = spawn(nodeBin(), [WORKER, jobFile], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
      env: { ...process.env },
    });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr = (stderr + d.toString()).slice(-4000); });
    child.stdout.on("data", () => {});

    let lastProgress = 0;
    const poll = setInterval(() => {
      try {
        if (fs.existsSync(progressFile)) {
          const data = JSON.parse(fs.readFileSync(progressFile, "utf-8"));
          if (typeof data.progress === "number" && data.progress !== lastProgress) {
            lastProgress = data.progress;
            opts.onProgress?.({ progress: data.progress, message: data.message || "" });
          }
          if (data.ok === true || data.ok === false) {
            clearInterval(poll);
            resolve(data as RenderResult);
          }
        }
      } catch { /* keep polling */ }
    }, 1200);

    child.on("exit", (code) => {
      setTimeout(() => {
        clearInterval(poll);
        try {
          if (fs.existsSync(progressFile)) {
            const data = JSON.parse(fs.readFileSync(progressFile, "utf-8"));
            if (data.ok === true || data.ok === false) { resolve(data as RenderResult); return; }
          }
        } catch { /* fallthrough */ }
        resolve({ ok: false, error: `Render worker exited with code ${code}. ${stderr.slice(-300)}` });
      }, 300);
    });
    child.on("error", (e) => {
      clearInterval(poll);
      resolve({ ok: false, error: `Failed to start render worker: ${e.message}` });
    });
  });
}

/** Delete stale job files (older than 1h) — temp cleanup. */
export function cleanupRenderJobs() {
  const tmpDir = path.join(MEDIA_ROOT, "render-jobs");
  if (!fs.existsSync(tmpDir)) return;
  for (const f of fs.readdirSync(tmpDir)) {
    const p = path.join(tmpDir, f);
    try {
      if (Date.now() - fs.statSync(p).mtimeMs > 60 * 60 * 1000) fs.unlinkSync(p);
    } catch { /* ignore */ }
  }
}
