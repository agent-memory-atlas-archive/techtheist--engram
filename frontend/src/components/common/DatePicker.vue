<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'

/**
 * A day picker in the pane's own surfaces — the native <input type="date">
 * popup can't be themed. The value is a local `YYYY-MM-DD` ('' = none).
 * The calendar floats on a glass panel (blurred where the theme opts into
 * glass, opaque elsewhere) with `--radius-popover` corners, teleported to
 * <body> and placed from the trigger like SelectMenu, flipping up when the
 * space below runs out. Keyboard: arrows move a day / a week, PageUp and
 * PageDown a month, Enter picks, Escape closes.
 */
const props = withDefaults(defineProps<{ modelValue: string; ariaLabel?: string; clearable?: boolean }>(), {
    ariaLabel: 'Date',
    clearable: false,
})
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const panel = useTemplateRef<HTMLElement>('panel')
const open = ref(false)
const style = ref<Record<string, string>>({})

function parse(v: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

function iso(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const today = (): Date => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

const value = computed(() => parse(props.modelValue))
/** The keyboard cursor; the grid shows its month. */
const focus = ref<Date>(today())

const label = computed(() =>
    value.value
        ? value.value.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
        : 'Pick a date',
)

/** The locale's first weekday (Intl weekInfo where supported), else Monday. */
const firstDay = (() => {
    try {
        const loc = new Intl.Locale(navigator.language) as Intl.Locale & {
            weekInfo?: { firstDay: number }
            getWeekInfo?: () => { firstDay: number }
        }
        const info = loc.getWeekInfo?.() ?? loc.weekInfo
        return info ? info.firstDay % 7 : 1
    } catch {
        return 1
    }
})()

const weekdays = computed(() => {
    const base = new Date(2024, 0, 7) // a Sunday
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(base)
        d.setDate(base.getDate() + ((firstDay + i) % 7))
        return d.toLocaleDateString(undefined, { weekday: 'narrow' })
    })
})

const monthLabel = computed(() =>
    focus.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
)

/** Six weeks starting on the locale's first weekday on/before the 1st. */
const days = computed(() => {
    const first = new Date(focus.value.getFullYear(), focus.value.getMonth(), 1)
    const lead = (first.getDay() - firstDay + 7) % 7
    const start = new Date(first)
    start.setDate(1 - lead)
    return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        return d
    })
})

const same = (a: Date | null, b: Date | null): boolean => !!a && !!b && iso(a) === iso(b)

function place(): void {
    const el = trigger.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 6
    const height = 340
    const flip = window.innerHeight - r.bottom < height + gap && r.top > window.innerHeight - r.bottom
    const s: Record<string, string> = {
        left: `${Math.max(8, Math.min(r.left, window.innerWidth - 300))}px`,
    }
    if (flip) s.bottom = `${window.innerHeight - r.top + gap}px`
    else s.top = `${r.bottom + gap}px`
    style.value = s
}

async function show(): Promise<void> {
    focus.value = value.value ?? today()
    place()
    open.value = true
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    await nextTick()
    panel.value?.querySelector<HTMLElement>('.day.cursor')?.focus()
}

function hide(refocus = false): void {
    if (!open.value) return
    open.value = false
    window.removeEventListener('resize', place)
    window.removeEventListener('scroll', place, true)
    if (refocus) trigger.value?.focus()
}
onBeforeUnmount(() => hide())
onClickOutside(panel, () => hide(), { ignore: [trigger] })

function pick(d: Date | null): void {
    emit('update:modelValue', d ? iso(d) : '')
    hide(true)
}

function shiftMonth(n: number): void {
    const d = new Date(focus.value)
    const day = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + n)
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(day, last))
    focus.value = d
}

async function moveCursor(daysBy: number): Promise<void> {
    const d = new Date(focus.value)
    d.setDate(d.getDate() + daysBy)
    focus.value = d
    await nextTick()
    panel.value?.querySelector<HTMLElement>('.day.cursor')?.focus()
}

function onKey(e: KeyboardEvent): void {
    const keys: Record<string, () => void> = {
        ArrowLeft: () => void moveCursor(-1),
        ArrowRight: () => void moveCursor(1),
        ArrowUp: () => void moveCursor(-7),
        ArrowDown: () => void moveCursor(7),
        PageUp: () => {
            shiftMonth(-1)
            void moveCursor(0)
        },
        PageDown: () => {
            shiftMonth(1)
            void moveCursor(0)
        },
        Enter: () => pick(focus.value),
        Escape: () => hide(true),
    }
    const fn = keys[e.key]
    if (!fn) return
    e.preventDefault()
    fn()
}
</script>

