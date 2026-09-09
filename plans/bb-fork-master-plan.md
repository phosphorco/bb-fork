# BB fork master plan

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Current implementation scope and checked results are recorded in the
[identity completion ledger](bb-identity-completion.md). This document preserves
planning requirements and historical inventory; it does not broaden the selected
closeout or claim current runtime acceptance.

## 1. Why this fork should exist

We need BB to be a dependable shared workspace for people, agents, and external
systems. A person should be able to understand who contributed, trust that a
queued message will retain its attribution, and use plugin features without
learning which repository implements them. An agent needs the same authorship
context to interpret a conversation correctly. Integrations need to contribute
as themselves without impersonating a BB user.

This is exclusively a high-trust collaborative development environment. All
collaborators have equal access to all information. Identity explains who did
what and whose preferences a workflow uses; it does not introduce private
rooms, permission tiers, or an adversarial multi-tenant product. Ordinary
upstream BB is the one-person case of the same plugin experience.

We also need to keep benefiting from upstream BB. A feature is not successful
if its maintenance burden prevents us from adopting upstream improvements.
Plugin authors should be able to build useful products for the broader BB
ecosystem and enable stronger functionality on this fork from the same source.
Future engineers should inherit understandable contracts, reproducible builds,
and evidence of why each downstream change remains necessary.

The fork therefore has three equally necessary outcomes:

1. **A coherent user experience.** Shared conversations, attribution, presence,
   integrations, and personal plugin state work together without making the
   interface slower, less accessible, or harder to understand.
2. **A portable plugin ecosystem.** Plugins use upstream capabilities wherever
   possible, discover optional enhancements explicitly, and never weaken an
   identity guarantee merely to claim compatibility.
3. **Sustainable engineering and operation.** The core delta is explainable,
   upgrades are repeatable, durable data is preserved, and the running system
   can be traced to an exact tested composition.

Multiplayer is the primary current justification for the fork. It is not a
blanket justification for every existing patch, nor an absolute ban on a narrow
runtime correction needed for reliable execution. Each change must establish
its connection to these outcomes and why a supported plugin or upstream change
cannot already deliver it.

### Status and authority

Planning revision 3, 2026-09-04. This is the governing plan for the replacement
implementation within the existing `phosphorco/bb-fork` repository. It
consolidates and supersedes the implementation recommendations in
[first principles, revision 3](bb-fork-first-principles.md) and
[the parallel execution review](bb-fork-parallel-execution.md). Those documents
remain design history and supporting technical analysis.

This document defines intended behavior and gates; it does not claim that the
replacement or any new capability already exists. The existing release and its
migration procedures remain in force until an explicitly tested cutover.
The [workspace contract](../../AGENTS.md) continues to govern source locations,
authored changes, machine roles, and promotion.

Revision 2 records Cole's decisions: equal access among trusted collaborators,
a stable default user on hosts without identity support, minimal plugin-facing
host additions, minimal session migration with compatibility in both directions,
and practical provenance rather than a complete audit archive. The perspectives
review supplies additional implementation risks; these product decisions govern
how those risks are resolved during detailed design.

Scope clarification, 2026-09-04: Prompt Stacks is completely outside this
replacement effort. Its redesign, port, and parity verification are not delivery
requirements. This exclusion does not remove or alter the current plugin.

Revision 3 establishes a shared `@phosphorco/bb-identity` package across server,
state/business logic, and UI layers. The fork exposes identity and durable
provenance primitives; feature plugins consume the shared package. Core does
not know Phosphor's sidebar, notification product, or plugin-specific workflows.

## 2. Stakeholders and the promises we make

These are stakeholder interests the design must satisfy, not a claim that each
group has approved the plan. Role owners are assigned at implementation kickoff.

| Stakeholder | What they need | What would count as failure | Evidence required |
| --- | --- | --- | --- |
| People using shared BB | Clear authorship, predictable edits and queues, responsive interaction, useful presence and personal state | Wrong author, lost work, confusing duplicates, slow mobile or desktop interaction | Real multi-person workflows, lifecycle tests, accessibility and latency checks |
| People using ordinary upstream BB | Plugins that remain useful without this fork | Installation failure or a fork dependency for unrelated features | The same released plugin artifact loads and exercises its baseline features on the declared upstream version |
| Plugin authors | Small documented contracts, honest capability detection, stable identity keys, useful test fixtures | Private imports, version-string guessing, separate permanent implementations, silent authority downgrade | Portability matrix, examples, compilation and runtime tests on both hosts |
| Future fork engineers | Discoverable ownership, reproducible source, local debugging, bounded upgrade work | Hand-edited generated patches, unexplained seams, clean merges hiding semantic regressions | Source/receipt verification, seam manifests, second-revision rebase rehearsal, onboarding walkthrough |
| Upstream BB maintainers | Independent, narrowly scoped proposals with ordinary single-user behavior | A request to adopt Phosphor-specific product policy or schema | Self-contained proposals and tests with a no-extension default |
| Operators and on-call engineers | Safe staging, observable failures, known data ownership, clear recovery limits | Candidate side effects in production, unknown running revision, irrecoverable state loss | Isolated import rehearsal, deployment receipt, failure diagnostics, cutover and recovery runbooks |
| Identity and external integration authors | Provider-neutral verification and external attribution without impersonation | Credentials leaking to unrelated resolvers, colliding actor keys, external names treated as verified users | Boundary tests, namespace tests, lifecycle tests, concrete Agent Connect and Slack ports |
| Agents and tool consumers | Accurate speaker context and durable provenance across delayed execution | The model sees one author for a mixed batch, or a tool substitutes the current operator | Actual provider-input and tool-context assertions across send, queue, retry, and resume |
| Product and project stewards | Visible scope, explicit tradeoffs, measurable progress | Rebuilding optional infrastructure while the shared workflow remains unusable | End-to-end milestones, feature disposition ledger, owner and decision records |

