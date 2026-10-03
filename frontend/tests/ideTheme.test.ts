// Match IDE (0.9.11): the CSS a JetBrains theme payload turns into. Run with
// `bun test` (no browser needed — payloadCss is pure).
import { describe, expect, test } from 'bun:test'
import { payloadCss } from '../src/services/ideTheme'

describe('payloadCss', () => {
    test('maps colors, radii and fonts onto --ide-host-* variables', () => {
        const css = payloadCss({
            dark: true,
            colors: { bg: '#2b2d30', fg: '#dfe1e5', accent: '#3574f0' },
            radius: { sm: 3, md: 4 },
            font: '"Inter", system-ui, sans-serif',
            mono: '"JetBrains Mono", monospace',
        })
        expect(css).toContain('--ide-host-bg: #2b2d30;')
        expect(css).toContain('--ide-host-fg: #dfe1e5;')
        expect(css).toContain('--ide-host-accent: #3574f0;')
        expect(css).toContain('--ide-host-radius-sm: 3px;')
        expect(css).toContain('--ide-host-radius-md: 4px;')
        expect(css).toContain('--ide-host-font: "Inter", system-ui, sans-serif;')
        expect(css).toContain('--ide-host-mono: "JetBrains Mono", monospace;')
        expect(css.startsWith(':root {')).toBe(true)
    })

    test('drops values that could break out of the rule, and absurd radii', () => {
        const css = payloadCss({
            dark: false,
            colors: { bg: 'red; } body { display: none', fg: '#000' },
            radius: { sm: -1, md: 400, lg: Number.NaN, xl: 8 },
            font: '</style><script>',
        })
        expect(css).not.toContain('display')
        expect(css).not.toContain('script')
        expect(css).toContain('--ide-host-fg: #000;')
        expect(css).toContain('--ide-host-radius-xl: 8px;')
        expect(css).not.toContain('radius-sm')
        expect(css).not.toContain('radius-md')
        expect(css).not.toContain('radius-lg')
    })

    test('an empty payload yields an empty rule, so the fallbacks stand', () => {
        expect(payloadCss({ dark: true })).toBe(':root {  }')
    })
})

describe('payloadCss — control radius and border mix', () => {
    test('passes the control radius and a clamped border mix', () => {
        const css = payloadCss({ dark: true, radius: { control: 6 }, borderMix: 65 })
        expect(css).toContain('--ide-host-radius-control: 6px;')
        expect(css).toContain('--ide-host-border-mix: 65%;')
        expect(payloadCss({ dark: true, borderMix: 250 })).toContain('--ide-host-border-mix: 100%;')
    })
})
