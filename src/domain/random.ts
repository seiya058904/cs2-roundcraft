export class Random {
    constructor(public state: number) { this.state = state >>> 0; }
    next(): number { let t = this.state += 0x6D2B79F5; this.state >>>= 0; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    int(n: number): number { return Math.floor(this.next() * n); }
    pick<T>(items: readonly T[]): T { if (!items.length)
        throw new Error('空候选集'); return items[this.int(items.length)]; }
}
export function hash(text: string): number { let h = 2166136261; for (const c of text)
    h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
