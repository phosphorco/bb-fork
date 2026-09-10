# Core identity and provenance lane — contract closure inputs

> Historical milestone/design record. For current implementation, owners and
> acceptance gaps, use [the completion ledger](../bb-identity-completion.md)
> and [package status](../../../plugins/packages/bb-identity/STATUS.md).
> Use public declarations for current signatures. The original lane restrictions
> below describe that milestone; current user authorization and workspace
> preservation rules govern ongoing work.

**Owner:** identity/provenance lane (`thr_uitunmynwf`)  
**Status:** first-milestone implementation input; no runtime source changed  
**Evidence pin:** upstream `960255b98ce3dccdcb5754eb67a7f989236602a1` (2026-09-04), inspected with `git -C fork/upstream show` and `git grep`. The dirty upstream checkout, installed SDK 0.4.15, and prior review pin `44cc2292dff443bb626866171708801a904bf45a` are not evidence for this change map.

This document closes the minimum *generic* core contract needed by the package
and its first consumers. It does not authorize a runtime edit. It uses the
`p6r`/`experimental_` namespace only as a fork API namespace; core does not
import `@phosphorco/bb-identity`, or know profiles, view-as state, storage
schemas, notifications, sidebars, or Prompt Stacks.

## Decisions and invariants

- Trusted collaborators have equal information access. Provenance is not an
  ACL or a permission tier.
- The actual actor, viewed subject, and explicit operation target are distinct.
  The core invocation context contains only the actual actor/non-human origin.
  Viewed subject is package/UI state; a feature target is explicit data and is
  validated by that feature. Neither can replace the actor.
- A stable single-user origin is available only when the entire optional
  capability is absent. A configured boundary that is unavailable, rejects,
  times out, expires, is malformed, or is being replaced is an explicit
  unavailable/rejected result, never singleton recovery.
- The durable unit is a contribution, not a delivery group. A contribution has
  immutable accepted-authorship evidence and a mutable current projection
  (including `latestEditor`); no full revision ledger is implied. An execution
  attempt has ordered input groups whose sources are immutable contribution
  references plus attempt-time snapshots, interaction-resolution snapshots, or
  generated-context snapshots. One delivery group may therefore contain many
  authors.
- A request scope is created only for one admitted invocation. A
  generation-bound registration is not a request scope and never contains a
  human actor, session, or request lifetime.
- Acceptance checks a live scope in the same SQLite transaction that writes the
  request event, contribution/attempt sidecars, operation record, and mapping.
  Once that transaction commits, expiry cannot retract accepted work. A later
  lookup is evidence/reconciliation only; it cannot authorize new work.

## Proposed structural core API

The public plugin SDK member is named `experimental_p6rIdentity` and is
recorded in `docs/api_to_audit.md`. The package `/host` declaration is the
normative raw contract; the following is the exact core implementation target.
The `P6r*` names below describe core-private captured provenance only; they are
not extra raw protocol types. The package translates the settled raw surface to
branded feature types behind its adapter.

