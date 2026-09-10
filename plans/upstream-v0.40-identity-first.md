# BB 0.40 identity-first synchronization plan

Status: executable plan, revised after three-agent adversarial review

Target release: `desktop-v0.40.0`

Target upstream commit: `f3cab2dd8c5c4be6d450be318550f3a04c8c3a1f`

Current upstream base: `5205d98a74ed5a22469e521cf1f86b00b8232827`
(`bb-app@0.39.0`)

Current deployment: one normal BB host, Rosetta, running the materialized
0.39-based fork from `/home/ubuntu/bb/fork/build/bb`.

## Executive decision

Upgrade to exact upstream BB 0.40 while preserving the identity and multiplayer
authority model. Do not mechanically replay every downstream feature.

Keep in BB core only behavior that must execute at an authentication,
durability, accepted-message, database, or server/daemon process boundary.
Move or defer optional policy, synchronization, projections, and UI to plugins.

The release supports two database starting states:

1. an empty database; and
2. Rosetta's exact recognized 0.39 fork database.

It deliberately does not ship a general migration engine for hypothetical
plain-upstream, experimental, mixed-tail, or fleet states. Unknown receipts or
schema shapes still fail closed.

## Motivation

The fork exists primarily because BB must represent real people correctly in a
multiplayer environment. Provider-qualified identity, durable authorship,
presence, and accepted human-versus-agent origin are authority concerns. They
cannot be reconstructed safely in browser code or after a prompt has already
been queued or deferred.

The present fork also contains broad optional features. Generic Thread Facets,
native prompt stacks, per-person appearance, and layout refinements touch many
upstream files and make every release adoption harder. Their product goals can
mostly be met through existing plugin UI surfaces plus three narrow mutation
and authority seams: request actor context, request-bound authored thread
operations, and plugin-namespaced external actors. Plugins also retain two
read-only identity seams: durable accepted-turn author and, only where proven
necessary, a narrow participant field on an existing thread read.

This plan trades temporary loss or relocation of optional features for:

- a smaller security-critical core;
- faster adoption of upstream fixes and releases;
- fewer migration and SDK conflicts in later rebases;
- clearer ownership of identity authority versus plugin policy; and
- an auditable patch queue whose cost matches its non-negotiable invariants.

## Threat model

Installed BB backend plugins and same-origin app content scripts are trusted
code. The minimal capabilities prevent accidental authority confusion and
cross-plugin impersonation; they are not a sandbox against a malicious
installed plugin. Request actor data is identity information that a trusted
plugin can retain.

An external plugin handler asserts that it verified its own bearer, signature,
or remote identity. Core confines the resulting actor to a disjoint
plugin-external authority kind, but cannot prove that the plugin performed its
verification correctly. If marketplace plugins must be treated as untrusted,
stop: process isolation, permission/consent UX, and secret separation are a
different architecture and outside this release.

## Non-negotiable outcomes

### Identity authority

1. Immutable authority is `(providerId, subject)`. Handle, display name, and
   image URL are presentation snapshots.
2. The server resolves identity at core writes, local plugin routes, trusted
   RPC, and WebSocket authority boundaries. Token, external, and none plugin
   routes skip the BB identity resolver so their secret headers are not exposed
   to it. Browser input cannot select a PrincipalKey.
3. Provider reject, throw, malformed output, or provider-owned timeout fails
   closed. No-provider and not-applicable are distinct outcomes.
4. Request actors carry assurance `trusted-provider`, `local-operator`, or
   `claimed`. Claimed remote identity remains untrusted presentation with a
   server-authored distinct key; non-null claimed identity is attribution, not
   authorization or a durable settings owner. Trusted Tailnet identity never
   enters claimed mode.
5. Provider release or replacement cannot relabel a resolution already in
   flight.
6. A provider-owned WebSocket binds provider id and lease generation at
   handshake and closes for re-authentication on provider release/replacement.
   Claimed switch/clear atomically rebinds typing and group membership.
7. Presence is ephemeral and keyed by canonical principal identity. Durable
   authorship never depends on current presence.
8. Unless provider resolution moves behind a preemptible process boundary, its
   elapsed-time check is documented as a post-return budget, not protection
   from an event-loop hang.

### Accepted authorship

1. A discriminated `AcceptedOrigin` is one of human with actor snapshot, agent
   with an internal capability and sender thread, system with an internal
   reason, or legacy unknown. A nullable actor plus caller-controlled metadata
   is not an origin model.
2. Every human-authored unit stores its actor snapshot in the same acceptance
   transaction as thread creation/provisioning, event, queue entry, deferred
   entry, edit, replacement, or interaction response.
3. Delivery-time identity never replaces accepted identity.
4. Queue edits atomically change both content and author only after a valid
   compare-and-set.
5. Public create/send input, `startedOnBehalfOf`, `origin`, `originPluginId`,
   actor fields, or `senderThreadId` cannot select agent/system origin or erase
   a human author.
6. Agent/system-originated units use internal constructors unavailable to
   public route modules and persist no invented human actor.
7. Deferred delivery consumes a unique acceptance key in the same transaction
   as event/queue creation. Retry returns the original result; re-deferral
   retains the same key.
8. Deferred delivery is idempotent across crash-after-accept and re-defer
   boundaries.
9. Legacy 0.40 deferred rows use a deterministic key derived from their durable
   row id and deliver as legacy unknown, never with the delivery actor.

### Plugin authority

1. Local HTTP and RPC handlers receive nullable server-authored request actor
   context with an opaque key, frozen presentation snapshot, and assurance.
