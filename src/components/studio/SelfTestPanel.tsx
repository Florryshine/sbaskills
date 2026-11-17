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
import { FlaskConical, CheckCircle2, XCircle } from 'lucide-react';
import { runSelfTest, type SubjectResult } from '@/lib/studio/selftest';

export default function SelfTestPanel() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<SubjectResult[] | null>(null);

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
      <p className="text-sm text-white/70">
        Runs the five required subjects end-to-end through the engine: lyrics, melody,
        arrangement, offline audio mix, singing events and typography frames — proving the
        pipeline produces different songs and visuals per subject.
      </p>
      <Button onClick={run} disabled={running} className="bg-[#FF9F1C] text-[#2A1A5E] hover:bg-[#FFB84D] font-semibold">
        <FlaskConical className="h-4 w-4 mr-2" />
        {running ? 'Testing…' : 'Run engine self-test'}
      </Button>
      {(running || message) && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-white/60">{message}</p>
        </div>
      )}
      {results && (
        <ScrollArea className="max-h-[480px] [&>[data-radix-scroll-area-viewport]]:max-h-[480px] rounded-lg border border-white/10">
          <div className="p-3 space-y-3">
            {results.map((r) => (
              <div key={r.id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.pass
                    ? <CheckCircle2 className="h-4 w-4 text-[#2EC4B6]" />
                    : <XCircle className="h-4 w-4 text-[#FF5D8F]" />}
                  <span className="text-sm font-medium text-white">{r.label}</span>
                  <Badge className={r.pass ? 'bg-[#2EC4B6]/20 text-[#2EC4B6] border-[#2EC4B6]/30' : 'bg-[#FF5D8F]/20 text-[#FF5D8F] border-[#FF5D8F]/30'}>
                    {r.pass ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
                {r.error
                  ? <p className="text-xs text-[#FF5D8F]">{r.error}</p>
                  : (
                    <div className="text-xs text-white/60 grid grid-cols-2 gap-x-4 gap-y-1">
                      <span>Title: <span className="text-white/85">{r.title}</span></span>
                      <span>Duration: <span className="text-white/85">{r.durationSec}s</span></span>
                      <span>Sections: <span className="text-white/85">{r.sections}</span></span>
                      <span>Sung syllables: <span className="text-white/85">{r.sungSyllables}</span></span>
                      <span>Audio peak: <span className="text-white/85">{r.audioPeak}</span></span>
                      <span>Audio RMS: <span className="text-white/85">{r.audioRms}</span></span>
                    </div>
                  )}
                {r.warnings.length > 0 && (
                  <p className="text-[11px] text-[#FFD60A]/80">{r.warnings.join(' · ')}</p>
                )}
                {r.frameThumbs.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    {r.frameThumbs.map((src, i) => (
                      <img key={i} src={src} alt={`${r.label} frame ${i + 1}`} className="w-16 rounded border border-white/10" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
