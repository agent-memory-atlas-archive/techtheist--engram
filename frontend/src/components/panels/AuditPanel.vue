<script setup lang="ts">
import { ref, watch } from 'vue'
import SidePanel from '@/components/common/SidePanel.vue'
import { api } from '@/services/api'
import { onProjectSwitch } from '@/composables/onProjectSwitch'
import { useAuditLog } from '@/composables/useAuditLog'
import type { AuditEntry, UndoReport } from '@/types/graph'

/**
 * Audit log (PLAN §10): the append-only journal of every node/edge mutation,
 * newest first — who wrote (origin badge), what changed (field diff from the
 * before/after snapshots), and the writing process's context (session, cwd,
 * pid, version). This is how silent skill writes become reviewable.
 *
 * Undo (0.9.10): an opened row offers "Undo" (the row, or its whole operation)
 * and "Undo session" (everything that session wrote). Both preview first — a
 * dry run the user confirms in place — and the undo is itself a journal row.
 */
const { open, hide } = useAuditLog()

const entries = ref<AuditEntry[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const expanded = ref<Set<number>>(new Set())

const PAGE = 50

watch(open, (isOpen) => {
    if (isOpen) void reload()
})

async function reload(): Promise<void> {
    entries.value = []
    expanded.value = new Set()
    await loadPage()
}

// The journal is per-graph; drop the old project's page rather than paging on.
onProjectSwitch(() => {
    entries.value = []
    expanded.value = new Set()
    total.value = 0
    error.value = null
})

async function loadPage(): Promise<void> {
    loading.value = true
    error.value = null
    try {
        const before = entries.value.at(-1)?.seq
        const page = await api.audit(PAGE, before)
        entries.value.push(...page.entries)
        total.value = page.total
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
    } finally {
        loading.value = false
    }
}

/** A pending undo: what was asked, and the dry run's answer to confirm. */
interface UndoPlan {
    seq: number
    kind: 'row' | 'session'
    preview: UndoReport
}

const plan = ref<UndoPlan | null>(null)
const busy = ref(false)
const outcome = ref<{ seq: number; text: string } | null>(null)

/** Node and edge mutations carry snapshots; activity rows don't. */
function undoable(e: AuditEntry): boolean {
    return (
        (e.entity === 'node' || e.entity === 'edge') &&
        e.action !== 'imported' &&
        (e.before != null || e.after != null)
    )
}

/** An undo's own marker row: undoing it undoes that undo. */
function isUndoMarker(e: AuditEntry): boolean {
    return e.action === 'undone'
}

function sessionOf(e: AuditEntry): string | null {
    return undoable(e) ? e.session_id : null
}

async function preview(e: AuditEntry, kind: 'row' | 'session'): Promise<void> {
    busy.value = true
    error.value = null
    outcome.value = null
    try {
        const report =
            kind === 'row'
                ? await api.auditUndo(e.seq, true)
                : await api.auditUndoSession(e.session_id ?? '', true)
        plan.value = { seq: e.seq, kind, preview: report }
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err)
    } finally {
        busy.value = false
    }
}

async function confirmUndo(e: AuditEntry): Promise<void> {
    const p = plan.value
    if (!p) return
    busy.value = true
    error.value = null
    try {
        const report =
            p.kind === 'row'
                ? await api.auditUndo(e.seq, false)
                : await api.auditUndoSession(e.session_id ?? '', false)
        plan.value = null
        await reload()
        outcome.value = { seq: e.seq, text: summarize(report) }
        expanded.value = new Set([e.seq])
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err)
    } finally {
        busy.value = false
    }
}

/** "Undid 3 changes · 1 skipped" — the skipped reasons are listed below it. */
function summarize(r: UndoReport): string {
    const done = r.undone.length
    const verb = r.dry_run ? 'Will undo' : 'Undid'
    const head = `${verb} ${done} change${done === 1 ? '' : 's'}`
    return r.skipped.length ? `${head} · ${r.skipped.length} skipped` : head
}

function toggle(seq: number): void {
    const next = new Set(expanded.value)
    if (!next.delete(seq)) next.add(seq)
    expanded.value = next
}

interface FieldChange {
    field: string
    before: string
    after: string
}

/**
 * Changed fields between the snapshots. `trust`/`stale` are computed at read
 * time (they drift on every read) — showing them would be pure noise.
 */
function changes(entry: AuditEntry): FieldChange[] {
    const before = entry.before ?? {}
    const after = entry.after ?? {}
    const skip = new Set(['trust', 'stale'])
    const fields = new Set([...Object.keys(before), ...Object.keys(after)])
    const out: FieldChange[] = []
    for (const field of fields) {
        if (skip.has(field)) continue
        const b = show(before[field])
        const a = show(after[field])
        if (b !== a) out.push({ field, before: b, after: a })
    }
    return out
}

