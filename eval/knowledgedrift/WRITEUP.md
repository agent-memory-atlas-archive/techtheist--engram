# KnowledgeDrift — what the benchmark measured

A narrative reading of the receipts in `eval/results/*-knowledgedrift-*`.
The internals — world, protocol, families, rules, scoring — are in
`README.md`; this file says what the numbers mean, what they do not, and
what was tried and thrown away on the way. Every number below is quoted
from a named receipt; nothing is rounded past what three seeds support.

## In one paragraph

Coding agents forget, but the failures that cost a project are not
amnesia: they are answering from the note that was re-decided, not
noticing that two notes disagree, bringing back what a person deleted, and
being unable to say *why* anything was decided. No published memory
benchmark scores those, and the ones that score recall do it with an LLM
judge over chat-shaped facts. KnowledgeDrift pours one seeded, invented
software project into a memory system through a ten-operation protocol,
then questions, re-decides, contradicts, deletes and re-asks it, grading
every probe by a rule fixed before the question. The headline is the mean
success over every task, with N/A counted as failure; a macro composite and
an attention-multiplied score sit beside it. Measured on the official
500/1500 ladder with the same local embedder everywhere, the product scores
85% / 80% success (score 511 / 459) against 63% / 57% for LangMem, 58% / 55%
for Mem0, and 53% / 51% for grep — and the three flat stores, given the
same vectors, are one system: they fail the same tasks for the same reason.
The distance is not recall. It is abstention, rationale, the suspect queue,
the resurrection warning, and roughly an eighth of the tokens per answer.

## Positioning

- **Judge-free.** Every answer is a substring the generator knows and every
  rule is executable. The whole ladder, every arm, runs offline in minutes
  on a laptop; nothing in the loop is a language model, and nothing asks a
  model whether a model did well.
- **Invented subjects.** *Vanor lease broker* has no pretraining prior, so
  a system cannot answer from having read the internet, and the generator
  can flip a value without anyone knowing which value is "real".
- **Per family, then one number.** Eight families each with their own
  rule and columns; the headline is a mean over tasks, the composite a mean
  over families, and both are printed, because a system that is superb at
  recall and blind to drift should be readable as exactly that.
- **N/A is explained and charged.** A system without a suspect queue is
  marked N/A on the contradiction and drift families with the reason. The
  headline still counts those tasks as failed — a memory that cannot notice
  drift has not noticed it — and *success over attempted* is printed next
  to it for the capability-aware reading.
- **Attention is the multiplier.** The share of delivered tokens that
  belonged to the answer, `S`, scales the composite by clamp(10·S, 0.1, 10).
  A dump that shows 400,000 tokens to answer one question keeps a tenth of
  its composite; a memory that shows only the answer earns ten times. The
  sketch is stated, printed beside the raw composite, and floored so that
  silence cannot buy it.

## The official ladder (seed 1)

Receipts `2026-09-14-knowledgedrift-500-1500.{json,log}`,
`…-{500,1500}-{langmem,mem0}.json`. bge-small-en-v1.5 everywhere;
jina-reranker-v1-turbo-en and deberta-v3-small-tasksource-nli in the
product; pollution 10%, k 10.

| arm | success @500 | score @500 | success @1500 | score @1500 | tok/query |
|---|---|---|---|---|---|
| engram | **85%** | **511** | **80%** | **459** | 263–289 |
| langmem | 63% | 51 | 57% | 52 | ~2,200 |
| rag | 63% | 51 | 57% | 52 | ~2,200 |
| mem0 | 58% | 45 | 55% | 47 | ~2,500 |
| grep | 53% | 44 | 51% | 43 | ~2,600 |
| whole file | 71% | 5 | 71% | 5 | 134k–402k |
| curated 3k | 9% | 4 | 5% | 4 | ~2,900 |
| chance | 4% | 15 | 4% | 13 | ~2,300 |

Three readings:

1. **Three flat stores are one system.** `rag` (the harness's own
   vector top-k), LangMem's store and Mem0 with `infer=False` land within
   four points of each other at every rung and fail identically: fp 1.00
   (nothing declines), rationale 1% at 1500 (a *why* question that only
   structure answers), the stale sibling above the answer on ~40% of
   polluted questions, and no suspect, drift or lineage task attempted.
   Mem0 is lowest because its hybrid BM25 rescoring costs oblique recall
   (0.19 vs 0.35 at 1500) — a keyword channel weighted on the wrong
   register, the lesson the ladder's own retune taught in 0.7.2.
2. **Recall is not where the product wins.** On retrieval alone the flat
   stores match its r@5 (0.76 vs 0.78 at 1500). Its lead is the families
   they cannot attempt and the bill: abstention fp 0.02 vs 1.00, rationale
   99% vs 1%, contradiction 75% and drift 91% vs N/A, resurrection warned
   50–69% vs N/A, and 263–289 tokens per answer at focus 0.52–0.57 against
   ~2,300 at 0.11.
