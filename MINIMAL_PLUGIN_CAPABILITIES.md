# Minimal plugin capabilities for the BB fork

This document describes how to preserve Phosphor's identity and multiplayer
requirements while minimizing the BB core and Plugin SDK delta carried across
upstream releases.

The design rule is:

> Put authority and durable acceptance in core. Put optional storage,
> synchronization, projection, and presentation in plugins.

A broad feature SDK reproduces a feature's domain model in BB core. A minimal
capability SDK exposes only the operation a trusted plugin cannot perform
safely on its own.

## The true core goals

The downstream fork must guarantee:

1. Every inbound BB request is associated with a server-resolved principal or
   explicitly has no principal. Browser input cannot choose that principal.
2. A human-authored unit captures an immutable actor snapshot when BB accepts
   it. Queueing, deferral, restart, profile changes, and later delivery do not
   replace the accepted author.
3. Trusted agent-originated work is distinguishable from human work and cannot
   be selected by an ordinary public request.
4. Plugins serving an independently authenticated external system may create
   actors only inside a core-enforced plugin namespace.
5. Plugins can scope their own state to a trusted request actor without owning
   BB's authentication boundary. A claimed actor is attribution, not verified
   authorization or a durable settings owner.
6. Existing BB UI extension surfaces can implement optional experiences
   without changes to native settings, query, or composer internals.

Everything else should be justified separately.

## Minimal mutation seams and read contexts

### 1. Request-bound identity context

HTTP and RPC handlers receive identity facts resolved by the server at the
shared request boundary:

```ts
type RequestActorAssurance =
  | "trusted-provider"
  | "local-operator"
  | "claimed";

interface PluginRequestActor {
  /** Opaque, stable equality/storage key authored by BB. */
  readonly key: string;
  /** Immutable presentation snapshot for this request. */
  readonly actor: {
    readonly handle: string;
    readonly displayName: string;
    readonly imageUrl: string | null;
  };
  readonly assurance: RequestActorAssurance;
}

interface PluginRequestContext {
  readonly actor: PluginRequestActor | null;
}
```

The key is opaque to consumers. Plugins may compare it, but do not need provider
ids, subjects, lease generations, or principal serialization rules. Only a
`trusted-provider` actor may own durable identity-scoped plugin state by
default. Local-operator ownership requires an explicit policy. Claimed keys are
currently process/browser derived and are not durable owners.

The current downstream `P6rPluginRequestContext` is already close to this
shape. Keep it request-bound and pass it consistently to HTTP and RPC handlers;
do not expose a mutable process-global “current user.” Non-null is enough for
attribution; authorization checks must inspect assurance.

Route auth is decided before the BB resolver sees the request. Core/local/RPC
surfaces resolve a request actor. Token, external, and none plugin routes skip
the resolver and receive null, so bearer/signature headers are never exposed to
the identity provider. None routes are read-only. `external` means the trusted
handler owns verification; core does not verify that external credential.

### 2. Authored thread operations

A plugin must not manufacture a BB principal and pass it to a generic send
method. Bind ordinary human operations to the live request actor:

```ts
interface PluginRequestThreadActions {
  send(args: {
    threadId: string;
    message: string;
    mode: "start" | "steer-if-active" | "queue-if-active";
  }): Promise<{ ok: true }>;
}

interface PluginRequestContext {
  readonly actor: PluginRequestActor | null;
  /** Present only while a request actor may author this live request. */
  readonly threads: PluginRequestThreadActions | null;
}
```

Core supplies the actor from the request context and enters the normal
`acceptThreadSendRequest` path. The plugin controls content and mode, not
authorship. This supports prompt-shelf actions and interactive prompt-stack
steps without adding native composer or project-settings code.

The action captures a private parsed/frozen actor, request generation, and
plugin generation. It fails after handler settlement, request abort, plugin
reload, or disposal; mutating the public actor object cannot change authorship.
Real and fake hosts enforce the same lifetime.

No durable authorship grant ships in the 0.40 release. Current prompt stacks
synchronously enqueue their steps during the initiating request. If a later
consumer genuinely needs post-request authorship, stop and design a stored
opaque grant bound to plugin installation/generation, actor snapshot, thread,
operation, expiry, use count, and idempotency key, consumed atomically with
accepted-unit creation.

