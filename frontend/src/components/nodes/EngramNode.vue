<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import EngramCard from '@/components/nodes/EngramCard.vue'
import type { GraphNode } from '@/types/graph'

/** The Vue Flow node: the shared card plus Vue Flow's connection handles. */
const props = defineProps<NodeProps<GraphNode>>()
</script>

<template>
<EngramCard :node="props.data" :selected="props.selected">
    <template #handles>
        <Handle :position="Position.Left" type="target" class="engram-handle" />
        <Handle :position="Position.Right" type="source" class="engram-handle" />
    </template>
</EngramCard>
</template>
