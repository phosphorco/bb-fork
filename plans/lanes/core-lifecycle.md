# Core lifecycle: candidate generations before replacement

> Historical milestone/design record. For current implementation, owners and
> acceptance gaps, use [the completion ledger](../bb-identity-completion.md)
> and [package status](../../../plugins/packages/bb-identity/STATUS.md).
> Use public declarations for current signatures. The original lane restrictions
> below describe that milestone; current user authorization and workspace
> preservation rules govern ongoing work.

**Lane owner:** core lifecycle  
**Evidence pin:** upstream `960255b98ce3dccdcb5754eb67a7f989236602a1`  
**Review comparison only:** `44cc2292dff443bb626866171708801a904bf45a`  
**Status:** proof-candidate implementation is underway; this document records
the remaining lifecycle contract and coverage.

## Decision

Every reload-like replacement must use one `prepare → validate → activate →
retire` path. A candidate is private until it has passed all fallible host-owned
activation checks. The synchronous activation boundary publishes a complete
candidate generation before it begins predecessor retirement. If preparation or
validation fails, the predecessor remains the active generation and every
candidate registration, API handle, host artifact, service controller, database
handle, and dispose hook is cleaned up. A later stale cleanup operation is
generation-scoped and cannot unregister or dispose a successor.

This is an enhanced-host contract. Ordinary upstream hosts retain their stable
singleton/default-user behavior only when the identity capability is genuinely
absent. A malformed, unavailable, retired, or timed-out configured identity
provider is an unavailable identity capability at request time, never a reason
to select the singleton.

The contract tracks provenance and explicit targeting only. It introduces no
ACLs, product schemas, notification/sidebar policy, or Prompt Stacks behavior.

## Exact-core findings

The current pin has useful candidate staging, but not a complete replacement
transaction:

- `apps/server/src/services/plugins/plugin-api.ts` implements
  `createStagedRegistrations`: factory-time provider declarations are local
  until `handle.activate()` calls `flush()`.
- `apps/server/src/services/plugins/plugin-runtime.ts` `loadOne()` runs the
  candidate factory while `loaded.get(id)` still points to the predecessor.
  The proof candidate now runs a failed factory candidate's LIFO dispose hooks
  and closes candidate databases before retaining that predecessor; the
  targeted reload test covers this narrower behavior.
- The same `loadOne()` then calls `disposePluginInstance(id, previous)` before
  `loaded.set(id, candidate)` and before `handle.activate()` flushes staged
  registrations. Thus an activation-time registration failure happens after
  predecessor disposal. `disposePluginInstance` also looks up host artifacts by
  plugin ID, which would address a successor artifact if maps were swapped
  first.
- The builtin source watch path in `plugin-service.ts` explicitly calls
  `disposeOne(row.id)` before `loadOne(current)`. Settings recovery,
  path-registration moves, and managed update activation also contain a
  dispose-before-load sequence. They must not remain alternate replacement
  semantics.
- `provider-registry.ts` only offers `register()` and a per-registration
  conditional disposer. It prevents an old disposer from deleting a new entry,
  but it cannot atomically replace a same-ID registration: the candidate cannot
  reserve the ID while the predecessor remains live.
- `plugin-activation.ts` snapshots and rolls back managed updates, but first
  calls `disposeOne`. Rollback restores eventually; it is not predecessor
  continuity through candidate activation.

There is no lifecycle change in these source paths between the review snapshot
and `960255b98ce3dccdcb5754eb67a7f989236602a1`; the latter is the sole source
evidence for implementation.

## Lifecycle state and boundary

`generation` is a new opaque UUID for every loaded candidate, including a
reload of the same plugin ID. A plugin ID has at most one public generation;
the predecessor can remain retained privately while a candidate is checked.

```text
active G0
  │ prepare factory, staged registrations and candidate-owned resources
  ▼
prepared G1 ── validate/readiness failure ──► retire G1; keep G0 active
  │ validate succeeds; no request identity resolution occurred
  ▼
validated G1
  │ one synchronous, prevalidated publication
  ▼
active G1 ──► retire G0 asynchronously/best effort
```

