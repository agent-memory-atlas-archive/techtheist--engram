<script setup lang="ts">
import NoteText from '@/components/common/NoteText.vue'
import UiButton from '@/components/common/UiButton.vue'
import ToggleSwitch from '@/components/common/ToggleSwitch.vue'
import { computed, ref, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useConfigStore } from '@/stores/config'
import { trustLevel, useGraphStore, type GraphFilters } from '@/stores/graph'
import { useHistoryStore } from '@/stores/history'
import { useLayoutStore } from '@/stores/layout'
import { NO_VERSION, TASK_FLAGS, originLabel, useTasksStore, type TaskFilters } from '@/stores/tasks'

/**
 * The top bar's Filter — one button in one place, filtering whatever the
 * current screen shows (0.10.0): the graph and the feed by note facets, the
 * task board by version / who created it / flags, the history lanes by
 * assistant and version. Pure client side: every option list is gathered
 * from what is loaded, so only values that actually occur are offered.
 */
const store = useGraphStore()
const config = useConfigStore()
const tasks = useTasksStore()
const history = useHistoryStore()
const layout = useLayoutStore()
const { nodeList, filters } = storeToRefs(store)

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
onClickOutside(root, () => (open.value = false))

interface Section {
    key: string
    label: string
    values: string[]
}

interface Source {
    title: string
    sections: Section[]
    count: number
    isOn: (key: string, value: string) => boolean
    toggle: (key: string, value: string) => void
    clear: () => void
    accent?: (key: string, value: string) => string | undefined
}

const sorted = (set: Set<string>): string[] => [...set].sort()

type Group = Exclude<keyof GraphFilters, 'showArchived'>

function memorySource(): Source {
    const types = new Set<string>()
    const durabilities = new Set<string>()
    const sources = new Set<string>()
    const statuses = new Set<string>()
    const trust = new Set<string>()
    const tags = new Set<string>()
    for (const n of nodeList.value) {
        types.add(n.type)
        durabilities.add(n.durability)
        sources.add(n.source)
        if (n.status) statuses.add(n.status)
        trust.add(trustLevel(n))
        for (const t of n.tags) tags.add(t)
    }
    const section = (key: Group, label: string, set: Set<string>): Section => ({ key, label, values: sorted(set) })
    return {
        title: layout.view === 'feed' ? 'Filter the feed' : 'Filter the canvas',
        sections: [
            section('types', 'Type', types),
            // Even a lone tag partitions the graph (unlike the property groups,
            // where a single value means every node matches).
            section('tags', 'Tags', tags),
            section('statuses', 'Status', statuses),
            section('trust', 'Trust', trust),
            section('sources', 'Source', sources),
            section('durabilities', 'Durability', durabilities),
        ].filter((s) => (s.key === 'tags' ? s.values.length > 0 : s.values.length > 1)),
        count: store.activeFilterCount,
        isOn: (key, value) => filters.value[key as Group].includes(value),
        toggle: (key, value) => store.toggleFilter(key as Group, value),
        clear: () => store.clearFilters(),
        accent: (key, value) => (key === 'types' ? config.accent(value) : undefined),
    }
}

function taskSource(): Source {
    const versions = new Set<string>()
    const origins = new Set<string>()
    const flags = new Set<string>()
    for (const t of tasks.tasks) {
        versions.add(t.version ?? NO_VERSION)
        origins.add(originLabel(t))
        for (const [flag, test] of Object.entries(TASK_FLAGS)) if (test(t)) flags.add(flag)
    }
    return {
        title: 'Filter the board',
        sections: [
            { key: 'versions', label: 'Version', values: sorted(versions) },
            { key: 'origins', label: 'Created by', values: sorted(origins) },
            { key: 'flags', label: 'Only', values: Object.keys(TASK_FLAGS).filter((f) => flags.has(f)) },
        ].filter((s) => (s.key === 'flags' ? s.values.length > 0 : s.values.length > 1)),
        count: tasks.activeFilterCount,
        isOn: (key, value) => tasks.filters[key as keyof TaskFilters].includes(value),
        toggle: (key, value) => tasks.toggleFilter(key as keyof TaskFilters, value),
        clear: () => tasks.clearFilters(),
    }
}

