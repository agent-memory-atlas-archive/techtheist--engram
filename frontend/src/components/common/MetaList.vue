<script setup lang="ts">
/** Label/value rows (provenance, system facts); children are MetaRow. */
</script>

<template>
<dl class="meta"><slot /></dl>
</template>

<style scoped>
.meta {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin: 0;
    font-size: var(--text-caption);
}
</style>
