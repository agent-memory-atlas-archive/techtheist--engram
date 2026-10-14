<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { onClickOutside, useMediaQuery } from '@vueuse/core'
import SegmentedControl from '@/components/common/SegmentedControl.vue'

/**
 * The screen switch. Wide bars get the segmented rail; from 900px down the
 * four segments cost the bar its search and actions, so it folds into one
 * fixed-width control that names the current screen: hover or click opens a
 * vertical list, and the wheel or a vertical swipe on the control steps
 * through the screens without opening anything — the fast swap.
 */
const props = defineProps<{
    modelValue: string
    options: { value: string; label: string }[]
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const compact = useMediaQuery('(max-width: 900px)')
const open = ref(false)
/** Opened by hover: closes again when the pointer leaves. */
const byHover = ref(false)
const root = useTemplateRef<HTMLElement>('root')
onClickOutside(root, () => (open.value = false))

const index = computed(() => Math.max(0, props.options.findIndex((o) => o.value === props.modelValue)))
const current = computed(() => props.options[index.value])

function pick(v: string): void {
    emit('update:modelValue', v)
    open.value = false
}

function step(delta: number): void {
    const n = props.options.length
    const next = props.options[(index.value + delta + n) % n]
    if (next) emit('update:modelValue', next.value)
}

// Wheel: one screen per notch; trackpads emit bursts, so throttle.
let wheelAt = 0
function onWheel(e: WheelEvent): void {
    if (Math.abs(e.deltaY) < 4) return
    e.preventDefault()
    const now = performance.now()
    if (now - wheelAt < 250) return
    wheelAt = now
    step(e.deltaY > 0 ? 1 : -1)
}

// Touch: a vertical swipe on the control steps; a tap opens the list.
let touchY: number | null = null
function onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') touchY = e.clientY
}
function onPointerUp(e: PointerEvent): void {
    if (e.pointerType !== 'touch' || touchY == null) return
    const dy = e.clientY - touchY
    touchY = null
    if (Math.abs(dy) > 24) {
        step(dy < 0 ? 1 : -1)
        open.value = false
    }
}

function onEnter(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || open.value) return
    open.value = true
    byHover.value = true
}
function onLeave(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && byHover.value) open.value = false
}
function toggle(): void {
    byHover.value = false
    open.value = !open.value
}

function onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') step(1)
    else if (e.key === 'ArrowUp') step(-1)
    else if (e.key === 'Escape') open.value = false
    else return
    e.preventDefault()
}
</script>

<template>
<SegmentedControl
    v-if="!compact"
    class="view-toggle"
    :model-value="modelValue"
    :options="options"
    aria-label="Screen"
    @update:model-value="emit('update:modelValue', $event)"
/>
<div
    v-else
    ref="root"
    class="switch"
    :class="{ open }"
    @pointerenter="onEnter"
    @pointerleave="onLeave"
>
    <button
        class="current"
        type="button"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-label="`Screen: ${current?.label}. Scroll or swipe to switch`"
        @click="toggle"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @keydown="onKey"
    >
        <span class="label">{{ current?.label }}</span>
        <svg class="chev" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 4.5 6 2l3 2.5M3 7.5 6 10l3-2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    </button>
    <ul v-if="open" class="list" role="listbox" aria-label="Screen">
        <li v-for="o in options" :key="o.value">
            <button
                class="option"
                type="button"
                role="option"
                :aria-selected="o.value === modelValue"
                :class="{ on: o.value === modelValue }"
                @click="pick(o.value)"
            >
                {{ o.label }}
            </button>
        </li>
    </ul>
</div>
</template>

<style scoped>
.switch {
    position: relative;
}

.current {
    display: inline-flex;
    gap: 0.6rem;
    align-items: center;
    justify-content: space-between;
    width: 9.6rem; /* fixed: the bar must not reflow as the label changes */
    padding: 0.6rem 0.9rem 0.6rem 1.1rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-control);
    background-color: var(--surface-glass);
    backdrop-filter: var(--glass-backdrop);
    color: var(--text-primary);
    font-size: var(--text-caption);
    font-weight: 600;
    cursor: pointer;
    touch-action: none; /* the vertical swipe is ours */
}

.current:hover,
.switch.open .current {
    border-color: var(--border-strong);
}

.chev {
    flex: none;
    width: 1.2rem;
    height: 1.2rem;
    color: var(--text-tertiary);
}

/* Hover-opened lists keep a bridge across the gap so the pointer can
   travel from the control into the list without it closing. */
.list {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 100%;
    margin: 0;
    padding: 0.8rem 0.4rem 0.4rem;
    list-style: none;
}

.list::before {
    content: '';
    position: absolute;
    inset: 0.4rem 0 0;
    z-index: -1;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    background-color: var(--surface-elevated);
    box-shadow: var(--shadow-lg);
}

.option {
    width: 100%;
    padding: 0.6rem 0.9rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-caption);
    font-weight: 600;
    text-align: left;
    cursor: pointer;
}

.option:hover {
    background: var(--interactive-ghost-hover);
    color: var(--text-primary);
}

.option.on {
    color: var(--interactive-primary);
}
</style>