When interests conflict, preserve authority and durable facts first; preserve
the required user workflow next; then choose the least costly integration to
maintain. Convenience and fewer changed lines cannot justify false attribution.
Conversely, speculative generality cannot justify delaying a working product.

## 3. Product outcomes and boundaries

### 3.1 Essential workflows

- Two authenticated people contribute to one thread. Each sees who wrote and
  edited each contribution, and the agent receives corresponding speaker
  context. A rename does not change the stored historical identity.
- Several queued contributions dispatch together. Each retains its own author
  and editor through restart, waiting, retry, and provider delivery.
- An Agent Connect nickname or Slack user contributes as an external author.
  Their source is visible; their name alone does not select a collaborator's
  identity or preference record.
- A plugin serves a person's request and can perform an explicitly authorized
  operation on that person's behalf. Work that continues independently after
  the request cannot inherit their identity accidentally.
- A person uses notifications, progress, and other personal plugin features
  across clients. On the fork, the current collaborator selects their state;
  without identity support, a stable default user selects the same feature's
  state. Pending edits cannot accidentally move between these owners.
- Presence helps people coordinate without background polling or unrelated
  clients receiving every thread's presence traffic.
- Upstream-only users can install portable plugins and understand which
  enhancements their host supports. Missing optional capability does not break
  unrelated plugin functionality.

### 3.2 Scope limits

The first replacement does not introduce a general cross-plugin query engine,
a plugin sandbox, a new collaboration editor, or a second authentication
product. Installed backend plugins remain trusted code. All admitted
collaborators have equal information access; private threads, resource permission
tiers, and tenant isolation are outside scope. Preserve existing ingress and
external credential checks. Subscription targeting serves efficiency and
relevance, not information secrecy among collaborators.

Personal state is an organizational convention, not confidential storage from
other collaborators. Explicit actions may target another person's state when a
workflow calls for it, while recording the acting person separately. Accidental
owner changes caused by identity resolution or delayed writes remain bugs.

Claimed remote names are not a second core identity mode. Where anonymous
participation is required, use a provider that establishes an anonymous subject
or a plugin-owned external author, according to the workflow. Do not silently
merge that identity with a verified principal.

Preserve upstream's supported editing and provider lifecycle restrictions unless
a separate product requirement justifies expanding them. In particular, the
first target rejects editing grouped messages; the redesign does not add that
feature incidentally.

Existing features are not automatically retired by moving their names into a
plugin column. Every enabled production feature receives a disposition:
preserved by upstream, preserved by a plugin, temporarily retained in core,
deferred with a stated user impact, or intentionally retired. Required workflow
loss needs a product decision before cutover.

Prompt Stacks is explicitly excluded by Cole. Do not add its catalogs,
sequencing, composer integration, or host routes to replacement work or use
its requirements to justify a new core capability. The
[existing plugin/fork catalog](bb-fork-plugin-catalog.md) records current
connections for further scope decisions; inclusion there is not a commitment
to port the corresponding feature.

## 4. Architecture rules

### 4.1 Choose ownership by the invariant

Use an existing upstream capability first. Add a plugin when the plugin can own
the behavior correctly. Add a narrow core seam only when the host must own
authority, durable acceptance, a process boundary, or an essential native
interaction that no supported extension can express. Propose that seam upstream
when its contract makes sense independently of Phosphor.

The fork must not depend on `@phosphorco/bb-identity` or named product plugins.
The shared package adapts to the host contract, not the other way around. No
core route, event, schema, or acceptance rule may embed custom sidebar sections,
progress phases, notification kinds, or prompt-stack concepts. A feature plugin
may motivate a generic capability, but its product model remains outside core.
For example, expose accepted contributions and their participants; notification
plugins decide whether those facts warrant delivery. Expose ordinary thread
reads/actions; sidebar plugins decide how to organize and render those threads.

| Responsibility | Intended owner | Reason |
| --- | --- | --- |
| Establish request identity and enforce acceptance provenance | Core, with verification delegated to an identity provider plugin | Every producer must cross the same authority boundary |
| Store authors and editors with accepted work | Core | Attribution must commit atomically with the work |
| Convey attribution to provider input and tool context | Core execution path | Delayed and remote execution must use durable facts |
| Verify Tailscale, gateway, or other identity evidence | Boundary plugin | Issuer-specific policy should not be embedded in BB |
| External credential verification and subject mapping | Owning integration plugin | Agent Connect and Slack understand their own external systems |
| External namespace and source attribution | Core | A producer cannot select another plugin or a BB principal |
| Identity adapters, view-as primitives, and identity-scoped synchronization | Shared `@phosphorco/bb-identity` package in the plugins repository | One consistent contract and fallback behavior for every consumer |
| Personal workflow state, notifications, and progress | Feature plugins using the shared package | These are independently evolving product features |
| Actor rendering and participant presentation | Native components or supported host slots, with minimal core support until available | Essential attribution must survive plugin UI failure |
| Presence and typing behavior | Plugin over a narrow subscription/delivery seam | Ephemeral coordination does not own durable authorship |
| Fork migration, import, and release tooling | Fork repository | Operators need one reproducible composition and recovery story |

### 4.2 Treat maintenance rules as evidence requirements

Put implementation in fork-owned modules and minimize edits to upstream files.
Prefer new fork-specific tests and stories. Keep upstream migration sources and
table definitions untouched by default. A necessary exception requires a
documented reason, smaller alternatives considered, and corresponding tests;
none of these preferences can force an incorrect transaction or user experience.

