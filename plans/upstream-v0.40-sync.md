# Upstream bb 0.40 synchronization execution plan

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Status: adversarially reviewed execution draft

Target upstream release: `desktop-v0.40.0`

Target upstream commit: `f3cab2dd8c5c4be6d450be318550f3a04c8c3a1f`

Current downstream base: `5205d98a74ed5a22469e521cf1f86b00b8232827`
(`bb-app@0.39.0`)

Current downstream queue: inventory is not yet frozen. `patches/series`
currently names 28 patches while an untracked patch-0029 candidate and related
metadata edits are visible. Phase 0 must reconcile and commit the exact authored
inventory before any base movement. The sync then re-expresses that frozen queue
as logical 0.40 ports rather than mechanically replaying obsolete topology.

## Outcome

Produce a new, auditable `bb-fork` release whose source receipt is:

1. exact upstream `desktop-v0.40.0`;
2. a reduced, logically replayed downstream patch queue;
3. regenerated migration SQL/snapshots, generator inputs, verification output,
   and lock receipts;
4. an upgrade path that preserves existing fork data, supports databases that
   already ran plain upstream 0.40, and resumes every known interrupted identity
   migration state;
5. a coordinated server/host-daemon protocol release; and
6. verified organization- and community-plugin compatibility.

No normal upgrade may require resetting a database, performing an additional
downstream copy/rename rebuild of the large events table beyond upstream 0.40's
mandatory `DROP COLUMN tool_name`, or discarding identity, authorship, Thread
Facet, appearance, prompt-stack, deferred-message, or marketplace data.

## Decisions already made

### The release base is immutable

Use the immutable `desktop-v0.40.0` tag commit, not upstream `main`,
`desktop-latest`, or a later nightly. Fetching newer refs is diagnostic only.
Changing the target commit restarts migration and conflict analysis.

### Downstream migration timestamps are append-only after the release base

For this and future syncs:

- Select and pin the exact upstream release first.
- Read the final `when` value in that release's Drizzle journal.
- Generate every new downstream release migration with a strictly greater
  timestamp.
- Keep downstream release migrations contiguous after the pinned upstream
  sequence.
- Never publish a new downstream migration whose timestamp falls inside the
  selected upstream release's history.
- Never rewrite a timestamp after the corresponding downstream release has
  shipped. A later correction is a new migration or an explicit compatibility
  receipt.
- Add a verifier that fails when the first downstream release timestamp is not
  greater than the pinned upstream high-water mark or when downstream release
  timestamps are not strictly increasing.

This is a release-rebase policy, not a promise that timestamps can never
interleave again. A future upstream release can publish migrations whose
timestamps fall before downstream timestamps that have already shipped. Every
sync must compare the newly selected upstream journal with all prior downstream
receipts. Any new interleave requires another explicit compatibility bridge.
The alternative would be permanently owning an interleaved fork journal; this
plan chooses a pristine upstream prefix plus bounded per-release adoption work.

For 0.40, preserve upstream's migrations unchanged:

```text
1787331095369  0107_kind_based_indexes
1787613751578  0108_deferred_thread_messages
1787680413251  0109_marketplace_install_stats
```

Then regenerate the downstream schema from the upstream `0109` snapshot and
append new identity and Thread Facet migrations, illustratively:

```text
>1787680413251  0110_p6r_identity_authorship
>0110 timestamp  0111_thread_facets
```

The generator chooses the final names and timestamps. Do not manually edit
Drizzle snapshot JSON.

### Historical downstream timestamps remain compatibility inputs

The following receipts have already existed and cannot be made harmless merely
by changing the new source journal:

```text
1787517263970  0107_p6r_identity_authorship
1787520353659  0108_thread_facets
```

Treat them as recognized historical receipts. Upgrade them through a bounded
compatibility bridge. Keep their exact `(hash, created_at)` ledger rows as
provenance, but do not retain them as current release source migrations or let
their old high-water ordering determine the new source layout. New 0110/0111
receipts mean “the equivalent current migration is adopted”; a code-side
compatibility map records the old-to-current equivalence.

### Re-port semantics; do not resolve patch text indiscriminately

Patch 0001 was authored against 0.39 topology. A blind conflict resolution can
restore components that 0.40 deliberately removed, including route-local queue
policy, the former ACP launch specification, bundled-provider constants, and
the generated `events.tool_name` column.

