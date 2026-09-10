# BB fork parallel lane kickoff

Coordinator: @thread:thr_csw7br3yff. Cole requested real BB child threads using
provider `codex`, model `gpt-5.6-terra`, reasoning `high`, service tier `fast`.
Every child reports progress, decisions, artifacts, validation and blockers with
`bb thread tell thr_csw7br3yff`. Never use `bb wait`, `bb thread wait`, sleep loops
or repeated thread polling to receive another thread's results. A completed
milestone is messaged back; the coordinator sends the next dependent assignment.
Any subsequently authorized descendants use the same model/settings and protocol.

## Shared inputs and scope

- Working environment: `/home/ubuntu/bb`, `env_cug27tifde`, project `proj_r2sjmhbkx4`.
- Latest upstream resolved at kickoff: `960255b98ce3dccdcb5754eb67a7f989236602a1`.
  Its objects are fetched into `fork/upstream`; inspect with `git show`/`git grep`
  against that exact revision. No child HEAD or running materialization moved.
- Previous review snapshot: `44cc2292dff443bb626866171708801a904bf45a`.
  Integration owns the delta inventory and source-authority readiness assessment.
  All lanes use the new exact snapshot until the coordinator announces a change.
- Start with [identity README](../../plugins/packages/bb-identity/README.md),
  [review closure gates](../../plugins/packages/bb-identity/REVIEW.md#minimum-contract-closure),
  [consumer recipes](../../plugins/packages/bb-identity/CONSUMERS.md) and
  [master plan](bb-fork-master-plan.md).
- Trusted collaborators have equal information access. Identity tracks provenance
  and intended targeting; no permission tiers. Preserve actor/subject/external
  distinctions and absent-capability singleton versus outage. Core has no feature
  schemas/sidebar/notification policy. Prompt Stacks remains excluded.
- Inspect `./bin/status` before edits. All dirty source is authored work. No
  reset/stash/clean, branch/HEAD movement, alternate deployment checkout, commits,
  pushes, runtime installs/reloads or production effects in this first milestone.

## First milestone and ownership

This kickoff activates contract closure and concrete implementation preparation
in parallel. Core runtime editing starts after source authority and shared seams
are settled by coordinator messages. No further user approval is implied by that
internal dependency. Each lane must make progress on its independent work now.

| Lane | First deliverable | Initial write ownership |
| --- | --- | --- |
| Core lifecycle | Exact candidate staging/activation/retirement protocol, reload-path map, cleanup and failed-replacement tests, source edit plan | `fork/plans/lanes/core-lifecycle.md` |
| Core identity and provenance | Minimal structural ingress/session/invocation/acceptance/history protocol, concrete latest-core seams and causal tests | `fork/plans/lanes/core-identity-provenance.md` |
| Package adapters and state/UI | Close bootstrap/connection-health, conflict-token and history traversal declarations; reconcile provider protocol proposals into next draft | `plugins/packages/bb-identity/` except testing.d.ts and type-tests/; `fork/plans/lanes/package-state-ui.md` |
| Providers and feature integrations | Provider configuration/key/directory/expiry contract proposals; Tailscale and independent-provider recipes; preferences/external-send/registration recovery adapters and tests scoped for next milestone | `fork/plans/lanes/provider-feature-integrations.md` |
| Integration and compatibility | Kickoff delta, source materialization constraints, realistic compile-only consumers and failure/round-trip evidence plan | `plugins/packages/bb-identity/testing.d.ts`, `plugins/packages/bb-identity/type-tests/`, `fork/plans/lanes/integration-compatibility.md` |

Coordinator owns this document, shared master-plan changes and collision
resolution. Request ownership before editing another lane's files. Send contract
proposals early; recipients may continue independent work while dependencies are
resolved. Provider and feature lanes do not silently adopt a new shared type;
the package lane incorporates agreed changes and announces the contract revision.

## Handoffs

1. Every lane messages the coordinator with its adopted scope and early blockers.
2. Core/provider lanes send exact proposed signatures and semantics to the
   package lane, copying the coordinator. Integration sends baseline/delta risks.
3. Package announces the revised declaration contract; integration runs realistic
   consumer probes. Report gaps with witnesses, rather than inventing missing glue.
4. Coordinator resolves remaining cross-lane decisions and releases disjoint
   implementation assignments. Preferences and external-contribution vertical
   slices precede broad migration; real provider replacement and native-session
   round trips remain required evidence.

## Active thread roster

All five spawn requests explicitly selected Codex / gpt-5.6-terra / high / fast.

| Lane | BB child thread |
| --- | --- |
| Core lifecycle | @thread:thr_hefngvss7m |
| Identity and provenance | @thread:thr_uitunmynwf |
| Package adapters and state/UI | @thread:thr_dure2ciend |
| Providers and feature integrations | @thread:thr_q7u3m8y275 |
| Integration and compatibility | @thread:thr_psaevc6ixy |

## Contract milestone and implementation handoff

The five lane artifacts are available under [lanes](lanes/). Draft 4 preserves
the contextual package README and BYO-IdP interface. Core and package agree on
`experimental_p6rIdentity`, registration versus per-invocation scope,
`forwardRpc`, unified acceptance, paged causal history, and an unbranded raw
provider registration normalized by the package. Provider readiness is optional;
host structural/configuration checks are mandatory.

Consumer declaration/JSX checks pass. Integration replaced the raw-host probe's
protocol-member extraction with independently written method signatures and
concrete successful session, profile, request, acceptance and provider values.
The coordinator inspected this witness and reran the full strict declaration/JSX
check successfully. This establishes structural construction without casts or
private brands; it does not establish runtime enforcement. Runtime,
packed-artifact and authored-session round-trip proofs remain pending.

The [source-authority audit](lanes/integration-compatibility.md#source-authority-concrete-audit-and-handoff)
identifies two dirty Git stores and the active service at `fork/build/bb`.
Coordinator retains both existing worktrees in place. No lane may start core
runtime edits in those dirty paths. The temporary candidate source is now the
isolated `fork/build/proof-bb` worktree described below.
The first provenance slice uses server sidecars and existing native execution
identifiers; a daemon change requires a demonstrated missing boundary.

On 2026-09-05 Cole changed the temporary proof target to Rosetta on different
ports. The [local proof target](bb-fork-local-proof.md) supersedes the earlier
staging-access gate: server 39886, daemon 39887, development UI 39888, separate
empty data directory, and visible source at `fork/build/proof-bb`. Coordinator
created that clean worktree on `proof/identity-first` at the exact kickoff pin,
using the existing canonical upstream Git store. Existing child HEADs, dirty
worktrees, and normal runtime selection were not changed. The isolated bootstrap
service now runs with all plugins disabled; see the local-proof receipts. Core
lanes use this proof source after disjoint implementation
assignments; they do not wait for `bb-machine` or move the normal paths.

## Implementation milestone 1 (released 2026-09-05)

The four-lens review permits bounded implementation. It is not a runtime approval.
Coordinator released the five existing Terra/high/fast lanes via messages:

- Lifecycle owns plugin lifecycle/dispatch files, **including `plugin-api.ts`**,
  SDK backend/new raw protocol declarations, and API audit/guide entries.
- Identity owns new server `p6r` services, internal tool
  correlation and thread acceptance/queue sidecars. Lifecycle consumes these
  services; neither lane creates a second scope registry. No daemon changes.
- Package implements model/host/server adapter modules while preserving public
  declarations, including raw readiness normalization and request-scope binding.
- Provider implements independent resolver-only/signed-assertion fixtures and
  corrected consumer examples, without touching live plugin artifacts.
- Integration owns declaration/runtime tests, independent provider-hook invocation
  witnesses and coordinated package build/check integration.
- Coordinator owns isolated proof launch/cleanup tooling and core dependencies.

Destination mutations validate both original invocation validity and captured
destination generation at commit. An accepted mutation remains accepted after
scope expiry; a lost response requires operation reconciliation. Tests cover
expiry, replacement, forged direct calls and independent destination cleanup.

Apply conservative whole-directory cache invalidation. Fetch roots revalidate
on request, focus and reconnect; idle roots have no bounded freshness promise.
Resuming a write requires revalidation. Tests must include new/deleted matches,
stale cursors, pending edits and late responses across two roots.

Before persistent attribution freezes, specify copied-event/edit replacement
mapping and test upstream → fork → upstream → fork, with unknown authorship for
upstream-created material. Tool correlation uses existing server-received native
IDs and tests overlapping calls, retries and late completion. Remaining review
concerns become acceptance tests for the implemented slices, not new design rounds.

Ownership refinements: Lifecycle owns the minimal `routes/plugins.ts` ingress
handoff and `apps/server/src/db.ts` post-native-migration initialization call.
Identity owns additive sidecar schema and the independent fork migration ledger;
native Drizzle history stays intact. Package closes the raw request/scope bridge
with `ForkRequestHandle` carrying its host-issued `ForkInvocationScope`; upstream
continues using `HostRequestHandle`. Integration verifies opening that raw handle
then accepting/forwarding with the returned scope without casts.

Lifecycle also owns `apps/server/src/server.ts` composition: construct the shared
identity service and inject it into the production plugin service. Identity owns
the concrete factory operations and supplies its database, clock, invocation
registry and native callback requirements. A factory with no production caller,
or one tested only with `never`/throw-only operations, does not satisfy this gate.
Integration exercises discovery through a real plugin API and decodes successful
session, request, provider, scoped-send and external-send results through the
package adapter. Both acceptance sources must be expressible in the core SDK.

Package's next independent slice implements the state service, wire codecs and
address key against the existing commit validator. It owns a new focused state
service test file; Integration retains existing tests and generator ownership.
This does not publish `/state` until its full advertised runtime exists. Feature
schemas/storage remain external, and controller/client/React work follows this
service slice. It can proceed while core composition is incomplete.

After state-service mutation isolation and receipt checks passed review, Package
was released to implement `createIdentityState` in a separate controller runtime
module and focused deterministic tests. Preserve the original acknowledged base
through dirty reconnects, exact uncertain operations, conflict-token freshness,
and immediate detach with fallible draft preservation. This remains independent
of React and does not yet add a `/state` package export.

Coordinator took controller implementation/test ownership after review exposed
unfinished uncertainty and disposal paths. The corrected controller now has 14
focused timelines covering exact-operation replay, prior-incarnation recovery,
newer desired intent, detached late results, same-version dirty loads, duplicate
invalidations, pending-value flush, null initialization and a finite flush bound.
Package owns the independent state transport and its tests. `/state` publication
awaits transport review and combined artifact integration.

Transport review now passes, including immutable pre-revalidation payloads,
identity/state connection-health checks and strict outcome validation. Root added
the complete `state-runtime.ts` entry; Integration is released to generate the
`/state` export and verify its packed runtime/declarations. This supersedes the
earlier no-export hold for state only. `/client`, `/react` and `/bb` remain
declaration-only and unexported at runtime.

The `/state` artifact gate now passes: the generated library exports six runtime
entries, and an isolated packed consumer without React typechecks the declarations
and imports all five state functions. Package typecheck/build and 30 runtime tests,
six generator tests, and generation synchronization pass. This is local package
artifact verification, not registry publication or integrated native-host proof.

Package's next bounded slice owns headless connection/client runtime and tests:
explicit connection inputs, independent identity/resource health, wire decoding,
live session access, bounded reads/cache, and reconnect/cancellation fencing.
View/state binding, React, and `/bb` runtime follow dependent review. Coordinator
retains state-controller ownership. Integration now owns the real ready-session
PluginService/API witness using provider publication and host-issued scopes;
native transaction finality and forwarding remain separate required witnesses.

Headless connection/client sources now participate in generated checks while
remaining unexported. Coordinator regressions verify that a state-only link
failure preserves live identity and an invalidated profile reader cannot cancel
a synchronous replacement reader for the same key. The aggregate package check
passes 38 tests. Package is implementing view transitions and directory search;
state/view binding, React and the `/bb` convenience binding remain pending.

The real PluginService forwarding fixture now passes replacement after handler
entry: successor publication precedes predecessor drain, the old destination's
commit is rejected, and the source scope remains usable. Registered-provider and
package-decoded submission tests still supply actor/receipt fixtures. Integration
is replacing those with actual provider admission and native transaction helper
calls; those end-to-end claims must await that evidence.

Provider now owns new core `p6r/provider-registry.ts`, an optional separate
`provider-contract.ts`, and its focused test file. It implements selected-boundary
registration/resolution and exact raw provider types; Identity imports those
ports, and Lifecycle integrates their staging/publication/retirement. Identity
retains native acceptance and protocol composition. Provider must not create a
second plugin lifecycle or publish callbacks inside the atomic generation swap.

Coordinator's proof launcher has now passed native effective-config checks,
healthy server/daemon/UI startup, normal stop and forced-supervisor cleanup on
the isolated ports. The normal service retained its PID and source throughout.
See the local proof document for receipts and operational isolation limits.

## Current completion sequence — portable consumers

The implementation has progressed beyond the first contract handoff. The next
completion gates are ordered by consumer evidence, following the master plan's
core/package/feature boundary.

1. **Portable package binding.** The internal server binding now composes RPC,
   endpoint/state registration, and normalized invocation ownership for base and
   enhanced hosts. Integration owns an independent SDK-shaped consumer fixture
   with actual SQLite dispatch and receipt recovery. Package owns the native
   client connection bridge; Root owns client/view/state lifecycle. Publish only
   the complete surface exercised by the first consumer after artifact checks.
2. **Thread Sections adoption.** Feature-owned SQLite storage and actual-owner
   legacy import pass their focused tests. Server/UI wiring remains pending.
   Import must precede empty initialization, replace the existing synchronizer,
   preserve customized settings, and keep view-as read-only. Exercise two roots,
   held writes, conflict/recovery, reload and disposal.
3. **External contribution consumers.** Move Agent Connect through the same
   portable package boundary, retaining external author and immutable-operation
   recovery. Notifications follows that proven path. Product policy and feature
   models remain in their plugins.
4. **Collaboration and compatibility completion.** Close remaining native
   contribution/attempt coverage and explicit unknown cases; prove the same
   packaged consumers on base and fork. Separately run authored-session
   upstream → fork → upstream → fork preservation for continued conversation,
   edits, attachments and native provider state. Fixtures do not satisfy this
   round-trip gate.
5. **Reproducible release and promotion.** Reconcile authored source and overlay
   receipts, run the selected composition checks and isolated proof, then form
   committed/pushed child and workspace receipts. Normal promotion remains a
   separate operation under the workspace policy.

The latest three-perspective consumer review (@thread:thr_qvshau5y8e) found four
package lifecycle races. Root fixed reentrant voluntary view finalization,
automatic-dispatch suspension during preparation, clean-state conditional
discard, and recovery waiting for unfinished preservation. The 37 focused
controller/view/binding timelines pass. Mandatory identity invalidation remains
immediate. No new core primitive was required. The package REVIEW document
records the exact findings, tests and remaining transport/consumer gates.

The next delegated slice is actual browser verification. Integration owns a
test-only Playwright harness/dependency and required browser installation, served
on a temporary loopback test port; no live plugin or proof/default service is
changed. Package owns private React context/hooks using the public app hooks and
an explicit preservation owner. Provider/feature owns native IndexedDB recovery
storage for Thread Sections. Release exports remain held. Browser checkpoint
transactions and mounted hook lifecycles must pass before consumer UI adoption;
these source fixtures still do not satisfy identical packaged-plugin host proof.

Browser baseline completed: `cd plugins && bun run identity:browser-check`
passes real Chromium, root-level StrictMode in two actual React roots, native
client/connection replacement and independent cleanup, and Thread Sections
IndexedDB checkpoint transactions/reopen. No page/console errors; browser and
temporary server teardown completed. This is source-import/SDK-shaped-hook
evidence. Integration continues the mounted state-binding, Context view,
preservation and failure-acknowledgement matrix before Thread Sections UI wiring.
