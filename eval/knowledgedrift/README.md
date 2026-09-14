# KnowledgeDrift

An offline, judge-free benchmark for AI memory in software development.

One seeded world of invented project knowledge is poured into a memory
system through a ten-operation protocol, and then the system is questioned,
re-decided, contradicted, asked to forget, and asked again. Every probe is a
**task** with a pass/fail rule fixed before the question was asked. The
headline is the **mean success over every task**, beside a macro-averaged
**composite** and an efficiency-multiplied **score**. Nothing in the loop is a
language model, and nothing asks a model whether a model did well.

```sh
cargo test -p knowledgedrift                                        # fast, fake models — what CI runs
cargo run -p knowledgedrift --features fastembed                     # the official ladder, 500 and 1500, six in-process arms
cargo run -p knowledgedrift -- --sizes 100 --sample                 # read what it generates
cargo run -p knowledgedrift -- --sizes 100,500 --export /tmp/kd     # scripts for an external adapter
cargo run -p knowledgedrift --features fastembed -- --sizes 500 --seed 2               # another seed (the ladder is quoted over three)
cargo run -p knowledgedrift --features fastembed -- --sizes 500 --pollution-shape twin  # a harder stale sibling
cargo run -p knowledgedrift -- --grade transcript.json --script /tmp/kd/knowledgedrift-100-seed1.json
```

Status: **the harness, six in-process arms and two external adapters
(Mem0, LangMem) are built and measured** on the official ladder below, with
a three-seed ladder at 500 and two extra pollution shapes. Working name;
the folder may move to its own repository. `WRITEUP.md` is the narrative
reading of the results; this file is the internals.

---

## Why another benchmark

Every published memory benchmark scores recall, and most of the 2026
knowledge-update and forgetting benchmarks score it with an LLM judge over
chat-shaped facts. None of them asks the questions a coding agent's memory
actually fails on: *is the note you found the current one, or the one we
re-decided?* — *did you notice that these two notes disagree?* — *is this
thing still in memory after I told you to forget it, and do you know why it
left?* — *why did we decide that?* — *what did we decide around the time of
the outage?* — and, underneath all of them, *how many tokens did the reader
have to wade through to get the answer?*

This harness combines everything `eval/` already measured in isolation — the
retrieval ladder, the attention columns, the abstention controls, the
supersession chains, the contradiction bench, the ForgetEval families — into
one script over one world, so that a single number can be read per system
and every family can be read behind it.

Two design rules come from adapting ForgetEval (`eval/forgeteval/`):

- **A system that cannot do something says so.** Capabilities are declared,
  and the families that need a missing one are marked N/A with the reason —
  never scored as a mysterious zero. The headline *does* charge for them
  (a memory that cannot notice drift has not noticed it); the row beside it
  reports success over attempted tasks for the capability-aware reading.
- **The harness addresses notes by its own key.** ForgetEval resolves the
  target of a mutation by searching for it, which measures the resolver as
  much as the mutation (a fixed delivery floor blinded three supersessions
  in a row). Here every operation names the note it acts on, and the adapter
  keeps the key → native id map.

## The world

The notes come from `engram-eval`'s generator (`eval/src/generate.rs`): every
subject is coined (*Vanor lease broker*), so nothing can be answered from
pretraining or from having read this repository; every note is shaped to a
real graph's profile (title and body length by quartile, code refs, edge mix)
and every answer is a substring the generator knows.

On top of that, `world.rs` adds what the benchmark is about:

| ingredient | how many at `--sizes N` | what it is for |
|---|---|---|
| tested facts | N, five kinds evenly (Decision, Caution, Principle, Problem, Insight) | every one is questioned three ways; the others are the noise |
| links | ~1.06 per note, verbs `about` / `builds-on` / `because` / `answers` | structure the rationale family walks |
| re-decided subjects | max(4, N/20) chains of `--chain-len` generations, a month apart | currency: is the head current, is the history reachable |
| **pollution** | `--pollution` share of tested subjects (default **10%**), shaped by `--pollution-shape` | a stale sibling of the fact — same subject, flipped value — imported and **never superseded by anyone**; three shapes below |
| capture times | spread over `spread_days` (60) | temporal scoping; the world's "now" is 2026-09-01 |
| controls | N/4 subjects that are never written | abstention |
| planted contradictions | max(6, N/3) cases across ten shapes | the contradiction ladder |
| deletions | max(4, N/6) victims, half released with a reason, half purged | deletion honesty |

