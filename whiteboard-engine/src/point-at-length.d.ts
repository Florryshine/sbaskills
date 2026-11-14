declare module 'point-at-length' {
  export interface PointAtLengthInstance {
    at(t: number): [number, number];
    length(): number;
  }
  export default function pointAtLength(d: string): PointAtLengthInstance;
}