`withLifecycleLock(pluginId)` serializes replacement but does **not** by itself
prove atomic visibility: registration listeners and `AbortSignal` listeners can
synchronously reenter. Before publication, core therefore builds a complete,
immutable `GenerationVisibilitySnapshot` containing G1 routing, artifacts,
hooks, and all preflighted registration leases. It passes that snapshot to one
nonthrowing `publishGeneration(snapshot)` primitive. That primitive may mutate
only private core maps; it invokes no plugin/user callback, listener,
notification, resolver, `AbortSignal.abort()`, or I/O. A lookup consequently
observes the complete old snapshot or the complete new snapshot, never an empty
or mixed registry.

Only after `publishGeneration` returns may core mark G0 retiring, abort its
signal, request socket reauthentication, and emit registrations/status/events.
Those callbacks can reenter safely because G1 is already authoritative. The
pre-publication step has no `await`, but the no-callback visibility boundary—not
event-loop execution alone—is the atomicity rule.

The old generation is not removed from its own retained object before this
boundary. After it, G1 is authoritative even if G0 cleanup hangs or throws.
`retire(G0)` receives the retained generation object, never only a plugin ID,
and its unregistration condition is `(pluginId, generation)`. It may close old
sockets, interrupt old interactions, stop old services, run hooks LIFO, drain
old invocations to the current bounded timeout, close old database handles, and
dispose old host workers. Every action is best effort and reports diagnostics;
none may delete a G1 map entry, artifact, or registration.

An activation failure means a failure before that synchronous boundary. The
candidate's LIFO hooks and candidate-only registrations run during
`retireCandidate`; the predecessor is still routable. A crash or a hung
background service *after* publication is an operational failure of active G1,
not an activation failure with an invented rollback guarantee. Existing service
degradation/backoff reporting remains the appropriate behavior there.

Trusted plugin code can still make arbitrary factory side effects. Retaining old
handles does not undo writes to shared plugin storage, database mutations,
external calls, emitted messages, or arbitrary process-global state. The host
guarantee is limited to active routing and continuity of host-owned resources
or resources registered through this lifecycle; provider authors must put
acquired clients and timers behind the generation signal and `onDispose`.

## Proposed structural protocol

These are fork-internal structural types. Core must not import
`@phosphorco/bb-identity`; the package adapter discovers a public experimental
core capability and normalizes it.

```ts
// Core uses raw strings at this structural boundary; package adapters brand
// only successfully validated product values.
type PluginGeneration = string;
type GenerationState = "prepared" | "validated" | "active" | "retiring" | "retired";

interface GenerationLease {
  readonly pluginId: string;
  readonly generation: PluginGeneration;
  readonly signal: AbortSignal;
  state(): GenerationState;
}

interface PreparedPluginGeneration {
  readonly lease: GenerationLease;
  readonly row: InstalledPluginRow;
  readonly plugin: LoadedPlugin; // owns artifact/app/branding snapshots directly
  readonly staged: readonly StagedGenerationRegistration[];
  validate(): Promise<void>;
  /** Prevalidated; synchronous and permitted to mutate only the host snapshot. */
  commit(): void;
  retireCandidate(): Promise<void>;
}

interface PluginReplacementRuntime {
  prepareOne(row: InstalledPluginRow): Promise<PreparedPluginGeneration>;
  replaceOne(row: InstalledPluginRow, cause: PluginReplacementCause): Promise<string | null>;
  /** Host-owned operation; callers do not receive authority to retire a plugin. */
  retireGeneration(lease: GenerationLease): Promise<void>;
}

type PluginReplacementCause =
  | "explicit-reload"
  | "source-watch"
  | "settings-recovery"
  | "source-move"
  | "managed-update";
```