Build each new patch from the final downstream invariant and current upstream
architecture. Fold corrective downstream patches into the logical feature they
correct. Preserve `Ported-From` trailers so review can trace every old patch.

## Non-negotiable identity and authorship invariants

1. `(p6rProviderId, p6rSubject)` is immutable authority. Handle, display name,
   and image URL are mutable presentation snapshots.
2. The server resolves the authenticated principal at every inbound write
   boundary. Browser claims cannot select a principal on provider-owned paths.
3. An accepted human-authored unit durably stores its actor snapshot in the same
   transaction that accepts the unit.
4. Events, queued messages, and deferred sends keep historical authorship after
   provider loss, restart, reconnect, profile edits, or delayed delivery.
5. A delivery-time transport principal is never substituted for an accepted
   author. Transcript `[from=...]` text is presentation only.
6. Agent-originated cross-thread messages remain agent-authored even when the
   transport request is authenticated as a local operator.
7. Editing a queued message re-stamps it to the authenticated human editor in
   the same compare-and-set transaction as the content edit.
8. Old rows remain readable with nullable actor fields.
9. Presence is ephemeral and keyed by canonical PrincipalKey; durable actor
   snapshots are not reconstructed from presence.
10. Plugin HTTP/RPC contexts receive only server-authored nullable
    `p6rRequestPrincipal`; agent tools receive only durable nullable
    `p6rTurnAuthor`.
11. Provider rejection, malformed output, throw, or timeout fails closed.
    Local-operator fallback applies only after no-provider/not-applicable
    resolution on an eligible loopback request.
12. Principal serialization is canonical and shared by provider registration,
    HTTP/RPC resolution, WebSocket resolution, and the fake SDK host.
13. Human versus agent origin is server-authored authority. Public
    `senderThreadId` input alone cannot select agent origin, erase a human actor,
    or authorize `[from thread]` presentation.
14. Provider resolution returns a complete immutable record containing the
    captured provider id and lease generation. Actor construction never rereads
    mutable global provider state after provider code runs.
15. A synchronous provider execution budget is measured only after return and
    cannot preempt an event-loop hang. Documentation must call it a post-return
    budget unless provider execution is moved to a truly preemptible boundary.
16. Plugin route auth mode determines principal exposure. `local` and trusted
    RPC contexts may receive the resolved principal; `token` and `none` receive
    null unless an independently reviewed identity-auth capability opts in.

## Supported database starting states

The release is incomplete until deterministic fixtures cover all of these:

### A. Empty database

Apply the complete upstream 0.40 sequence followed by new downstream identity
and facet migrations. Validate the final schema and every expected ledger row.

### B. Plain upstream 0.39 database

Apply upstream 0.40 normally, followed by new downstream migrations.

### C. Plain upstream 0.40 database

Apply only the new downstream migrations. This proves the fork can be adopted
after running the official release.

### D. Current fork 0.39 database

This state already has identity and facet schema plus the two old downstream
receipts, but lacks upstream's earlier `0107` and later `0108`/`0109` receipts.
The bridge must preserve all downstream rows and historical receipts in place,
apply the missing upstream changes, validate equivalence, and add current
adoption receipts.

### E. Earlier experimental multiplayer database

Recognize the published legacy timestamps and unprefixed collaborator or
attribution columns already listed by the current recovery code. Stage, migrate,
and restore without losing sparse attribution.

### F. Interrupted identity staging

Support both cases:

- staging tables exist before the identity receipt was written;
- staging tables exist after the identity receipt was written.

Merge staged and current actor/collaborator rows deterministically and restore
sparse attribution columns.

### G. Partially advanced 0.40 bridge

Simulate process exit after every schema/ledger transition. Restarting must
continue without duplicate tables, skipped migrations, or lost data.

### H. Unknown or incompatible fork-like schema

Fail closed with an actionable error. Table existence alone is not enough to
adopt a schema. Never stamp a current migration receipt over an unknown shape.

### I. Partial and mixed released tails

Cover plain upstream databases through only 0107 and through 0108; fork
databases with identity but no facet receipt; facet tables with no receipt;
databases with one or two upstream tail receipts; and a database that already
has both old and current downstream receipts.