function show(v: unknown): string {
    if (v == null) return '—'
    if (typeof v === 'string') return v
    return JSON.stringify(v)
}

function fmtDate(secs: number): string {
    return new Date(secs * 1000).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}
</script>

<template>
<SidePanel
    :open="open"
    side="left"
    panel-id="audit"
    :default-rem="42"
    :min-rem="32"
    :dismiss="hide"
    title="Audit log"
    style="--panel-gap: 1rem"
>
    <p class="hint">
        Every change to the graph, newest first — including your assistant's
        silent writes.
    </p>

    <p v-if="error" class="state error">{{ error }}</p>
    <p v-else-if="!loading && entries.length === 0" class="state">No changes recorded yet.</p>

    <ul class="entries">
        <li v-for="e in entries" :key="e.seq" class="entry">
            <button class="entry-head" type="button" @click="toggle(e.seq)">
                <span class="action" :data-action="e.action">{{ e.action }}</span>
                <span class="what">
                    <span class="entry-title">{{ e.title ?? e.entity_id }}</span>
                    <span class="meta">
                        <span class="origin" :data-origin="e.origin">{{ e.origin }}</span>
                        {{ e.entity }} · {{ fmtDate(e.ts) }}
                        <span v-if="e.undone_by != null" class="undone-tag" :title="`Reverted by row #${e.undone_by}`">
                            undone
                        </span>
                    </span>
                </span>
                <span class="chev" :class="{ down: expanded.has(e.seq) }" aria-hidden="true">›</span>
            </button>

            <div v-if="expanded.has(e.seq)" class="detail">
                <template v-if="changes(e).length">
                    <div v-for="c in changes(e)" :key="c.field" class="change">
                        <span class="field">{{ c.field }}</span>
                        <span class="values">
                            <template v-if="e.before"><s class="old">{{ c.before }}</s> </template>
                            <span class="new">{{ c.after }}</span>
                        </span>
                    </div>
                </template>
                <p v-else class="no-diff">No field-level changes recorded.</p>

                <dl class="context">
                    <template v-if="e.session_id">
                        <dt>session</dt>
                        <dd>{{ e.session_id }}</dd>
                    </template>
                    <template v-if="e.cwd">
                        <dt>cwd</dt>
                        <dd>{{ e.cwd }}</dd>
                    </template>
                    <dt>process</dt>
                    <dd>pid {{ e.pid ?? '—' }} · v{{ e.version ?? '?' }} · {{ e.origin }}</dd>
                    <dt>id</dt>
                    <dd>{{ e.entity_id || '—' }}</dd>
                </dl>

                <div
                    v-if="(undoable(e) || isUndoMarker(e)) && e.undone_by == null"
                    class="undo"
                >
                    <template v-if="plan?.seq === e.seq">
                        <p class="undo-summary">{{ summarize(plan.preview) }}</p>
                        <ul v-if="plan.preview.undone.length || plan.preview.skipped.length" class="undo-list">
                            <li v-for="u in plan.preview.undone" :key="`u${u.seq}`">
                                {{ u.effect }} — {{ u.title ?? u.entity_id }}
                                <span v-if="u.note" class="undo-note">({{ u.note }})</span>
                            </li>
                            <li v-for="u in plan.preview.skipped" :key="`s${u.seq}`" class="skipped">
                                skips {{ u.title ?? u.entity_id }} — {{ u.note }}
                            </li>
                        </ul>
                        <div class="undo-actions">
                            <button
                                class="more danger"
                                type="button"
                                :disabled="busy || plan.preview.undone.length === 0"
                                @click="confirmUndo(e)"
                            >
                                {{ busy ? 'Undoing…' : 'Confirm undo' }}
                            </button>
                            <button class="more" type="button" :disabled="busy" @click="plan = null">
                                Cancel
                            </button>
                        </div>
                    </template>
                    <div v-else class="undo-actions">
                        <button
                            class="more"
                            type="button"
                            :disabled="busy"
                            :title="e.op_id ? 'Part of one operation — undoes all of it' : 'Revert this change'"
                            @click="preview(e, 'row')"
                        >
                            {{ isUndoMarker(e) ? 'Undo this undo' : e.op_id ? 'Undo operation' : 'Undo' }}
                        </button>
                        <button
                            v-if="sessionOf(e)"
                            class="more"
                            type="button"
                            :disabled="busy"
                            title="Revert everything this session wrote, newest first"
                            @click="preview(e, 'session')"
                        >
                            Undo session
                        </button>
                    </div>
                </div>
                <p v-if="outcome?.seq === e.seq" class="undo-summary">{{ outcome.text }}</p>
            </div>
        </li>
    </ul>

    <footer class="foot">
        <span class="count">{{ entries.length }} of {{ total }}</span>
        <button
            v-if="entries.length < total"
            class="more"
            type="button"
            :disabled="loading"
            @click="loadPage"
        >
            {{ loading ? 'Loading…' : 'Load more' }}
        </button>
        <button class="more" type="button" :disabled="loading" @click="reload">Refresh</button>
    </footer>
