# BB fork catalog contract

Read the workspace [AGENTS.md](../AGENTS.md) and this repository's
[README.md](README.md) before changing the overlay. Existing native/plugin-first
and explicit core-change approval rules remain in force.

`capabilities.json` owns the current capability catalog; `CAPABILITIES.md` is its
generated reading view. `DOWNSTREAM.md` retains historical rationale and receipts.
Organize current entries by the product capability and motivation, not patch
chronology. Each selected patch has exactly one primary capability owner; shared
source files can appear under multiple capabilities with their distinct reasons.

Adding, changing or removing a selected patch, or changing the upstream base,
requires reviewing the affected catalog entries in the same change. Describe
current behavior, responsibility, affected areas and why. For database/state
changes name the tables, columns, indexes, migrations or journals and their
upgrade obligations. For SDK/API changes name the members, routes or protocol
fields, visibility, consumers and behavior, including removals. Generated schema
snapshots are not independent capabilities. Record known limitations honestly.

After that review, record the capability's current source digest and regenerate
the reading view with `node scripts/check-capability-catalog.mjs --write`.
`--print-source-digests` supplies expected values for review; it does not update
the catalog or establish semantic correctness. Never refresh bindings blindly,
weaken coverage or delete explanations just to make a check pass.

`scripts/verify` runs the catalog's adversarial tests and checks the exact net
footprint after replay. `scripts/materialize` and `scripts/probe-upstream-replay`
reject stale queue/catalog state before creating a checkout. Run
`node scripts/check-capability-catalog.mjs --checkout build/bb` when inspecting an
existing materialization. A clean mechanical check proves coverage, source
freshness and generated-view consistency; the reviewer must still establish that
the explanations and listed contracts are accurate. It is not runtime acceptance
or authorization for a deployment or data migration.
