<script setup lang="ts">
/**
 * One row that leads somewhere: a connection, a linked note, a task in a
 * group. `#lead` holds the row's marker (an arrow and verb, a type chip, a
 * status), the title opens the target, and × (when `removable`) unlinks.
 */
defineProps<{ title: string; removable?: boolean; struck?: boolean; disabled?: boolean; removeLabel?: string }>()
const emit = defineEmits<{ (e: 'open'): void; (e: 'remove'): void }>()
</script>

<template>
<li class="ui-link-row">
    <slot name="lead" />
    <button class="target" type="button" :class="{ struck }" @click="emit('open')">
        <span class="target-text">{{ title }}</span>
    </button>
    <slot name="trail" />
    <button
        v-if="removable"
        class="remove"
        type="button"
        :disabled="disabled"
        :aria-label="removeLabel ?? `Remove ${title}`"
        :title="removeLabel ?? 'Remove'"
        @click="emit('remove')"
    >
        ×
    </button>
</li>
</template>

<style scoped>
.ui-link-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    min-width: 0;
}

.target {
    display: flex;
    flex: 1;
    min-width: 0;
    padding: 0.6rem 0.8rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    text-align: left;
    cursor: pointer;
}

.target:hover {
    background-color: var(--interactive-ghost-hover);
}

.target-text {
    overflow: hidden;
    color: var(--text-primary);
    font-size: var(--text-body-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.struck .target-text {
    color: var(--text-tertiary);
    text-decoration: line-through;
}

.remove {
    flex: none;
    border: none;
    background: transparent;
    color: var(--text-tertiary);
    font-size: 1.6rem;
    line-height: 1;
    cursor: pointer;
}

.remove:hover:not(:disabled) {
    color: var(--node-problem);
}
</style>
