# bb-fork from first principles

Status: proposal, revision 2 after a four-lens review. Open to interpretation
where marked.
Scope: replace the current 51-patch overlay with a fork whose core delta is
sized to its invariants, and whose maintenance tooling makes each upstream
release a rebase rather than a replay.

This plan does not assume migration compatibility with the current Rosetta
database. Where compatibility is cheap it is noted, but nothing below is
constrained by the existing `0107`/`0108` receipts.

Target upstream: 0.41 or later. Several statements below depend on 0.41's
dispatch-queue rework and are marked as such.

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
   pending. This must cost nothing extra on the timeline read path and
   nearly nothing on the thread-list read path, because those are the two
   hottest paths in the product.
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
- Claimed identity mode, where a client with no provider self-labels. The
  loopback local operator is the only no-provider identity, and it is
  narrower than today (§5.1). Rationale in §3.4. Known consumers to remove
  or adapt: the SDK claimed-identity header in `packages/sdk` transport, the
  app's claimed-identity store and dialog, `p6r_collaborators`, and Thread
  Progress's identity-authority helper which branches on assurance.
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
   that adds two thousand lines in new files costs nothing at rebase.
3. **Never modify an upstream table definition.** Fork state lives in fork
   tables created and migrated by fork code, outside Drizzle's journal.
4. **Never modify an upstream test file, and add no comments to upstream
   files.** Fork tests live in fork-owned files with a distinct suffix.
   Explanations live in fork-owned files or commit messages.
5. **Attribution is a function of explicit inputs.** Ambient request context
   is a transport for the principal, never the authority for who authored a
   unit. The decision to stamp an actor is made from the unit's own
   properties: initiator, sender thread, retry provenance, and route.
6. **Extend upstream JSON, not upstream columns.** Where upstream already
   stores a JSON payload, an optional field there costs one schema line and
   no read-path change.
7. **Prefer an upstream slot to a core patch, and an upstream PR to a
   permanent slot patch.**
8. **Every core patch records its deletion condition.**

---

## 3. Data model

### 3.1 Vocabulary

- **Principal**: a verified identity, `(providerId, subject)`. Immutable.
  Its canonical string form is the **principal key**, opaque to consumers.
- **Actor**: the author of an accepted unit. An actor is one of:
  - `principal` — a BB principal with its presentation snapshot;
  - `external` — a plugin-namespaced author, `(pluginId, externalId)`, with
    presentation supplied by the plugin (Agent Connect nickname, Slack user);
  - absent — agent, system, or legacy origin, which upstream already
    distinguishes through `initiator` and `senderThreadId` on the request
    event.
- **Presentation**: handle, display name, image URL. Mutable for principals
  (the profile), fixed for externals at the plugin's discretion.
- **Assurance** on a request principal, one of:
  - `trusted-provider` — resolved by the registered identity provider;
  - `local-operator` — loopback request from the browser or desktop surface;
  - `local-tool` — loopback request from the CLI, SDK, or an automation
    with no surface header. Attributed and rendered, but never a durable
    settings owner and never merged with `local-operator`.
  Plugins that own durable per-person state must check assurance.

### 3.2 Where each fact lives

| Fact | Storage | Why there |
| --- | --- | --- |
| Actor(s) of a turn request | `actors` field inside the existing `client/turn/requested` event JSON, one entry per input group | Upstream already stores and ships this JSON to build the user message; no column, no read change. A drain can batch several queued rows into one event with `inputGroups`, so the actor is per group |
| Actor of a queued row | `p6r_queued_actors(queued_message_id PK, actor JSON)` sidecar | Upstream's queued table has no JSON column; sidecar avoids touching it; deleted on dispatch. In 0.41 deferral is a queued row with `sendAt` and `waitingOn`, so this sidecar also covers deferred work |
| Who resolved an interaction | `p6r_interaction_actors(interaction_id PK, actor JSON)` sidecar | Same reasoning as queued rows |
| Principal profile | `p6r_principals(key PK, provider_id, subject, handle, display_name, image_url, first_seen, last_seen)` | One row per person; mirrored in an in-memory map |
| External actor registry | `p6r_external_actors(plugin_id, external_id, handle, display_name, image_url, first_seen, last_seen, PK(plugin_id, external_id))` | Lets rosters and participant lists resolve externals without asking the plugin |
| Participants per thread | `p6r_thread_participants(thread_id, actor_key, first_seen, last_seen, PK(thread_id, actor_key))` | Written in the acceptance transaction; rebuilt on edit and fork; read as one range scan per thread-list page |
| Presence | memory only, in the presence plugin | Ephemeral by definition |

