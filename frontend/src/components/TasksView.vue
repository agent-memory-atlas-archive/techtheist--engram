<script setup lang="ts">
import InfoBadge from '@/components/common/InfoBadge.vue'
import NoteText from '@/components/common/NoteText.vue'
import UiButton from '@/components/common/UiButton.vue'
import AutoTextarea from '@/components/common/AutoTextarea.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import SegmentedControl from '@/components/common/SegmentedControl.vue'
import { useGraphStore } from '@/stores/graph'
import { useLayoutStore } from '@/stores/layout'
import { isOpen, STATUS_LABELS, useTasksStore } from '@/stores/tasks'
import type { TaskStatus, TaskView } from '@/types/graph'

/**
 * The tasks screen (0.10.0): the working list beside the graph as a board.
 * Tasks are not knowledge — they never enter the canvas, search or the feed;
 * this is where a person sees (and steers) what the assistant is doing.
 * Columns are statuses; dragging a card reorders it (the brief's order) or
 * moves it to another column (its status). Groups carry their tasks inside
 * the card. Closed work is kept, never deleted — it folds into one column.
 */
const tasks = useTasksStore()
const graph = useGraphStore()
const layout = useLayoutStore()
const { topLevel, visibleTopLevel, error, loaded, selectedId } = storeToRefs(tasks)

onMounted(() => {
    void tasks.load()
})

// Kept alive under other screens (App): refresh the board on each return
// (rules settle at read time, so a reload is the current truth).
watch(
    () => layout.view,
    (view) => {
        if (view === 'tasks') void tasks.load()
    },
)

type Column = 'active' | 'delayed' | 'backlog' | 'closed'
const COLUMNS: { id: Column; label: string; hint: string }[] = [
    { id: 'active', label: 'Active', hint: 'Being worked on — what the brief lists' },
    { id: 'delayed', label: 'Delayed', hint: 'Parked with a reason or a wake rule' },
    { id: 'backlog', label: 'Backlog', hint: 'Someday, no plan yet' },
    { id: 'closed', label: 'Closed', hint: 'Done and dropped — kept, never deleted' },
]

const columnOf = (t: TaskView): Column => (isOpen(t.status) ? (t.status as Column) : 'closed')

const columns = computed(() => {
    const out: Record<Column, TaskView[]> = { active: [], delayed: [], backlog: [], closed: [] }
    for (const t of visibleTopLevel.value) out[columnOf(t)].push(t)
    return out
})

/** Narrow panes show one column at a time. */
const narrowColumn = ref<Column>('active')
const columnOptions = computed(() =>
    COLUMNS.map((c) => ({ value: c.id, label: c.label, count: columns.value[c.id].length })),
)

// --- quick add -------------------------------------------------------------

const draft = ref('')
const addError = ref<string | null>(null)
const notice = ref<string | null>(null)

async function quickAdd(parent?: string, title?: string): Promise<boolean> {
    // The composer's first line is the title; anything below becomes the plan.
    const [first, ...rest] = (title ?? draft.value).trim().split('\n')
    const text = (first ?? '').trim()
    if (!text) return false
    const body = rest.join('\n').trim() || undefined
    addError.value = null
    notice.value = null
    try {
        const w = await tasks.create({ title: text, body, parent })
        if (w.matched) {
            notice.value = `An open task already covers this: “${w.matched.title}”.`
            tasks.open(w.matched.id)
            return false
        }
        if (w.auto_close) notice.value = `Closes on its own once the working version is ${w.auto_close}.`
        if (title == null) draft.value = ''
        return true
    } catch (e) {
        addError.value = e instanceof Error ? e.message : String(e)
        return false
    }
}

const childDrafts = ref<Record<string, string>>({})
async function addChild(group: string): Promise<void> {
    if (await quickAdd(group, childDrafts.value[group] ?? '')) childDrafts.value[group] = ''
}

// --- status toggles ----------------------------------------------------------

/** A closed group follows its tasks: dragging or reopening it alone would
 *  close it again at once, so only its tasks move it. */
function isClosedGroup(t: TaskView): boolean {
    return !!t.progress && !isOpen(t.status)
}

async function toggleDone(t: TaskView): Promise<void> {
    if (isClosedGroup(t)) return
    await tasks.patch(t.id, { status: isOpen(t.status) ? 'done' : 'active' })
}

// --- drag: reorder within a column, move between columns ---------------------

const dragId = ref<string | null>(null)
const overId = ref<string | null>(null)
const overColumn = ref<Column | null>(null)

