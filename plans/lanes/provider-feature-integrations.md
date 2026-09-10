# Provider and feature integration closure

> Historical milestone/design record. For current implementation, owners and
> acceptance gaps, use [the completion ledger](../bb-identity-completion.md)
> and [package status](../../../plugins/packages/bb-identity/STATUS.md).
> Use public declarations for current signatures. The original lane restrictions
> below describe that milestone; current user authorization and workspace
> preservation rules govern ongoing work.

**Lane:** Providers and feature integrations
**Date:** 2026-09-04
**Scope:** contract closure and implementation preparation only. This document
does not authorize a runtime, package declaration, or feature-plugin edit.

## Evidence and non-negotiable boundary

- Core evidence is the fetched upstream object
  `960255b98ce3dccdcb5754eb67a7f989236602a1`, not the dirty checkout, prior
  Draft-3 review target `44cc2292dff443bb626866171708801a904bf45a`, or the
  installed SDK 0.4.15. At that object, plugin HTTP/WebSocket registration
  offers only `local|token|none`; `plugin-api.ts` closes a plugin's WebSockets
  during disposal and `plugin-runtime.ts` disposes resources after a bounded
  invocation drain. Those are useful lifecycle hooks but do not establish
  request provenance, provider generation activation, or reauthentication.
- The committed current Identity Boundaries provider at
  `plugins/identity-boundaries/lib/provider.ts` verifies an owned host and
  Tailscale Serve headers against a Tailnet directory snapshot. Its
  `not-applicable`/`reject` result shape must not be treated as the proposed
  multi-outcome contract: a stale directory is currently rejected, and it has
  no issuer, expiry, generation, or directory-reset result.
- No caller may infer a human from loopback, a claimed client header, a current
  directory entry, or a provider's display name. The actual actor, a UI's
  viewed subject, and an operation's explicit target are separate facts.
  Trusted collaborators have equal access; these contracts record provenance
  and relevance, not an ACL.
- Only true absence of the enhanced identity capability selects the stable
  upstream singleton/default user. A selected provider being unavailable,
  timed out, malformed, expired, reset, or rejected is an error state. It does
  not fall back to singleton mode. Issuer routing, when there are multiple
  declared issuers, remains inside the one selected boundary provider.

## Normative provider configuration and lifecycle for the fixture slice

The host selects exactly one *boundary registration* by trusted operator
configuration. One registration can advertise many issuer IDs. A request never
selects a provider, an issuer, or credential fields. The selected configuration
is copied into the staged generation and becomes immutable after activation.

```ts
// Current Package Draft 4 names used by the executable fixture slice.
// `generation` is host-issued and opaque; providers cannot choose it.
export interface IdentityProvider {
  readonly issuers: readonly IssuerId[]; // unique, stable, non-empty
  /** Optional provider resource check; host structural/configuration checks are always required. */
  readonly validateReadiness?: (input: {
    readonly generation: ProviderGeneration;
    readonly configuration: Readonly<ProviderBoundaryConfigurationV1>;
    readonly deadlineAt: number;
    readonly signal: AbortSignal;
  }) =>
    Promise<Result<void>>;
  resolve(evidence: ProviderEvidenceV1): Promise<
    | { readonly status: "resolved"; readonly issuer: string; readonly subject: string;
        readonly presentation: ProfilePresentation; readonly validUntil: number }
    | { readonly status: "not-applicable" }
    | { readonly status: "rejected" | "unavailable"; readonly reason: string }
  >;
  readonly directory?: (input: {
    readonly query: string; readonly cursor?: string; readonly limit: number;
    readonly history: "current" | "include-historical";
  }, options?: ReadOptions) => Promise<Result<{
    readonly records: readonly ProviderDirectoryRecord[];
    readonly nextCursor: string | null; readonly revision: string;
  }>>;
  readonly lookup?: (subjects: readonly { readonly issuer: string; readonly subject: string }[],
    options?: ReadOptions) => Promise<Result<{
      readonly revision: string; readonly records: readonly {
        readonly issuer: string; readonly subject: string;
        readonly record: ProviderDirectoryRecord | null;
      }[];
    }>>;
}

export interface ProviderRegistrationV1 extends Disposable {
  readonly generation: ProviderGeneration;
  /** Host-selected, generation-bound immutable configuration snapshot. */
  readonly configuration: Readonly<ProviderBoundaryConfigurationV1>;
  getStatus(): "staged" | "active" | "retired";
  readonly signal: AbortSignal;
  invalidate(change:
    | { readonly kind: "authentication"; readonly subjects?: readonly { readonly issuer: string; readonly subject: string }[] }
    | { readonly kind: "directory"; readonly revision: string }
  ): Result<void>;
  subscribe(listener: (status: ReturnType<ProviderRegistrationV1["getStatus"]>) => void): Unsubscribe;
  person(issuer: IssuerId, subject: string): Result<PersonReference>;
}
```

