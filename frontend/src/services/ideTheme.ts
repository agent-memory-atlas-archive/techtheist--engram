/**
 * Match IDE (0.9.11): which IDE hosts the pane, whether its theme is dark,
 * and — for a JetBrains host — the live theme values its plugin pushes in.
 *
 * VS Code needs nothing pushed: every webview receives the theme as
 * `--vscode-*` CSS variables (updated live on a switch) and a body class
 * naming the kind, which themes.css and {@link watchIdeDark} read directly.
 * JCEF injects nothing, so the JetBrains plugin reads its UI theme and calls
 * `window.__engramApplyIdeTheme(payload)` — on page load and on every theme
 * change — and opens the pane with `?ide=jetbrains&ide_dark=0|1` so the first
 * paint already has the right brightness.
 */

declare global {
    interface Window {
        __ENGRAM_HOST__?: string
        __ENGRAM_IDE_THEME__?: IdeThemePayload
        __engramApplyIdeTheme?: (payload: IdeThemePayload) => void
    }
}

export type IdeHost = 'vscode' | 'jetbrains'

/** What a JetBrains host sends: CSS colors, px radii, CSS font stacks. */
export interface IdeThemePayload {
    dark: boolean
    colors?: Partial<
        Record<
            | 'bg'
            | 'elevated'
            | 'canvas'
            | 'fg'
            | 'fg-muted'
            | 'border'
            | 'accent'
            | 'accent-hover'
            | 'accent-fg'
            | 'icon'
            | 'hover'
            | 'focus',
            string
        >
    >
    radius?: Partial<Record<'sm' | 'md' | 'lg' | 'xl' | 'control', number>>
    /** Percent of the border color kept against the background (0–100). */
    borderMix?: number
    font?: string
    mono?: string
}

const VSCODE_KIND_CLASSES = [
    'vscode-dark',
    'vscode-light',
    'vscode-high-contrast',
    'vscode-high-contrast-light',
]

/** The IDE hosting this page, if any — read once at startup. */
export function detectHost(): IdeHost | null {
    if (typeof window === 'undefined') return null
    if (window.__ENGRAM_HOST__ === 'vscode') return 'vscode'
    if (VSCODE_KIND_CLASSES.some((c) => document.body?.classList.contains(c))) return 'vscode'
    if (new URLSearchParams(window.location.search).get('ide') === 'jetbrains') return 'jetbrains'
    if (window.__ENGRAM_IDE_THEME__) return 'jetbrains'
    return null
}

function vscodeIsDark(): boolean {
    const cls = document.body.classList
    return !(cls.contains('vscode-light') || cls.contains('vscode-high-contrast-light'))
}

/** A CSS value the payload may carry — refuses anything that could close the rule. */
function safe(value: string): string | null {
    const v = value.trim()
    return v && !/[;{}<>]/.test(v) ? v : null
}

/** The `--ide-host-*` declarations for one payload (exported for tests). */
export function payloadCss(p: IdeThemePayload): string {
    const decls: string[] = []
    for (const [k, v] of Object.entries(p.colors ?? {})) {
        const s = v && safe(v)
        if (s) decls.push(`--ide-host-${k}: ${s};`)
    }
    for (const [k, v] of Object.entries(p.radius ?? {})) {
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 32) {
            decls.push(`--ide-host-radius-${k}: ${v}px;`)
        }
    }
    if (typeof p.borderMix === 'number' && Number.isFinite(p.borderMix)) {
        decls.push(`--ide-host-border-mix: ${Math.min(100, Math.max(0, p.borderMix))}%;`)
    }
    const font = p.font && safe(p.font)
    if (font) decls.push(`--ide-host-font: ${font};`)
    const mono = p.mono && safe(p.mono)
    if (mono) decls.push(`--ide-host-mono: ${mono};`)
    return `:root { ${decls.join(' ')} }`
}

function applyPayload(p: IdeThemePayload): void {
    const id = 'engram-ide-theme'
    let el = document.getElementById(id) as HTMLStyleElement | null
    if (!el) {
        el = document.createElement('style')
        el.id = id
        document.head.appendChild(el)
    }
    el.textContent = payloadCss(p)
}

/**
 * Follow the host's brightness (and, for JetBrains, its theme values) and
 * report every change through `onDark`. Returns the brightness right now.
 */
export function watchIdeDark(host: IdeHost, onDark: (dark: boolean) => void): boolean {
    if (host === 'vscode') {
        new MutationObserver(() => onDark(vscodeIsDark())).observe(document.body, {
            attributes: true,
            attributeFilter: ['class'],
        })
        return vscodeIsDark()
    }
    window.__engramApplyIdeTheme = (payload) => {
        window.__ENGRAM_IDE_THEME__ = payload
        applyPayload(payload)
        onDark(!!payload.dark)
    }
    const early = window.__ENGRAM_IDE_THEME__
    if (early) {
        applyPayload(early)
        return !!early.dark
    }
    return new URLSearchParams(window.location.search).get('ide_dark') !== '0'
}
