<script setup lang="ts">
/**
 * The pane's button for card and drawer actions. `primary` is the one
 * filled action of a form (Create), `accent` an outlined-in-accent one
 * (Add, Turn on), `ghost` an outlined quiet one,
 * `subtle` a borderless one (a toolbar's secondary gesture), `danger` a
 * confirmed destructive step, `danger-text` the entry to one. `sm` is the
 * inline size (rows, list items, section headers). Every panel uses this —
 * no local button styles.
 */
withDefaults(
    defineProps<{
        variant?: 'default' | 'primary' | 'accent' | 'ghost' | 'subtle' | 'danger' | 'danger-text'
        size?: 'md' | 'sm'
        type?: 'button' | 'submit'
        /** Full width of its container. */
        block?: boolean
        /** The control corner (pill in the brand theme, the IDE's button
         *  corner under Match IDE) — for floating toolbars like the feed's. */
        pill?: boolean
    }>(),
    { variant: 'default', size: 'md', type: 'button', block: false, pill: false },
)
</script>

<template>
<button
    class="ui-btn"
    :class="[`ui-btn--${variant}`, `ui-btn--${size}`, { 'ui-btn--block': block, 'ui-btn--pill': pill }]"
    :type="type"
>
    <slot />
</button>
</template>

<style scoped>
.ui-btn {
    flex: none;
    /* Content width, even in a stretching column (PanelSection); `block` opts out. */
    width: fit-content;
    padding: 0.7rem 1.2rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background-color: var(--surface-elevated);
    color: var(--text-primary);
    font-size: var(--text-label);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
}

.ui-btn--sm {
    padding: 0.4rem 0.9rem;
    font-size: var(--text-caption);
}

.ui-btn:disabled {
    cursor: default;
    opacity: 0.5;
}

.ui-btn:hover:not(:disabled) {
    background-color: var(--node-hover-surface);
}

.ui-btn--block {
    width: 100%;
}

.ui-btn--pill {
    border-radius: var(--radius-control);
}

.ui-btn--ghost {
    background-color: transparent;
}

.ui-btn--subtle {
    border-color: transparent;
    background-color: transparent;
    color: var(--text-secondary);
}

.ui-btn--subtle:hover:not(:disabled) {
    color: var(--text-primary);
}

.ui-btn--primary {
    border-color: transparent;
    background-color: var(--interactive-primary);
    color: var(--text-inverse);
}

.ui-btn--primary:hover:not(:disabled) {
    background-color: var(--interactive-primary-hover);
}

.ui-btn--accent {
    border-color: var(--interactive-primary);
    background-color: transparent;
    color: var(--interactive-primary);
}

.ui-btn--danger {
    border-color: var(--node-problem);
    background-color: color-mix(in srgb, var(--node-problem) 16%, transparent);
    color: var(--node-problem);
}

.ui-btn--danger-text {
    border-color: transparent;
    background-color: transparent;
    color: var(--node-problem);
}
</style>
