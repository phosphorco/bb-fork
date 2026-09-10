# Package adapters and state/UI — first-milestone closure

> Historical milestone/design record. For current implementation, owners and
> acceptance gaps, use [the completion ledger](../bb-identity-completion.md)
> and [package status](../../../plugins/packages/bb-identity/STATUS.md).
> Use public declarations for current signatures. The original lane restrictions
> below describe that milestone; current user authorization and workspace
> preservation rules govern ongoing work.

## Scope and authority

This lane owns the declaration and documentation inputs in
`plugins/packages/bb-identity/` (except `testing.d.ts` and `type-tests/`) plus
this plan. It does not implement runtime code, manifests, host generation,
storage schemas or feature models. The implementation source baseline is
`960255b98ce3dccdcb5754eb67a7f989236602a1`; dirty checkouts and SDK 0.4.15 are
not evidence for this plan.

At that snapshot, `packages/plugin-sdk/src/app-contract.ts` exposes scoped
`useRpc`, `useRealtime`, and `useRealtimeConnectionState`; backend contract
exposes RPC registration and ephemeral realtime publication. This supports a
native transport recipe, but not the enhanced identity, acceptance or provider
lifecycle guarantees below.

## Closed package contracts

| Contract | Declaration owner and input | Required behavior |
| --- | --- | --- |
| Connection | `IdentityConnection` in `/client`; native `useBbIdentityConnection` or explicit fetch endpoint/fetch/root signal | Exactly one root-owned connection is borrowed by identity and all state transports. Identity and state health are independently observable. Realtime invalidates only; reconnect/reset revalidates and authoritatively reloads before writes resume. No retained poll feed. |
| Independent roots | `createIdentityFetchConnection`, `createIdentityClient({ connection })`, `createStateTransport({ connection, resource })` | No endpoint inference from `BbContext`, ambient module singleton, or duplicate resource connection. The root owns disposal once; views remain independent. |
| State conflict | `ConflictContext`/`ConflictToken` and binding `resolveConflict(ownerSession, token, decision)` | Context exposes base/local/remote plus controller incarnation. A later divergence invalidates the old token even if the controller survives. |
| History | `ContributionQuery` cursor/limit and `EvidencePage.traversal` | Bounded native mappings are traversable. Completeness of traversal remains separate from known/partial evidence and unavailable/pending facts. |
| Current profile | `IdentityServer`/endpoint/client `selfProfile` | Read the actual request session's normalized self profile. Resolver-only providers derive it from the resolved session; absent directory operations are `unsupported`, not outage. |
| Provider public API | `/bb` `ProviderRegistrationV1` | Registration exposes opaque generation, non-secret generation-bound config, status/signal/invalidation and normalized issuer-qualified `person`. It is not an active request lease. |

## Enhanced-host provider handoff

One operator-selected boundary plugin routes its declared issuers internally;
there is no provider priority framework. The host runs mandatory structural and
configuration checks. A provider may additionally implement optional
`validateReadiness({ generation, configuration, deadlineAt, signal })`; it gets
no request evidence or credentials and cannot resolve a person.

The core lifecycle contract prepares a candidate, publishes complete routing and
registry state at a no-callback/no-abort-observation boundary, then synchronously
commits it. Failed candidates retain the predecessor. Per-invocation core-only
leases are fresh, bounded and non-public. Registration disposal removes only the
exact current registration/generation. Resolver cancellation is advisory; a late
result cannot publish unless generation, signal, deadline and session epoch still
match. Routine provider key refresh is provider policy; it only signals a session
discontinuity when verified facts require one.

These are enhanced-host obligations. Capability absence alone selects the stable
default singleton; malformed, removed, unavailable or configured-but-failing
identity boundaries do not.

## Accepted raw core/package protocol

The optional trusted SDK property is **`experimental_p6rIdentity`**. Its
structural value is `ForkIdentityProtocolV1`; the package is the normative
adapter declaration and core implements that structure without importing this
package. `bindInvocation({ routeClass, handler })` returns
`{ registration, handler }`. The returned handler is installed by ordinary native
RPC/HTTP registration; the registration is generation-bound dispatch metadata,
not an actor or request scope. Core supplies an opaque, fresh
`ForkInvocationScope` only to an admitted invocation and uses it for
`forwardRpc(scope, { pluginId, method }, input)`. Scope expiration prevents new
work but cannot retract a committed acceptance.