File count, changed lines, and generated diff size are diagnostics. They do not
measure semantic independence. Each seam records its invariant, owner, callers,
transaction boundary, read paths, failure behavior, compatibility contract,
tests, and deletion condition. Review this inventory at every upstream change.

## 5. Identity and durable attribution

### 5.1 Identity is distinct from presentation and execution origin

A principal has a stable issuer/subject identity. An external author has a
stable plugin/subject identity. A core-owned codec produces bounded, tagged,
delimiter-safe keys whose namespaces cannot collide. Consumers compare opaque
keys; parsing and serialization belong to one implementation.

Display name, handle, and avatar are mutable presentation. Acceptance stores a
bounded snapshot as well as the stable key. Authentication assurance belongs to
the request and its historical snapshot, never to a mutable roster entry.
Historical assurance cannot authorize a new operation.

Agent, system, and unknown historical origins remain distinguishable using
durable origin fields. Absence of a person must never cause a fallback to the
operator for background work or unknown history. For ordinary user operations
on a host without identity support, use the stable default-user adapter defined
in section 6; this is intentional single-user behavior, not recovered historical
authorship. Internally use explicit acceptance variants for direct human,
external, queued/retry, and agent/system work. Public clients cannot choose
arbitrary trusted variants or submit a principal key as authority.

Local operator and local tool identity are deployment policies, not identities
proven by a browser surface header. The first implementation inventories CLI,
desktop, browser, SDK, plugin, and agent transports. It must distinguish trusted
local tool submission from plugin background execution without classifying both
as the human operator. New operations without applicable person context use a stable machine actor and
continue. Unknown historical authors remain unknown; neither becomes the operator.

### 5.2 Resolve once at the correct boundary

Classify route authentication before invoking a provider. Core and applicable
session/local plugin requests receive a captured server-resolved actor.
Independently authenticated capability/token routes and unauthenticated routes
do not feed their credentials to the identity resolver or acquire an ambient
human actor. Their allowed operations remain constrained by route policy.

Pass actor context explicitly; do not use an async-local or process-global
current actor. Request-bound plugin actions capture a private immutable actor
and expire on settlement, abort, or invalidation of the owning plugin generation.
Capture attribution durably at acceptance. Carry initiating-person context through
agent and background work where applicable, separately from execution origin.
Ordinary work requires no new delegation grant; missing context uses machine attribution.

One configured boundary plugin may verify multiple issuers. Candidate provider
registration commits with the plugin generation; failed reload preserves the
active provider. Requests observe a complete generation, resolver work has a
bounded deadline, and provider-bound sockets reauthenticate after replacement.
Reject, malformed output, and timeout discard unusable person evidence. Core
continues with applicable carried attribution or a stable machine actor, including
proxied and loopback traffic. Independent route access checks remain unchanged.

### 5.3 Define the facts at each lifecycle step

| Operation | Required behavior |
| --- | --- |
| Direct accepted input | Record the captured author and snapshot atomically with the request event |
| Queue insert | Record the draft creator and snapshot with the queued row |
| Queue content edit | Preserve creator; record the latest editor separately in the same transaction |
| Queue reordering, grouping, or scheduling | Preserve authorship; changing delivery does not author the text |
| Mixed queue dispatch | Copy author/editor entries in input-group order; commit event, derived participants, and queue/sidecar removal atomically |
| Retry | Copy the durable source attribution; never resolve a new author |
| Supported accepted-message edit | Preserve original author, record latest editor, and rebuild affected derived state with the history rewrite |
| Interaction resolution | Persist the resolver in resolution data and the durable lifecycle event |
| Thread fork or truncation | Preserve retained actor snapshots and rebuild participants from resulting visible history |
| Plugin/agent background send | Use explicit non-human origin or the external-author API; never inherit the request that started the service |

Queue creator plus latest editor is the default chosen by this plan, superseding
revision 3's transfer-of-authorship rule. It preserves both useful facts without
requiring a complete edit ledger. This plan promises provenance of the current
visible contribution, not an immutable audit archive of every deleted revision.
If a full historical audit is required, scope its retention model explicitly.

### 5.4 One stored attribution, three consumers

The human transcript, the provider prompt, and agent tools consume the same
durable attribution. Provider formatting uses accepted snapshots, labels each
group, preserves attachment-only input, identifies external sources, and avoids
double annotation on retry or resume. Keep original stored content separate from
generated speaker formatting. Never infer authority by parsing a text prefix.

Find the last common execution point that retains group boundaries. If the host
daemon needs structured actors, extend that command contract explicitly and
include it in the seam inventory. Verify actual provider inputs for initial
send, steering, queue batches, retry, and resume.

The UI may render a current profile with historical snapshot fallback. Current
profile lookup must not change recorded authorship or replayed provider input.
Mandatory external-source labels remain distinct from names and avatars. Tools
receive plural actors/editors for batched input and cannot substitute a current
request actor when historical attribution is absent.

## 6. Plugin portability is a first-class contract

### 6.1 One source, explicit host capabilities

Write feature logic against the public upstream SDK and the shared
`@phosphorco/bb-identity` package. Centralize identity-related fork integration in
that package instead of creating a separate adapter in every feature plugin.
Prefer one plugin artifact that works on both declared hosts; avoid permanent
upstream and fork editions of the plugin.

The adapter detects the exact capability and supported contract version, not a
host name, deployment URL, or a guess based on an upstream version number. Use
optional namespaced API members and a small version descriptor where semantics
require it; do not build a general capability marketplace to solve this problem.
Detection describes availability, not the current request's authorization.

Fork APIs retain the required `experimental_` prefix and `p6r` namespace and
are recorded in the API audit inventory. Experimental APIs still document
semantics, lifetime, error modes, version, and removal/migration behavior.

