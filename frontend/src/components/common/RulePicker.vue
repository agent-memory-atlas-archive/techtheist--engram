<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DatePicker from '@/components/common/DatePicker.vue'
import SelectMenu from '@/components/common/SelectMenu.vue'

/**
 * A task rule (0.10.0) as a choice, not a syntax: when should it fire —
 * at a version, once the project is past one, on a date, or when a linked
 * note is resolved. Emits the canonical string the daemon stores ('' = no
 * rule): `0.10.0`, `>0.9.12`, `2026-10-20`, `node:<id>`.
 */
const props = defineProps<{
    modelValue: string
    /** The graph's working version — the anchor for version suggestions. */
    currentVersion: string | null
    /** Notes this task links to: the candidates for "when a note resolves". */
    notes: { id: string; title: string }[]
    label: string
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

type Kind = '' | 'version' | 'past' | 'date' | 'node'

const KINDS = [
    { value: '', label: 'Never' },
    { value: 'version', label: 'At a version' },
    { value: 'past', label: 'Once past a version' },
    { value: 'date', label: 'On a date' },
    { value: 'node', label: 'When a linked note resolves' },
]

function parse(v: string): { kind: Kind; value: string } {
    if (!v) return { kind: '', value: '' }
    if (v.startsWith('node:')) return { kind: 'node', value: v.slice(5) }
    if (v.startsWith('>')) return { kind: 'past', value: v.slice(1) }
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return { kind: 'date', value: v.slice(0, 10) }
    return { kind: 'version', value: v }
}

const kind = ref<Kind>('')
const value = ref('')
watch(
    () => props.modelValue,
    (v) => {
        const p = parse(v)
        kind.value = p.kind
        value.value = p.value
    },
    { immediate: true },
)

function commit(): void {
    const v = value.value.trim()
    let out = ''
    if (kind.value === 'version' && v) out = v
    else if (kind.value === 'past' && v) out = `>${v}`
    else if (kind.value === 'date' && v) out = v
    else if (kind.value === 'node' && v) out = `node:${v}`
    if (out !== props.modelValue) emit('update:modelValue', out)
}

function pickKind(k: string): void {
    kind.value = k as Kind
    if (k === '') {
        value.value = ''
        commit()
        return
    }
    // Seed a sensible value so a kind switch is one click, not two.
    if (k === 'version') value.value = versions.value[1] ?? ''
    else if (k === 'past') value.value = props.currentVersion ?? ''
    else if (k === 'date') value.value = dayFromNow(7)
    else if (k === 'node') value.value = props.notes[0]?.id ?? ''
    commit()
}

/** The working version and its next patch / minor / major. */
const versions = computed(() => {
    const cur = props.currentVersion
    const m = cur?.match(/^(v?)(\d+)\.(\d+)(?:\.(\d+))?/)
    if (!cur || !m) return cur ? [cur] : []
    const [pre, maj, min, pat] = [m[1] ?? '', Number(m[2]), Number(m[3]), Number(m[4] ?? 0)]
    return [cur, `${pre}${maj}.${min}.${pat + 1}`, `${pre}${maj}.${min + 1}.0`, `${pre}${maj + 1}.0.0`]
})

function dayFromNow(days: number): string {
    const d = new Date(Date.now() + days * 86_400_000)
    return d.toISOString().slice(0, 10)
}

const DATE_CHIPS = [
    { label: 'Tomorrow', days: 1 },
    { label: 'In a week', days: 7 },
    { label: 'In a month', days: 30 },
]

const noteOptions = computed(() => props.notes.map((n) => ({ value: n.id, label: n.title })))
</script>

<template>
<div class="rule">
    <SelectMenu :model-value="kind" :options="KINDS" :aria-label="label" block @update:model-value="pickKind" />
    <template v-if="kind === 'version' || kind === 'past'">
        <input
            v-model="value"
            class="value"
            type="text"
            spellcheck="false"
            :aria-label="`${label}: version`"
            @blur="commit"
            @keydown.enter.prevent="commit"
        />
        <div v-if="versions.length" class="chips">
            <button
                v-for="v in versions"
                :key="v"
                class="chip"
                type="button"
                :class="{ on: v === value }"
                @click="value = v; commit()"
            >
                {{ v }}<template v-if="v === currentVersion"> · now</template>
            </button>
        </div>
    </template>
    <template v-else-if="kind === 'date'">
        <DatePicker v-model="value" :aria-label="`${label}: date`" @update:model-value="commit" />
        <div class="chips">
            <button v-for="c in DATE_CHIPS" :key="c.label" class="chip" type="button" @click="value = dayFromNow(c.days); commit()">
                {{ c.label }}
            </button>
        </div>
    </template>
    <template v-else-if="kind === 'node'">
        <SelectMenu
            v-if="noteOptions.length"
            v-model="value"
            :options="noteOptions"
            :aria-label="`${label}: note`"
            block
            @update:model-value="commit"
        />
        <p v-else class="hint">Link a note below first.</p>
    </template>
</div>
</template>

<style scoped>
.rule {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
}

.value {
    width: 100%;
    padding: 0.6rem 0.9rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background-color: var(--surface-sunken);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: var(--text-body-sm);
}

.value:focus {
    outline: 2px solid var(--focus-ring);
    outline-offset: -1px;
}

.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.chip {
    padding: 0.2rem 0.8rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-caption);
    cursor: pointer;
}

.chip:hover {
    border-color: var(--border-strong);
    color: var(--text-primary);
}

.chip.on {
    border-color: var(--interactive-primary);
    color: var(--interactive-primary);
}

.hint {
    margin: 0;
    font-size: var(--text-caption);
    color: var(--text-tertiary);
}
</style>
