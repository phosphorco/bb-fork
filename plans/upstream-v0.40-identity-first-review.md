# BB 0.40 identity-first plan review record

Review target:
[`upstream-v0.40-identity-first.md`](upstream-v0.40-identity-first.md)

Review method: three independent GPT-5.6 Sol/high reviewers. The architecture
and migration reviewers completed first. Their findings were then supplied to
the third reviewer, who reconciled overlaps, contradictions, and omissions
before the plan was revised.

This record summarizes disposition; it is not release evidence. Commands,
hashes, manifests, test results, and GO decisions must still be captured by the
plan's phase gates.

## Review consensus

The identity-first 0.40 port is feasible and preferable to replaying the whole
feature-shaped fork. Its defensible core is:

- server-resolved identity with explicit assurance and fail-closed boundaries;
- discriminated accepted origin persisted at every creation/send boundary;
- request-lifetime authored operations and disjoint plugin-external authority;
- durable accepted-turn author for agent tools;
- coordinated server/daemon protocol and workspace runtime behavior; and
- stored-author presentation, with a narrow participant read only after data
  equivalence is demonstrated.

Generic facets, native prompt stacks, native personal appearance, broad roster
and grant APIs, and unrelated presentation patches should not block 0.40.

## Findings adopted into the executable plan

### Repository and promotion

- The patch inventory is derived at freeze time rather than hard-coded. It must
  include patch 0032 and every later authored candidate.
- Phase 0 produces an executable candidate-to-invariant/upstream-symbol/new-
  patch/tests/disposition table and stops on unattributed overlapping work.
- The editable fork overlay branch is distinct from a temporary registered
  upstream replay worktree. The latter is never a runtime source.
- Normal deployment occurs only after tested child commits are pushed,
  workspace gitlinks are advanced and checked, the workspace receipt is
  committed/pushed, and `rosetta-machine` pins that receipt.

### Database migration and recovery

- The release recognizes an exact Rosetta legacy manifest, one active 0.40
  target manifest shared by fresh and adopted databases, and a separate
  allowlisted inert-facet manifest present only on Rosetta.
- A dedicated migration-only command obtains an OS lock for the canonical DB
  path. Ordinary server startup refuses legacy state rather than repairing it.
- On this one-host release, upstream 0107-0109, the corrective identity delta,
  and their receipts commit in one `BEGIN IMMEDIATE` transaction.
- Unknown receipts, semantic shapes, or `_bb_p6r_*` staging artifacts fail
  closed. The generalized old staging-recovery patches are not ported.
- Exact legacy/upstream hashes, SQLite version, `sqlite_schema` dependencies,
  deterministic streaming checksums, WAL/checkpoint/pragma state, free-space
  margin, backup hash/path/device, atomic restore, and file-backed kill tests
  are mandatory evidence.
- Preservation fixtures explicitly include deferred/marketplace rows, palette
  and prompt-stack settings, Thread Progress phase/section state, and all 360
  observed participant relations.
- Deployment has a migrated-read-only gate followed by a recorded first-write
  gate with a rehearsed paired rollback or an explicit forward-only recovery.

### Identity and accepted authorship

- Request actors carry `trusted-provider`, `local-operator`, or `claimed`
  assurance. Claimed identity is never verified authorization or a durable
  settings owner.
- Route auth is selected before identity resolution. Core/local/RPC routes may
  resolve; token/external/none routes do not, and secret auth headers never
  reach the provider. None routes are read-only.
- Provider WebSockets bind provider id and lease generation at handshake and
  close for re-authentication on provider replacement/release. Claimed
  switch/clear atomically rebinds presence state.
- Provider elapsed-time enforcement is described as a post-return budget unless
  moved behind a genuinely preemptible boundary.
- `AcceptedOrigin` is a discriminated human/agent/system/legacy model and is
  required across create, fork, plugin spawn, provisioning/retry, immediate,
  queue, deferred, edit, interaction, replacement, and compact paths.
- Public schemas cannot choose agent/system origin. Deferred acceptance uses a
  unique key consumed atomically with the accepted unit.
- Agent-tool `turnAuthor` comes only from the stored accepted unit.

### Plugin and presentation contracts

- Request-authored actions expire on handler settlement/abort and plugin
  reload/disposal. Real and fake hosts test captured-action misuse.
- Plugin-external authority is tagged and globally disjoint. Actor creation and
  accepted-unit creation are atomic. The unshipped route mode is named
  `external`, not `capability`.
- No durable authorship grant ships in 0.40.
- The organization-plugin consumer audit names identity-boundaries,
  notifications, ntfy, sticky-notes, Thread Progress, thread-manager, and
  agent-connect. Source contracts are frozen before the exact SDK exists;
  generated types and compilation happen after materialization.
- Thread Progress makes the shared identity-state helper required now: atomic
  CAS, idempotent mutation ids, server revision/local generation, one in-flight
  save, coalescing, owner switches, conflicts, invalidation, and reconnect all
  receive deterministic interleaving tests.
- Per-message presentation always uses the stored accepted author. A narrow
  thread participant field is conditional on a complete comparison against
  the 360 preserved relations, or an explicitly approved behavior change.
- Generic facet code is an absence gate on pristine 0.40, not a port-then-delete
  exercise. The obsolete Thread Progress facet-projection outbox receives an
  explicit disposition.
- Native personal appearance parity is not promised. Historical rows are
  preserved until a sanctioned surface and offline importer exist.

### Protocol rollout

- The release record includes the full 153/170-to-171 artifact timeline:
  publish, advertise, download, verify, install, restart, reconnect, and reject
  commands until convergence. Downgrade remains out-of-band and rehearsed.

## Deliberate scope decisions

- Supporting only empty and exact-Rosetta starting states is retained. It is a
  deliberate one-deployment scope reduction, not a generalized migration
  promise.
- Installed backend plugins remain trusted code. Capabilities prevent confused
  authority and cross-plugin namespace collisions; they do not create a
  malicious-plugin sandbox.
- Rosetta's historical facet objects may remain physically present and inert.
  Only the active application manifest must match a fresh database.
- Plugin prompt-stack state may use request-bound sends only while the
  initiating handler is alive. Any post-request requirement reopens the durable
  grant design instead of silently extending authority.

## Supporting policy updates

The review also updated:

- [`../FORK_MIGRATIONS.md`](../FORK_MIGRATIONS.md), for the migration-only
  bridge, manifest, evidence, and restore rules; and
- [`../MINIMAL_PLUGIN_CAPABILITIES.md`](../MINIMAL_PLUGIN_CAPABILITIES.md), for
  assurance, route-auth ordering, request lifetime, accepted-turn author,
  identity-state synchronization, participant equivalence, and explicit
  appearance deferral.
