'use client';

/**
 * SelfTestPanel — Phase 4 verification inside the studio UI.
 * Runs the five required educational subjects through the full engine and
 * displays pass/fail evidence with rendered frame thumbnails.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FlaskConical, CheckCircle2, XCircle, Download } from 'lucide-react';
import { runSelfTest, type SubjectResult } from '@/lib/studio/selftest';

export default function SelfTestPanel() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<SubjectResult[] | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setResults(null);
    setProgress(0);
    try {
      const r = await runSelfTest((msg, pct) => { setMessage(msg); setProgress(pct); });
      setResults(r);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#526B89]">
        Runs the five required subjects end-to-end through the engine: lyrics, melody,
        arrangement, offline audio mix, singing events and typography frames — proving the
        pipeline produces different songs and visuals per subject.
      </p>
      <Button onClick={run} disabled={running} className="bg-[#FFCC00] text-[#062B59] hover:bg-[#FFE066] font-semibold">
        <FlaskConical className="h-4 w-4 mr-2" />
        {running ? 'Testing…' : 'Run engine self-test'}
      </Button>
      {(running || message) && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-[#526B89]">{message}</p>
        </div>
      )}
      {results && (
        <ScrollArea className="max-h-[560px] [&>[data-radix-scroll-area-viewport]]:max-h-[560px] rounded-lg border border-[#D8E6F5] bg-[#F8FBFF]">
          <div className="p-3 space-y-3">
            {results.map((r) => (
              <div key={r.id} className="rounded-lg border border-[#D8E6F5] bg-white p-3 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.pass
                    ? <CheckCircle2 className="h-4 w-4 text-[#2EC4B6]" />
                    : <XCircle className="h-4 w-4 text-[#FF5D8F]" />}
                  <span className="text-sm font-semibold text-[#12345B]">{r.label}</span>
                  <Badge className={r.pass ? 'bg-[#2EC4B6]/20 text-[#2EC4B6] border-[#2EC4B6]/30' : 'bg-[#FF5D8F]/20 text-[#FF5D8F] border-[#FF5D8F]/30'}>
                    {r.pass ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
                {r.error
                  ? <p className="text-xs text-red-700">{r.error}</p>
                  : (
                    <div className="text-xs text-[#526B89] grid grid-cols-2 gap-x-4 gap-y-1">
                      <span>Title: <span className="text-[#12345B]">{r.title}</span></span>
                      <span>Duration: <span className="text-[#12345B]">{r.durationSec}s</span></span>
                      <span>Sections: <span className="text-[#12345B]">{r.sections}</span></span>
                      <span>Sung syllables: <span className="text-[#12345B]">{r.sungSyllables}</span></span>
                      <span>Audio peak: <span className="text-[#12345B]">{r.audioPeak}</span></span>
                      <span>Audio RMS: <span className="text-[#12345B]">{r.audioRms}</span></span>
                    </div>
                  )}
                {r.warnings.length > 0 && (
                  <p className="text-[11px] text-[#8A6500]">{r.warnings.join(' · ')}</p>
                )}
                {r.audioUrl && (
                  <div className="rounded-lg border border-[#D8E6F5] bg-[#F1F7FF] p-3 space-y-2">
                    <p className="text-xs font-semibold text-[#12345B]">Audio sample</p>
                    <audio controls preload="none" src={r.audioUrl} className="w-full" />
                    <a href={r.audioUrl} download={r.id + '-sba-self-test.wav'} className="inline-flex items-center gap-2 text-xs font-semibold text-[#0B5BC1] hover:underline">
                      <Download className="h-3.5 w-3.5" /> Download WAV
                    </a>
                  </div>
                )}
                {r.frameThumbs.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-[#12345B]">Video frame previews</p>
                    <div className="grid grid-cols-4 gap-2">
                      {r.frameThumbs.map((src, i) => (
                        <div key={i} className="space-y-1">
                          <button type="button" onClick={() => setPreviewImage(src)} className="block w-full overflow-hidden rounded-lg border border-[#C8DDF5]">
                            <img src={src} alt={r.label + ' frame ' + (i + 1)} className="aspect-[9/16] w-full object-cover" />
                          </button>
                          <a href={src} download={r.id + '-frame-' + (i + 1) + '.jpg'} className="block text-center text-[10px] font-medium text-[#0B5BC1] hover:underline">Download</a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
      {previewImage && (
        <div role="dialog" aria-modal="true" aria-label="Frame preview" onClick={() => setPreviewImage(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-[#062B59]/90 p-4">
          <div className="max-h-[90vh] max-w-md" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Expanded self-test video frame" className="max-h-[82vh] rounded-xl object-contain" />
            <button type="button" onClick={() => setPreviewImage(null)} className="mt-3 w-full rounded-lg bg-[#FFCC00] px-4 py-2 text-sm font-semibold text-[#062B59]">Close preview</button>
          </div>
        </div>
      )}
    </div>
  );
}
