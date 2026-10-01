//! The write-timing bench (0.9.11): how long a checked write holds the
//! engine, measured the way a user feels it — as the wait of a reader that
//! wants the graph while assistants write.
//!
//! A background corpus is written into a real TepinDB store (the product's
//! backend, in a temp dir) with the shipped cortex; then `writes` fresh notes
//! go through `Engine::add_node_checked_shared` — the MCP write path — while
//! a reader thread keeps asking for the engine every few milliseconds and
//! records how long each acquisition waited. Insight 00dxfvuv1j1f measured
//! ~175 ms locked per write at 1500 notes, 144 ms of it embedding; this mode
//! is the committed receipt for moving that embedding off the lock.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;

use engram_core::{AuditOrigin, Engine, WriteOutcome, open_store};

use crate::arms::new_node;
use crate::generate::corpus;
use crate::run::{Config, embedder, nli, reranker};

#[derive(Debug, Clone, Serialize)]
pub struct WritesReport {
    pub embedder: String,
    pub reranker: String,
    pub nli: String,
    pub background: usize,
    pub writes: usize,
    pub created: usize,
    pub matched: usize,
    /// Wall time of one checked write, end to end (ms).
    pub write_ms: Stats,
    /// How long the reader waited for the engine while writes ran (ms).
    pub reader_wait_ms: Stats,
    pub reader_samples: usize,
    /// The reader's waits summed: how long the graph was unavailable to it
    /// in all. The percentiles above are per ATTEMPT — one 300 ms stall is
    /// one sample among hundreds of free ones — so this is the honest total.
    pub reader_blocked_ms: f64,
    /// Total wall time of the writes (ms), the base for `reader_blocked_ms`.
    pub writes_wall_ms: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Stats {
    pub mean: f64,
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
    pub max: f64,
}

fn stats(mut xs: Vec<f64>) -> Stats {
    if xs.is_empty() {
        return Stats {
            mean: 0.0,
            p50: 0.0,
            p95: 0.0,
            p99: 0.0,
            max: 0.0,
        };
    }
    xs.sort_by(f64::total_cmp);
    let at = |q: f64| xs[((xs.len() - 1) as f64 * q).round() as usize];
    Stats {
        mean: xs.iter().sum::<f64>() / xs.len() as f64,
        p50: at(0.50),
        p95: at(0.95),
        p99: at(0.99),
        max: *xs.last().unwrap(),
    }
}

pub fn run(cfg: &Config, writes: usize) -> anyhow::Result<WritesReport> {
    let size = cfg.sizes.first().copied().unwrap_or(1500);
    let dir = std::env::temp_dir().join(format!("engram-eval-writes-{}", std::process::id()));
    std::fs::create_dir_all(&dir)?;
    let result = (|| -> anyhow::Result<WritesReport> {
        let store = open_store(dir.join("graph.tepin"))?;
        let (emb, embedder_name) = embedder(cfg.embed_model.as_deref());
        {
            let dim = emb.embed_one("dimension probe")?.len();
            store.reset_vectors(dim)?;
        }
        let mut engine = Engine::with_store(store, emb);
        let (rr, reranker_name) = reranker();
        if let Some(r) = rr {
            engine.set_reranker(r);
        }
        let (nli_model, nli_name) = nli();
        engine.set_nli(nli_model);

        // The background is written unchecked: it is the graph the writes
        // land in, not what is measured.
        let background = corpus(size, 0, cfg.seed);
        for f in &background.facts {
            engine.add_node(new_node(f))?;
        }
        // Fresh notes from another seed — same register, different facts.
        let fresh = corpus(writes, 0, cfg.seed.wrapping_add(7919));

        let engine = Arc::new(Mutex::new(engine));
        let stop = Arc::new(AtomicBool::new(false));
        let reader = {
            let (engine, stop) = (engine.clone(), stop.clone());
            std::thread::spawn(move || {
                let mut waits = Vec::new();
                while !stop.load(Ordering::Relaxed) {
                    let asked = Instant::now();
                    let guard = engine.lock().expect("engine lock");
                    waits.push(asked.elapsed().as_secs_f64() * 1000.0);
                    let _ = guard.graph_config();
                    drop(guard);
                    std::thread::sleep(Duration::from_millis(5));
                }
                waits
            })
        };
        let origin = AuditOrigin {
            origin: "library".into(),
            session_id: None,
        };
        let (mut write_ms, mut created, mut matched) = (Vec::new(), 0, 0);
        for f in fresh.facts.iter().take(writes) {
            let started = Instant::now();
            match Engine::add_node_checked_shared(&engine, origin.clone(), new_node(f))? {
                WriteOutcome::Created { .. } => created += 1,
                WriteOutcome::Matched { .. } => matched += 1,
            }
            write_ms.push(started.elapsed().as_secs_f64() * 1000.0);
        }
        stop.store(true, Ordering::Relaxed);
        let waits = reader.join().expect("reader thread");
        let writes_wall_ms = write_ms.iter().sum();
        let reader_blocked_ms = waits.iter().sum();
        Ok(WritesReport {
            embedder: embedder_name,
            reranker: reranker_name,
            nli: nli_name,
            background: background.facts.len(),
            writes: write_ms.len(),
            created,
            matched,
            write_ms: stats(write_ms),
            reader_samples: waits.len(),
            reader_wait_ms: stats(waits),
            reader_blocked_ms,
            writes_wall_ms,
        })
    })();
    let _ = std::fs::remove_dir_all(&dir);
    result
}
