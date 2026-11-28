/// <reference types="node" />
export declare function synthesizeGeminiLine(text: string, speaker: 'host_a' | 'host_b', emotion?: string, speedOverride?: number | null): Promise<Buffer>;
export declare function synthesizeLine(text: string, speaker: 'host_a' | 'host_b', emotion?: string, speedOverride?: number | null): Promise<Buffer>;
export declare function getAudioMimeType(buffer: Buffer): string;
export declare function getAudioExtension(buffer: Buffer): 'wav' | 'mp3';
export declare function estimateDurationSeconds(text: string): number;
export declare const VOICES: Record<string, string>;
