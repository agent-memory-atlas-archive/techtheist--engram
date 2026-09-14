//! Gate probe: what separates a planted contradiction from a planted trap —
//! and from the real false alarms the dogfood graph raised?
//!
//! Runs a world through the engram arm, then measures, for every
//! contradiction case and every drifted sibling, the channels a nomination
//! rule could read: full-note cosine (the shipped similarity gate), title
//! and claim cosine, NLI contradiction on the claim text and on the bare
//! titles (both directions), the subject guard in its lenient and strict
//! forms, content-word overlap beyond the subject, reranker relevance, title
//! length, and where the gold sits among the planted note's neighbours. A
//! second argument names a JSON array of real suspect rows (as
//! `/projects/<p>/conflicts/suspects` returns them), every one a known false
//! alarm, scored on the same title channels. Then every candidate rule is
//! printed against all four populations.
//!
//!   cargo run --release -p knowledgedrift --features fastembed --example gate_probe [size] [real.json]

use std::collections::{BTreeMap, HashSet};

use knowledgedrift::arms::{EngramArm, nli};
use knowledgedrift::script::Expect;
use knowledgedrift::{runner, world};

fn cosine(a: &[f32], b: &[f32]) -> f64 {
    let (mut d, mut na, mut nb) = (0.0f64, 0.0f64, 0.0f64);
    for (x, y) in a.iter().zip(b) {
        d += f64::from(*x) * f64::from(*y);
        na += f64::from(*x) * f64::from(*x);
        nb += f64::from(*y) * f64::from(*y);
    }
    if na == 0.0 || nb == 0.0 {
        0.0
    } else {
        d / (na.sqrt() * nb.sqrt())
    }
}

/// What the engine's `claim()` reads: the title plus the first body sentence.
fn claim(title: &str, body: Option<&str>) -> String {
    let mut text = title.trim().to_string();
    if let Some(b) = body {
        let first = b.trim().replace('\n', " ");
        let first = first.split(". ").next().unwrap_or("").trim().to_string();
        if !first.is_empty() && !text.to_lowercase().contains(&first.to_lowercase()) {
            text.push_str(". ");
            text.push_str(&first);
        }
    }
    text
}

const STARTERS: [&str; 40] = [
    "it", "in", "the", "until", "every", "before", "after", "when", "if", "a", "an", "on", "at",
    "for", "to", "not", "no", "never", "always", "there", "this", "that", "these", "those", "we",
    "our", "one", "all", "any", "some", "use", "do", "under", "since", "while", "with", "without",
    "as", "by", "from",
];

fn subject_tokens(title: &str) -> HashSet<String> {
    title
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .enumerate()
        .filter(|(i, w)| {
            w.chars().next().is_some_and(char::is_uppercase)
                && !(*i == 0 && STARTERS.contains(&w.to_lowercase().as_str()))
        })
        .map(|(_, w)| w.to_lowercase())
        .collect()
}

/// Lenient guard (shipped first): undecidable passes.
fn same_subject(a: &str, b: &str) -> bool {
    let (sa, sb) = (subject_tokens(a), subject_tokens(b));
    sa.is_empty() || sb.is_empty() || !sa.is_disjoint(&sb)
}

/// Strict guard: both titles name a subject and share one.
fn decidable_same(a: &str, b: &str) -> bool {
    let (sa, sb) = (subject_tokens(a), subject_tokens(b));
    !sa.is_empty() && !sb.is_empty() && !sa.is_disjoint(&sb)
}

const STOP: [&str; 60] = [
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "it",
    "its",
    "in",
    "on",
    "of",
    "for",
    "to",
    "and",
    "or",
    "that",
    "this",
    "what",
    "which",
    "who",
    "how",
    "did",
    "does",
    "do",
    "we",
    "our",
    "us",
    "you",
    "be",
    "been",
    "with",
    "from",
    "by",
    "at",
    "as",
    "if",
    "not",
    "no",
    "yes",
    "about",
    "into",
    "than",
    "then",
    "so",
    "up",
    "case",
    "every",
    "without",
    "exception",
    "any",
    "all",
    "one",
    "until",
    "after",
    "before",
    "has",
    "have",
    "had",
    "never",
];