</SidePanel>
</template>

<style scoped>
.hint {
    font-size: var(--text-caption);
    color: var(--text-tertiary);
}

.state {
    font-size: var(--text-body-sm);
    color: var(--text-secondary);
}

.state.error {
    color: var(--node-problem);
}

.entries {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    list-style: none;
}

.entry-head {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 0.7rem 0.8rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    text-align: left;
}

.entry-head:hover {
    background-color: var(--interactive-ghost-hover);
}

.action {
    /* Sized by its text: activity actions (mcp_session_started, brief_served)
       run longer than the mutation verbs the old fixed width was cut for. */
    flex-shrink: 0;
    min-width: 7.2rem;
    width: fit-content;
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-caption);
    font-weight: 600;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
    background-color: var(--surface-muted);
}

.action[data-action='created'] {
    color: var(--trust-trusted);
    background-color: color-mix(in srgb, var(--trust-trusted) 14%, transparent);
}

.action[data-action='deleted'] {
    color: var(--node-problem);
    background-color: color-mix(in srgb, var(--node-problem) 14%, transparent);
}

.action[data-action='approved'] {
    color: var(--interactive-primary);
    background-color: color-mix(in srgb, var(--interactive-primary) 14%, transparent);
}

.action[data-action='archived'] {
    color: var(--text-tertiary);
}

.what {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
}

.entry-title {
    overflow: hidden;
    font-size: var(--text-body-sm);
    color: var(--text-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--text-caption);
    color: var(--text-tertiary);
}

.origin {
    padding: 0 0.5rem;
    border-radius: var(--radius-full);
    border: 1px solid var(--border-default);
    font-weight: 600;
}

.origin[data-origin='mcp'] {
    color: var(--interactive-primary);
    border-color: color-mix(in srgb, var(--interactive-primary) 45%, transparent);
}

.chev {
    flex-shrink: 0;
    color: var(--text-tertiary);
    font-size: 1.6rem;
    transition: transform var(--duration-fast) var(--ease-default);
}

.chev.down {
    transform: rotate(90deg);
}

.detail {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin: 0 0.4rem 0.6rem;
    padding: 0.8rem 1rem;
    border-radius: var(--radius-md);
    background-color: var(--surface-sunken);
    font-size: var(--text-caption);
}

.change {
    display: flex;
    gap: 0.8rem;
    line-height: var(--leading-normal);
}

.field {
    flex-shrink: 0;
    width: 8.4rem;
    color: var(--text-tertiary);
    font-family: var(--font-mono);
}

.values {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--text-secondary);
}

.old {
    color: var(--text-tertiary);
}

.new {
    color: var(--text-primary);
}

.no-diff {
    color: var(--text-tertiary);
}

.context {
    display: grid;
    grid-template-columns: 8.4rem 1fr;
    gap: 0.2rem 0.8rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--border-subtle);
}

.context dt {
    color: var(--text-tertiary);
    font-family: var(--font-mono);
}

.context dd {
    overflow-wrap: anywhere;
    color: var(--text-secondary);
}

.foot {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    margin-top: auto;
    padding-top: 0.6rem;
}

.count {
    flex: 1;
    font-size: var(--text-caption);
    color: var(--text-tertiary);
}

.more {
    padding: 0.4rem 1rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-caption);
    font-weight: 600;
    cursor: pointer;
}

.more:disabled {
    opacity: 0.5;
    cursor: default;
}

.more:hover:not(:disabled) {
    color: var(--text-primary);
    background-color: var(--interactive-ghost-hover);
}

.more.danger {
    color: var(--node-problem);
    border-color: color-mix(in srgb, var(--node-problem) 45%, transparent);
}

.undone-tag {
    padding: 0 0.5rem;
    border-radius: var(--radius-full);
    background-color: var(--surface-muted);
    color: var(--text-tertiary);
    font-weight: 600;
}

.undo {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--border-subtle);
}

.undo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
}

.undo-summary {
    color: var(--text-primary);
    font-weight: 600;
}

.undo-list {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding-left: 1.2rem;
    color: var(--text-secondary);
    overflow-wrap: anywhere;
}

.undo-list .skipped,
.undo-note {
    color: var(--text-tertiary);
}
</style>
