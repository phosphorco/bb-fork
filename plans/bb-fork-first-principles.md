# bb-fork from first principles

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Status: implementation plan, revision 3 after feasibility and source review.
Scope: replace the current 51-patch overlay with a fork whose core delta is
sized to its invariants, and whose maintenance tooling makes each upstream
release a rebase rather than a replay.

This is deliberately not an in-place migration of the current Rosetta
database. Cutover creates a clean target database and logically imports the
state that the product keeps. Existing `0107`/`0108` receipts and historical
fork columns are source data only; they never run through the target
migration journal.

Target baseline: upstream tag `desktop-v0.41.0`, commit
`ee4a5777bf1efb255a87cd9dc91fd3ae92830268`. The target is a commit, not a
moving branch. Moving beyond it requires repeating the seam inventory and
contention review first; local `origin/main` is already materially beyond
this tag, including further queue changes.

---

## 1. Motivation

### 1.1 Why multiplayer

BB upstream models one operator per install. Phosphor runs BB as a shared
workspace where several people, several agents, and several external systems
act on the same threads. Without identity the transcript cannot answer "who
said this", the sidebar cannot answer "who is in this thread", notifications
cannot be addressed, and plugins cannot scope state to a person. Everything
Phosphor builds on top of BB, including Thread Progress, Notifications,
Identity Boundaries, Rosetta Slack, and Agent Connect, depends on those
answers being correct and cheap.

Multiplayer is therefore the one feature that justifies a fork at all. Every
other downstream change either belongs in a plugin or is a candidate for an
upstream pull request.

### 1.2 What has to work well

In priority order:

1. **Attribution is correct and durable.** Every human-authored unit records
   who authored it at the moment BB accepted it. Queueing, batching, retry,
   edits by someone else, restarts, and profile changes never rewrite that
   fact. Agent-originated and system-originated work is distinguishable from
   human work and cannot be spoofed by a public request. Work a plugin does
   on its own initiative is never attributed to whichever person happened to
   be making a request at the time.
2. **Messages wrap and render with their attribution.** The timeline shows the
   author of each user message with avatar and name; the sidebar shows who
   participates in each thread; the composer and queue show whose message is
   pending. This must add no timeline database query and only one batched
   participant query per thread-list page, because those are the two hottest
   paths in the product.
3. **Different identity providers are supported.** Today the provider is
   Tailscale identity headers via the Identity Boundaries plugin. Tomorrow it
   may be an OIDC gateway, a Cloudflare Access header, or a Connect session.
   Core must not know which. Core owns the boundary; a plugin owns the
   verification.
4. **Nicknamed, non-principal authors are first-class.** Agent Connect mints a
   capability URL and a generated nickname such as `quiet-otter-7f3`; any
   holder can post as that nickname. Rosetta Slack forwards Slack users who
   have no BB identity. These authors must render like people, be attributed
   durably, and be impossible to confuse with a verified principal. They are
   plugin-namespaced actors, never BB principals.
5. **Presence is live and cheap.** Who is viewing and typing in a thread,
   derived from realtime subscriptions rather than polling, delivered only to
   the people looking at that thread.
6. **Plugins can key state by person.** A trusted request principal with an
   assurance level, so Thread Progress sections, Notifications inboxes, and
   similar features can be per-person without owning authentication.

### 1.3 What is explicitly not a goal

- A sandbox against malicious installed plugins. Backend plugins and
  same-origin content scripts remain trusted code.
- Claimed identity mode, where a client with no provider self-labels. The two
  fixed loopback identities, local operator and local tool, are the only
  no-provider principals and are narrower than today (§3.1, §5.1). Known
  consumers to remove or adapt: the SDK claimed-identity header in
  `packages/sdk` transport, the app's claimed-identity store and dialog,
  `p6r_collaborators`, and Thread Progress's identity-authority helper which
  branches on assurance.
- Connect server membership as a second identity path. If a hosted relay is
  ever needed, it becomes another identity provider plugin.
- Generic cross-plugin facet infrastructure. Participants are a concrete
  index, not an instance of a general relation system.

---

## 2. Principles

1. **Core holds authority and durability only.** If a behavior is not about
   who a request is from, what BB accepted, or a process boundary, it is not
   a core patch.
2. **Measure a patch by upstream files touched, not by lines.** A patch that
   edits ten upstream files by three lines each will rebase forever. A patch
   that adds two thousand lines in fork-owned new files has much lower rebase
   cost.
3. **Never modify an upstream table definition.** Fork state lives in fork
   tables created and migrated by fork code, outside Drizzle's journal.
4. **Keep existing upstream tests and stories untouched.** Fork tests are new
   files with a `.p6r.test.*` or `.p6r.stories.*` suffix. Existing production
   files contain only the smallest imports, calls, and schema fields needed
   to enter fork-owned code.
5. **Attribution is always an explicit input.** The request actor is carried
   in Hono and plugin handler context and is passed into the command that
   accepts a unit. There is no process-global or async-local actor store.
   Queue dispatch, retry, editing, plugin background work, and agent tools
   take their actors from durable inputs, never from whatever request happens
   to be executing.
6. **Extend upstream JSON, not upstream columns.** Where upstream already
   stores a JSON payload, an optional field there costs one schema line and
   no read-path change.
7. **Prefer an upstream slot to a core patch, and an upstream PR to a
   permanent slot patch.**
8. **Every core patch records its deletion condition.**
9. **Every downstream public surface is visibly experimental and
   namespaced.** Plugin API members use the repository-required
   `experimental_` prefix and `p6r` in the member name; tables, routes, and
   wire fields use `p6r`.

---

## 3. Data model

### 3.1 Vocabulary

- **Principal**: a verified identity, `(providerId, subject)`. The pair is
  immutable. Its canonical string form is the **principal key**, opaque to
  consumers.
- **Actor**: the author of an accepted unit. An actor is one of:
  - `principal` — a BB principal with its presentation snapshot;
  - `external` — a plugin-namespaced author, `(pluginId, externalId)`, with
    presentation supplied by the plugin (Agent Connect nickname, Slack user);
  - absent — agent, system, or legacy origin, which upstream already
    distinguishes through `initiator` and `senderThreadId` on the request
    event.
