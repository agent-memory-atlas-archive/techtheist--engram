// The feed's geometry (0.10.1): the height map every feed position comes
// from. Run with `bun test` — no browser; the real heights come from the
// browser, these pin the arithmetic around them.
import { describe, expect, test } from 'bun:test'
import { HeightMap, anchorShift, distanceToLine } from '../src/components/feed/heightMap'

function map(heights: number[], gap = 10): HeightMap {
    const m = new HeightMap(gap)
    m.reset(heights.map((_, i) => `k${i}`), (_, i) => heights[i]!)
    return m
}

describe('HeightMap', () => {
    test('offsets add heights and the gaps between items', () => {
        const m = map([100, 50, 200])
        expect([m.offset(0), m.offset(1), m.offset(2)]).toEqual([0, 110, 170])
        expect(m.total).toBe(370) // no gap after the last item
    })

    test('a height change moves everything below it, nothing above', () => {
        const m = map([100, 50, 200, 30])
        expect(m.set(1, 80)).toBe(30)
        expect([m.offset(0), m.offset(1), m.offset(2), m.offset(3)]).toEqual([0, 110, 200, 410])
        expect(m.set(1, 80)).toBe(0)
    })

    test('indexAt finds the item at a position, gaps belong to the item above', () => {
        const m = map([100, 50, 200])
        expect(m.indexAt(-5)).toBe(0)
        expect(m.indexAt(0)).toBe(0)
        expect(m.indexAt(105)).toBe(0)
        expect(m.indexAt(110)).toBe(1)
        expect(m.indexAt(369)).toBe(2)
        expect(m.indexAt(1e9)).toBe(2)
        expect(m.range(105, 175)).toEqual([0, 2])
    })

    test('a thousand items: a far offset is the plain sum, found again by search', () => {
        const hs = Array.from({ length: 1000 }, (_, i) => 150 + ((i * 37) % 120))
        const m = map(hs, 16)
        const sum = hs.slice(0, 777).reduce((a, h) => a + h + 16, 0)
        expect(m.offset(777)).toBe(sum)
        expect(m.indexAt(sum + 1)).toBe(777)
        expect(m.indexOf('k777')).toBe(777)
        expect(m.indexOf('nope')).toBe(-1)
    })

    test('the gap comes from CSS and can change (narrow panes)', () => {
        const m = map([100, 100])
        m.setGap(20)
        expect(m.offset(1)).toBe(120)
    })

    test('an empty list has no items and no range', () => {
        const m = map([])
        expect(m.total).toBe(0)
        expect(m.indexAt(0)).toBe(-1)
        expect(m.range(0, 100)).toEqual([0, -1])
    })
})

describe('distanceToLine', () => {
    test('zero while the item covers the line, else to its nearest edge', () => {
        expect(distanceToLine(100, 200, 150)).toBe(0)
        expect(distanceToLine(100, 200, 300)).toBe(0)
        expect(distanceToLine(100, 200, 350)).toBe(50)
        expect(distanceToLine(100, 200, 40)).toBe(60)
    })
})

describe('anchorShift', () => {
    test('only changes above the centered card move the scroll', () => {
        expect(anchorShift([[2, 40], [7, 100]], 5)).toBe(40)
        // the centered card grows downward: the view stays where it is
        expect(anchorShift([[5, 300]], 5)).toBe(0)
        expect(anchorShift([[1, -20], [3, 50]], 4)).toBe(30)
    })

    test('no centered card (-1): nothing moves', () => {
        expect(anchorShift([[0, 40]], -1)).toBe(0)
    })
})
