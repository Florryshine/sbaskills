/**
 * Image-space region validation shared by image intake and admin correction.
 * Coordinates use the original image's pixel dimensions and a top-left origin.
 */
export function cleanImageRegion(region, width, height) {
  if (!region || typeof region !== 'object' || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return null;
  }
  const values = ['x', 'y', 'width', 'height'].map((key) => Number(region[key]));
  if (!values.every(Number.isFinite)) return null;
  const [rawX, rawY, rawWidth, rawHeight] = values;
  const x = Math.max(0, Math.min(width, rawX));
  const y = Math.max(0, Math.min(height, rawY));
  const right = Math.max(x, Math.min(width, rawX + rawWidth));
  const bottom = Math.max(y, Math.min(height, rawY + rawHeight));
  if (right - x < 2 || bottom - y < 2) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(right - x),
    height: Math.round(bottom - y),
    normalized: {
      x: x / width,
      y: y / height,
      width: (right - x) / width,
      height: (bottom - y) / height,
    },
  };
}