Every arm sees the same script; a golden digest of the script travels in
every transcript and every receipt, and a transcript for a different world
is refused rather than scored.

### Pollution shapes

The stale sibling is the same flipped restatement under every shape; what
`--pollution-shape` changes is which of the three signals that could give
it away — the wording, the body, the clock — is left in. Each shape
removes one, so a family's pollution number can be attributed to a
mechanism instead of assumed.

| shape | title | body | capture time | what it isolates |
|---|---|---|---|---|
| `stale` (default) | flipped, generator's wording | *"Recorded before the X was re-tuned; kept for reference."* | 20–40 days **before** the truth | everything a reader could use is present |
| `twin` | flipped, generator's wording | **the truth's own body**, verbatim | 20–40 days before | the unlinked successor's victim: value and clock are the only difference — can anything but a suspect queue tell them apart? |
| `late` | flipped, generator's wording | the `stale` hint | 20–40 days **after** the truth (a migration stamps import time as capture time) | the clock now lies: does any arm read recency as truth? |

The default world's digest does not change because the knob exists (the
shape is omitted from the file when it is the default), so scripts exported
before 0.9.5 still grade.

## The protocol

Ten operations (`protocol.rs`). An adapter implements them against its
native API; the harness never reaches around them.

| op | meaning | a flat store does |
|---|---|---|
| `inscribe(record, mode)` | write a note; `import` is a bulk load, `write` is an assistant-style note with the system's write-time checks | insert |
| `link(from, to, verb)` | store a sentence-shaped link | nothing (`link: false`) |
| `supersede(old, new)` | `new` re-decides `old`: from now on `old` is not current | replace in place (`history: false`) |
| `release(key, reason)` | retire a note deliberately, leaving whatever trace the system leaves | delete (`trace: false`) |
| `purge(key)` | destroy a note | delete |
| `settle()` | a session boundary: calibration, sweeps, consolidation | nothing |
| `recall(query, k, window?)` | top-k, optionally scoped to a capture-time window | rank, filter by date if it has one |
| `suspects()` | every disagreement the system wants a person to judge | `None` (`suspects: false`) |
| `lineage(key)` | the supersession history reachable from a note | `None` |
| `standing_tokens()` | what the system costs every session before a question is asked | 0 (a file: its size) |

