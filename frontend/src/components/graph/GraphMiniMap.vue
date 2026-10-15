<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Camera } from './renderer'

/**
 * The minimap — Vue Flow's MiniMap as a small 2D canvas in an HTML glass
 * panel: every node a rounded rect in its type's color, the outside of the
 * viewport masked. Click centers there (zoom kept), wheel zooms.
 */
export interface MiniNode {
    x: number
    y: number
    w: number
    h: number
    color: string
}

const props = defineProps<{
    nodes: MiniNode[]
    camera: Camera
    viewW: number
    viewH: number
    mask: string
    /** Bumped when node positions change without a new array. */
    tick: number
}>()
const emit = defineEmits<{ center: [x: number, y: number]; zoom: [factor: number] }>()

const W = 100
const H = 75
const canvas = ref<HTMLCanvasElement | null>(null)
let frame = 0
let view = { x: 0, y: 0, scale: 1 }

/**
 * The nodes are drawn once into a bitmap (at their own bounds) and only
 * re-drawn when they change; a camera move blits it and redraws the mask —
 * a thousand roundRect fills per frame was the minimap's whole cost.
 */
let nodeBitmap: HTMLCanvasElement | null = null
let nodeBounds = { x0: 0, y0: 0, x1: 1, y1: 1 }
let bitmapFor: unknown = null

function buildBitmap(): void {
    bitmapFor = props.nodes
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const n of props.nodes) {
        x0 = Math.min(x0, n.x)
        y0 = Math.min(y0, n.y)
        x1 = Math.max(x1, n.x + n.w)
        y1 = Math.max(y1, n.y + n.h)
    }
    if (!props.nodes.length) {
        nodeBitmap = null
        return
    }
    nodeBounds = { x0, y0, x1, y1 }
    // Resolution: comfortably above what the 100×75 panel shows at its densest.
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const k = (Math.max(W, H) * dpr * 2) / Math.max(x1 - x0, y1 - y0)
    nodeBitmap ??= document.createElement('canvas')
    nodeBitmap.width = Math.max(1, Math.ceil((x1 - x0) * k))
    nodeBitmap.height = Math.max(1, Math.ceil((y1 - y0) * k))
    const ctx = nodeBitmap.getContext('2d')!
    ctx.setTransform(k, 0, 0, k, -x0 * k, -y0 * k)
    for (const n of props.nodes) {
        ctx.fillStyle = n.color
        ctx.beginPath()
        ctx.roundRect(n.x, n.y, n.w, n.h, 5)
        ctx.fill()
    }
}

function draw(): void {
    frame = 0
    const c = canvas.value
    if (!c) return
    if (bitmapFor !== props.nodes) buildBitmap()
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    if (c.width !== W * dpr) {
        c.width = W * dpr
        c.height = H * dpr
    }
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const z = props.camera.zoom
    const vx = -props.camera.x / z
    const vy = -props.camera.y / z
    const vw = props.viewW / z
    const vh = props.viewH / z
    const x0 = Math.min(vx, nodeBounds.x0)
    const y0 = Math.min(vy, nodeBounds.y0)
    const x1 = Math.max(vx + vw, nodeBounds.x1)
    const y1 = Math.max(vy + vh, nodeBounds.y1)
    // Vue Flow's viewBox: the bounds at the panel's aspect, 5 units of air.
    const bw = x1 - x0
    const bh = y1 - y0
    const vs = Math.max(bw / W, bh / H) || 1
    const offset = 5 * vs
    const boxX = x0 - (vs * W - bw) / 2 - offset
    const boxY = y0 - (vs * H - bh) / 2 - offset
    const boxW = vs * W + 2 * offset
    const boxH = vs * H + 2 * offset
    const s = Math.min(W / boxW, H / boxH)
    const ox = boxX - (W / s - boxW) / 2
    const oy = boxY - (H / s - boxH) / 2
    view = { x: ox, y: oy, scale: s }
    const tx = (x: number): number => (x - ox) * s
    const ty = (y: number): number => (y - oy) * s
    if (nodeBitmap) {
        const b = nodeBounds
        ctx.drawImage(nodeBitmap, tx(b.x0), ty(b.y0), (b.x1 - b.x0) * s, (b.y1 - b.y0) * s)
    }
    // Mask everything outside the viewport rectangle.
    ctx.fillStyle = props.mask
    ctx.beginPath()
    ctx.rect(0, 0, W, H)
    ctx.rect(tx(vx), ty(vy), vw * s, vh * s)
    ctx.fill('evenodd')
}

function schedule(): void {
    if (!frame) frame = requestAnimationFrame(draw)
}

watch(() => [props.nodes, props.camera, props.viewW, props.viewH, props.mask, props.tick], schedule)
onMounted(draw)
onBeforeUnmount(() => cancelAnimationFrame(frame))

function toFlow(e: MouseEvent): [number, number] {
    const r = canvas.value!.getBoundingClientRect()
    return [(e.clientX - r.left) / view.scale + view.x, (e.clientY - r.top) / view.scale + view.y]
}

function onClick(e: MouseEvent): void {
    emit('center', ...toFlow(e))
}

function onWheel(e: WheelEvent): void {
    e.preventDefault()
    e.stopPropagation()
    emit('zoom', Math.pow(2, -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002) * 10))
}
</script>

<template>
<div class="gl-minimap gl-chrome">
    <canvas ref="canvas" :style="{ width: `${W}px`, height: `${H}px` }" @click="onClick" @wheel="onWheel" />
</div>
</template>

<style scoped>
.gl-minimap {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 5;
    margin: 15px;
    overflow: hidden;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    background-color: var(--surface-glass);
    backdrop-filter: var(--glass-backdrop);
    box-shadow: var(--shadow-md);
}

.gl-minimap canvas {
    display: block;
    cursor: pointer;
}

@media (width <= 260px) {
    .gl-minimap {
        display: none;
    }
}
</style>
