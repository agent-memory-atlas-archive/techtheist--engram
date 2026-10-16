/**
 * The feed's geometry (0.10.1): one height per item, in list order, and the
 * offsets they add up to. The feed keeps its full scroll length while only
 * the cards near the viewport exist in the DOM — every position (a jump
 * target a thousand cards away, the centered card, the window to mount)
 * comes from here, never from reading the DOM.
 *
 * Heights are measured off screen by the browser itself (exact, not
 * estimated): content-visibility's estimated heights made far jumps miss
 * (0.7.x), so an unmeasured item only ever stands in until its measurement
 * lands, and the caller keeps the view still when one changes above it.
 */
export class HeightMap {
    keys: string[] = []
    private h = new Float64Array(0)
    /** top[i] = offset of item i; top[n] = total (gaps included). */
    private top = new Float64Array(1)
    private dirtyFrom = 0
    private index = new Map<string, number>()

    constructor(public gap = 0) {}

    /** Replace the list. `heightOf` gives each item's best-known height. */
    reset(keys: string[], heightOf: (key: string, i: number) => number): void {
        this.keys = keys
        this.h = new Float64Array(keys.length)
        this.top = new Float64Array(keys.length + 1)
        this.index = new Map()
        keys.forEach((k, i) => {
            this.h[i] = heightOf(k, i)
            this.index.set(k, i)
        })
        this.dirtyFrom = 0
    }

    get length(): number {
        return this.keys.length
    }

    indexOf(key: string): number {
        return this.index.get(key) ?? -1
    }

    height(i: number): number {
        return this.h[i] ?? 0
    }

    /** Set one height; returns the change (0 when it was already that). */
    set(i: number, height: number): number {
        const delta = height - (this.h[i] ?? height)
        if (delta === 0) return 0
        this.h[i] = height
        this.dirtyFrom = Math.min(this.dirtyFrom, i)
        return delta
    }

    setGap(gap: number): void {
        if (gap === this.gap) return
        this.gap = gap
        this.dirtyFrom = 0
    }

    private settle(): void {
        const n = this.keys.length
        if (this.dirtyFrom > n) return
        let y = this.dirtyFrom === 0 ? 0 : this.top[this.dirtyFrom]!
        for (let i = this.dirtyFrom; i < n; i++) {
            this.top[i] = y
            y += this.h[i]! + (i < n - 1 ? this.gap : 0)
        }
        this.top[n] = y
        this.dirtyFrom = n + 1
    }

    offset(i: number): number {
        this.settle()
        return this.top[Math.max(0, Math.min(i, this.keys.length))]!
    }

    get total(): number {
        return this.offset(this.keys.length)
    }

    /** The item at track position y (the last one starting at or before it). */
    indexAt(y: number): number {
        this.settle()
        const n = this.keys.length
        if (n === 0) return -1
        let lo = 0
        let hi = n - 1
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1
            if (this.top[mid]! <= y) lo = mid
            else hi = mid - 1
        }
        return lo
    }

    /** First and last index overlapping [y0, y1]. */
    range(y0: number, y1: number): [number, number] {
        if (this.keys.length === 0) return [0, -1]
        return [this.indexAt(y0), this.indexAt(y1)]
    }
}

/**
 * How far an item is from the center line: 0 while it covers the line,
 * else the distance to its nearest edge — so a card taller than the screen
 * stays fully "centered" while it is read.
 */
export function distanceToLine(top: number, height: number, line: number): number {
    return Math.max(0, Math.abs(top + height / 2 - line) - height / 2)
}

/**
 * The scroll correction for height changes: the view stays still when an
 * item ABOVE the anchor (the centered card) changes, and does not move for
 * the anchor itself or anything below — the centered card grows downward.
 */
export function anchorShift(changes: Iterable<[index: number, delta: number]>, anchor: number): number {
    let shift = 0
    for (const [i, d] of changes) if (i < anchor) shift += d
    return shift
}