`validateReadiness` is optional provider-specific lifecycle support, not a
second public package API or a requirement for a resolver-only provider. When
present it runs during staging without request credentials or `resolve`.
Regardless of its presence, core performs mandatory structural/configuration
checks (selected boundary, declaration shape, issuer set, ingress and
credential allowlist, and generation ownership) before staging. `resolve`
remains request-lazy. Retirement aborts the generation signal; the provider
cleans up timers/clients through that signal and `onDispose`. If a resolver
ignores cancellation, core discards its late result unless captured generation,
signal, deadline, and session epoch all still match.

`IssuerId` and `ProviderGeneration` are opaque/package-owned values. A provider returns only its stable issuer and
subject; the host's tagged/delimiter-safe constructor produces `PersonReference`
and rejects an issuer not declared in this registration. A provider directory
cannot return a principal key or override another provider's record. A profile
is presentation only and its revision does not alter historical snapshots.

The normative `IdentityProvider` declaration in `host.d.ts` has these fixture
requirements:

1. Preserve `rejected` and `unavailable` as fail-closed outcomes. The current
   declaration's `reason` is diagnostic; the fixture does not parse it.
2. Keep independently optional provider `directory?` and `lookup?` callbacks.
   Either operation
   may be absent independently; an absent operation is `unsupported` and the
   corresponding capability is false, never an outage. Cursor validity is scoped to
   `(generation, revision, query, history mode)`; stale cursor returns a
   `Result` error, never an empty page.
3. Define one opaque snapshot revision for every observable directory state
   replacement. It is not ordered or globally monotonic: clients compare it
   only for equality, and discard pages/caches on `reset` or generation change.
4. Keep `ProviderBoundaryConfigurationV1` host-owned. It must declare a stable
   boundary ID, allowed ingress IDs, credential extraction allowlist, resolver
   deadline, and maximum session age. Provider code receives the selected
   `ProviderEvidence`, never raw request headers or configuration from a
   browser/plugin RPC payload. Credentials must never appear in a profile,
   directory record, error, log, receipt, history, or subscription event.
5. Add `validUntil` validation: finite, later than `receivedAt`, and capped by
   the host's `maxSessionAgeMs`. On expiry, abort provider-bound live work,
   rotate the session stamp, close/reauthenticate WebSockets, and resolve again
   on the next allowed request. Expiry does not dispose the provider generation
   or silently substitute local identity.

### Activation, keys, and socket rules

1. Factory registration stages `(boundary config snapshot, provider instance,
   issuer set, generation)` only after mandatory host structural/configuration
   checks. Optional `validateReadiness({ generation, configuration, deadlineAt,
   signal })` may
   validate configured resources (for example, discovery metadata or a loadable
   key set) without synthetic credentials, request headers, or a resolved
   person. Its absence does not block a resolver-only provider; it must not
   manufacture a request actor. Retirement aborts the generation signal; core
   discards any late ignored-cancellation result unless its generation, signal,
   deadline, and session epoch still match.
2. Activation atomically makes the candidate visible to resolver dispatch,
   directory sources, and the plugin lifecycle. A failed factory/activation
   retains the old active generation. Candidate disposal may only retire its
   own staged generation; it cannot unregister an active successor.
3. Signing-key refresh, cache use, and verification policy are provider-owned.
   A JWKS/OIDC provider uses issuer-pinned bounded refresh as its policy
   requires and returns `unavailable/key-refresh` if it cannot establish the
   required verification state before the resolver deadline. Routine successful
   rotation neither changes issuer/subject keys nor automatically invalidates
   sessions. The provider publishes an authentication discontinuity only when
   its verified facts warrant one; the host then enforces that invalidation and
   every declared expiry.