Do not import fork-only runtime exports at module initialization: a subsequent
feature check cannot repair an import that fails before the factory loads.
Keep compatibility types and guards in the adapter, compile baseline code
against unmodified upstream SDK declarations, and check the adapter against the
generated fork declarations. No private BB paths, hidden local dependencies,
or edited generated type files are part of the portable contract.

#### Shared package across layers

The [declaration-only package draft](../../plugins/packages/bb-identity/README.md)
defines the proposed model, public BB binding, host, server, state, client, React
and testing entry points. Draft 3 incorporates five layer reviews and two focused
consumer/IdP feasibility reviews, with
[complete public consumer paths](../../plugins/packages/bb-identity/CONSUMERS.md), a
[review disposition](../../plugins/packages/bb-identity/REVIEW.md) and
[library packaging contract](../../plugins/packages/bb-identity/PACKAGING.md).
It is review input, not an implemented or published package. Upstream provides
ordinary submission semantics; enhanced transactional acceptance must be proved
in the fork. Shared types cannot manufacture guarantees absent from a host.

The proposed package is independently consumable by organization, community,
and future third-party plugins. Its source belongs in the existing plugins
repository (proposed `packages/bb-identity`), with workspace/build integration
through that repository's generators. It is a regular versioned dependency,
not a runtime requirement to load another feature plugin. Registry publication
is a later release step, not performed by this plan.

| Layer | Shared package responsibility | Feature plugin responsibility |
| --- | --- | --- |
| Host adapter | Capability discovery, upstream default-user behavior, fork identity/provenance access, normalized availability states | Supply its host SDK instance; no host-name tests or direct `p6r` field reads |
| Server | Resolve the actual request actor, validate an explicit selected subject, expose request-bound authored actions and durable tool provenance | Define its operations and whether an operation addresses the actor, viewed subject, or another explicit recipient |
| State/business logic | Separate actor and viewed subject; identity-scoped cache keys, revisions, pending edits, invalidation, reconnect and owner changes | Own its data schema, query logic, persistence and atomic storage adapter |
| React UI | Context, view-as switcher, override banner, profile presentation, hooks, and standard loading/error/default-user behavior | Place the primitives in supported surfaces and compose the feature's UI |
| Testing | Upstream singleton, multi-person, external-author, unavailable-provider, owner-switch and lifecycle fixtures | Verify its own workflow using the same package on both supported hosts |

Keep browser, server, and framework-neutral state entry points separate. A
server consumer must not pull in React, and a UI consumer must not bundle server
dependencies. The package provides synchronization mechanics over plugin-owned
storage, not a central database containing every feature's settings. Any shared
directory service may remain supplied by an identity provider plugin; feature
plugins see the package contract, not that provider's plugin ID or RPC shapes.

The intended UI composition follows Cole's example; exported names are design
sketches rather than implemented APIs:

```tsx
<BbIdentity.Context>
  <div className="flex gap-1">
    <BbIdentity.ViewAsSwitcher />
    {/* Feature controls */}
  </div>
  <BbIdentity.ViewAsOverrideBanner />
  {/* Feature UI consumes the same identity context */}
</BbIdentity.Context>
```

On a single-user host, actor and viewed subject are the stable default user;
the switcher and override banner render nothing. On an identity-enabled host,
they reflect the selected collaborator. The same component tree and business
logic work in both cases.

#### Actor, viewed subject, and operation target

The **actor** is who actually makes the request. The **viewed subject** is whose
perspective the UI displays. The **operation target** is the record or recipient
an action explicitly addresses. None of these may silently replace another.
For example, Cole can view Alice's thread organization; sending from that view
remains authored by Cole. If the feature supports editing Alice's organization,
the target is Alice and the recorded editor is Cole. This is compatible with
equal information access and does not introduce a permission hierarchy.

The view-as selection is UI state, not authentication. Its scope is explicit:
default to the containing feature context, with shared scopes only when a
workflow deliberately coordinates multiple surfaces. It cannot change another
tab's request actor or globally impersonate somebody. Each mutation declares
its target policy; entering view-as does not implicitly enable edits to the
selected person's state. Server helpers obtain the actor from host context
and validate the supplied target separately. A target key is data, not proof
of authorship. Reads and saves capture the expected owner/session and revision
so an old response or pending edit cannot jump to the newly viewed person.

#### Host primitives and package boundaries

Core supplies only the host-owned facts and operations: provider registration,
request identity, durable contribution/interaction provenance, bounded
participant reads where needed, attributed acceptance, external-author sends,
and the lifecycle/invalidation signals needed to consume those facts. Tool
provenance must identify the execution that caused the call, not merely the
thread's latest actor. Use supported upstream reads/events before adding a new
primitive. Profiles/directory adapters and view-as behavior belong in the
package/provider layer. Notification policy, inbox storage, delivery routes,
sidebar filters, and phase taxonomies remain in feature plugins.

Core contracts must be consumable without this package; the package is the
recommended ergonomic interface, not a second authoritative identity system.
Keep host namespaces and compatibility version checks inside its adapters.
Explicitly manage subscriptions, cache lifetimes, and disposal. Do not assume
separately bundled plugins share a React context or a module singleton. Prove
bounded request counts across multiple mounted consumers and coherent state
across plugin versions without requiring a hidden shared global instance.

Build the first small set with two real consumers: Agent Connect for external
contributions and Thread Progress for view-as and personal state. Use
Notifications to verify a third consumer fits without adding notification
concepts to core. Implement only primitives exercised by those proofs; expand
the package as future consumers establish another shared need.

### 6.2 Single-user behavior is the portable baseline

