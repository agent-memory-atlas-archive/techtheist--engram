# KnowledgeDrift

An offline, judge-free benchmark for AI memory in software development.

## The ladder: 1,500 tested facts

1,883 notes, 9,008 tasks, one seed, every system with the same local
embedder (`results/v2/`):

| system                                               | success | families | signal | tokens | **score** | tok / answer |
|------------------------------------------------------|---|---|---|---|---|---|
| TF-IDF over titles, one snippet per answer (`tfidf`) | 43% | 442 | 37 | 100 | **580** | ~160 |
| the whole file in context                            | 71% | 390 | 0 | 0 | **390** | ~404,000 |
| MemContinuum 0.2.0rc5 (topics + `for-path` chains)   | 44% | 326 | 7 | 47 | **380** | ~840 |
| vector top-k (`rag`)                                 | 48% | 340 | 7 | 11 | **359** | ~2,200 |
| LangMem 0.0.30 (store + semantic index)              | 48% | 340 | 7 | 11 | **359** | ~2,200 |
| Mem0 2.0.20 (`infer=False`)                          | 44% | 333 | 6 | 8 | **348** | ~2,400 |
| keyword overlap (`grep`)                             | 41% | 315 | 6 | 3 | **325** | ~2,800 |
| cognee 1.5.4 (no LLM: chunk store)                   | 43% | 240 | 8 | 16 | **263** | ~1,900 |
| chance                                               | 3% | 103 | 0 | 9 | **112** | ~2,300 |
| a curated 3,000-token file                           | 5% | 108 | 0 | 1 | **109** | ~2,960 |
| Engram Alpha 0.9.5                                   | 66% | 616 | 32 | 69 | **718** | ~460 |

Benchmark lives in its own repo, all details and updates there:
https://github.com/techtheist/knowledgedrift/