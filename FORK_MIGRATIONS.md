# Database migrations in a long-lived BB fork

This document defines how the BB fork owns schema changes while continuing to
adopt upstream releases. It covers new downstream migrations, upstream releases
whose timestamps interleave with already-deployed fork migrations, and the
retirement of downstream features.

The objective is not to make Drizzle accept a convenient ledger. The objective
is to prove that the database has the schema and data represented by every
receipt that the migration runner will trust.

## Two metadata layers

Do not conflate these two forms of migration metadata:

1. **Source history** consists of `drizzle/meta/_journal.json`, generated
   snapshots, and migration SQL in the selected source release. It defines how
   a new database reaches that release.
2. **The deployed ledger** is the `__drizzle_migrations` table in each database.
   It records SQL that the deployment has already adopted. Drizzle normally
   uses the greatest `created_at` value as its high-water mark.

When rebasing the fork, regenerate source history from the pinned upstream
snapshot and append downstream migrations after upstream's high-water mark.
Never hand-edit generated snapshot JSON.

The deployed ledger may be reconciled by a reviewed compatibility bridge. A
ledger mutation is a schema operation, not bookkeeping: it is safe only after
the bridge has recognized the exact old receipt and proved the corresponding
schema and data invariants.

## Permanent rules

- Pin an immutable upstream release before generating downstream migrations.
- Preserve the upstream journal, SQL, and snapshots byte-for-byte as the source
  prefix.
- Give every new downstream migration a timestamp greater than the pinned
  upstream high-water mark. Keep downstream timestamps strictly increasing.
- Never renumber a downstream receipt after it has reached a database. Treat
  its exact timestamp and hash as historical provenance.
- Recognize historical fork receipts by both timestamp and hash. A matching
  timestamp alone is not authority.
- Validate semantic schema, not merely table names. Include columns, types,
  nullability, generated expressions, primary keys, indexes, foreign keys,
  checks, and any data invariants the feature requires.
- Commit each schema transition and its ledger receipt atomically.
- Make every bridge step restartable and idempotent. Unknown receipts or schema
  shapes fail closed.
- Run compatibility work in a dedicated migration-only process. Ordinary
  server startup must refuse a recognized legacy state with an actionable
  command; it must not repair that state while accepting traffic.
- Test migrations on a stopped, consistent copy of production data before the
  only live deployment is changed.

## Writing a new fork migration

For a new downstream change on a pinned upstream release:

1. Materialize the exact upstream source and run its migrations on an empty
   database.
2. Change the Drizzle schema source, not generated snapshots.
3. Run the upstream generator to create migration SQL, the next snapshot, and
   the journal entry.
4. Verify that the new timestamp is greater than every upstream entry in the
   pinned release and every current downstream source entry.
5. Review the generated SQL for table rebuilds, locking, disk amplification,
   and preservation of unrelated downstream columns.
6. Test empty, populated, interrupted, and second-run behavior.
7. Export the schema source, SQL, snapshot, journal, tests, and any compatibility
   bridge in the same logical downstream patch.

Do not create a migration by copying an old snapshot, changing its timestamp,
or editing `__drizzle_migrations` until the application starts. Those actions
can silence the runner without establishing the target schema.

## Adopting an upstream release after timestamps interleave

Suppose a deployed fork has downstream receipts between the old and new
upstream releases. The new source should still be a clean upstream prefix plus
new post-upstream downstream migrations. A pre-Drizzle compatibility bridge
reconciles the deployed database to that source history.

### 1. Freeze and inspect

- Stop all writers and prove that no process has the database, WAL, or SHM open.
- Acquire an operating-system lock keyed by the canonical database path before
  opening SQLite. Re-read the ledger and schema under that lock. Every BB
  migration/startup path must honor the same lock.
- Create a consistent backup with the service stopped or through SQLite's
  backup API. Do not copy an open database without its WAL state.
- Record the complete ledger, SQLite version, journal mode, foreign-key state,
  integrity result, schema fingerprint, material row counts, database size, and
  available disk space.
- Match the ledger and schema to one explicitly supported starting state.

### 2. Apply the missing upstream tail explicitly

Drizzle cannot fill a migration below the deployed high-water mark by itself.
For each missing upstream migration, the bridge must:

1. verify the expected pre-migration schema;
2. execute the exact upstream statements using the repository's migration SQL
   parser or runner;
3. verify the expected post-migration schema and preservation invariants; and
4. insert the exact upstream hash and timestamp into
   `__drizzle_migrations` in the same transaction as the schema change.

Do not insert an upstream receipt merely because later fork tables exist.

On the single-host Rosetta bridge, all supported upstream steps, downstream
corrective deltas, and receipts are one `BEGIN IMMEDIATE` transaction. The
bridge performs no network work and starts no application services. It commits
once, checkpoints, verifies, and exits. This deliberately stronger rule avoids
exposing a partially reconciled ledger between steps. A reusable multi-release
bridge may use smaller atomic steps only when each intermediate state is an
explicitly supported manifest.