4. Every connection captures `(generation, session stamp, validUntil)`. Before
   each WebSocket message and at expiry, the core dispatcher verifies that
   tuple; a mismatch closes with a reauthentication reason. Current upstream's
   disposal close (`1012`) is insufficient because normal provider replacement
   must first make the replacement visible, then invalidate old sockets rather
   than expose an auth gap.
5. The selected boundary provider owns any routing among its declared issuers.
   Its final `not-applicable` is a non-person/non-success outcome for that
   request, not a signal for core to try alternatives or select the singleton.
   `rejected` and `unavailable` likewise fail closed. Core owns no new issuer
   routing or priority framework.

## Concrete provider recipes

### Tailscale Identity Boundaries

**Configuration.** The operator configures the normalized owned Serve host,
one `tailscale-serve` ingress ID, expected Tailscale identity header field
names, Tailnet directory endpoint/credential reference, and issuer
`tailscale:<tailnet-stable-id>`. The code may normalize host syntax, but request
supplied host/forwarded headers cannot choose it. Core establishes whether the
request arrived through the owned proxy; an `unverified` ingress prevents this
provider from resolving.

**Resolve recipe.** Verify exact authority/method/path parseability and
`owned-proxy` ingress; parse the configured Serve headers; look up a unique,
current Tailnet profile by the verified login; emit the Tailnet's immutable
numeric/stable account ID as subject and the directory/presented fields as
presentation. Directory timeout, absence, stale snapshot, or failed refresh is
`unavailable/directory-unavailable` (or `key-refresh` when that is the
operation); malformed/mismatched identity evidence is `rejected`. Evidence
outside the Tailscale resolver's conditions is `not-applicable` to the
provider's own internal boundary router; only that provider decides whether to
evaluate another of its declared issuer paths. Resolution gets a short bounded
`validUntil`; this preserves the existing no-ambient-local fallback rule.

**Directory recipe.** Directory snapshot replacement generates a new opaque
snapshot revision and `reset`, invalidating cursors and profile cache. A healthy empty
query is an empty page with that revision; an unavailable snapshot is an error,
not an empty page. Historical records remain source-labelled and may be
returned only under `include-historical`; they never authenticate a request.

### Independent signed-assertion gateway

This proves the contract is not Tailnet-shaped. A trusted reverse proxy injects
one allowlisted `X-BB-Assertion` credential only after validating its client
connection. The provider validates a compact signed assertion against a
configured issuer URL, audience, allowed algorithms, `kid`, expiration and
nonce/issued-at policy. It maps immutable `iss` + `sub` directly to the
declared issuer/subject and maps `name`, `preferred_username`, and avatar only
to presentation. Header presence on an unverified ingress is rejection, never
evidence. JWKS/key cache belongs wholly to this provider; it is bounded and
refreshes only for its declared issuer. A changed signing key does not alter a
principal key.

Its optional SCIM/directory endpoint supplies the normative `directory?` and
`lookup?` callbacks independently.
It may be resolver-only: omit `directory`; self presentation remains in the
resolved session, while absent search/lookup report `unsupported` with the
host's capability correctly saying search/lookup are false. It must not invent
a fake singleton directory record.

### Multi-issuer resolver-only boundary

One selected boundary provider advertises `tailscale:<tailnet>` and
`gateway:<issuer>` and routes between those declared issuers internally from
trusted evidence. The host neither registers provider alternatives nor assigns
issuer priority. If the provider's final result is `not-applicable`, the route
has no enhanced person actor; if gateway evidence is claimed but its key source
is unavailable, it fails closed. This proves that routing is provider-owned and
evidence-based rather than a hard-coded plugin ID, and that directory absence
is independent of actor resolution.

## Package-to-feature adapter map

### Thread Sections import-before-initialize handshake (feature-owned)

This is a consumer migration rule for Thread Progress, not a new core or
package storage primitive. Its existing direct server storage distinguishes a
canonical principal key from a legacy identity ID; its browser fallback has an
owner-scoped key and an older global key guarded by
`thread-progress:sections:v1:legacy-owner`. A browser marker is evidence only
of a local preference association, never identity authority. The future server
adapter derives the actual owner from the request and runs one atomic import or
initialization path; view-as only reads.