function onDragStart(e: DragEvent, t: TaskView): void {
    dragId.value = t.id
    e.dataTransfer?.setData('text/plain', t.id)
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragEnd(): void {
    dragId.value = null
    overId.value = null
    overColumn.value = null
}

async function onDrop(col: Column): Promise<void> {
    const id = dragId.value
    const before = overId.value
    onDragEnd()
    if (!id) return
    const task = tasks.byId.get(id)
    if (!task) return
    // Into Closed = done (a closed card stays as it was); into an open column
    // = that status — which is how closed work comes back.
    const target: TaskStatus = col === 'closed' ? (isOpen(task.status) ? 'done' : task.status) : col
    if (target !== task.status) await tasks.patch(id, { status: target })
    // A task inside a group changes status only — its order lives in the group.
    if (col === 'closed' || task.parent) return
    const ids = columns.value[col].map((t) => t.id).filter((x) => x !== id)
    const at = before && before !== id ? ids.indexOf(before) : -1
    ids.splice(at < 0 ? ids.length : at, 0, id)
    await tasks.reorder(ids)
}

// --- closed column -------------------------------------------------------------

const CLOSED_PAGE = 30
const closedShown = ref(CLOSED_PAGE)

// --- display helpers ---------------------------------------------------------

function ruleText(kind: 'wake' | 'close', rule: string): string {
    const verb = kind === 'wake' ? 'wakes' : 'done'
    if (rule.startsWith('node:')) {
        const title = graph.nodes.get(rule.slice(5))?.title
        const short = title && title.length > 28 ? `${title.slice(0, 27)}…` : title
        return short ? `${verb} when “${short}” resolves` : `${verb} when a note resolves`
    }
    if (rule.startsWith('>')) return `${verb} after ${rule.slice(1)}`
    if (/^\d{4}-\d{2}-\d{2}/.test(rule)) return `${verb} ${day(Date.parse(rule) / 1000)}`
    return `${verb} at ${rule}`
}

function day(ts: number): string {
    return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function progressPct(t: TaskView): number {
    const [closed, total] = t.progress ?? [0, 0]
    return total ? Math.round((closed / total) * 100) : 0
}
</script>

<template>
<div class="tasks" :class="`show-${narrowColumn}`">
    <SegmentedControl
        v-model="narrowColumn"
        class="column-pick screen-content"
        :options="columnOptions"
        aria-label="Column"
    />

    <NoteText v-if="error" tone="error">{{ error }}</NoteText>
    <div v-else class="board screen-content">
        <section
            v-for="col in COLUMNS"
            :key="col.id"
            class="column"
            :class="[`col-${col.id}`, { over: overColumn === col.id }]"
            @dragover.prevent="overColumn = col.id"
            @dragleave.self="overColumn = null"
            @drop.prevent="onDrop(col.id)"
        >
            <header class="column-head" :title="col.hint">
                <span class="column-label">{{ col.label }}</span>
                <span class="count">{{ columns[col.id].length }}</span>
            </header>
            <form v-if="col.id === 'active'" class="composer glass-panel" @submit.prevent="quickAdd()">
                <AutoTextarea
                    v-model="draft"
                    :rows="2"
                    :max-rows="12"
                    placeholder="New task"
                    aria-label="New task — the first line is the title, the rest becomes the plan"
                    @keydown.enter.exact.prevent="quickAdd()"
                />
                <div v-if="draft.trim()" class="composer-foot">
                    <span class="composer-hint">Enter adds · Shift+Enter, new line for the plan</span>
                    <UiButton size="sm" variant="accent" type="submit">Add</UiButton>
                </div>
                <NoteText v-if="addError" tone="error">{{ addError }}</NoteText>
                <NoteText v-else-if="notice" tone="body">{{ notice }}</NoteText>
            </form>
            <ol class="cards">
                <li
                    v-for="t in col.id === 'closed' ? columns.closed.slice(0, closedShown) : columns[col.id]"
                    :key="t.id"
                    class="card glass-panel"
                    :class="{
                        selected: selectedId === t.id,
                        dragging: dragId === t.id,
                        'drop-before': overId === t.id && dragId !== t.id,
                        closed: !isOpen(t.status),
                        group: !!t.progress,
                    }"
                    :draggable="!isClosedGroup(t)"
                    @dragstart="onDragStart($event, t)"
                    @dragend="onDragEnd"
                    @dragover.prevent="overId = t.id"
                >
                    <div class="card-row">
                        <button
                            class="check"
                            type="button"
                            :class="t.status"
                            :disabled="isClosedGroup(t)"
                            :title="isClosedGroup(t) ? 'Reopen one of its tasks to reopen the group' : isOpen(t.status) ? 'Mark done' : 'Reopen'"
                            :aria-label="isOpen(t.status) ? `Mark “${t.title}” done` : `Reopen “${t.title}”`"
                            @click="toggleDone(t)"
                        >
                            <span v-if="t.status === 'done'">✓</span>
                            <span v-else-if="t.status === 'dropped'">–</span>
                        </button>
                        <button class="card-title" type="button" @click="tasks.open(t.id)">
                            {{ t.title }}
                        </button>
                    </div>
                    <div v-if="t.progress" class="progress" :title="`${t.progress[0]} of ${t.progress[1]} closed`">
                        <span class="bar"><span class="fill" :style="{ width: `${progressPct(t)}%` }" /></span>
                        <span class="progress-text">{{ t.progress[0] }}/{{ t.progress[1] }}</span>
                    </div>
                    <div class="chips">
                        <InfoBadge v-if="t.status === 'dropped'" pill tone="muted">dropped</InfoBadge>
                        <InfoBadge v-if="t.carried_from" :title="`Opened under ${t.carried_from}, still open`" pill tone="warn">↻ {{ t.carried_from }}</InfoBadge>
                        <InfoBadge v-if="t.idle_sessions" title="Sessions briefed without this task changing" pill tone="warn">idle {{ t.idle_sessions }}</InfoBadge>
                        <InfoBadge v-if="t.close" :title="ruleText('close', t.close)" pill tone="accent">{{ ruleText('close', t.close) }}</InfoBadge>
                        <InfoBadge v-if="t.wake" pill tone="accent">{{ ruleText('wake', t.wake) }}</InfoBadge>
                        <InfoBadge v-if="t.refs?.length" title="Memory notes this task is about" pill tone="muted">{{ t.refs.length }} ref{{ t.refs.length === 1 ? '' : 's' }}</InfoBadge>
                        <InfoBadge v-if="t.version && !t.carried_from" pill tone="muted">{{ t.closed_version && t.closed_version !== t.version ? `${t.version}→${t.closed_version}` : t.version }}</InfoBadge>
                        <InfoBadge v-if="!isOpen(t.status) && t.closed_at" pill tone="muted">{{ day(t.closed_at) }}</InfoBadge>
                    </div>
                    <p v-if="t.auto" class="auto">{{ t.auto }}</p>
                    <ul v-if="t.progress" class="children">
                        <li
                            v-for="c in tasks.childrenOf(t.id)"
                            :key="c.id"
                            class="child"
                            :class="[c.status, { selected: selectedId === c.id, dragging: dragId === c.id }]"
                            draggable="true"
                            @dragstart.stop="onDragStart($event, c)"
                            @dragend="onDragEnd"
                        >
                            <button
                                class="check small"
                                type="button"
                                :class="c.status"
                                :aria-label="isOpen(c.status) ? `Mark “${c.title}” done` : `Reopen “${c.title}”`"
                                @click="toggleDone(c)"
                            >
                                <span v-if="c.status === 'done'">✓</span>
                                <span v-else-if="c.status === 'dropped'">–</span>
                            </button>
                            <button class="child-title" type="button" @click="tasks.open(c.id)">{{ c.title }}</button>
                            <InfoBadge v-if="c.status === 'delayed' || c.status === 'backlog'" pill tone="muted">{{ STATUS_LABELS[c.status].toLowerCase() }}</InfoBadge>
                        </li>
                    </ul>
                    <form v-if="isOpen(t.status) && (t.progress || selectedId === t.id)" class="child-add" @submit.prevent="addChild(t.id)">
                        <input
                            v-model="childDrafts[t.id]"
                            type="text"
                            :placeholder="t.progress ? 'Add a task to this group…' : 'Add a task under this one…'"
                            :aria-label="`Add a task to ${t.title}`"
                        />
                    </form>
                </li>
            </ol>
            <UiButton
                v-if="col.id === 'closed' && columns.closed.length > closedShown" size="sm" class="more"
                @click="closedShown += CLOSED_PAGE"
            >
                Show {{ Math.min(CLOSED_PAGE, columns.closed.length - closedShown) }} more
            </UiButton>
            <NoteText v-if="!columns[col.id].length && col.id !== 'active'" tone="empty">
                {{ col.id === 'closed' ? 'Nothing closed yet.' : 'Empty' }}
            </NoteText>
            <NoteText v-if="col.id === 'active' && loaded && !topLevel.length" tone="empty">
                Your assistant adds tasks with <code>add_tasks</code>; the brief lists the active ones.
            </NoteText>
        </section>
    </div>
</div>
</template>

<style scoped>
.tasks {
    position: absolute;
    inset: 5.6rem 0 0; /* just under the floating top bar */
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    overflow: hidden;
}

.composer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
    padding: 8px 10px;
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-lg);
}