### J. Invalid ledgers and shapes

Cover duplicate `(created_at, hash)` rows, duplicate timestamps with different
hashes, null timestamps, a recognized legacy receipt with missing/mutated
schema, unknown rows at or below the target high-water, and any row above the
target high-water. The last case is a downgrade/newer-database refusal, not a
warning.

### K. Populated 0.40-only state

Seed deferred messages and marketplace statistics before adopting the fork.
Include legacy deferred `send` payloads with no actor field and `parent-system`
payloads. They must remain readable and deliver with nullable/unknown author,
never delivery-time identity.

## Compatibility bridge design

Implement the bridge inside the existing foreign-keys-disabled migration
section but before ordinary Drizzle execution. Acquire exclusive migration
ownership before recognition and hold it across each recognition/transition
decision. Use the repository's process/startup lock plus `BEGIN IMMEDIATE` (or
prove an equivalent single-writer mechanism); test two concurrent migrators.

### Recognition

Read the complete migration journal and ledger. Recognize exact released states
using known timestamps and hashes. Distinguish:

- current source receipt present;
- known old downstream receipt present with expected hash;
- known experimental receipt present;
- schema exists without a recognized receipt;
- interrupted staging artifacts present; and
- no downstream schema present.

Before any DDL, group ledger rows and require:

- zero rows at an expected timestamp means the migration may be executed;
- exactly one row with the expected or explicitly compatible hash means
  validate and no-op;
- duplicate rows, a mismatched hash, or null timestamp fails closed;
- the two exact old downstream receipts are allowed as retained provenance;
- unknown rows at or below the target high-water fail closed; and
- rows above the target high-water fail as a downgrade/newer-database case.

Do not infer compatibility from table names alone. A current receipt never
skips final schema validation.

### Schema equivalence checks

Use two semantic fingerprints. Before upstream 0107, validate the recognized
legacy downstream sub-schema while allowing the then-legitimate
`events.tool_name`. After applying the upstream tail, validate the final
semantic schema before stamping adoption. Validate:

- `p6r_actors` columns and composite primary key;
- `p6r_collaborators` columns and primary key;
- every nullable identity column on `events`, `queued_thread_messages`,
  `pending_interactions`, and `threads`;
- all eight Thread Facet tables;
- column type, nullability, default, collation, generated expression, and
  composite-primary-key order;
- facet primary keys, unique indexes, ordinary indexes, sort order, partial
  predicates, and thread foreign-key actions;
- CHECK constraints and normalized `sqlite_schema.sql` for details PRAGMA does
  not expose;
- absence of unresolved staging tables; and
- compatibility of old unprefixed presentation columns when applicable.

Use `table_xinfo`, `index_list`, `index_xinfo`, `foreign_key_list`, and
normalized generated DDL. Keep the validator data-driven so failures report the
exact mismatch. Compare semantic fingerprints across paths rather than raw
legacy CREATE text.

### Ordered transition for a current fork 0.39 database

Drizzle reads the maximum ledger timestamp once, so the bridge cannot first
stamp new high timestamps and then expect Drizzle to fill older upstream gaps.
Perform the tail reconciliation explicitly:

1. Classify ledger rows and staging artifacts without mutating them.
2. Accept only a state-machine-approved staging combination; unknown mixtures
   fail before eager merge or recovery.
3. Validate the legacy downstream semantic fingerprint.
4. Apply missing upstream `0107_kind_based_indexes` and its ledger row in one
   transaction. This removes the obsolete generated `events.tool_name` column
   and creates current kind-based indexes.
5. Apply missing upstream `0108_deferred_thread_messages` and its ledger row in
   one transaction.
6. Apply missing upstream `0109_marketplace_install_stats` and its ledger row in
   one transaction.
7. Validate the final downstream semantic fingerprint.
8. In one locked transaction per downstream migration, insert the new
   identity/facet adoption receipt only after equivalence validation. Preserve
   the exact recognized old receipt. If SQL hashes differ, record explicit
   compatibility rather than pretending the new SQL executed.
9. Run ordinary Drizzle migration; it should be a no-op for the reconciled tail.
10. Re-enable foreign keys, require empty `PRAGMA foreign_key_check`, run
    `integrity_check` on representative fixtures, and run final ledger/schema
    validation.