| Server source | Browser candidate | Request state | Action before initialization | Browser conflict handling |
| --- | --- | --- | --- | --- |
| Canonical state exists | Same actual-owner candidate, equal | Actual owner | Use canonical state | No draft needed |
| Canonical state exists | Same actual-owner candidate, different | Actual owner | Use canonical state | Retain browser value as explicit recoverable draft; never overwrite server |
| Canonical state exists | Marker absent | Actual owner | Use canonical state | Retain the bytes as an explicit unresolved-owner recovery candidate (`ownerKey: null`); never map them to the actual owner |
| Canonical state exists | Known other owner | Actual owner | Use canonical state | Retain under that exact foreign owner as recovery; never relabel/re-author it as the actual owner |
| Legacy server key exists | Any browser candidate | Actual owner | Atomically import server legacy into the new state record first | A different same-owner browser value is a recoverable `server-legacy-wins` draft |
| No server source | Browser candidate with exact actual-owner marker/key | Actual owner | Atomically import that browser value, with live server validation | No default initialization |
| No server source | Browser candidate with marker absent | Actual owner | Defer; do not initialize defaults in this pass | Retain bytes as unresolved-owner recovery (`ownerKey: null`), without inventing a mapping |
| No server source | Browser candidate for known other owner | Actual owner | Initialize A's defaults through the ordinary atomic winner rule | Retain the candidate under its exact foreign owner; it neither blocks nor becomes A's data |
| Any | Any | View-as | Read target only | No import, initialization, save, or draft reassignment to viewed subject |
| No valid source | None | Actual owner | Initialize defaults last, through the ordinary atomic initialize winner rule | N/A |
| No valid source | Any | Owner unresolved/unavailable | Defer | Preserve a marked local recovery candidate; do not select default user on an enhanced-but-unavailable host |

Two initial mounts race safely only if both perform this protocol: read source,
choose an import plan, execute the `transaction.immediate()` import/initialize
with the request's live validator, then reload state on a loser/conflict. The
first committed import becomes canonical; the second mount sees it and retains
its different browser customization as a recoverable draft. It must not run a
second legacy synchronizer or initialize defaults before the import decision.

### Initial Thread Sections cutover: cold/drained only

The first artifact that enables the native Thread Sections state resource has a
finite rollout prerequisite: all requests served by the pre-adoption Thread
Sections binary must have drained before it is activated. A cold proof start
satisfies this prerequisite. Hot overlap of a prior binary that can still write
the legacy KV key is unsupported and must not be represented as safe.

In the new artifact, `loadThreadSections` is compatibility-read-only and always
uses a read-only legacy lookup; it never alias-copies an old numeric identity
key into the canonical key. `saveThreadSections` is retired as a writer and
returns a refresh-required failure for every call. The retained KV bytes are
only an import source. `prepareThreadSectionsState` reads the exact canonical
principal-key KV entry, returns canonical, legacy, empty, invalid-legacy, or
migration-required source facts, and stages only exact actual-actor,
session, and state-address empty/legacy facts. It does not import anything.
The next ordinary state `initialize` performs the import or default write under
the live commit validator in one immediate transaction.

An empty native record fails closed unless that exact preparation is present.
Missing, evicted, restarted, expired, or direct-replace preparation paths return
after-refresh instead of creating defaults. A persisted-operation replay is
still checked before the preparation gate. Receipt-write failure rolls back an
attempted import and leaves the staged source retryable; imports retain the
legacy revision and an unknown historical editor. This separates the durable
state authority from the non-durable preparation cache without claiming that a
local queue can fence an old process.

The pure implementation preparation is
`plugins/thread-progress/lib/thread-sections-migration.ts` with
`test/thread-sections-migration.test.ts`. It intentionally leaves current
server/UI untouched pending package binding. Remaining product ambiguity: the
durable user-facing store/location and expiry policy for recoverable browser
drafts is not present in Thread Progress today; it must be selected by the
future feature wiring rather than silently discarded or placed in the shared
identity package.

