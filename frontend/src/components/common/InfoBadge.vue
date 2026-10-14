<script setup lang="ts">
/**
 * A small fact about the thing on screen (durability, version, status…).
 * One shape for nodes and tasks; tone carries meaning, never decoration.
 */
withDefaults(
    defineProps<{
        tone?: 'neutral' | 'muted' | 'accent' | 'warn' | 'danger' | 'ok'
        /** Rounded and tighter — the compact form for cards and list rows. */
        pill?: boolean
    }>(),
    { tone: 'neutral', pill: false },
)
</script>

<template>
<span class="badge" :class="[tone, { pill }]"><slot /></span>
</template>

<style scoped>
.badge {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    padding: 0.3rem 0.7rem;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background-color: var(--surface-muted);
    color: var(--text-secondary);
    font-size: var(--text-caption);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pill {
    padding: 0.1rem 0.6rem;
    border-radius: var(--radius-full);
}

.muted {
    color: var(--text-tertiary);
}

.accent {
    border-color: color-mix(in srgb, var(--interactive-primary) 40%, transparent);
    background-color: color-mix(in srgb, var(--interactive-primary) 14%, transparent);
    color: var(--interactive-primary);
}

.warn {
    background-color: color-mix(in srgb, var(--node-caution) 14%, transparent);
    color: var(--node-caution);
}

.ok {
    background-color: color-mix(in srgb, var(--node-resolution) 14%, transparent);
    color: var(--node-resolution);
}

.danger {
    border-color: color-mix(in srgb, var(--node-problem) 40%, transparent);
    background-color: color-mix(in srgb, var(--node-problem) 14%, transparent);
    color: var(--node-problem);
}
</style>