Raw acceptance is one operation:
`accept({ source: { kind: 'scope', scope } | { kind: 'external', author }, input:
SendInput })`. The package's adapter maps this to normalized public
`PersonRequest`/external send APIs; it never accepts a serialized actor, scope,
or provider lease. Core may lower `SendInput` to its durable target/input-groups
form, preserving authorship on original contributions. Integration owns a
cast-free structural assignment witness for this exact surface.

`ForkIdentityProtocolV1.registerProvider` returns the separate unbranded
`ForkProviderRegistration`; its `person` successful value is wire/plain-string
shaped. The adapter validates and normalizes it to public
`ProviderRegistrationV1`. Other raw successful protocol returns are already
wire-shaped (`session`, `selfProfile`, acceptance, lookup, history and
participants) or contain no package brands (invocation registration/scope and
RPC forwarding).

## Implementation sequence and witnesses

1. Core exposes the structural enhanced protocol, lifecycle generation discipline,
   durable acceptance/provenance and scoped invocation path. Package binding uses
   it without importing a fork-only runtime export at module initialization.
2. Package implements the single connection and decoder path. Native app roots
   bind public SDK hooks; explicit roots use the documented relative endpoint.
3. Package implements controller/state transport transition fencing: one in-flight
   mutation per owner, conflict-token checks, owner invalidation, state-only
   outage and authoritative recovery.
4. Feature plugins supply their own `StateResource`, transactional storage,
   drafts and conflict policy. Product models remain feature-owned.

Required execution evidence: two state resources on one connection; state-only
failure while identity remains usable; dirty A→B→A and R1→R2 conflict races;
resolver-only self profile; directory capability absence/outage; native history
continuation; candidate lifecycle failures; and independently bundled roots with
one cleanup owner. Prompt Stacks is excluded.

## Consumer-first portable `/bb` binding proposal (2026-09-05)

This is an implementation input, not a new package or core API.  It narrows the
first public `bindBbIdentity(bb)` proof to Thread Progress's personal Thread
Sections vertical, as required by master-plan §6.1–6.2: one artifact uses the
same feature schema and workflow on both hosts; capability absence selects the
stable default owner, while a configured enhanced boundary that is unavailable
does **not** fall back to that owner.

### Actual installed-SDK composition

The installed `@get-bb/plugin-sdk` exposes these public server members:

| Installed member | Binding use | Evidence / limit |
| --- | --- | --- |
| `bb.rpc.register(contract, handlers)` | Install the three state methods and ordinary feature RPC. | It accepts only a one-argument SDK handler and legal dot-separated names. The enhanced adapter therefore installs the `handler` returned by `experimental_p6rIdentity.bindInvocation`, which supplies the raw request out of band. |
| `bb.storage.database()` and `bb.storage.migrate(db, statements)` | Feature-owned SQLite record-and-receipt storage. | This is the required same-process synchronous transaction boundary for `AtomicStateStorage`; `bb.storage.kv` is not a CAS/receipt store. |
| `bb.realtime.publish(channel, payload)` | Publish only post-commit identity/state invalidations. | Installed V1 broadcasts to all connected frontends; the client filters by address. It is invalidation, never an authoritative state feed. |
| `bb.onDispose(hook)` | Dispose binding, native invocation registrations, endpoint subscriptions, and state-resource registrations exactly once. | Hooks are the SDK's sanctioned reload/disable cleanup point. |
| app `useRpc`, `useRealtime`, `useRealtimeConnectionState` | Native client root: one borrowed connection, state transport and invalidation. | The native request adapter must translate the logical state paths to native RPC names; it must not derive a route from `BbContext`. |

`experimental_p6rIdentity` remains optional and structural.  On a supported
enhanced host, its persisted `instanceId`, `bindInvocation`, `openRequest`,
and lifecycle registrations compose with the members above.  On a true absence,
the package's upstream driver creates the documented stable singleton path.
Malformed/unsupported discovery or a provider outage is returned as such; it is
not a singleton decision.

