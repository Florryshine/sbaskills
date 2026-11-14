/**
 * Read an API response without assuming the server always returns JSON.
 * Vercel/proxy/runtime failures can return plain text or HTML; calling
 * response.json() directly masks the real HTTP failure with "Unexpected token".
 */
export async function readApiResponse(response) {
  const raw = await response.text();
  if (!raw) {
    if (!response.ok) throw new Error(`Request failed (HTTP ${response.status}) with an empty response.`);
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    const excerpt = raw.replace(/\\s+/g, ' ').slice(0, 400);
    throw new Error(
      `Server returned a non-JSON response (HTTP ${response.status}). ${excerpt || 'Empty response body.'}`
    );
  }
}
