<script setup lang="ts">
import { ref } from 'vue'
import InfoBadge from '@/components/common/InfoBadge.vue'
import MarkdownView from '@/components/common/MarkdownView.vue'
import { trustLevel, useGraphStore } from '@/stores/graph'
import { useConfigStore } from '@/stores/config'
import type { GraphEdge, GraphNode } from '@/types/graph'

/**
 * One feed card (0.10.1: lifted out of FeedView). Its own component so a
 * scroll re-renders only the cards whose focus or expansion changed — the
 * list used to rebuild all of its cards every time the centered one moved
 * (~120 ms a frame at a thousand notes). `skeleton` is the stand-in the
 * feed shows while a fast scroll outruns mounting: same box, gray bars.
 */
const props = defineProps<{
    node: GraphNode
    focus?: boolean
    expanded?: boolean
    skeleton?: boolean
    drifted?: boolean
    outEdges: readonly GraphEdge[]
    inEdges: readonly GraphEdge[]
    missingRefs: readonly string[]
}>()

const emit = defineEmits<{ traverse: [id: string]; center: [id: string] }>()

const store = useGraphStore()
const config = useConfigStore()

const EDGE_CAP = 6

function title(id: string): string {
    return store.nodes.get(id)?.title ?? id
}

const levelWord: Record<ReturnType<typeof trustLevel>, string> = {
    pinned: 'pinned',
    trusted: 'trusted',
    provisional: 'provisional',
    stale: 'stale',
}

// One formatter each, shared: toLocale*String builds a fresh one per call,
// which was the single largest cost of rendering the feed.
const DAY = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const STAMP = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** The provenance line, built when the pointer reaches the date. */
const tip = ref('')
function fillTip(): void {
    const n = props.node
    const lines = [`Created ${STAMP.format(n.created_at * 1000)} · by ${n.source}`]
    if (n.last_seen != null) lines.push(`Last retrieved ${STAMP.format(n.last_seen * 1000)}`)
    if (n.valid_until != null) lines.push(`Archived ${STAMP.format(n.valid_until * 1000)}`)
    tip.value = lines.join('\n')
}
</script>

<template>
<article
    v-if="skeleton"
    class="card skeleton glass-panel"
    :class="{ archived: node.valid_until != null }"
    :style="{ '--card-accent': config.accent(node.type) }"
    aria-hidden="true"
>
    <span class="bar head" />
    <span class="bar title" />
    <span v-if="node.body" class="bar line" />
    <span v-if="node.body" class="bar line" />
    <span v-if="node.body" class="bar line short" />
    <span class="bar meta" />
</article>

<article
    v-else
    class="card glass-panel"
    :data-node-id="node.id"
    :class="{ archived: node.valid_until != null, focus }"
    :style="{ '--card-accent': config.accent(node.type) }"
>
    <header class="card-head">
        <span class="type-dot" />
        <span class="type-name">{{ node.type }}</span>
        <InfoBadge v-if="node.version" pill>{{ node.version }}</InfoBadge>
        <InfoBadge
            v-if="node.status"
            pill
            :tone="node.status === 'resolved' ? 'ok' : node.status === 'open' ? 'accent' : 'neutral'"
        >
            {{ node.status }}
        </InfoBadge>
        <InfoBadge v-if="node.valid_until != null" pill tone="muted">archived</InfoBadge>
        <InfoBadge v-if="drifted" pill tone="warn">drifted</InfoBadge>
        <span class="spacer" />
        <span class="date" :title="tip" @mouseenter="fillTip">{{ DAY.format(node.created_at * 1000) }}</span>
    </header>

    <h3 class="card-title">
        <button type="button" class="title-btn" title="Center this card" @click="emit('center', node.id)">
            {{ node.title }}
        </button>
    </h3>

    <!-- Full markdown always rendered, clipped to a preview; the settled
         centered card un-clips. Same content in both states — the reveal
         never swaps or reflows the text. -->
    <div v-if="node.body" class="card-body" :class="{ expanded }">
        <MarkdownView :content="node.body" />
    </div>

    <div class="trust-line">
        <span class="trust-dot" :class="trustLevel(node)" />
        <span class="trust-word" :class="trustLevel(node)">
            {{ levelWord[trustLevel(node)] }} · {{ Math.round(node.trust * 100) }}%
        </span>
        <span v-if="node.tags.length" class="tags">
            <span v-for="t in node.tags" :key="t" class="tag">#{{ t }}</span>
        </span>
    </div>

    <div v-if="node.code_refs.length" class="refs">
        <span
            v-for="codeRef in node.code_refs"
            :key="codeRef"
            class="ref-chip"
            :class="{ missing: missingRefs.includes(codeRef) }"
            :title="missingRefs.includes(codeRef) ? `${codeRef} — this file no longer exists in the project` : codeRef"
        >{{ codeRef }}</span>
    </div>

    <div v-if="outEdges.length || inEdges.length" class="edges">
        <button
            v-for="e in outEdges.slice(0, EDGE_CAP)"
            :key="e.id"
            class="edge-chip"
            type="button"
            :style="{ '--edge-accent': config.edgeColor(e.type) }"
            :title="`${node.title} ${e.type} ${title(e.to_id)}`"
            @click="emit('traverse', e.to_id)"
        >
            <span class="edge-verb">{{ e.type }} →</span>
            <span class="edge-target">{{ title(e.to_id) }}</span>
        </button>
        <button
            v-for="e in inEdges.slice(0, EDGE_CAP)"
            :key="e.id"
            class="edge-chip in"
            type="button"
            :style="{ '--edge-accent': config.edgeColor(e.type) }"
            :title="`${title(e.from_id)} ${e.type} ${node.title}`"
            @click="emit('traverse', e.from_id)"
        >
            <span class="edge-verb">← {{ e.type }}</span>
            <span class="edge-target">{{ title(e.from_id) }}</span>
        </button>
    </div>
