/// <reference types="node" />
declare module './podcastTTS.js' {
  export function synthesizeLine(text: string, speaker: 'host_a' | 'host_b', emotion?: string, speedOverride?: number | null): Promise<Buffer>;
  export function getAudioMimeType(buffer: Buffer): string;
  export function getAudioExtension(buffer: Buffer): 'wav' | 'mp3';
  export function estimateDurationSeconds(text: string): number;
  export const VOICES: Record<string, string>;
}
