<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AutoTextarea from '@/components/common/AutoTextarea.vue'
import InfoBadge from '@/components/common/InfoBadge.vue'
import MarkdownView from '@/components/common/MarkdownView.vue'
import RulePicker from '@/components/common/RulePicker.vue'
import SegmentedControl from '@/components/common/SegmentedControl.vue'
import SelectMenu from '@/components/common/SelectMenu.vue'
import TextField from '@/components/common/TextField.vue'
import UiButton from '@/components/common/UiButton.vue'
import DetailDrawer from '@/components/common/detail/DetailDrawer.vue'
import DetailLink from '@/components/common/detail/DetailLink.vue'
import MetaList from '@/components/common/MetaList.vue'
import MetaRow from '@/components/common/MetaRow.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import DetailTitle from '@/components/common/detail/DetailTitle.vue'
import { api } from '@/services/api'
import { useConfigStore } from '@/stores/config'
import { useGraphStore } from '@/stores/graph'
import { useLayoutStore } from '@/stores/layout'
import { isOpen, STATUS_LABELS, useTasksStore } from '@/stores/tasks'
import type { SearchHit, TaskPatch, TaskStatus } from '@/types/graph'

/**
 * One task in the shared detail card (0.10.0) — the same shell, order and
 * type sizes as a node: kind pill, title, badges, controls, the plan as the
 * body, titled sections, provenance, an actions footer. Fields save on their
 * own; hard delete is here and nowhere else (user-only, like nodes).
 */
const tasks = useTasksStore()
const graph = useGraphStore()
const config = useConfigStore()
const layout = useLayoutStore()

const task = computed(() => tasks.selected)
const children = computed(() => (task.value ? tasks.childrenOf(task.value.id) : []))
const isGroup = computed(() => children.value.length > 0)
/** A closed group can't be reopened by itself: every task in it is closed,
 *  so it would close again at once. Its tasks are the way back. */
const closedGroup = computed(() => isGroup.value && !!task.value && !isOpen(task.value.status))
const error = ref<string | null>(null)

const body = ref('')
const editingPlan = ref(false)
const progressLine = ref('')
const confirmingDelete = ref(false)
// Declared before the immediate `task` watcher below, which resets them —
// a later declaration is a TDZ crash whenever the drawer mounts with a task
// already selected (coming back to the Tasks screen).
const refQuery = ref('')
const refHits = ref<SearchHit[]>([])
let searchSeq = 0

watch(
    task,
    (t, prev) => {
        if (!t) return
        // Keep in-flight edits when the same task merely reloads.
        if (prev?.id !== t.id) {
            editingPlan.value = false
            confirmingDelete.value = false
            progressLine.value = ''
            error.value = null
            refQuery.value = ''
            refHits.value = []
        }
        if (!editingPlan.value) body.value = t.body ?? ''
    },
    { immediate: true },
)

/** The pill and edge strip follow the status. */
const STATUS_ACCENT: Record<TaskStatus, string> = {
    active: 'var(--interactive-primary)',
    delayed: 'var(--node-caution)',
    backlog: 'var(--node-anchor)',
    done: 'var(--node-resolution)',
    dropped: 'var(--text-tertiary)',
}

async function save(p: TaskPatch): Promise<void> {
    if (!task.value) return
    error.value = null
    try {
        await tasks.patch(task.value.id, p)
    } catch (e) {
        error.value = e instanceof Error ? e.message.replace(/^.*?→ \d+ /, '') : String(e)
    }
}

async function savePlan(): Promise<void> {
    await save({ body: body.value })
    if (!error.value) editingPlan.value = false
}

function cancelPlan(): void {
    editingPlan.value = false
    body.value = task.value?.body ?? ''
}

async function addProgress(): Promise<void> {
    const line = progressLine.value.trim()
    if (!line) return
    await save({ progress: line })
    if (!error.value) progressLine.value = ''
}

function saveRule(kind: 'wake' | 'close', value: string): void {
    if (!task.value || value === (task.value[kind] ?? '')) return
    void save({ [kind]: value })
}

const STATUS_OPTIONS = (['active', 'delayed', 'backlog', 'done', 'dropped'] as TaskStatus[]).map((s) => ({
    value: s,
    label: STATUS_LABELS[s],
}))