| Consumer | Current integration point | Proposed primitive | Required next edit (after package contract announcement) |
| --- | --- | --- | --- |
| One preferences resource | New feature resource through `BbIdentityBinding.state.register` | `PersonRequest.target({selection, intent})`, `StateResource`, expected actor/session/subject and atomic `CommitValidator` | Add one sample `preferences` resource and tests only; key records by opaque `target.snapshot().subject.key`, retain actual editor separately if collaborator policy permits. View-as changes the target only, never actor. |
| Agent Connect external contribution | `plugins/agent-connect/server.ts`, `message-api.ts`, `call-events.ts` currently pass external text through ordinary thread paths | `IdentityHost.sendExternal(externalAuthor, immutable SendInput)` plus enhanced structured receipt/provenance | Credential verification remains Agent Connect's responsibility. Convert verified remote `{source: "agent-connect", externalSubject, presentation}` to a host-owned external author reference; bind operation ID to payload, author snapshot, and plugin instance. Never map an external display name to a BB person. |
| ntfy → Notifications begin | `plugins/ntfy/server.ts` calls `beginNtfyRouteRegistration`; Notifications reads ambient `p6rRequestPrincipal` | Request-bound `invocation.person()` then a self-targeted write request | Notifications captures actual actor and issued target before creating registration. ntfy receives a scoped one-use completion capability, not a principal key or ambient actor. |
| ntfy → Notifications complete/recovery | ntfy stores route credential and calls `completeNtfyRouteRegistration`; recovery loops use durable route data | `OperationId`, immutable payload receipt lookup, background origin and explicit recovery target | Completion is addressed by registration ID + one-use credential and is not newly authored by the actor who began it. A restart uses the same operation ID/payload and `lookup`; unknown/expired remains uncertain—not safe to create a second external operation. |

`bindBbIdentity(bb)` is the only public package entry for each feature. No
feature imports `experimental_p6rIdentity`, calls Identity Boundaries by plugin
ID, parses `p6rRequestPrincipal`, or carries raw provider evidence. The package
normalizes capability detection. Product schemas (preferences values, route
records, notification grouping, Agent Connect message models) remain in their
own plugins. Prompt Stacks is excluded.

## Source edit map and ownership handoff

| Owner | Candidate files | Change reason |
| --- | --- | --- |
| Core identity/provenance lane | `apps/server/src/services/plugins/plugin-api.ts`, `plugin-runtime.ts`, plugin HTTP/WebSocket dispatch and public SDK declarations at exact core pin | Add experimental host-only `p6r` identity boundary protocol: trusted ingress evidence construction, immutable active-generation registry, captured actor/session tuple, socket reauth and structured invalidation. Bump host-daemon protocol version if any daemon wire payload changes. |
| Package state/UI lane | `plugins/packages/bb-identity/host.d.ts`, `bb.d.ts`, `model.d.ts`, `client.d.ts`, `testing.d.ts` | Maintain the normative provider/directory result and error contract above; package owns normalization and fallback capability state, not verification. This lane must approve before any declaration edit. |
| Provider lane (later authorized runtime work) | `plugins/identity-boundaries/lib/provider.ts`, `lib/tailscale-directory.ts`, `server.ts`, provider tests | Adapt Tailscale inputs to proposed host evidence, retain provider-owned Tailnet config, signing-key refresh and verification policy, split rejection/unavailability, emit reset/revisions, register at factory time. Do not make this change against current dirty source during this milestone. |
| Agent Connect feature owner | `plugins/agent-connect/server.ts`, `message-api.ts`, `call-events.ts`, send tests | Use external-author acceptance and receipt/provenance adapter. Existing external credentials and message parsing stay feature-owned. |
| Notifications/ntfy feature owners | `plugins/notifications/server.ts`, `store.ts`; `plugins/ntfy/server.ts`, `lib/route-credentials.ts`, delivery tests | Replace ambient identity / plugin-ID RPC coupling with package request scope and durable recovery flow. Do not redesign notification policy in core. |

## Imported recipe sketches

### IdP registration

```ts
// identity-boundaries/server.ts (future; package draft must settle first)
const identity = bindBbIdentity(bb);
const registered = await identity.registerProvider({
  issuers: [issuerId],
  async resolve(evidence) {
    if (evidence.ingress.kind !== "owned-proxy") return { status: "rejected", reason: "invalid-evidence" };
    const served = parseConfiguredServeEvidence(evidence);
    if (!served.ok) return { status: "rejected", reason: "invalid-credential" };
    const profile = await tailnetDirectory.current(served.login, evidence.signal);
    if (profile.status === "unavailable") return { status: "unavailable", reason: "directory-unavailable" };
    if (profile.status === "missing") return { status: "rejected", reason: "policy-denied" };
    return { status: "resolved", issuer: issuerId, subject: profile.id,
      presentation: profile.presentation, validUntil: boundedExpiry(evidence) };
  },
  directory: (input, options) => tailnetDirectory.search(input, options),
  lookup: (subjects, options) => tailnetDirectory.lookup(subjects, options),
});
if (registered.ok === false) {
  reportProviderRegistrationFailure(registered.error); // no lease/dispose on failure
  return;
}
const registration = registered.value;
bb.onDispose(() => registration.dispose());
```

