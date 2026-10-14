<script setup lang="ts">
/** One MetaList row. `mono` sets the value in the mono face (paths, ids);
 *  `monoLabel` the label (agent names). */
defineProps<{ label: string; mono?: boolean; monoLabel?: boolean }>()
</script>

<template>
<div class="ui-meta-row">
    <dt :class="{ mono: monoLabel }">{{ label }}</dt>
    <dd :class="{ mono }"><slot /></dd>
</div>
</template>

<style scoped>
.ui-meta-row {
    display: flex;
    gap: 0.8rem;
    align-items: baseline;
}

dt {
    flex: none;
    width: var(--meta-label-width, 7rem);
    color: var(--text-tertiary);
    font-size: var(--text-caption);
}

dt.mono {
    color: var(--text-secondary);
    font-family: var(--font-mono);
}

dd {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: baseline;
    min-width: 0;
    margin: 0;
    color: var(--meta-value-color, var(--text-secondary));
    font-size: var(--meta-value-size, var(--text-caption));
    overflow-wrap: anywhere;
}

dd.mono {
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: var(--text-caption);
}
</style>