</article>
</template>

<style scoped>
.card {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    width: 100%;
    padding: 1.4rem 1.6rem;

    /* Accent spine as a gradient — follows the rounded corners cleanly.
       Sized to the strip so the texture never reaches the right edge
       (full-width gradients bleed a 1px wrap line under transforms). */
    background-image: linear-gradient(
        90deg,
        var(--card-accent, var(--border-strong)) 0,
        var(--card-accent, var(--border-strong)) 0.3rem,
        color-mix(in srgb, var(--card-accent, var(--border-strong)) calc(10% * var(--accent-wash, 1)), transparent) 0.3rem,
        transparent 100%
    );
    background-repeat: no-repeat;
    background-size: 7rem 100%;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    transition: box-shadow var(--duration-normal) var(--ease-default);
}

.card.focus {
    box-shadow: var(--shadow-lg);
}

.card.archived {
    background-image: linear-gradient(
        90deg,
        color-mix(in srgb, var(--card-accent, var(--border-strong)) 45%, transparent) 0,
        color-mix(in srgb, var(--card-accent, var(--border-strong)) 45%, transparent) 100%
    );
    background-size: 0.3rem 100%;
}

/* The skeleton fills the measured height of the card it stands in for. */
.card.skeleton {
    height: 100%;
    overflow: hidden;
}

.bar {
    flex-shrink: 0;
    height: 0.9rem;
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--text-tertiary) 22%, transparent);
}

.bar.head {
    width: 9rem;
    height: 0.8rem;
    background: color-mix(in srgb, var(--card-accent, var(--text-tertiary)) 40%, transparent);
}

.bar.title {
    width: 62%;
    height: 1.4rem;
    background: color-mix(in srgb, var(--text-primary) 22%, transparent);
}

.bar.line {
    width: 94%;
}

.bar.line.short {
    width: 56%;
}

.bar.meta {
    width: 14rem;
    height: 0.7rem;
}

.card-head {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-width: 0;
}

.type-dot {
    flex-shrink: 0;
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 50%;
    background: var(--card-accent);
}

.type-name {
    font-size: var(--text-caption);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--card-accent);
}

.spacer {
    flex: 1;
}

.date {
    font-family: var(--font-mono);
    font-size: var(--text-caption);
    color: var(--text-tertiary);
    white-space: nowrap;
}

.card-title {
    margin: 0;
    font-size: var(--text-h3);
    font-weight: 600;
    line-height: var(--leading-tight);
}

.title-btn {
    padding: 0;
    border: none;
    background: none;
    color: var(--text-primary);
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.title-btn:hover {
    color: var(--interactive-primary-hover);
}

/* Preview = the full markdown clipped to a fixed height (constant geometry);
   the settled centered card un-clips. Same rendered content in both states,
   so the reveal only extends downward — the visible text never moves. */
.card-body {
    margin: 0;
    overflow: hidden;
    max-height: 12rem;
    font-size: var(--text-body-sm);
    line-height: var(--leading-normal);
    color: var(--text-secondary);
    overflow-wrap: anywhere;
    transition: max-height 350ms var(--ease-default);
}

.card-body.expanded {
    /* A realistic cap, not `none`: max-height must stay animatable, and the
       closer the cap is to real content heights, the truer the timing. */
    max-height: 120rem;
}

.trust-line {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
}

.trust-dot {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
}

.trust-dot.trusted,
.trust-dot.pinned {
    background: var(--trust-trusted);
}

.trust-dot.provisional {
    background: var(--trust-provisional);
}

.trust-word {
    font-family: var(--font-mono);
    font-size: var(--text-caption);
    color: var(--text-tertiary);
}

.tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.tag {
    font-size: var(--text-caption);
    color: var(--text-tertiary);
}

/* Code refs, same chips as the node detail — a card should say what code it
   is about, and which of those files have since moved away. */
.refs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.ref-chip {
    overflow: hidden;
    max-width: 100%;
    padding: 0.2rem 0.7rem;
    border-radius: var(--radius-sm);
    background: var(--surface-sunken);
    font-family: var(--font-mono);
    font-size: var(--text-caption);
    color: var(--text-tertiary);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ref-chip.missing {
    color: var(--node-problem);
    background: color-mix(in srgb, var(--node-problem) 12%, transparent);
    text-decoration: line-through;
}

.edges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.edge-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 100%;
    padding: 0.35rem 0.9rem;
    border: 1px solid color-mix(in srgb, var(--edge-accent) 45%, transparent);
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--edge-accent) 10%, transparent);
    font-size: var(--text-caption);
    cursor: pointer;
}

.edge-chip:hover {
    background: color-mix(in srgb, var(--edge-accent) 20%, transparent);
}

.edge-verb {
    flex-shrink: 0;
    color: var(--edge-accent);
    font-weight: 600;
    white-space: nowrap;
}

.edge-target {
    overflow: hidden;
    max-width: 26rem;
    color: var(--text-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
}

@media (width <= 700px) {
    .card {
        gap: 0.7rem;
        padding: 1.1rem 1.2rem;
    }

    .card-head {
        gap: 0.5rem;
    }

    .card-title {
        font-size: var(--text-body);
    }
}
</style>
