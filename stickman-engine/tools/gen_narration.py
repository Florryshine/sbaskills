#!/usr/bin/env python3
"""Generate free narration audio (Microsoft Edge neural voices via edge-tts)
for a SceneScript, measure durations with ffprobe, and emit:
  public/narration/<key>.mp3   (audio files served to Remotion via staticFile)
  narration.json               ({"scene:line": {"file": ..., "dur": ...}})
  jobs/sample-job.json         (merged job for the render CLI)

Everything here is free: edge-tts (no key) + ffprobe (local).
"""
import asyncio, json, os, re, subprocess, sys

ENGINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # stickman-engine/
SCENE_FILE = os.path.join(ENGINE, 'scenes', 'friction-story.json')
PUBLIC = os.path.join(ENGINE, 'public', 'narration')
OUT_JOB = os.path.join(ENGINE, 'jobs', 'sample-job.json')

VOICES = {
    'narr': 'en-US-ChristopherNeural',
    'ben': 'en-US-GuyNeural',
    'maya': 'en-US-JennyNeural',
}


def clean(text: str) -> str:
    """Strip emphasis markers edge-tts would read aloud."""
    return re.sub(r'\s+', ' ', text).strip()


async def gen():
    import edge_tts
    os.makedirs(PUBLIC, exist_ok=True)
    os.makedirs(os.path.dirname(OUT_JOB), exist_ok=True)
    script = json.load(open(SCENE_FILE))
    narration = {}
    jobs = []

    async def one(si, li, line):
        key = f'{si}:{li}'
        out = os.path.join(PUBLIC, f'{key}.mp3')
        voice = VOICES.get(line.get('who', 'narr'), VOICES['narr'])
        rate = line.get('rate', '+0%')
        c = edge_tts.Communicate(clean(line['text']), voice, rate=rate)
        await c.save(out)
        dur = float(subprocess.check_output(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'csv=p=0', out]).decode().strip())
        narration[key] = {'file': f'narration/{key}.mp3', 'dur': round(dur, 3)}
        print(f'  {key}: {dur:.2f}s  [{line["who"]}] {line["text"][:60]}')

    for si, sc in enumerate(script['scenes']):
        for li, line in enumerate(sc.get('dialogue', [])):
            jobs.append(one(si, li, line))
    await asyncio.gather(*jobs)

    json.dump(narration, open(os.path.join(ENGINE, 'narration.json'), 'w'), indent=2)
    job = {
        'script': script,
        'narration': narration,
        'out': os.path.join(ENGINE, 'out', 'friction-story.mp4'),
    }
    json.dump(job, open(OUT_JOB, 'w'), indent=2)
    total = sum(v['dur'] for v in narration.values())
    print(f'generated {len(narration)} clips, {total:.1f}s of narration -> {OUT_JOB}')


if __name__ == '__main__':
    asyncio.run(gen())