The concrete routing adapter must be a single map shared by native client and
server registration:

| Logical resource route | Native SDK RPC method |
| --- | --- |
| `bb-identity/v1/state/load` | `bb-identity.v1.state.load` |
| `bb-identity/v1/state/save` | `bb-identity.v1.state.save` |
| `bb-identity/v1/state/reconcile` | `bb-identity.v1.state.reconcile` |

The internal browser-safe `rpc-routes-runtime.ts` now owns this map, shared by
state transport and server registration. The portable
binding must use the same map when it adapts `useRpc`; passing the
logical slash names directly to `bb.rpc` is invalid under the installed SDK.

### Complete Thread Sections server call sketch

The feature keeps `ThreadSections`, its codec/migrations, record ID, target
policy, conflict UI, and SQLite tables.  It replaces the current KV
revision/queue write path only after its transactional adapter stores the state
record and exact-operation receipt in one SQLite transaction.

```ts
// thread-progress/server.ts — intended first consumer once /bb is executable.
const identity = bindBbIdentity(bb);
const db = bb.storage.database();
bb.storage.migrate(db, threadSectionsMigrations); // append-only feature migrations

const installed = identity.state.register({
  resource: threadSectionsResource, // pluginId === bb.pluginId; feature codec/schema
  storage: createThreadSectionsAtomicStorage({ db }),
  policy: { kind: 'self-only' },
});
if (!installed.ok) throw new Error(installed.error.message);

// The binding registers dotted native load/save/reconcile handlers, opens the
// actual request actor, verifies address/actor/session/subject at commit, and
// publishes invalidation only after the feature transaction commits.
// binding disposal owns the bridge; this feature registration is also disposed
// by its normal plugin lifetime.
```

The client uses one native identity connection and a borrowed
`createStateTransport({ connection, resource: threadSectionsResource })`.
Thread Sections may select another collaborator for its read-only lens, but its
server registration stays `self-only`: actor, viewed subject, and write target
remain distinct.  The controller carries the expected actor/session and
revision; a rejected or unavailable enhanced session preserves the draft rather
than creating a default-owner record.  Realtime causes reload/reconciliation;
it does not carry a sections snapshot.

### What the declared full binding can and cannot compose now

| `BbIdentityBinding` member | Composition disposition |
| --- | --- |
| `server`, `endpoint` | Compose now from `createHostAdapter`, `createIdentityServer`, and `createIdentityEndpoint`; enhanced host uses the persisted raw `instanceId`. |
| `state.register` | Compose now from the typed RPC foundation plus `createIdentityStateRpcBridge`, subject to a feature-owned `AtomicStateStorage`. This is the Thread Sections proof target. |
| `rpc.register` | Compose now for enhanced RPC using `bindInvocation(...).handler` then `bb.rpc.register`; retain every raw registration and dispose it through `bb.onDispose`. Upstream can only provide the documented singleton semantics. |
| `registerProvider` and `toolProvenance` | Compose from the normalized host adapter. Provider registration is explicitly unsupported when the enhanced boundary is absent; provenance is only as complete as the selected host exposes. |
| `http.route` | The public SDK has `bb.http.route(method, path, handler, { auth })`, and the raw binder is generic over handler arguments, so the shape is composable. Its enhanced HTTP-dispatch lifetime (response-stream completion/cancel) has not yet been proven by an installed-SDK runtime witness. Do not publish it with the first Thread Sections slice. |
| `background` | Must remain explicitly non-person. Its `person()` returns an unsupported/non-admitted Result; it must not manufacture an actor or human request scope. A background callback can use a package-owned lifetime signal and the existing public service lifetime. Any additional operation needing core invocation authority requires its own concrete proof, not an automatic new core seam. |

Accordingly, the first portable public artifact must implement and prove only
the complete server RPC + state registration path above, with native client
transport mapping and upstream singleton behavior.  It must not export the
whole declared `/bb` binding until HTTP stream scope lifetime and non-person
background behavior are either implemented with public evidence or the declaration
is deliberately narrowed.  This keeps Thread Sections consumer-first while
avoiding no-op members or a second feature-specific identity adapter.
