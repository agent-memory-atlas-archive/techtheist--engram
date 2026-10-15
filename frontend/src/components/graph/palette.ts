/**
 * CSS → GPU colors and card metrics (0.10.1). The WebGL canvas draws what
 * the HTML card (EngramCard.vue) would look like, so everything it needs —
 * theme colors, fonts, paddings, radii — is read back from a hidden, real
 * card and from the theme tokens rather than restated here. A theme switch,
 * Match IDE's live host variables or a font load just re-runs `calibrate`.
 */

/** Straight (non-premultiplied) RGBA, each 0..1. */
export type RGBA = [number, number, number, number]

const RGB_RE = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/
const SRGB_RE = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/

let probeCtx: CanvasRenderingContext2D | null = null
const parsed = new Map<string, RGBA>()

function alphaOf(s: string | undefined): number {
    if (s === undefined) return 1
    return s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s)
}

/** Parse a computed color string; anything exotic goes through a 1px canvas. */
export function parseColor(css: string): RGBA {
    const hit = parsed.get(css)
    if (hit) return hit
    let out: RGBA
    const rgb = RGB_RE.exec(css)
    const srgb = rgb ? null : SRGB_RE.exec(css)
    if (rgb) {
        out = [+rgb[1]! / 255, +rgb[2]! / 255, +rgb[3]! / 255, alphaOf(rgb[4])]
    } else if (srgb) {
        out = [+srgb[1]!, +srgb[2]!, +srgb[3]!, alphaOf(srgb[4])]
    } else {
        if (!probeCtx) {
            const c = document.createElement('canvas')
            c.width = c.height = 1
            probeCtx = c.getContext('2d', { willReadFrequently: true })!
        }
        probeCtx.clearRect(0, 0, 1, 1)
        probeCtx.fillStyle = '#000'
        probeCtx.fillStyle = css
        probeCtx.fillRect(0, 0, 1, 1)
        const d = probeCtx.getImageData(0, 0, 1, 1).data
        out = [d[0]! / 255, d[1]! / 255, d[2]! / 255, d[3]! / 255]
    }
    if (parsed.size > 512) parsed.clear()
    parsed.set(css, out)
    return out
}

/** `color-mix(in srgb, c p%, transparent)` — the card kit's tint idiom. */
export function fade(c: RGBA, p: number): RGBA {
    return [c[0], c[1], c[2], c[3] * p]
}

export function css(c: RGBA): string {
    return `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${c[3]})`
}

/** Resolve any CSS color expression (a `var(--x)` included) in `el`'s scope. */
export function resolveColor(el: HTMLElement, value: string): RGBA {
    el.style.color = ''
    el.style.color = value
    return parseColor(getComputedStyle(el).color)
}

const TOKEN_NAMES = [
    'surface-base',
    'surface-elevated',
    'surface-muted',
    'surface-sunken',
    'border-default',
    'border-strong',
    'text-primary',
    'text-secondary',
    'text-tertiary',
    'interactive-primary',
    'node-problem',
    'trust-provisional',
    'trust-trusted',
    'canvas-bg',
    'canvas-dots',
    'canvas-glow-1',
    'canvas-glow-2',
] as const
export type TokenName = (typeof TOKEN_NAMES)[number]

export interface Tokens {
    color: Record<TokenName, RGBA>
    /** engram-purple's frosted look (`--glass-backdrop` is a blur). */
    glass: boolean
    /** Accent-strip wash strength (1 brand, 0.2 IDE themes). */
    wash: number
    /** px per rem (the pane runs 1rem = 10px). */
    rem: number
}

export function readTokens(el: HTMLElement): Tokens {
    const color = {} as Record<TokenName, RGBA>
    for (const name of TOKEN_NAMES) color[name] = resolveColor(el, `var(--${name})`)
    const cs = getComputedStyle(el)
    const backdrop = cs.getPropertyValue('--glass-backdrop').trim()
    const wash = parseFloat(cs.getPropertyValue('--accent-wash'))
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10
    return { color, glass: backdrop !== '' && backdrop !== 'none', wash: Number.isFinite(wash) ? wash : 1, rem }
}

// ---- card metrics -----------------------------------------------------------

export interface TextStyle {
    /** Canvas `font` shorthand. */
    font: string
    size: number
    /** Line box height, px. */
    lh: number
    /** The first baseline below the line box's top, px — measured, not derived. */
    base: number
    color: string
}

export interface ChipStyle {
    text: TextStyle
    padX: number
    padY: number
    border: number
    radius: number
    height: number
}