Actor keys are URI-encoded components joined with `/`:
`<providerId>/<subject>` for principals and `plugin/<pluginId>/<externalId>`
for externals. Components are percent-encoded so a subject containing `/`
cannot forge a different key, and the literal provider id `plugin` is
reserved by the resolver registry.

The plugin-visible actor shape carries `key`, `kind`, `providerId` and
`subject` (principals only), `pluginId` and `externalId` (externals only),
the presentation snapshot, and `assurance`. Plugins branch on provider id
and subject today, so those stay visible; the key is the storage and
equality handle.

Open to interpretation: whether the snapshot stored in the event JSON is the
full presentation or only the key plus handle. Storing the full snapshot
costs roughly 150 bytes per user message and gives a fallback when a
principal row is gone. Recommended: full snapshot.

### 3.3 Render current profile, fall back to snapshot

The immutable fact is the key. The presentation rendered in the timeline and
sidebar should be the current profile from the in-memory principal map, with
the stored snapshot as fallback. This is a deliberate reversal of the current
fork's snapshot-first rendering. It propagates renames, and it lets the thread
list ship keys instead of profile blobs, which keeps sidebar cache patches
byte-stable when someone changes their avatar.

If a product decision later requires snapshot-first rendering, it is a
client-side switch; the data supports both.

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

Fork tables are created by a fork-owned module at server startup using
`CREATE TABLE IF NOT EXISTS` plus an ordered statement list recorded in a
`p6r_migrations` table with statement hashes. This copies the semantics of
upstream's plugin migration helper into core `bb.db`; it does not call that
helper, which opens a separate per-plugin database file. Queries use
prepared statements on the same better-sqlite3 handle.

Foreign key policy. Core opens SQLite with `foreign_keys = ON`, so any
foreign key from a fork table to an upstream table participates in
upstream's deletes. The policy is therefore split:

- `p6r_thread_participants` declares `thread_id REFERENCES threads(id) ON
  DELETE CASCADE`. Thread deletion is the one upstream delete the fork wants
  to follow, and this matches the current facet tables.
- The queued and interaction sidecars declare no foreign key. Upstream
  deletes queued rows and interactions freely and in orders the fork does
  not control; a foreign key without an action would make those deletes
  fail. Orphans are removed by a periodic sweep and are harmless in between.
- `p6r_principals` and `p6r_external_actors` reference nothing.

Consequences:

- `packages/db/src/schema.ts`, the Drizzle journal, and the generated snapshot
  JSON are never touched by the fork. That removes roughly 28,000 lines of
  generated diff and the migration-numbering collisions that already
  happened between fork `0107`/`0108` and upstream's own `0107`.
- Upstream can add, rename, or rebuild its tables without the fork noticing,
  because fork tables reference upstream rows only by id.
- Fork migration statements are append-only and never renumbered.

Trade-off: no ORM typing for five small tables. Acceptable; the queries are
few and are faster as prepared statements.

### 4.2 Upstream migrations

The fork carries zero upstream migration changes. The only upstream schema
the fork depends on semantically is the `data` JSON column on `events` and
the primary keys of queued messages and pending interactions. The deferred
table no longer exists on 0.41; its legacy copy is ignored.

### 4.3 Bootstrapping a new install from Rosetta

Because compatibility is not required, the cutover is an export and import:

1. Stop writers; take a consistent backup.
2. Run upstream's migrations to the target release on the copy.
3. Run a one-off importer that reads the historical `p6r_actor_*` columns,
   `p6r_actors`, and the facet participant relations, and writes the new
   `actors` field into each `client/turn/requested` event JSON, plus the new
   `p6r_principals` and `p6r_thread_participants` rows. At the observed
   scale, roughly 57,000 request events and about a thousand participant
   rows, this is seconds of work.
4. Drop the historical columns and tables.
5. Verify counts: distinct principals, attributed request events, participant
   relations, all equal before and after.

The importer is throwaway code and is not part of the fork. It runs once.

---

## 5. Core seams

Each seam lists the upstream files it touches, its size, and its deletion
condition. Sizes are estimates for the patch body excluding fork-owned new
files and fork-owned tests.

### 5.1 Request principal (authority)

