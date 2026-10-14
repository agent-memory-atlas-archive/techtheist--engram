<script setup lang="ts">
/**
 * One-of-N as adjacent segments in a sunken rail; the active segment fills
 * with the context accent (--check-accent → theme primary). Replaces small
 * <select>s whose whole option list fits on one line (durability, variants).
 */
defineProps<{
    modelValue: string
    /** `count` renders as a muted badge after the label (a tally, not part of the name). */
    options: { value: string; label: string; count?: number }[]
    ariaLabel?: string
    disabled?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
</script>

<template>
<div class="segments" role="radiogroup" :aria-label="ariaLabel">
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
    display: inline-flex;
    gap: 0.2rem;
    padding: 0.25rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--surface-sunken);
}

.segment {
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

.segment.on {
    background: var(--check-accent, var(--interactive-primary));
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
