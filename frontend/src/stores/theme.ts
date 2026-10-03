import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { detectHost, watchIdeDark } from '@/services/ideTheme'

export interface ThemeOption {
    id: string
    label: string
}

/**
 * Follow the hosting IDE's own theme (0.9.11) — offered only inside an IDE,
 * where it is the default. Resolves to `ide-dark` / `ide-light`.
 */
export const MATCH_IDE = 'ide'

/**
 * The static skins (0.9.11: three). `engram-purple` is the brand default and
 * the only glassy one; IDE Light / IDE Dark are the neutral IDE palettes —
 * the VS Code ones, the most compatible of the former per-IDE pairs. The ids
 * stay `vscode-*` so remembered choices keep working.
 */
const STATIC_THEMES: ThemeOption[] = [
    { id: 'engram-purple', label: 'Engram Purple' },
    { id: 'vscode-light', label: 'IDE Light' },
    { id: 'vscode-dark', label: 'IDE Dark' },
]

/** Retired skins and the one each became (0.9.11). */
const RETIRED: Record<string, string> = {
    'jetbrains-dark': 'vscode-dark',
    'jetbrains-light': 'vscode-light',
}

const host = detectHost()

export const THEMES: ThemeOption[] = host
    ? [{ id: MATCH_IDE, label: 'Match IDE' }, ...STATIC_THEMES]
    : STATIC_THEMES

// Inside an IDE the choice is remembered under its own key, so "Match IDE"
// becomes the default once — a static skin picked before it existed does not
// shadow it — and a choice made after is kept.
const STORAGE_KEY = host ? 'engram.theme.ide' : 'engram.theme'
const DEFAULT_THEME = host ? MATCH_IDE : 'engram-purple'

function initialTheme(): string {
    let saved: string | null = null
    try {
        saved = localStorage.getItem(STORAGE_KEY)
    } catch {
        // storage blocked — the default stands
    }
    saved = (saved && RETIRED[saved]) ?? saved
    return saved && THEMES.some((t) => t.id === saved) ? saved : DEFAULT_THEME
}

export const useThemeStore = defineStore('theme', () => {
    const current = ref<string>(initialTheme())
    const ideDark = ref(host ? watchIdeDark(host, (dark) => (ideDark.value = dark)) : true)

    /** The skin actually on the page — what `data-theme` carries. */
    const applied = computed(() =>
        current.value === MATCH_IDE ? (ideDark.value ? 'ide-dark' : 'ide-light') : current.value,
    )

    /** The skin a menu swatch for `id` should paint — Match IDE shows the IDE's own. */
    function swatchOf(id: string): string {
        return id === MATCH_IDE ? (ideDark.value ? 'ide-dark' : 'ide-light') : id
    }

    function set(id: string): void {
        if (!THEMES.some((t) => t.id === id)) return
        current.value = id
    }

    watch(applied, (id) => document.documentElement.setAttribute('data-theme', id), {
        immediate: true,
    })
    watch(current, (id) => {
        try {
            localStorage.setItem(STORAGE_KEY, id)
        } catch {
            // storage blocked — the choice lasts for this session
        }
    })

    return { current, applied, host, themes: THEMES, set, swatchOf }
})
