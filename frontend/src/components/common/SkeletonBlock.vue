<script setup lang="ts">
/**
 * A placeholder of known size while something loads — the one shimmer the
 * pane uses (screen wireframes, a drawer line that arrives late), so late
 * content takes its space instead of pushing the layout down.
 */
withDefaults(defineProps<{ width?: string; height?: string }>(), { width: '100%', height: '1.6rem' })
</script>

<template>
<span class="ui-skeleton" :style="{ width, height }" aria-hidden="true" />
</template>

<style scoped>
.ui-skeleton {
    display: block;
    flex: none;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background:
        linear-gradient(
            100deg,
            transparent 30%,
            color-mix(in srgb, var(--text-primary) 5%, transparent) 50%,
            transparent 70%
        )
        0 0 / 300% 100%,
        var(--surface-elevated);
    animation: ui-skeleton-sheen 1.4s ease-in-out infinite;
}

@keyframes ui-skeleton-sheen {
    from {
        background-position:
            100% 0,
            0 0;
    }

    to {
        background-position:
            0 0,
            0 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .ui-skeleton {
        animation: none;
    }
}
</style>