- **Presentation**: handle, display name, and image URL. Mutable for
  principals and externals in their registries; snapshotted when a unit is
  accepted.
- **Assurance**: how a principal was authenticated for one request, one of:
  - `trusted-provider` — resolved by the registered identity provider;
  - `local-operator` — loopback request from the browser or desktop surface;
  - `local-tool` — loopback request from the CLI, SDK, or an automation
    with no surface header. Attributed and rendered, but never a durable
    settings owner and never merged with `local-operator`.
  Assurance is stored in the accepted actor snapshot for audit and is
  available on request and turn contexts. It is not part of a mutable roster
  profile and is never used later to infer current authorization.

Loopback fallback produces fixed principals using provider `p6r-local` and
subjects `operator` and `tool`. Their configured presentations are ordinary
profile rows. They remain separate keys even if their display names match;
`local-tool` is not eligible to own durable per-person plugin settings.

### 3.2 Where each fact lives

| Fact | Storage | Why there |
| --- | --- | --- |
| Actor(s) of a turn request | `p6rActors: (P6rActorSnapshot \| null)[]` inside the existing `client/turn/requested` event JSON, exactly one entry per input group | Upstream already stores and ships this JSON to build the user message; no column and no extra timeline query. A drain can batch several queued rows into one event, so authorship is per group |
| Editor(s) of an accepted turn request | optional `p6rEditors: (P6rActorSnapshot \| null)[]` in the replacement request event, aligned with `p6rActors` | An accepted edit preserves the original author and separately records who changed the text |
| Actor of a queued row | `p6r_queued_actors(queued_message_id PK, actor JSON)` sidecar | Upstream's queued table has no JSON column; sidecar avoids touching it; deleted on dispatch. In 0.41 deferral is a queued row with `sendAt` and `waitingOn`, so this sidecar also covers deferred work |
| Who resolved an interaction | `p6rResolvedBy` inside the existing resolution JSON and the emitted `system/interaction/lifecycle` event | Resolution already has a JSON payload. Keeping the actor in the lifecycle event makes it durable, visible to plugin consumers, and rebuildable without a dead sidecar |
| Principal profile | `p6r_principals(key PK, provider_id, subject, handle, display_name, image_url, first_seen, last_seen, updated_at)` | One row per person; mirrored in an in-memory map. It is written only on first sight or profile change; `last_seen` is coalesced to at most once per hour |
| External actor registry | `p6r_external_actors(plugin_id, external_id, handle, display_name, image_url, source_label, first_seen, last_seen, updated_at, PK(plugin_id, external_id))` | Lets rosters and participant lists resolve externals without asking the plugin. `source_label` comes from registered plugin metadata, not caller input |
| Participants per thread | `p6r_thread_participants(thread_id, actor_key, first_seen_event_at, last_seen_event_at, PK(thread_id, actor_key)) WITHOUT ROWID` | Derived only from visible durable history, updated with event acceptance, and rebuilt after edit, truncation, and fork. One batched range query serves a thread-list page |
| Presence | memory only, in the presence plugin | Ephemeral by definition |

Actor keys are tagged, delimiter-safe values produced by one fork-owned codec,
never by string concatenation at call sites:
`principal:<encoded-provider-id>:<encoded-subject>` and
`external:<encoded-plugin-id>:<encoded-external-id>`. The codec percent-encodes
components, enforces canonical encoding on decode, and caps each raw component
at 256 UTF-8 bytes. The tags make the namespaces disjoint without reserving a
valid identity-provider id.

The plugin-visible actor shape carries `key`, `kind`, `providerId` and
`subject` (principals only), `pluginId` and `externalId` (externals only),
the presentation snapshot, historical request assurance for principals, and
the core-supplied external source label. Plugins branch on provider id and
subject today, so those stay visible; the key is the storage and equality
handle.

The event stores the full snapshot. The additional bytes are bounded and
avoid a database join on the timeline path while preserving a fallback if a
registry row disappears. `handle` and `displayName` are normalized and capped
at 80 UTF-8 bytes, `externalId` is never rendered, and image URLs are either
absent or validated HTTPS URLs with a 2 KiB cap.

`p6rActors` is required on every newly accepted user request event. Its length
must equal `inputGroups.length`, or one when the legacy singleton input shape
is used. A `null` entry means agent, system, or imported legacy origin. Zod
schemas validate alignment before persistence; readers treat a missing field
as legacy data only. `p6rEditors`, when present, has the same length.

A participant is an actor with a visible durable contribution in the current
thread history: an accepted input author, an accepted-input editor, or an
interaction resolver represented by a lifecycle event. Merely queueing a
message does not add a participant. Cancelled queue entries therefore need no
participant cleanup. `first_seen_event_at` and `last_seen_event_at` are the
minimum and maximum persisted event timestamps, so a full rebuild is
deterministic.

### 3.3 Render current profile, fall back to snapshot

The immutable fact is the key and accepted snapshot. The timeline and sidebar
render the current registry presentation when available, with the accepted
snapshot as fallback. This propagates intentional renames while retaining the
historical value for audit and degraded reads. External actors always render
a core-controlled source badge such as `via Agent Connect`; presentation alone
can never make an external actor look verified.

The authenticated app bootstrap fetches the complete roster once from
`GET /api/v1/p6r/actors`, guarded by a revision/ETag. Profile changes publish
only an actor-key invalidation; clients refetch the roster conditionally. This
is intentionally a full snapshot at Phosphor's current scale. Crossing 10,000
actors is the measured trigger to replace it with a capped batched-key route,
not an implementation-time option.

### 3.4 Why claimed mode is removed

Claimed mode exists so that a remote client with no provider can pick a name.
It requires a separate collaborators table, server-authored distinct keys per
browser, atomic rebinding on switch, and a header parser on every request.
Four current patches exist to stop claimed keys colliding with real ones.
Phosphor's deployment always has a provider on the remote path, and
development uses loopback. Removing claimed mode removes the most delicate
identity logic in the fork and buys back nothing the product needs.