- One Hono middleware, registered once in `server.ts` on `/api/v1/*` only,
  that calls the registered resolver and stores the result in a request
  context slot and an `AsyncLocalStorage` store. The store is a transport
  for the value; see §5.3 for the rules that keep it from being authority.
- Route auth is decided before the resolver runs. Only local and core
  routes resolve. Plugin routes with `token`, `external`, or `none` auth run
  with an explicitly empty store, so secret headers never reach the
  resolver. This is a change from today's ordering and must survive the
  plugin reload race in the plugin routes; the registry lookup and the
  resolver call happen in the same middleware invocation against the same
  plugin generation.
- Resolver throw, malformed output, or reject fails closed with 401.
  Not-applicable falls through to local identity if and only if the remote
  address is loopback, and then:
  - with the app surface header present, `local-operator`;
  - without it (CLI, SDK, automations, and the plugin SDK client, which is
    a loopback HTTP client), `local-tool`.
  This distinction exists because today everything on loopback authors as
  the human operator, including plugin-initiated sends, which contradicts
  §1.2.1. Rosetta Slack forwarding through a plain send is the concrete
  case; it must use §5.4 instead.
- If Tailscale Serve terminates on the same host, tailnet requests arrive
  from loopback at the socket level. The provider must therefore run before
  the loopback fallback, and the fallback must never rescue a provider
  rejection. Open to interpretation: whether to add a proxy marker header
  set by the fork's own ingress so loopback fallback can be disabled
  entirely on hosts with a provider.
- WebSocket handshake performs the same resolution once and binds the result
  to the socket. Agent tools never read the request store; they read the
  durable turn author (§5.5).

Touches: `server.ts` (~30 lines), plugin route registry (~10 lines).
Deletion condition: upstream ships a request-identity resolver hook.

### 5.2 Identity provider registration

- `bb.p6r.identity.register(resolver)` in the backend SDK. One provider at a
  time; a second registration replaces the first.
- Core holds a single reference. Reload swaps it and closes every
  provider-bound socket with a reconnect close code. No leases, generations,
  staging, or per-request time budget.
- The resolver receives headers and trusted remote address, returns
  `authenticated | not-applicable | reject`.

Touches: one new file; `backend-contract.ts` (~3 lines: import and property).
Deletion condition: same as 5.1.

### 5.3 Accepted authorship (durability)

The review found the earlier draft's assumption "internal dispatch has no
store" to be false. Node propagates `AsyncLocalStorage` through
`setImmediate`, timers, and promise chains, so a queue drain deferred after
a response, a plugin reload triggered by a request, or a background service
started during a request all inherit the requesting human's store. The
seam is therefore built on explicit inputs, with the store as a transport
that is consulted only under narrow conditions.

Rules:

1. **Stamp from the store only for a direct human send.** The single read of
   the store happens in the direct send path when the unit has
   `initiator: "user"`, no `senderThreadId`, no retry provenance, and the
   route is a core thread route. Every other path passes an actor
   explicitly or none.
2. **Queued rows carry their own actor.** Insert writes `p6r_queued_actors`
   from the same direct-send decision. Edit by another person replaces the
   sidecar in the same transaction. Re-queue rows produced by wait recording
   copy the sidecar from the source row. Dispatch reads the sidecar and
   ignores the store.
3. **Batched drains produce one actor per input group.** The event builder
   receives the ordered list of source rows and writes `actors[i]` aligned
   with `inputGroups[i]`. A single-group event has a one-element list.
4. **Retries copy, never re-resolve.** Upstream forces retry rows to
   `initiator: "system"`; the fork copies the actor from the original
   request event by request id so the author survives the retry.
5. **Plugin lifecycle and background work run under an explicitly empty
   store.** Deferred-after-response work, plugin install and reload, service
   start, and the async deduper are wrapped by a fork helper that clears the
   store. This is one call at each of those sites and is what makes rule 1
   safe even if a future upstream path forgets to pass an actor.
6. **Interaction resolve** writes `p6r_interaction_actors` under rule 1's
   conditions applied to the interaction route.
7. **Participants** are upserted in the same transaction as rules 1, 2, and
   6, and rebuilt from `json_extract(data, '$.actors')` on the two paths that
   rewrite history: message edit, which truncates the event suffix, and
   thread fork, which copies events wholesale.

Domain: one optional `actors` field on `turnRequestEventDataSchema`. This is
mandatory, not cosmetic: the Zod object strips unknown keys on decode, so
an undeclared field would be dropped before the projection sees it.

