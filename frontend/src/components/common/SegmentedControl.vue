<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

/**
 * One-of-N as adjacent segments in a sunken rail. The selection is one
 * accent-filled thumb (--check-accent → theme primary) that slides from
 * segment to segment, measured from the active button so it follows any
 * label width, counts included. Replaces small <select>s whose whole option
 * list fits on one line (durability, variants, screens).
 */
const props = defineProps<{
    modelValue: string
    /** `count` renders as a muted badge after the label (a tally, not part of the name). */
    options: { value: string; label: string; count?: number }[]
    ariaLabel?: string
    disabled?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const rail = useTemplateRef<HTMLElement>('rail')
const thumb = ref<{ x: number; w: number } | null>(null)
/** No slide on the first placement — the thumb appears where it belongs. */
const animate = ref(false)

function place(): void {
    const el = rail.value?.querySelector<HTMLElement>('.segment.on')
    thumb.value = el ? { x: el.offsetLeft, w: el.offsetWidth } : null
}

watch(
    () => [props.modelValue, props.options.map((o) => `${o.label}${o.count ?? ''}`).join()],
    () => void nextTick(place),
)

let observer: ResizeObserver | null = null
onMounted(() => {
    place()
    requestAnimationFrame(() => (animate.value = true))
    // Font loading, a parent's width, a count that changes digits — re-place.
    if (rail.value && 'ResizeObserver' in window) {
        observer = new ResizeObserver(place)
        observer.observe(rail.value)
    }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
<div ref="rail" class="segments" role="radiogroup" :aria-label="ariaLabel">
    <span
        v-if="thumb"
        class="thumb"
        :class="{ animate }"
        aria-hidden="true"
        :style="{ width: `${thumb.w}px`, transform: `translateX(${thumb.x}px)` }"
    />
    <button
        v-for="o in options"
        :key="o.value"
        class="segment"
        type="button"
        role="radio"
        :aria-checked="o.value === modelValue"
        :class="{ on: o.value === modelValue }"
        :disabled="disabled"
        @click="emit('update:modelValue', o.value)"
    >
        {{ o.label }}<span v-if="o.count != null" class="count">{{ o.count }}</span>
    </button>
</div>
</template>

<style scoped>
.segments {
    position: relative;
    display: inline-flex;
    gap: 0.2rem;
    padding: 0.25rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--surface-sunken);
}

.segment {
    position: relative; /* above the thumb */
    padding: 0.35rem 1rem;
    border: none;
    border-radius: calc(var(--radius-md) - 0.25rem);
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-caption);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition:
        background-color 120ms ease,
        color 120ms ease;
}

.segment:disabled {
    opacity: 0.5;
    cursor: default;
}

.segment:hover:not(.on, :disabled) {
    color: var(--text-primary);
    background: var(--interactive-ghost-hover);
}

/* The selection: one filled thumb under the segments, sliding between them. */
.thumb {
    position: absolute;
    top: 0.25rem;
    bottom: 0.25rem;
    left: 0;
    border-radius: calc(var(--radius-md) - 0.25rem);
    background: var(--check-accent, var(--interactive-primary));
    pointer-events: none;
}

.thumb.animate {
    transition:
        transform 220ms cubic-bezier(0.3, 0.7, 0.2, 1),
        width 220ms cubic-bezier(0.3, 0.7, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
    .thumb.animate {
        transition: none;
    }
}

.segment.on {
    color: var(--text-inverse);
}

.count {
    display: inline-block;
    min-width: 1.6em;
    margin-left: 0.5rem;
    padding: 0 0.4rem;
    border-radius: var(--radius-full);
    background: var(--surface-muted, rgb(148 163 184 / 18%));
    color: var(--text-tertiary);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    text-align: center;
}

.segment.on .count {
    background: rgb(255 255 255 / 22%);
    color: inherit;
}
</style>