.composer:focus-within {
    border-style: solid;
    border-color: var(--interactive-primary);
}

.composer textarea {
    width: 100%;
    padding: 2px 0;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-body-sm);
    line-height: 1.5;
}

.composer textarea:focus {
    outline: none;
}

.composer textarea::placeholder {
    color: var(--text-tertiary);
}

.composer-foot {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
}

.composer-hint {
    font-size: var(--text-caption, 11px);
    color: var(--text-tertiary);
}

.child-add input {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-caption, 11px);
}

.child-add input:focus {
    border-color: var(--border-strong);
    outline: none;
}

/* One column at a time is a narrow-pane affordance only. */
.column-pick {
    display: none;
}

.board {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    min-height: 0;
}

.column {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    padding: 8px;
    border: 1px dashed transparent;
    border-radius: var(--radius-lg);
    overflow-y: auto;
    overscroll-behavior: contain;
}

.column.over {
    border-color: var(--border-strong);
    background: var(--interactive-ghost-hover);
}

.column-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 2px 6px 8px;
}

.column-label {
    font-size: var(--text-body-sm);
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--text-secondary);
}

.count {
    font-size: var(--text-body-sm);
    color: var(--text-tertiary);
}

.cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    cursor: grab;
}

.card.closed {
    opacity: 0.75;
}