2. An ordinary plugin send bound to a BB request obtains its actor from that
   request; the plugin supplies content and mode, not identity.
3. Request-bound actions capture private actor, request generation, and plugin
   generation. They fail after handler settlement, abort, plugin reload, or
   disposal. Public actor objects are never reread to reconstruct authority.
4. A plugin serving an independently authenticated external system may supply
   a remote subject/profile only inside a tagged `plugin-external` authority
   kind that cannot collide with provider, local, claimed, legacy, or future
   kinds. Actor recording commits with accepted-unit creation.
5. Token, external, and none routes skip the identity resolver and receive null
   request actor. None routes are read-only. External auth is handler-owned.
6. Agent tools receive durable `turnAuthor` only from the stored accepted unit;
   request/transport actor is never substituted for null or legacy authorship.
7. No durable plugin authorship grant ships in this release.
8. Real and fake plugin hosts enforce the same authority and lifetime rules.

### Deployment

1. Server and host daemon move together from downstream protocol 153 to a new
   protocol based on upstream 170, expected to be 171.
2. Old incompatible daemons are rejected and upgraded before receiving new
   command shapes.
3. Packaged launcher, CLI, server, daemon, SDK declarations, and plugins come
   from one tested composition.
4. Each workspace resolves its login-shell executable environment without
   changing the daemon's global maintenance environment.

## Deliberate deferrals

These are not release requirements:

- generic Thread Facets, their eight core tables as active authority, plugin
  declaration lifecycle, query cursors, fake-host model, CLI, and SDK;
- native configurable prompt-stack settings and prompt-box integration;
- native per-person palette routes, roster, and settings integration;
- native/Electron/mobile per-person palette parity, which is explicitly lost in
  0.40 until BB exposes a sanctioned lifecycle-aware theme surface;
- pane-width thread-header customization;
- facet-specific generalized-query cache work; and
- a generalized members roster SDK/CLI, durable authorship-grant SDK, arbitrary
  legacy migration engine, or mixed-protocol command compatibility; and
- any downstream fix no longer reproducible on the exact 0.40 target.

Historical facet tables and receipts remain preserved but inert. Prompt-stack
configuration and personal appearance rows remain checksummed but unused. A
future restoration must first supply a stopped/offline importer; this release
does not add permanent core read APIs merely to import a deferred feature. No
deferred feature may
block identity-first 0.40 unless dropping it corrupts unrelated data or removes
an identity invariant.

## Known repository and deployment state

### Patch queue

The working queue is still changing and does not yet have an authoritative
count. At the latest inspection `patches/series` named 32 candidates, including
new untracked patch 0032. Repository history is not yet a clean receipt:

- patch 0031 is committed at fork commit `8e86661`;
- patches 0029 and 0030 plus queue metadata remain dirty/untracked around it;
- patch 0032 (`quiet covered provider background commands`) is an authored
  candidate whose owner and release need have not been established;
- README and DOWNSTREAM patch counts are stale; and
- the workspace gitlink still records an older fork commit.

No upstream movement begins until the exact current queue, hashes, result tree,
and authored ownership are frozen in a child-repository commit.

### Rosetta database

The live database was observed as approximately 4.2 GiB and contains:

```text
1787517263970  0107_p6r_identity_authorship
1787520353659  0108_thread_facets
```

It has the generated `events.tool_name` column, identity actor columns, eight
actors, ten collaborators, and the facet tables. It lacks upstream 0.40's
deferred-message and marketplace tables. At inspection time the facet store had
360 core-participant relations and no Thread Progress phase relations.

Re-capture all counts, hashes, schema fingerprints, database/WAL sizes, and free
space immediately before rehearsal and live migration. These observations are
context, not execution receipts.

## Upstream overlap and trade-offs

File overlap means both the downstream patch and upstream 0.40 changed a path;
it is not a count of textual conflicts. It identifies where semantic re-porting
is required.

| Downstream area | Footprint | Paths also changed by 0.40 | Decision |
| --- | ---: | ---: | --- |
| 0001 identity/multiplayer spine | 226 files | 78 | Rebuild as several small logical core patches. Never apply mechanically. |
| 0002 generic Thread Facets | 95 files | 32 | Defer. Preserve tables and old receipt as inert evidence. |
| 0005 structured `/compact` | 3 files | 2 | Port into 0.40 accepted-send pipeline. |
| 0007 plugin principals | 8 files | 6 | Reduce to request-bound identity context. |
| 0010–0011 startup/package safety | 2 files each | 2 each | Retest on 0.40; port only the still-reproducible invariant. |
| 0014/0017/0024 identity corrections | 8/7/4 files | 3/2/2 | Fold into the identity kernel and its negative tests. |
| 0027 personal appearance | 7 files | 4 | Defer native port; retain data for later plugin import. |
| 0028 prompt stacks | 48 files | 20 | Defer native port; redesign as a plugin. |
| 0029 timeline authors | 12 files | 3 | Port as required multiplayer presentation. |
| 0030 workspace shell PATH | 6 files | 6 | Re-port as one isolated host-daemon helper with tests. |
| 0031 capability routes/messages | 12 files | 11 | Reduce to separate request-principal and plugin-external author capabilities. |
| 0032 quiet covered background commands | 8 files | 3 | Default to defer/outside identity-first 0.40 unless its owner demonstrates a release-critical invariant. |

Upstream 0.40 specifically reorganizes the areas most relevant to identity:

- sends are centralized in `acceptThreadSendRequest`;
- queued and deferred message services are extracted;
- provider plugins replace obsolete ACP/bundled-provider topology;
- protocol 170 replaces the current fork's protocol 153 base;
- upstream migration 0107 removes generated `events.tool_name`;
- migrations 0108 and 0109 add deferred-message and marketplace state;
- app timeline and responsive components changed; and
- plugin SDK, presentation, CLI packaging, and generated declarations moved.

Port final invariants onto those structures. Do not restore removed route-local
send policy, ACP launch specifications, bundled-provider constants, old
side-chat UI, or obsolete generated schema.

## Target downstream architecture

### Core patch A: database and identity types

- Post-upstream identity schema and generated migration.
- Dedicated migration-only, one-transaction legacy-receipt bridge for Rosetta.
- Separate exact legacy, active-target, and inert-facet schema manifests.
- Actor/principal types, validation, and canonical serialization.
- Actor and collaborator data access.
- Nullable actor fields on all accepted-unit storage introduced by 0.40.

### Core patch B: request identity authority

- Exclusive provider registration and lease-safe resolution.
- HTTP/RPC request actor context with assurance and auth-mode ordering that
  resolves plugin route/generation before deciding whether identity resolution
  is permitted.
- WebSocket provider-lease binding, forced re-authentication, and atomic claimed
  presence rebind.
- claimed, loopback, Tailnet, reject, and not-applicable rules.
- minimal request-bound plugin identity context.
- real/fake plugin-host parity and negative tests.

### Core patch C: accepted authorship

- server-authored discriminated `AcceptedOrigin` required by low-level accepted
  unit constructors.
- immediate, queued, deferred, edit, interaction, replacement, `/compact`,
  thread create, fork-with-input, plugin spawn/create, seed-without-run, and
  provisioning retry/recovery paths using the same origin model.
- durable idempotency for deferred acceptance.
- request-principal plugin send.
- disjoint plugin-external actor send committed atomically with acceptance.
- read-only durable `PluginAgentToolContext.turnAuthor` from the stored accepted
  unit, with no request/transport fallback.
- no durable authorship grant in this release; prompt stacks synchronously
  enqueue during their initiating request.

### Core patch D: protocol and runtime

- optional durable speaker metadata on the appropriate 0.40 daemon commands.
- coordinated protocol 171 witnesses and managed-upgrade behavior.
- packaged runtime coherence if upstream 0.40 still lacks it.
- unbounded migration startup if the old timeout remains reproducible.
- isolated workspace login-shell PATH resolver and fallback.

### Core patch E: multiplayer reads and presentation

- presence keyed by canonical principal identity.
- timeline author label/avatar always rendered from stored actor snapshot and
  keyed by canonical authority, never handle equality.
- a narrow participant field on an existing thread read only after its event/
  accepted-unit projection is defined and compared with all 360 preserved
  Rosetta relations. It is an index, never identity authority.
- compact accessible participant avatars only if that equivalence is proven and
  the behavior fits current 0.40 UI.

### Plugin work

- Thread Progress reads its own phase database and merges phase into its
  plugin-owned sidebar list; remove its dependency on `experimental_facets`.
- A shared organization-plugin identity-state library supplies revisioned CAS,
  mutation ids, debounce, generic invalidation, owner switching, conflict
  rebase, and reconnect reconciliation for the immediate Thread Progress
  section consumer. Durable owners are trusted-provider actors, plus local
  operator only under an explicit policy; claimed actors do not own settings.
- Prompt shelf/stack implementations use existing composer surfaces and the
  request-bound authored-send capability. Sequence/project state stays in a
  plugin database.
- Personal palettes remain unavailable in this release. Later restoration
  requires a sanctioned theme surface and stopped/offline data importer.

The capability rationale and proposed contracts are specified in
[`../MINIMAL_PLUGIN_CAPABILITIES.md`](../MINIMAL_PLUGIN_CAPABILITIES.md).

## Old patch disposition

Every current patch must receive one final recorded disposition before export.
The intended starting disposition is:

| Patch | Intended disposition |
| --- | --- |
| 0001 | Split and port into database, authority, authorship, protocol, and presentation patches. |
| 0002 | Deferred; preserve historical schema/receipt only. |
| 0003 | Dropped with deferred facet SDK. |
| 0004 | Port the accessible compact participant presentation if it fits current components. |
| 0005 | Fold into accepted authorship. |
| 0006 | Fold still-relevant deployment fixtures into protocol/runtime patch. |
| 0007 | Replace with minimal request-bound identity context. |
| 0008 | Fold safe avatar behavior into multiplayer presentation. |
| 0009 | Drop the generalized interrupted-staging engine; Rosetta's recognized state has no staging artifacts. |
| 0010 | Retest and port only if 0.40 still bounds migration startup incorrectly. |
| 0011 | Retest and port only missing packaged-runtime coherence. |
| 0012 | Fold into protocol witnesses. |
| 0013 | Drop the generalized completed-ledger staging recovery; any `_bb_p6r_*` artifact fails closed. |
| 0014 | Fold into request identity authority. |
| 0015 | Drop with generalized facet query surface. |
| 0016 | Fold only if the minimal SDK still reproduces the import collision. |
| 0017 | Fold into request identity authority. |
| 0018 | Fold only if unbounded-startup patch remains. |
| 0019 | Port only still-relevant validation expectations. |
| 0020 | Fold only if unbounded-startup patch remains. |
| 0021 | Port only if 0.40 still logs/tests the truncated prepared statement. |
| 0022 | Fold surviving identity/event witnesses into their owning patches. |
| 0023 | Fold into canonical-key negative tests. |
| 0024 | Fold canonical key behavior into request identity authority. |
| 0025 | Defer with facets unless independently reproducible on plain 0.40. |
| 0026 | Defer. |
| 0027 | Defer native implementation; preserve rows for later plugin import. |
| 0028 | Defer native implementation; preserve settings for later plugin import. |
| 0029 | Fold into multiplayer presentation. |
| 0030 | Port as isolated runtime helper. |
| 0031 | Split/fold into minimal request-principal and external-actor capabilities. |
| 0032 and any later candidate | Default defer outside identity-first 0.40 unless its owner proves a release-critical invariant; always record a disposition. |