```ts
type ForkInvocationRouteClass =
  | "interactive-session"
  | "external-credential"
  | "anonymous"
  | "plugin-background"
  | "agent-tool"
  | "local-cli";

type P6rOriginSnapshot =
  | { kind: "principal"; key: string; issuer: string; subject: string;
      presentation: P6rPresentation; assurance: "provider-verified" | "local-user" }
  | { kind: "external"; sourcePluginId: string; subject: string;
      presentation: P6rPresentation; assurance: "integration-asserted" }
  | { kind: "agent"; agentId: string | null }
  | { kind: "system"; reason: string }
  | { kind: "unknown"; reason: "legacy" | "upstream-unattributed" | "missing-source" };

interface P6rPresentation {
  readonly displayName: string;
  readonly handle: string | null;
  readonly avatarUrl: string | null;
}

interface P6rTrustedIngress {
  readonly id: string | null;
  readonly kind: "owned-proxy" | "local" | "unverified";
  readonly authenticatedPeer: string | null;
  readonly authority: string;
  readonly method: string;
  readonly pathname: string;
  readonly transport: "http" | "websocket";
  readonly receivedAt: number;
}

interface ForkInvocationRegistration extends Disposable {
  readonly generation: string;
  readonly status: "staged" | "active" | "retired";
}

interface ForkInvocationScope {
  readonly signal: AbortSignal;
  readonly expiresAt: number;
  validate(): { readonly ok: true } | { readonly ok: false;
    readonly code: "expired" | "retired" | "invalidated" };
  release(): void;
}

interface ForkInvocationContext<RequestContext> {
  readonly request: RequestContext;
  readonly scope: ForkInvocationScope;
}

interface ForkRequestHandle extends HostRequestHandle {
  readonly scope: ForkInvocationScope;
}

interface ForkProviderRegistration extends Disposable {
  readonly generation: string;
  readonly configuration: Readonly<ProviderBoundaryConfigurationV1>;
  readonly signal: AbortSignal;
  getStatus(): "staged" | "active" | "retired";
  subscribe(listener: (status: "staged" | "active" | "retired") => void): Unsubscribe;
  invalidate(change:
    | { readonly kind: "authentication"; readonly subjects?: readonly { readonly issuer: string; readonly subject: string }[] }
    | { readonly kind: "directory"; readonly revision: string }): Result<void>;
  person(issuer: string, subject: string): Wire<Result<PersonReference>>;
}

interface ForkIdentityProtocolV1<RequestContext, ToolContext, Input> {
  readonly version: 1;
  bindInvocation<Args extends readonly unknown[], Output>(input: {
    readonly routeClass: ForkInvocationRouteClass;
    readonly handler: (context: ForkInvocationContext<RequestContext>, ...args: Args) => Output;
  }): { readonly registration: ForkInvocationRegistration; readonly handler: (...args: Args) => Output };

  forwardRpc(scope: ForkInvocationScope,
    destination: { readonly pluginId: string; readonly method: string },
    input: Json): Promise<unknown>;

  accept(input: ForkAcceptanceRequest<Input>, options?: ReadOptions): Promise<Wire<AcceptanceOutcome>>;
  session(context: RequestContext): Promise<Wire<ServerSession>>;
  selfProfile(context: RequestContext, options?: ReadOptions): Promise<Wire<Result<IdentityProfile>>>;
  openRequest(context: RequestContext): Promise<Result<ForkRequestHandle>>;
  lookup(operationId: string, options?: ReadOptions): Promise<Wire<Result<OperationLookup<AcceptanceOutcome>>>>;
  provenance(context: ToolContext): Promise<Wire<Result<ExecutionProvenance>>>;
  historyContributions(query: Wire<ContributionQuery>, options?: ReadOptions): Promise<Wire<Result<EvidencePage<Contribution>>>>;
  historyAttempts(query: Wire<AttemptQuery>, options?: ReadOptions): Promise<Wire<Result<EvidencePage<ExecutionProvenance>>>>;
  directorySources(): readonly ProviderDirectorySource[];
  participants(input: Wire<ParticipantQuery>, options?: ReadOptions):
    Promise<Wire<Awaited<ReturnType<ParticipantReader["list"]>>>>;
  registerProvider(provider: ForkIdentityProvider): Promise<Result<ForkProviderRegistration>>;
  subscribe(listener: (event: HostInvalidation) => void): Unsubscribe;
}
```

`bindInvocation` registers the exact returned `handler` with ordinary SDK
RPC/HTTP registration. The dispatcher recognizes that function by object
identity only after normal route authentication and schema validation. It makes
a fresh, host-owned scope and passes context through the closure; no serialized
actor, session stamp, ingress fact, or scope can be forged in an RPC/HTTP
payload. The registration is attached to the loading plugin generation and is
only a dispatch binding.

`forwardRpc` is intentionally RPC-only and returns an untrusted decoded value;
the package applies its output codec. The current ntfy to
Notifications consumer needs RPC, not a new streaming API. HTTP handler scopes
are still retained by the host until the response body completes, is cancelled,
or the handler fails; that is a dispatcher/lifetime rule, not a forwarded-stream
contract. Before forwarding, core validates the original scope and destination
registration generation; it fences both again on completion. A destination
reload or scope expiry returns a structured stale-context result.