`prepareOne` runs manifest/artifact checks, creates a new `PluginApiHandle`,
loads the factory, and collects registrations. `validate()` runs all fallible
host-owned activation checks. `commit()` cannot perform I/O, await, read an
actor, or call a provider resolver. If `prepareOne` or `validate` rejects,
`retireCandidate()` runs exactly once before returning the failure.

The plugin API needs a prepare-time/commit-time split, rather than allowing
`handle.activate()` to discover collisions while it publishes:

```ts
interface StagedGenerationRegistration {
  preflight(lease: GenerationLease): void;
  commit(lease: GenerationLease): void;
  retire(lease: GenerationLease): void;
}

interface PluginApiHandle {
  prepareActivation(lease: GenerationLease): readonly StagedGenerationRegistration[];
  commitActivation(lease: GenerationLease): void;
  invalidate(): void;
}
```

All built-in provider/AI-service/shared-port staged registrations must preflight
their identifiers and ownership against a snapshot that permits replacement of
the retained same-plugin generation. Commit consumes only those reservations.
No registration API gets a special identity-provider exception.

### Provider registration, readiness, and resolution

Identity-boundary registration is a separate core registry from agent-provider
selection. It is generation-owned and has one configured boundary owner; it
does not reuse agent model provider ordering. Host-owned declaration/configuration
validation is mandatory. Provider-specific readiness is optional, bounded, and
does not promise remote availability. The package declaration should add the
following structural callback and leave `resolve` lazy:

```ts
interface ProviderReadinessContext {
  readonly generation: string;
  readonly configuration: ProviderBoundaryConfiguration; // read-only snapshot
  readonly deadlineAt: number;
  readonly signal: AbortSignal;
}

interface IdentityProvider {
  readonly issuers: readonly string[];
  /** Optional local/configuration check; resolver-only providers need not implement it. */
  validateReadiness?(context: ProviderReadinessContext): Promise<Result<void>>;
  resolve(evidence: ProviderEvidence): Promise<ProviderResolution>;
  // Existing optional directory and lookup callbacks remain lazy.
}

interface IdentityProviderRegistry {
  stage(input: { lease: GenerationLease; provider: IdentityProvider }): StagedGenerationRegistration;
  /** Called only by the plugin-generation commit; no await and no resolver call. */
  replaceGeneration(input: {
    pluginId: string;
    next: PluginGeneration;
    previous: PluginGeneration | null;
  }): void;
  active(): { readonly lease: GenerationLease; readonly provider: IdentityProvider } | null;
}
```

Core always verifies declaration shape, configured-boundary ownership, issuer
uniqueness, and configuration form before staging. When supplied,
`validateReadiness` receives a captured, operator-selected configuration and a
candidate signal. It is bounded by `deadlineAt`; a late completion is fenced by
the candidate generation/signal and treated as a failed candidate. It may verify
local selected issuer/key material, but it must not be made a mandatory network
probe or a promise that the remote issuer will remain available. It **must not**
resolve a request, inspect request credentials, fabricate an actor, prime a
person cache, or open a provider-bound user socket. `resolve(evidence)` begins
only after a request captures the active generation and trusted ingress facts.

For a request, core captures `(generation, signal, deadlineAt, session epoch)`
before invoking `resolve`. Aborting the signal is advisory: a provider may
ignore it. A late fulfillment/rejection is discarded unless the captured
generation remains active, the signal is live, and the deadline and session
epoch still match. Deadline, malformed resolution, rejection, and provider
unavailability all fail closed. They neither publish a stale actor nor select
the singleton fallback. Candidate retirement aborts its signal; active-provider
replacement also invalidates affected sessions and reauthenticates
provider-bound sockets against the new generation.

The public package `ProviderRegistration` remains a staged handle during the
factory. Its `active` transition occurs at `commit`, `retired` at either
candidate cleanup or predecessor retirement, and its `dispose()` unregisters
only that exact `(provider-registration-id, generation)` entry. It must not call
host-owned `retireGeneration`, stop the owning plugin, or remove unrelated
plugin contributions. If the disposed entry was selected, identity becomes
unavailable until another configured registration activates; it does not become
capability absence. Package-adapter disposal only releases its own
subscriptions/scopes and cannot retire a borrowed core provider service.