## Execution phases

Each phase has an entry gate, work, evidence, and exit gate. Do not advance on
partial evidence.

### Phase 0 — freeze the 0.39 source receipt

Entry: current dirty workspace remains untouched except for explicitly owned
fork planning/queue files.

Work:

1. Inventory and identify owners of every dirty fork/plugin path and every
   authored patch candidate present at freeze time, including 0032 and any
   later arrival. Do not assume the final count.
2. Produce a freeze table for every candidate: old candidate, retained
   invariant, exact upstream 0.40 symbol/path, target logical patch, tests, and
   final disposition. Default 0032 outside this release absent a separately
   proven critical invariant.
3. Reconcile the chosen candidates into one ordered pre-0.40 source receipt.
4. Make README, DOWNSTREAM, `patches/series`, `patches/sha256`, and
   `result-tree.lock` agree.
5. Run `./scripts/verify` and `./scripts/delta-report` on the exact queue.
6. Record current fork test/build evidence and exact materialized tree.
7. Commit and push the frozen fork receipt before changing `upstream.lock`.
8. Treat dirty overlapping plugin source as an entry gate, not only generated
   types. Obtain owner commits or explicit coordination before adapting
   identity-boundaries, notifications, ntfy, sticky-notes, Thread Progress,
   thread-manager, agent-connect, or generated declarations.

Evidence:

- clean fork child status;
- pushed child SHA;
- patch/hash/tree verification output; and
- old patch/file/line footprint.

Exit: the exact pre-0.40 state is reproducible and recoverable.

### Phase 1 — establish a clean upstream 0.40 baseline

1. Create a dedicated `bb-fork` overlay sync branch from the clean frozen
   overlay receipt.
2. Advance `upstream/` and `upstream.lock` to exact target
   `f3cab2dd8c5c4be6d450be318550f3a04c8c3a1f` only after inspecting submodule
   status and current commit.
3. Register a temporary `fork/upstream` worktree at the pinned target commit for
   baseline and logical replay. It is review/build input only, never runtime or
   plugin source. Record its exact resolved path and owner; remove it later only
   through `git -C upstream worktree remove` after verifying the target.
4. In that disposable checkout, run the frozen install, typecheck, test, and
   build on unmodified 0.40.
5. Record package version, migration journal high-water, protocol version,
   generated artifacts, and any baseline failures.
6. Create the logical BB replay branch in that registered worktree directly
   from the target tag. Keep it distinct from the overlay branch.

Exit: failures attributable to upstream/environment are separated from fork
work, and the target is immutable.

### Phase 2 — build and test the Rosetta compatibility bridge

Follow [`../FORK_MIGRATIONS.md`](../FORK_MIGRATIONS.md).

1. Generate the new identity schema/migration from upstream 0109. Do not add a
   new facet migration.
2. Embed and independently verify these exact receipts:

   ```text
   1787517263970  303073917afaade57ab1072f09d51da7f62c42df71cc4e3009906b21b6d40709  old identity
   1787520353659  e051e9e2591a08907d9b53bb1243a11d5c1384f07a131c4a2a9367b0b4954cce  old facets
   1787331095369  da63f96688d22f8b573b0673d1ba9e72051fde268f27052607231cb25bfae584  upstream 0107
   1787613751578  0ae872521ffd026ae67358c2ab016176711bf7477aa77060076c1100a0b30790  upstream 0108
   1787680413251  c9ced750de5290719e05a9289ab15f65eddec720c212f6691d8a4a85d3d372d4  upstream 0109
   ```

3. Implement three exact manifests:
   - recognized Rosetta legacy ledger/schema;
   - active 0.40 target schema, identical for fresh and adopted databases; and
   - allowlisted inert facet tables/indexes/receipt, permitted only on Rosetta.
     Preserve their schemas/rows by checksum. No active view, trigger, index,
     foreign key, query, SDK, or source object may reference them.
4. Ship a migration-only command that acquires an OS lock keyed by canonical DB
   path before opening BB, verifies server/daemon/provider/router and all other
   writers are stopped, binds no network listener, and performs no startup
   writes. Normal server startup refuses the recognized legacy state with an
   actionable command; it never runs the live bridge implicitly.
5. After locking, re-read the complete ledger/schema and pin the packaged SQLite
   version. Require that every `sqlite_schema` dependency on `events.tool_name`
   is in the expected allowlist before upstream 0107 drops it.
6. Under one `BEGIN IMMEDIATE` transaction, apply exact upstream 0107, 0108,
   and 0109, the current-database corrective identity delta, and exact receipts.
   Validate all pre-commit invariants, then commit once. A receipt insert
   requires its timestamp to be absent; timestamp-present/hash-different is
   fatal. Do not reuse a permissive mark-applied helper.
