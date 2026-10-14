/**
 * The demo's keyword matcher — one scorer for both search boxes.
 *
 * It is what the history search always did (lowercased substring checks),
 * split into query terms so a multi-word query matches notes that carry the
 * words apart, plus a port of the daemon's snippet builder
 * (`store_tepin.rs` `make_snippet` / `highlight`) so a hit reads like a real
 * one. No embeddings, no reranker: a plain keyword match, and the demo
 * banner says so.
 */

/** The backend marks keyword matches with these (store.rs SNIPPET_OPEN/CLOSE); SearchBar turns them into <mark>. */
export const HI = ''
export const OFF = ''

/** The query's words, lowercased and deduped — the daemon's `tokenize` (alphanumeric runs of 2+ chars). */
export function queryTerms(query: string): string[] {
    const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2)
    return [...new Set(words)]
}

/** How many of `terms` occur in `text` (case-insensitive substring, as the history search matched). */
export function termHits(text: string, terms: string[]): number {
    const t = text.toLowerCase()
    return terms.filter((term) => t.includes(term)).length
}

/** Does `text` carry every term? The history search's filter, generalized past one phrase. */
export function matchesAll(text: string, terms: string[]): boolean {
    return terms.length > 0 && termHits(text, terms) === terms.length
}

/**
 * The daemon's `highlight`: a ~`window`-word clip starting a third of a
 * window before the first matching word, matching words wrapped in the
 * sentinel pair, `…` where the text was cut.
 */
export function highlight(text: string, terms: string[], window = 12): string {
    const words = text.split(/\s+/).filter(Boolean)
    const hit = (w: string) => termHits(w, terms) > 0
    const first = Math.max(0, words.findIndex(hit))
    const start = Math.max(0, first - Math.floor(window / 3))
    const end = Math.min(words.length, start + window)
    const body = words
        .slice(start, end)
        .map((w) => (hit(w) ? `${HI}${w}${OFF}` : w))
        .join(' ')
    return `${start > 0 ? '…' : ''}${body}${end < words.length ? '…' : ''}`
}

/** The daemon's `make_snippet`: highlight the field with the most matched terms, else a plain excerpt. */
export function snippet(fields: string[], terms: string[], fallback: string): string {
    let best: string | null = null
    let bestHits = 0
    for (const f of fields) {
        const n = termHits(f, terms)
        if (n > bestHits) {
            best = f
            bestHits = n
        }
    }
    return best == null ? fallback.slice(0, 160) : highlight(best, terms)
}
