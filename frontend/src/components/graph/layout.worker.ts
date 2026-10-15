import { layoutGraph } from '@/composables/useLayout'
import type { LayoutMode } from '@/stores/layout'
import type { GraphEdge, GraphNode } from '@/types/graph'

/**
 * The canvas layout off the main thread (0.10.1). Skyline runs dagre per
 * connected component; one big component of a thousand notes is seconds of
 * network simplex, which on the main thread froze the whole pane. The
 * layouts read only ids, Anchor types and edge ends, so that is all that
 * crosses over.
 */
interface LayoutRequest {
    seq: number
    mode: LayoutMode
    nodes: Pick<GraphNode, 'id' | 'type'>[]
    edges: Pick<GraphEdge, 'from_id' | 'to_id'>[]
}

self.onmessage = (e: MessageEvent<LayoutRequest>) => {
    const { seq, mode, nodes, edges } = e.data
    const t = performance.now()
    const pos = layoutGraph(nodes as GraphNode[], edges as GraphEdge[], new Map(), mode)
    self.postMessage({ seq, pos: [...pos], ms: performance.now() - t })
}