Behavior for a remote request with no provider match remains what it is
today: 401. If a no-provider remote path is ever required, it is an identity
provider plugin that mints a stable anonymous subject, not a core mode.

---

## 4. Migrations and schema ownership

### 4.1 Fork tables are outside Drizzle

Fork tables are created by a fork-owned module in `initDb`, after upstream's
`migrate(db)` completes and before any service or plugin starts. The module
uses the same better-sqlite3 connection exposed as `db.$client`, so fork
writes can participate in the same explicit transaction as their upstream
event or queue write.

Bootstrap creates only `p6r_migrations` with `CREATE TABLE IF NOT EXISTS`.
Every numbered migration after that contains ordinary DDL, runs under
`BEGIN IMMEDIATE`, and records its source hash. Startup fails on a missing
sequence number, changed hash, statement error, or schema-version mismatch.
Later migrations never use `IF NOT EXISTS` to conceal drift. Statements are
append-only and never renumbered.

No fork table declares a foreign key to an upstream table. This is deliberate:
even a cascading participant FK would make the fork depend on how upstream
renames or rebuilds `threads`. The storage module explicitly deletes sidecars
and participants on known delete paths and performs an idempotent orphan sweep
at startup and daily. Orphans between sweeps are unreachable because every
read is joined or filtered by a currently existing upstream id.

Consequences:

- `packages/db/src/schema.ts`, the Drizzle journal, and the generated snapshot
  JSON are never touched by the fork. That removes roughly 28,000 lines of
  generated diff and the migration-numbering collisions that already
  happened between fork `0107`/`0108` and upstream's own `0107`.
- Upstream can add, rename, or rebuild its tables without SQLite rewriting or
  rejecting fork constraints. Semantic ids are still verified during every
  upstream rebase.
- Fork migration statements are append-only and never renumbered.

Trade-off: no ORM typing or automatic cascade for four small data tables.
Acceptable; the prepared queries, cleanup calls, and sweeps are centralized in
one fork-owned storage module.

### 4.2 Upstream migrations

The fork carries zero upstream migration changes. It depends semantically on
the event JSON and timestamps, thread ids, queued-message ids, and pending
interaction resolution JSON present at the exact target commit. The deferred
table no longer exists on 0.41; its legacy copy is import source data only.

### 4.3 Bootstrapping a new install from Rosetta

Cutover never runs target migrations against a historical Rosetta database:

1. Before the maintenance window, rehearse against a production-sized backup
   and record elapsed time, peak disk use, every validation result, and a
   canonical manifest of imported objects. The measured result sets the
   downtime budget; this plan makes no unmeasured claim that import takes
   seconds.
2. Stop every writer and snapshot the old core database, required plugin
   databases, settings, and runtime metadata. Keep the snapshot read-only.
3. Start the exact target binary against a new state directory so upstream and
   fork migrations create a clean target schema.
4. Run a versioned logical importer into that target. Its manifest covers, at
   minimum, projects, environments, threads, events, queue and wait state,
   pending interactions and resolutions, settings, machine/runtime records,
   principal profiles, external actors, and each plugin database required at
   cutover. Domains that are intentionally retired are listed explicitly with
   their replacement or deletion rationale.
5. Convert historical actor columns, `p6r_actors`, and facet relations into
   canonical `p6rActors`, `p6rEditors`, registry rows, and queued sidecars.
   Where historical source data cannot identify an editor or actor, preserve
   that uncertainty as `null` rather than inventing one.
   Then discard imported participant relations and rebuild participants from
   the target's durable event history; the derived table is never trusted as
   source data.
6. Validate SQLite integrity, exact object/id counts per domain, canonical
   hashes for every preserved non-actor event field and for each expected
   transformed event, actor-array alignment, sidecar coverage for every
   attributable queued row, pending-interaction resolution actors, participant
   equality with a second clean rebuild, and application-level smoke tests for
   timeline, queue, fork, edit, send, and required plugins.
7. Point staging at the target state and exercise it. Production is opened to
   writers only after the same import and validation transcript passes.

The importer and validation manifest are checked into fork operator tooling
and retained through the rollback window. Historical columns and tables are
not dropped or mutated; they live only in the read-only source snapshot.

Rollback is lossless only before target writers reopen. After reopening, the
deployment is forward-fix by default; restoring the old snapshot would lose
new writes. A later decision to require post-open rollback must add and
rehearse a reverse logical exporter before cutover. This constraint is an
explicit production go/no-go item, not something the backup silently solves.

---

## 5. Core seams

Each seam names its upstream touch areas and deletion condition. Phase 1 turns
those areas into an exact existing-file allowlist and line-count baseline
against the pinned target; estimates are not used as acceptance criteria.

### 5.1 Request principal (authority)

- One Hono middleware, registered once in `server.ts` on `/api/v1/*` only,
  acquires the active resolver generation, calls it, and stores the immutable
  result only in the Hono request context. There is no `AsyncLocalStorage`.
- Route auth is classified before identity resolution. Core thread routes and
  plugin routes using local/session auth resolve a principal. Plugin routes
  using `token`, `capability`, or `none` do not invoke the identity resolver
  and receive no request actor. `capability` retains its current meaning: the
  plugin handler verifies its own secret or capability. Core classifies the
  route and keeps those capability credentials out of the identity resolver.
- A core route that accepts user input must pass `p6rRequestActor` explicitly
  into the thread command. Plugin HTTP/RPC handlers receive the same captured
  value in their handler context. Fork APIs do not expose a global getter.
- Resolver throw, malformed output, rejection, timeout, or not-applicable discards
  unusable person evidence. Core uses applicable carried attribution or a stable
  machine actor and continues. Neither loopback nor a browser surface header
  establishes the human operator. Keep execution origin and initiating person
  separate, including external integration contributions.