## Path coverage

Every existing replacement path must call `replaceOne`, with artifact/database
preparation specific to its caller but with no caller-issued `disposeOne`:

| Path | Current issue | Required route |
| --- | --- | --- |
| Explicit `reload(id)` | `loadOne` retains factory failure but late activation still follows old disposal | `replaceOne(row, "explicit-reload")` |
| Builtin source watch | dev loop calls `disposeOne` then `loadOne` | `replaceOne(row, "source-watch")` after successful rebuild |
| Settings recovery | `updateSettings` directly disposes then loads | `replaceOne(row, "settings-recovery")` |
| Path source move/reinstall | registration changes DB after dispose and reloads rollback | prepare candidate against a proposed row; use a durable recovery record, publish G1, and then reconcile the row on restart if a crash separates durable and in-memory state |
| Managed npm/git update | snapshot/pointer activation calls `disposeOne` before candidate load | prepare artifact and candidate first; persist a recoverable activation record and pointer, publish G1 only after recovery can identify its artifact, then retire G0 |

Disable, remove, shutdown, and an intentional rollback have no successor, so
they retain `disposeOne` semantics but must create a retiring generation lease
and use generation-scoped cleanup. An update rollback is itself a replacement
to a prepared retained artifact; it must not revive the old dispose-first path.

The database pointer and in-memory visibility snapshot are different resources.
This plan does **not** claim an unproved cross-resource atomic transaction. The
managed-update/source-move flow must first record enough durable intent to
recover (previous artifact/row, candidate artifact/row, activation state), then
make its durable pointer transition and publish the corresponding in-memory
generation in the documented order. On process crash, no in-memory predecessor
survives; startup recovery reads that durable record and deterministically loads
either the recorded active artifact or restores the prior artifact/row before
accepting requests. The implementation must test each crash point rather than
calling the surviving runtime state a rollback guarantee.

## Source edit map for the implementation milestone

All paths below refer to exact snapshot
`960255b98ce3dccdcb5754eb67a7f989236602a1`; no edits are authorized by this
design document.

| File | Change |
| --- | --- |
| `apps/server/src/services/plugins/plugin-runtime.ts` | Extract `prepareOne`, synchronous generation commit, and `retireGeneration`; make `LoadedPlugin` retain its own generation, artifact, registrations, and resource snapshots. Replace ID-keyed predecessor disposal during replacement. |
| `apps/server/src/services/plugins/plugin-api.ts` | Turn staged registration flush into explicit preflight/commit/retire operations; candidate `onDispose` hooks remain private until commit and always run on candidate failure. |
| `apps/server/src/services/plugins/plugin-service.ts` | Funnel explicit reload, builtin source watch, and settings recovery through `replaceOne`; remove watcher's direct `disposeOne` call. |
| `apps/server/src/services/plugins/plugin-registration.ts` | For source moves/reinstalls, construct a proposed registration row and hand it to the unified replacement transaction rather than disposing first. |
| `apps/server/src/services/plugins/plugin-activation.ts` | Prepare a managed artifact candidate before changing `activeArtifactId`; record durable activation/recovery state and define restart reconciliation rather than claiming database and memory are one transaction. |
| `apps/server/src/services/plugins/plugin-service-internal.ts` | Add generation, prepared-generation, and replacement dependency types; retain old artifact/host-worker snapshots on the loaded instance. |
| `apps/server/src/services/providers/provider-registry.ts` | Add a reservation/preflight and atomic same-owner generation replacement primitive for existing agent-provider registrations. Preserve conditional disposer behavior. |
| `apps/server/src/services/identity/identity-provider-registry.ts` (new) | Own configured boundary selection, staged identity providers, readiness calls, active-generation capture, late-result fencing, invalidation, and socket reauthentication. It contains no feature models. |
| `packages/plugin-sdk/src/backend-contract.ts`, exports, and `docs/api_to_audit.md` | Add an `experimental_p6rIdentity` capability/structural contract and audit entry. Do not expose a mutable global current actor. Update `public-types`/export tests. |
| `packages/plugin-sdk/src/testing/fake-plugin-host.ts` | Model staged generations, deterministic readiness/deferred resolver outcomes, atomic replacement observation, and stale-generation disposal. |
| `apps/server/test/services/plugins/{plugin-service,plugin-reload-route,plugin-update,plugin-dev-build-problems}.test.ts` | Extend actual reload, managed-update, and watcher coverage with generation witnesses. |
| `apps/server/test/services/identity/identity-provider-lifecycle.test.ts` (new) | Isolated provider readiness, cancellation, active-generation, and socket invalidation tests. |