.card.selected {
    border-color: var(--interactive-primary);
}

.card.dragging {
    opacity: 0.4;
}

.card.drop-before {
    box-shadow: 0 -3px 0 0 var(--interactive-primary);
}

.card-row,
.child {
    display: flex;
    gap: 8px;
    align-items: flex-start;
}

.check {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    padding: 0;
    border: 1.5px solid var(--border-strong);
    border-radius: 50%;
    background: transparent;
    color: var(--text-inverse);
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
}

.check.small {
    width: 15px;
    height: 15px;
    font-size: 9px;
}

.check.delayed,
.check.backlog {
    border-style: dashed;
}

.check.done {
    border-color: var(--interactive-primary);
    background: var(--interactive-primary);
}

.check.dropped {
    border-color: var(--text-tertiary);
    background: var(--text-tertiary);
}

.check:disabled {
    cursor: default;
}

.check:hover:not(:disabled) {
    border-color: var(--interactive-primary);
}

.child {
    cursor: grab;
}

.child.dragging {
    opacity: 0.4;
}

.card-title,
.child-title {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-body-sm);
    text-align: left;
    overflow-wrap: anywhere;
    cursor: pointer;
}

.card-title {
    font-weight: 500;
}

.card-title:hover,
.child-title:hover {
    color: var(--interactive-primary-hover);
}

.card.closed .card-title,
.child.done .child-title,
.child.dropped .child-title {
    color: var(--text-secondary);
    text-decoration: line-through;
    text-decoration-color: var(--text-tertiary);
}

.progress {
    display: flex;
    gap: 8px;
    align-items: center;
}

.bar {
    flex: 1;
    height: 4px;
    border-radius: 999px;
    background: var(--surface-sunken);
    overflow: hidden;
}

.fill {
    display: block;
    height: 100%;
    background: var(--interactive-primary);
}

.progress-text {
    font-size: var(--text-caption, 11px);
    color: var(--text-tertiary);
}

.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.chips:empty {
    display: none;
}

.auto {
    margin: 0;
    font-size: var(--text-caption, 11px);
    font-style: italic;
    color: var(--text-tertiary);
}

.children {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 2px 0 0;
    padding: 6px 0 0;
    border-top: 1px solid var(--border-subtle);
    list-style: none;
}

.child.selected .child-title {
    color: var(--interactive-primary);
}

.child-add {
    display: flex;
}

.column-empty {
    padding: 6px;
    color: var(--text-tertiary);
}

.more {
    align-self: center;
    margin-top: 8px;
}

/* Medium panes: two columns side by side, closed below. */
@media (width <= 1100px) {
    .board {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        overflow-y: auto;
    }

    .column {
        overflow: visible;
    }
}

/* Narrow mode — a phone or an IDE side pane: one column at a time. */
@media (width <= 719px) {
    .tasks {
        gap: 8px;
        padding: 8px;
    }

    .column-pick {
        display: inline-flex;
        align-self: center;
        max-width: 100%;
        overflow-x: auto;
    }

    .board {
        grid-template-columns: 1fr;
    }

    .column {
        display: none;
    }

    .show-active .col-active,
    .show-delayed .col-delayed,
    .show-backlog .col-backlog,
    .show-closed .col-closed {
        display: flex;
    }
}

@media (width <= 250px) {
    .tasks {
        inset: 9.4rem 0 0;
    }
}
</style>