Each schema mutation and its ledger mutation must commit atomically. Re-running
any completed step must be a no-op. Process-exit tests cover rollback inside a
transaction and restart between committed steps. Do not claim power-loss
durability beyond the configured SQLite WAL/synchronous guarantees. Measure
upstream 0107 migration time, free-space demand, and WAL growth on a
production-sized copied database.

### Unknown or older experimental transition

Retain and adapt the current staging mechanism:

1. Rename recognized actor/collaborator tables to durable staging names.
2. Copy only non-null attribution into `WITHOUT ROWID` staging tables keyed by
   row id.
3. Preserve exact known historical receipts; explicit tail application makes
   high-water repair independent of deleting provenance.
4. Apply current migrations and receipts atomically.
5. Merge actor and collaborator rows with a documented conflict precedence
   based on immutable principal and snapshot recency; never rely silently on
   `INSERT OR IGNORE`/`REPLACE`.
6. Restore sparse attribution by indexed id lookup.
7. Drop staging artifacts only after successful restoration.
8. On restart, detect and resume each staging state.

Do not stage the eight facet tables for the normal current-fork upgrade. Adopt
their exact equivalent schema in place. Add a facet staging path only if a real
released/experimental incompatible facet shape is found.

### Timestamp policy verification

Extend `scripts/verify` or add a focused verifier that receives the pinned
upstream journal and downstream materialized journal and asserts:

- upstream SQL and snapshots are byte-for-byte unchanged and the parsed
  downstream journal prefix exactly matches upstream (the journal file itself
  necessarily gains downstream entries);
- no downstream release migration timestamp is at or below the pinned upstream
  high-water mark;
- downstream timestamps are strictly increasing;
- every journal tag has exactly one SQL file;
- current downstream migration hashes match the ledger compatibility table;
- recognized legacy timestamps never appear as current release source journal
  entries but remain allowed exact ledger provenance;
- generated snapshot metadata forms one linear chain; and
- a fixture with an artificially later upstream migration makes the verifier
  fail.

## Logical port sequence

### Phase 0: preserve and normalize repository history

1. Reconcile the exact queue inventory first: `patches/series` currently names
   28 entries while a candidate patch 0029 and receipt edits are untracked or
   dirty. Make README, DOWNSTREAM, series, hashes, and result-tree counts agree;
   identify the owner and verification state of every item; then preserve all
   authored work in a commit before changing the base.
2. Reconcile local `main` with `origin/main`, where a differing patch 0026 was
   already merged. Compare behavior and tests; do not choose by patch byte size.
3. Create a dedicated upstream-0.40 sync branch after the fork repository is
   clean and its local/remote history is understood.
4. Record the old patch-to-invariant map, including which later patches correct
   or supersede earlier ones.
5. Capture the old `delta-report`, patch/file/LOC footprint, verification
   results, and exact child commit. Require every old patch to receive a final
   disposition and explain any material delta growth.
6. Treat the heavily dirty organization-plugin repository as a hard entry gate:
   pre-existing work must be committed by its owner or explicitly cleared for
   overlapping SDK-type regeneration. Never run bulk type refresh into unknown
   dirty generated files.

### Phase 1: pin and materialize exact upstream 0.40

1. Advance the `upstream/` submodule to the reviewed tag commit.
2. Set `upstream.lock` to the full commit SHA.
3. Verify tag ancestry, package version, migration journal, protocol version,
   and release build prerequisites.
4. In a clean disposable upstream-0.40 checkout, run the baseline frozen
   install, Turbo typecheck, tests, and build before any downstream port. Record
   upstream/environment failures separately.
5. Do not update `result-tree.lock` until the entire logical queue is final.

### Phase 2: generate the database base and compatibility bridge

1. Start from upstream's exact `0109` schema and snapshot.
2. Add the final identity schema to Drizzle source.
3. Generate a new post-upstream identity migration and snapshot.
4. Add final Thread Facet schema.
5. Generate a new post-identity facet migration and snapshot.
6. Implement exact legacy receipt recognition, schema equivalence, ordered tail
   application, receipt adoption, and interrupted recovery.
7. Run the complete migration fixture matrix before porting application code.
8. Export this as the database portion of the logical identity patch, not as a
   standalone historical migration rewrite.