#### Accepted raw-protocol record

| Raw identifier | Settled signature/ownership |
| --- | --- |
| Discovery member | `experimental_p6rIdentity`; package `/host` owns its normative structural declaration, core implements it and packages hide it behind adapters. |
| Protocol | `ForkIdentityProtocolV1`; core contains no package/runtime identity brands. |
| Binding | `bindInvocation({ routeClass, handler }) -> { registration, handler }`. `registration` is generation-only and candidate-local; `handler` is the exact ordinary RPC/HTTP registration target. |
| Scope | `ForkInvocationScope` is fresh per admitted dispatcher invocation and opaque/non-serializable. It owns captured origin, ingress, session epoch, deadline, signal, and live validation; it is not a provider registration. `ForkInvocationContext` exposes only `{ request, scope }`; core retains the richer captured facts privately and package reads actor/session through `session(request)`/`openRequest(request)`. |
| Forwarding | `forwardRpc(scope, { pluginId, method }, Json): Promise<unknown>`. RPC only; package output codec validates it, and response-stream lifetime is dispatcher internals rather than a second public forwarding API. |
| Acceptance | `accept({ source: { kind: "scope", scope } | { kind: "external", author }, input: SendInput })`. `input.threadId` and `input.mode` are the explicit target; external and request-bound paths use one operation/receipt shape. |
| Evidence/history | `lookup`, `provenance`, paged `contributions`, and paged `attempts`; cursors bind normalized query plus snapshot and report explicit coverage/outcome. |
| Provider | Raw `registerProvider` returns structural `ForkProviderRegistration`; the package adapter validates/normalizes it to `/bb` `ProviderRegistrationV1`. Neither is a request scope nor a plugin-generation retirement control. |

The Integration lane owns an independent compile-only structural assignment
probe from a minimal core-shaped implementation to this `/host` contract. It
must use no assertions, package-private brands, or fork source imports and
report declaration incompatibilities rather than adapting around them.

### Acceptance, contributions, and attempts

```ts
type ForkAcceptanceRequest<Input> = {
  readonly source:
    | { readonly kind: "scope"; readonly scope: ForkInvocationScope }
    | { readonly kind: "external"; readonly author: ExternalAuthorInput };
  readonly input: Wire<SendInput<Input>>;
};

interface P6rContributionDraft {
  readonly content: readonly PromptInput[];
  // Queue drafts additionally reference their creator/latest-editor sidecar.
  // A direct/external draft receives the source snapshot at acceptance.
}

interface P6rAttemptInputGroup {
  readonly sources: readonly (
    | { readonly kind: "contribution"; readonly reference: P6rContributionReference }
    | { readonly kind: "interaction"; readonly interactionId: string; readonly resolver: P6rOriginSnapshot }
    | { readonly kind: "generated"; readonly purpose: string;
        readonly basedOn: readonly P6rContributionReference[] }
  )[];
}
```

`accept` materializes direct/external drafts into contribution records with
immutable accepted-authorship evidence, then uses their references plus
attempt-time snapshots (and generated/interaction snapshots) to write an
immutable attempt.
For queued work it consumes existing queue provenance, materializes the
contributions, writes the attempt, removes the claimed rows, and appends the
native request event in one transaction. Queue content edit preserves creator
and updates latest editor in its own queue-row transaction. Reordering,
grouping, and scheduling do neither. A retry/continuation copies the source
references and attempt-time snapshots from the prior attempt; it does not call
a resolver or flatten text to rediscover authors. A supported history edit
preserves original author, changes the visible latest editor, and rebuilds only
the affected visible-history index, never a past attempt snapshot.

`SendInput.threadId` and `.mode` are the explicit native-thread target;
the live scope proves only actual request provenance and does not identify a
thread. The receipt returns the durable operation id, accepted event sequence,
contribution references, native request/turn identifiers when known, retention
deadline, and `accepted | pending | indeterminate` evidence. Same operation +
same immutable payload returns its original receipt; same id + changed payload
is rejected. An operation is never deduplicated by text, author display name,
or latest thread actor.