7. Preserve downstream identity columns while 0107 removes `tool_name`. Retain
   old identity/facet receipts as provenance and add the new identity adoption
   receipt only after active-target equivalence.
8. Any `_bb_p6r_*` staging artifact fails closed. Do not port the generalized
   recovery engines from patches 0009/0013.
9. With handles closed, require a successful `wal_checkpoint(TRUNCATE)`. A
   second bridge invocation may recognize the target but performs no DDL, data
   mutation, or receipt insert.

If rehearsal proves one transaction exceeds disk, WAL, or downtime thresholds,
stop and revise this plan. Do not invent a multi-commit state machine during
deployment.

Fixtures:

- empty database through full target journal;
- a stopped consistent copy of Rosetta's database;
- a populated post-0109/pre-identity fixture containing deferred messages and
  marketplace statistics;
- duplicate/mismatched recognized receipts;
- unknown receipt and unknown schema;
- real file-backed process termination while 0107 is rewriting, which must
  leave the exact legacy state under the one-transaction design; and
- two concurrent migrators, with exactly one owner.

Required proof:

- deterministic streaming checksums ordered by durable primary key over event
  ids and retained identity columns, actors, collaborators, queues,
  interactions, threads, deferred/marketplace rows, inert facets, palette rows,
  prompt-stack settings, and plugin phase/section state;
- active-target fingerprint equality between fresh and adopted databases plus
  the separate unchanged inert-facet fingerprint on Rosetta;
- empty `foreign_key_check`, successful `integrity_check`, expected WAL and
  actual pragma states; and
- measured duration, peak disk use, and WAL growth on the Rosetta copy.

Backup/recovery evidence must name the destination filesystem, hash, size,
restore command, and required measured transient space plus margin. Close all
handles, prove a non-busy truncating checkpoint, use and assert
`synchronous=FULL` for the bridge, restore the intended runtime mode afterward,
and rehearse restore through a temporary same-filesystem file plus atomic
rename while quarantining old DB/WAL/SHM files.

Exit: database work is independently shippable and recoverable before
application identity code is ported.

### Phase 3 — port the identity authority kernel

1. Port actor/principal types and canonical serialization onto 0.40 domain
   exports.
2. Port exclusive provider registration onto the 0.40 provider-plugin
   architecture.
3. Resolve a plugin route and capture its plugin generation before deciding
   whether the identity resolver may see the request. Revalidate the same
   generation immediately before handler invocation.
4. Implement this auth matrix:

   | Surface | Run BB resolver | Handler request actor | Core auth |
   | --- | ---: | --- | --- |
   | Core HTTP write | yes | resolved/claimed policy | core |
   | Plugin HTTP `local` | yes | resolved actor | Origin/Host + JSON |
   | Plugin RPC | yes | resolved actor | trusted local semantics |
   | Plugin HTTP `token` | no | null | plugin token |
   | Plugin HTTP `external` | no | null | handler-owned verification |
   | Plugin HTTP `none` | no | null | none; read-only only |

   Rename unshipped `auth: "capability"` to `auth: "external"`. Prove external,
   token, and none secret headers never reach the identity resolver.
5. Carry immutable provider id and lease generation in every provider result.
   Bind provider-owned sockets to them at handshake and close/re-authenticate on
   provider release/replacement.
6. For claimed switch/clear, atomically clear old typing, decrement old thread
   groups, bind the new actor, increment new groups, and emit one coherent
   update. Implement per-socket reference counting and TTL.
7. Add assurance to request actor context. Non-null claimed actor is sufficient
   for attribution, never verified authorization or durable settings ownership.
8. Implement claimed, local, Tailnet, reject, throw, malformed, not-applicable,
   replacement-during-resolution, and replacement-during-handshake policies.
9. Describe a synchronous resolver budget as post-return unless execution is
   actually isolated behind a preemptible boundary.
10. Implement exact real/fake-host parity, including request action lifetime,
    abort, reload, secret-header, assurance, multi-tab, switch, clear, close,
    reconnect, and stale callback witnesses.

Exit: focused domain, server plugin-wire, WebSocket presence, and fake-host
suites pass before any authored send consumes identity; save their command
lines and results in the release evidence.

### Phase 4 — port accepted authorship to the 0.40 pipeline

1. Define the discriminated server-authored `AcceptedOrigin` at every public/
   internal boundary. Public create and send schemas cannot construct agent or
   system origin; internal constructors are unavailable to public route code.
2. Inventory and classify every low-level accepted-unit append/send call site.
   Add a source/test witness that fails when a new unclassified call appears.
3. Require origin at the type boundary for immediate send, queue creation and
   delivery, deferred creation/delivery/re-deferral, edit replacement,
   interaction response, `/compact`, ordinary create, fork-with-input, plugin
   spawn/create, seed-without-run, provisioning events, and provisioning
   retry/recovery.
4. Thread immutable origin through `acceptThreadSendRequest` where applicable;
   low-level paths that bypass it must require the same type.
5. Persist human actor snapshots atomically with every accepted unit. Agent and
   system origin remain capability-authenticated; legacy is explicit unknown.
6. Add a unique acceptance record/key consumed in the event/queue acceptance
   transaction. Retry returns the original result, re-deferral retains the key,
   and holding-row deletion is cleanup. Derive legacy keys deterministically
   from durable row ids.
