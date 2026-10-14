<script setup lang="ts">
import NoteText from '@/components/common/NoteText.vue'

/**
 * One labelled control in a form: the caption label above, the control,
 * an optional hint below. Every panel's forms use it, so labels and hints
 * read the same everywhere.
 */
defineProps<{ label: string; hint?: string }>()
</script>

<template>
<label class="ui-form-field">
    <span class="ui-form-label">{{ label }}</span>
    <slot />
    <NoteText v-if="hint" as="span">{{ hint }}</NoteText>
</label>
</template>

<style scoped>
.ui-form-field {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
}

.ui-form-label {
    color: var(--text-tertiary);
    font-size: var(--text-caption);
}
</style>
