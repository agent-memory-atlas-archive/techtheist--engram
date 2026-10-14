<script setup lang="ts">
/** A titled block of the detail card; `#actions` sits right of the title. */
defineProps<{ title: string }>()
</script>

<template>
<section class="section">
    <header class="section-head">
        <h3 class="section-title">{{ title }}</h3>
        <span v-if="$slots.actions" class="section-actions"><slot name="actions" /></span>
    </header>
    <slot />
</section>
</template>

<style scoped>
.section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
}

.section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    min-height: 2.4rem;
}

.section-title {
    margin: 0;
    color: var(--text-tertiary);
    font-size: var(--text-caption);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.section-actions {
    display: flex;
    gap: 0.6rem;
}
</style>