<template>
<button
    ref="trigger"
    class="date-trigger"
    :class="{ open, placeholder: !value }"
    type="button"
    :aria-label="`${ariaLabel}: ${label}`"
    aria-haspopup="dialog"
    :aria-expanded="open"
    @click="open ? hide() : show()"
>
    <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.3" />
        <path d="M2 6.5h12M5.5 1.8v2.6M10.5 1.8v2.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
    <span class="date-value">{{ label }}</span>
</button>

<Teleport to="body">
    <div
        v-if="open"
        ref="panel"
        class="calendar glass-panel"
        role="dialog"
        :aria-label="ariaLabel"
        :style="style"
        @keydown="onKey"
    >
        <header class="cal-head">
            <span class="cal-month">{{ monthLabel }}</span>
            <span class="cal-nav">
                <button class="nav" type="button" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
                <button class="nav" type="button" aria-label="Next month" @click="shiftMonth(1)">›</button>
            </span>
        </header>
        <div class="grid" role="grid">
            <span v-for="(w, i) in weekdays" :key="`w${i}`" class="weekday" aria-hidden="true">{{ w }}</span>
            <button
                v-for="d in days"
                :key="iso(d)"
                class="day"
                type="button"
                :tabindex="same(d, focus) ? 0 : -1"
                :aria-selected="same(d, value)"
                :aria-label="d.toLocaleDateString(undefined, { dateStyle: 'full' })"
                :class="{
                    outside: d.getMonth() !== focus.getMonth(),
                    today: same(d, today()),
                    selected: same(d, value),
                    cursor: same(d, focus),
                }"
                @click="pick(d)"
            >
                {{ d.getDate() }}
            </button>
        </div>
        <footer class="cal-foot">
            <button v-if="clearable" class="foot-btn" type="button" @click="pick(null)">Clear</button>
            <span v-else />
            <button class="foot-btn" type="button" @click="pick(today())">Today</button>
        </footer>
    </div>
</Teleport>
</template>

<style scoped>
.date-trigger {
    display: flex;
    gap: 0.7rem;
    align-items: center;
    width: 100%;
    padding: 0.6rem 0.9rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--surface-sunken);
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-body-sm);
    text-align: left;
    cursor: pointer;
}

.date-trigger:hover,
.date-trigger.open {
    border-color: var(--interactive-primary);
}

.date-trigger:focus-visible {
    outline: 2px solid var(--interactive-primary);
    outline-offset: 1px;
}

.date-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.date-trigger.placeholder .date-value {
    color: var(--text-tertiary);
}

.icon {
    flex: none;
    width: 1.4rem;
    height: 1.4rem;
    color: var(--text-tertiary);
}

/* The floating surface: glass where the theme opts in, opaque elsewhere
   (.glass-panel), with the popover corner every IDE theme can override. */
.calendar {
    position: fixed;
    z-index: 1000;
    width: 28rem;
    padding: 1rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-popover);
    box-shadow: var(--shadow-lg);
    color: var(--text-primary);
    font-size: var(--text-body-sm);
}

.cal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.2rem 0.8rem;
}

.cal-month {
    font-weight: 600;
}

.cal-nav {
    display: flex;
    gap: 0.2rem;
}

.nav {
    width: 2.6rem;
    height: 2.6rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-secondary);
    font-size: 1.8rem;
    line-height: 1;
    cursor: pointer;
}

.nav:hover {
    background: var(--interactive-ghost-hover);
    color: var(--text-primary);
}

.grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.2rem;
}

.weekday {
    padding: 0.3rem 0;
    color: var(--text-tertiary);
    font-size: var(--text-caption);
    font-weight: 600;
    text-align: center;
}

.day {
    aspect-ratio: 1;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
}

.day:hover {
    background: var(--interactive-ghost-hover);
}

.day.outside {
    color: var(--text-tertiary);
}

.day.today {
    border-color: var(--border-strong);
}

.day:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -1px;
}

.day.selected {
    border-color: transparent;
    background: var(--interactive-primary);
    color: var(--text-inverse);
    font-weight: 700;
}

.cal-foot {
    display: flex;
    justify-content: space-between;
    padding-top: 0.8rem;
}

.foot-btn {
    padding: 0.3rem 0.6rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--interactive-primary);
    font: inherit;
    font-size: var(--text-caption);
    font-weight: 600;
    cursor: pointer;
}

.foot-btn:hover {
    background: var(--interactive-ghost-hover);
}
</style>