Use the shared package's adapter contract across plugins: resolve the current collaborator
when the host supports identities; otherwise resolve one stable default user
within the host's state namespace. Prefer an existing upstream user identity
when available. Otherwise use a reserved singleton key, never a browser id,
display name, or invented verified principal. The feature's storage and workflow
stay the same with one owner or many. Define how the default user's state maps
when identities are enabled or disabled; do not silently copy it to the first
person who visits or collapse several people's state into one record.

Capability absence and temporary failure are different states. A host with no
identity support runs normally as one user. An identity-enabled host with an
unresolved request or unavailable provider preserves pending intent and reports
the temporary problem; it cannot redirect that intent to the default owner.
Writes carry the expected owner and revision so stale work cannot land in a new
owner's record. Authenticated-but-empty state may initialize; unavailable state
may not. These are provenance and data-integrity rules, not new access tiers.

| Capability class | On the fork | On supported upstream BB |
| --- | --- | --- |
| Ordinary thread views, actions, settings, plugin storage | Use upstream contracts | Same baseline behavior |
| Participant decoration and presence | Enable supported enhancement | Omit enhancement; ordinary thread use remains available |
| Per-user state and preferences | Select the current collaborator's record | Use the same feature with one stable default-user record |
| Sending from a user's plugin action | Use a live request-bound authored operation | Use supported upstream send operations with ordinary single-user semantics |
| External contributions | Use structured external-author metadata | Keep the integration useful through supported send APIs, explicit source text, and plugin-owned provenance where needed; do not present that text as verified host identity |
| An inherently host-specific identity provider | Activate against its supported identity boundary | Report the missing requirement clearly; unrelated portable plugins continue to load |

Progress tracking, thread organization, and notifications are portable product
features by default. Participant-aware presentation or delivery
adds multiple people to those workflows; it must not gate the ordinary workflow.
An identity-provider adapter is one genuinely host-specific component because
its purpose is to supply that optional boundary, not to own a general feature.

Structured native attribution can be richer on the fork than upstream. Document
that difference without disabling an entire integration. Validate source text
through retry/resume to avoid duplicated annotations, and never parse it as
authority. If a required workflow cannot be expressed through supported upstream
APIs, identify the precise missing operation before proposing a core addition.

Missing optional support should produce quiet, understandable UI at the relevant
action. Configuration or support details belong in plugin settings/status.
Capability failure must not lead to endless retries, partial writes, or silent
switching between collaborator and default-user state.

### 6.3 Keep product logic in plugins

Progress models, thread organization, and notification preferences belong in
plugins. Existing custom host routes are implementation dependencies to remove or justify, not
proof that these features need the fork. Prefer upstream storage, send/queue
APIs, and named UI surfaces. Prove the required in-scope workflows, interruption,
duplicate prevention, and usable navigation before proposing a small host
extension. Keep any such extension independent of the feature's domain model
and identity support wherever possible. Prompt Stacks is outside this work.

Thread Manager's bulk execution APIs and shared worker/runtime corrections are
separate host-capability decisions; they are not identity-package features or
automatic requirements for the replacement. Any retained capability must have
a generic host contract, with the feature-specific controls kept in its plugin.

### 6.4 Prove portability with real plugins

Use Agent Connect as the external producer and a state owner such as Thread
Progress as the first acceptance consumers. Exercise Rosetta Slack before
production cutover. Validate initial load, ordinary behavior, enhancement use,
missing support, unknown capability version, reload, and disposal.
Include a complete default-user workflow, two-client synchronization, an
identity change with unsaved edits, and deliberate default-user state mapping
when enabling or disabling identities.

The release matrix includes the declared upstream baseline and candidate fork,
plus absent/incompatible capability fixtures. Test the same packaged artifact,
not just two separately compiling source trees. Verify install metadata and
engine ranges as well as runtime behavior. Do not synchronize portable plugin
types from a dirty running fork and call that upstream compatibility.

When upstream gains an equivalent capability, move the adapter to it after
semantic equivalence tests. Deprecate the fork member with an explicit consumer
transition, then remove the seam. A similar method name is not equivalence.

## 7. A native user experience

Users should encounter one BB experience. Reuse host Markdown, thread chat,
composer, navigation, and supported actions before composing equivalents from
primitives. Plugins own surrounding workflows and data; core retains essential
attribution and the lifecycle of native interactions.

Use the named surfaces in the plugin repository contract: Conversation timeline,
Composer, Thread header action, Thread list, Plugin panel tab, and Plugin
settings insertion. Prefer additive contributions. A replacement region must
preserve its documented native fallback, keyboard, focus, and navigation
behavior. Copying internal DOM or CSS is not a portability strategy.

Author and editor labels must remain legible with long names, narrow split
panes, mobile viewports, text zoom, and keyboard/screen-reader use. External
origin cannot be communicated by color alone. Use semantic theme tokens and
verify light, dark, and a materially different palette. Cover loading, missing
profile, disconnected, and error states as well as success.

Do not require people to understand principal codecs, capability versions, or
database placement to send a message. Explain actions and their consequences
in user terms. Moving a feature from core to a plugin is acceptable only when
its required experience and failure behavior are accounted for.

## 8. Data model, migrations, and performance

### 8.1 Storage ownership

| Data | Intended representation | Consistency requirement |
| --- | --- | --- |
| Accepted authors/editors | Namespaced arrays in existing request-event JSON | One entry per input group; validate alignment before persistence and in domain schemas |
| Queued creator/editor | Fork sidecar keyed by upstream queue id | Same SQLite transaction as queue insert, content edit, and consumption |
| Interaction resolver | Namespaced resolution JSON and lifecycle-event field | Survives projection and plugin event delivery |
| Principal and external presentation | Fork-owned registry rows with revisioned reads | Stable identity, mutable presentation, bounded snapshots |
| Participants | Fork-owned index of visible durable contributions | Deterministic rebuild after history rewrites; excludes queue-only drafts |
| Presence/typing | Plugin memory derived from authenticated subscriptions | Ephemeral, bounded delivery and cleanup |
| Feature-specific personal state | Owning plugin's KV or SQLite storage | Explicit collaborator/default owner selection and key mapping at migration |

