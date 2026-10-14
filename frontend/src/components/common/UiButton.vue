<script setup lang="ts">
/**
 * The pane's button for card and drawer actions. `primary` is the one
 * filled action of a row, `ghost` the quiet ones, `danger` a confirmed
 * destructive step, `danger-text` the entry to one.
 */
withDefaults(
    defineProps<{
        variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'danger-text'
        size?: 'md' | 'sm'
        type?: 'button' | 'submit'
    }>(),
    { variant: 'default', size: 'md', type: 'button' },
)
</script>

<template>
<button class="btn" :class="[variant, size]" :type="type"><slot /></button>
</template>

<style scoped>
.btn {
    flex: none;
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

.btn.sm {
    padding: 0.4rem 0.9rem;
    font-size: var(--text-caption);
}

.btn:disabled {
    cursor: default;
    opacity: 0.5;
}

.btn:hover:not(:disabled) {
    background-color: var(--node-hover-surface);
}

.ghost {
    background-color: transparent;
}

.primary {
    border-color: var(--interactive-primary);
    color: var(--interactive-primary);
}

.danger {
    border-color: var(--node-problem);
    background-color: color-mix(in srgb, var(--node-problem) 16%, transparent);
    color: var(--node-problem);
}

.danger-text {
    border-color: transparent;
    background-color: transparent;
    color: var(--node-problem);
}
</style>