### Phase 3: port the identity authority kernel

1. Port `P6rActorSnapshot`, `P6rPrincipalKey`, schemas, and canonical key
   derivation onto current domain exports.
2. Port provider registration and the exclusive provider resolver onto 0.40's
   unified provider-plugin architecture. Every resolve operation captures the
   provider id and lease generation, and returns a complete immutable
   resolution; provider release/replacement during reentrant provider code
   cannot relabel its subject or trigger local fallback.
3. Resolve the request principal once per HTTP/WebSocket boundary and attach it
   to server-owned request context.
4. Keep claimed identity presentation separate from authenticated provider
   identity. Continue rejecting client-selected PrincipalKeys.
5. Port local-operator and trusted-Tailnet rules with focused negative tests.
6. Define the plugin auth-mode matrix before exposure: trusted local/RPC may
   receive nullable server-authored principals; `token`/`none` default to null
   absent a separately audited identity capability. Update real/fake-host parity
   tests for provider, claimed, reject, not-applicable, token, and none paths.
7. Decide provider WebSocket lifetime policy. Bind authenticated sockets to a
   provider lease generation and close/re-authenticate them on provider
   release/replacement, or explicitly document connection-lifetime authority
   with its revocation limitation. Test the chosen policy.
8. Document the provider resolver's synchronous post-return budget accurately;
   do not describe it as preemptive timeout protection unless execution is
   isolated behind a preemptible async/process boundary.

### Phase 4: port accepted authorship through the 0.40 send pipeline

Upstream 0.40 centralizes policy in `acceptThreadSendRequest`, extracted queued
message services, and deferred-message services. Add identity there; do not
restore route-local policy.

1. Introduce a server-authored `AcceptedSendOrigin` such as `human(actor)` or
   `agent(senderThreadId)`. Only a capability-authenticated internal agent/tool
   boundary may create agent origin. Public `/send` cannot self-classify as
   agent-authored using `senderThreadId`; if compatibility retains the field,
   treat it as reply metadata while retaining the authenticated human author.
2. Resolve the actor in the public send route, construct accepted origin, and
   pass that immutable value into `acceptThreadSendRequest`.
3. Immediate send: pass accepted origin through `sendThreadMessage` and
   append the actor snapshot with the accepted event in the same transaction.
4. Queued send: persist accepted origin/actor snapshot with the queued row.
5. Deferred send: add a new payload version containing accepted origin and a
   stable acceptance/idempotency key. Parse upstream-0.40 legacy
   `{kind:"send",request}` as unknown/null actor and preserve `parent-system`.
   A background flush reuses the durable origin and never calls the current
   request-principal resolver.
6. Make deferred delivery exactly-once at the accepted-unit boundary. Consume a
   durable idempotency key atomically with event/queue acceptance so a crash
   after accept-before-delete or re-defer-before-delete cannot duplicate the
   prompt. The holding row may be deleted afterward as cleanup.
7. Trusted agent-origin sends explicitly persist null human actor. Negative
   public HTTP tests prove arbitrary `senderThreadId` cannot erase attribution
   or inject trusted agent presentation.
8. Queue edit: include expected row version/time and new actor snapshot in one
   conditional update; stale edits change neither content nor author.
9. Queue reordering/deletion: require authentication where product policy says
   the mutation is human-owned, but do not rewrite authorship for non-content
   mutations.
10. Pending interaction response: pass the resolved actor into the generalized
   0.40 responder and persist resolver attribution in its settlement
   transaction.
11. Edit-message/history replacement policy: the historical event remains
    unchanged; the replacement accepted turn is authored by the authenticated
    editor. Agent replacement requires the same trusted-origin capability.
12. Structured `/compact`: classify the exact authenticated input before sender
    presentation while preserving 0.40's deferred/queue routing.

### Phase 5: port daemon speaker metadata on current protocol topology

1. Preserve upstream protocol 170's provider-plugin bridge architecture.
2. Add optional structured `p6rSpeaker` only to commands that carry a durable
   accepted human-authored unit.
3. Increment `HOST_DAEMON_PROTOCOL_VERSION` from 170 to 171 because the wire
   shape changes, even though the field is optional.
4. Update every server, daemon, fixture, provider-parity, public-version, and
   updater witness.