### External Agent Connect send

```ts
// Verified credential is local to Agent Connect. It supplies an external
// source/subject, never a collaborator key or current request actor.
const receipt = await identity.server.sendExternal(
  { subject: verified.remoteSubject,
    presentation: verified.presentation },
  { operationId, threadId, input: promptInputs, mode: "start" },
);
// Persist only opaque operation ID + receipt correlation. Retry exact payload;
// never reinterpret a changed external message under the same operation ID.
```

### Agent Connect external-send inventory (planning only)

**Current entry and counterexamples.** The capability-authenticated GraphQL
mutations `cast`, `call`, and deprecated `sendMessage` all call
`sendConnectedMessage` in `plugins/agent-connect/server.ts`. That helper first
uses `sendCapability`, whose current availability check requires the fork-only
`experimental_threadMessages.send`, then sends `{ subject: connection.id,
handle/displayName: connection.nickname }`. `agent_connections` stores only
the current capability connection, not a send operation, immutable payload,
acceptance receipt, or recovery state. A lost response therefore creates no
safe retry identity. `call` also finds its accepted event by external subject
plus message text; two identical messages from the same connection are a
counterexample to treating that match as correlation.

**Smallest future feature slice.** Bind `bindBbIdentity(bb)` once in Agent
Connect's factory and replace only the send helper with
`binding.server.sendExternal`. Before dispatch, persist a feature-owned,
immutable operation row containing a client operation handle, generated package
operation ID, connection ID, nickname/presentation snapshot, thread ID, mapped
mode, exact prompt input, and canonical payload fingerprint. The external
subject is the connection ID; the host namespaces it with the Agent Connect
plugin ID. Reservation is committed before dispatch, not inferred from a later
event or observer result. Connection rotation/revocation stops new capability
use but never rewrites an already stored operation or author snapshot.

The current connection-store baseline treats rotation as a successor, not a
credential update: `rotate` replaces the row and gives the new connection a new
ID. A pending operation retains its original connection subject. A successor
does not silently acquire authority to resubmit that operation; any future
successor/recovery policy requires an explicit product decision. Revocation
similarly prevents a new dispatch, while retaining the operation for lookup.

Acceptance state is distinct from call-observer state. The former is durable
`reserved`, final `submitted`/`rejected`, or `indeterminate`; the latter may be
`not-started`, `watching`, terminal, or timed out, and never decides whether a
message was accepted. Exact final replay returns the stored final outcome.
Pending lookup waits/retries lookup with the same immutable operation; unknown,
expired, or upstream-unsupported lookup remains explicit uncertainty. An
`absent-final` lookup permits only a same-ID retry after current capability
authority and exact fingerprint validation, never a replacement ID. Same handle
with a different fingerprint is invalid. This gives the fork structured
external attribution and deduplication while the upstream adapter remains useful
with an explicit source label and no fabricated transactional receipt.

**Deliberately unresolved API points.**

1. Current GraphQL mutations have no operation handle. A new retry-safe client
   must supply one and receive it in every acceptance/uncertainty response.
   A compatibility call without one can receive a server-generated one for its
   first attempt, but cannot safely retry after losing that response; decide
   whether that legacy shape remains one-shot or is deprecated rather than
   silently claiming idempotency.
2. Existing `AUTO`/`STEER`/`QUEUE` are sent to the fork-only API as
   `auto`/`steer`/`queue`; the public contract is
   `start`/`steer-if-active`/`queue-if-active`. `STEER` and `QUEUE` have an
   apparent mapping, but `AUTO` must be verified against current native
   behavior before selecting `start`; availability must move off the old
   experimental-member presence check and instead use the public binding's
   outcome/capability behavior.
3. `/server` exposes bounded `history.attempts({ kind: "operation" })`, whose
   known result carries turn correlation, but `/bb` currently exposes only
   `sendExternal` and `lookupOperation` on `binding.server`. The future fork
   `call` path needs that existing provenance reader re-exposed by the public
   binding (or an equivalent operation-to-turn query) to replace the unsafe
   subject-plus-text observer. Upstream remains explicitly partial when no
   correlation is available.
