use std::process::ExitCode;

use knowledgedrift::arms::{ARM_NAMES, EngramArm, FlatArm, Mode, nli};
use knowledgedrift::grade::{Graded, grade};
use knowledgedrift::protocol::Memory;
use knowledgedrift::report::{print_arm, print_summary};
use knowledgedrift::script::{PollutionShape, Script, Transcript};
use knowledgedrift::world::{WorldConfig, build};
use knowledgedrift::{VERSION, runner};

const USAGE: &str = "\
knowledgedrift — an offline, judge-free benchmark for AI memory in software development

USAGE:
    knowledgedrift [OPTIONS]

OPTIONS:
    --sizes 500,1500      tested facts per world; every fact is questioned
                          and the rest of the world is the noise. The official
                          ladder is 500 and 1500              [default: 500,1500]
    --seed N              world seed                          [default: 1]
    --k N                 results a recall may return         [default: 10]
    --pollution R         share of subjects imported with a stale sibling
                          nobody superseded                   [default: 0.10]
    --pollution-shape S   how the stale sibling is shaped: stale (older,
                          hinted body — the default), twin (older, the
                          truth's own body: only value and clock differ),
                          late (hinted, dated AFTER the truth — a migration
                          re-import)                          [default: stale]
    --chain-len N         generations per re-decided subject  [default: 3]
    --arms a,b,...        in-process arms to run
                          [default: engram,rag,grep,curated,whole,chance]
    --no-rerank           drop the cross-encoder from the engram arm (a
                          diagnostic, not a product option)
    --no-nli-gate         switch off the engram arm's title-contradiction
                          nomination path (policy.conflict_nli_gate = null)
                          — the pre-0.9.4 suspect scan, for the ablation
    --json PATH           write the receipt
    --export DIR          write each world's script as JSON (for external
                          adapters) and exit
    --grade TRANSCRIPT    grade an external transcript; needs --script
    --script SCRIPT       the script the transcript answers
    --sample              print a handful of ops and probes and exit

Without --features fastembed every model is a deterministic fake: the
harness runs and the lexical path is exercised, but no semantic number is
worth quoting, and the receipt says so.
";

fn main() -> ExitCode {
    match cli() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("knowledgedrift: {e}");
            ExitCode::FAILURE
        }
    }
}

#[derive(serde::Serialize)]
struct SizeReceipt {
    spec: knowledgedrift::script::WorldSpec,
    digest: String,
    probes: usize,
    ops: usize,
    arms: Vec<Graded>,
}

#[derive(serde::Serialize)]
struct Receipt {
    generator: String,
    /// Diagnostics the run was started with, so a receipt says which stack
    /// it measured.
    flags: Vec<String>,
    embedder: String,
    reranker: String,
    nli: String,
    embeddings_are_fake: bool,
    sizes: Vec<SizeReceipt>,
}

