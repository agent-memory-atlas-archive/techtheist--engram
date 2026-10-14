<script setup lang="ts">
/**
 * The pane's single-line field: sunken, the field radius (never the pill
 * radius buttons use), one type size. `mono` for paths, ids and versions.
 * Native attributes and listeners fall through to the <input>.
 */
defineProps<{ modelValue: string; mono?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
</script>

<template>
<input
    class="field"
    :class="{ mono }"
    :value="modelValue"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
/>
</template>

<style scoped>
.field {
    width: 100%;
    min-width: 0;
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background-color: var(--surface-sunken);
    color: var(--text-primary);
    font-family: inherit;
    font-size: var(--text-body-sm);
}

.field:focus {
    border-color: var(--border-strong);
    outline: none;
}

.field::placeholder {
    color: var(--text-tertiary);
}

.mono {
    font-family: var(--font-mono);
}
</style>