New writes require explicit attribution, including explicit non-human absence.
Optional wire fields exist for legacy reads, not as a way for new producers to
skip provenance. Preserve unknown historical facts as unknown.

The upstream-readable thread representation remains authoritative for content
and ordinary execution. Fork metadata must be additive and must not require a
fork-only event type or content encoding for ordinary threads to remain useful.
Choose its precise storage against the compatibility proof in section 10.1;
optional fields alone do not prove that upstream preserves them when rewriting
events. Plugin state may physically live in host KV or plugin SQLite: inventory
both, and apply the same owner mapping to import and runtime legacy fallbacks.

### 8.2 Independent fork migrations

Use a fork-owned migration journal with ordered, hashed, append-only migrations.
Bootstrap the journal, then apply ordinary DDL transactionally on the same
SQLite connection used by upstream. Initialize after upstream migrations and
before services or plugins start. Changed hashes, unsupported versions, missing
steps, or errors fail startup with a useful diagnostic.

Do not modify the upstream Drizzle journal or generated snapshots in the
replacement. Avoid foreign keys from fork tables to upstream tables by default;
centralize explicit cleanup and idempotent orphan sweeps. Reads exclude detached
rows using existing upstream identities. Include deletion, soft-deletion, and
orphan behavior in the storage tests.

Independent journals remove numbering collisions, not semantic dependencies.
Every upstream rebase still verifies ids, event shape, transaction APIs, and
table-rebuild behavior. Prepared statements are an implementation choice, not
an unmeasured performance claim.

### 8.3 Measured budgets

Retain these acceptance properties: no extra actor database query per timeline
message, one batched participant query per thread-list page, no per-row roster
query, and no profile write on an unchanged ordinary authenticated read.

Before expanding beyond the first workflow, record workloads and numeric budgets
for direct send, mixed queue drain, queue list, maximum thread-list page, long
thread edit, roster bootstrap/invalidation, and reconnect. Include p50/p95
latency, payload bytes, write counts, writer-lock duration, memory, and fan-out
where relevant. Capture comparable current and unmodified-target baselines;
record hardware, data volume, and measurement method.

A complete revisioned roster is the initial simple choice if measured size and
latency fit the budget. Include externally generated identities in that test.
Do not assume a fixed actor-count threshold establishes scalability. Likewise,
benchmark participant rebuilds inside write transactions before deciding that
incremental maintenance is necessary. Optimize the demonstrated bottleneck.

## 9. Repository and maintenance model

### 9.1 Augment the existing repository

Keep `phosphorco/bb-fork` as the fork repository. Preserve the current release
track while implementing the replacement from an exact upstream baseline.
Use a candidate overlay branch such as `redesign/identity-first` and full-tree
source branches such as `source/identity-first/desktop-v0.41.0` in the same
remote. Names are illustrative; no branch is created by this document.

The full-tree source commits are the editing authority. An overlay commit
records exact upstream and source-tip commits, generated ordered patches,
hashes/manifests, and the result tree. The workspace commit records the tested
fork and plugin composition. Humans do not maintain source and exported patches
as independent implementations.

