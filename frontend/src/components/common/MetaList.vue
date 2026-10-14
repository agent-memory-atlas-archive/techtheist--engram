<script setup lang="ts">
/**
 * Label/value rows — provenance, system facts, journal context; children
 * are MetaRow. `sm` (default) is the card footnote size (caption values);
 * `md` gives values body size and a wider label column, for panels whose
 * rows ARE the content (System info).
 */
withDefaults(defineProps<{ size?: 'sm' | 'md' }>(), { size: 'sm' })
</script>

<template>
<dl class="meta" :class="size"><slot /></dl>
</template>

<style scoped>
.meta {
    --meta-label-width: 7rem;
    --meta-value-size: var(--text-caption);
    --meta-value-color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin: 0;
    font-size: var(--text-caption);
}

.md {
    --meta-label-width: 10rem;
    --meta-value-size: var(--text-body-sm);
    --meta-value-color: var(--text-primary);
    gap: 0.5rem;
}
</style>