/** Groups a task can join: open top-level tasks other than itself. */
const groupOptions = computed(() => {
    const own = task.value?.id
    return [
        { value: '', label: 'No group' },
        ...tasks.topLevel
            .filter((t) => t.id !== own && isOpen(t.status))
            .map((t) => ({ value: t.id, label: t.title })),
    ]
})

/** Wake only means something for parked work (or a rule already set). */
const showWake = computed(
    () => !!task.value && (task.value.status === 'delayed' || task.value.status === 'backlog' || !!task.value.wake),
)

// --- linked notes ------------------------------------------------------------

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

function noteTitle(id: string): string {
    return graph.nodes.get(id)?.title ?? id
}

/** The note's type color — the same dot the canvas and feed draw. */
function noteColor(type: string | undefined): string {
    return type ? config.accent(type) : 'var(--text-tertiary)'
}

/** Linked notes, titled — what "when a linked note resolves" can wait on. */
const linkedNotes = computed(() => (task.value?.refs ?? []).map((id) => ({ id, title: noteTitle(id) })))

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

async function remove(): Promise<void> {
    if (task.value) await tasks.remove(task.value.id)
}
</script>

<template>
<DetailDrawer
    :open="task != null"
    panel-id="task"
    :kind="isGroup ? 'Group' : 'Task'"
    :accent="task ? STATUS_ACCENT[task.status] : 'var(--interactive-primary)'"
    :dismiss="() => tasks.open(null)"
