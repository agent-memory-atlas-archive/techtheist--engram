<script setup lang="ts">
/**
 * A screen's wireframe (0.10.0): what slides in while the real screen is
 * still being built — a handful of plain blocks in the screen's own layout,
 * so the transition stays smooth however big the graph is. Shown only for a
 * screen's first visit before the idle prewarm built it (App.vue `warm`).
 */
defineProps<{ kind: 'feed' | 'tasks' | 'history' }>()

const FEED_CARDS = [11, 8, 13, 9]
const TASK_COLUMNS = [3, 2, 1, 2]
const LANES = 9
const BUBBLES = [['user', 5], ['assistant', 9], ['user', 4], ['assistant', 7]] as const
</script>

<template>
<div class="skeleton" :class="kind" aria-busy="true" aria-label="Loading">
    <template v-if="kind === 'feed'">
        <div class="feed-col">
            <div v-for="(h, i) in FEED_CARDS" :key="i" class="block card" :style="{ height: `${h}rem` }" />
        </div>
    </template>

    <template v-else-if="kind === 'tasks'">
        <div v-for="(n, c) in TASK_COLUMNS" :key="c" class="task-col">
            <div class="block head" />
            <div v-for="i in n" :key="i" class="block task" />
        </div>
    </template>

    <template v-else>
        <div class="lanes">
            <div v-for="i in LANES" :key="i" class="block lane" />
        </div>
        <div class="thread">
            <div v-for="([who, h], i) in BUBBLES" :key="i" class="block bubble" :class="who" :style="{ height: `${h}rem` }" />
        </div>
    </template>
</div>
</template>

<style scoped>
.skeleton {
    position: absolute;
    inset: 5.6rem 0 0;
    display: flex;
    gap: 12px;
    padding: 12px;
    overflow: hidden;
    pointer-events: none;
}

/* A slow sheen: reads as "arriving", not as content. */
.block {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    background:
        linear-gradient(
            100deg,
            transparent 30%,
            color-mix(in srgb, var(--text-primary) 5%, transparent) 50%,
            transparent 70%
        )
        0 0 / 300% 100%,
        var(--surface-elevated);
    animation: sheen 1.4s ease-in-out infinite;
}

@keyframes sheen {
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
    .block {
        animation: none;
    }
}

/* Feed: the centered card column. */
.feed {
    justify-content: center;
    padding-top: 14vh;
}

.feed-col {
    display: flex;
    flex-direction: column;
    gap: 1.6rem;
    width: min(72rem, 100%);
}

/* Tasks: the four status columns. */
.task-col {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
}

.head {
    width: 40%;
    height: 1.6rem;
    border-radius: var(--radius-md);
}

.task {
    height: 7rem;
}

/* History: lanes on the left, a conversation beside them. */
.lanes {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 6px;
    width: 300px;
}

.lane {
    height: 4.4rem;
    border-radius: var(--radius-md);
}

.thread {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    max-width: 900px;
    margin: 0 auto;
}

.bubble {
    width: 60%;
}

.bubble.assistant {
    align-self: flex-end;
}

@media (width <= 719px) {
    .lanes {
        width: 100%;
    }

    .thread,
    .task-col:not(:first-child) {
        display: none;
    }
}
</style>
