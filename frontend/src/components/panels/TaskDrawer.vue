<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MarkdownView from '@/components/common/MarkdownView.vue'
import SegmentedControl from '@/components/common/SegmentedControl.vue'
import SelectMenu from '@/components/common/SelectMenu.vue'
import SidePanel from '@/components/common/SidePanel.vue'
import { api } from '@/services/api'
import { useGraphStore } from '@/stores/graph'
import { useHistoryStore } from '@/stores/history'
import { useLayoutStore } from '@/stores/layout'
import { isOpen, STATUS_LABELS, useTasksStore } from '@/stores/tasks'
import type { SearchHit, TaskPatch, TaskStatus } from '@/types/graph'

/**
 * One task, editable (0.10.0): title, status, group, the markdown body with
 * a progress line, the wake/close rules, and refs into memory. Every field
 * saves on its own — there is no form-level Save, the board is a working
 * surface. Hard delete lives here and only here (user-only, like nodes).
 */
const tasks = useTasksStore()
const graph = useGraphStore()
const layout = useLayoutStore()
const historyStore = useHistoryStore()

const task = computed(() => tasks.selected)
const children = computed(() => (task.value ? tasks.childrenOf(task.value.id) : []))
const error = ref<string | null>(null)

const title = ref('')
const body = ref('')
const editingBody = ref(false)
const progressLine = ref('')
const wake = ref('')
const close = ref('')

watch(
    task,
    (t, prev) => {
        if (!t) return
        // Keep in-flight edits when the same task merely reloads.
        if (prev?.id !== t.id) {
            editingBody.value = false
            progressLine.value = ''
            error.value = null
            refQuery.value = ''
            refHits.value = []
        }
        title.value = t.title
        if (!editingBody.value) body.value = t.body ?? ''
        wake.value = t.wake ?? ''
        close.value = t.close ?? ''
    },
    { immediate: true },
)

async function save(p: TaskPatch): Promise<void> {
    if (!task.value) return
    error.value = null
    try {
        await tasks.patch(task.value.id, p)
    } catch (e) {
        error.value = e instanceof Error ? e.message.replace(/^.*?→ \d+ /, '') : String(e)
    }
}

function saveTitle(): void {
    const t = title.value.trim()
    if (task.value && t && t !== task.value.title) void save({ title: t })
}

async function saveBody(): Promise<void> {
    await save({ body: body.value })
    if (!error.value) editingBody.value = false
}

async function addProgress(): Promise<void> {
    const line = progressLine.value.trim()
    if (!line) return
    await save({ progress: line })
    if (!error.value) progressLine.value = ''
}

function saveRule(kind: 'wake' | 'close'): void {
    if (!task.value) return
    const value = (kind === 'wake' ? wake.value : close.value).trim()
    if (value === (task.value[kind] ?? '')) return
    void save({ [kind]: value })
}

const STATUS_OPTIONS = (['active', 'delayed', 'backlog', 'done', 'dropped'] as TaskStatus[]).map((s) => ({
    value: s,
    label: STATUS_LABELS[s],
}))

/** Groups a task can join: top-level tasks other than itself. A group can't
 *  join another group (one level), so its own picker is disabled. */
const groupOptions = computed(() => {
    const own = task.value?.id
    return [
        { value: '', label: 'No group' },
        ...tasks.topLevel
            .filter((t) => t.id !== own && isOpen(t.status))
            .map((t) => ({ value: t.id, label: t.title })),
    ]
})
const isGroup = computed(() => children.value.length > 0)

// --- refs: links into memory ----------------------------------------------

const refQuery = ref('')
const refHits = ref<SearchHit[]>([])
let searchSeq = 0

watch(refQuery, async (q) => {
    const seq = ++searchSeq
    if (q.trim().length < 2) {
        refHits.value = []
        return
    }
    try {
        const hits = await api.search(q.trim(), 6)
        if (seq === searchSeq) refHits.value = hits.filter((h) => !(task.value?.refs ?? []).includes(h.id))
    } catch {
        if (seq === searchSeq) refHits.value = []
    }
})

function refTitle(id: string): string {
    return graph.nodes.get(id)?.title ?? id
}

function addRef(id: string): void {
    if (!task.value) return
    void save({ refs: [...(task.value.refs ?? []), id] })
    refQuery.value = ''
    refHits.value = []
}

function removeRef(id: string): void {
    if (!task.value) return
    void save({ refs: (task.value.refs ?? []).filter((r) => r !== id) })
}

function openRef(id: string): void {
    graph.select(id)
    layout.setView('graph')
}

// --- provenance ------------------------------------------------------------