>
    <template v-if="task" #title>
        <DetailTitle :text="task.title" editable @commit="save({ title: $event })" />
    </template>

    <template v-if="task" #badges>
        <InfoBadge>{{ STATUS_LABELS[task.status].toLowerCase() }}</InfoBadge>
        <InfoBadge v-if="task.progress">{{ task.progress[0] }}/{{ task.progress[1] }} done</InfoBadge>
        <InfoBadge v-if="task.version" title="Working version when the task was created">{{ task.version }}</InfoBadge>
        <InfoBadge v-if="task.carried_from" tone="warn" title="Opened under an older version and still open">↻ carried</InfoBadge>
        <InfoBadge v-if="task.idle_sessions" tone="warn" title="Sessions briefed without this task changing">
            idle {{ task.idle_sessions }}
        </InfoBadge>
        <InfoBadge v-if="task.origin" title="Who created it">by {{ task.origin }}</InfoBadge>
    </template>

    <template v-if="task">
        <p v-if="task.auto" class="note">Last automatic change: {{ task.auto }}</p>
        <p v-if="error" class="note error">{{ error }}</p>

        <SegmentedControl
            class="status"
            :model-value="task.status"
            :options="STATUS_OPTIONS"
            :disabled="closedGroup"
            aria-label="Status"
            @update:model-value="save({ status: $event as TaskStatus })"
        />
        <p v-if="closedGroup" class="note">A closed group follows its tasks — reopen one of them to reopen the group.</p>

        <template v-if="editingPlan">
            <AutoTextarea v-model="body" class="mono" :rows="8" aria-label="Plan (markdown)" />
            <div class="row">
                <UiButton @click="savePlan">Save</UiButton>
                <UiButton variant="ghost" @click="cancelPlan">Cancel</UiButton>
            </div>
        </template>
        <MarkdownView v-else-if="task.body" :content="task.body" class="body" />
        <p v-else class="note">No plan yet — Edit plan adds one; steps go in as a checklist.</p>

        <form class="row" @submit.prevent="addProgress">
            <TextField
                v-model="progressLine"
                placeholder="Where it stands now…"
                aria-label="Progress note, added under today's date"
            />
            <UiButton type="submit" :disabled="!progressLine.trim()">Add note</UiButton>
        </form>

        <PanelSection v-if="isGroup" title="In this group">
            <ul class="links">
                <DetailLink
                    v-for="c in children"
                    :key="c.id"
                    :title="c.title"
                    :struck="!isOpen(c.status)"
                    @open="tasks.open(c.id)"
                >
                    <template #trail>
                        <InfoBadge tone="muted">{{ STATUS_LABELS[c.status].toLowerCase() }}</InfoBadge>
                    </template>
                </DetailLink>
            </ul>
        </PanelSection>

        <PanelSection v-else title="Group">
            <SelectMenu
                :model-value="task.parent ?? ''"
                :options="groupOptions"
                aria-label="Group"
                block
                @update:model-value="save({ parent: $event })"
            />
        </PanelSection>

        <PanelSection title="Automatically">
            <div class="field">
                <span class="field-label">Mark done</span>
                <RulePicker
                    :model-value="task.close ?? ''"
                    :current-version="tasks.currentVersion"
                    :notes="linkedNotes"
                    label="Mark done"
                    @update:model-value="saveRule('close', $event)"
                />
            </div>
            <div v-if="showWake" class="field">
                <span class="field-label">Back to active</span>
                <RulePicker
                    :model-value="task.wake ?? ''"
                    :current-version="tasks.currentVersion"
                    :notes="linkedNotes"
                    label="Back to active"
                    @update:model-value="saveRule('wake', $event)"
                />
            </div>
        </PanelSection>

        <PanelSection title="Linked notes">
            <ul v-if="task.refs?.length" class="links">
                <DetailLink
                    v-for="r in task.refs"
                    :key="r"
                    :title="noteTitle(r)"
                    removable
                    :remove-label="`Unlink ${noteTitle(r)}`"
                    @open="openRef(r)"
                    @remove="removeRef(r)"
                >
                    <template #lead>
                        <span
                            class="type-dot"
                            :style="{ backgroundColor: noteColor(graph.nodes.get(r)?.type) }"
                            :title="graph.nodes.get(r)?.type"
                        />
                    </template>
                </DetailLink>
            </ul>
            <TextField v-model="refQuery" placeholder="Search memory to link a note…" aria-label="Search notes to link" />
            <ul v-if="refHits.length" class="links">
                <DetailLink v-for="h in refHits" :key="h.id" :title="h.title" @open="addRef(h.id)">
                    <template #lead>
                        <span class="type-dot" :style="{ backgroundColor: noteColor(h.type) }" :title="h.type" />
                    </template>
                </DetailLink>
            </ul>
        </PanelSection>

        <PanelSection title="Provenance">
            <MetaList>
                <MetaRow label="Created">{{ when(task.created_at) }}</MetaRow>
                <MetaRow label="Updated">{{ when(task.updated_at) }}</MetaRow>
                <MetaRow v-if="task.closed_at" label="Closed">
                    {{ when(task.closed_at) }}<template v-if="task.closed_version"> · in {{ task.closed_version }}</template>
                </MetaRow>
            </MetaList>
        </PanelSection>
    </template>

    <template v-if="task" #actions>
        <UiButton v-if="!editingPlan" variant="ghost" @click="editingPlan = true">Edit plan</UiButton>
        <template v-if="confirmingDelete">
            <UiButton variant="danger" @click="remove">
                Confirm delete{{ children.length ? ` (and ${children.length} task${children.length === 1 ? '' : 's'})` : '' }}
            </UiButton>
            <UiButton variant="ghost" @click="confirmingDelete = false">Cancel</UiButton>
        </template>
        <UiButton
            v-else
            variant="danger-text"
            title="Hard delete — closing keeps history, deleting does not (user-only; assistants can only close or drop)"
            @click="confirmingDelete = true"
        >
            Delete
        </UiButton>
    </template>
</DetailDrawer>
</template>

<style scoped>
.note {
    margin: 0;
    color: var(--text-tertiary);
    font-size: var(--text-caption);
    line-height: var(--leading-normal);
}

.note.error {
    color: var(--node-problem);
}

.status {
    align-self: flex-start;
    max-width: 100%;
    overflow-x: auto;
}

.body {
    font-size: var(--text-body-sm);
    line-height: var(--leading-normal);
}

.mono {
    font-family: var(--font-mono);
}

.row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
}

.links {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.field-label {
    color: var(--text-tertiary);
    font-size: var(--text-caption);
}

.type-dot {
    flex: none;
    width: 0.8rem;
    height: 0.8rem;
    margin-left: 0.4rem;
    border-radius: var(--radius-full);
}
</style>
