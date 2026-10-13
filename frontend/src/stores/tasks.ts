import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/services/api'
import { onProjectSwitch } from '@/composables/onProjectSwitch'
import type { NewTask, TaskPatch, TaskStatus, TaskView, TaskWrite } from '@/types/graph'

/** Board columns, in reading order. Done and dropped share the closed one. */
export const OPEN_STATUSES: TaskStatus[] = ['active', 'delayed', 'backlog']

export const STATUS_LABELS: Record<TaskStatus, string> = {
    active: 'Active',
    delayed: 'Delayed',
    backlog: 'Backlog',
    done: 'Done',
    dropped: 'Dropped',
}

export function isOpen(s: TaskStatus): boolean {
    return OPEN_STATUSES.includes(s)
}

/**
 * The tasks screen's state (0.10.0): the working list beside the graph. Kept
 * apart from the graph store — tasks are not knowledge, they never enter the
 * canvas, search or the feed. The daemon settles wake/close rules on every
 * read, so a plain reload is always the current truth; `tasks_changed` SSE
 * frames trigger one.
 */
export const useTasksStore = defineStore('tasks', () => {
    const tasks = ref<TaskView[]>([])
    const loaded = ref(false)
    const loading = ref(false)
    const error = ref<string | null>(null)
    /** The task open in the editor drawer. */
    const selectedId = ref<string | null>(null)

    const byId = computed(() => new Map(tasks.value.map((t) => [t.id, t])))
    const selected = computed(() => (selectedId.value ? (byId.value.get(selectedId.value) ?? null) : null))

    /** Top-level tasks (groups and loose tasks), in the daemon's order. */
    const topLevel = computed(() => tasks.value.filter((t) => !t.parent))

    function childrenOf(id: string): TaskView[] {
        return tasks.value
            .filter((t) => t.parent === id)
            .sort((a, b) => Number(!isOpen(a.status)) - Number(!isOpen(b.status)) || a.position - b.position)
    }

    /** Active top-level tasks — what the brief lists; the screen toggle's count. */
    const activeCount = computed(() => topLevel.value.filter((t) => t.status === 'active').length)

    /** Open tasks whose refs include a node — NodeDetail's backlinks. */
    function referencing(nodeId: string): TaskView[] {
        return tasks.value.filter((t) => isOpen(t.status) && (t.refs ?? []).includes(nodeId))
    }

    async function load(): Promise<void> {
        loading.value = true
        error.value = null
        try {
            tasks.value = await api.tasks()
            loaded.value = true
            if (selectedId.value && !byId.value.has(selectedId.value)) selectedId.value = null
        } catch (e) {
            error.value = e instanceof Error ? e.message : String(e)
        } finally {
            loading.value = false
        }
    }

    async function create(task: NewTask): Promise<TaskWrite> {
        const out = await api.createTask(task)
        await load()
        return out
    }

    async function patch(id: string, p: TaskPatch): Promise<void> {
        await api.patchTask(id, p)
        await load()
    }

    async function remove(id: string): Promise<void> {
        await api.deleteTask(id)
        if (selectedId.value === id) selectedId.value = null
        await load()
    }

    /** Apply a manual order locally first, so a drag lands without a flicker. */
    async function reorder(ids: string[]): Promise<void> {
        const pos = new Map(ids.map((id, i) => [id, i]))
        tasks.value = tasks.value.map((t) => (pos.has(t.id) ? { ...t, position: pos.get(t.id)! } : t))
        await api.orderTasks(ids)
        await load()
    }

    function open(id: string | null): void {
        selectedId.value = id
    }

    onProjectSwitch(() => {
        tasks.value = []
        loaded.value = false
        selectedId.value = null
        error.value = null
        void load()
    })

    return {
        tasks,
        loaded,
        loading,
        error,
        selectedId,
        selected,
        byId,
        topLevel,
        activeCount,
        childrenOf,
        referencing,
        load,
        create,
        patch,
        remove,
        reorder,
        open,
    }
})
