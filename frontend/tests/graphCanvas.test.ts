// The WebGL graph canvas (0.10.1): the parts that are plain functions. Run
// with `bun test` — no browser, no GPU. What needs a canvas (card painting,
// the renderer itself) is checked against the HTML card in a browser instead.
import { describe, expect, test } from 'bun:test'
import { layoutGraph } from '../src/composables/useLayout'
import { tierFor } from '../src/components/graph/renderer'
import { fade, parseColor } from '../src/components/graph/palette'
import type { GraphEdge, GraphNode } from '../src/types/graph'

describe('tierFor', () => {
    test('paints at the smallest tier that still covers the zoom', () => {
        expect(tierFor(1)).toBe(0)
        expect(tierFor(0.6)).toBe(0)
        expect(tierFor(0.5)).toBe(1)
        expect(tierFor(0.3)).toBe(1)
        expect(tierFor(0.25)).toBe(2)
    })

    test('never goes below the smallest tier (far zoom draws bars instead)', () => {
        expect(tierFor(0.1)).toBe(2)
        expect(tierFor(0.05)).toBe(2)
    })
})

describe('parseColor', () => {
    test('reads the computed-style forms without a canvas', () => {
        expect(parseColor('rgb(255, 0, 51)')).toEqual([1, 0, 0.2, 1])
        expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5])
        expect(parseColor('rgb(255 255 255 / 50%)')).toEqual([1, 1, 1, 0.5])
        expect(parseColor('color(srgb 0.5 0.25 1 / 0.4)')).toEqual([0.5, 0.25, 1, 0.4])
    })

    test('fade is color-mix with transparent: same color, scaled alpha', () => {
        expect(fade([0.2, 0.4, 0.6, 1], 0.16)).toEqual([0.2, 0.4, 0.6, 0.16])
        expect(fade([0.2, 0.4, 0.6, 0.5], 0.5)).toEqual([0.2, 0.4, 0.6, 0.25])
    })
})

/** A full node, as the store holds it. */
function node(id: string, type = 'Decision'): GraphNode {
    return {
        id,
        type,
        title: `Note ${id}`,
        body: 'Body text that the layout must not depend on.',
        durability: 'stable',
        source: 'claude',
        session_id: null,
        created_at: 0,
        valid_from: null,
        valid_until: null,
        status: null,
        last_seen: null,
        confirmed_at: null,
        approved_at: null,
        demoted_at: null,
        trust_override: null,
        trust: 0.5,
        stale: false,
        code_refs: [],
        tags: [],
    }
}

function edge(from: string, to: string): GraphEdge {
    return {
        id: `${from}-${to}`,
        type: 'because',
        from_id: from,
        to_id: to,
        source: 'claude',
        created_at: 0,
        confidence: null,
        strength: null,
        note: null,
        valid_from: null,
        valid_until: null,
        status: null,
    }
}

describe('layout worker contract', () => {
    // The worker receives only ids, types and edge ends (layout.worker.ts).
    // If a layout ever starts reading another field, the canvas would lay out
    // differently from the fallback — this pins the contract.
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => node(id, i === 3 ? 'Anchor' : 'Decision'))
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('d', 'c'), edge('e', 'a')]
    const slimNodes = nodes.map((n) => ({ id: n.id, type: n.type })) as GraphNode[]
    const slimEdges = edges.map((e) => ({ from_id: e.from_id, to_id: e.to_id })) as GraphEdge[]

    for (const mode of ['skyline', 'archipelago', 'orbit'] as const) {
        test(`${mode}: the slim payload places every node exactly as the full one`, () => {
            const full = layoutGraph(nodes, edges, new Map(), mode)
            const slim = layoutGraph(slimNodes, slimEdges, new Map(), mode)
            expect(slim.size).toBe(nodes.length)
            for (const n of nodes) expect(slim.get(n.id)).toEqual(full.get(n.id)!)
        })
    }

    test('hand-placed positions win over the computed ones', () => {
        const pos = layoutGraph(nodes, edges, new Map([['c', { x: 1234, y: -56 }]]), 'skyline')
        expect(pos.get('c')).toEqual({ x: 1234, y: -56 })
    })
})

describe('skyline at scale', () => {
    // One big connected component used to go to dagre whole: every long
    // cross-link became a chain of dummy nodes (5 s at 1,000 notes, a stack
    // overflow at 5,000). Big components now lay out as communities.
    test('a 1,200-note connected graph lays out fast, every card placed, none overlapping', () => {
        let seed = 7
        const rnd = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
        const n = 1200
        const nodes = Array.from({ length: n }, (_, i) => node(`n${i}`))
        const edges: GraphEdge[] = []
        for (let i = 1; i < n; i++) edges.push(edge(`n${i}`, `n${Math.floor(rnd() * i)}`))
        for (let k = 0; k < n / 2; k++) edges.push(edge(`n${Math.floor(rnd() * n)}`, `n${Math.floor(rnd() * n)}`))
        const t = performance.now()
        const pos = layoutGraph(nodes, edges, new Map(), 'skyline')
        expect(performance.now() - t).toBeLessThan(3000)
        expect(pos.size).toBe(n)
        const pts = [...pos.values()].sort((a, b) => a.x - b.x)
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length && pts[j]!.x - pts[i]!.x < 340; j++) {
                const overlap = Math.abs(pts[j]!.y - pts[i]!.y) < 150
                expect(overlap).toBe(false)
            }
        }
    })
})