7. Classify exact structured `/compact` before presentation changes the input.
8. Implement a request-actor plugin send with no actor input. Capture private
   frozen actor/request/plugin generation and reject use after settlement,
   abort, reload, or disposal. Use exact 0.40 modes or test the mapping from
   `auto|steer|queue` to `start|steer-if-active|queue-if-active`.
9. Port plugin-external sends using a globally disjoint authority kind. Commit
   external actor and accepted unit together so failed validation cannot create
   phantom collaborators.
10. Restore `PluginAgentToolContext.turnAuthor` from the durable accepted unit
    for create, immediate, queued, deferred, edited, and legacy paths; never
    substitute request/transport identity.
11. Do not ship a durable authorship grant. Current prompt stacks enqueue
    synchronously during the initiating request; a post-request requirement is
    a stop-and-design event.

Exit: focused creation, send, queue, deferred, edit, interaction, tool-context,
and plugin-runtime suites pass; the call-site inventory is complete; and no
public input can self-select authority or agent/system origin.

### Phase 5 — port protocol, runtime, and multiplayer presentation

1. Add optional structured speaker metadata to the exact daemon commands that
   carry accepted human units.
2. Bump coordinated protocol from upstream 170 to 171.
3. Prove the managed protocol timeline: publish and verify exact 171 artifact;
   153/170 daemon learns advertised version; downloads, verifies, installs, and
   restarts; server rejects command-session establishment until 171; and no
   command is enqueued before convergence. Ordinary updater downgrade remains
   forbidden.
4. Retest startup and packaging patches; port only missing invariants.
5. Port workspace-local login-shell PATH resolution as one helper with Zsh,
   Bash, fallback, timeout, cache, and workspace-isolation tests.
6. Always render the stored author chip for attributed user rows in current
   0.40 components. Compare canonical actor keys, never handles. This removes
   timeline dependence on participant counts.
7. Define any remaining participant projection precisely across creation,
   accepted events, queues/deferred units, interactions, legacy nulls,
   ordering, pagination, snapshot selection, deletion, and archive behavior.
8. Against a Rosetta copy, compare every one of the 360 preserved participant
   relations with that projection. If they differ, stop and revise or record an
   explicit approved presentation/filter regression.
9. Expose only a narrow additive participant field on an existing standard
   thread read when equivalence is proven. Do not port general members/facet
   query SDK or CLI.
10. Port safe avatar fallback and compact participant presentation only if the
    narrow projection remains; do not restore removed UI.

Exit: focused protocol/updater/host-daemon/timeline suites pass; one artifact
provides coherent server/daemon/CLI behavior; and multiplayer presentation no
longer depends on facets.

### Phase 6A — prove facet absence and freeze plugin contracts

Because logical replay starts from pristine 0.40 and Phase 2 adds no facet
migration, do not port facets and then delete them. Prove that generic facet
schema, active DB/server/SDK/CLI/fake-host code, and query paths were never
reintroduced. Preserve only the recognized inert Rosetta tables and receipt.

Before the exact target SDK is generated, complete a source-contract audit and
consumer migration table:

| Contract | Known consumers | Target decision |
| --- | --- | --- |
| request actor context | identity-boundaries, notifications, ntfy, sticky-notes, Thread Progress | exact field names, assurance, null/auth matrix, compatibility alias decision |
| facet participant reads | Thread Progress, thread-manager | narrow standard thread participant field after equivalence, or explicit feature disablement |
| plugin-external author/send and external auth | agent-connect | disjoint authority kind, `auth: "external"`, request lifetime tests |
| generated SDK declarations | every organization plugin | refresh only from final materialized 0.40 artifact |

For Thread Progress:

1. stop declaring/publishing `experimental_facets.phase`;
2. keep its own phase database authoritative and merge phase into the
   plugin-owned thread-list pipeline;
3. disable facet filters that cannot be supplied without a core query system;
4. preserve saved section configuration and explicitly mark unavailable filter
   semantics rather than silently changing them; and
5. explicitly retain inert or migrate/drop the plugin-local
   `thread_phase_facet_projection` outbox table.

The shared identity-state library is required because Thread Progress sections
are an immediate identity-scoped consumer. It must implement server-derived
trusted owner (plus explicit local policy), atomic SQLite CAS, idempotent
mutation ids, separate server revision/local generation, one in-flight save,
coalesced latest pending state, deferred remote refresh, owner-switch
invalidation, conflict rebase, reconnect, and generic invalidation signals that
publish neither owner keys nor values. Add deterministic stale-load, edit-during-
save, owner-switch-while-dirty, conflict, reconnect, migration-race, and two-
client interleaving tests.

Exit: target contracts and every consumer adaptation are specified against
exact 0.40 symbols. Compilation is intentionally deferred until the final SDK
artifact exists.

### Phase 7 — export the reduced fork queue

1. Record a final disposition for every old patch.
2. Organize the new port into the smallest reviewable logical patches matching
   the target architecture, not the old numbering.
3. Generate migrations, snapshots, SDK declarations, and templates only through
   upstream tools.
4. Export with `git format-patch --full-index --binary`.
5. Replace series and hashes; update README, DOWNSTREAM, namespace rules, and
   result-tree receipt.
6. Run namespace verification and delta report.
7. Explain every material increase and every removed public contract.

Exit: the queue is a reproducible upstream 0.40 prefix plus a reduced logical
delta.

### Phase 8 — materialize, adapt plugins, and verify

From the materialized target tree:

1. frozen install;
2. typecheck;
3. full tests;
4. build;
5. targeted DB, identity, queue, deferred, interaction, protocol, updater,
   host-daemon, timeline, CLI, SDK, fake-host, and plugin suites;