Cole's next implementation direction is latest BB core. The completed Draft 3
reviews use upstream main snapshot `44cc2292dff443bb626866171708801a904bf45a`
(SDK 0.4.47). The earlier `desktop-v0.41.0` / `ee4a5777bf1efb255a87cd9dc91fd3ae92830268`
target is historical evidence, not the next implementation default. Before
kickoff, resolve latest upstream again, assess its delta from the review snapshot,
refresh the seam inventory and select one exact pin shared by all tracks.
Close the [package/core contract gates](../../plugins/packages/bb-identity/REVIEW.md#minimum-contract-closure)
before freezing independent implementation assignments. These reviews have not
moved the upstream working checkout, runtime, or workspace gitlinks.

### 9.2 Minimum useful tooling, then demonstrated improvements

Build on the existing materializer and verifier. First implement source-tip
locking, deterministic export, replay/tree equivalence, and footprint reporting.
Stage exports and validate the whole artifact set before publishing a receipt.
Several sequential file renames are not an atomic multi-file release.

Protect referenced source commits with durable remote refs so a later rebase
cannot make an old receipt unrecoverable. Verify source availability and replay
from the receipt in CI. Branch-family CI must distinguish source trees from
overlay trees rather than expecting the same files on both.

Keep logical commits aligned with invariants and reviewable dependency order.
Use rebase, rerere, and range-diff as tools; they do not replace behavior review.
For each release, verify the expected upstream ref and exact commit, inspect
changed integration points, retire satisfied seams, replay and test, exercise
staging, then publish the source and overlay receipt.

The second-upstream-revision rehearsal measures manual conflict work, semantic
changes, elapsed effort, and remaining seams. Establish the sustainable release
cadence from this evidence rather than promising an arbitrary upgrade interval.

### 9.3 Engineer-facing deliverables

A new maintainer must be able to reproduce a receipt, locate an integration's
contract and tests, make a source change, regenerate artifacts, and explain
promotion without relying on a previous engineer's chat history. Supply a short
walkthrough and run it during handoff.

Each release retains the seam inventory, consumer compatibility matrix, feature
dispositions, migration evidence, performance results, and source/workspace
receipts. Diagnostics should identify the failing contract and release without
logging credentials or full conversation payloads. Prefer focused checks and
existing logging over a new observability subsystem.

## 10. Parallel development and data cutover

### 10.1 Authored sessions remain compatible in both directions

Minimize migration work and preserve upstream session formats and native
provider references wherever possible. Compatibility includes existing sessions
opening in the fork and fork-authored sessions being interpretable and usable in
non-forked BB. Loss of enhanced presentation is different from loss of content,
attachments, execution continuity, or provenance data. Record each separately;
do not assume hidden metadata survives an upstream edit or rewrite.

In stages 2–3, define the supported BB and provider versions and test upstream
→ fork → upstream → fork with actual thread reads, continued conversation,
supported edits, checkpoints/forks, and attachment access. Include history with
mixed authors and new ordinary upstream contributions. Returning upstream may
show a generic user label; returning to the fork must not fabricate authors for
new upstream contributions or silently discard known historical provenance.
Use the portable default identity only where the source ownership is known.

Test native provider state as well as BB records: the selected Codex baseline
resumes by provider thread id. Preserve usable native sessions by default;
avoid replaying history or reconstructing sessions merely to update attribution
labels. Test missing native state and report the resulting limitation explicitly.
The matrix must distinguish fork-caused limitations from ordinary differences
between upstream/provider versions; it does not promise arbitrary version
downgrades or simultaneous access to one live database by two runtimes.

If a material incompatibility prevents non-forked BB interpreting or continuing
fork-authored threads, bring Cole the concrete failure and alternatives before
committing to that architecture. Session compatibility is a product requirement,
not a synonym for a lossless reversal of every database and plugin-state change.

### 10.2 Candidate placement and minimal migration

Cole selected a temporary same-machine proof on 2026-09-05. Rosetta continues
running the current tested composition from `fork/build/bb`; the candidate is
developed and exercised in the visible `fork/build/proof-bb` worktree with
isolated state and ports 39886/39887/39888. See the normative
[local proof target](bb-fork-local-proof.md) for paths, configuration, ownership
and acceptance criteria. Plugin sources remain in their canonical child
repositories. Do not switch, clean, hide, or overwrite authored work to establish
the candidate.

This is the user-authorized temporary topology exception for proof. It removes
`bb-machine` access and reconciliation of the retained dirty worktrees as
prerequisites to isolated candidate development. Eventual promotion to the normal
runtime still requires source reconciliation, tested receipts and the existing
machine-role handoff. Same-machine proof does not establish host failover or
production cutover readiness.

Begin with empty isolated state and no production producers. Compatibility and
migration discovery run alongside the first complete attribution workflow.
Choose the least transformation that preserves required state and session
compatibility. Compare a compatible upgrade of copied state against a versioned
logical import; existing fork migration receipts may still make clean-target
import necessary, but it is no longer the architectural default. Record evidence
for the choice before broad porting. Both paths have the same preservation and
interruption/restart obligations, and neither rewrites provider history by default.

The inventory covers projects, environments, threads, events, queue/wait state,
interactions, identity registries and key mappings, required plugin state,
settings, provider-session references, attachments/thread storage, and
machine/runtime associations. Distinguish durable records from live process
leases, active execution, and pending external deliveries. Each gets a preserve,
transform, reconcile, resume, or retire rule. Copying database rows alone does
not prove that a thread can resume.

Run schema initialization and migration/import through an offline entrypoint.
Rehearsal copies cannot start schedulers, drain production queues, send Slack messages, or
make other production side effects. Keep source snapshots immutable. Never
invent an actor or identity-owner mapping to make counts match.

Validation includes integrity and foreign-key checks, per-domain ids/counts,
canonical preservation/transformation hashes, array alignment, queue sidecar
coverage, participant rebuild equality, owner mappings, and application-level
resume/send/edit/fork checks in selected test workflows. Rehearse interruption,
restart/idempotence, elapsed time, disk/WAL use, and the final quiescence window.

At cutover, stop all writers, take consistent source snapshots, migrate and
validate, exercise the required plugins, and only then open production writers.
Snapshot rollback is lossless only before reopening. After new writes begin,
forward repair is the default; lossless return to the old system would require
a separately implemented and rehearsed reverse export. The operator and product
owner record this constraint before the maintenance window.

## 11. Delivery stages and exit evidence

Stages describe work dependencies, not a requirement to launch multiple agents.
Assign accountable role owners at kickoff. Current-release maintenance and
receipt reconciliation can proceed independently of candidate development.

| Stage | Deliverable | Exit evidence | Accountable role |
| --- | --- | --- | --- |
| 0. Scope and placement | Confirmed baseline and staging; producer/consumer inventory; feature dispositions and decision register | Old runtime remains available; candidate location and required workflows are explicit | Fork lead, operator, product owner |
| 1. Reproducible baseline | Empty-state upstream build plus minimal source/export/receipt tooling | Reproduce the exact candidate tree from pushed inputs; relevant upstream checks pass | Fork maintainer |
| 2. Complete attribution slice | Two people and one Agent Connect author through send, mixed queue, restart, model input, and timeline; initial session compatibility fixture | Actual provider input, durable records, and UI agree; background work distinguishes carried initiating-person context from execution origin; ordinary thread content remains upstream-readable | Core and integration engineers |
| 3. Early compatibility and portability, alongside stage 2 | Representative thread, queued item, personal plugin record, and native session; shared identity package across server/state/UI with default-user and collaborator adapters; minimal migration choice | Upstream/fork session round trip and owner mappings validate; Agent Connect and Thread Progress use one package on both hosts; Notifications fits without feature concepts in core; precise host gaps identified | Data and plugin engineers |
| 4. Durability completion | Supported edits, forks, retries, interactions, reload boundaries, participant maintenance | Producer matrix and failure tests pass; no unattributed-new-human-write escape | Core engineer, reviewer |
| 5. Product completion | Required plugin ports, presence, rendering, accessibility, explicit remaining parity choices | End-user scenarios pass on desktop/mobile and supported host variants | Plugin/UI engineers, product owner |
| 6. Release rehearsal | Production-sized isolated migration/import, performance report, second upstream rebase, maintainer walkthrough | Data, session compatibility, portability, latency, maintenance, and recovery requirements all pass | Fork lead and operator |
| 7. Cutover and promotion | Pushed source and child commits; tested workspace receipt; normal-host pin | Exact selected composition running; post-open probes and recovery decision recorded | Release operator |

Stages 2 and 3 should resolve the largest uncertainties before broad feature
porting. Do not finish an elaborate reporting system before proving the first
shared conversation. Conversely, do not describe an unrepeatable prototype as
ready for deployment.

Run verification appropriate to every changed child and follow its repository
contract. Fork work uses its verify/materialize scripts and the target BB
install, typecheck, tests, and build. Organization and community plugin work
uses their respective dependency, generation, typecheck, test, and build gates.
Promotion requires all selected child commits pushed first, combined staging
behavior exercised, then the workspace receipt and normal-host pin advanced.

## 12. Risks and decisions that remain visible

| Issue | Working decision | Evidence or decision due |
| --- | --- | --- |
| Upstream changes acceptance or queue semantics | Keep per-group durable provenance; adapt integration rather than blindly preserve hunks | Every rebase; full lifecycle tests |
| Local transport cannot distinguish tool and background origin safely | Use trusted explicit origin paths; no surface-header authorization | Stage 2 concrete SDK/background test |
| Plugin capability gaps prevent portability | Default to one user without identity support; preserve the ordinary workflow; prove any remaining narrow host gap | Stage 3 same-artifact workflow test |
| Shared identity package becomes another feature platform | Keep actor/viewed subject/target primitives and adapters common; storage schemas and product policy stay with plugins | Stage 3 multi-consumer proof; review each new primitive |
| View-as accidentally changes authorship or pending-write destination | Resolve actor on the server; select operation target explicitly; retain expected owner and revision | Stage 3 actor/subject transition tests on upstream and fork |
| Feature removal disguised as plugin migration | Track exact workflow parity and user impact | Stage 0 inventory, resolved by stage 5 |
| Queue edits versus historical audit | Preserve creator/latest editor; complete edit audit is outside current scope | Product owner records any stronger requirement before stage 4 |
| Participant rebuild or full roster is too expensive | Start simple, measure writer locks and payload budgets, optimize proven bottleneck | Stages 2–4 measurements, stage 6 final gate |
| Target baseline becomes unsuitable | Change only with a new exact pin and reviewed seam inventory | Before implementation against a different target |
| Identity scope grows into a permission product | All collaborators have equal information access; identity tracks provenance and selects preferences | Settled by Cole; preserve ingress checks and efficient subscriptions |
| Historical identities cannot map unambiguously | Preserve uncertainty and source data; do not guess ownership | Stage 3 discovery, resolved disposition before cutover |
| Fork-authored sessions fail in upstream | Preserve upstream formats and native state; raise material limitations with Cole before choosing an incompatible design | Stages 2–3 round-trip proof |
| Default-user state changes when identities are toggled | Explicit mapping; preserve pending edits and distinguish absent capability from temporary failure | Stage 3 adapter and state-transition tests |
| Recovery, palettes, or Thread Manager need more core support | Validate real consumer requirements; retain only justified narrow seams | Stage 5 product disposition |
| Provider replacement races with requests | Preserve committed generations; bound resolution and fall back to machine attribution | Stage 4 reload tests |
| Old snapshot cannot include new target writes | Forward repair after reopen unless reverse export is separately built | Stage 6 explicit cutover decision |

No entry is resolved merely because it has a default. Attach evidence and the
responsible role's decision as work progresses. Stop broadening implementation
when an assumption fails; revisit the smallest affected decision.

## 13. Definition of done

The replacement is complete when users can perform the required shared
workflows, the agent and UI agree with durable attribution, required plugins
use the shared identity package with ordinary single-user behavior upstream,
the core contains no custom sidebar or notification product concepts, and the selected production
state has been preserved and validated. Authored sessions must meet the declared
compatibility matrix in both directions, with material limitations explicitly
resolved with Cole. It must also survive a second upstream revision,
be reproducible from durable receipts, and be maintainable from repository
documentation by an engineer who did not write it.

Shipping the first working fork is not completion if the plugin ecosystem is
stranded, data ownership is ambiguous, or the next upgrade requires rediscovering
the architecture. Those are part of the product this plan delivers.

## 14. Supporting evidence and prior work

- [First-principles plan, revision 3](bb-fork-first-principles.md): identity,
  SQLite, provider lifecycle, contention, and earlier review corrections.
- [Parallel execution review](bb-fork-parallel-execution.md): source-checked
  provider-attribution gap, grouped-edit restriction, current tooling, and
  revised critical path.
- [Minimal plugin capabilities](../MINIMAL_PLUGIN_CAPABILITIES.md): background
  on request-bound authority and independent plugin state; historical API names
  and 0.40 assumptions are not the replacement contract.
- [Existing migration policy](../FORK_MIGRATIONS.md): historical receipts and
  preservation obligations for the existing fork; assess its in-place bridge
  alongside clean-target import under this plan's compatibility requirements.
- [Fork README](../README.md), [materializer](../scripts/materialize), and
  [verifier](../scripts/verify): current implementation to augment.
- [Workspace contract](../../AGENTS.md),
  [organization plugin contract](../../plugins/AGENTS.md), and
  [community plugin contract](../../community-plugins/AGENTS.md): source,
  verification, UI ownership, distribution, and promotion rules.

Some supporting documents are currently untracked authored work. Include the
selected supporting documents in a future reviewed documentation commit so a
fresh checkout can resolve these references. This planning change does not
commit or publish them.