function historySource(): Source {
    const harnesses = new Set<string>()
    const versions = new Set<string>()
    for (const s of history.sessions) {
        harnesses.add(s.harness ?? 'unknown')
        versions.add(s.version ?? 'no version')
    }
    return {
        title: 'Filter the sessions',
        sections: [
            { key: 'harnesses', label: 'Assistant', values: sorted(harnesses) },
            { key: 'versions', label: 'Version', values: sorted(versions) },
        ].filter((s) => s.values.length > 1),
        count: history.activeFilterCount,
        isOn: (key, value) => history.filters[key as 'harnesses' | 'versions'].includes(value),
        toggle: (key, value) => history.toggleFilter(key as 'harnesses' | 'versions', value),
        clear: () => history.clearFilters(),
    }
}

const source = computed<Source>(() =>
    layout.view === 'tasks' ? taskSource() : layout.view === 'history' ? historySource() : memorySource(),
)

/** Archived notes exist only on the memory screens. */
const hasArchived = computed(
    () => (layout.view === 'graph' || layout.view === 'feed') && nodeList.value.some((n) => n.valid_until != null),
)
</script>

<template>
<div ref="root" class="filter-root">
    <button
        class="toggle"
        type="button"
        :class="{ active: open || source.count > 0 }"
        :title="source.title"
        @click="open = !open"
    >
        Filter
        <span v-if="source.count" class="count">{{ source.count }}</span>
    </button>

    <Transition name="pop">
        <div v-if="open" class="popover glass-panel">
            <section v-for="s in source.sections" :key="s.key" class="group">
                <h3 class="group-title">{{ s.label }}</h3>
                <div class="chips">
                    <button
                        v-for="v in s.values"
                        :key="v"
                        class="chip"
                        type="button"
                        :class="{ on: source.isOn(s.key, v) }"
                        :style="source.accent?.(s.key, v) ? { '--chip-accent': source.accent(s.key, v) } : undefined"
                        @click="source.toggle(s.key, v)"
                    >
                        {{ v }}
                    </button>
                </div>
            </section>
            <NoteText v-if="!source.sections.length && !hasArchived">Nothing to filter here yet.</NoteText>

            <ToggleSwitch v-if="hasArchived" v-model="filters.showArchived" class="archived-row" label="Show archived" />

            <UiButton v-if="source.count" size="sm" variant="ghost" class="clear" @click="source.clear()">
                Clear all filters
            </UiButton>
        </div>
    </Transition>
</div>
</template>

<style scoped>
.filter-root {
    position: relative;
}

.toggle {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 1.2rem;
    border-radius: var(--radius-control);
    border: 1px solid var(--border-default);
    background-color: var(--surface-glass);
    backdrop-filter: var(--glass-backdrop);
    color: var(--control-text);
    font-size: var(--text-label);
    font-weight: 600;
    cursor: pointer;
}

.toggle:hover,
.toggle.active {
    color: var(--text-primary);
    background-image: linear-gradient(var(--node-hover-surface), var(--node-hover-surface));
}

.count {
    min-width: 1.8rem;
    padding: 0.1rem 0.5rem;
    border-radius: var(--radius-full);
    background-color: var(--interactive-primary);
    color: var(--text-inverse);
    font-size: var(--text-caption);
    text-align: center;
}

.popover {
    position: absolute;
    top: calc(100% + 0.8rem);
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    width: 30rem;
    max-height: 70vh;
    overflow-y: auto;
    padding: 1.4rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
}

.pop-enter-active,
.pop-leave-active {
    transition:
        transform var(--duration-fast) var(--ease-default),
        opacity var(--duration-fast) var(--ease-default);
}

.pop-enter-from,
.pop-leave-to {
    transform: translateY(-0.4rem);
    opacity: 0;
}

.group-title {
    margin-bottom: 0.5rem;
    font-size: var(--text-caption);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
}

.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.chip {
    --chip-accent: var(--interactive-primary);
    padding: 0.3rem 0.9rem;
    border-radius: var(--radius-full);
    border: 1px solid var(--border-default);
    background-color: transparent;
    color: var(--text-secondary);
    font-size: var(--text-caption);
    font-weight: 600;
    cursor: pointer;
}

.chip:hover {
    color: var(--text-primary);
    background-color: var(--interactive-ghost-hover);
}

.chip.on {
    color: var(--chip-accent);
    border-color: color-mix(in srgb, var(--chip-accent) 55%, transparent);
    background-color: color-mix(in srgb, var(--chip-accent) 14%, transparent);
}


.clear {
    align-self: flex-start;
}

</style>