5. Verify old daemons are rejected/upgraded before receiving the new field.
6. Preserve managed rollout guidance; do not claim mixed 170/171 compatibility.
7. Ensure host/provider presentation cannot alter stored authorship and cannot
   cause quoted/raw/plugin/agent slash text to execute as a built-in command.
8. Add an end-to-end witness that rejects protocol 170 at session establishment
   before command enqueue, installs the exact 171 artifact, and proves provider
   bridge payloads did not gain an accidental unversioned field.

### Phase 6: port presence, members, facets, and presentation

1. Port actor/collaborator data access onto the regenerated schema.
2. Port WebSocket presence keyed by canonical PrincipalKey with per-socket
   reference counting and TTL behavior. Either disallow claimed-identity changes
   after subscription or implement an atomic rebind across every subscribed
   thread: clear old typing, decrement old groups, increment new groups, and emit
   one coherent update. Test switch/clear/close and multi-socket cases.
3. Port members SDK/CLI/routes without weakening request-principal authority.
4. Port generic Thread Facets and their transactional reconciliation lifecycle.
5. Port participant projection from durable facet state.
6. Reapply condensed avatar presentation to current web/mobile components;
   retain upstream UI removals and current responsive architecture.
7. Re-run the namespace checker and its adversarial witness.

### Phase 7: replay remaining downstream features logically

Port each feature only after checking whether 0.40 already supplies or
supersedes it:

1. safe provider avatars;
2. supervised unbounded startup and packaged runtime entrypoints;
3. trusted Tailnet admission;
4. generalized-query and SDK import fixes if still reproducible;
5. thread-list cache-shape validation if still reproducible;
6. pane-width thread-header behavior, reconciled with the already-merged remote
   patch 0026;
7. per-person appearance overrides, preserving the existing server-only
   PUT/DELETE, storage, roster, and override-else-shared semantics. Do not add a
   revisioned optimistic multi-client UI protocol in this release; design it
   separately when an editing UI or plugin consumer exists;
8. configurable prompt stacks;
9. workspace-profile changes in patch 0029; and
10. any later authored work present before the sync branch is cut.

For every old patch, record one of: `ported`, `folded into`, `superseded by
upstream`, or `dropped with rationale`.

### Phase 8: plugin compatibility source audit

Use upstream source as authority and external plugin migrations such as
`smsunarto/bb-plugins` as witnesses.

1. Before target materialization, audit source contracts only. Do not run the
   organization SDK refresh while its tool still resolves the old
   `fork/build/bb` CLI.
2. Audit `experimental_statusLabels` to `presentation.label` changes.
3. Audit bb engine ranges and exact SDK compatibility against the fork build.
4. Verify 0.40 split CLI bundle and host shim assumptions.
5. Port Thread Facet and PrincipalKey SDK consumers.
6. Record `smsunarto/bb-plugins` commit
   `3da36f547c0c7c7ab3bdc3cd3534737317e07567` as a reproducible migration
   witness, never as authority or a copy source.
7. Audit community plugins as well as organization plugins.
8. For every logical end-user feature, complete a changed-surface table covering
   UI/HTTP, SDK, CLI, guide/skill documentation, plugin API audit entry, or an
   explicit N/A rationale. Resolve the downstream `p6r` namespace exception
   against upstream's `experimental_` public-plugin-API rule explicitly.

### Phase 9: export the reduced patch queue

1. Review the logical commits in a disposable upstream worktree.
2. Ensure generated files are produced only by upstream generators. Commit DB
   migration SQL/snapshots and generator inputs where upstream does; do not
   commit gitignored core generated template modules, plugin-build generated
   modules, or plugin-SDK bundled types. Those are verification/packaging output.
3. Export with `git format-patch --full-index --binary`.
4. Replace `patches/series` with the reviewed logical order.
5. Regenerate `patches/sha256`.
6. Update `DOWNSTREAM.md`, including every patch and compatibility boundary.
7. Update the README patch count and current exact source receipt.
8. Run namespace verification against the final queue.

### Phase 10: materialize and verify

1. Compute `HEAD^{tree}` from the reviewed logical replay branch and record it
   in `result-tree.lock` before invoking materialization; `scripts/materialize`
   enforces the lock and cannot be used to discover it afterward.