- Trusted ingress metadata determines whether person evidence is verified. It
  does not prevent machine fallback for proxied traffic. Existing network and
  integration access checks remain independent of attribution.
- WebSocket handshake performs the same resolution once and binds the result
  to the socket. A resolver generation swap closes sockets authenticated by
  the old generation with a reconnect close code. Agent tools never inspect
  request context; they receive durable turn actors (§5.5).

Touches: `server.ts`, the plugin route registry, and the core thread-route
call sites. Exact files and line counts are recorded by the Phase 1 seam
inventory against the pinned target.
Deletion condition: upstream ships a request-identity resolver hook.

### 5.2 Identity provider registration

- `bb.experimental_p6rIdentity.register(resolver)` is the only new identity
  member in the backend SDK and is listed in `docs/api_to_audit.md`, as
  required for every new public plugin API.
- One boundary-owner plugin is configured at a time. Its resolver may
  multiplex Tailscale, OIDC, Cloudflare Access, or other issuers and must
  return a stable `providerId` with the subject. A registration from a
  different plugin fails instead of silently replacing the security
  boundary.
- Registration is staged on the candidate `PluginApiHandle`. Core activates
  it atomically only after that plugin generation commits successfully.
  Candidate failure leaves the live resolver untouched. Disposal removes a
  resolver only if owner and generation still match.
- Each request acquires an immutable generation lease. The old generation is
  disposed after in-flight resolver calls finish. At a bounded drain deadline,
  core aborts remaining calls, those requests fail closed, and only then is the
  old provider disposed. Provider-bound sockets reconnect after successful
  activation.
- The resolver receives headers, trusted ingress metadata, remote address,
  and an `AbortSignal`, and returns `authenticated | not-applicable | reject`.
  It must be cache-first. Core enforces a configurable hard deadline, 500 ms
  by default, and fails closed on timeout, throw, or malformed output.

Touches: one fork-owned registry file plus the minimal import/property in
`backend-contract.ts` and lifecycle calls in the plugin runtime.
Deletion condition: same as 5.1.

### 5.3 Accepted authorship (durability)

Every acceptance function has an explicit actor parameter. Core routes pass
their captured `p6rRequestActor`; request-bound plugin methods capture the
handler actor by value; external sends construct an external actor; queue and
retry paths load a durable actor; agent, system, and background paths pass
`null`. A function that can persist human input cannot omit the parameter.

Rules:

1. **Direct sends use the route actor.** The core route passes its actor only
   for a user-initiated unit with no sender thread and no retry provenance.
   Invalid combinations fail validation rather than silently relabeling work.
2. **Queued drafts carry current authorship.** Queue insert writes the row and
   `p6r_queued_actors` in one transaction. Editing a pending draft transfers
   authorship to the editor and replaces the sidecar in the same transaction;
   a queued draft is not accepted history yet. Cancellation deletes both.
   Re-queue and wait-derived rows copy the source sidecar.
3. **Queue reads expose authorship.** `ThreadQueuedMessage` and the queue
   server/SDK schema gain optional `p6rActor`. Queue list and composer UI use
   it to show the pending author with snapshot fallback. Legacy rows return
   no actor. This read contract is part of the seam, not an implied follow-up.
4. **Dispatch consumes durable actors atomically.** A batch loads ordered
   source rows and sidecars, constructs `p6rActors[i]` aligned with
   `inputGroups[i]`, persists the request event, updates participants, and
   deletes dispatched queue rows and sidecars in one transaction. A singleton
   event still has a one-entry array.
5. **Retries copy, never re-resolve.** Upstream may mark retry rows as system
   initiated; the fork copies `p6rActors` and `p6rEditors` from the original
   request event by request id.
6. **Accepted edits preserve author and record editor.** When B edits an
   accepted input from A, the replacement event keeps A in `p6rActors` and
   records B at the corresponding `p6rEditors` position. The UI renders
   “edited by B.” Editing or truncating history rebuilds participants from
   the remaining events in the same transaction.
7. **Interaction resolution is event-backed.** The interaction route passes
   its request actor into resolution. `p6rResolvedBy` is written into both
   resolution JSON and the resulting lifecycle event, declared in the domain
   schemas so Zod cannot strip it. It is exposed to plugin lifecycle-event
   consumers and contributes a participant only once the durable lifecycle
   event exists.
8. **Forks rebuild derived state.** Event copies retain actor and editor
   snapshots byte-for-byte. The destination participant table is rebuilt
   from copied request and lifecycle events using persisted event timestamps.
9. **Accepted-event consumers receive actors.** The experimental plugin
   thread-event payload exposes `p6rActors`, `p6rEditors`, and
   `p6rResolvedBy` where applicable. Notifications and audit plugins do not
   infer authorship from the process or issue one query per event.

Domain changes declare optional `p6rActors` and `p6rEditors` on
`turnRequestEventDataSchema`, optional `p6rResolvedBy` on interaction
resolution/lifecycle schemas, and optional `p6rActor` on the queued-message
schema. These declarations are mandatory because Zod strips unknown keys.
New writes apply the stronger invariants in §3.2; optionality exists only for
pre-cutover and upstream-originated legacy data.

Touches: thread event construction; queued-message data/service, DTO, SDK,
and UI; queue waits; interaction domain/data/lifecycle; accepted-message edit
and thread fork; plugin event projection. Each existing-file touch delegates
to the fork storage/codec module. Phase 1 records the exact inventory against
the pinned target.
Deletion condition: upstream stores an author on accepted units.

Tests that protect this seam, all in fork-owned files:

- parallel requests by A and B cannot exchange actors;
- a plugin service started by A's request and a deferred background send both
  persist `null` unless they pass an explicit external actor;
- queue insert/edit/cancel/read/dispatch keeps row and sidecar atomic and the
  UI DTO shows the correct pending author;
- a batched drain from A and B produces aligned `p6rActors` and rejects a
  length mismatch;
- retry preserves the original actor and editor arrays;
- a queued edit transfers authorship, while an accepted edit preserves the
  author and records the editor;