A write returns a verdict, if the system has one: `matched` (refused as a
near-duplicate, pointing at the existing note), `nli_label` on that pair,
`warnings` (`tombstoned` is the graded one), and any `suspects` the write
queued. A recall returns hits carrying the **exact text shown to the
caller** (a snippet or a whole note — that is what attention bills), a
score, a `tombstone` flag, the capture time and the keys of any notes the hit
carries as 1-hop context; plus `declined` (the system's own "not sure this is
in memory") and `dump` (the system does not rank; presence is delivery).

### The wire format

`--export DIR` writes one script per size:

```json
{ "spec": { "size": 100, "seed": 1, "k": 10, "pollution": 0.1, "chains": 5, "chain_len": 3, "...": "..." },
  "digest": "3f0c…",
  "ops": [
    { "op": "inscribe", "record": { "key": "f0000", "kind": "Decision", "title": "...", "body": "...", "code_refs": [], "created_at": 1782000000, "open": false }, "mode": "import" },
    { "op": "link", "from": "f0003", "to": "f0011", "verb": "because" },
    { "op": "supersede", "old": "f0100", "new": { "key": "f0101", "...": "..." } },
    { "op": "settle" },
    { "op": "recall", "id": "R1", "query": "Vanor lease broker retry budget", "k": 10 },
    { "op": "recall", "id": "R77", "query": "...", "k": 10, "window": { "after": 1781000000, "before": 1781900000 } },
    { "op": "inscribe", "id": "W1", "record": { "key": "c0a", "...": "..." }, "mode": "write" },
    { "op": "suspects", "id": "S" },
    { "op": "release", "key": "f0004", "reason": "no longer applies after the lease broker rework" },
    { "op": "lineage", "id": "L1", "key": "f0102" }
  ],
  "probes": [
    { "id": "R1", "family": "retrieval", "expect": "gold", "gold": "f0000", "phrasing": "lexical", "stale": "s-f0000" },
    { "id": "C0", "family": "contradiction", "expect": "case", "gold": "f0000", "planted": ["c0a"], "witness": "c0a", "tier": 1, "shape": "value", "positive": true }
  ] }
```

The adapter replays `ops` in order and returns a transcript: one reply per
op that carries an `id`, echoing that id, plus its capabilities, standing
cost and per-op timings:

```json
{ "arm": "mem0", "capabilities": { "link": false, "history": false, "trace": false, "suspects": false, "temporal": true, "verdict": false, "write_check": false },
  "standing_tokens": 0, "script_digest": "<the script's digest field, copied>",
  "replies": [
    { "reply": "recall", "id": "R1", "result": { "hits": [ { "key": "f0000", "text": "...", "score": 0.81, "created_at": 1782000000 } ] } },
    { "reply": "inscribe", "id": "W1", "result": { "matched": "f0000", "nli_label": "contradiction" } },
    { "reply": "suspects", "id": "S", "pairs": [ { "a": "c0a", "b": "f0000", "hint": "contradiction" } ] },
    { "reply": "lineage", "id": "L1", "keys": ["f0101", "f0100"] }
  ],
  "timing": { "recall": { "count": 340, "total_ms": 1234.5 } } }
```

`--grade transcript.json --script script.json` scores it exactly as an
in-process arm is scored. The grader panics on a missing reply rather than
scoring it zero: an adapter error that empties a recall must never look like
an honest "the graph is silent".

## The families

Each family poses tasks; each task has one rule. Columns are means over
the family's tasks unless noted. Ordering inside the script keeps the
families from crowding each other: retrieval, abstention, currency,
rationale and temporal are probed on the untouched world; the contradiction
cases are planted after that; the deletions come last.

### retrieval — does it come back?

Three questions per tested fact: **lexical** (the fact's own words),
**paraphrase** (names the subject, rewords the rest), **oblique** (never names
the subject, shares no content vocabulary). Rank of the gold among live hits;
a dump delivers what it holds at rank 1.

*Pass:* gold in the top five **and not outranked by its stale sibling** when
the subject was polluted (a dump holding both is ambiguous and fails).
Columns: `r@1`, `r@5`, `mrr`, per-phrasing `r@5`, `weighted_r@5` (45/45/10 —
a stated assumption), `stale_above` (over polluted questions), `hedge` (the
gold was delivered under a decline), `noise`, `tokens`.

### attention — what did the reader wade through?

No tasks; read off the retrieval probes. **focus** = the share of delivered
tokens that belonged to the answering record, when it was delivered; this is
the signal share `S` the multiplier reads. **noise** = the share of delivered
records that were not the answer (a miss with ten hits is 1.00; an empty
return is 0.00, because saying nothing tells no lies). **tokens_per_query**
and **standing_tokens** price the two halves of the bill.

### abstention — does it say no?

One question per subject that was never written. *Pass:* nothing delivered,
or delivered under the system's own decline signal. Columns: `fp` (the
failure rate), `answered`, `declined`, and `separation` — the balanced
accuracy of the best threshold between answerable and control top scores,
the threshold-free number a system with no decline rule can still be read
on. FP is never printed without recall beside it: a mute system wins it for
free.

### currency — is that the current one?

Every re-decided subject is asked about its current state, three ways.
*Pass:* the head in the top five and **no retired generation delivered at
all**. One lineage task per chain: *pass* = walking the history from the head
reaches every retired generation (N/A for a system without history).
Columns: `head_r@1`, `head_r@5`, `pollution`, `lineage`.

### contradiction — does it notice the disagreement?

Cases are planted as assistant-style writes after the world is probed, one
per target subject, rotating through eleven shapes in three tiers:

| tier | shape | polarity | what it plants |
|---|---|---|---|
| 1 | `value` | + | the same claim with a flipped value or polarity, near the original's wording — similarity alone should catch it |
| 2 | `negation` | + | *It is not the case that the X …* |
| 2 | `unit` | + | a different value in a converted unit (7 seconds vs 19000 milliseconds) |
| 2 | `quantifier` | + | *every deployment / without exception / has not happened once* |
| 2 | `paraphrase` | − | an agreeing restatement — must not be flagged |
| 2 | `unit_agree` | − | the same value in a converted unit — must not be flagged |
| 2 | `coreference` | − | the flipped claim about a *different* subject in the same component — must not be flagged |
| 2 | `collider` | − | a different, unrelated claim about the *same* subject (another kind's predicate re-attached to it) — must not be flagged; the shape the dogfood graph raised fifty-six of on the first live sweep |
| 3 | `transitive` | + | two notes: *X mirrors every setting of G* and the flipped claim about G — the contradiction exists only across the bridge |
| 3 | `compound` | + | a sentence that agrees with the note and then, as a separate matter, contradicts it |
| 3 | `historical` | − | *until the 3.1 rollout X …; the rollout changed that and the current note stands* — reads as a contradiction, is history |

Tier 2 is where a sentence-pair logic layer earns its place; tier 3 is what
it is not expected to survive, and the score documents that ceiling rather
than hiding it. A pair counts as **raised** if it sits in the suspect queue
at the end of the run, was queued by the write itself, or the write was
refused as a near-duplicate of the gold. The strongest hint attached is the
system's label.

*Pass, positive:* raised, not **absorbed** (merged away as a duplicate
without a contradiction label), and not hinted `entailment`. *Pass,
negative:* never raised, or raised with a clearing hint (`entailment` /
`neutral`), or merged as the duplicate it is. Raised with a contradiction
hint or with no hint at all is a wasted human judgment and fails. Columns:
`t1_recall` `t2_recall` `t3_recall`, `t2_false_alarm` `t3_false_alarm`,
`queued`, `flagged`, `absorbed`. N/A for a system with no suspect queue.

### drift — did it notice what nobody told it about?

One task per polluted subject: the stale sibling was imported beside the
fact, never superseded, never planted as a "case". *Pass:* the system raised
the pair on its own by the end of the run, without hinting `entailment`.
This is the family the benchmark is named for. N/A without a suspect queue.

### deletion — does it stay gone, and does it know why?

Half the victims are **released** with a reason, half **purged**. Each is
then asked for by its own lexical question, and then written back.
*Pass (absent):* the victim is gone as live knowledge (a deletion marker
flagged `tombstone` does not count as the victim). *Pass (resurrect,
released only):* writing the victim again comes back with a `tombstoned`
warning. Columns: `released_gone`, `purged_gone`, `trace` (a marker was
delivered), `marker_leak` (a marker's text still carries the victim's
answer — the ForgetEval finding, measured), `resurrection_warned`,
`purged_rewrite_warned` (a column, never a task: nobody can warn about a
note that no longer exists).

### rationale — can it answer *why*?

For `because` edges: *why does the X …?* with the reason at the far end as
gold. For `answers` edges: *what answers the open issue where …?* with the
resolution as gold. *Pass:* gold in the top five directly, **or carried as
1-hop context by a top-five hit**. Columns: `direct_r@5`, `assisted_r@5`,
`structure_only` — the share only the graph could reach.

### temporal — what did we decide around then?

The paraphrase question for a subject, scoped to ±`window_days` around its
capture. *Pass:* gold in the top five and no delivered hit captured outside
the window. Columns: `in_window_r@5`, `leak`. N/A for a system without a
clock (a file).

### cost

No tasks. `standing_tokens`, `tokens_per_query`, and mean milliseconds per
operation kind from the transcript's timings.

## The numbers

Every task is posed to every system; the task list is fixed by the script.
A system attempts every task its capabilities cover — the product attempts
all of them; a flat store skips the suspect, drift and lineage tasks, a file
skips the temporal ones too.

- **success** = passed / tasks posed. An N/A task counts as failed. The
  headline.
- **of attempted** = passed / tasks attempted. The ForgetEval-style,
  capability-aware reading, printed beside it; identical to success for a
  system that attempts everything.
- **composite** = the unweighted mean of the eight families' pass rates,
  an N/A family scoring zero. A macro-average, so a family with twelve tasks
  weighs the same as one with three hundred.
- **S** = mean focus over the retrieval tasks that delivered the answer.
- **multiplier** = clamp(10·S, 0.1, 10). Ten percent signal is the ×1
  baseline, half is ×5, a memory that hands the reader nothing but the
  answer is ×10 — and a dump whose answer is one percent of what it shows
  keeps a tenth of its composite.
- **score** = 100 × composite × multiplier, read as a whole number: a
  composite of 0.87 at ×6.4 is **550**; a dump at 0.49 and ×0.1 is **5**.

The multiplier is a stated sketch, not a measurement: it makes token
efficiency the headline instead of a side column, and it is printed beside
the unmultiplied composite so a reader can take it or leave it. Two things
keep it honest: a system that answers nothing has no delivered answers, so
`S` is 0 and the multiplier bottoms out at 0.1 — silence cannot buy the ×10;
and misses count noise 1.00 in the attention columns as the ladder always
did.

## Arms

In-process, every run:

| arm | what it is |
|---|---|
| `engram` | `engram_core::Engine` over an in-memory store, driven the way the daemon drives it: checked writes, `replaces` edges, tombstoned deletes, auto-tune and the conflict sweep at every `settle`, the calibrated verdict on every recall |
| `rag` | pure vector top-k with the same embedder — no keyword channel, no priors, no reranker, no graph, no history |
| `grep` | keyword overlap over the same records, whole records shown |
| `curated` | a hand-maintained memory file: durable kinds first, question-blind hash order, trimmed entries, 3,000 tokens, always in context |
| `whole` | every record in context every time |
| `chance` | records picked by hashing the query — the floor |

External, through Python adapters that replay the exported script
(`adapters/`): `langmem` (LangMem's memory layer — the LangGraph store with
its semantic index) and `mem0` (Mem0 OSS, `infer=False`). Lethe is
deliberately not an arm here.

## Receipts

`eval/results/<date>-knowledgedrift-<sizes>[-seedN|-<shape>|-nogate].json`
(+ `.log`), and `…-<size>[-seedN]-<adapter>.json` for a graded external
transcript — the generator
version, which models actually loaded (and whether they were fake), and per
size: the world spec, the script digest, and every arm's graded report
including the ids of every failed task, so a number can be read back to the
case that produced it.

## Results — the official ladder, 500 and 1500

Real models (bge-small-en-v1.5, jina-reranker-v1-turbo-en,
deberta-v3-small-tasksource-nli), seed 1, pollution 10%, k 10, run
2026-09-14. Receipts: `eval/results/2026-09-14-knowledgedrift-500-1500.json`
(+ `.log`) for the six in-process arms, `…-500-1500-nogate.*` for the
ablation with the title-contradiction path off, and
`…-{500,1500}-{langmem,mem0}.json` for the two external systems, replayed
through `adapters/` with the same embedder. Seed 1 is quoted; the
three-seed ladder at 500 below says which digits are stable.

**500 tested facts** (630 notes, 2,346 tasks):

| arm | success | passed / attempted | composite | S | mult | score | standing tok | tok/query |
|---|---|---|---|---|---|---|---|---|
| **engram** | **85%** | 2,005 / 2,346 | **0.905** | 0.57 | ×5.7 | **511** | 3,875 | 263 |
| langmem | 63% | 1,477 / 2,058 | 0.469 | 0.11 | ×1.1 | 51 | 0 | 2,328 |
| rag | 63% | 1,478 / 2,058 | 0.469 | 0.11 | ×1.1 | 51 | 0 | 2,335 |
| mem0 | 58% | 1,361 / 2,058 | 0.438 | 0.10 | ×1.0 | 45 | 0 | 2,581 |
| grep | 53% | 1,241 / 2,058 | 0.418 | 0.10 | ×1.0 | 44 | 0 | 2,606 |
| whole file | 71% | 1,658 / 1,933 | 0.486 | 0.00 | ×0.1 | 5 | 141,258 | 134,043 |
| curated (3k) | 9% | 203 / 1,933 | 0.151 | 0.03 | ×0.3 | 4 | 2,988 | 2,950 |
| chance | 4% | 99 / 2,058 | 0.132 | 0.11 | ×1.1 | 15 | 0 | 2,311 |

**1500 tested facts** (1,883 notes, 7,078 tasks):

| arm | success | passed / attempted | composite | S | mult | score | standing tok | tok/query |
|---|---|---|---|---|---|---|---|---|
| **engram** | **80%** | 5,694 / 7,078 | **0.877** | 0.52 | ×5.2 | **459** | 3,769 | 289 |
| langmem | 57% | 4,066 / 6,220 | 0.442 | 0.12 | ×1.2 | 52 | 0 | 2,147 |
| rag | 57% | 4,064 / 6,220 | 0.442 | 0.12 | ×1.2 | 52 | 0 | 2,153 |
| mem0 | 55% | 3,880 / 6,220 | 0.430 | 0.11 | ×1.1 | 47 | 0 | 2,452 |
| grep | 51% | 3,575 / 6,220 | 0.412 | 0.10 | ×1.0 | 43 | 0 | 2,620 |
| whole file | 71% | 5,041 / 5,845 | 0.487 | 0.00 | ×0.1 | 5 | 423,672 | 401,934 |
| curated (3k) | 5% | 376 / 5,845 | 0.134 | 0.03 | ×0.3 | 4 | 2,982 | 2,932 |
| chance | 4% | 273 / 6,220 | 0.129 | 0.10 | ×1.0 | 13 | 0 | 2,322 |

`langmem` is LangMem's memory layer — the LangGraph store with its semantic
index, the three calls its tools make — and `mem0` is Mem0 OSS with
`infer=False` (no LLM anywhere; the run is socket-guarded), local Qdrant and
hybrid BM25 on; both embed with the product's bge-small and both declare
only capture-time scoping, so the suspect, drift and lineage tasks are
charged as N/A. `adapters/langmem.md` and `adapters/mem0.md` state every
shim. Lethe is deliberately not an arm.

The product's families at 1500 (pass rate, then the columns that explain it):

| family | tasks | pass | reading |
|---|---|---|---|
| retrieval | 4,500 | 75% | r@5 0.78, oblique 0.34, `stale_above` 0.23 — one polluted question in four hands the reader the stale value first; hedge 0.35, noise 0.58 |
| abstention | 330 | 98% | fp 0.02, declined 0.98, separation 0.76 |
| currency | 300 | 80% | head r@5 0.74, pollution 0.00, lineage 1.00 — retired generations never come back and the history is always reachable |
| contradiction | 500 | 75% | t1 0.78, t2 0.91, t3 0.01; false alarms t2 0.03, t3 0.15 (the `historical` trap); queued 0.54 |
| drift | 158 | 91% | noticed 0.91, flagged 0.73 |
| deletion | 375 | 83% | released and purged both gone 1.00; trace 1.00; `marker_leak` 1.00; resurrection warned 0.50 (0.69 at 500, 1.00 at 100 — the marker is crowded out of the eight nearest as the graph grows) |
| rationale | 540 | 99% | direct 0.00, assisted 0.99 — *why* is answered by the graph, never by ranking |
| temporal | 375 | 99% | in-window r@5 0.99, leak 0.00 |

<details>
<summary>What the ladder says</summary>

**Three flat stores are one system in three packages.** With the same
embedder, `rag`, `langmem` and `mem0` score within four points of each
other at every rung and fail identically: fp 1.00 (nothing declines),
rationale 22% at 100 falling to 1% at 1500 (a *why* question only structure
answers), the stale sibling ranked above the answer on ~40% of polluted
questions, and no suspect, drift or lineage task attempted. Mem0 sits
lowest because its hybrid BM25 rescoring on top of the same vectors costs
oblique recall (0.19 vs 0.35 at 1500) while lexical stays 1.00 — the
keyword channel is a weight on the wrong register, the lesson the ladder's
own keyword retune taught in 0.7.2.

**The distance is in the families a flat store cannot attempt, and in the
bill.** On retrieval alone the flat stores match or beat the product's
r@5 (0.76 vs 0.78 at 1500, 0.94 vs 0.92 at 100); the product's lead is
abstention, rationale, the suspect queue, the resurrection warning, and
attention: 263–289 tokens per answer at a focus of 0.52–0.57 against
~2,300 at 0.11.

**The whole file scores 71% of the tasks at every rung** and 401,934 tokens
per question at 1500; its composite is 0.49 and its score 5. **The curated
file loses by 100 notes** (29% → 9% → 5%): the crossover the ladder argued
from capacity is a behavioural number here.

**What moves with scale for the product**: oblique recall 0.54 → 0.34,
head r@5 0.84 → 0.74, resurrection warning 0.69 → 0.50, tier-1 contradiction
0.94 → 0.78 — every one a ranking-depth effect on a growing graph; the
structural columns (pollution 0.00, lineage 1.00, gone 1.00, leak 0.00) do
not move.

</details>

### Three seeds at 500

Receipts `…-500-seed2.json`, `…-500-seed3.json` and
`…-500-seed{2,3}-{langmem,mem0}.json` beside seed 1 (`python3
adapters/table.py --seeds … --size 500` prints this). Mean, then min–max:

| arm | success | composite | score |
|---|---|---|---|
| **engram** | **85% (84–85)** | 0.907 (0.898–0.918) | **525 (511–543)** |
| langmem | 63% (61–66) | 0.468 (0.461–0.473) | 52 (51–54) |
| rag | 63% (61–66) | 0.468 (0.461–0.473) | 52 (51–54) |
| mem0 | 59% (57–61) | 0.443 (0.438–0.447) | 46 (45–48) |
| grep | 53% (51–55) | 0.418 (0.414–0.422) | 43 (42–44) |
| whole file | 71% (69–74) | 0.487 (0.483–0.492) | 5 (5–5) |
| curated (3k) | 9% (9–9) | 0.156 (0.151–0.160) | 4 (4–4) |
| chance | 4% (4–4) | 0.131 (0.131–0.132) | 13 (11–15) |

Success is stable to about one point per arm and the ordering never
changes; LangMem and `rag` agree on every seed. The product's families:
retrieval 81% (80–82), abstention 100% (99–100), currency 89% (87–91),
contradiction 74% (72–75), drift 93% (91–97), deletion 90%, rationale
100% (99–100), temporal 100% (99–100). The widest column is the tier-3
false alarm (0.21–0.37), which sits on six to ten `historical` cases.

### Pollution shapes at 500

`…-500-twin.json` and `…-500-late.json` against the default (seed 1).
`stale_above` = share of polluted questions whose stale sibling outranked
the answer; `noticed` = drift pairs the suspect queue raised.

| shape | engram success | engram stale_above | engram drift noticed | rag stale_above | grep stale_above |
|---|---|---|---|---|---|
| `stale` (default) | 85% | 0.21 | 0.91 | 0.38 | 0.58 |
| `twin` | 82% | **0.64** | **0.98** | 0.55 | 0.78 |
| `late` | 85% | **0.35** | 0.91 | 0.38 | 0.58 |

Without the body hint no ranker separates the twins (the reranker reads
the hint, not the calendar), and the drift queue is what carries the
family — it notices 98% of twin pairs, so the product loses three points,
all in retrieval. Under a lying clock the flat stores do not move (they
never read capture time) while the product's `stale_above` rises 0.21 →
0.35: recency is a weak prior in its ranking, and the receipt says by how
much. `WRITEUP.md` reads both in full.

### The bench fixed the product, and the product's own graph fixed the fix

The suspect scan as it shipped until 0.9.5 (`--no-nli-gate` below) raised
almost none of the planted contradictions, and half of the drifted
siblings. The gate probe (`examples/gate_probe.rs`) measured every channel
a nomination rule could read and produced the title-contradiction path
described in `eval/CONTRADICTIONS.md` (`policy.conflict_nli_gate`). Its
first version — gate 0.70, a subject guard that let subject-less titles
through — looked clean on this bench and then raised **56 false alarms on
this repository's own graph in one sweep**: pairs of release notes and
"two facts about one subject" pairs that an MNLI model reads as
contradictions because every detail differs. Those 56 rows were fed back
into the probe beside the planted cases, the world gained the missing
negative shape (`collider`), and the rule that survives all four
populations is the one that shipped: both titles name a subject and share
one, they share a content word past the subject phrase, gate 0.80 — 8 of
15 planted positives kept, 8 of 10 drifted siblings, 4 of the 56 real false
alarms.

| | contradiction @500 | drift @500 | success @500 | score @500 | contradiction @1500 | drift @1500 | success @1500 | score @1500 |
|---|---|---|---|---|---|---|---|---|
| similarity-gated queue (`--no-nli-gate`) | 58% (t1 0.06, t2 0.23) | 53% | 83% | 472 | 59% (t1 0.04, t2 0.26) | 47% | 78% | 420 |
| **+ title-contradiction path** | **75%** (t1 0.94, t2 0.97, t3 0.00) | **91%** | **85%** | **511** | **75%** (t1 0.78, t2 0.91, t3 0.01) | **91%** | **80%** | **459** |

Every other family and every baseline reproduce to the digit between the
two runs; the path costs ≤ 8 title judgments per write or swept note,
~16 ms each, and a full sweep of this repository's ~800-note graph took
about 25 seconds.

<details>
<summary>What the probe found</summary>

No similarity channel separates a planted contradiction from a trap:
full-note cosine 0.69–0.81 for positives against 0.64–0.77 for negatives,
title-only and claim cosine the same — MemStrata's "similarity cannot
detect contradiction" reproduced inside the product's own gate. NLI on the
claim text (title plus first body sentence, what `check_claim` reads)
scores negations 0.54; NLI on the bare titles scores them 0.99, quantifier
flips 0.93, value flips 0.80, paraphrases 0.13. Its blind spots are
co-reference (two subjects with flipped values, 0.94 — the RefNLI failure)
and, on real prose, two unrelated facts about one subject (the release
notes at 0.92), hence the two guards. What remains failing is the tier-3
ceiling: `transitive` sits below the 0.50 candidate floor and names a
different subject, `compound` scores 0.03 because its agreeing first clause
dominates, and `historical` ("until the rollout X …; the current note
stands") reads as a contradiction to any sentence-pair judge — now the
family's honest false-alarm floor.

</details>

## What this does not show

- **The corpus is invented and clean.** One subject, one slot, one value per
  note. Real notes are mushier; the contradiction tiers are templates, and a
  system that aces them has aced templates.
- **Pollution is three shapes of one thing.** A stale sibling with a
  flipped value — hinted, twinned, or stamped late. Drift with no sibling
  at all — a note that quietly stopped being true, a tombstone whose
  victim was re-derived in other words — is not generated yet.
- **Tier 3 is a ceiling, not a target.** Nothing encoder-only is expected to
  raise the transitive case; the number is there so nobody claims otherwise.
- **The world's clock is fixed** at 2026-09-01 while the engine's trust reads
  the wall clock, so trust-modulated rankings drift by a hair from day to
  day. Structural columns (pollution, lineage, gone) do not.
- **No behaviour.** Whether an agent *acts* on what it recalls is the rake
  test's question (`eval/rake/`), and it stays a separate, online track.
- **Without `--features fastembed`** every model is a deterministic fake:
  the lexical path is measured, the semantic numbers are noise, and the
  receipt says so at the top.

## Layout

```
eval/knowledgedrift/
  src/protocol.rs   the ten operations, the wire types, Capabilities
  src/script.rs     Op / Probe / Expect, Transcript / Reply, the digest
  src/world.rs      the generator: import order, pollution, shapes, targets
  src/runner.rs     replay a script against a Memory, time every op
  src/grade.rs      the rules, the columns, success / composite / score
  src/report.rs     terminal tables
  src/arms/         engram (the product) and the flat baselines
  src/main.rs       --sizes --seed --pollution --pollution-shape --arms
                    --export --grade --json
                    --no-nli-gate (ablation: the pre-0.9.5 suspect scan)
  examples/         gate_probe.rs — what separates a planted contradiction
                    from a trap: every channel a nomination rule could read
```
