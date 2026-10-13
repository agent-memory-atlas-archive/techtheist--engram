<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import SegmentedControl from '@/components/common/SegmentedControl.vue'
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
const { topLevel, loading, error, loaded, selectedId } = storeToRefs(tasks)

onMounted(() => {
    void tasks.load()
})

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
    for (const t of topLevel.value) out[columnOf(t)].push(t)
    return out
})

/** Narrow panes show one column at a time. */
const narrowColumn = ref<Column>('active')
const columnOptions = computed(() =>
    COLUMNS.map((c) => ({ value: c.id, label: `${c.label} ${columns.value[c.id].length}` })),
)

// --- quick add -------------------------------------------------------------

const draft = ref('')
const addError = ref<string | null>(null)
const notice = ref<string | null>(null)

async function quickAdd(parent?: string, title?: string): Promise<boolean> {
    const text = (title ?? draft.value).trim()
    if (!text) return false
    addError.value = null
    notice.value = null
    try {
        const w = await tasks.create({ title: text, parent })
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

async function toggleDone(t: TaskView): Promise<void> {
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
    const target: TaskStatus = col === 'closed' ? (isOpen(task.status) ? 'done' : task.status) : col
    if (target !== task.status) await tasks.patch(id, { status: target })
    if (col === 'closed') return
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
    const verb = kind === 'wake' ? 'wakes' : 'closes'
    if (rule.startsWith('node:')) return `${verb} when ${rule.slice(5, 13)}… closes`
    if (rule.startsWith('>')) return `${verb} after ${rule.slice(1)}`
    if (/^\d{4}-\d{2}-\d{2}T/.test(rule)) return `${verb} ${day(Date.parse(rule) / 1000)}`
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
    <header class="tasks-head glass-panel">
        <div class="head-title">
            <h2>Tasks</h2>
            <span class="lede">
                The assistant's working list — beside the graph, never in it. The brief lists the
                active titles; closed work is kept.
            </span>
        </div>
        <form class="quick-add" @submit.prevent="quickAdd()">
            <input
                v-model="draft"
                class="add-input"
                type="text"
                placeholder="Add a task — a piece of work that spans sessions…"
                aria-label="New task title"
            />
            <button class="mini accent" type="submit" :disabled="!draft.trim()">Add</button>
        </form>
        <p v-if="addError" class="msg error">{{ addError }}</p>
        <p v-else-if="notice" class="msg">{{ notice }}</p>
        <SegmentedControl
            v-model="narrowColumn"
            class="column-pick"
            :options="columnOptions"
            aria-label="Column"
        />
    </header>

    <p v-if="error" class="empty error">{{ error }}</p>
    <div v-else-if="loaded && !topLevel.length && !loading" class="empty-hero glass-panel">
        <h3>No tasks yet</h3>
        <p>
            Tasks are where an assistant keeps what it is doing between sessions — a plan,
            the step it stopped at, the release it still owes. Agents add them with
            <code>add_tasks</code>; you can add, reorder and close them here.
        </p>
        <ul>
            <li>One task per piece of work that spans sessions, not per edit.</li>
            <li>A feature becomes a group: its tasks live inside the card.</li>
            <li>
                Rules close or wake a task on their own — at a version, on a date, or when a
                note it waits on is resolved.
            </li>
        </ul>
    </div>

    <div v-else class="board">
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
                    :draggable="col.id !== 'closed'"
                    @dragstart="onDragStart($event, t)"
                    @dragend="onDragEnd"
                    @dragover.prevent="overId = t.id"
                >
                    <div class="card-row">
                        <button
                            class="check"
                            type="button"
                            :class="t.status"
                            :title="isOpen(t.status) ? 'Mark done' : 'Reopen'"
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
                        <span v-if="t.status === 'dropped'" class="chip quiet">dropped</span>
                        <span v-if="t.carried_from" class="chip warn" :title="`Opened under ${t.carried_from}, still open`">↻ {{ t.carried_from }}</span>
                        <span v-if="t.idle_sessions" class="chip warn" title="Sessions briefed without this task changing">idle {{ t.idle_sessions }}</span>
                        <span v-if="t.close" class="chip rule">{{ ruleText('close', t.close) }}</span>
                        <span v-if="t.wake" class="chip rule">{{ ruleText('wake', t.wake) }}</span>
                        <span v-if="t.refs?.length" class="chip quiet" title="Memory notes this task is about">{{ t.refs.length }} ref{{ t.refs.length === 1 ? '' : 's' }}</span>
                        <span v-if="t.version && !t.carried_from" class="chip quiet">{{ t.closed_version && t.closed_version !== t.version ? `${t.version}→${t.closed_version}` : t.version }}</span>
                        <span v-if="!isOpen(t.status) && t.closed_at" class="chip quiet">{{ day(t.closed_at) }}</span>
                    </div>
                    <p v-if="t.auto" class="auto">{{ t.auto }}</p>
                    <ul v-if="t.progress" class="children">
                        <li v-for="c in tasks.childrenOf(t.id)" :key="c.id" class="child" :class="[c.status, { selected: selectedId === c.id }]">
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
                            <span v-if="c.status === 'delayed' || c.status === 'backlog'" class="chip quiet">{{ STATUS_LABELS[c.status].toLowerCase() }}</span>
                        </li>
                    </ul>
                    <form v-if="isOpen(t.status) && (t.progress || selectedId === t.id)" class="child-add" @submit.prevent="addChild(t.id)">
                        <input
                            v-model="childDrafts[t.id]"
                            type="text"
                            :placeholder="t.progress ? 'Add a task to this group…' : 'Split into a group: add its first task…'"
                            :aria-label="`Add a task to ${t.title}`"
                        />
                    </form>
                </li>
            </ol>
            <button
                v-if="col.id === 'closed' && columns.closed.length > closedShown"
                class="mini more"
                type="button"
                @click="closedShown += CLOSED_PAGE"
            >
                Show {{ Math.min(CLOSED_PAGE, columns.closed.length - closedShown) }} more
            </button>
            <p v-if="!columns[col.id].length" class="empty column-empty">
                {{ col.id === 'active' ? 'Nothing in progress.' : col.id === 'closed' ? 'Nothing closed yet.' : 'Empty.' }}
            </p>
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

.tasks-head {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    align-items: center;
    padding: 12px 14px;
    border-radius: var(--radius-lg);
}

.head-title {
    display: flex;
    flex: 1 1 280px;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.head-title h2 {
    margin: 0;
    font-size: var(--text-body);
    font-weight: 600;
}

.lede {
    font-size: var(--text-body-sm);
    color: var(--text-secondary);
}

.quick-add {
    display: flex;
    flex: 2 1 320px;
    gap: 8px;
}

.add-input,
.child-add input {
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-control);
    background: var(--surface-sunken);
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-body-sm);
}

.child-add input {
    padding: 4px 8px;
    font-size: var(--text-caption, 11px);
}

.add-input:focus,
.child-add input:focus {
    outline: 2px solid var(--focus-ring);
    outline-offset: -1px;
}

.msg {
    flex-basis: 100%;
    margin: 0;
    font-size: var(--text-body-sm);
    color: var(--text-secondary);
}

.msg.error {
    color: var(--node-problem);
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
    cursor: default;
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

.check:hover {
    border-color: var(--interactive-primary);
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

.chip {
    padding: 1px 6px;
    border-radius: 999px;
    white-space: nowrap;
    background: rgb(56 189 248 / 15%);
    font-size: var(--text-caption, 11px);
    color: var(--text-secondary);
}

.chip.quiet {
    background: rgb(148 163 184 / 15%);
}

.chip.warn {
    background: rgb(245 158 11 / 18%);
}

.chip.rule {
    background: rgb(139 92 246 / 18%);
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

.empty {
    padding: 12px;
    font-size: var(--text-body-sm);
    color: var(--text-secondary);
}

.empty.error {
    color: var(--node-problem);
}

.column-empty {
    padding: 6px;
    color: var(--text-tertiary);
}

.empty-hero {
    max-width: 560px;
    margin: 8vh auto 0;
    padding: 22px 26px;
    border-radius: var(--radius-lg);
    font-size: var(--text-body-sm);
    color: var(--text-secondary);
}

.empty-hero h3 {
    margin: 0 0 8px;
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--text-primary);
}

.empty-hero ul {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 12px 0 0;
    padding-left: 18px;
}

.mini {
    padding: 4px 10px;
    border: 1px solid rgb(148 163 184 / 35%);
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary);
    font-size: var(--text-body-sm);
    cursor: pointer;
}

.mini.accent {
    border-color: var(--interactive-primary);
    color: var(--interactive-primary);
}

.mini:disabled {
    cursor: default;
    opacity: 0.5;
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

    .lede {
        display: none;
    }

    .column-pick {
        display: inline-flex;
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
