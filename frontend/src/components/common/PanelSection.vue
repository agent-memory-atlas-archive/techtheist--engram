<script setup lang="ts">
/**
 * A titled block of any panel or card — the one section heading the pane
 * has (caption, uppercase, tertiary). `#actions` sits right of the title.
 */
defineProps<{ title: string }>()
</script>

<template>
<section class="ui-section">
    <header class="ui-section-head">
        <h3 class="ui-section-title">{{ title }}</h3>
        <span v-if="$slots.actions" class="ui-section-actions"><slot name="actions" /></span>
    </header>
    <slot />
</section>
</template>

<style scoped>
.ui-section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
}

.ui-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    min-height: 2.4rem;
}

.ui-section-title {
    margin: 0;
    color: var(--text-tertiary);
    font-size: var(--text-caption);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.ui-section-actions {
    display: flex;
    gap: 0.6rem;
}
</style>