Touches: `services/threads/thread-events.ts` (~15 lines),
`services/threads/queued-messages.ts` (~15), `queue-waits.ts` (~5),
`packages/db/src/data/queued-thread-messages.ts` (~10),
`pending-interactions.ts` (~5), `thread-edit-message.ts` (~3),
`thread-fork-history.ts` (~3), `response-deferral.ts` and plugin lifecycle
sites (~1 line each), `packages/domain/src/thread-events.ts` (1 line).
Deletion condition: upstream stores an author on accepted units.

Tests that protect this seam, all in fork-owned files:

- drain a queued row while an unrelated human request is in flight; the
  stored actor survives;
- a plugin reload triggered by person A, whose service then sends a message,
  produces a unit with no actor;
- a batched drain of rows from A and B produces `actors` aligned with the
  input groups;
- a retry of A's failed turn keeps A;
- an edit by B of A's queued row records B;
- message edit and thread fork leave the participants table equal to a
  fresh rebuild.

### 5.4 External actors (Agent Connect, Rosetta Slack)

- A separate plugin method, `bb.p6r.threads.sendAsExternal({ threadId,
  message, mode, actor: { externalId, handle, displayName, imageUrl } })`.
  It is not an optional argument on the ordinary send; the fork's own
  capabilities document forbids that shape because it makes the authority
  boundary easy to misuse, and the review agreed.
- Core stamps `pluginId`, stores the actor as `external` in the same
  transaction as acceptance, and registers it in `p6r_external_actors`. The
  plugin cannot supply a provider id or a principal key.
- HTTP route auth mode `external`: the handler asserts it verified its own
  credential before calling send. This replaces the current `capability`
  mode. Core does not verify that credential and does not run the identity
  resolver on those routes.
- Agent Connect's nickname flow maps directly: `externalId` is the connection
  id, `handle` and `displayName` are the nickname. Rosetta Slack moves from
  plain send to `sendAsExternal` with the Slack user as `externalId`.

Touches: plugin SDK contract (~5 lines in the upstream file, the rest in the
fork contract file), plugin route registry (~5 lines), `plugin-api.ts`
(~20 lines). The exact upstream send helper on 0.41 was not located during
review; size the `plugin-api.ts` touch after reading it.
Deletion condition: upstream adds an author argument to plugin sends.

### 5.5 Request actor for plugins (state scoping)

- Plugin HTTP and RPC handler contexts gain `p6rActor` with assurance.
- Agent tool context gains `p6rTurnAuthor`, taken from the accepted unit for
  the current turn, never from the ambient request.
- The roster route (§5.6) returns assurance per principal so plugins that
  offer "view as" can refuse claimed or tool-assurance identities.

Touches: `plugin-api.ts` (~10 lines), `backend-contract.ts` (~3 lines),
fake host in a fork-owned file.
Deletion condition: upstream exposes a request principal to plugins.

### 5.6 Participants on the thread list (read path)

- Thread list builder does one batched `SELECT thread_id, actor_key FROM
  p6r_thread_participants WHERE thread_id IN (...)` and attaches
  `p6rParticipants: string[]` to each row.
- The roster (`key -> presentation + assurance`) is a separate small route
  served from the in-memory map and invalidated by a realtime signal.
- Upstream patches sidebar rows from status-changed pushes rather than
  refetching. Participant changes are emitted through that same
  thread-changed path so the array is present in the patch.

Touches: `thread-runtime-display.ts` (~20 lines), server-contract thread
response (~2 lines), SDK (~5 lines).
Deletion condition: upstream adds a participants field or a plugin row
accessory slot rich enough to render avatars.

Open to interpretation: whether this lives in core or is fetched by a plugin
and rendered through an upstream row slot. Core is recommended purely for the
extra round trip a plugin would add on every sidebar refresh.

### 5.7 Author rendering (presentation)

- Thread-view user message projection passes `actors` through from the
  request event (~5 lines).
- The user message component renders an author line from the roster, with
  snapshot fallback (~30 lines, one component). A batched message with
  several actors renders each group under its own author.
- Sidebar participant avatars: ideally through an upstream row accessory
  slot; until then one small patch in `ThreadRow.tsx`.

Deletion condition: upstream adds a message header slot and a row accessory
slot. Both are reasonable upstream proposals.

### 5.8 Presence seam