6. `./scripts/verify`, namespace check, and delta report.

Then, without overwriting unrelated plugin work:

1. refresh organization-plugin SDK types from the exact 0.40 fork artifact;
2. apply the Phase 6A consumer table to identity-boundaries, notifications,
   ntfy, sticky-notes, Thread Progress, thread-manager, and agent-connect;
3. implement/verify the identity-state helper and remove active facet SDK use;
4. run plugins sync, references, SDK-type check, typecheck, tests, and build;
5. run community-plugin install, test, typecheck, and build; and
6. direct-load representative plugins only from canonical workspace paths.

Exit: source, generated contracts, all named consumers, plugins, and runtime
artifact agree on the same exact tested trees. Re-run fork verification after
all generated receipts are final.

### Phase 9 — rehearse the one-host upgrade

1. Choose paired rollback unless an explicit owner approves forward-only
   recovery.
2. Stop all writers, close handles, prove a non-busy truncating checkpoint, and
   create the hashed consistent backup described in Phase 2.
3. Restore it into a rehearsal location through the exact atomic restore
   procedure.
4. Run the migration-only bridge, then start the exact release artifact against
   the restored copy.
5. Measure duration, database/WAL growth, peak transient space, pragma states,
   startup behavior, and all deterministic preservation checksums.
6. Rehearse restoration of the exact old database and 0.39 server artifact.
   Because the updater refuses downgrade, also rehearse an out-of-band 171→153
   daemon reinstall and verify protocol 153 reconnection.
7. Exercise the combined canonical staging runtime, including plugin loads and
   representative read/write identity flows, without claiming it is the normal
   host deployment.
8. Record GO/NO-GO thresholds, owner, expected downtime, first-write policy,
   recovery artifact/command, and soak duration.

Exit: both upgrade and chosen recovery path have succeeded from executable
commands, not prose assumptions.

### Phase 10 — promote the tested composition

The normal host never runs an uncommitted composition.

1. Commit and push the exact fork, plugins, and community-plugin trees exercised
   in canonical staging.
2. Prove each committed tree hash equals its tested tree; do not rebuild or
   regenerate between evidence and commit.
3. Advance workspace gitlinks to those pushed child commits.
4. Run `./bin/check --role staging` and record the combined composition.
5. Commit and push the workspace promotion receipt.
6. Obtain explicit GO, then update the single `rosetta-machine` normal-host pin
   to that workspace receipt.

Exit: the promoted workspace commit exists before Rosetta deploys it and names
exactly the rehearsed children.

### Phase 11 — deploy Rosetta through two irreversible gates

1. Normal checks out the exact pinned workspace receipt. Run
   `./bin/check --role normal` before mutation.
2. Pause ingress/background work and drain verified server, daemon, provider,
   router, and other writers through managed lifecycle controls.
3. Capture final ledger/schema/checksums/pragma/disk evidence and the rehearsed
   backup.
4. Run only the migration-only bridge from the pinned artifact.
5. While writes remain blocked, start 0.40 and perform read-only verification:
   health, machine visibility, plugin loading, active/inert manifests, ledger,
   foreign keys, integrity, checksums, and a mutation-free second bridge
   invocation. Paired rollback remains available here.
6. At the first-write gate, either confirm the rehearsed database/artifact plus
   out-of-band 171→153 rollback, or explicitly declare forward-only and name its
   exact recovery artifact/command. Record the irreversible GO and timestamp.
7. Publish/verify 171, allow managed daemon update, and prove no command session
   or enqueue occurs before protocol convergence.
8. Only after the gate, exercise write-producing two-client identity, reconnect,
   claimed/provider paths, create/fork, queue edit, deferred send, interaction
   response, tool turn author, plugin-external author, presence, and timeline
   rendering.
9. Hold the defined soak and monitor event-loop stalls, DB latency, daemon
   reconnects, plugin errors, unattributed new human events, and migration or
   deferred-idempotency errors.

Exit: Rosetta reports BB 0.40 from the pre-existing workspace receipt, all new
processes use that composition, and the first-write recovery boundary is
independently recorded.

## Verification scenarios

### Identity and authorship

1. Human A sends immediately; stored actor and daemon speaker are A.
2. Human A queues; Human B edits with a current revision; content and actor
   become B atomically.
3. Human B attempts a stale edit; neither content nor actor changes.
4. Human A is deferred; process restarts; Human B clears the blocker; eventual
   author remains A and resolver is B.
5. Crash after deferred accept but before cleanup produces one accepted unit.
6. Agent-origin send through authenticated internal capability stores no human
   actor.
7. Public create/fork/send attempts using `startedOnBehalfOf`, `origin: plugin`,
   `originPluginId`, actor input, or `senderThreadId` cannot choose agent/system
   origin.
8. Provider reject/throw/malformed result cannot fall back to claimed/local.
9. Provider release/replacement during resolution cannot relabel the actor.
10. Two providers sharing a handle remain distinct; one subject changing handle
    remains the same principal.
11. Token/external/none plugin routes skip the resolver, receive no request
    actor, and do not expose secret headers to the identity provider.
12. Request-bound plugin send uses the requester without accepting actor input.
13. External plugin send is namespaced to that plugin and cannot impersonate a
    BB/provider principal.
14. Legacy deferred payloads deliver with unknown author.
15. Request-bound action retained after settlement/abort/reload fails in real
    and fake hosts.
16. Plugin tool `turnAuthor` matches the durable accepted unit across create,
    immediate, queued, deferred, edited, and legacy flows.
