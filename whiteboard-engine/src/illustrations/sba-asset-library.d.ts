declare module '../../../remotion/whiteboard/SBAAssetLibrary' {
  import type { ComponentType } from 'react';
  export const SBA_ASSET_CATALOG: Array<{id:string;name:string;category:string;kind:string;format:string;license:string}>;
  export const SBA_ASSET_ALIASES: Record<string,string>;
  export const SBAIllustrationArtwork: ComponentType<{type?:string;name?:string;accent?:string;showLabel?:boolean;style?:Record<string,unknown>;className?:string}>;
  export function findSBAIllustration(query:string): {id:string;name:string;category:string;kind:string}|null;
}
