<script setup lang="ts">
/**
 * The canvas controls (zoom in / out, fit, lock) — Vue Flow's Controls,
 * rebuilt as plain HTML over the WebGL canvas so they keep their glass:
 * a real backdrop-filter over the canvas pixels in the brand theme.
 */
defineProps<{ locked: boolean; canZoomIn: boolean; canZoomOut: boolean }>()
const emit = defineEmits<{ zoomIn: []; zoomOut: []; fit: []; toggleLock: [] }>()
</script>

<template>
<div class="gl-controls gl-chrome" role="toolbar" aria-label="Canvas controls">
    <button type="button" class="gl-controls-button" title="zoom in" aria-label="zoom in" :disabled="!canZoomIn" @click="emit('zoomIn')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" /></svg>
    </button>
    <button type="button" class="gl-controls-button" title="zoom out" aria-label="zoom out" :disabled="!canZoomOut" @click="emit('zoomOut')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 5"><path d="M0 0h32v4.2H0z" /></svg>
    </button>
    <button type="button" class="gl-controls-button" title="fit view" aria-label="fit view" @click="emit('fit')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 30"><path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0 0 27.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94a.919.919 0 0 1-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" /></svg>
    </button>
    <button type="button" class="gl-controls-button" title="toggle interactivity" aria-label="toggle interactivity" @click="emit('toggleLock')">
        <svg v-if="locked" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32"><path d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 0 0 0 13.714v15.238A3.056 3.056 0 0 0 3.048 32h18.285a3.056 3.056 0 0 0 3.048-3.048V13.714a3.056 3.056 0 0 0-3.048-3.047zM12.19 24.533a3.056 3.056 0 0 1-3.047-3.047 3.056 3.056 0 0 1 3.047-3.048 3.056 3.056 0 0 1 3.048 3.048 3.056 3.056 0 0 1-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z" /></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32"><path d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 0 0 0 13.714v15.238A3.056 3.056 0 0 0 3.048 32h18.285a3.056 3.056 0 0 0 3.048-3.048V13.714a3.056 3.056 0 0 0-3.048-3.047zM12.19 24.533a3.056 3.056 0 0 1-3.047-3.047 3.056 3.056 0 0 1 3.047-3.048 3.056 3.056 0 0 1 3.048 3.048 3.056 3.056 0 0 1-3.048 3.047z" /></svg>
    </button>
</div>
</template>

<style scoped>
.gl-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 5;
    margin: 15px;
    overflow: hidden;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    background-color: var(--surface-glass);
    backdrop-filter: var(--glass-backdrop);
    box-shadow: var(--shadow-md);
}

.gl-controls-button {
    display: flex;
    box-sizing: content-box;
    width: 16px;
    height: 16px;
    align-items: center;
    justify-content: center;
    padding: 5px;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    background-color: transparent;
    fill: var(--text-secondary);
    cursor: pointer;
    user-select: none;
}

.gl-controls-button svg {
    width: 100%;
    max-width: 12px;
    max-height: 12px;
}

.gl-controls-button:last-child {
    border-bottom: none;
}

.gl-controls-button:hover {
    background-color: var(--interactive-ghost-hover);
    fill: var(--text-primary);
}

.gl-controls-button:disabled {
    pointer-events: none;
}

.gl-controls-button:disabled svg {
    fill-opacity: 0.4;
}
</style>
