<script setup lang="ts">
import type { Standing } from '@/types/graph'

/**
 * Grounded answers (0.9.10): the daemon's one-word verdict on how far a note
 * can be relied on — the same `standing` the assistant reads on every search
 * hit, so a person sees what the agent is acting on. The reason rides in the
 * tooltip; the verdict colours follow the trust palette (canon green,
 * contested and stale the problem red, superseded and tombstone muted).
 */
defineProps<{ standing: Standing }>()
</script>

<template>
<span class="standing" :data-verdict="standing.verdict" :title="standing.reason">{{ standing.verdict }}</span>
</template>

<style scoped>
.standing {
    flex-shrink: 0;
    padding: 0.15rem 0.6rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-caption);
    font-weight: 600;
    white-space: nowrap;
    color: var(--text-secondary);
    background-color: var(--surface-muted);
}

.standing[data-verdict='canon'] {
    color: var(--trust-trusted);
    background-color: color-mix(in srgb, var(--trust-trusted) 14%, transparent);
}

.standing[data-verdict='confirmed'] {
    color: var(--interactive-primary);
    background-color: color-mix(in srgb, var(--interactive-primary) 14%, transparent);
}

.standing[data-verdict='contested'],
.standing[data-verdict='stale'] {
    color: var(--node-problem);
    background-color: color-mix(in srgb, var(--node-problem) 14%, transparent);
}

.standing[data-verdict='superseded'],
.standing[data-verdict='tombstone'] {
    color: var(--text-tertiary);
    text-decoration: line-through;
}
</style>