Upstream's plugin realtime publish broadcasts to every connected socket. For
presence that is both a fan-out cost and a disclosure: a plugin publishing
"A is viewing thread T" would reach clients that cannot see T. The seam
therefore includes targeted delivery:

- Hub exposes `onSubscriptionChange(listener)`, `actorForSocket(socket)`, and
  `publishToThreadSubscribers(threadId, channel, payload, { excludeSocket })`.
- Presence itself, typing, viewer rosters, and their UI live in a plugin
  using that seam, `useRealtime` on the client, and
  `experimental_setThreadRowStatus` for sidebar dots. Whether one status per
  plugin per thread is enough for the sidebar affordance is a product
  judgment; if not, the row accessory slot from §5.7 covers it.
- Fallback if upstream will not accept targeted publish: keep presence in
  core as a fork-owned module attached through the first two seam methods.

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

One file, `markdown-code-highlight.ts`, alias map plus any custom sugar-high
grammar in a fork-owned file. Propose the aliases upstream.

### 5.11 Total expected footprint

Roughly 16 upstream files, 250 to 350 changed lines, plus fork-owned new
files for the identity module, the storage module, the SDK contract, the
fake host extension, the presence plugin, and tests. Compared with today:
226 files in the spine patch alone.

---

## 6. What moves to plugins

| Feature | Current location | New home | Core dependency |
| --- | --- | --- | --- |
| Identity verification | identity-boundaries plugin | same | 5.2 |
| Presence, typing, viewer avatars | core hub, presence service, app components | new `presence` plugin | 5.8 |
| Thread phase, sidebar sections, My progress | core facets and app sidebar | thread-progress plugin owning phase in its own DB | 5.5, 5.6 |
| Execution reassignment | core, 20k lines | thread-manager plugin plus one narrow batch-apply route if atomicity requires it | none or a small route |
| Prompt stacks | core native settings and prompt box | existing prompt-stacks plugin, sending through a request-bound authored send that captures the actor at handler entry, not through ambient context | 5.5 plus a request-bound send |
| Per-person palette | core routes and roster | deferred; plugin once upstream theme surface settles | 5.5 |
| Mentions and notify | core server and db | notifications plugin consuming accepted-unit actor | 5.3, 5.5 |
| Recovery mobile | 135k lines inside the monorepo | its own repository consuming the published SDK; snapshot route becomes a plugin route with 5.5 | 5.5 |
| Agent Connect nicknames | capability routes patch | unchanged plugin using 5.4 | 5.4 |
| Slack forwarding | plain send as local operator | `sendAsExternal` with the Slack user as external id | 5.4 |

The request-bound authored send for plugins is a small core capability:
`context.p6rThreads.send(...)` on an HTTP or RPC handler context, which
captures the request actor at handler entry and is invalidated when the
handler settles. It is the sanctioned way for a plugin to send on behalf of
the person making the request. It exists precisely so that no plugin needs
the ambient store.

---

## 7. Contention analysis

Ranked by expected rebase friction on each upstream release. Churn figures
below exclude upstream commit 8b2213625, which removed comments across the
tree and inflates raw line counts without semantic change.

### 7.1 High contention

**`packages/db/src/data/queued-thread-messages.ts` and
`services/threads/queued-messages.ts`.** The highest-churn area the fork
touches; upstream reworked dispatch in 0.41 and will keep iterating. The
fork touches insert, edit, re-queue, and dispatch. Mitigation: each touch is
a one-line call into a fork module taking row ids and actors as arguments,
so a moved call site is a one-line re-port.

**`apps/server/src/services/plugins/plugin-api.ts`.** Omitted from the
earlier draft; it is where request context, agent tool context, and the
external send land. Keep all three as calls into one fork module.

**`apps/server/src/server.ts`.** Upstream changes it every release. The fork
adds one middleware registration and one handshake call.

**`packages/plugin-sdk/src/backend-contract.ts`.** Highest raw churn of any
file the fork touches. The fork adds one import and three properties in a
single commit. Everything else is in `p6r-contract.ts`. No comments in the
upstream file.

**Thread-view user message projection and the user message component.**
Upstream restructures timeline components often. Mitigation: read `actors`
in one place in the projection and render through one fork-owned leaf
component.

### 7.2 Medium contention

**`packages/domain/src/thread-events.ts`.** One optional field. Conflicts
only if upstream reshapes the request event schema.

