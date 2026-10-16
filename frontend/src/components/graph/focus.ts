/**
 * Selection focus (0.10.2): the edges around the selected node stand out —
 * wider by hop ring — and every other edge dims, so a node's neighborhood
 * reads at a glance. Shared by the WebGL canvas and the Vue Flow fallback.
 */

/** Hop rings around the selection that stand out (edges past them dim). */
export const FOCUS_RINGS = 3
/** Dimmed edges' and labels' alpha while a node is selected. */
export const FOCUS_DIM = 0.22
/** Seconds a focus change eases over. */
export const FOCUS_EASE = 0.25

/** How much of ring 1's extra width each further ring keeps: ×2, ×1.4, ×1.16 — a falloff, not a ramp. */
export const FOCUS_FALLOFF = 0.4

/** Width multiplier of ring 1..FOCUS_RINGS (mirrored in shaders.ts focusOf). */
export function focusWidth(ring: number): number {
    return 1 + FOCUS_FALLOFF ** (ring - 1)
}

/** Hops from `selected` over `edges`, either direction, out to FOCUS_RINGS - 1. */
export function selectionHops(selected: string, edges: readonly { from_id: string; to_id: string }[]): Map<string, number> {
    const adj = new Map<string, string[]>()
    const add = (a: string, b: string): void => {
        const l = adj.get(a)
        if (l) l.push(b)
        else adj.set(a, [b])
    }
    for (const e of edges) {
        add(e.from_id, e.to_id)
        add(e.to_id, e.from_id)
    }
    const hops = new Map([[selected, 0]])
    let ring = [selected]
    for (let h = 1; h < FOCUS_RINGS && ring.length; h++) {
        const next: string[] = []
        for (const id of ring) {
            for (const n of adj.get(id) ?? []) {
                if (hops.has(n)) continue
                hops.set(n, h)
                next.push(n)
            }
        }
        ring = next
    }
    return hops
}

/**
 * An edge's focus: 0 with nothing selected, its ring 1..FOCUS_RINGS (ring 1
 * touches the selection), or -1 past the last ring — dimmed.
 */
export function edgeFocus(hops: Map<string, number> | null, from: string, to: string): number {
    if (!hops) return 0
    const near = Math.min(hops.get(from) ?? Infinity, hops.get(to) ?? Infinity)
    return near < FOCUS_RINGS ? near + 1 : -1
}