- interaction resolution carries `p6rResolvedBy` through storage, lifecycle
  event, plugin payload, and rendering;
- message edit, truncation, thread deletion, orphan sweep, and thread fork
  leave participants equal to a fresh event-history rebuild.

### 5.4 External actors (Agent Connect, Rosetta Slack)

- A separate experimental plugin method,
  `bb.experimental_p6rThreads.sendAsExternal({ threadId, message, mode,
  actor: { externalId, handle, displayName, imageUrl } })`. It is not an
  optional argument on ordinary send, so principal attribution cannot be
  selected through data supplied by an HTTP client.
- Core stamps `pluginId`, stores the actor as `external` in the same
  transaction as acceptance, records the plugin manifest name as the trusted
  source label, and registers it in `p6r_external_actors`. The plugin cannot
  supply a provider id, principal key, plugin id, or source label. Core applies
  the bounds and URL validation from §3.2.
- Updated 2026-09-10: plugin-owned connection-token validation uses upstream
  `auth: "none"`. The fork-specific `capability` mode and its patch are retired;
  do not preserve an alias. The plugin validates its token before external send,
  independently of message attribution.
- Agent Connect's nickname flow maps directly: `externalId` is the connection
  id, `handle` and `displayName` are the nickname. Rosetta Slack moves from
  plain send to `sendAsExternal` with the Slack user as `externalId`.
- Timeline, queue, participant, and presence components always show the
  external source badge. A matching name or image can never visually collapse
  an external actor into a verified principal.

Touches: the plugin SDK contract, plugin route registry, and `plugin-api.ts`,
with types and implementation in fork-owned modules. The API is added to
`docs/api_to_audit.md`.
Deletion condition: upstream adds an author argument to plugin sends.

### 5.5 Request actor for plugins (state scoping)

- Plugin HTTP and RPC handler contexts gain
  `experimental_p6rRequestActor` with request assurance. Capability, token,
  and unauthenticated handlers receive `null`.
- The handler context exposes
  `experimental_p6rThreads.send(...)`, which closes over the captured request
  actor by value and becomes invalid when the handler settles. This is the
  only way for a plugin to send on behalf of the current human.
- Agent tool context gains ordered `experimental_p6rTurnActors` and
  `experimental_p6rTurnEditors`, taken from the accepted event for the current
  turn. A singular author API would be incorrect for a batched turn, so none
  is exposed.
- Durable per-person plugin writes require an explicit authorization decision
  against the request actor's assurance. “View as” uses a dedicated plugin
  capability/role check; it never consults the roster, which contains no
  assurance.

Touches: `plugin-api.ts`, `backend-contract.ts`, and minimal agent-tool/event
context projection; fake host and contract tests live in fork-owned files.
Every new public member uses `experimental_` and is listed for API audit.
Deletion condition: upstream exposes a request principal to plugins.

### 5.6 Participants on the thread list (read path)

- Thread list builder does one batched `SELECT thread_id, actor_key FROM
  p6r_thread_participants WHERE thread_id IN (...)` and attaches
  `p6rParticipants: string[]` to each row.
- The roster (`key -> current presentation + actor kind + external source`)
  is the revisioned bootstrap route from §3.3. It contains no assurance.
- Upstream patches sidebar rows from status-changed pushes rather than
  refetching. Participant changes are emitted through that same
  thread-changed path so the array is present in the patch.

Touches: `thread-runtime-display.ts` (~20 lines), server-contract thread
response (~2 lines), SDK (~5 lines).
Deletion condition: upstream adds a participants field or a plugin row
accessory slot rich enough to render avatars.

This projection remains in core until an upstream row accessory can receive a
server-provided participant list without an extra per-row or per-refresh
round trip.

### 5.7 Author rendering (presentation)

- Thread-view user message projection passes the aligned `p6rActors` and
  `p6rEditors` entries through while it expands `inputGroups`.
- The user message component renders the current roster presentation with
  accepted-snapshot fallback, an editor label when present, and an unavoidable
  source badge for external actors. A batched message renders each group under
  its own author.
- Pending queue rows render `p6rActor` through the queue DTO from §5.3.
- Sidebar participant avatars: ideally through an upstream row accessory
  slot; until then one small patch in `ThreadRow.tsx`.

Deletion condition: upstream adds a message header slot and a row accessory
slot. Both are reasonable upstream proposals.

### 5.8 Presence seam

Upstream's plugin realtime publish broadcasts to every connected socket. For
presence that is both a fan-out cost and a disclosure: a plugin publishing
"A is viewing thread T" would reach clients that cannot see T. The seam
therefore includes targeted delivery:

- The plugin API exposes
  `experimental_p6rOnSubscriptionChange(listener)`,
  `experimental_p6rActorForSocket(socket)`, and
  `experimental_p6rPublishToThreadSubscribers(threadId, channel, payload,
  { excludeSocket })`; internal hub method names are implementation details.
- Presence itself, typing, viewer rosters, and their UI live in a plugin
  using that seam, `useRealtime` on the client, and
  `experimental_setThreadRowStatus` for sidebar dots. Whether one status per
  plugin per thread is enough for the sidebar affordance is a product
  judgment; if not, the row accessory slot from §5.7 covers it.
- The fork carries this seam until upstream accepts an equivalent. Presence
  behavior itself does not move into core if the upstream proposal is declined.

Touches: `hub.ts` (~30 lines), `backend-contract.ts` (~2 lines).
Deletion condition: upstream exposes subscription observation and targeted
publish to plugins.

### 5.9 Host runtime

- Per-workspace login-shell PATH resolution is retired: upstream's commit
  2424 retains the interactive PATH across shell probe failures. Verify on
  the target release that the workspace-local case is covered; if a gap
  remains, propose it upstream rather than re-porting.
- Hidden plugin workers following directory-switched personal checkouts:
  keep only if still reproducible on the target release.

### 5.10 Language highlighters

