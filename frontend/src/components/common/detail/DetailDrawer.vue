<script setup lang="ts">
import SidePanel from '@/components/common/SidePanel.vue'

/**
 * The one right-edge detail card (0.10.0): nodes and tasks open in the same
 * shell so they read alike in every theme — a kind pill tinted with the
 * accent, the title, a badge row, the body, titled sections, and an actions
 * footer. Content stays the caller's; order and type sizes live here and in
 * the Detail* parts.
 */
defineProps<{
    open: boolean
    panelId: string
    /** The pill: the node's type, "Task", "Group". */
    kind: string
    /** Any CSS color (a var() is fine) — the pill tint and the edge strip. */
    accent: string
    dismiss: () => void
}>()
</script>

<template>
<SidePanel
    :open="open"
    side="right"
    :panel-id="panelId"
    :default-rem="42"
    :min-rem="28"
    :dismiss="dismiss"
    :accent="accent"
    :style="{ '--accent': accent }"
>
    <template #header>
        <header class="head">
            <span class="kind">{{ kind }}</span>
            <button class="close" type="button" aria-label="Close" @click="dismiss">×</button>
        </header>
    </template>

    <div class="title-row"><slot name="title" /></div>
    <div v-if="$slots.badges" class="badges"><slot name="badges" /></div>
    <slot />
    <footer v-if="$slots.actions" class="actions"><slot name="actions" /></footer>
</SidePanel>
</template>

<style scoped>
.head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.kind {
    padding: 0.3rem 0.9rem;
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    border-radius: var(--radius-md);
    background-color: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--accent);
    font-size: var(--text-caption);
    font-weight: 600;
}

.close {
    border: none;
    background: transparent;
    color: var(--text-tertiary);
    font-size: 2.4rem;
    line-height: 1;
    cursor: pointer;
}

.close:hover {
    color: var(--text-primary);
}

.title-row {
    min-width: 0;
}

.badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-top: auto;
    padding-top: 0.6rem;
}
</style>
