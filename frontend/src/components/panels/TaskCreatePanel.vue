<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import AutoTextarea from '@/components/common/AutoTextarea.vue'
import FormField from '@/components/common/FormField.vue'
import NoteText from '@/components/common/NoteText.vue'
import RulePicker from '@/components/common/RulePicker.vue'
import SegmentedControl from '@/components/common/SegmentedControl.vue'
import SelectMenu from '@/components/common/SelectMenu.vue'
import SidePanel from '@/components/common/SidePanel.vue'
import TextField from '@/components/common/TextField.vue'
import UiButton from '@/components/common/UiButton.vue'
import { isOpen, STATUS_LABELS, useTasksStore } from '@/stores/tasks'
import type { TaskStatus } from '@/types/graph'

/**
 * New task (0.10.0) — the top bar's New on the Tasks screen. The same kit
 * and shape as New memory: what the work is, its plan, where it starts
 * (status, group), and when it closes on its own. Created → opened in the
 * task drawer; an open task that already covers it is offered instead.
 */
const tasks = useTasksStore()

const draft = reactive({
    title: '',
    body: '',
    status: 'active' as TaskStatus,
    parent: '',
    close: '',
})
const busy = ref(false)
const error = ref<string | null>(null)
const matched = ref<{ id: string; title: string } | null>(null)

watch(
    () => tasks.creating,
    (open) => {
        if (!open) return
        Object.assign(draft, { title: '', body: '', status: 'active', parent: '', close: '' })
        error.value = null
        matched.value = null
    },
)

const STATUS_OPTIONS = (['active', 'delayed', 'backlog'] as TaskStatus[]).map((s) => ({
    value: s,
    label: STATUS_LABELS[s],
}))

const groupOptions = computed(() => [
    { value: '', label: 'No group' },
    ...tasks.topLevel.filter((t) => isOpen(t.status)).map((t) => ({ value: t.id, label: t.title })),
])

function close(): void {
    tasks.creating = false
}

async function create(): Promise<void> {
    const title = draft.title.trim()
    if (!title) return
    busy.value = true
    error.value = null
    matched.value = null
    try {
        const w = await tasks.create({
            title,
            body: draft.body.trim() || undefined,
            status: draft.status,
            parent: draft.parent || undefined,
            close: draft.close || undefined,
        })
        if (w.matched) {
            matched.value = { id: w.matched.id, title: w.matched.title }
            return
        }
        if (w.id) tasks.open(w.id)
    } catch (e) {
        error.value = e instanceof Error ? e.message.replace(/^.*?→ \d+ /, '') : String(e)
    } finally {
        busy.value = false
    }
}
</script>

<template>
<SidePanel
    :open="tasks.creating"
    side="right"
    panel-id="task-create"
    :default-rem="42"
    :min-rem="28"
    :dismiss="close"
    accent="var(--interactive-primary)"
    title="New task"
>
    <TextField
        v-model="draft.title"
        placeholder="The piece of work — one that spans sessions"
        aria-label="Task title"
        @keydown.enter.prevent="create"
    />
    <AutoTextarea
        v-model="draft.body"
        class="mono"
        :rows="6"
        placeholder="Plan (markdown, optional) — steps as a checklist"
        aria-label="Plan (markdown)"
    />

    <FormField label="Starts as">
        <SegmentedControl v-model="draft.status" :options="STATUS_OPTIONS" aria-label="Status" />
    </FormField>

    <FormField label="Group">
        <SelectMenu v-model="draft.parent" :options="groupOptions" aria-label="Group" block />
    </FormField>

    <FormField label="Mark done">
        <RulePicker v-model="draft.close" :current-version="tasks.currentVersion" :notes="[]" label="Mark done" />
    </FormField>

    <NoteText v-if="matched">
        An open task already covers this:
        <button class="link" type="button" @click="tasks.open(matched.id)">{{ matched.title }}</button>
    </NoteText>
    <NoteText v-if="error" tone="error">{{ error }}</NoteText>

    <footer class="actions">
        <UiButton variant="primary" :disabled="busy || !draft.title.trim()" @click="create">Create</UiButton>
        <UiButton variant="ghost" :disabled="busy" @click="close">Cancel</UiButton>
    </footer>
</SidePanel>
</template>

<style scoped>
.mono {
    font-family: var(--font-mono);
}

.actions {
    display: flex;
    gap: 0.6rem;
    margin-top: auto;
    padding-top: 0.6rem;
}

.link {
    padding: 0;
    border: none;
    background: none;
    color: var(--interactive-primary);
    font: inherit;
    cursor: pointer;
}

.link:hover {
    text-decoration: underline;
}
</style>
