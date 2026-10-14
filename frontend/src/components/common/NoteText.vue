<script setup lang="ts">
/**
 * Small explanatory text: a hint under a control, a note after a run, an
 * empty state, an error. One size and color per tone across every panel.
 */
withDefaults(defineProps<{ tone?: 'hint' | 'body' | 'ok' | 'warn' | 'error' | 'empty'; as?: 'p' | 'span' | 'div' }>(), {
    tone: 'hint',
    as: 'p',
})
</script>

<template>
<component :is="as" class="ui-note" :class="`ui-note--${tone}`"><slot /></component>
</template>

<style scoped>
.ui-note {
    margin: 0;
    color: var(--text-tertiary);
    font-size: var(--text-caption);
    line-height: var(--leading-normal);
}

.ui-note :deep(code) {
    padding: 0.1rem 0.4rem;
    border-radius: var(--radius-sm);
    background-color: var(--surface-sunken);
    font-family: var(--font-mono);
}

.ui-note--body {
    color: var(--text-secondary);
}

.ui-note--ok {
    color: var(--node-resolution);
}

.ui-note--warn {
    color: var(--node-caution);
}

.ui-note--error {
    color: var(--node-problem);
}

.ui-note--empty {
    padding: 0.6rem 0;
    font-size: var(--text-body-sm);
}
</style>