3. **The whole file is the honest ceiling on recall and the floor on
   cost.** 71% of tasks at every rung by showing everything; composite
   0.49, score 5. The curated 3,000-token file, the thing every agent
   framework ships as "memory", loses by 100 notes (29% → 9% → 5%).

## Is it stable? The three-seed ladder at 500

Receipts `2026-09-14-knowledgedrift-500-1500.json` (seed 1, the 500
rung), `…-500-seed2.json`, `…-500-seed3.json`, and
`…-500-seed{2,3}-{langmem,mem0}.json`. Same models, same flags; only the
world changes (607–641 notes, 2,318–2,373 tasks). Mean, then min–max:

| arm | success | composite | score |
|---|---|---|---|
| engram | **85% (84–85)** | 0.907 (0.898–0.918) | **525 (511–543)** |
| langmem | 63% (61–66) | 0.468 (0.461–0.473) | 52 (51–54) |
| rag | 63% (61–66) | 0.468 (0.461–0.473) | 52 (51–54) |
| mem0 | 59% (57–61) | 0.443 (0.438–0.447) | 46 (45–48) |
| grep | 53% (51–55) | 0.418 (0.414–0.422) | 43 (42–44) |
| whole file | 71% (69–74) | 0.487 (0.483–0.492) | 5 (5–5) |
| curated 3k | 9% (9–9) | 0.156 (0.151–0.160) | 4 (4–4) |
| chance | 4% (4–4) | 0.131 (0.131–0.132) | 13 (11–15) |

The product's families over the three seeds: retrieval 81% (80–82),
abstention 100% (99–100), currency 89% (87–91), contradiction 74%
(72–75), drift 93% (91–97), deletion 90% (90–90), rationale 100%
(99–100), temporal 100% (99–100). Under the contradiction number, tier-1
recall is 0.94 / 1.00 / 0.88 and tier-2 0.97 / 0.90 / 0.87 by seed; the
tier-3 false-alarm rate (the `historical` trap) is 0.24 / 0.21 / 0.37 —
the widest-swinging column, because it sits on six to ten cases. The
stale sibling outranks the answer on 0.21 / 0.32 / 0.26 of polluted
questions; the resurrection warning is 0.69 on every seed; abstention fp
never exceeds 0.01; tokens per answer 249–263.

So: the success percentages are stable to about one point for every arm,
the score to about three percent (it multiplies two means), and the
ordering never changes. LangMem and `rag` agree **on every seed** to the
same 61 / 63 / 66 — a flat store with this embedder is one system. The
ten-point gaps between the product and the nearest flat store, and
between the flat stores and grep, are real; a one-point gap anywhere in
this table is not.

## Pollution shapes: what gives the stale sibling away

