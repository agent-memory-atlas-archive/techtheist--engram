/**
 * How the audit view labels a journal row (0.9.10). The badge holds the verb
 * — what happened — so every badge fits one width; a compound action's noun
 * joins the meta line, where the entity kind already sits.
 *
 * Display only: the journal, the API and `data-action` keep the raw action
 * string, so old rows, new rows and actions this pane has never heard of all
 * render — an unknown compound falls back to "last word = verb, the rest =
 * noun", a single word is its own verb.
 */
export interface ActionLabel {
    /** Badge text (upper-cased by CSS). */
    verb: string
    /** What it happened to, or null to keep the row's entity kind. */
    noun: string | null
}

/** Nouns the generic split would render badly. */
const NOUNS: Record<string, string> = {
    mcp_session: 'MCP session',
    auto: 'retrieval',
}

export function actionLabel(action: string): ActionLabel {
    const parts = action.split('_').filter(Boolean)
    if (parts.length < 2) return { verb: action, noun: null }
    const verb = parts.pop() as string
    const key = parts.join('_')
    return { verb, noun: NOUNS[key] ?? parts.join(' ') }
}
