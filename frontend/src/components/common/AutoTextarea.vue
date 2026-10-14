<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

/**
 * The pane's only multi-line input: it grows with its text instead of
 * offering a resize grip — `rows` is the floor, `maxRows` (optional) the
 * ceiling, past which it scrolls. Measured in JS rather than with
 * `field-sizing: content` so every webview the pane runs in (JCEF, VS Code,
 * Safari) sizes it the same way. It wears the field look of TextField;
 * a caller restyles it with its own class (the board's borderless
 * composer). Native attributes and listeners
 * (placeholder, aria-label, @keydown…) fall through to the <textarea>.
 */
const props = withDefaults(
    defineProps<{
        modelValue: string
        rows?: number
        maxRows?: number
    }>(),
    { rows: 2, maxRows: undefined },
)
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const el = useTemplateRef<HTMLTextAreaElement>('el')

function fit(): void {
    const t = el.value
    if (!t) return
    t.style.height = 'auto' // `rows` holds the floor while measuring
    const cs = getComputedStyle(t)
    const borders = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
    let height = t.scrollHeight + borders
    if (props.maxRows) {
        const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4
        const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
        const cap = line * props.maxRows + pad + borders
        t.style.overflowY = height > cap ? 'auto' : 'hidden'
        height = Math.min(height, cap)
    }
    t.style.height = `${height}px`
}

function onInput(e: Event): void {
    emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
    fit()
}

// External writes (a cleared composer, a loaded draft) re-measure too.
watch(
    () => props.modelValue,
    () => void nextTick(fit),
)

// Wrapping changes with width: a drawer drag or a window resize re-measures.
let observer: ResizeObserver | null = null
let lastWidth = 0
onMounted(() => {
    fit()
    if (el.value && 'ResizeObserver' in window) {
        observer = new ResizeObserver(([entry]) => {
            const w = entry?.contentRect.width ?? 0
            if (w !== lastWidth) {
                lastWidth = w
                fit()
            }
        })
        observer.observe(el.value)
    }
})
onBeforeUnmount(() => observer?.disconnect())

defineExpose({ focus: () => el.value?.focus() })
</script>

<template>
<textarea ref="el" class="auto-textarea" :value="modelValue" :rows="rows" @input="onInput" />
</template>

<style scoped>
.auto-textarea {
    display: block;
    /* Its height is the measured one: a scrolling flex column (a drawer body)
       would otherwise shrink it — overflow:hidden makes its min-height 0, so
       Safari squeezed the edit body to its padding. */
    flex-shrink: 0;
    width: 100%;
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background-color: var(--surface-sunken);
    color: var(--text-primary);
    font-family: inherit;
    font-size: var(--text-body-sm);
    line-height: var(--leading-normal);
    overflow-y: hidden;
    resize: none;
}

.auto-textarea:focus {
    border-color: var(--border-strong);
    outline: none;
}

.auto-textarea::placeholder {
    color: var(--text-tertiary);
}
</style>