4. Grouped/queued/shared-turn response semantics are not implied by external
   acceptance. The future client must decide whether it reports one operation
   as waiting for a shared turn, returns only its own contribution receipt, or
   exposes a bounded grouped result. No exact streaming/correlation claim is
   valid until queued, grouped, retry, and resume witnesses pass.

### Agent Connect first implementation slice (planning only)

The smallest implementation stays entirely in Agent Connect and its existing
SQLite database; it does not add an identity/core route. The first migration
would add a feature-owned `agent_external_operations` table with these bounded
columns and constraints:

| Field | Rule |
| --- | --- |
| `operation_id` | Public package `OperationId`, primary key; generated once and never reused with another fingerprint |
| `client_operation_id` | Optional legacy-compatible caller handle, unique within the current connection subject; required by retry-safe clients |
| `connection_id` | Exact capability connection subject at reservation time; retained after rotation/revocation |
| `thread_id`, `mode` | Exact target and normalized public mode (`start`, `steer-if-active`, or `queue-if-active`) |
| `author_json` | Immutable `ExternalAuthorInput` snapshot (subject plus presentation), separate from `agent_connections` |
| `input_json` | Exact immutable native prompt input, including attachment/text parts |
| `fingerprint` | Canonical hash over namespace, operation, target, mode, input, and author snapshot |
| `acceptance_status` | `reserved`, `submitted`, `rejected`, or `indeterminate`; terminal response is stored separately from observer state |
| `acceptance_json` | Exact public `AcceptanceOutcome` when available; nullable for reserved/indeterminate |
| `observer_status` | Separate call-only state (`not-started`, `watching`, `completed`, `failed`, `timed-out`) |
| timestamps | Created/updated times for bounded diagnostics and cleanup; no authority or expiry inferred from display data |

Reservation is one immediate transaction before calling
`binding.server.sendExternal`. A concurrent request that finds the same
operation/fingerprint observes the existing acceptance state and does not
dispatch again. A changed fingerprint is `invalid-operation`. The dispatch
result updates the same row: `submitted` and `rejected` are final;
`indeterminate` remains durable and is reconciled with
`binding.server.lookupOperation`. A pending lookup waits only within a bounded
request budget. `unknown`/expired lookup stays uncertain. `absent-final` can
retry the same operation ID only after current capability authority and exact
fingerprint checks; it never creates a replacement ID. If connection rotation
made the original subject non-current, the baseline rejects that retry rather
than silently granting the successor authority.

The current GraphQL shape has no operation handle. Preserve old no-ID callers
as a compatibility, one-shot path that may receive a generated operation ID in
an additive response field but cannot claim safe retry after a lost response.
The new retry-safe mutation shape should accept a bounded client operation
handle and return the package operation ID plus acceptance state in `cast`,
`call`, and the deprecated alias. Whether to reject no-ID calls on the fork or
retain this explicitly weaker behavior remains a product/API decision.

The old `sendCapability` check on
`experimental_threadMessages.send` must not determine public availability. The
adapter should map `STEER` to `steer-if-active` and `QUEUE` to
`queue-if-active`; `AUTO` must be verified against native behavior before it is
mapped to `start`. Capability reporting should come from the public binding's
structured outcome, with upstream's source-labelled/no-dedup limitation shown
honestly.

For `call`, acceptance and response observation are independent. The observer
must attach to the reserved operation and use operation provenance/turn
correlation when the fork exposes it. Grouped or shared turns may produce a
bounded waiting/partial result; they must not be attributed by repeated text.
The `/server` history reader already provides the needed operation query, but
the `/bb` binding currently omits it (see the package request above). Until it
is exposed and queued/grouped/retry/resume witnesses pass, exact streaming
semantics remain unclaimed.

**Planned owned files/tests (not started).** Extend `connection-store.ts` with
the append-only migration and reservation/read/update helpers, add a focused
`external-operation-store.test.ts`, then make bounded server changes in
`server.ts`, `graphql-schema.ts`, and `call-events.ts`. Add witnesses for
concurrent reservation, changed payload, response loss plus lookup, expired or
unknown lookup, rotated successor, no-ID compatibility, all three mode paths,
and grouped/shared-turn observer behavior. No manifest, core, package, or live
runtime edits belong to this first slice.