**Thread list builder.** The participants query is one call; the field on
the response is one line.

**`thread-edit-message.ts`, `thread-fork-history.ts`, `response-deferral.ts`,
plugin lifecycle sites.** One line each.

**Hub.** Low churn upstream. The observer and targeted publish seam is
additive.

### 7.3 Low contention

Fork-owned files: identity module, storage module, presence plugin, roster
route, SDK contract file, fake host extension, tests. Zero by construction.

### 7.4 Structural risks

- **Ambient store misuse.** The store is invisible in signatures. Enforce in
  CI: the store read function may be referenced only from the direct-send
  site; the store-clearing helper must wrap every listed lifecycle site.
- **Upstream adding its own author concept.** If upstream adds an author to
  accepted units, the fork's `actors` field and upstream's may coexist for
  one release; the importer pattern from §4.3 handles the merge.
- **Upstream removing the request event JSON.** Unlikely, since it is how
  user messages are rebuilt. The design degrades to a
  `p6r_event_actors(event_id PK, actors JSON)` table with a primary-key join
  on request events only.
- **Route-auth-before-resolver ordering.** A behavior change from today.
  The reload race in the plugin routes must be tested: a request arriving
  during reload must see one consistent generation for both the auth-mode
  lookup and the resolver decision.
- **Loopback breadth.** If the ingress terminates on the host, loopback
  fallback is reachable by anything the provider declines. The `local-tool`
  assurance and the option of disabling fallback on provider hosts bound
  that exposure.

---

## 8. Maintenance tooling

### 8.1 Repository shape

- `bb-fork` remains the overlay repository, but its canonical editing
  surface becomes a branch of the bb tree: `fork/<upstream-tag>`, one commit
  per logical patch from §5, with fork-owned files kept in dedicated
  directories so `git log -- p6r/` shows the fork's history in isolation.
- The `patches/` directory, `sha256`, `upstream.lock`, and `result-tree.lock`
  are generated from that branch by `scripts/export` and verified by
  `scripts/verify`, which replays the patches onto the pinned upstream and
  checks the tree hash equals the branch tip. Patches remain the release
  artifact and the audit surface; they stop being the thing people edit.
- Stacked Git is a good fit for editing: a patch queue stored as commits with
  push, pop, refresh, and export to format-patch. Optional; plain
  interactive rebase plus range-diff works too.

### 8.2 Rebase procedure per upstream release

1. `git fetch` upstream; pick the release tag.
2. `git rebase --onto <tag> <old-tag> fork/<old-tag>` on a new branch
   `fork/<tag>`, with `rerere` enabled.
3. `git range-diff` old branch against new; every hunk difference must be
   explained in the commit message of the patch it belongs to.
4. Run the fork's own test suite, then upstream's full suite.
5. Re-check each patch's deletion condition against the release notes. Drop
   patches whose condition is met.
6. Export, verify, bump locks, commit the overlay, tag.

Target cadence: within one week of each upstream release tag. Skipping a
release compounds; 0.40 to 0.41 changed over four thousand files.

### 8.3 Checks that run in CI

- Replay verification: patches applied onto the pinned upstream produce the
  locked tree.
- Namespace check: every exported downstream symbol, table, route, and wire
  field carries the `p6r` prefix, as today.
- Footprint check: fails if a patch touches an upstream file outside an
  allowlist, touches any `*.test.*` or `*.stories.*` file upstream owns, or
  adds a comment line to an upstream file.
- Ambient-store allowlist: the store read function is referenced only from
  the direct-send site; the store-clearing wrapper is present at each listed
  lifecycle site.
- Plugin SDK declaration refresh: generated types for the plugins repository
  are produced from the exported tree only.

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

Open to interpretation in ordering; dependencies are noted.

**Phase 0 — freeze.** Reconcile the current 0.39 queue so the running host
matches a receipt. This is a prerequisite for a safe rollback point, not for
the redesign itself.

**Phase 1 — baseline on the current release.** Branch from the latest
upstream tag with zero patches. Build, test, run in staging with plugins that
have no identity dependency. Establishes the tooling of §8 before any fork
code exists.

**Phase 2 — authority.** Seams 5.1, 5.2, 5.5 and the storage module. Identity
Boundaries plugin ported to the new registration. Negative tests: browser
cannot select a principal; token and none routes see no actor; resolver throw
is 401; loopback CLI request is `local-tool`, not `local-operator`; a
request during plugin reload sees one generation.