If any added server↔daemon field is needed for provider-bound socket
reauthentication, the implementation must increment
`HOST_DAEMON_PROTOCOL_VERSION` and add a compatibility witness. This design does
not currently require a daemon wire change; it must not smuggle one in.

## Executable test plan

Use deferred promises/fake clocks and explicit registry observers, never sleeps.
The new tests should establish these causal assertions:

1. A bad factory leaves G0 routable, runs candidate resources' cleanup once,
   and reports a failed reload without changing active registrations.
2. A factory that registers an identity provider, then fails readiness, leaves
   G0's resolver/directory/socket ownership live; it aborts G1's signal and
   runs G1 hooks LIFO. `resolve` has not been called.
3. A readiness success followed by a preflight conflict performs no partial
   publication: the observer sees either the complete G0 registry or complete
   G1 registry, never none or a mixed issuer set. A synchronous reentrant
   registration listener and an `AbortSignal` listener must observe G1 only
   after the single visibility boundary has published it.
4. On successful replacement, the active lookup becomes G1 before any G0 hook
   is run. A delayed G0 disposer cannot remove G1's provider, host artifact,
   app bundle, or shared-port declaration.
5. A resolver that ignores abort and resolves after G1 is retired/replaced
   cannot create an actor, rotate a session, satisfy a held request, or affect
   the new generation. Deadline/reject/malformed outcomes remain unavailable,
   not default user.
6. A provider-bound fake socket receives reauthentication at G1 publication;
   a late G0 cleanup cannot close or invalidate the G1 socket.
7. The same failure/success cases run through explicit reload, builtin
   source-watch reload, settings recovery, path source move, and managed
   update. Managed update keeps the previous artifact pointer and active state
   on candidate failure; successful update retires its predecessor only after
   pointer and generation publication.
8. Normal disable/remove/shutdown retire exactly the active generation; an old
   `ProviderRegistration.dispose()` is idempotent and cannot target a later
   same-plugin generation. Disposing one selected provider yields unavailable
   while another unrelated contribution/resource from that still-loaded plugin
   remains active.
9. Managed-update/source-move crash-point tests restart from each durable
   activation-record transition and prove that the recovered artifact/row and
   loaded generation agree before requests are admitted.

After source authority is granted, the coordinator designates the authoritative
candidate/materialization path for the relevant Turbo tests, SDK type/export
tests, and required fork typecheck/build. Do not infer permission to run
implementation tests against the dirty `fork/upstream` evidence checkout from
this document. Its own verification is limited to a whitespace check because it
intentionally changes no runtime code.

## Handoff constraints

The package lane should add optional `validateReadiness` plus mandatory
host-owned structural/config checks, and clarify the staged-handle/dispose
contract only after adopting the core signatures above. The identity/provenance
lane must consume an active generation captured at ingress; it must not call a
provider during plugin activation or resolve a current actor from ambient state.
The provider/features lane should ensure providers place generation-owned
clients behind the lease signal and distinguish provider outage from capability
absence.