### Bounded history mapping

The normative package `ContributionQuery` takes `cursor?: Cursor` and `limit`
for **every** discriminant (`references`, `native-message`, and `native-event`);
`AttemptQuery` likewise takes cursor/limit. A package `EvidencePage` reports
traversal `complete | continued`, next cursor, an opaque snapshot token, and
explicit known/partial/pending/unavailable/unknown/expired evidence. Its cursor
is bound to the normalized query and snapshot; changed query, generation, or
unavailable snapshot fails stale rather than silently restarting. `known` means
every requested reference in retained coverage is returned; `partial` has
explicit missing references. Native message/event lookup is therefore paged
input, not an unconsumable output cursor. This gives the required traversal:

`native message/event -> contribution page(s) -> attempt page(s) -> causal sources`.

## Ingress, provider, expiry, and sockets

Route classification happens before identity resolution. `interactive-session`
and eligible local requests are the only classes that may create a principal
scope. `external-credential` and `anonymous` credentials are never presented to
the principal resolver. Background, agent-tool, and retry paths receive explicit
non-human/durable origins and cannot inherit the request that started a service.
Trusted ingress describes host-observed transport/proxy facts; it is not a
browser-selected header.

Provider configuration is a generation-bound, read-only snapshot:

```ts
interface ProviderBoundaryConfigurationV1 {
  readonly version: 1;
  readonly boundaryId: string;
  readonly pluginId: string;
  readonly ingressIds: readonly string[];
  readonly credentials: readonly { readonly name: string;
    readonly source: "header" | "cookie"; readonly field: string }[];
  readonly resolver: { readonly timeoutMs: number; readonly maxSessionAgeMs: number };
}

type Result<T> = { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: IdentityError };
interface IdentityError {
  readonly code: "unavailable" | "rejected" | "unsupported" | "expired"
    | "stale-context" | "invalid-operation" | "limit-exceeded";
  readonly message: string;
}
type ProviderResolution =
  | { readonly status: "resolved"; readonly issuer: string; readonly subject: string;
      readonly presentation: P6rPresentation; readonly validUntil: number }
  | { readonly status: "not-applicable" }
  | { readonly status: "rejected" | "unavailable"; readonly reason: string };
type ProviderInvalidation =
  | { readonly kind: "authentication"; readonly subjects?: readonly { readonly issuer: string; readonly subject: string }[] }
  | { readonly kind: "directory"; readonly revision: string };
interface ForkIdentityProvider {
  readonly issuers: readonly string[];
  validateReadiness?(input: {
    readonly generation: string;
    readonly configuration: Readonly<ProviderBoundaryConfigurationV1>;
    readonly deadlineAt: number;
    readonly signal: AbortSignal;
  }): Promise<Wire<Result<void>>>;
  resolve(evidence: ProviderEvidenceV1): Promise<Wire<ProviderResolution>>;
  directory?(input: { readonly query: string; readonly cursor?: string;
    readonly limit: number; readonly history: "current" | "include-historical" },
    options?: ReadOptions): Promise<Wire<Result<{
      readonly records: readonly ProviderDirectoryRecord[];
      readonly nextCursor: string | null; readonly revision: string;
    }>>>;
  lookup?(subjects: readonly { readonly issuer: string; readonly subject: string }[],
    options?: ReadOptions): Promise<Wire<Result<{
      readonly revision: string;
      readonly records: readonly { readonly issuer: string; readonly subject: string;
        readonly record: ProviderDirectoryRecord | null }[];
    }>>>;
}

interface ProviderEvidenceV1 {
  readonly version: 1;
  readonly configuration: ProviderBoundaryConfigurationV1;
  readonly request: Pick<P6rTrustedIngress,
    "authority" | "method" | "pathname" | "transport" | "receivedAt">;
  readonly ingress: Pick<P6rTrustedIngress, "id" | "kind" | "authenticatedPeer">;
  readonly credentials: readonly { readonly name: string; readonly value: string }[];
  readonly deadlineAt: number;
  readonly signal: AbortSignal;
}
```