### 3. Plugin-namespaced external actors

Slack, email, or another independently authenticated integration has no BB
request principal. A trusted plugin may assert the remote subject it verified,
but core must force the authority to a tagged `plugin-external` kind disjoint
from provider, local, claimed, legacy, and future identities:

```ts
bb.externalThreadMessages.send({
  threadId,
  message,
  mode,
  actor: { subject, handle, displayName, imageUrl },
});
```

Core derives the external authority from `pluginId`; the plugin cannot select
another provider or a BB principal key. Actor recording and accepted-unit
creation commit in one transaction, so a failed send creates no phantom
collaborator. The current downstream
`experimental_threadMessages.send` capability follows this model and is a good
small seam after replacing its collidable string namespace. Rename its unshipped
HTTP `auth: "capability"` mode to `auth: "external"`: the owning handler asserts
that it verified its bearer or signature before calling it; core does not make
that credential or browser claims authoritative.

Keep request-principal sends and external-actor sends separate. Combining them
into one method with an optional actor argument makes the authority boundary
easy to misuse.

### Durable accepted-turn author

Agent tools run after request transport and possibly after queue/deferred
delivery. Their read-only `PluginAgentToolContext.turnAuthor` comes only from
the actor snapshot stored with the accepted unit. A current request/local
operator is never substituted when the stored turn author is null or legacy.

This is a read context, not a mutation capability. Test it across initial
thread creation, immediate, queued, deferred, edited, and legacy-unknown turns.

## Identity-scoped state without a core settings SDK

Core needs to supply only the stable request identity key. A shared library in
the organization plugins repository can implement the rest on top of
plugin-owned SQLite and plugin realtime signals:

```ts
interface IdentityStateRecord<T> {
  value: T;
  revision: number;
}

interface IdentityStateStore<T> {
  read(identityKey: string): Promise<IdentityStateRecord<T>>;
  compareAndSet(args: {
    identityKey: string;
    expectedRevision: number;
    value: T;
    mutationId: string;
  }): Promise<IdentityStateRecord<T>>;
}
```

The shared library owns revision checks, idempotent mutation ids, debouncing,
realtime invalidation, reconnect reconciliation, and migrations. Each plugin
owns its schema and policy. BB core does not gain per-feature settings tables,
routes, or UI. The server derives the owner from a trusted-provider request
actor; local-operator ownership is allowed only by explicit deployment policy,
and claimed actors never select durable rows.

The client state machine carries both a server revision and a local generation,
allows one save in flight, and coalesces later edits without discarding them.
It must handle owner changes, stale reads, conflicts, reconnects, duplicate
mutation delivery, and realtime invalidation. Realtime messages contain only a
generic invalidation signal, never identity keys or preference values. Tests
use deterministic scheduling to cover edit-during-save, owner-switch-during-
load/save, conflict/retry, disconnect/reconnect, duplicate mutation ids, and
two clients converging on the same server revision.

This is enough for Thread Progress sidebar section settings and similar
plugin-owned identity-scoped state. The browser never sends an identity key to
select whose row is changed; the plugin server takes the key from the
request-bound context. Native per-person palette parity is deliberately not
claimed for 0.40: there is no supported plugin surface that can reproduce all
of BB's native appearance behavior without another core/UI patch. Preserve the
old rows and defer either a narrow appearance extension or an explicit offline
import tool.

## Implementing current features with the minimal surface

