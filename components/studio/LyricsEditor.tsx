'use client';

/**
 * LyricsEditor — preview & edit lyrics before generating the song.
 * Lines are grouped by section; each line keeps its fact ribbon editable.
 */
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import type { SongSpec } from '@/lib/studio/types';

interface Props {
  spec: SongSpec | null;
  provider?: string;
  factChecked?: boolean;
  onChange?: (spec: SongSpec) => void;
}

export default function LyricsEditor({ spec, provider, factChecked, onChange }: Props) {
  const [open, setOpen] = useState(true);
  if (!spec) return null;

  const updateLine = (sectionId: string, lineIdx: number, text: string, fact: string | null) => {
    const next: SongSpec = JSON.parse(JSON.stringify(spec));
    const section = next.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const line = section.lines[lineIdx];
    if (!line) return;
    line.text = text;
    line.words = text.split(/\s+/).filter(Boolean).map((w) => ({ text: w, notes: [] }));
    if (fact !== null) line.fact = fact.trim() || undefined;
    onChange?.(next);
  };

  const sectionLabel = (name: string) => name.toUpperCase();

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-white/10 bg-white/5">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Lyrics</span>
          {provider && <Badge variant="outline" className="text-[10px] border-[#FFD60A]/40 text-[#FFD60A]">{provider}</Badge>}
          {factChecked && <Badge variant="outline" className="text-[10px] border-[#FFCC00]/50 text-[#FFCC00]">fact-checked</Badge>}
        </div>
        <ChevronDown className={`h-4 w-4 text-white/60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="max-h-[420px] [&>[data-radix-scroll-area-viewport]]:max-h-[420px] px-4 pb-4">
          <div className="space-y-4">
            {spec.sections.map((section) => (
              <div key={section.id}>
                {section.lines.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-[#1A73E8]/80 text-white text-[10px] hover:bg-[#1A73E8]/80">{sectionLabel(section.name)}</Badge>
                    <span className="text-[10px] text-white/40">{section.chords.join(' · ')}</span>
                  </div>
                )}
                {section.lines.map((line, li) => (
                  <div key={li} className="mb-3 space-y-1.5">
                    <Input
                      value={line.text}
                      onChange={(e) => updateLine(section.id, li, e.target.value, null)}
                      className="bg-white/10 border-white/15 text-white text-sm"
                      aria-label={`Lyric line in ${section.name}`}
                    />
                    <Input
                      value={line.fact ?? ''}
                      placeholder="Fact taught by this line (optional)"
                      onChange={(e) => updateLine(section.id, li, line.text, e.target.value)}
                      className="bg-transparent border-[#FFD60A]/25 text-[#FFD60A] text-xs h-7"
                      aria-label={`Fact for line ${li + 1}`}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}