Credential normalization selects only configuration-allowlisted header/cookie
fields, preserving their configured name/source; it does not forward the whole
header map. Cap configuration to 8 credential selectors, selector names/fields
to 64 bytes, credential values to 8 KiB, ingress identifiers to 128 bytes,
issuer to 256 bytes, and subject to 1 KiB. Enforce a positive resolver deadline
bounded by a server maximum and a finite session maximum. These are proposed
boundary checks, not values a provider may override. Never log or persist raw
credentials.

Provider registration is a lifecycle-managed generation handle, not an
invocation lease. Mandatory host structural/configuration validation covers the
manifest, configuration, and declared issuers. Provider-specific
`validateReadiness({ generation, configuration, deadlineAt, signal })` is
optional and bounded,
so resolver-only providers activate without it; neither check calls `resolve`
or captures an actor. A successful readiness result establishes local readiness,
not remote provider availability. Candidate activation atomically publishes a complete
generation; failed candidate cleanup leaves its predecessor active. Dispatcher
entry captures the active GenerationLease and session epoch, creates the
core-only active-provider lease, invokes `resolve(evidence)`, and permits a
result to publish only when generation, deadline, signal, and session epoch all
still match. Activation publishes the successor before predecessor retirement;
all stale candidate/predecessor cleanup is generation-conditional. Reject,
malformed result, cancellation, and timeout fail closed.

There is one operator-selected boundary provider. It may route its declared
issuers internally; core does not register alternative boundary providers or a
priority framework. Final `not-applicable` resolution is explicitly non-person,
not a singleton fallback. Directory `search` and `lookup` are independently
optional: search-only, lookup-only, and resolver-only are valid. Absence of one
operation is `unsupported` for that operation and leaves only that capability
false; it is not an outage. Resolver-only self presentation comes from the
resolved request scope. Signing-key refresh/cache policy is provider-owned;
routine rotation does not automatically invalidate sessions, while the provider
publishes a verified discontinuity for core to enforce through expiry or
invalidation.

#### Lifecycle integration constraints

`bindInvocation` registration is a candidate-local
`StagedGenerationRegistration`: factory setup has no actor/session and does not
publish a globally callable handler. Preflight validates the registration; the
synchronous generation commit publishes it with the rest of generation G1 as a
complete snapshot through one nonthrowing, no-callback visibility boundary.
Candidate factory or binding/readiness preflight failure runs G1 hooks LIFO
while G0 handlers remain routable. No fallible route/binding registration may
occur after publication; only after atomic G1 publication may G0 hooks retire.
Abort, listener, socket-reauthentication, and event callbacks run only after
that visibility boundary.

For each dispatch, the identity registry looks up and captures one active
GenerationLease *before* it makes the opaque InvocationScope. The scope records
the origin generation and session epoch from that already-published snapshot,
immutable classified ingress/session snapshot, deadline, and abort signal. It
never dereferences an ambient/current actor later.
Retirement aborts its signal; new dispatch rejects a retired binding, while a
held handler/HTTP stream retains its scope only to normal settlement,
cancellation, or retirement. Forwarding checks both the live origin
scope/generation and live destination generation at dispatch, so an origin G0
scope cannot be revived or silently transferred to G1. Acceptance validates
that captured scope inside the database transaction; post-commit
expiry/retirement cannot retract acceptance. Retirement is by exact generation
object, never plugin ID alone. Provider disposal is a separate
generation-conditional operation, not plugin-generation retirement.

On session expiry or provider generation replacement, stop new writes, end
unaccepted scopes and observation, rotate the session stamp, invalidate
provider-bound sockets, and require a reconnect through authenticated ingress.
Scope expiry cannot cancel already accepted execution; ordinary execution
cancellation is a separate explicit operation. Expiry only prevents unaccepted
dispatch or late resolver publication. Do not use a stale
WebSocket handshake credential as a renewal credential. Resolver-only providers
can supply request-aware self presentation from the resolved scope; their
directory/search capability stays unavailable independently. Directory revision
is an opaque equality/snapshot token, not ordered or globally monotonic.