function when(ts: number): string {
    return new Date(ts * 1000).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

/** The recorded session around the task's creation (time-window guess, the
 *  same slack NodeDetail allows pre-history notes). */
const timeSession = computed(() => {
    const t = task.value?.created_at
    if (t == null) return null
    let best: { session: string; gap: number } | null = null
    for (const s of historyStore.sessions) {
        const end = s.ended ?? s.started
        if (t < s.started - 600 || t > end + 3600) continue
        const gap = t < s.started ? s.started - t : t > end ? t - end : 0
        if (!best || gap < best.gap) best = { session: s.session, gap }
    }
    return best?.session ?? null
})
watch(task, (t) => {
    if (t && !historyStore.sessions.length) void historyStore.load()
})

function openSession(): void {
    if (!timeSession.value || !task.value) return
    layout.setView('history')
    void historyStore.open(timeSession.value, null, task.value.created_at)
}

async function remove(): Promise<void> {
    const t = task.value
    if (!t) return
    const extra = children.value.length ? ` and its ${children.value.length} task(s)` : ''
    if (!window.confirm(`Delete “${t.title}”${extra} for good? Closing keeps history; deleting does not.`)) return
    await tasks.remove(t.id)
}
</script>

<template>
<SidePanel
    :open="task != null"
    side="right"
    panel-id="task"
    :default-rem="42"
    :min-rem="28"
    :dismiss="() => tasks.open(null)"
>
    <template #header>
        <header v-if="task" class="head">
            <span class="pill">{{ isGroup ? 'Group' : task.parent ? 'Task in a group' : 'Task' }}</span>
            <button class="close" type="button" aria-label="Close" @click="tasks.open(null)">×</button>
        </header>
    </template>

    <div v-if="task" class="drawer">
        <input
            v-model="title"
            class="title-input"
            type="text"
            aria-label="Task title"
            @blur="saveTitle"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        />
        <p v-if="error" class="msg error">{{ error }}</p>

        <SegmentedControl
            class="status"
            :model-value="task.status"
            :options="STATUS_OPTIONS"
            aria-label="Status"
            @update:model-value="save({ status: $event as TaskStatus })"
        />
        <p v-if="task.auto" class="auto">Last automatic change: {{ task.auto }}</p>

        <label class="field">
            <span class="label">Group</span>
            <SelectMenu
                :model-value="task.parent ?? ''"
                :options="groupOptions"
                :disabled="isGroup"
                aria-label="Group"
                block
                @update:model-value="save({ parent: $event })"
            />
            <span v-if="isGroup" class="hint">A group can't join another group — groups are one level deep.</span>
        </label>

        <section v-if="isGroup" class="block">
            <h3 class="block-title">In this group ({{ task.progress?.[0] ?? 0 }}/{{ task.progress?.[1] ?? 0 }} closed)</h3>
            <ul class="kids">
                <li v-for="c in children" :key="c.id">
                    <button class="link" type="button" :class="{ closed: !isOpen(c.status) }" @click="tasks.open(c.id)">
                        {{ c.title }}
                    </button>
                    <span class="chip">{{ STATUS_LABELS[c.status].toLowerCase() }}</span>
                </li>
            </ul>
        </section>

        <section class="block">
            <header class="block-head">
                <h3 class="block-title">Plan &amp; notes</h3>
                <button v-if="!editingBody" class="mini" type="button" @click="editingBody = true">Edit</button>
                <span v-else class="row">
                    <button class="mini" type="button" @click="editingBody = false; body = task.body ?? ''">Cancel</button>
                    <button class="mini accent" type="button" @click="saveBody">Save</button>
                </span>
            </header>
            <textarea v-if="editingBody" v-model="body" class="body-input" rows="10" aria-label="Task body (markdown)" />
            <MarkdownView v-else-if="task.body" :content="task.body" />
            <p v-else class="hint">No plan yet — a checklist of steps belongs here.</p>
            <form class="progress" @submit.prevent="addProgress">
                <input
                    v-model="progressLine"
                    type="text"
                    placeholder="Where things stand — appended under today's date"
                    aria-label="Progress line"
                />
                <button class="mini" type="submit" :disabled="!progressLine.trim()">Note</button>
            </form>
        </section>

        <section class="block">
            <h3 class="block-title">Rules</h3>
            <p class="hint">
                A version (<code>0.10.0</code>, or <code>&gt;0.9.12</code> for “once past it”), a date
                (<code>2026-10-20</code>, <code>in 3 days</code>, <code>next week</code>) or
                <code>node:&lt;id&gt;</code> — fires when that note is resolved. Empty = none.
            </p>
            <label class="field">
                <span class="label">Close when</span>
                <input v-model="close" type="text" aria-label="Close rule" @blur="saveRule('close')" @keydown.enter.prevent="saveRule('close')" />
            </label>
            <label class="field">
                <span class="label">Wake when <span class="hint">(delayed / backlog → active)</span></span>
                <input v-model="wake" type="text" aria-label="Wake rule" @blur="saveRule('wake')" @keydown.enter.prevent="saveRule('wake')" />
            </label>
        </section>

        <section class="block">
            <h3 class="block-title">About these notes</h3>
            <ul v-if="task.refs?.length" class="refs">
                <li v-for="r in task.refs" :key="r">
                    <button class="link" type="button" :title="`Open ${r} in the graph`" @click="openRef(r)">{{ refTitle(r) }}</button>
                    <button class="x" type="button" :aria-label="`Remove ref ${r}`" @click="removeRef(r)">×</button>
                </li>
            </ul>
            <p v-else class="hint">No refs. Tasks point at memory; notes never point back.</p>
            <input v-model="refQuery" class="ref-search" type="text" placeholder="Search memory to link a note…" aria-label="Search notes to link" />
            <ul v-if="refHits.length" class="hits">
                <li v-for="h in refHits" :key="h.id">
                    <button class="link" type="button" @click="addRef(h.id)">
                        <span class="chip">{{ h.type }}</span> {{ h.title }}
                    </button>
                </li>
            </ul>
        </section>

        <section class="block">
            <h3 class="block-title">Provenance</h3>
            <dl class="meta">
                <div><dt>Created</dt><dd>{{ when(task.created_at) }}<template v-if="task.origin"> · by {{ task.origin }}</template></dd></div>
                <div v-if="task.version"><dt>Version</dt><dd>{{ task.version }}<template v-if="task.carried_from"> · still open</template></dd></div>
                <div v-if="task.closed_at"><dt>Closed</dt><dd>{{ when(task.closed_at) }}<template v-if="task.closed_version"> · in {{ task.closed_version }}</template></dd></div>
                <div><dt>Updated</dt><dd>{{ when(task.updated_at) }}</dd></div>
                <div v-if="task.session_id || timeSession">
                    <dt>Session</dt>
                    <dd>
                        <button v-if="timeSession" class="link mono" type="button" title="Open the session recorded around this task's creation" @click="openSession">
                            {{ task.session_id ?? 'recorded session' }} ≈⤴
                        </button>
                        <span v-else class="mono">{{ task.session_id }}</span>
                    </dd>
                </div>
            </dl>
        </section>

        <footer class="foot">
            <button class="mini danger" type="button" @click="remove">Delete for good</button>
        </footer>
    </div>
</SidePanel>
</template>

<style scoped>
.head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.pill {
    padding: 2px 8px;
    border-radius: 999px;
    background: rgb(139 92 246 / 18%);
    font-size: var(--text-caption, 11px);
    color: var(--text-secondary);
}

.close {
    padding: 0 6px;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
}

.drawer {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.title-input,
.body-input,
.field input,
.progress input,
.ref-search {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-control);
    background: var(--surface-sunken);
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-body-sm);
}