export interface CardMetrics {
    width: number
    minH: number
    maxH: number
    padX: number
    padY: number
    border: number
    radius: number
    gap: number
    headerH: number
    headerGap: number
    typePill: ChipStyle
    meta: ChipStyle
    trust: ChipStyle
    title: TextStyle
    clamp: number
    body: {
        text: TextStyle
        maxH: number
        pMargin: number
        listIndent: number
        codeFont: string
        codePadX: number
        codeRadius: number
        strongFont: string
        strongColor: string
        emFont: string
        linkColor: string
    }
    refsMaxH: number
    refsGap: number
    ref: ChipStyle
    tag: ChipStyle
    archived: { text: TextStyle; top: number; right: number }
    /** Bumped on every calibration — layouts cached under an older one redo. */
    epoch: number
}

const px = (v: string): number => parseFloat(v) || 0

function fontOf(cs: CSSStyleDeclaration, weight?: string): string {
    return `${cs.fontStyle} ${weight ?? cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
}

/**
 * Where the browser puts the first baseline inside `el`'s content box: a
 * zero-size inline-block sits on the baseline, its bottom is the answer.
 * Deriving it from font ascent/descent landed ~1px off in Inter.
 */
function baselineOf(el: Element): number {
    const cs = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    const contentTop = box.top + px(cs.borderTopWidth) + px(cs.paddingTop)
    const mark = document.createElement('span')
    mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;'
    el.insertBefore(mark, el.firstChild)
    const base = mark.getBoundingClientRect().bottom - contentTop
    mark.remove()
    return base
}

function textOf(el: Element): TextStyle {
    const cs = getComputedStyle(el)
    const size = px(cs.fontSize)
    const lh = cs.lineHeight === 'normal' ? size * 1.2 : px(cs.lineHeight)
    return { font: fontOf(cs), size, lh, base: baselineOf(el), color: cs.color }
}

function chipOf(el: Element): ChipStyle {
    const cs = getComputedStyle(el)
    return {
        text: textOf(el),
        padX: px(cs.paddingLeft),
        padY: px(cs.paddingTop),
        border: px(cs.borderLeftWidth),
        radius: Math.min(px(cs.borderTopLeftRadius), el.getBoundingClientRect().height / 2),
        height: el.getBoundingClientRect().height,
    }
}

let epoch = 0

/** Read the probe card (an EngramCard rendered off-screen with every part present). */
export function calibrate(probe: HTMLElement): CardMetrics | null {
    const q = (sel: string): HTMLElement | null => probe.querySelector<HTMLElement>(sel)
    const root = q('.engram-node')
    const header = q('.engram-node > header')
    const title = q('.node-title')
    const md = q('.md')
    const p = q('.md p')
    const code = q('.md code')
    const strong = q('.md strong')
    const link = q('.md a')
    const list = q('.md ul')
    const ref = q('.ref-chip')
    const tag = q('.tag-chip')
    const refs = q('.refs')
    const flag = q('.archived-flag')
    const typePill = q('.type-pill')
    const meta = q('.meta-badge')
    const trust = q('.trust-badge')
    if (!root || !header || !title || !md || !p || !code || !strong || !link || !list || !ref || !tag || !refs || !flag || !typePill || !meta || !trust) {
        return null
    }
    if (root.offsetWidth === 0) return null
    const cs = getComputedStyle(root)
    const bodyClip = q('.body-clip')!
    const codeCs = getComputedStyle(code)
    const mdCs = getComputedStyle(md)
    const flagCs = getComputedStyle(flag)
    const titleText = textOf(title)
    epoch += 1
    return {
        width: root.getBoundingClientRect().width,
        minH: px(cs.minHeight),
        maxH: px(cs.maxHeight),
        padX: px(cs.paddingLeft),
        padY: px(cs.paddingTop),
        border: px(cs.borderTopWidth),
        radius: px(cs.borderTopLeftRadius),
        gap: px(cs.rowGap),
        headerH: header.getBoundingClientRect().height,
        headerGap: px(getComputedStyle(header).columnGap),
        typePill: chipOf(typePill),
        meta: chipOf(meta),
        trust: chipOf(trust),
        title: titleText,
        clamp: parseInt(getComputedStyle(title).webkitLineClamp, 10) || 5,
        body: {
            text: { ...textOf(md), base: baselineOf(p) },
            maxH: px(getComputedStyle(bodyClip).maxHeight),
            pMargin: px(getComputedStyle(p).marginBottom),
            listIndent: px(getComputedStyle(list).paddingLeft),
            codeFont: fontOf(codeCs),
            codePadX: px(codeCs.paddingLeft),
            codeRadius: px(codeCs.borderTopLeftRadius),
            strongFont: fontOf(mdCs, getComputedStyle(strong).fontWeight),
            strongColor: getComputedStyle(strong).color,
            emFont: `italic ${mdCs.fontWeight} ${mdCs.fontSize} ${mdCs.fontFamily}`,
            linkColor: getComputedStyle(link).color,
        },
        refsMaxH: px(getComputedStyle(refs).maxHeight),
        refsGap: px(getComputedStyle(refs).columnGap),
        ref: chipOf(ref),
        tag: chipOf(tag),
        archived: { text: textOf(flag), top: px(flagCs.top), right: px(flagCs.right) },
        epoch,
    }
}