### 3. Adopt an equivalent historical fork schema

Generate the current fork migration after the new upstream high-water mark. A
fresh database executes that migration normally. A recognized older fork
database may already have an equivalent schema under an old receipt.

For that database, the bridge may record the new receipt without replaying its
DDL only after a semantic fingerprint proves equivalence. Retain the exact old
receipt as provenance and record the old-to-current equivalence in code or a
dedicated compatibility table. This is adoption, not a claim that the new SQL
ran.

If the old schema is not equivalent, run a real corrective migration and record
the new receipt only when it commits. Never weaken the fingerprint to obtain an
adoption receipt.

### 4. Return to the ordinary runner

After explicit reconciliation, the ordinary Drizzle runner should see a
complete upstream prefix and the appropriate current downstream receipts. It
should perform either the remaining genuinely new migrations or no work.

Require a clean `foreign_key_check`, a successful `integrity_check`, expected
material counts, the target semantic fingerprint, and a no-op second run before
starting the server.

## Can the deployed ledger be rewritten?

Technically, yes. The ledger is an ordinary SQLite table. Rewriting it can be
appropriate for a single controlled deployment, but it must not be used to
make the migration runner skip unknown work.

Prefer inserting exact missing upstream receipts and current adoption receipts
while retaining historical fork rows. This keeps the evidence legible and
makes recovery easier.

An `UPDATE` or `DELETE` of an existing ledger row requires all of the following:

- the service is stopped and the bridge holds exclusive migration ownership;
- timestamp and hash match one known historical receipt;
- the current schema fingerprint and data invariants match that receipt;
- the target source journal and every replacement receipt are pinned;
- the mutation occurs transactionally with any required schema work;
- the original ledger is preserved in the migration evidence; and
- a production-data rehearsal proves restart and second-run behavior.

Changing only `created_at`, or pairing an old SQL hash with a new journal entry,
creates a false receipt. It may appear to work today and cause a later migration
to be skipped. Do not do it.

## BB 0.39 fork to upstream 0.40

The current Rosetta database contains these historical downstream receipts:

```text
1787517263970  303073917afaade57ab1072f09d51da7f62c42df71cc4e3009906b21b6d40709  0107_p6r_identity_authorship
1787520353659  e051e9e2591a08907d9b53bb1243a11d5c1384f07a131c4a2a9367b0b4954cce  0108_thread_facets
```

The pinned upstream 0.40 release adds:

```text
1787331095369  da63f96688d22f8b573b0673d1ba9e72051fde268f27052607231cb25bfae584  0107_kind_based_indexes
1787613751578  0ae872521ffd026ae67358c2ab016176711bf7477aa77060076c1100a0b30790  0108_deferred_thread_messages
1787680413251  c9ced750de5290719e05a9289ab15f65eddec720c212f6691d8a4a85d3d372d4  0109_marketplace_install_stats
```

The identity receipt has already advanced Drizzle beyond upstream 0107, so the
ordinary runner would skip `0107_kind_based_indexes`. The release supports
three explicit manifests:

1. **Rosetta legacy:** the two exact historical receipts, the known identity
   schema/data, and the known facet schema/data.
2. **Active 0.40 target:** the upstream 0.40 prefix plus the new post-0109
   identity migration. This active schema and ledger are identical for fresh
   databases and adopted Rosetta databases.
3. **Rosetta inert preservation:** the allowlisted historical facet receipt,
   tables, and rows that remain only on the adopted Rosetta database. These
   objects are outside the active application schema; their presence is not a
   claim that fresh and adopted physical databases are byte-for-byte equal.

The dedicated controlled bridge is:

1. require the exact Rosetta legacy manifest, including receipt hashes,
   SQLite version, complete semantic schema fingerprint, and named material
   data invariants;
2. fail closed if any `_bb_p6r_*` or other recovery/staging artifact exists;
   do not port the old generalized 0009/0013 staging-recovery machinery;
3. under the canonical-path OS lock and one `BEGIN IMMEDIATE` transaction,
   apply upstream 0107's exact semantics while preserving downstream identity
   columns and removing the obsolete generated `events.tool_name` column;
4. apply upstream 0108 and 0109, then apply the generated post-0109 identity
   corrective delta and record every exact receipt in that same transaction;
5. retain both old downstream receipts as provenance, but publish no current
   facet adoption receipt;
6. commit once, checkpoint, close the database, reopen read-only, and require
   the active 0.40 target plus the Rosetta inert-preservation manifest; and
7. prove the ordinary runner is a no-op. Normal server startup refuses the
   legacy manifest and points the operator to this bridge.

The semantic manifest includes every `sqlite_schema` dependency on
`events.tool_name`, not just columns and indexes, so the bridge cannot leave a
trigger/view/generated expression referring to it. Evidence records the SQLite
library version used. Large tables use deterministic ordered streaming
checksums rather than loading whole tables into memory. Named preservation
checks include actor/collaborator/event/queue/interaction rows, all 360 current
participant facet relations, deferred-message and marketplace fixtures, every
`p6r-appearance:*` value in `app_theme`, prompt-stack settings, and Thread
Progress phase/section state. Store counts, stable keys, and value hashes before
and after.