.title-input {
    font-size: var(--text-body);
    font-weight: 600;
}

.body-input {
    font-family: var(--font-mono);
    resize: vertical;
}

.status {
    align-self: flex-start;
    max-width: 100%;
    overflow-x: auto;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.label,
.block-title {
    margin: 0;
    font-size: var(--text-caption, 11px);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-tertiary);
}

.block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid var(--border-subtle);
}

.block-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.row {
    display: flex;
    gap: 6px;
}

.hint,
.auto {
    margin: 0;
    font-size: var(--text-caption, 11px);
    color: var(--text-tertiary);
}

.auto {
    font-style: italic;
}

.hint code {
    font-family: var(--font-mono);
}

.msg.error {
    margin: 0;
    font-size: var(--text-body-sm);
    color: var(--node-problem);
}

.progress {
    display: flex;
    gap: 6px;
}

.kids,
.refs,
.hits {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.kids li,
.refs li {
    display: flex;
    gap: 6px;
    align-items: baseline;
    justify-content: space-between;
}

.link {
    padding: 0;
    border: none;
    background: none;
    color: var(--interactive-primary);
    font: inherit;
    font-size: var(--text-body-sm);
    text-align: left;
    cursor: pointer;
}

.link:hover {
    text-decoration: underline;
}

.link.closed {
    color: var(--text-secondary);
    text-decoration: line-through;
}

.mono {
    font-family: var(--font-mono);
}

.x {
    border: none;
    background: none;
    color: var(--text-tertiary);
    cursor: pointer;
}

.chip {
    padding: 1px 6px;
    border-radius: 999px;
    white-space: nowrap;
    background: rgb(148 163 184 / 15%);
    font-size: var(--text-caption, 11px);
    color: var(--text-secondary);
}

.meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    font-size: var(--text-body-sm);
}

.meta div {
    display: flex;
    gap: 8px;
}

.meta dt {
    flex: none;
    width: 7rem;
    color: var(--text-tertiary);
}

.meta dd {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--text-secondary);
}

.foot {
    display: flex;
    justify-content: flex-end;
    padding-top: 10px;
    border-top: 1px solid var(--border-subtle);
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

.mini.danger {
    border-color: rgb(239 68 68 / 45%);
    color: var(--node-problem);
}

.mini:disabled {
    cursor: default;
    opacity: 0.5;
}
</style>