## Latest-core source map and concrete change list

| Latest-core location | Observed fact at `960255b` | Required fork change |
| --- | --- | --- |
| `apps/server/src/routes/plugins.ts` | HTTP/RPC performs local/token auth and a fresh handler lookup, then invokes a contextless handler. | Classify ingress before resolver; bind exact enhanced handlers; create per-call scope; retain HTTP scope through body completion/cancel; reject stale generation. |
| `apps/server/src/services/plugins/plugin-runtime.ts` | Tracks in-flight invocations per plugin and can dispose after a timeout, but has no generation-scoped request provenance. | Add registration/scope registry and generation-checked retirement; coordinate with lifecycle candidate commit/cleanup. |
| `apps/server/src/services/plugins/plugin-service.ts` and `plugin-api.ts` | Route/RPC records do not carry origin classification or binding identity. | Extend internal records and public experimental SDK member; audit entry required. |
| `apps/server/src/services/threads/thread-send.ts` | It builds `inputGroups`, then appends `client/turn/requested` plus prompt history in one immediate transaction. | Add acceptance preflight to validate scope in that transaction and write contribution, attempt, operation, and mapping sidecars with the event. Capture original drafts before mention/deferred-context expansion. |
| `apps/server/src/services/threads/queued-messages.ts` | Queue drain reconstructs groups; its idle fast path deletes claimed rows, appends the event, and starts the daemon in one transaction. | Persist queue creator/latest-editor sidecar on create/edit; consume it in both fast and general drain paths; create contribution accepted-evidence/current-projection records and immutable attempt mappings in the existing transaction. No hook bypass may bypass provenance. |
| `apps/server/src/services/threads/thread-events.ts` | Event data retains `inputGroups`, request ID, retry marker, initiator, and sender thread ID, but no causal origin graph. | Add fork namespaced provenance pointer/metadata that upstream can ignore; use fork sidecars for indexed history and idempotency. Verify native event rewrites preserve the chosen extension. |
| `thread-edit-message.ts`, `turn-retry.ts`, `thread-fork-history.ts`, interaction paths | These rewrite/replay/fork accepted requests. | Preserve author/latest-editor and attempt snapshot semantics; rebuild participant index after visible-history rewrites; retry from prior evidence only. |
| `packages/host-daemon-contract/src/commands.ts`, `apps/host-daemon`, `packages/agent-runtime` | `thread.start` and `turn.submit` retain `inputGroups` but carry no structured attribution. | **First slice:** do not change this wire or bump protocol. Trace actual provider-input/tool-call correlation using native request/turn/tool-call identifiers and server sidecars. If a concrete consumer cannot receive required causal facts, record the exact missing boundary; then add aligned `provenanceGroups`, one per final input group, with the protocol bump and mixed-version tests. |
| fork-owned migration/DB modules (new) | No fork provenance tables exist in upstream. | Add independent journal and sidecars for operation receipts, queue provenance, contribution/attempt mappings, participant index, and retention cleanup; do not alter upstream Drizzle snapshots. |

The targeted diff from review pin `44cc2292` to `960255b` is empty for the
listed seam files; this is a reaffirmed source map rather than an obsolete
review carry-over.

## Required causal tests

1. Forged payload actor/session and an external-token route cannot reach the
   principal resolver; trusted interactive ingress resolves exactly once.
2. A resolver that ignores abort and completes after deadline, expiry, reload,
   or stale disposal cannot publish a session or accept a write. Failed
   replacement preserves the predecessor; stale unregister cannot remove the
   successor.
3. Nested ntfy-to-Notifications RPC receives one request scope; destination
   reload/expiry before or during the call fails stale. HTTP response stream
   lifetime remains scoped until cancellation/finish. No forwarding stream API
   is promised.
