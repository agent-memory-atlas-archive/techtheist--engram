import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/services/api'
import { onProjectSwitch } from '@/composables/onProjectSwitch'
import { useConfigStore } from '@/stores/config'
import { useGraphStore } from '@/stores/graph'
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

/** The board filter's facets (0.10.0). */
export interface TaskFilters {
    versions: string[]
    origins: string[]
    flags: string[]
}

/** How a task's version reads when it has none. */
export const NO_VERSION = 'no version'

/** Who created it, in the filter's words. */
export function originLabel(t: { origin?: string }): string {
    return t.origin === 'pane' ? 'you' : 'assistant'
}

/** The filter's yes/no facets. */
export const TASK_FLAGS: Record<string, (t: TaskView) => boolean> = {
    'carried over': (t) => !!t.carried_from,
    idle: (t) => !!t.idle_sessions,
    'has rules': (t) => !!(t.close || t.wake),
    'linked to notes': (t) => !!t.refs?.length,
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
    /** The graph's working version — rule pickers suggest from it. */
    const currentVersion = ref<string | null>(null)

    const byId = computed(() => new Map(tasks.value.map((t) => [t.id, t])))
    const selected = computed(() => (selectedId.value ? (byId.value.get(selectedId.value) ?? null) : null))

    /** Top-level tasks (groups and loose tasks), in the daemon's order. */
    const topLevel = computed(() => tasks.value.filter((t) => !t.parent))

    // --- board filter (client side, the top bar's Filter on this screen) ---

    /** Selected values per facet; empty facet = no constraint. */
    const filters = ref<TaskFilters>({ versions: [], origins: [], flags: [] })
    const activeFilterCount = computed(
        () => filters.value.versions.length + filters.value.origins.length + filters.value.flags.length,
    )

    function passes(t: TaskView): boolean {
        const f = filters.value
        if (f.versions.length && !f.versions.includes(t.version ?? NO_VERSION)) return false
        if (f.origins.length && !f.origins.includes(originLabel(t))) return false
        return f.flags.every((flag) => TASK_FLAGS[flag]?.(t) ?? true)
    }

    /** The board's top level after the filter: a group stays when it or
     *  any of its tasks matches. */
    const visibleTopLevel = computed(() =>
        activeFilterCount.value === 0
            ? topLevel.value
            : topLevel.value.filter((t) => passes(t) || childrenOf(t.id).some(passes)),
    )

    function toggleFilter(group: keyof TaskFilters, value: string): void {
        const list = filters.value[group]
        filters.value = {
            ...filters.value,
            [group]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
        }
    }

    function clearFilters(): void {
        filters.value = { versions: [], origins: [], flags: [] }
    }

    /** The New-task panel (the top bar's New on this screen). */
    const creating = ref(false)
    function startCreate(): void {
        selectedId.value = null
        useGraphStore().closeDetail()
        creating.value = true
    }

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
        // A graph with tasks off has no list to show (the API would refuse).
        if (!useConfigStore().tasksEnabled) {
            tasks.value = []
            loaded.value = true
            selectedId.value = null
            return
        }
        loading.value = true
        error.value = null
        try {
            const [list, version] = await Promise.all([
                api.tasks(),
                api.getVersion().catch(() => ({ enabled: false, current: null })),
            ])
            tasks.value = list
            currentVersion.value = version.current
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

    /** Open a task's drawer (null closes it). The right edge holds one
     *  drawer: opening a task closes the node drawer — in state, so a
     *  screen that remounts later can't bring the stale one back. The node
     *  selection itself survives (the canvas still centers on it). */
    function open(id: string | null): void {
        selectedId.value = id
        if (id != null) {
            useGraphStore().closeDetail()
            creating.value = false
        }
    }

    onProjectSwitch(() => {
        tasks.value = []
        loaded.value = false
        selectedId.value = null
        error.value = null
        clearFilters()
        creating.value = false
        void load()
    })

    return {
        tasks,
        loaded,
        loading,
        error,
        selectedId,
        selected,
        currentVersion,
        filters,
        activeFilterCount,
        visibleTopLevel,
        toggleFilter,
        clearFilters,
        creating,
        startCreate,
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