17. Provider-owned sockets close on lease release/replacement; claimed
    switch/clear rebinds typing/groups coherently across multiple tabs.

### Database

1. Empty database reaches the target schema through the ordinary journal.
2. Rosetta copy reaches the identical active target manifest through the bridge
   while its separate inert facet manifest remains checksum-identical.
3. Old identity/facet receipts remain exact provenance.
4. Missing/mismatched/duplicate/unknown receipts fail before mutation.
5. Process death during the one transaction leaves the exact legacy state with
   no new DDL or receipts.
6. Concurrent migrators cannot both own the bridge.
7. A second bridge invocation recognizes the target and performs no mutation.
8. Foreign-key/integrity/checkpoint/pragma checks and deterministic preservation
   checksums pass.

### Protocol and runtime

1. Protocol 153 to 171 managed upgrade succeeds on the real topology only after
   exact artifact publish/download/verify/install/restart.
2. Synthetic upstream 170 is rejected/upgraded to 171.
3. No command session or enqueue occurs before convergence, and no incompatible
   daemon enters an invalid-message reconnect loop.
4. Long migration does not trigger a launcher restart loop; health requests
   remain bounded.
5. Server, daemon, launcher, and CLI report one revision.
6. Two workspaces with different login-shell PATHs resolve independently;
   failure falls back to daemon PATH.

### Deferred features

1. Stored author chips always render by canonical actor key with no facet code.
2. Any retained narrow participant field has a complete Rosetta equivalence
   report or an explicitly approved regression.
3. Thread Progress sidebar sections load from plugin-owned phase/state through
   revisioned identity-state CAS.
4. Absence of the facet SDK produces no plugin crash loop in Thread Progress or
   thread-manager; agent-connect uses external auth/send contracts safely.
5. Historical facet, palette, prompt-stack, phase projection, and section data
   remains checksummed; no importability is claimed without an offline tool.

## Rollback decision

The default is paired rollback only until the recorded first 0.40 write because
there is one deployment and upstream 0107 changes the live database materially:

1. stop all writers;
2. restore the rehearsed consistent pre-upgrade database as one unit;
3. restore the exact old server artifact and perform the rehearsed out-of-band
   171→153 daemon reinstall (the ordinary updater refuses downgrade);
4. restart and verify protocol 153, ledger, plugins, and router; and
5. preserve failed migration evidence separately.

Before the first write, explicitly choose the rehearsed full rollback or declare
forward-only recovery with an exact artifact and command. After any 0.40 user
data is accepted, old-database rollback may lose work and is forbidden unless
the GO owner explicitly accepts that loss. Record the boundary and timestamp.

## Stop conditions

Stop rather than improvise if:

- target tag, migration SQL, snapshot chain, or protocol differs from the pinned
  receipt;
- the dirty pre-0.40 queue cannot be attributed and frozen safely;
- Rosetta's final ledger/hash/schema differs from the rehearsed recognized
  state;
- upstream 0107 cannot preserve downstream identity columns atomically;
- fresh and adopted databases do not reach one active target manifest or inert
  Rosetta facet data changes unexpectedly;
- deferred authorship depends on delivery-time identity;
- a public/plugin input can select a BB principal or agent origin;
- token/external/none secrets reach the identity resolver, claimed identity is
  treated as verified authorization, or request actions outlive their handler;
- the minimal plugin capability requires a broader authority surface than this
  plan documents;
- removing facets breaks durable authorship or ordinary participant reads;
- the participant equivalence report fails without an explicitly approved
  behavior change;
- generated snapshots would need manual editing;
- SDK refresh would overwrite unrelated plugin work;
- server and daemon cannot move as one protocol release;
- database backup restore or roll-forward rehearsal has not succeeded; or
- the promoted workspace receipt does not predate and exactly describe the
  normal deployment; or
- disk, WAL, downtime, integrity, or soak thresholds are exceeded.

## Required release record

- exact old/new upstream, fork, plugins, community-plugins, and workspace SHAs;
- old patch disposition table and old/new delta report;
- migration receipt hashes, legacy/active/inert manifests, deterministic data
  checksums, and packaged SQLite version;
- backup and restore rehearsal evidence;
- before/after material counts, integrity, foreign keys, WAL, and disk use;
- accepted-origin call-site inventory and identity/authorship/protocol
  verification results;
- exact artifact paths and server/daemon versions;
- deferred feature list and preserved data locations;
- plugin contract changes, actual consumer migration table, participant
  equivalence disposition, and identity-state interleaving results;
- GO/NO-GO owner, thresholds, downtime, exact recovery command, first-write
  boundary/timestamp, and soak result; and
- final workspace promotion receipt.

## Definition of done

The work is complete only when:

- Rosetta reports BB 0.40 from the exact pinned release plus reduced fork queue;
- identity and multiplayer invariants pass on live two-client flows;
- the migration-only bridge is atomic, mutation-free on rerun, and independently
  evidenced through active/inert manifests and deterministic checksums;
- server and daemon converge on protocol 171;
- organization and community plugins load against the generated 0.40 SDK;
- request actor assurance/auth ordering, action lifetime, durable tool author,
  and plugin-external namespace tests pass in real and fake hosts;
- optional deferred features are absent or plugin-owned without corrupting
  preserved data;
- the reduced patch queue is materially smaller and every retained core patch
  names the invariant that requires it; and
- pushed child commits and the workspace promotion receipt existed before and
  exactly describe the running normal system.