4. Direct send with two independently authored contributions, an external send,
   and a generated mention/context produces contributions with immutable
   accepted evidence plus a correct mutable current projection, and an attempt
   with correctly ordered mixed sources.
5. Queue create/edit/reorder/group/drain proves creator/latest editor rules;
   both fast and hooked drain paths produce identical contribution/attempt
   evidence. A retry and continuation copy stored sources; neither resolves a
   new actor.
6. Expiry after the SQLite acceptance commit leaves receipt/history durable;
   expiry before commit leaves no partial event/contribution/operation record.
   Indeterminate network loss reconciles only the same operation id/payload.
7. Native message mapping paginates beyond one page and each contribution
   paginates to all attempts; cursor/query/snapshot mismatch is rejected and
   partial retained history cannot become an empty/known result.
8. In the first slice, trace native request/turn/tool-call identifiers from the
   server sidecars into one concrete provider-input/tool consumer. Unknown or
   partial correlation remains explicit and is never inferred from text or the
   latest actor. Only if that witness proves an existing boundary insufficient,
   add aligned daemon metadata, command-schema rejection for unaligned groups,
   protocol bump/mixed-version behavior, and upstream -> fork -> upstream ->
   fork continuity fixtures.

Likely homes are focused tests beside `routes/plugins`, plugin runtime/service,
thread send/queue/event/retry/fork services, `packages/host-daemon-contract/test/contract.test.ts`, host-daemon command dispatch, agent-runtime provider adapter, plus new fork integration tests. Runtime tests wait for source authority; none were run in this contract milestone.

## Risks and gates

- **Current acceptance bypasses:** queue fast paths and direct/retry/edit/fork
  callers must converge on one transactional provenance helper before any
  guarantee is claimed.
- **Session compatibility:** upstream may rewrite event JSON. Keep upstream
  content/provider state native, use fork sidecars, and prove round trips before
  committing a persisted event extension.
- **Daemon boundary:** first vertical slice deliberately uses server-owned
  sidecars plus existing native request/turn/tool-call identifiers. Structured
  provider/tool provenance is deferred, not waived: add it only after a traced
  concrete consumer shows the exact missing boundary, with protocol-version
  bump and mixed-version behavior tests.
- **Retention/index cost:** contribution and participant indexes need bounded
  pages, retention, rebuild checks, and measured writer-lock/payload budgets;
  no full roster broadcast.
- **Credential leakage:** raw credential values stay in the resolver call only;
  diagnostics, history, profiles, receipts, and realtime invalidations must use
  redacted identifiers.
- **Authority split:** lifecycle owns candidate activation/retirement;
  provider/integration owns verification and configuration; package owns
  identity normalization, view/state adapters, and transport; features own
  target policy and product storage. This lane owns the generic dispatcher,
  acceptance, causal history, and daemon seam only.

## Handoff status before runtime edits

- **Settled:** Package Draft 4 owns the normative raw `/host` declaration:
  `experimental_p6rIdentity` → `ForkIdentityProtocolV1`, object-form
  `bindInvocation` returning generation-only `{ registration, handler }`, fresh
  `ForkInvocationScope`, RPC-only `forwardRpc`, unified
  `accept({ source, input: SendInput })`, and one cursor/limit-bearing
  `ContributionQuery` for all query forms. The current document mirrors those
  literal identifiers and signatures; there is no remaining package/core raw
  protocol mismatch.
- **Settled sequencing:** The first slice uses server-owned contribution,
  attempt, and receipt sidecars plus existing native request/turn/tool-call
  identifiers. It deliberately adds no daemon field or protocol bump. Unknown
  or partial correlation stays explicit. A reproduced concrete consumer gap is
  required before proposing the smallest wire addition and its version/mixed
  compatibility tests.
- **In progress in the assigned Integration lane:** a no-cast structural
  assignment witness for the exact raw `/host` contract, and the correlation
  trace using existing native identifiers.
- **Only current runtime blocker:** coordinator-owned reconciliation audit and
  source-authority assignment of disjoint fork files. After that, start the
  direct/external/queued/history vertical slice described above.