2. Resolve the exact registered disposable `build/bb` worktree and confirm it
   contains no authored changes. Stop any staging process using it. Remove it
   only with `git -C upstream worktree remove --force <exact-resolved-path>`;
   never use a broad filesystem deletion, invent an archive tool, or touch
   operator runtime state.
3. Materialize with `--committer-date-is-author-date`; it must reproduce the
   recorded tree.
4. Run `./scripts/verify` and `./scripts/delta-report`.
5. From the materialized tree run frozen install, Turbo typecheck, full tests,
   and build as documented by the fork and upstream instructions.
6. Run targeted migration, provider, server, host-daemon, app, mobile, CLI, SDK,
   plugin-SDK, Connect, tunnel, and Thread Facet suites.
7. Compare final delta files/LOC to the captured old delta and explain material
   growth or lost coverage.

### Phase 10B: refresh and verify plugins against the target artifact

1. Assert `fork/build/bb` reports the target fork version/commit and that the
   organization SDK-type tool resolves that exact CLI, not a stale 0.39 build.
2. In `plugins/`, run frozen install, sync, references, SDK-type refresh,
   typecheck, tests, and builds from its AGENTS instructions.
3. Review committed organization-plugin `types/*.d.ts` changes separately from
   gitignored core generated artifacts.
4. In `community-plugins/`, run `npm ci`, test, typecheck, and build.
5. Direct-load representative organization and community plugins from the
   canonical workspace paths and smoke their server/app/tool surfaces.

## Rollback and recovery decision gate

Upstream 0107 drops `events.tool_name`, the final daemon speaks 171 while the
current deployed fork speaks 153, and the updater does not downgrade. A migrated
database plus daemon cannot safely be paired with the old binary. Before staging
or promotion, choose and rehearse one of:

### Paired rollback

1. Stop server and daemon writers.
2. Restore the pre-upgrade database backup as an atomic unit.
3. Restore the exact old server artifact and explicitly approved daemon artifact.
4. Restart and verify protocol, ledger, and runtime health.

### Forward-only rollout

1. Declare rollback unsupported after migration begins.
2. Prebuild and verify a roll-forward recovery artifact that can reopen every
   bridge state.
3. Define abort thresholds before migration and forward-recovery ownership after
   migration.

A backup without a copied-database restore rehearsal is not a rollback plan.
The designated release owner records the decision and evidence before GO.

### Phase 11: staging runtime exercise

1. Back up the staging database using the operator-approved mechanism.
   Restore that backup into a copy and rehearse the chosen rollback/recovery
   procedure before touching the live staging DB.
2. Capture pre-upgrade counts and representative identity/facet/authorship rows
   without exposing private content in logs.
3. Build and reload only through canonical `fork/build/bb` tooling.
4. Observe the real staging migration from the currently deployed state.
5. Verify identity across two clients, reconnects, claimed and provider-owned
   paths, queue edits, deferred delivery, interaction resolution, presence, and
   personal appearance.
6. Verify the real staging host daemon upgrades from downstream protocol 153 to
   171. Separately test plain-upstream 170 to 171 with a synthetic fixture.
7. Compare post-upgrade counts and sampled immutable identifiers to the backup.
8. Exercise restart after successful migration to prove idempotence.

### Phase 12: promotion

1. Name the GO/NO-GO owner for database migration, normal pin movement, and
   rollback/roll-forward response. Record abort thresholds and soak duration.
2. Commit and push selected child repository changes first.
3. Confirm CI and staging runtime evidence on the exact child SHAs.
4. Capture and rehearse the normal-host backup/restore or forward-only recovery
   preflight.
5. Advance workspace gitlinks to the pushed commits and run
   `./bin/check --role staging`; recognize that it verifies topology, not runtime
   behavior.
6. Commit and push the workspace promotion receipt.
7. Advance the single normal-host workspace pin in `rosetta-machine` only after
   explicit GO.
8. Verify health/logs, protocol convergence, migration ledger, foreign keys,
   plugin load, and representative identity reads; then hold the defined soak.
9. Abort or roll forward immediately when a threshold is crossed; do not advance
   additional machines during investigation.

## Verification matrix

### Migration and data preservation

