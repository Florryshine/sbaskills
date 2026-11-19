// Admin gate stub for the sandbox. In the sbaskills port, replace this with
// `requireAdminApi()` from lib/require-admin-api.js — every route below calls
// it exactly once, so the swap is a one-line change per file.
export async function requireAdmin(): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  // Sandbox: open access (the preview is private). Production: enforce admin.
  return { ok: true };
}