/// Content words shared beyond the subject — the engine's rule: the titles'
/// common leading words are stripped (a multi-word subject is not a shared
/// claim), then lowercase runs of three or more characters, stopwords and
/// subject tokens out, compared on their first five characters.
fn overlap(a: &str, b: &str) -> usize {
    let toks = |t: &str| -> Vec<String> {
        t.split(|c: char| !c.is_alphanumeric())
            .filter(|w| !w.is_empty())
            .map(|w| w.to_lowercase())
            .collect()
    };
    let (ta, tb) = (toks(a), toks(b));
    // The subject phrase is the common prefix, capped at three words: past
    // that a shared prefix is the claim itself with a clause appended, and
    // the claim's words must stay in the count.
    let prefix = ta
        .iter()
        .zip(&tb)
        .take_while(|(x, y)| x == y)
        .count()
        .min(3);
    let subj: HashSet<String> = subject_tokens(a)
        .union(&subject_tokens(b))
        .cloned()
        .collect();
    let words = |t: &[String]| -> HashSet<String> {
        t.iter()
            .filter(|w| w.len() >= 3 && !STOP.contains(&w.as_str()) && !subj.contains(*w))
            .map(|w| w.chars().take(5).collect())
            .collect()
    };
    words(&ta[prefix..])
        .intersection(&words(&tb[prefix..]))
        .count()
}

fn real_pairs(path: &str) -> Vec<(String, String)> {
    let text = std::fs::read_to_string(path).expect("real pairs file");
    let rows: Vec<serde_json::Value> = serde_json::from_str(&text).expect("json array");
    rows.iter()
        .filter_map(|r| {
            Some((
                r["a"]["title"].as_str()?.to_string(),
                r["b"]["title"].as_str()?.to_string(),
            ))
        })
        .collect()
}

#[derive(Debug, Clone)]
struct Row {
    shape: String,
    /// 0 = drifted sibling, 1–3 = planted tier, 9 = real false alarm.
    tier: u8,
    positive: bool,
    full: f64,
    title: f64,
    claim: f64,
    nli_claim: f64,
    nli_title: f64,
    nli_min: f64,
    lenient: bool,
    decidable: bool,
    overlap: usize,
    rerank: f64,
    title_len: usize,
    label: String,
    gold_rank: Option<usize>,
}