The production backup record contains canonical source and backup paths,
device identifiers, size, SHA-256, free-space margin including WAL and expected
rewrite amplification, and restore instructions. With all handles closed,
checkpoint the source; use `synchronous=FULL` for the bridge; restore the prior
mode only after verification. A rollback replaces the database atomically on
the same filesystem and quarantines any target WAL/SHM before reopening. Test
the bridge on a real file-backed production copy and kill it before the
transaction, during DDL/data copy, before commit, and after commit; every rerun
must either perform the one supported transition or report a verified no-op.

Because Rosetta is the only deployment, the first release may support just two
starting states: an empty database and Rosetta's exact recognized database.
That is a legitimate reduction in product scope. It does not justify accepting
an unknown ledger or skipping the production-copy rehearsal.

If generic Thread Facets are deferred, leave their historical tables and
receipt intact as inert preserved data. Do not publish a new facet adoption
receipt. The bridge must explicitly allow that exact historical receipt, and a
future facet release can validate and adopt or transform the preserved schema.

## Designing downstream features for fewer future conflicts

Every core fork change consumes an ongoing upstream-rebase budget. Keep only
authority, durability, and execution-boundary behavior in the fork; put
optional policy and presentation in plugins whenever the host exposes a safe
capability.

### Keep in BB core

- authenticated principal resolution at HTTP, WebSocket, and trusted plugin
  boundaries;
- immutable accepted human/agent origin;
- durable actor snapshots on events, queued prompts, deferred prompts, edits,
  and interaction responses;
- the minimal server/daemon speaker field needed to preserve authorship;
- presence keyed by canonical principal identity; and
- narrow host-runtime behavior such as per-workspace executable resolution.

These are authority or process-boundary concerns. Reimplementing them in page
code or a plugin would weaken the security and durability model.

### Prefer plugins for optional features

- **Thread phase and sidebar sections:** let Thread Progress retain phase in its
  own database and merge it into its plugin-owned thread-list surface. Generic
  core Thread Facets are useful for cross-plugin queries, but they are not
  required for durable message authorship or the ordinary participant list.
- **Prompt stacks:** store sequences and project overrides in a plugin, then use
  composer actions, plus-menu surfaces, or request-bound authored
  sends. Avoid modifying the native prompt box and core project/settings routes.
- **Per-person palettes:** preserve existing rows, but do not claim native
  parity until BB exposes a supported narrow appearance surface. A future
  plugin may store revisioned preferences; migrating historical rows requires
  an explicit offline import/export tool or a reviewed core bridge.
- **Presentation refinements:** prefer existing plugin slots and small leaf
  components over replacing thread queries, routing, or server contracts.

Per-message authorship does not require generic facets: render the stored
accepted author. A thread-level participant projection from durable attributed
events is allowed only after a production-copy equivalence report accounts for
every preserved facet relation and defines inclusion, ordering, pagination,
and legacy-null behavior. If facets are later restored, treat them as a
query/index layer over authoritative data, not as the identity authority
itself.

### Add narrow capabilities instead of broad patches

When a plugin cannot implement a feature safely, add the smallest reusable core
capability first. Examples are a server-authored request principal, a
request-bound authored-send operation, and a composer extension
surface. Keep authorization in core while leaving storage, synchronization,
and UI policy in the plugin.

For every proposed core patch, record:

- the invariant that cannot live outside core;
- the upstream files and public contracts it touches;
- the durable data it owns;
- the expected behavior when the patch is absent;
- whether a narrower capability would suffice; and
- a deletion plan if upstream later supplies the capability.

This turns future upstream adoption into a small logical port instead of a
mechanical replay of feature-shaped changes across many layers.

## Release checklist

- [ ] Pin the exact upstream release and high-water migration.
- [ ] Inventory source journal, deployed ledger, hashes, and schema fingerprint.
- [ ] Generate downstream SQL and snapshots from the pinned upstream snapshot.
- [ ] Recognize only exact historical receipts.
- [ ] Apply skipped upstream work before stamping its receipt.
- [ ] Validate equivalence before recording an adoption receipt.
- [ ] Preserve or explicitly archive historical provenance.
- [ ] Rehearse on a consistent production-data copy with measured disk/WAL use.
- [ ] Test interruption at every durable boundary and require a no-op rerun.
- [ ] Run integrity, foreign-key, schema, and material-count verification.
- [ ] Verify optional features live in plugins unless core authority requires
      otherwise.

The reviewed 0.40 execution sequence is in
[`plans/upstream-v0.40-identity-first.md`](plans/upstream-v0.40-identity-first.md).
This policy is
the reusable rule set for that upgrade and later upstream releases. The
companion [`MINIMAL_PLUGIN_CAPABILITIES.md`](MINIMAL_PLUGIN_CAPABILITIES.md)
describes how to keep optional feature state and SDK surface out of future core
migration and rebase work.