fn cli() -> anyhow::Result<()> {
    let mut cfg = WorldConfig::default();
    let mut sizes: Vec<usize> = vec![500, 1500];
    let mut arms: Vec<String> = ARM_NAMES.iter().map(|s| s.to_string()).collect();
    let mut no_rerank = false;
    let mut no_nli_gate = false;
    let mut json_out: Option<String> = None;
    let mut export: Option<String> = None;
    let mut grade_path: Option<String> = None;
    let mut script_path: Option<String> = None;
    let mut sample = false;

    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        let mut value = || -> anyhow::Result<String> {
            args.next()
                .ok_or_else(|| anyhow::anyhow!("{arg} needs a value"))
        };
        match arg.as_str() {
            "-h" | "--help" => {
                print!("{USAGE}");
                return Ok(());
            }
            "--sizes" => {
                sizes = value()?
                    .split(',')
                    .map(|s| s.trim().parse::<usize>())
                    .collect::<Result<_, _>>()?;
            }
            "--seed" => cfg.seed = value()?.parse()?,
            "--k" => cfg.k = value()?.parse()?,
            "--pollution" => cfg.pollution = value()?.parse()?,
            "--pollution-shape" => {
                let v = value()?;
                cfg.shape = PollutionShape::parse(&v).ok_or_else(|| {
                    anyhow::anyhow!(
                        "unknown pollution shape {v}; shapes are {}",
                        PollutionShape::NAMES.join(", ")
                    )
                })?;
            }
            "--chain-len" => cfg.chain_len = value()?.parse()?,
            "--arms" => arms = value()?.split(',').map(|s| s.trim().to_string()).collect(),
            "--no-rerank" => no_rerank = true,
            "--no-nli-gate" => no_nli_gate = true,
            "--json" => json_out = Some(value()?),
            "--export" => export = Some(value()?),
            "--grade" => grade_path = Some(value()?),
            "--script" => script_path = Some(value()?),
            "--sample" => sample = true,
            other => anyhow::bail!("unknown option {other} (try --help)"),
        }
    }
    anyhow::ensure!(!sizes.is_empty(), "--sizes needs at least one size");
    anyhow::ensure!(
        (0.0..=1.0).contains(&cfg.pollution),
        "--pollution is a share in 0..1"
    );
    anyhow::ensure!(
        cfg.chain_len >= 2,
        "--chain-len needs something to supersede"
    );
    for a in &arms {
        anyhow::ensure!(
            ARM_NAMES.contains(&a.as_str()),
            "unknown arm {a}; in-process arms are {}",
            ARM_NAMES.join(", ")
        );
    }

    if let Some(path) = grade_path {
        let script_path = script_path.ok_or_else(|| anyhow::anyhow!("--grade needs --script"))?;
        let script: Script = serde_json::from_str(&std::fs::read_to_string(&script_path)?)?;
        let transcript: Transcript = serde_json::from_str(&std::fs::read_to_string(&path)?)?;
        let g = grade(&script, &transcript)?;
        print_summary(
            script.spec.size,
            script.spec.notes,
            std::slice::from_ref(&g),
        );
        print_arm(&g);
        if let Some(out) = json_out {
            std::fs::write(&out, serde_json::to_string_pretty(&g)?)?;
            println!("\nwrote {out}");
        }
        return Ok(());
    }

    if sample {
        cfg.size = sizes[0];
        let s = build(&cfg);
        println!(
            "world {} — {} ops, {} probes, digest {}",
            cfg.size,
            s.ops.len(),
            s.probes.len(),
            s.digest()
        );
        for op in s.ops.iter().take(6) {
            println!("{}", serde_json::to_string(op)?);
        }
        println!("…");
        for p in s.probes.iter().step_by(s.probes.len().max(1) / 12).take(12) {
            println!("{}", serde_json::to_string(p)?);
        }
        return Ok(());
    }

    if let Some(dir) = export {
        std::fs::create_dir_all(&dir)?;
        for &size in &sizes {
            cfg.size = size;
            let s = build(&cfg);
            let path = format!("{dir}/knowledgedrift-{size}-seed{}.json", cfg.seed);
            std::fs::write(&path, serde_json::to_string_pretty(&s)?)?;
            println!(
                "wrote {path} ({} ops, {} probes, digest {})",
                s.ops.len(),
                s.probes.len(),
                s.digest()
            );
        }
        return Ok(());
    }

    let (_, embedder_name) = engram_eval::run::embedder(None);
    let (_, reranker_name) = if no_rerank {
        (None, "disabled (--no-rerank)".to_string())
    } else {
        engram_eval::run::reranker()
    };
    let (_, nli_name) = nli();
    let fake = embedder_name.contains("(fake)");
    if no_nli_gate {
        eprintln!("! engram arm runs with policy.conflict_nli_gate = null (ablation)");
    }
    if fake {
        eprintln!("! fake embedder: the lexical path is measured, the semantic numbers are noise");
    }
    println!(
        "knowledgedrift {VERSION} — embedder {embedder_name}, reranker {reranker_name}, nli {nli_name}, seed {}, pollution {:.0}% ({})",
        cfg.seed,
        cfg.pollution * 100.0,
        cfg.shape.name()
    );

    let mut flags = Vec::new();
    if no_rerank {
        flags.push("--no-rerank".to_string());
    }
    if no_nli_gate {
        flags.push("--no-nli-gate".to_string());
    }
    let mut receipt = Receipt {
        generator: format!("knowledgedrift {VERSION}"),
        flags,
        embedder: embedder_name,
        reranker: reranker_name,
        nli: nli_name,
        embeddings_are_fake: fake,
        sizes: Vec::new(),
    };

    for &size in &sizes {
        cfg.size = size;
        let s = build(&cfg);
        eprintln!(
            "world {size}: {} notes, {} edges, {} ops, {} probes",
            s.spec.notes,
            s.spec.edges,
            s.ops.len(),
            s.probes.len()
        );
        let mut graded = Vec::new();
        for name in &arms {
            let started = std::time::Instant::now();
            let mut arm: Box<dyn Memory> = match name.as_str() {
                "engram" => {
                    let arm = EngramArm::build(
                        engram_eval::run::embedder(None).0,
                        if no_rerank {
                            None
                        } else {
                            engram_eval::run::reranker().0
                        },
                        Some(nli().0),
                    )?;
                    if no_nli_gate {
                        arm.tune(|p| p.conflict_nli_gate = None)?;
                    }
                    Box::new(arm)
                }
                "rag" => Box::new(FlatArm::new(
                    Mode::Rag,
                    Some(engram_eval::run::embedder(None).0),
                )),
                "grep" => Box::new(FlatArm::new(Mode::Grep, None)),
                "curated" => Box::new(FlatArm::new(
                    Mode::Curated(knowledgedrift::arms::flat::DEFAULT_CURATED_BUDGET),
                    None,
                )),
                "whole" => Box::new(FlatArm::new(Mode::Whole, None)),
                "chance" => Box::new(FlatArm::new(Mode::Chance, None)),
                other => anyhow::bail!("unknown arm {other}"),
            };
            let t = runner::run(&s, arm.as_mut())?;
            let g = grade(&s, &t)?;
            eprintln!(
                "  {name}: {} tasks, success {:.3}, {:.0}s",
                g.tasks,
                g.success,
                started.elapsed().as_secs_f64()
            );
            if let Some(note) = &g.settle_note {
                eprintln!("    settle: {note}");
            }
            graded.push(g);
        }
        print_summary(size, s.spec.notes, &graded);
        for g in &graded {
            print_arm(g);
        }
        receipt.sizes.push(SizeReceipt {
            spec: s.spec.clone(),
            digest: s.digest(),
            probes: s.probes.len(),
            ops: s.ops.len(),
            arms: graded,
        });
    }

    if let Some(path) = json_out {
        std::fs::write(&path, serde_json::to_string_pretty(&receipt)?)?;
        println!("\nwrote {path}");
    }
    Ok(())
}
