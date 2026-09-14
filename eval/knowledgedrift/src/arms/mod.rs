//! In-process arms: the product, and the baselines every claim is measured
//! against. External systems do not live here — they replay the exported
//! script and are graded from their transcript.

pub mod engram;
pub mod flat;

pub use engram::EngramArm;
pub use flat::{FlatArm, Mode};

use engram_core::Nli;

/// The logic layer, and the name of whatever actually loaded — real under
/// `--features fastembed`, the deterministic fake otherwise.
pub fn nli() -> (Box<dyn Nli>, String) {
    #[cfg(feature = "fastembed")]
    {
        match engram_core::FastNli::new() {
            Ok(n) => return (Box::new(n), engram_core::nli::NLI_MODEL_NAME.to_string()),
            Err(err) => eprintln!("! real NLI unavailable ({err}); falling back to fake"),
        }
    }
    (Box::new(engram_core::FakeNli), "fake".to_string())
}

/// Every in-process arm by name, in the order the tables print them.
pub const ARM_NAMES: [&str; 6] = ["engram", "rag", "grep", "curated", "whole", "chance"];