The integration point is
`apps/app/src/components/ui/markdown-code-highlight.ts`. Simple fence aliases
stay as a small alias map and are proposed upstream. A genuinely new language
grammar lives in a fork-owned module using `sugar-high/core`; the integration
file gets one dispatch call rather than carrying the grammar inline.

### 5.11 Total expected footprint

The earlier estimate of 16 upstream files and 250–350 lines omitted queue
DTO/UI, interaction projection, plugin event payloads, and provider lifecycle.
Plan for 20–30 existing upstream files, plus fork-owned identity, storage,
codec, contract, fake-host, presence, importer, and test files. Phase 1 records
the exact allowlist and baseline before implementation. The delivery goal is
to reduce this count, not to make correctness fit the old estimate. It remains
far below the current spine patch's 226 touched files.

Performance claims are also measured, not assumed. The acceptance gate records
direct-send latency, mixed-author batch drain latency, queue-list latency,
thread-list latency at the maximum page size, first roster bootstrap, profile
invalidation, timeline payload bytes, and SQLite writes per authenticated
read. Required properties are: no extra timeline database query, one batched
participant query per thread-list page, no profile write on an unchanged
ordinary request, and no per-event or per-row roster query.

---

## 6. What moves to plugins

| Feature | Current location | New home | Core dependency |
| --- | --- | --- | --- |
| Identity verification | identity-boundaries plugin | same | 5.2 |
| Presence, typing, viewer avatars | core hub, presence service, app components | new `presence` plugin | 5.8 |
| Thread phase, sidebar sections, My progress | core facets and app sidebar | thread-progress plugin owning phase in its own DB | 5.5, 5.6; request assurance for writes, roster only for presentation |
| Execution reassignment | core, 20k lines | thread-manager plugin plus one narrow batch-apply route if atomicity requires it | none or a small route |
| Prompt stacks | core native settings and prompt box | existing prompt-stacks plugin, sending through a request-bound authored send that captures the actor at handler entry, not through ambient context | 5.5 plus a request-bound send |
| Per-person palette | core routes and roster | deferred; plugin once upstream theme surface settles | 5.5 |
| Mentions and notify | core server and db | notifications plugin consuming the explicit accepted-event actor payload | 5.3, 5.5 |
| Recovery mobile | 135k lines inside the monorepo | its own repository consuming the published SDK; snapshot route becomes a plugin route with 5.5 | 5.5 |
| Agent Connect nicknames | upstream `auth: "none"`, plugin token validation | unchanged plugin using 5.4 | 5.4 |
| Slack forwarding | plain send as local operator | `sendAsExternal` with the Slack user as external id | 5.4 |

The request-bound authored send for plugins is the small core capability
`context.experimental_p6rThreads.send(...)` from §5.5. It captures the request
actor by value at handler entry and is invalidated when the handler settles.
Asynchronous work that outlives the handler must copy a durable work item and
later send with no principal actor or through the separate external-actor API;
it cannot retain request authority indefinitely.

---

## 7. Contention analysis

Ranked by expected rebase friction on each upstream release. Churn figures
below exclude upstream commit 8b2213625, which removed comments across the
tree and inflates raw line counts without semantic change.

### 7.1 High contention

**`packages/db/src/data/queued-thread-messages.ts` and
the queue service, schema, SDK, and UI.** This is the highest-churn area the
fork touches; upstream reworked dispatch in 0.41 and has continued changing it
after the target tag. The fork touches insert, edit, cancel, re-queue, dispatch,
serialization, and presentation. Mitigation: storage operations are fork-owned
calls taking row ids and explicit actors; the queue DTO adds one optional
field; the UI delegates to the shared actor component.

**`apps/server/src/services/plugins/plugin-api.ts`.** Omitted from the
earlier draft; it is where request context, agent tool context, and the
external send land. Keep all three as calls into one fork module.

**`apps/server/src/server.ts`.** Upstream changes it every release. The fork
adds one middleware registration and one handshake call.

**`packages/plugin-sdk/src/backend-contract.ts`.** Highest raw churn of any
file the fork touches. The fork adds one import and a compact set of
experimental properties in a single commit. Types and behavior stay in
`p6r-contract.ts`.

**Thread-view user message projection and the user message component.**
Upstream restructures timeline components often. Mitigation: align
`p6rActors`/`p6rEditors` in the existing input-group expansion point and
render through one fork-owned leaf component.

### 7.2 Medium contention

**`packages/domain/src/thread-events.ts`.** Two optional namespaced fields.
Conflicts only if upstream reshapes the request event schema.

**Thread list builder.** The participants query is one call; the field on
the response is one line.

**Interaction resolution and lifecycle projection.** Small schema fields but
several layers must carry them together; contract tests protect the chain.

**`thread-edit-message.ts` and `thread-fork-history.ts`.** Each calls one
fork-owned rebuild/copy operation with an explicit actor.

**Plugin lifecycle.** Provider candidate registration and atomic activation
touch the reload commit path. The generation registry is fork-owned, but this
call site is correctness-sensitive.

**Hub.** Low churn upstream. The observer and targeted publish seam is
additive.

### 7.3 Low contention

Fork-owned files: identity module, storage module, presence plugin, roster
route, SDK contract file, fake host extension, tests. These normally rebase
without conflict unless upstream creates the same path.

### 7.4 Structural risks

- **Missing explicit actor propagation.** Signatures make the actor visible,
  but a new acceptance path could still pass `null`. A static check inventories
  every call to the acceptance primitive, and tests cover core HTTP, plugin
  handler, queue, retry, interaction, background, agent, and external paths.
- **Upstream adding its own author concept.** If upstream adds an author to
  accepted units, the fork's `p6rActors` field and upstream's may coexist for
  one release; the rebase must define a single canonical field and migrate
  before both can accept writes.
- **Upstream removing the request event JSON.** Unlikely, since it is how
  user messages are rebuilt. The design degrades to a
  `p6r_event_actors(event_id PK, actors JSON)` table with a primary-key join
  on request events only.
- **Route-auth-before-resolver ordering.** A behavior change from today. A
  request captures a committed route registration and, when applicable, a
  committed identity-provider lease before invoking either. Tests pause a
  request across reload and prove it observes no half-committed generation.
