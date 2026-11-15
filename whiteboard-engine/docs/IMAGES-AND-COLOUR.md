# Images, colour and the hand (v3.1)

Merged from the z.ai Python engine ("engine B"): pictures are drawn line by line, then painted in colour, by a cartoon hand that also follows handwriting.

## Script syntax

    image: <url | file | search keywords> [scale:.9] [at:right] [sync:phrase] [color:no]

Examples

    image: seedling-sun.svg scale:1.0 at:right      # file in whiteboard-engine/assets/images/
    image: chloroplast cell diagram sync:chloroplasts # free search (Pixabay -> Wikimedia -> Pexels)
    image: https://example.org/diagram.png color:no   # outline only

## How it works

1. `prepareImages()` (src/imagery/prepare.ts) runs before the timeline builder (worker + CLI).
2. `traceImage()` (src/imagery/trace.ts): fit 480px -> ink map (line-art threshold, or Sobel edges for photos) -> Zhang-Suen thinning -> chain walk -> RDP + Chaikin -> nearest-neighbour pen order.
3. The strokes are registered as a normal illustration, so layout, sync, scheduling and the pen work unchanged.
4. A posterised PNG colour layer is painted in afterwards by a zig-zag marker sweep (mask in DrawnStrokes.tsx; the hand follows the sweep).

## Tuning

- Best results: bold clip-art / diagrams with dark outlines. Photos become a pencil-sketch with real colours.
- `TraceOptions` in trace.ts: `maxDim`, `minChain`, `maxStrokes` (default 70), `colors` (default 14).
- Library illustration fills are now more visible (default fill opacity 0.14 -> 0.34).

## Caveats

- The colour PNG is embedded in `whiteboard_jobs.timeline` (about 5-60 KB per image). Clear `timeline` after a successful render if Supabase space is tight.
- Keyword search needs PIXABAY_API_KEY and/or PEXELS_API_KEY; Wikimedia needs no key. Credits are returned by `prepareImages()` (`imageCredits`) for the video description.