### ntfy begin, complete, and recovery

```ts
const personResult = await invocation.person();
if (!personResult.ok) return personResult;
const person = personResult.value;
const begin = await notifications.beginRouteRegistration(person, { intent: "self" });
// begin returns registrationId + one-use opaque completion credential.

const done = await notifications.completeRouteRegistration({
  registrationId: begin.registrationId, credential: postedCredential,
  operationId: begin.operationId,
});
// After crash/lost response: lookup(begin.operationId). Final result wins;
// pending/unknown retains the immutable operation and exposes recovery state.
```

## Required implementation witnesses

| Witness | Arrange / action | Assert |
| --- | --- | --- |
| Staged replacement | Active Tailscale generation; candidate gateway factory then activation failure | Old generation resolves; candidate is retired; its later dispose cannot remove old provider. |
| Optional readiness | Resolver-only provider without `validateReadiness`; provider with a failing optional hook | Host structural/configuration checks run in both cases; no-hook candidate activates, hook failure retains predecessor, and neither path resolves a person during staging. |
| Issuer/key stability | Gateway rotates JWKS key for same `iss/sub` | Same canonical key, new presentation permitted; routine rotation does not force invalidation; a provider-published auth discontinuity and declared expiry do invalidate/close affected sockets. |
| Resolver outcomes | Invalid header, stale Tailnet directory, resolver deadline, no issuer claims | Respectively rejected, unavailable, unavailable, not-applicable/boundary unauthenticated; none becomes default user. |
| Directory operation optionality | Search-only, lookup-only, and neither directory configurations | Present operation succeeds; each absent operation returns `unsupported` with only its capability false; no fake profile or outage result. |
| Resolver-only provider | Signed gateway resolves a current actor with no directory object | Person actions and request-aware self presentation work; search/lookup are `unsupported`; no synthetic directory/default profile. |
| Directory reset | Page at revision A, replace snapshot with B, reuse A cursor | Typed stale/reset response; client drops cached A entries and refetches; historical record does not authorize. |
| Multi-issuer internal routing | One selected boundary provider declares Tailnet and gateway issuers | Provider deterministically chooses from trusted evidence; final not-applicable remains non-person; core owns no alternative-provider priority. |
| Socket expiry/reload | Open authenticated WebSocket, expire actor then activate replacement | Message dispatch checks captured tuple and closes/reauthenticates; no request runs with retired generation. |
| Preferences actor/subject separation | Cole views Alice, edits permitted collaborator resource | Storage target is Alice; commit receipt/editor is Cole; A→B→A stamp rejects stale queued write. |
| External acceptance | Agent Connect retries same immutable external send after response loss | Fork returns same receipt/correlation; altered payload with operation ID is invalid; upstream makes no invented durable receipt claim. |
| Lost ntfy completion credential | Begin succeeds; credential lost before complete or completion response lost | A lost credential cannot complete; unknown completion is reconciled by the same immutable operation, not repeated as a second route/link/send. |
| Recovery background origin | Service resumes route delivery after request/actor expiry | Explicit background origin is recorded; it never inherits the original actor. |

## Checks for this preparation milestone

- `./bin/status` before editing: workspace, fork, plugins, community plugins,
  and upstream were already dirty; no dirty authored source was changed.
- `bb status` confirmed delegated thread `thr_q7u3m8y275` under coordinator
  `thr_csw7br3yff`.
- Read workspace, upstream, and plugins instructions plus the kickoff,
  package README/REVIEW/CONSUMERS, and master plan.
- Inspected exact core object with `git -C fork/upstream show/grep
  960255b98ce3dccdcb5754eb67a7f989236602a1`; no runtime build, install,
  reload, test run, branch movement, commit, push, or external side effect.

## Remaining coordinated work

1. Package lane must accept/revise the public names and DTOs above; this lane
   must not edit its declarations without that handoff.
2. Core lanes must decide the exact experimental SDK surface and authoritative
   activation/ingress hook. The current upstream plugin lifecycle is evidence
   of a gap, not proof of the proposed host guarantees.
3. After both contracts land, provider/feature owners can implement the listed
   adapters against a clean authority decision and run the witnesses on the
   exact selected fork revision.