- All supported starting states reach one identical final schema.
- Every current expected ledger `(timestamp, hash)` is present exactly once.
- The two exact historical downstream receipts remain once as provenance beside
  their current adoption receipts.
- Duplicate or unknown rows at/below target fail closed; rows above target fail
  as downgrade/newer-database refusal.
- Actor, collaborator, sparse event attribution, queued attribution, facet
  relations, principal profiles, and cursor keys retain counts and values.
- Every crash boundary can be resumed.
- A second migration run is a no-op.
- Two concurrent migrators cannot race recognition or receipt stamping.
- Foreign keys are restored; `foreign_key_check` is empty; representative
  fixtures pass `integrity_check`; and every path has the same semantic schema
  fingerprint.

### Authorship event timelines

Test concrete interleavings, not only static types:

1. Human A sends while clean; event and daemon speaker are A.
2. Human A sends while blocked; request is deferred; process restarts; Human B
   resolves the interaction; eventual event and speaker remain A, while the
   interaction resolver is B.
3. Human A queues; Human B edits with a fresh expected version; content and
   actor become B atomically.
4. Human A queues; Human B edits stale state; neither content nor actor changes.
5. Agent thread sends through an authenticated transport; stored human actor is
   null only when the server-authored agent-origin capability is present.
6. Identity changes or reconnects after acceptance; deferred/queued authorship
   remains the accepted snapshot.
7. Client-supplied PrincipalKey is ignored or rejected on every public seam.
8. Provider reject/throw/malformed/timeout never falls back to a claimed/local
   identity on a provider-owned path.
9. Public `senderThreadId` cannot erase human attribution or select trusted
   agent presentation; the internal agent-tool path can.
10. Provider release/replacement during a reentrant resolve cannot relabel the
    returned subject or fall back locally.
11. Deferred accept followed by crash-before-delete, and re-defer followed by
    crash-before-delete, each produce exactly one accepted unit with the
    original actor.
12. Legacy upstream-0.40 deferred rows deliver with nullable unknown author and
    never acquire the resolver/delivery actor.
13. Two providers sharing a handle, and one subject changing handles, never
    merge PrincipalKeys, facets, settings, or queued groups by presentation.
14. Claimed identity switch/clear while subscribed follows the chosen presence
    rebind policy without stale typing or group membership.

### Existing personal appearance behavior

This release preserves the current server-only behavior: stable owner is
canonical PrincipalKey; PUT/DELETE authenticate the actual owner; personal
override resolves before shared default; roster reads remain additive; and
concurrent DB writes are transactional. Revisioned optimistic UI/realtime state
is explicitly deferred until an editing UI or plugin consumer is designed.

### Protocol and deployment

- Server and daemon both advertise 171.
- A 170 daemon cannot enter an invalid-message reconnect loop.
- Real staging proves 153 to 171; synthetic upstream proves 170 to 171.
- Managed update fetches the exact server artifact and never downgrades.
- Packaged launcher, CLI, server, and daemon come from the same revision.
- Startup remains unbounded for migrations but bounded for health requests.

## Stop conditions

Stop and investigate rather than guessing if:

- upstream tag or migration history differs from the pinned receipt;
- a real database has an unknown migration hash at a recognized timestamp;
- schema equivalence fails for a supposedly current fork database;
- a migration transition cannot be made atomic or restartable;
- deferred authorship would depend on delivery-time identity;
- a wire-shape change lacks a protocol bump;
- a generated snapshot would need hand editing;
- plugin type regeneration would overwrite unrelated authored plugin work; or
- a public request can self-select agent origin or deferred delivery lacks a
  durable idempotency key;
- rollback/roll-forward ownership or restore rehearsal is missing; or
- a test passes only by weakening a documented identity/security invariant.

## Release artifacts

The completed work must leave:

- pinned `upstream.lock` and submodule commit;
- reduced logical patch series and hashes;
- regenerated migration SQL/snapshots and compatibility receipts;
- updated namespace, downstream contract, and release documentation;
- final materialized result-tree receipt;
- migration fixture evidence for every supported starting state;
- full fork and plugin verification results;
- explicit old-patch dispositions and old/new delta comparison;
- rollback or forward-only recovery decision and rehearsal evidence;
- staging runtime upgrade evidence; and
- pushed child commits followed by the workspace promotion receipt.
