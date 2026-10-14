<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
<div class="row">
    <dt>{{ label }}</dt>
    <dd><slot /></dd>
</div>
</template>

<style scoped>
.row {
    display: flex;
    gap: 0.8rem;
}

dt {
    flex: none;
    width: 7rem;
    color: var(--text-tertiary);
}

dd {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    min-width: 0;
    margin: 0;
    color: var(--text-secondary);
    overflow-wrap: anywhere;
}
</style>