- **Derived participant drift.** Every mutation path uses the central storage
  module; startup/maintenance can compare the table with a clean rebuild, and
  the cutover requires equality. Queue state is deliberately excluded.
- **External visual impersonation.** Disjoint keys are insufficient by
  themselves. Core-owned source labels and mandatory badges are tested in all
  actor renderers.
- **Loopback breadth.** If the ingress terminates on the host, loopback
  fallback remains available to proxied and direct requests. Trusted ingress
  evidence controls person verification; rejection and timeout degrade to a
  machine actor rather than blocking ordinary work.

---

## 8. Maintenance tooling

### 8.1 Repository shape

- `bb-fork` remains the overlay repository on `main`. The same writable
  `phosphorco/bb-fork` remote also stores full-tree branches named
  `source/<exact-upstream-tag>`, starting at the exact upstream commit and
  containing one downstream commit per logical patch from §5. This supplies
  a durable downstream remote without changing the pinned `upstream/`
  submodule or creating another deployment checkout.
- `build/bb/` is the one linked worktree/materialization of the selected
  source branch. It remains the in-place build and runtime path required by
  the workspace contract. `upstream/` remains a detached, read-only reference
  at the commit in `upstream.lock`. The materializer configures a `downstream`
  remote in the submodule Git store pointing at `phosphorco/bb-fork`, fetches
  the locked source commit, and attaches only `build/bb/` to its source branch.
  No source branch is checked out or moved while either worktree is dirty;
  `./bin/status` is the gate.
- Fork-owned full-tree files live under dedicated `p6r` paths where practical,
  so their history and ownership are obvious. Existing upstream files contain
  only the reviewed seam touches.
- The overlay records `upstream.lock`, a new `source-tip.lock` containing the
  exact full-tree commit, `result-tree.lock`, ordered patch manifests, and
  patch hashes. Branch names are navigation aids, never reproducibility
  inputs.
- `scripts/export` generates the complete `patches/` directory and every lock
  into a temporary directory, verifies them, then replaces the artifact set
  atomically. `scripts/verify` fetches `source-tip.lock`, replays the ordered
  patches onto `upstream.lock`, and requires the resulting tree hash to equal
  both `result-tree.lock` and the source-tip tree. It also verifies commit
  count, subject order, manifests, and patch hashes. CI fails if export leaves
  tracked artifacts dirty.
- Patches remain the release artifact and audit surface; humans edit commits
  on the source branch. Stacked Git is optional; plain interactive rebase and
  range-diff remain sufficient.

### 8.2 Rebase procedure per upstream release

1. Fetch and verify the signed/expected upstream release tag, then record its
   exact commit before changing any branch.
2. Create `source/<new-exact-tag>` from `source/<old-exact-tag>` and rebase
   the downstream stack with
   `git rebase --onto <new-commit> <old-commit>`, with `rerere` enabled.
3. `git range-diff` the old stack against the new; every hunk difference is
   explained in the commit message of the patch it belongs to.
4. Re-run the complete seam inventory, especially queue, plugin API,
   interaction, thread view, and hub behavior. Re-check every deletion
   condition and drop patches whose condition is met.
5. Run fork tests and the target's full install, typecheck, test, and build
   suite; materialize and exercise staging with the required plugins.
6. Push the tested source branch, set `source-tip.lock` to that pushed commit,
   export artifacts atomically, verify from locks in a clean checkout, then
   commit and push the overlay receipt. Only then may the workspace gitlink
   and normal-host pin advance.

Target cadence: within one week of each upstream release tag. Skipping a
release compounds; 0.40 to 0.41 changed over four thousand files.

### 8.3 Checks that run in CI

- Replay verification: patches applied onto the pinned upstream produce the
  source-tip tree and locked result tree; the source-tip commit is present on
  the configured writable remote.
- Namespace check: every exported downstream symbol, table, route, and wire
  field carries `p6r`; public plugin API members also carry `experimental_`
  and appear in `docs/api_to_audit.md`.
- Footprint check: computes file ownership against `upstream.lock`, fails if a
  patch changes an existing upstream file outside the reviewed allowlist, and
  fails if it changes an existing upstream `*.test.*` or `*.stories.*` file.
  New `.p6r.test.*` and `.p6r.stories.*` files are allowed. The check reports
  changed-line budgets but does not impose a brittle ban on comments.
- Explicit-attribution check: there is no actor `AsyncLocalStorage` or global
  getter, every acceptance call supplies the actor parameter, event wire
  arrays are validated for alignment, and all actor-bearing domain schemas
  declare the fields that Zod would otherwise strip.
- Schema check: fork migration hashes match, no fork table has an upstream
  foreign key, no fork table appears in the Drizzle journal, and a migration
  plus orphan-sweep integration test passes from a clean target database.
- Plugin SDK declaration refresh: generated types for the plugins repository
  are produced from the exported tree only and leave no diff.

### 8.4 Manifest per patch

Each logical patch carries a short manifest in its commit message:

```
Invariant: <what cannot live outside core>
Upstream-Files: <list>
Owns-Data: <fork tables or JSON fields>
Absent-Behavior: <what happens if this patch is missing>
Deletion-Condition: <upstream change that retires it>
```

`scripts/delta-report` prints these alongside the diffstat.

---

## 9. Phasing

**Phase 0 — freeze.** Reconcile the current 0.39 queue so the running host
matches a receipt. This is a prerequisite for a safe rollback point, not for
the redesign itself. Commit and push all selected child work before advancing
the workspace receipt; do not clean or relocate unrelated dirty work.

**Phase 1 — exact baseline and tooling.** Create the full-tree source branch
from `desktop-v0.41.0` at the commit named at the top of this plan. Record the
existing-file allowlist and performance baselines; implement source-tip
locking, atomic export, replay verification, and the exact seam inventory.
Build, test, and run the zero-patch target in staging with plugins that have no
identity dependency. No feature implementation starts until this passes.

