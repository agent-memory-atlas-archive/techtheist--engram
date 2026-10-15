<script setup lang="ts">
import { ref } from 'vue'
import GraphFlow from '@/components/graph/GraphFlow.vue'
import GraphGL from '@/components/graph/GraphGL.vue'

/**
 * The graph screen's canvas (0.10.1): the WebGL2 renderer when the browser
 * runs WebGL2 on a GPU, Vue Flow's DOM canvas otherwise — a software
 * rasterizer (no GPU, a blocklisted driver) is refused by
 * failIfMajorPerformanceCaveat and lands here too, as does a lost context.
 * `localStorage['engram.renderer'] = 'dom'` forces the DOM canvas.
 */
function webgl2(): boolean {
    try {
        if (localStorage.getItem('engram.renderer') === 'dom') return false
    } catch {
        // storage blocked — fall through to the probe
    }
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
}

const gpu = ref(webgl2())
</script>

<template>
<GraphGL v-if="gpu" @lost="gpu = false" />
<GraphFlow v-else />
</template>