| Goal | Core responsibility | Plugin responsibility |
| --- | --- | --- |
| Durable multiplayer authorship | Resolve principal; accept and persist a discriminated human/agent/system/legacy origin through create, fork, provisioning, queue/deferred delivery, edits, and interactions; render the stored author | Identity provider and optional presentation components |
| Prompt shelf | Request-bound authored send or native composer draft API | Shelf storage, buttons, sequencing, and UI |
| Prompt stacks | Request-bound send during the initiating request | Sequence state, project overrides, scheduling, and composer surfaces; a future asynchronous design requires a separately reviewed durable grant |
| Per-person palette | Preserve historical rows; no new core API in 0.40 | Deferred until a narrow supported appearance surface or explicit offline import exists |
| Thread Progress sections | Existing thread reads and plugin-owned thread-list surface | Phase database, filtering, sorting, section synchronization, and UI |
| Participant display | Always expose the stored accepted author for each timeline unit; add a small thread-level participant read only if production-copy equivalence is proved | Optional avatar presentation |
| Agent tool attribution | Supply `turnAuthor` from the stored accepted unit, including null/legacy-unknown | Read-only tool behavior |
| External Slack-style authors | Plugin-namespaced external send | Signature/token verification and remote profile mapping |
| Workspace executable resolution | Host daemon resolves the workspace login-shell environment | No plugin replacement is safe for this process boundary |

## Why generic Thread Facets can be deferred

Generic Thread Facets currently add a cross-plugin declaration system,
cardinality laws, generations, reconciliation, cursors, eight core tables, SDK
types, fake-host behavior, CLI, and query APIs. That is valuable only if
multiple independent consumers need authoritative cross-plugin facet queries.

It is not required for identity or per-message authorship. BB always renders a
timeline unit from its stored accepted author. A thread-level participant
summary may be projected from durable attributed events only after a
production-copy equivalence report defines inclusion, ordering, pagination,
legacy-null behavior, and accounts for every preserved facet relation. Missing
historical identities require a bounded compatibility read or an explicitly
accepted presentation change. Thread Progress can keep phase as the authority
in its own database and merge phase into its plugin-owned sidebar list; retire
its obsolete facet-projection outbox/table once no consumer remains.

If cross-plugin querying becomes a demonstrated need, begin with a narrower
read-only annotation API or an indexed projection interface. Do not restore the
full generic lifecycle preemptively.

## How this reduces the 0.40 port

The minimal port keeps:

- principal resolution and negative authorization tests;
- request-bound plugin identity context;
- accepted human/agent origin and durable actor fields;
- create, fork, provisioning, queue, deferred, edit, and interaction
  authorship;
- stored accepted-turn author in the agent-tool read context;
- daemon speaker metadata;
- presence and author presentation;
- request-principal and plugin-namespaced external sends; and
- the narrow host-daemon workspace `PATH` helper.

It can defer:

- generic Thread Facets and their SDK/fake-host/query/CLI surface;
- native prompt-stack settings and prompt-box modifications;
- native per-person appearance routes and roster data;
- facet-specific query cache work; and
- unrelated header-layout refinements.

Prompt stacks and identity-scoped plugin settings remain possible because the
minimal identity and authored-operation capabilities address their true trust
requirements. Native per-person appearance parity remains deferred.

## SDK authoring rules

- Pass authority through an opaque capability or server-authored context, not a
  caller-supplied identity field.
- Resolve identities only for core/local/RPC routes, after route auth has been
  selected. Token, external, and none routes receive no request actor; secret
  authentication headers never reach the identity provider.
- Treat assurance as part of authorization. Claimed attribution is never a
  durable state owner or verified principal.
- Keep capabilities request-bound by default. Add durable grants only for a
  proven asynchronous use case and scope them narrowly.
- Invalidate request actions after handler settlement/abort and on plugin
  reload/disposal. Test captured-action use after each boundary in both real
  and fake hosts.
- Separate BB-user authorship from plugin-namespaced external authorship.
- Expose stable opaque equality keys; keep provider serialization and lease
  mechanics private to core.
- Put reusable optimistic-state logic in an organization plugin library rather
  than BB core.
- Prefer an existing UI slot over a new server route or native component patch.
- Add a fake-host implementation and negative authority tests for every core
  capability.
- Measure a capability by upstream files touched. If it requires changes across
  unrelated app, server, DB, CLI, and SDK layers, it is probably a feature
  port, not a minimal capability.
- Give every experimental capability a deletion condition: an equivalent
  upstream API, absence of consumers, or migration of all consumers to a
  plugin-owned implementation.

The migration policy for moving durable state across upstream releases is in
[`FORK_MIGRATIONS.md`](FORK_MIGRATIONS.md).