**Phase 2 — authority.** Seams 5.1, 5.2, 5.5 and the storage module. Identity
Boundaries plugin ported to the new registration. Negative tests: browser
cannot select a principal; token and none routes see no actor; resolver throw
or timeout is 401; marked proxied traffic cannot fall back to loopback;
loopback CLI request is `local-tool`, not `local-operator`; candidate reload
failure preserves the active resolver; a request paused across successful
reload sees one complete generation.

**Phase 3 — durability and producer ports.** Seams 5.3 and 5.4, including the
queue DTO/UI, interaction lifecycle projection, accepted-event plugin payload,
participant rebuilds, and all tests listed under 5.3. Agent Connect and
Rosetta Slack are ported to `sendAsExternal`; no production producer remains
on an implicit principal send.

**Phase 4 — presentation.** Seams 5.6 and 5.7. Revisioned roster without
assurance, thread-view and queue components, multi-actor batched messages,
accepted-edit labels, participant avatars, and mandatory external-source
badges.

**Phase 5 — presence plugin.** Seam 5.8 and the plugin. Test that a viewer of
thread T is not announced to a socket not subscribed to T.

**Phase 6 — consumer ports and cutover inventory.** Thread Progress moves off
facets and authorizes writes from request assurance; Notifications consumes
accepted-event actors; Prompt Stacks uses the request-bound send; Thread
Manager chooses its transaction strategy; Recovery mobile moves or is retired.
Produce an explicit list of every enabled production plugin and mark it
compatible, ported, intentionally disabled, or blocking. Required identity,
producer, notification, and state-owner plugins must pass before cutover, so
these ports are not independent of Phase 7.

**Phase 7 — import rehearsal.** Implement the versioned importer and validation
manifest from §4.3. Rehearse until the same production-sized input yields the
same canonical output and stays within the approved downtime and disk budget.
Record the forward-only-after-open rollback decision.

**Phase 8 — cutover.** Execute §4.3 in the maintenance window, validate before
opening writers, exercise required plugins, then promote through the workspace
and normal-host receipt process. Keep the old snapshot immutable through the
rollback window; do not drop historical source data.

Phases 2 through 5 each end with the footprint check passing and the manifest
recorded. Every phase ends with its source branch commit pushed before the
overlay receipt or workspace gitlink advances.

---

## 10. Upstream proposals worth making

Listed because each one, if accepted, deletes a seam:

1. A request-identity resolver hook with route-auth ordering (deletes 5.1,
   5.2, 5.5).
2. An optional author/editor list on request-event and queue data, interaction
   resolver attribution, accepted-event actor payloads, and a separate
   external-author send for plugins (deletes 5.3, 5.4).
3. A message header slot and a thread row accessory slot in the app SDK
   (deletes 5.7 and the row half of 5.6).
4. Subscription observation and targeted publish for plugins (deletes 5.8).
5. Fence language aliases in the highlighter (deletes 5.10).

None of these require upstream to adopt multiplayer as a product. They are
extension points with a single-user no-op default.

---

## 11. Remaining product gates

These do not change the authority, durability, schema, or cutover design.
Each has a default so implementation can proceed, and a phase by which the
product decision must be recorded:

- **Thread Manager atomicity, by Phase 6.** Default to a plugin loop with
  idempotent per-thread operations. Add a narrow core batch transaction only
  if a concrete workflow test demonstrates an externally visible partial
  state that compensation cannot repair.
- **Recovery mobile, by Phase 6.** Default to the upstream PWA/WebView shell
  and retire the separate snapshot route. Preserve the native client only if
  a named capability and consumer cannot be met by that shell.
- **Presence row affordance, by Phase 5.** Default to the existing one-status-
  per-plugin API. Use the row accessory seam only if the implemented design
  needs simultaneous presence states that the status cannot express.

---

## Appendix: revision 3 corrections

Revision 2 remains preserved in Git history. This revision closes the
feasibility-review gaps:

- Removes actor `AsyncLocalStorage` entirely; every acceptance path has an
  explicit actor parameter (§2, §5.1, §5.3, §7.4, §8.3).
- Makes cutover a true fresh-database logical import with complete domain
  inventory, reproducible validation, retained source data, measured downtime,
  and an explicit post-open rollback constraint (§4.3, §9).
- Adds the previously missing queued-message DTO/SDK/UI read path and replaces
  the dead interaction sidecar with actor-bearing resolution and lifecycle
  JSON (§3.2, §5.3, §5.7).
- Uses `p6rActors`, `p6rEditors`, `p6rActor`, and `p6rResolvedBy` consistently,
  defines array alignment, and keeps every downstream public plugin API both
  experimental and namespaced (§2, §3.2, §5).
- Defines queued-edit transfer separately from accepted-edit history: accepted
  authorship is preserved and the editor is recorded (§3.2, §5.3).
- Defines participants as a deterministic projection of visible durable event
  history, excludes queue-only actors, and removes every cross-schema foreign
  key (§3.2, §4.1).
- Makes provider activation transactional with plugin reload, owner-checked,
  generation-leased, bounded by timeout, and capable of multiplexing issuer
  ids inside one configured boundary plugin (§5.2).
- Keeps assurance on request and accepted snapshots rather than the roster;
  batched agent turns expose plural actors (§3.1, §5.5, §5.6).
- Keeps capability route authentication distinct from external actor kind and
  requires core-controlled source badges and input bounds (§3.2, §5.4, §5.7).
- Replaces optimistic footprint and performance claims with an exact Phase 1
  inventory and measured acceptance properties (§5.11, §7, §8.3).
- Defines the writable full-tree source branch, exact source-tip receipt,
  atomic artifact export, and workspace-compatible `build/bb` materialization
  (§8).
- Makes plugin ports and import rehearsal explicit cutover gates and converts
  remaining product questions into phase-bound defaults (§9, §11).

Presence remains plugin-owned with a targeted-publish core seam. Keeping all
presence behavior in core was considered and rejected because it does not own
durable authority and the required plugin seam is independently useful.