Receipts `2026-09-14-knowledgedrift-500-twin.json` and `…-500-late.json`
against the default `…-500-1500.json` (seed 1, 500). The stale sibling is
the same flipped restatement each time; `twin` takes away the body hint
(it wears the truth's own body, so only the value and the date differ),
`late` takes away the clock (it is stamped 20–40 days *after* the truth,
as a migration would). The column that reads the shape is `stale_above`:
the share of polluted questions whose stale sibling outranked the answer.

| shape | engram success | engram `stale_above` | engram drift noticed | rag `stale_above` | grep `stale_above` |
|---|---|---|---|---|---|
| `stale` (default) | 85% | 0.21 | 0.91 | 0.38 | 0.58 |
| `twin` | 82% | **0.64** | **0.98** | 0.55 | 0.78 |
| `late` | 85% | **0.35** | 0.91 | 0.38 | 0.58 |

Two findings, neither of them flattering, both of them the point:

- **The body hint was carrying the ranking-side separation for
  everybody.** Take it away and the stale sibling outranks the truth on
  64% of polluted questions for the product, 55% for the vector store,
  78% for grep. A ranker cannot tell apart two notes that differ by a
  number and a date, and no amount of reranking changes that — the
  reranker reads the hint, not the calendar. What holds the family up is
  the second channel: the drift queue notices 98% of twin pairs (a twin
  is closer in similarity than a hinted sibling, so both nomination paths
  fire), and the product's success falls three points, all of it in
  retrieval. **Ranking cannot resolve drift; a queue a person judges
  can.** That is the benchmark's thesis stated as a number.
- **The product reads the clock as a weak currency prior.** `rag` and
  `grep` are byte-identical under `late` — they never look at capture
  time. The product's `stale_above` moves 0.21 → 0.35: a fresher stamp
  earns a little trust in its ranking, so a migration that restamps
  import time as capture time makes it prefer the re-imported past on a
  seventh more polluted questions. Success is unchanged because the drift
  queue is clock-blind and still raises every pair. Recency is a prior in
  the ranking, not a truth; the receipt says by how much.

## The bench fixed the product

The first run (`2026-09-13-knowledgedrift-100-500-nogate.*`) showed the
product's suspect queue raising 0 of 16 planted contradictions at 100. The
gate probe (`examples/gate_probe.rs`) then measured every channel a
nomination rule could read — full-note, title and claim cosine; NLI on the
claim text and on the bare titles; subject and content-word guards;
reranker score; length — over the planted positives, the planted negatives,
and later the 56 false alarms the first fix raised on the product's own
graph. What survived all four populations is the title-contradiction path
that shipped in 0.9.5 (`policy.conflict_nli_gate`, default 0.80):

| | contradiction | drift | success | score |
|---|---|---|---|---|
| @500, similarity-gated queue (pre-0.9.5) | 58% (t1 0.06) | 53% | 83% | 472 |
| @500, + title path | **75%** (t1 0.94) | **91%** | **85%** | **511** |
| @1500, similarity-gated queue | 59% (t1 0.04) | 47% | 78% | 420 |
| @1500, + title path | **75%** (t1 0.78) | **91%** | **80%** | **459** |

Every other family and every baseline reproduce to the digit between the
paired runs.

## The graveyard

What was tried, measured, and not shipped — kept because the next person
will think of it too.

- **Similarity as a contradiction detector.** Full-note cosine 0.69–0.81 for
  planted positives against 0.64–0.77 for negatives; title-only and claim
  cosine the same. MemStrata's finding reproduced inside the product's own
  gate: similarity finds *related*, not *disagreeing*.
- **NLI on the claim text** (title plus first body sentence, what
  `check_claim` reads): negations score 0.54, because the agreeing body
  sentence dilutes the contradicting title. Bare titles score them 0.99.
- **Gate 0.70 with a lenient subject guard.** Clean on the generated
  bench; 56 false alarms on the dogfood graph in one sweep — release notes
  and two-facts-about-one-subject pairs, which an MNLI model calls
  contradictions because every detail differs. The bench had no such shape,
  so the world gained `collider`, the rule gained the strict subject guard
  and the shared-content-word requirement, and the gate went to 0.80: 8/15
  planted positives kept, 8/10 drifted siblings, 4/56 of the real alarms.
  Rule: a nomination rule is replayed against the dogfood queue before it
  ships.
- **Success over attempted tasks as the headline.** It read "83% of 2,344
  attempted" and made a store that cannot notice drift look like one that
  did not miss it. The headline now counts every posed task; the
  capability-aware rate is the column beside it.
- **A multiplier floored at 1.** A dump then scored like a memory. The
  floor is 0.1 and the score reads as a whole number (0.05 → 5, 5.50 → 550).
- **The `historical` tier-3 trap** (*until the rollout X …; the current
  note stands*). Every sentence-pair judge reads it as a contradiction;
  it is the family's documented false-alarm floor (t3 false alarm ~0.15),
  not a bug to chase.
- **Lethe as an arm.** Deliberately out: its numbers depend on an LLM in
  the loop and the comparison would be model, not mechanism.

## Threats to validity

- **One generator, one style.** One subject, one slot, one value per note;
  the contradiction tiers are templates. Real notes are mushier, and the
  product's own graph has already shown a shape (long, multi-clause titles
  about one subject) the generator did not.
- **The product's models grade the product.** The reranker and the NLI
  model are the product's; the flat stores get the embedder only, which is
  the point of the comparison (mechanism, not model) and also its limit.
- **Pollution is three shapes,** and drift in the wild has more: a note
  that quietly stopped being true, a tombstone whose victim was re-derived
  in different words, a supersession whose successor is in another
  component.
- **Trust reads the wall clock** while the world's clock is fixed, so
  trust-modulated rankings move by a hair between days. The structural
  columns (pollution 0.00, lineage 1.00, gone 1.00, leak 0.00) do not.
- **No behaviour.** Whether an agent acts on what it recalls is the rake
  test's question (`eval/rake/`), a separate online track.

## What is next

- The `historical` trap and the tier-3 `transitive` case as the documented
  ceiling of an encoder-only nomination path, with the number printed.
- A `collider`-style negative for every family, not only contradiction.
- A pollution shape the generator cannot template: a note that stopped
  being true without any sibling saying so.
- The resurrection warning at scale (0.50 at 1500): the marker is crowded
  out of the eight nearest — a role-aware retrieval slot for tombstones is
  the obvious lever and needs a receipt before it ships.