**Phase 3 — durability.** Seams 5.3 and 5.4. Participants table with the
edit and fork rebuild. The six tests listed under 5.3. Agent Connect and
Rosetta Slack ported to `sendAsExternal`.

**Phase 4 — presentation.** Seams 5.6 and 5.7. Roster route with assurance.
Thread-view and component patches, including multi-actor batched messages.

**Phase 5 — presence plugin.** Seam 5.8 and the plugin. Test that a viewer of
thread T is not announced to a socket not subscribed to T.

**Phase 6 — plugin ports.** Thread Progress off facets and onto roster
assurance, Notifications on the accepted-unit actor, Prompt Stacks on the
request-bound send, Thread Manager with or without the narrow batch route,
Recovery mobile to its own repository.

**Phase 7 — cutover.** Importer from §4.3 rehearsed on a Rosetta copy, then
executed once. Old columns and tables dropped.

Phases 2 through 5 each end with the footprint check passing and the manifest
recorded. Phase 6 items are independent of each other.

---

## 10. Upstream proposals worth making

Listed because each one, if accepted, deletes a seam:

1. A request-identity resolver hook with route-auth ordering (deletes 5.1,
   5.2, 5.5).
2. An optional author list on the request event data and a separate
   external-author send for plugins (deletes 5.3, 5.4).
3. A message header slot and a thread row accessory slot in the app SDK
   (deletes 5.7 and the row half of 5.6).
4. Subscription observation and targeted publish for plugins (deletes 5.8).
5. Fence language aliases in the highlighter (deletes 5.10).

None of these require upstream to adopt multiplayer as a product. They are
extension points with a single-user no-op default.

---

## 11. Open questions

- Should the roster be pushed to clients as a full snapshot on connect, or
  fetched lazily per unknown key? Full snapshot is simplest and small at
  Phosphor's scale; lazy fetch scales further.
- Does Thread Manager's batch apply need a core transaction across many
  threads, or is a plugin loop with per-thread idempotency acceptable? This
  decides whether any execution patch survives.
- Does mobile need a native app at all now that upstream ships a WebView
  shell around the PWA? If not, Recovery mobile's snapshot route has no
  consumer.
- Is snapshot-first or profile-first rendering the product's preference? The
  data supports both; the default here is profile-first.
- Should loopback fallback be disabled outright on hosts that have a
  provider, with a proxy marker from the fork's own ingress? This is the
  strongest bound on §7.4's loopback breadth but adds an ingress dependency.
- Is one thread row status per plugin enough for presence dots, or does the
  presence plugin need the row accessory slot from day one?

---

## Appendix: revision 2 changes

Adopted from the review:

- Attribution is now a function of explicit unit properties; the ambient
  store is a transport with one reader and mandatory clearing at lifecycle
  sites (§2.5, §5.3, §7.4, §8.3).
- Loopback identity split into `local-operator` and `local-tool` by surface
  header; middleware scoped to `/api/v1/*` (§3.1, §5.1).
- Deferred-payload seam removed; 0.41 models deferral as queued rows (§3.2,
  §4.2).
- Per-input-group actors for batched drains; retry and re-queue copy from the
  source unit (§3.2, §5.3).
- Foreign key policy split: cascade on participants, none on sidecars;
  migration helper described as copied semantics, not a call (§4.1).
- Participants rebuilt on message edit and thread fork (§5.3).
- Presence seam gains targeted publish with self-exclusion (§5.8).
- External sends are a separate method; key encoding and plugin-visible actor
  shape stated (§3.2, §5.4).
- Seam inventory adds the db-layer queued file, `plugin-api.ts`,
  `pending-interactions.ts`, and the lifecycle sites; churn figures exclude
  the comment-stripping commit; no comments in upstream files (§5.11, §7,
  §8.3).
- PATH patch retired pending verification against upstream 2424 (§5.9).
- Claimed-mode consumers listed and the no-provider remote behavior stated
  as 401 (§1.3, §3.4).
- Roster carries assurance for plugins that offer view-as (§5.5, §5.6).

Not adopted:

- Keeping presence in core outright. Retained as the fallback only, because
  the targeted-publish seam is small and is also a reasonable upstream
  proposal.
- A nested `runWithActor` scope at the dispatch site as the primary
  mechanism. The dispatch site now receives actors explicitly from the
  sidecar; a nested scope would reintroduce an implicit path.
