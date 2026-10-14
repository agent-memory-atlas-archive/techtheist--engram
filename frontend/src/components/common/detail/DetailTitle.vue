<script setup lang="ts">
import { ref, watch } from 'vue'
import AutoTextarea from '@/components/common/AutoTextarea.vue'

/**
 * The detail card's title: one size and weight for every kind. Editable
 * titles stay text until hovered or focused, then show the field's edge;
 * Enter or leaving the field commits, Escape restores.
 */
const props = defineProps<{ text: string; editable?: boolean }>()
const emit = defineEmits<{ (e: 'commit', v: string): void }>()

const draft = ref(props.text)
watch(
    () => props.text,
    (t) => (draft.value = t),
)

function commit(): void {
    const t = draft.value.trim()
    if (t && t !== props.text) emit('commit', t)
    else draft.value = props.text
}
</script>

<template>
<!-- Wraps like the static title (a one-line input would cut long titles);
     Enter commits instead of adding a line. -->
<AutoTextarea
    v-if="editable"
    v-model="draft"
    class="ui-title ui-title--editable"
    :rows="1"
    aria-label="Title"
    @blur="commit"
    @keydown.enter.prevent="($event.target as HTMLTextAreaElement).blur()"
    @keydown.esc.prevent="draft = text; ($event.target as HTMLTextAreaElement).blur()"
/>
<h2 v-else class="ui-title">{{ text }}</h2>
</template>

<style scoped>
.ui-title {
    width: 100%;
    margin: 0;
    color: var(--text-primary);
    font-family: inherit;
    font-size: var(--text-h2);
    font-weight: 700;
    line-height: var(--leading-tight);
    overflow-wrap: anywhere;
}

.ui-title--editable {
    width: calc(100% + 1.2rem);
    margin-left: -0.6rem;
    padding: 0.2rem 0.6rem;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
}

.ui-title--editable:hover {
    border-color: var(--border-default);
}

.ui-title--editable:focus {
    border-color: var(--border-strong);
    background-color: var(--surface-sunken);
    outline: none;
}
</style>