fn main() -> anyhow::Result<()> {
    let size: usize = std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(100);
    let real = std::env::args()
        .nth(2)
        .map(|p| real_pairs(&p))
        .unwrap_or_default();
    let cfg = world::WorldConfig {
        size,
        ..world::WorldConfig::default()
    };
    let script = world::build(&cfg);
    let mut arm = EngramArm::build(
        engram_eval::run::embedder(None).0,
        engram_eval::run::reranker().0,
        Some(nli().0),
    )?;
    let _t = runner::run(&script, &mut arm)?;
    let engine = arm.engine();
    let store = engine.store();
    let (embedder, ename) = engram_eval::run::embedder(None);
    let (judge, nname) = nli();
    let (reranker, rname) = engram_eval::run::reranker();
    eprintln!(
        "probe: {ename}, nli {nname}, reranker {rname}, size {size}, real pairs {}",
        real.len()
    );
    let relevance = |a: &str, b: &str| -> f64 {
        match &reranker {
            Some(r) => r
                .rank(a, &[b.to_string()])
                .ok()
                .and_then(|v| v.first().copied())
                .map(|logit| 1.0 / (1.0 + (-f64::from(logit)).exp()))
                .unwrap_or(0.0),
            None => 0.0,
        }
    };

    let mut rows: Vec<Row> = Vec::new();
    let (mut nli_ms, mut nli_calls) = (0.0f64, 0usize);
    for p in &script.probes {
        let (gold, witness, shape, tier, positive) = match &p.expect {
            Expect::Case {
                gold,
                witness,
                shape,
                tier,
                positive,
                ..
            } => (
                gold.clone(),
                witness.clone(),
                shape.clone(),
                *tier,
                *positive,
            ),
            Expect::Drifted { gold, stale } => {
                (gold.clone(), stale.clone(), "drift".to_string(), 0, true)
            }
            _ => continue,
        };
        let (Some(gid), Some(wid)) = (arm.id_of(&gold), arm.id_of(&witness)) else {
            eprintln!("  {shape}: witness {witness} was not created (matched) — skipped");
            continue;
        };
        let (Some(g), Some(w)) = (store.get_node(gid)?, store.get_node(wid)?) else {
            continue;
        };
        let (Some(gv), Some(wv)) = (store.embedding_of(gid)?, store.embedding_of(wid)?) else {
            continue;
        };
        let full = cosine(&gv, &wv);
        let title = cosine(
            &embedder.embed_one(&g.title)?,
            &embedder.embed_one(&w.title)?,
        );
        let (gc, wc) = (
            claim(&g.title, g.body.as_deref()),
            claim(&w.title, w.body.as_deref()),
        );
        let claim_cos = cosine(&embedder.embed_one(&gc)?, &embedder.embed_one(&wc)?);
        let symc = judge.judge_pair(&gc, &wc)?;
        let started = std::time::Instant::now();
        let symt = judge.judge_pair(&g.title, &w.title)?;
        nli_ms += started.elapsed().as_secs_f64() * 1000.0;
        nli_calls += 1;
        let near = store.search_vec(&wv, 32)?;
        rows.push(Row {
            shape,
            tier,
            positive,
            full,
            title,
            claim: claim_cos,
            nli_claim: f64::from(symc.forward.contradiction.max(symc.backward.contradiction)),
            nli_title: f64::from(symt.forward.contradiction.max(symt.backward.contradiction)),
            nli_min: f64::from(symt.forward.contradiction.min(symt.backward.contradiction)),
            lenient: same_subject(&g.title, &w.title),
            decidable: decidable_same(&g.title, &w.title),
            overlap: overlap(&g.title, &w.title),
            rerank: relevance(&g.title, &w.title),
            title_len: g.title.len().max(w.title.len()),
            label: symt.hint().0.to_string(),
            gold_rank: near.iter().position(|(id, _)| id == gid).map(|r| r + 1),
        });
    }
    eprintln!(
        "nli judge_pair mean {:.1} ms over {nli_calls} calls",
        nli_ms / nli_calls.max(1) as f64
    );
    for (ta, tb) in &real {
        let symt = judge.judge_pair(ta, tb)?;
        rows.push(Row {
            shape: "real-fa".into(),
            tier: 9,
            positive: false,
            full: 0.0,
            title: 0.0,
            claim: 0.0,
            nli_claim: 0.0,
            nli_title: f64::from(symt.forward.contradiction.max(symt.backward.contradiction)),
            nli_min: f64::from(symt.forward.contradiction.min(symt.backward.contradiction)),
            lenient: same_subject(ta, tb),
            decidable: decidable_same(ta, tb),
            overlap: overlap(ta, tb),
            rerank: relevance(ta, tb),
            title_len: ta.len().max(tb.len()),
            label: symt.hint().0.to_string(),
            gold_rank: Some(1),
        });
    }

    // ---- per shape --------------------------------------------------------
    let mut by: BTreeMap<String, Vec<&Row>> = BTreeMap::new();
    for r in &rows {
        let key = format!(
            "t{} {} {}",
            r.tier,
            if r.positive { "+" } else { "-" },
            r.shape
        );
        by.entry(key).or_default().push(r);
    }
    let mean = |xs: &[f64]| xs.iter().sum::<f64>() / xs.len().max(1) as f64;
    let min = |xs: &[f64]| xs.iter().cloned().fold(f64::INFINITY, f64::min);
    println!(
        "{:<18} {:>3} {:>11} {:>11} {:>11} {:>11} {:>11} {:>7} {:>7} {:>7} {:>7} {:>4} {:>14}",
        "shape",
        "n",
        "full",
        "title",
        "claim",
        "nli-claim",
        "nli-title",
        "nli-min",
        "lenient",
        "decid",
        "overlap",
        "len",
        "labels"
    );
    for (k, v) in &by {
        let col = |f: &dyn Fn(&Row) -> f64| -> Vec<f64> { v.iter().map(|r| f(r)).collect() };
        let (f, t, c) = (col(&|r| r.full), col(&|r| r.title), col(&|r| r.claim));
        let (nc, nt, nm) = (
            col(&|r| r.nli_claim),
            col(&|r| r.nli_title),
            col(&|r| r.nli_min),
        );
        let ov = col(&|r| r.overlap as f64);
        let len = col(&|r| r.title_len as f64);
        let lenient = v.iter().filter(|r| r.lenient).count();
        let decid = v.iter().filter(|r| r.decidable).count();
        let mut labels: BTreeMap<&str, usize> = BTreeMap::new();
        for r in v.iter() {
            *labels.entry(r.label.as_str()).or_default() += 1;
        }
        println!(
            "{:<18} {:>3} {:>5.2}/{:<5.2} {:>5.2}/{:<5.2} {:>5.2}/{:<5.2} {:>5.2}/{:<5.2} {:>5.2}/{:<5.2} {:>7.2} {:>4}/{:<2} {:>4}/{:<2} {:>3.1}/{:<3.0} {:>4.0} {:?}",
            k,
            v.len(),
            mean(&f),
            min(&f),
            mean(&t),
            min(&t),
            mean(&c),
            min(&c),
            mean(&nc),
            min(&nc),
            mean(&nt),
            min(&nt),
            mean(&nm),
            lenient,
            v.len(),
            decid,
            v.len(),
            mean(&ov),
            min(&ov),
            mean(&len),
            labels
        );
    }

    // ---- rules ------------------------------------------------------------
    let pos: Vec<&Row> = rows
        .iter()
        .filter(|r| r.positive && (1..=3).contains(&r.tier))
        .collect();
    let neg: Vec<&Row> = rows.iter().filter(|r| !r.positive && r.tier < 9).collect();
    let drift: Vec<&Row> = rows.iter().filter(|r| r.tier == 0).collect();
    let realfa: Vec<&Row> = rows.iter().filter(|r| r.tier == 9).collect();
    println!(
        "\n{:<52} {:>9} {:>9} {:>9} {:>9}",
        "rule", "pos", "neg", "drift", "real-fa"
    );
    let report = |name: &str, rule: &dyn Fn(&Row) -> bool| {
        let c = |xs: &[&Row]| xs.iter().filter(|r| rule(r)).count();
        println!(
            "{:<52} {:>4}/{:<4} {:>4}/{:<4} {:>4}/{:<4} {:>4}/{:<4}",
            name,
            c(&pos),
            pos.len(),
            c(&neg),
            neg.len(),
            c(&drift),
            drift.len(),
            c(&realfa),
            realfa.len()
        );
    };
    let top8 = |r: &Row| r.gold_rank.is_some_and(|k| k <= 8);
    for g in [0.70, 0.80, 0.85, 0.90] {
        report(&format!("lenient && nli-title >= {g:.2}"), &|r| {
            r.lenient && r.nli_title >= g && top8(r)
        });
    }
    for g in [0.70, 0.80, 0.85, 0.90, 0.95] {
        report(&format!("decidable && nli-title >= {g:.2}"), &|r| {
            r.decidable && r.nli_title >= g && top8(r)
        });
    }
    for g in [0.70, 0.80, 0.85] {
        report(
            &format!("decidable && overlap >= 1 && nli-title >= {g:.2}"),
            &|r| r.decidable && r.overlap >= 1 && r.nli_title >= g && top8(r),
        );
        report(
            &format!("decidable && overlap >= 2 && nli-title >= {g:.2}"),
            &|r| r.decidable && r.overlap >= 2 && r.nli_title >= g && top8(r),
        );
    }
    for g in [0.50, 0.70, 0.80] {
        report(&format!("decidable && nli-min >= {g:.2}"), &|r| {
            r.decidable && r.nli_min >= g && top8(r)
        });
    }
    for (rr, g) in [(0.5, 0.70), (0.7, 0.70), (0.9, 0.70), (0.5, 0.85)] {
        report(
            &format!("decidable && rerank >= {rr:.1} && nli-title >= {g:.2}"),
            &|r| r.decidable && r.rerank >= rr && r.nli_title >= g && top8(r),
        );
    }
    for (l, g) in [(120usize, 0.70), (100, 0.70), (120, 0.85)] {
        report(
            &format!("decidable && len <= {l} && nli-title >= {g:.2}"),
            &|r| r.decidable && r.title_len <= l && r.nli_title >= g && top8(r),
        );
    }

    // ---- every row ----------------------------------------------------------
    println!(
        "\nshape               tier pos  full title claim nlic  nlit  nmin  rr   len dec ov label          gold-rank"
    );
    for r in &rows {
        println!(
            "{:<19} {:>4} {:>3} {:>5.2} {:>5.2} {:>5.2} {:>4.2} {:>5.2} {:>5.2} {:>4.2} {:>4} {:>3} {:>2} {:<14} {:?}",
            r.shape,
            r.tier,
            if r.positive { "+" } else { "-" },
            r.full,
            r.title,
            r.claim,
            r.nli_claim,
            r.nli_title,
            r.nli_min,
            r.rerank,
            r.title_len,
            if r.decidable { "y" } else { "n" },
            r.overlap,
            r.label,
            r.gold_rank
        );
    }
    Ok(())
}
