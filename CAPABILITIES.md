# Current downstream capabilities

<!-- Generated from capabilities.json by scripts/check-capability-catalog.mjs. Do not edit by hand. -->

This is the selected source delta: **11 capabilities / 72 patches**. It is not a deployment or live-test receipt.

- Reviewed upstream: `01affc197dc621cddc7343e09b1c5c10a5b9efcb`
- Reviewed result tree: `5afd72027e5e998a9da2ef819e407b7d30cfaa0b`

The checker enforces explicit source coverage and review freshness. Each capability digest binds its primary patches and all selected patches touching the same source files, requiring shared-source dependency review. Human review establishes whether explanations and state/API identities are semantically complete. Historical notes remain in [DOWNSTREAM.md](DOWNSTREAM.md).

| Capability | Motivation | Patches |
| --- | --- | --- |
| [Know who is participating without blocking ordinary work](#shared-identity) | Phosphor shares one trusted BB deployment and provider accounts. Native clients and integrations need durable, honest authorship and discoverable people without turning an identity lookup outage into an application outage. | 8 |
| [Let plugins organize shared threads and change execution deliberately](#thread-views-execution) | Shared thread navigation needs authoritative filters, participant summaries and execution state. Plugins should provide organization/layout data while core retains native rendering and validates effects. | 7 |
| [Accept, queue, edit and retry messages without losing their original meaning](#message-acceptance-delivery) | A slow, restarted or ambiguous operation must not silently change what the user accepted, duplicate a one-use effect, or erase the record needed to recover. | 8 |
| [Explain and customize the context sent to an agent](#context-prompts) | Context assembly should be inspectable and customizable at named producer boundaries, with evidence that says precisely what was constructed, accepted or consumed. | 5 |
| [Use the required shared inference route and retain native provider facts](#shared-inference-providers) | BB must use the company inference route without silently falling back to a host login. Failures and native response identity must survive the bridge so diagnostics can explain what happened. | 9 |
| [Keep diagnostics useful while masking only actual authentication secrets](#diagnostic-environment) | This is a trusted single-company deployment. Debugging needs concrete IDs, URLs, paths and ordinary environment values, while real authentication bytes must not become retained diagnostic output. | 1 |
| [Upgrade existing BB state without rewriting or guessing its history](#data-upgrades) | The fork has real historical databases and sidecar state. Refreshing upstream must preserve their exact identities/history and reject unrecognized ledgers before accepting traffic. | 6 |
| [Load plugin frontends coherently and keep plugin network policy explicit](#plugin-artifacts-transport) | A plugin UI must load one coherent generation even during rebuild/reload, and foreign-origin plugin routes must explicitly own their CORS policy without weakening core APIs. | 5 |
| [Keep realtime, long-thread reads and lifecycle waits bounded](#bounded-runtime-responsiveness) | A busy thread, stalled browser or slow startup must not create repeated wasted reads, unbounded queues or indefinite waits for every other user. | 9 |
| [Run remote and local agents with explicit network and browser prerequisites](#safe-host-desktop) | New sandbox/desktop workflows should work with scoped machine identity and native browser protections, not silently disable those protections or assume the wrong binary. | 5 |
| [Keep planning files readable and downstream verification reproducible](#authoring-maintenance) | The team works in Pkl plans and repeatedly rebases downstream behavior. Syntax support and deterministic, bounded native fixtures reduce false failures without inventing product behavior. | 9 |

<a id="shared-identity"></a>
## Know who is participating without blocking ordinary work

Phosphor shares one trusted BB deployment and provider accounts. Native clients and integrations need durable, honest authorship and discoverable people without turning an identity lookup outage into an application outage.

### What this delivers

- A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.
- Native accepted author snapshots and later editor snapshots remain distinct. Verified people, explicitly integration-asserted people, and stable machine actors retain their evidence kind. Missing or failed person verification falls back to a machine actor for ordinary operations.
- Mention recipient selectors are resolved independently of authorship; participant/history/provenance reads and generation-bound plugin invocation scopes expose retained evidence. The UI, SDK and CLI can inspect identity; sender envelopes stay minimal.

### Responsibility

- Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
- Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays.
- Plugin runtime owns registration, activation, retirement and transport error mapping.

### Database model

- **Owns DB startup: migrate core, migrate sidecar, then seed personal project; closes DB on failure.**
  - Why: Neither sidecar objects nor retained schema are usable before both migration owners finish.
  - State/API identities: `initDb`, `migrate`, `migrateP6rSidecars`
  - Source: `apps/server/src/db.ts`
- **Creates accepted contribution, execution-attempt/input and operation-receipt tables and their eight lookup/uniqueness indexes.**
  - Why: Retain original accepted authorship, later editor/copy/replacement lineage, native request/turn correlation and operation-key/payload evidence independently of provider rendering.
  - State/API identities: `p6r_attempt_inputs`, `p6r_attempt_inputs_attempt_group_source_idx`, `p6r_attempt_inputs_contribution_idx`, `p6r_attempts`, `p6r_attempts_thread_created_idx`, `p6r_attempts_native_request_idx`, `p6r_contributions`, `p6r_contributions_thread_accepted_idx`, `p6r_contributions_native_request_idx`, `p6r_operation_receipts`, `p6r_operation_receipts_operation_hash_idx`, `p6r_operation_receipts_thread_accepted_idx`
  - Source: `apps/server/src/services/p6r/drizzle/0000_lying_energizer.sql`
- **Creates p6r_metadata, the key/value store for stable instance namespace and history revision.**
  - Why: Restart must retain the same operation namespace; consumers need a durable revision identifying changed history.
  - State/API identities: `p6r_metadata`, `p6r_metadata.key`, `p6r_metadata.value`
  - Source: `apps/server/src/services/p6r/drizzle/0001_aromatic_leopardon.sql`
- **Creates queued-dispatch reservations keyed by queued message ID, with unique operation identity, contribution identity, accepted authorship and input.**
  - Why: Queued acceptance must retain enough exact input/identity to promote or reject the existing operation after restart.
  - State/API identities: `p6r_pending_queued_dispatches`, `p6r_pending_queued_dispatches_operation_idx`, `p6r_pending_queued_dispatches.accepted_authorship`, `p6r_pending_queued_dispatches.input`
  - Source: `apps/server/src/services/p6r/drizzle/0002_pending_queued_dispatch.sql`
- **Coordinates core request event/queue writes and P6R acceptance receipts in native acceptance transactions.**
  - Why: An accepted message must not lose its original attribution or create duplicate dispatch on retry.
  - State/API identities: `createP6rNativeAcceptance`
  - Source: `apps/server/src/services/p6r/native-acceptance.ts`
- **Projects accepted contribution authors/editors and native request participant targets into the existing core participant relation/profile/snapshot model.**
  - Why: Preserve person, machine and integration-asserted external identity kinds in participant reads; projection evidence does not establish provider readiness.
  - State/API identities: `projectP6rParticipantsInTransaction`, `readP6rParticipantTargets`, `thread_facet_principal_profiles`, `thread_facet_relations`, `thread_facet_snapshots`
  - Source: `apps/server/src/services/p6r/participant-projection.ts`
- **Source generator configuration for the sidecar schema/migration directory.**
  - Why: Keep generated DDL and schema authoritative under one generator configuration.
  - State/API identities: `sidecar-schema.ts`, `drizzle`
  - Source: `apps/server/src/services/p6r/sidecar-drizzle.config.mjs`
- **Applies sidecar SQL through a separately named migration ledger on the core DB connection.**
  - Why: Separates P6R migration identity from core Drizzle numbering without introducing another database or service.
  - State/API identities: `migrateP6rSidecars`, `__p6r_migrations`
  - Source: `apps/server/src/services/p6r/sidecar-migrate.ts`
- **Defines this capability’s six P6R tables and nine explicit indexes: contributions, attempts, attempt inputs, operation receipts, queued-dispatch reservations and metadata. They share the core SQLite connection and declare no SQL foreign keys.**
  - Why: Application transactions own accepted lineage and receipt consistency. The separately catalogued participant watermark table is a later derived-cache addition.
  - State/API identities: `p6r_attempt_inputs`, `p6r_attempts`, `p6r_contributions`, `p6r_metadata`, `p6r_operation_receipts`, `p6r_pending_queued_dispatches`, `p6r_attempt_inputs_attempt_group_source_idx`, `p6r_attempt_inputs_contribution_idx`, `p6r_attempts_thread_created_idx`, `p6r_attempts_native_request_idx`, `p6r_contributions_thread_accepted_idx`, `p6r_contributions_native_request_idx`, `p6r_operation_receipts_operation_hash_idx`, `p6r_operation_receipts_thread_accepted_idx`, `p6r_pending_queued_dispatches_operation_idx`
  - Source: `apps/server/src/services/p6r/sidecar-schema.ts`
- **Owns namespaced contribution/attempt acceptance, queued operation reservations, payload-matched operation receipts, stable instance namespace and monotonic history revision.**
  - Why: Keep accepted originals distinct from edits/attempts; reuse exact operation keys after response loss. A recorded receipt retention deadline is not proof that an automatic pruner deleted the row.
  - State/API identities: `p6r_attempt_inputs`, `p6r_attempts`, `p6r_contributions`, `p6r_metadata`, `p6r_operation_receipts`, `p6r_pending_queued_dispatches`, `instance-namespace-v1`, `history-revision-v1`, `storageOperationId`, `storageRecordId`, `p6r_operation_receipts.retention_deadline`
  - Source: `apps/server/src/services/p6r/sidecar-store.ts`
- **Refuses client/turn/requested events from daemon append batches; native accepted request events remain server-owned. No schema or index is added here.**
  - Why: A daemon must not forge the authoritative request event used to establish native accepted authorship and participant targets.
  - State/API identities: `appendDaemonEventsInTransaction`, `client/turn/requested`
  - Source: `packages/db/src/data/events.ts`
- **Reexports the capability-owned database operations or ID constructors: CoreParticipantProfile, CoreParticipantSummary, SetThreadExecutionOverrideBatchInput, ThreadExecutionOverrideRow, ThreadExecutionProjectionRow, ThreadFacetDeclaration, ThreadFacetGeneration, ThreadFacetIdPage, ThreadFacetInvariantError, ThreadFacetInvariantErrorCode, ThreadFacetQueryPosition, activatePluginThreadFacetDeclarations, getOrCreateThreadFacetCursorSigningKey, listCoreParticipantProfilePage, listCoreParticipantProfilesByThreadIds, listCoreParticipantSummariesByThreadIds, listPriorThreadFacetSnapshotTargets, listThreadExecutionOverridesByThreadIds, listThreadExecutionProjectionRowsByIds, listThreadFacetOwnerProjections, listThreadIdsMissingCoreParticipantProjection, markThreadFacetOwnerGenerationReady, markThreadFacetOwnerGenerationUnavailable, queryThreadFacetThreadIds, recordThreadFacetCensusExhausted, replaceCoreParticipantProfiles, replaceCoreParticipantProfilesBatch, replaceCoreParticipantProfilesInTransaction, replaceThreadFacetRelationsInGeneration, setThreadExecutionOverridesBatch. This support boundary adds no independent table or migration.**
  - Why: Keep the database package entrypoint coherent with the owning state/query implementation and its consumers.
  - State/API identities: `CoreParticipantProfile`, `CoreParticipantSummary`, `SetThreadExecutionOverrideBatchInput`, `ThreadExecutionOverrideRow`, `ThreadExecutionProjectionRow`, `ThreadFacetDeclaration`, `ThreadFacetGeneration`, `ThreadFacetIdPage`, `ThreadFacetInvariantError`, `ThreadFacetInvariantErrorCode`, `ThreadFacetQueryPosition`, `activatePluginThreadFacetDeclarations`, `getOrCreateThreadFacetCursorSigningKey`, `listCoreParticipantProfilePage`, `listCoreParticipantProfilesByThreadIds`, `listCoreParticipantSummariesByThreadIds`, `listPriorThreadFacetSnapshotTargets`, `listThreadExecutionOverridesByThreadIds`, `listThreadExecutionProjectionRowsByIds`, `listThreadFacetOwnerProjections`, `listThreadIdsMissingCoreParticipantProjection`, `markThreadFacetOwnerGenerationReady`, `markThreadFacetOwnerGenerationUnavailable`, `queryThreadFacetThreadIds`, `recordThreadFacetCensusExhausted`, `replaceCoreParticipantProfiles`, `replaceCoreParticipantProfilesBatch`, `replaceCoreParticipantProfilesInTransaction`, `replaceThreadFacetRelationsInGeneration`, `setThreadExecutionOverridesBatch`
  - Source: `packages/db/src/data/index.ts`
- **Retains p6r_authors when creating queued input and carries the accepted-author/editor evidence through queue edits. This capability does not introduce admission intent or original-manifest fields.**
  - Why: Queueing and editing must preserve the accepted attribution attached to the original input.
  - State/API identities: `queued_thread_messages.p6r_authors`, `CreateQueuedThreadMessageInput`, `createQueuedThreadMessageInTransaction`, `updateQueuedThreadMessage`
  - Source: `packages/db/src/data/queued-thread-messages.ts`
- **Owns facet declarations, bounded members, owner generations/censuses, assignments, principal profiles, snapshots and durable cursor-signing keys.**
  - Why: Stale owner generations cannot overwrite current assignments; incomplete/unavailable projections cannot be presented as complete empty results.
  - State/API identities: `thread_facet_cursor_keys`, `thread_facet_declarations`, `thread_facet_members`, `thread_facet_owners`, `thread_facet_principal_profiles`, `thread_facet_reconciliation_targets`, `thread_facet_relations`, `thread_facet_snapshots`, `THREAD_FACET_PLUGIN_REPLACEMENT_MEMBER_LIMIT`, `ThreadFacetInvariantError`, `getOrCreateThreadFacetCursorSigningKey`
  - Source: `packages/db/src/data/thread-facets.ts`
- **Adds execution projection/override batch readers and optimistic model/reasoning writes that compare expected revision and prior values, then increment execution_revision. No thread-create reservation is introduced here.**
  - Why: Concurrent execution-setting changes must be detected instead of silently overwritten.
  - State/API identities: `threads.execution_revision`, `setThreadExecutionOverridesBatch`, `setThreadExecutionOverride`, `listThreadExecutionProjectionRowsByIds`, `listThreadExecutionOverridesByThreadIds`
  - Source: `packages/db/src/data/threads.ts`
- **Adds eight thread-facet tables and their indexes, queued_thread_messages.p6r_authors and threads.execution_revision. The cursor signing secret belongs to thread_facet_cursor_keys; environment classification belongs to diagnostic-environment.**
  - Why: Persist queryable owner-scoped facets and accepted queue attribution, with revision fencing for execution changes. These are the model additions made by this capability’s patches.
  - State/API identities: `thread_facet_cursor_keys`, `thread_facet_declarations`, `thread_facet_members`, `thread_facet_owners`, `thread_facet_principal_profiles`, `thread_facet_reconciliation_targets`, `thread_facet_relations`, `thread_facet_snapshots`, `thread_facet_members_rank_idx`, `thread_facet_principal_profiles_position_idx`, `thread_facet_reconciliation_targets_pending_idx`, `thread_facet_relations_member_thread_idx`, `thread_facet_snapshots_generation_thread_idx`, `thread_facet_cursor_keys.secret`, `thread_facet_principal_profiles.identity_kind`, `threads.execution_revision`, `queued_thread_messages.p6r_authors`
  - Source: `packages/db/src/schema.ts`
- **Generated state or contract artifacts accompany the owning schema/API change; repeated snapshots are not separate product capabilities.**
  - Why: Keep source, generated consumers and persisted-state receipts in one coherent cohort.
  - Source: `apps/server/src/services/p6r/drizzle/meta/0000_snapshot.json`, `apps/server/src/services/p6r/drizzle/meta/0001_snapshot.json`, `apps/server/src/services/p6r/drizzle/meta/0002_snapshot.json`, `apps/server/src/services/p6r/drizzle/meta/_journal.json`

### Core SDK and APIs

- **Existing POST /api/v1/plugins/:id/rpc/:method captures a host-owned HTTP ingress/request scope. Identity failures return unauthenticated→401 or unavailable→503; invalid_input remains400.**
  - Why: Preserve identity failure semantics at the existing plugin RPC route. This capability does not own the asset-generation endpoint change; see plugin-artifacts-transport.
  - Visibility: public
  - State/API identities: `registerPluginRoutes`
  - Source: `apps/server/src/routes/plugins.ts`
- **Existing send, edit, queue-create, queue-update and compact actions capture native request authorship before accepting content.**
  - Why: Freeze accepted author/editor evidence from the server request rather than reconstruct it from a later viewer. Admission operation lookup/cancel routes belong to message-acceptance-delivery.
  - Visibility: public
  - State/API identities: `registerThreadActionRoutes`
  - Source: `apps/server/src/routes/threads/actions.ts`
- **Existing create/fork actions pass native request authorship to the thread owner; their201 thread responses remain unchanged.**
  - Why: Keep initial authorship tied to the originating request through provisioning. This is an authority/capture change, not a separate new identity endpoint.
  - Visibility: public
  - State/API identities: `registerThreadBaseRoutes`
  - Source: `apps/server/src/routes/threads/base.ts`
- **Strict external contribution v1 carries external author and optional integration-asserted person attribution with exact input/operation/thread/mode envelope.**
  - Why: Retain external-person authorship on accepted/queued messages without conflating it with current authenticated native actor. Contract obligations: personAttribution evidence is integration-asserted; not provider-verified. This is a private protocol reached through externalContributions, not a new REST API. Consumers: apps/server/src/services/p6r/identity-protocol.ts.
  - Visibility: private
  - State/API identities: `p6rExternalContributionV1Schema`, `p6rExternalContributionRequestV1Schema`, `P6rExternalContributionV1`, `P6rExternalPersonSnapshotV1`, `readP6rExternalContribution`, `p6rExternalContributionEvidence`, `p6rExternalContributionAuthor`
  - Source: `apps/server/src/services/p6r/external-contribution.ts`
- **Specializes the opaque SDK identity boundary into Phosphor session/acceptance/provenance/history/directory/participant models; adds externalContributions {versions:[1],personKinds:[person],history:accepted-and-queued,rollback:requires-capable-host,acceptV1,lookupV1}.**
  - Why: Keep Phosphor product schema and host-owned effect authorization together while plugins use versioned bb-identity adapters. Contract obligations: These types are NOT exported public Plugin SDK types or REST routes, even though property methods are reachable through the fork-specific opaque capability. Acceptance has submitted/rejected/indeterminate; lookup final/pending/absent-final/unknown; history known/partial/pending/unavailable. Unknown is not empty or safe replay. No claim of compatibility with current upstream or non-fork hosts. Consumers: community-plugins/packages/bb-identity/host-runtime.ts, apps/server/src/services/plugins/plugin-api.ts, apps/server/src/services/p6r/provider-contract.ts.
  - Visibility: private
  - State/API identities: `P6rIdentityCapabilities`, `P6rReadySession`, `P6rServerSession`, `P6rSendInput`, `P6rAcceptanceReceipt`, `P6rAcceptanceOutcome`, `P6rOperationLookup`, `P6rExecutionProvenance`, `P6rContributionQuery`, `P6rAttemptQuery`, `P6rActorSnapshot`, `P6rOrigin`, `P6rContribution`, `P6rEvidencePage`, `P6rParticipantQuery`, `P6rParticipantPage`, `P6rHostInvalidation`, `P6rRawProtocol`, `P6rIdentityService`, `createP6rIdentityService`
  - Source: `apps/server/src/services/p6r/identity-protocol.ts`
- **Captures native actor snapshots around configured request boundary and serves no-store /api/v1/system/p6rIdentity ready response with actor/providerId.**
  - Why: One owner derives actor evidence for create/send/edit/queue; caller profiles never establish native authorship. Contract obligations: Machine fallback is explicit best effort; current credential metadata/read readiness is distinct from provider inference readiness. Consumers: apps/server/src/routes/threads/actions.ts, apps/server/src/routes/threads/base.ts, packages/sdk/src/areas/system.ts.
  - Visibility: private
  - State/API identities: `P6rNativeAuthorship`, `getP6rNativeAuthorship`, `installP6rNativeRequestRoutes`
  - Source: `apps/server/src/services/p6r/native-request.ts`
- **Private server actor-resolution and invocation binding. Resolves immutable author facts from request/ingress evidence and the configured identity provider; ordinary missing-person cases retain machine fallback.**
  - Why: Bind the provider resolver, ingress evidence and invocation lifetime under one server effect owner without presenting this implementation as a public or mandatory-person admission API.
  - Visibility: private
  - State/API identities: `P6rAdmissionRequestFacts`, `P6rAdmissionIngressFacts`, `P6rProviderAdmissionOptions`, `P6rProviderAdmission`, `createP6rProviderAdmission`
  - Source: `apps/server/src/services/p6r/provider-admission.ts`
- **Private version1 identity provider configuration/evidence/resolve/readiness/directory/lookup and prepare/publish/retire registry lifecycle.**
  - Why: Separate provider selection, trusted ingress evidence and generation publication from plugin caller presentation. Contract obligations: Registry publishes exactly a prepared generation and can return predecessor; authentication/directory/retired invalidations have distinct scopes. Provider evidence includes real credentials internally; it must never be copied into diagnostics/catalog. Private specialization, not public upstream provider bridge API. Consumers: apps/server/src/services/p6r/provider-registry.ts, apps/server/src/services/p6r/identity-protocol.ts, plugins/plugins/identity-boundaries/server.ts via bb-identity structural binding.
  - Visibility: private
  - State/API identities: `P6rIdentityError`, `P6rResult`, `P6rPersonReference`, `P6rProviderConfiguration`, `P6rProviderEvidence`, `P6rProviderResolution`, `P6rProviderDirectoryRecord`, `P6rProviderDirectorySource`, `P6rForkIdentityProvider`, `P6rForkProviderRegistration`, `P6rPreparedProvider`, `P6rProviderInvalidation`, `P6rProviderRegistry`
  - Source: `apps/server/src/services/p6r/provider-contract.ts`
- **Adds startup-only BB_P6R_IDENTITY_BOUNDARY JSON parser with version1 provider/credentials/ingress IDs/trusted mapping and resolver timeout.**
  - Why: Make ingress identity authority operator-selected and reproducible rather than infer it from untrusted headers. Contract obligations: Configuration change requires server restart; values here describe header/cookie fields, not captured credentials. Consumers: packages/config/src/server.ts.
  - Visibility: internal
  - State/API identities: `BB_P6R_IDENTITY_BOUNDARY_ENV`
  - Source: `packages/config/src/env-vars.ts`
- **Adds selected identity boundary to server config, with defaultTailnetIdentityBoundary fallback.**
  - Why: Carry startup-selected provider/ingress authority into server construction. Consumers: apps/server/src/start-server.ts, apps/server/src/server.ts.
  - Visibility: internal
  - State/API identities: `P6rIdentityBoundaryConfig`, `ServerConfig.BB_P6R_IDENTITY_BOUNDARY`
  - Source: `packages/config/src/server.ts`
- **When ownedHost configured, selects identity-boundaries provider, tailscale-serve ingress and known Tailscale identity headers; otherwise returns null.**
  - Why: Keep default multi-user attribution tied to an explicitly owned listener/host rather than arbitrary forwarded headers. Contract obligations: Does not authorize arbitrary proxy headers or configure Tailscale ACLs itself. Consumers: packages/config/src/server.ts, rosetta-machine managed BB owned Tailnet listener.
  - Visibility: private
  - State/API identities: `defaultTailnetIdentityBoundary`
  - Source: `packages/config/src/tailnet-default.ts`
- **Exports the new p6r-message-author models from the shared domain barrel.**
  - Why: SDK, retained events and timeline readers share the same person/machine author and editor schema; no additional callable API is added by the barrel.
  - Visibility: public
  - State/API identities: `p6rMessageAuthorSchema`, `P6rMessageAuthor`, `p6rMessageAttributionSchema`, `p6rStoredMessageAttributionSchema`
  - Source: `packages/domain/src/index.ts`
- **Adds person/provider-verified or integration-asserted and machine actor snapshots, plus per-original nullable author/editor arrays.**
  - Why: Preserve identity evidence separately from display names across queue, edits, retries and timeline projection. Contract obligations: Max256 attributed originals. Stored schema accepts prior arrays or the author/editor record; this is retained-data parsing, not fresh caller authorship authority. Consumers: packages/domain/src/thread-events.ts, packages/server-contract/src/thread-timeline.ts, apps/server/src/services/p6r/native-authorship.ts.
  - Visibility: public
  - State/API identities: `p6rMessageAuthorSchema`, `P6rMessageAuthor`, `p6rMessageAttributionSchema`, `p6rStoredMessageAttributionSchema`, `P6rMessageAttribution`
  - Source: `packages/domain/src/p6r-message-author.ts`
- **Inline queued payloads gain optional p6rAuthors/p6rEditors arrays of nullable actor snapshots, at most256 originals.**
  - Why: Retain authorship through queued delivery and edits without inventing an actor for unknown history. The message-originals barrel addition is documented under message-acceptance-delivery.
  - Visibility: public
  - State/API identities: `queuedMessagePayloadSchema`
  - Source: `packages/domain/src/queued-message.ts`
- **turn.request gains optional p6rAuthors, p6rEditors and p6rMentionedTargets. Verified mention targets freeze identity, presentation and plugin/generation source independently of authorship.**
  - Why: Keep authors, editors and mentioned people distinct through grouped/replayed inputs. Each array is bounded256; the host resolves person selectors rather than trusting supplied profiles. originalManifest is documented under message-acceptance-delivery.
  - Visibility: public
  - State/API identities: `p6rMentionTargetSchema`, `P6rMentionTarget`, `turnRequestEventDataSchema`
  - Source: `packages/domain/src/thread-events.ts`
- **The shared facet model identifies the native core/participants facet and bounded principal-key/participant-page inputs; its complete query/mutation contract is owned by thread-views-execution.**
  - Why: Identity projections reuse native participant keys and pagination instead of declaring another independent identity query API.
  - Visibility: public
  - State/API identities: `CORE_PARTICIPANTS_FACET_TYPE_ID`, `threadFacetPrincipalKeySchema`, `threadFacetParticipantPageRequestSchema`
  - Source: `packages/domain/src/thread-facet.ts`
- **Thread list entries gain optional p6rParticipants snapshots containing principal key, display name and nullable image URL.**
  - Why: Display canonical participant presentation in native/plugin lists without treating display data as authority. The initialForkSeed queue-content exception belongs to message-acceptance-delivery.
  - Visibility: public
  - State/API identities: `threadListEntrySchema.p6rParticipants`
  - Source: `packages/domain/src/thread.ts`
- **Adds optional experimental_p6rIdentity, host tool-call experimental_turnId/experimental_callId, and verified person mention selectors through resolve().experimental_target.**
  - Why: bb-identity feature-detects the opaque fork identity extension; identity-boundaries selects issuer/subject from its active provider and the host resolves identity/presentation. github-review, background-jobs and rosetta-slack use exact tool correlation. These are downstream additions, not upstream SDK support; no env, facet, prompt or asset contract is implied here.
  - Visibility: public
  - State/API identities: `PluginAgentToolContext.experimental_turnId`, `PluginAgentToolContext.experimental_callId`, `ExperimentalPluginMentionTargetSelector`, `PluginMentionProviderRegistration.resolve`, `BbPluginApi.experimental_p6rIdentity`
  - Source: `packages/plugin-sdk/src/backend-contract.ts`
- **New generic/opaque host-boundary types. ExperimentalP6rIdentityProtocol version 1 exposes bindInvocation, session, selfProfile, openRequest, accept, lookup, provenance, historyContributions, historyAttempts, directorySources, participants, forwardRpc, registerProvider, subscribe and optional experimental_useProducerMessageRendering.**
  - Why: Make host lifecycle, request authority, generation retirement and transactional acceptance explicit while leaving product identity/directory schemas to bb-identity and the private server specialization. Contract obligations: Invocation scope has AbortSignal/release/validate; registration/provider state is staged/active/retired. Do not present this generic exported SDK extension as an official upstream API, or P6rRawProtocol/P6rForkIdentityProvider as public SDK exports. Captured request/derived forward scope, not caller-provided identity, authorizes effects. Consumers: community-plugins/packages/bb-identity/host-runtime.ts, apps/server/src/services/p6r/identity-protocol.ts.
  - Visibility: public
  - State/API identities: `ExperimentalP6rInvocationRouteClass`, `ExperimentalP6rInvocationValidity`, `ExperimentalP6rInvocationScope`, `ExperimentalP6rInvocationContext`, `ExperimentalP6rInvocationRegistration`, `ExperimentalP6rRequestHandle`, `ExperimentalP6rForkRequestHandle`, `ExperimentalP6rResult`, `ExperimentalP6rAcceptanceSource`, `ExperimentalP6rAcceptanceRequest`, `ExperimentalP6rProviderRegistration`, `ExperimentalP6rIdentityProtocol`
  - Source: `packages/plugin-sdk/src/experimental-p6r-identity.ts`
- **Reexports the generic experimental-p6r-identity module from the fork SDK root.**
  - Why: Expose the optional structural host boundary while private P6rRawProtocol/provider product schemas stay server-owned. This is downstream SDK support, not an official upstream identity API.
  - Visibility: public
  - State/API identities: `ExperimentalP6rIdentityProtocol`
  - Source: `packages/plugin-sdk/src/index.ts`
- **Adds unauthenticated and unavailable error-code arms.**
  - Why: Represent request identity failures at RPC boundary instead of generic internal failures. Contract obligations: HTTP maps these to 401 and 503 respectively; invalid_input remains 400. Consumers: apps/server/src/routes/plugins.ts.
  - Visibility: public
  - State/API identities: `PluginRpcErrorCode`
  - Source: `packages/plugin-sdk/src/rpc-contract.ts`
- **Adds abortable p6rIdentity read for GET /api/v1/system/p6rIdentity.**
  - Why: Resolve native attribution presentation through a server-owned request boundary. Contract obligations: P6rIdentityResponse type is imported from server-contract; this method is fork-only despite living under existing SystemArea. Consumers: apps/app/src/components/settings/P6rIdentitySettingsSection.tsx:12.
  - Visibility: public
  - State/API identities: `SystemArea.p6rIdentity`
  - Source: `packages/sdk/src/areas/system.ts`
- **Adds ready(actor,providerId), unconfigured, unauthenticated(message), unavailable(message) response union.**
  - Why: Let native clients display attribution facts without parsing opaque identity provider internals. Contract obligations: Current installed native-request handler returns ready with resolved actor or machine fallback; the schema alone does not establish live use of every arm. Consumers: packages/sdk/src/areas/system.ts, apps/server/src/services/p6r/native-request.ts.
  - Visibility: public
  - State/API identities: `p6rIdentityResponseSchema`, `P6rIdentityResponse`
  - Source: `packages/server-contract/src/api/system.ts`
- **Facet participant preview/full-page records expose p6rPrincipalKey, p6rIdentityKind, p6rDisplayName and nullable p6rImageUrl.**
  - Why: Share canonical participant presentation with identity-aware clients. Previews contain at most3 profiles with totalCount/nextCursor; full facet query/execution APIs are owned by thread-views-execution.
  - Visibility: public
  - State/API identities: `threadFacetParticipantSummarySchema`, `threadFacetParticipantsResponseSchema`
  - Source: `packages/server-contract/src/api/threads.ts`
- **Adds GET /api/v1/system/p6rIdentity with a typed P6rIdentityResponse and no request body.**
  - Why: Let SDK/native clients inspect server-derived attribution through one read route. Concrete provider/identity registry services are private implementations, not additional public routes.
  - Visibility: public
  - State/API identities: `publicApiRoutes.system.p6rIdentity`
  - Source: `packages/server-contract/src/public-api.ts`
- **Adds optional p6rAuthor and p6rEditor to user conversation timeline rows.**
  - Why: Render actual author/editor snapshots without treating every shared human message as the viewer. Contract obligations: Person/machine shape comes from p6rMessageAuthorSchema; older retained rows can lack attribution. Consumers: packages/thread-view/src/build-thread-timeline.ts, apps/app/src/components/message.
  - Visibility: public
  - State/API identities: `timelineUserConversationRowSchema`
  - Source: `packages/server-contract/src/thread-timeline.ts`

### Other affected areas

- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/app/src/components/settings/P6rIdentitySettingsSection.test.tsx`, `apps/app/src/hooks/cache-owners/thread-runtime-cache-owner.test.ts`, `apps/cli/src/__tests__/command-output/thread-organization.test.ts`, `apps/demo-server/src/fixtures/world.ts`, `apps/server/test/helpers/p6r-authorship.ts`, `apps/server/test/helpers/test-app.ts`, `apps/server/test/internal/daemon-forged-mention-http.test.ts`, `apps/server/test/internal/internal-events-tool-calls.test.ts`, `apps/server/test/public/public-thread-compaction.test.ts`, `apps/server/test/public/public-thread-data.test.ts`, `apps/server/test/public/public-thread-facets.test.ts`, `apps/server/test/public/public-thread-fork.test.ts`, `apps/server/test/public/public-thread-offline-followup.test.ts`, `apps/server/test/services/p6r/external-contribution.test.ts`, `apps/server/test/services/p6r/identity-protocol.test.ts`, `apps/server/test/services/p6r/invocation-registry.test.ts`, `apps/server/test/services/p6r/mention-target-service-paths.test.ts`, `apps/server/test/services/p6r/mention-targets.test.ts`, `apps/server/test/services/p6r/native-acceptance.test.ts`, `apps/server/test/services/p6r/native-message-authorship.test.ts`, `apps/server/test/services/p6r/provider-admission.test.ts`, `apps/server/test/services/p6r/provider-registry.test.ts`, `apps/server/test/services/p6r/sidecar-startup-migration.test.ts`, `apps/server/test/services/p6r/sidecar-store.test.ts`, `apps/server/test/services/plugins/heroes-phase2.test.ts`, `apps/server/test/services/plugins/plugin-authoring-docs.test.ts`, `apps/server/test/services/plugins/plugin-mention-providers.test.ts`, `apps/server/test/services/plugins/plugin-p6r-admission-boundary.test.ts`, `apps/server/test/services/plugins/plugin-sdk.test.ts`, `apps/server/test/services/threads/thread-queued-messages.test.ts`, `apps/server/test/services/threads/thread-runtime-display.test.ts`, `apps/server/test/threads/environment-providers.test.ts`, `apps/server/test/threads/thread-edit-message.test.ts`, `apps/server/test/threads/thread-provisioning-recovery.test.ts`, `packages/config/test/config.test.ts`, `packages/config/test/tailnet-default.test.ts`, `packages/db/test/data/queued-thread-messages.test.ts`, `packages/db/test/data/threads.test.ts`, `packages/db/test/migrate.test.ts`, `packages/domain/test/p6r-message-author.test.ts`, `packages/domain/test/thread.test.ts`, `packages/plugin-sdk/src/__tests__/public-types.test.ts`, `packages/plugin-sdk/src/testing/fixtures.ts`, `packages/sdk/test/public-types.test.ts`, `packages/server-contract/test/contract.test.ts`, `packages/thread-view/test/user-message-parsing.test.ts`, `tests/integration/fake/smoke/dynamic-acp-agent.test.ts`
- **Native client presentation and cache lifecycle. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/app/src/components/settings/P6rIdentitySettingsSection.tsx`, `apps/app/src/components/settings/settings-search.ts`, `apps/app/src/components/settings/settings-sections.ts`, `apps/app/src/components/thread/timeline/ConversationMessageContent.tsx`, `apps/app/src/components/thread/timeline/P6rMessageAuthorLabel.tsx`, `apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx`, `apps/app/src/hooks/cache-owners/thread-runtime-cache-owner.ts`, `apps/app/src/views/SettingsView.tsx`
- **CLI operations and output. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/cli/src/commands/settings.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/internal/events.ts`, `apps/server/src/internal/tool-calls.ts`, `apps/server/src/server.ts`, `apps/server/src/services/p6r/invocation-registry.ts`, `apps/server/src/services/p6r/native-authorship.ts`, `apps/server/src/services/p6r/provider-registry.ts`, `apps/server/src/services/p6r/receipt-outcome.ts`, `apps/server/src/services/p6r/tool-correlation-registry.ts`, `apps/server/src/services/plugins/plugin-api.ts`, `apps/server/src/services/plugins/plugin-mentions.ts`, `apps/server/src/services/plugins/plugin-p6r-dispatch.ts`, `apps/server/src/services/plugins/plugin-p6r-http.ts`, `apps/server/src/services/plugins/plugin-runtime.ts`, `apps/server/src/services/plugins/plugin-service-internal.ts`, `apps/server/src/services/plugins/plugin-service.ts`, `apps/server/src/services/threads/dispatch-attempt.ts`, `apps/server/src/services/threads/queue-waits.ts`, `apps/server/src/services/threads/queued-messages.ts`, `apps/server/src/services/threads/thread-create.ts`, `apps/server/src/services/threads/thread-edit-message.ts`, `apps/server/src/services/threads/thread-events.ts`, `apps/server/src/services/threads/thread-facet-query.ts`, `apps/server/src/services/threads/thread-fork.ts`, `apps/server/src/services/threads/thread-provisioning.ts`, `apps/server/src/services/threads/thread-queued-messages.ts`, `apps/server/src/services/threads/thread-send-request.ts`, `apps/server/src/services/threads/thread-send.ts`, `apps/server/src/services/threads/thread-turn-dispatch.ts`, `apps/server/src/start-server.ts`, `apps/server/src/types.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `docs/api_to_audit.md`, `docs/configuration.md`, `packages/templates/src/templates/bb-guide-customization.md`, `plugins/bb-guide/skills/bb-cli/SKILL.md`, `plugins/bb-guide/skills/bb-cli/references/command-index.md`, `plugins/bb-guide/skills/bb-plugin-authoring/references/backend-api-index.md`
- **test-helpers package integration. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `packages/test-helpers/src/domain-fixtures.ts`
- **thread-view package integration. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `packages/thread-view/src/build-thread-timeline.ts`, `packages/thread-view/src/event-projection-message.ts`, `packages/thread-view/src/user-message-parsing.ts`
- **Native plugin-api-docs plugin. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `plugins/plugin-api-docs/src/surfaces.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- identity-protocol.test.ts
- provider-admission.test.ts
- provider-registry.test.ts
- native-message-authorship.test.ts
- external-contribution.test.ts
- mention-targets.test.ts
- mention-target-service-paths.test.ts
- plugin-p6r-admission-boundary.test.ts
- tailnet-default.test.ts

### Known limitations

- 0009 originally introduced a person-admission gate. 0015 removes that gate and old issuance/deadline-only admission plumbing. Its current residual value is transport/error/lifecycle behavior; do not advertise mandatory verified-person admission.
- 0034 installs a listener and request-actor plumbing; actual Tailscale policy, Serve routes and the concrete identity-provider service are deployment/plugin responsibilities.
- 0063 carries integration-asserted person evidence; it must not be described as provider-verified.

### Retirement condition

Retire only when upstream/native public plugin contracts preserve the same best-effort actor semantics, immutable authors/editors, mentions, exact operation history and generation isolation; migrate retained data before deleting its readers.

<details><summary>Selected patches (8) and source binding</summary>

- [0001-feat-identity-establish-the-selected-identity-kernel.patch](patches/0001-feat-identity-establish-the-selected-identity-kernel.patch)
- [0004-feat-mentions-add-verified-mention-targets.patch](patches/0004-feat-mentions-add-verified-mention-targets.patch)
- [0009-fix-auth-enforce-the-reviewed-admission-boundary.patch](patches/0009-fix-auth-enforce-the-reviewed-admission-boundary.patch)
- [0015-feat-p6r-use-best-effort-native-attribution-in-share.patch](patches/0015-feat-p6r-use-best-effort-native-attribution-in-share.patch)
- [0016-fix-activate-Tailnet-identity-from-configured-Serve-.patch](patches/0016-fix-activate-Tailnet-identity-from-configured-Serve-.patch)
- [0034-feat-p6r-owned-tailnet-listener.patch](patches/0034-feat-p6r-owned-tailnet-listener.patch)
- [0060-test-upstream-align-downstream-fixtures-with-migrated-templates.patch](patches/0060-test-upstream-align-downstream-fixtures-with-migrated-templates.patch)
- [0063-feat-p6r-retain-external-person-authorship.patch](patches/0063-feat-p6r-retain-external-person-authorship.patch)

Reviewed source digest: `c2fd2e4705f9ac8c46e7063f5251bf69603cb113066670b920243927ea790d16`

</details>

<a id="thread-views-execution"></a>
## Let plugins organize shared threads and change execution deliberately

Shared thread navigation needs authoritative filters, participant summaries and execution state. Plugins should provide organization/layout data while core retains native rendering and validates effects.

### What this delivers

- Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.
- Native participant summaries are supplied to sidebar/plugin models. An optional sidebar layout provider publishes bounded order/visibility data while native rail rendering, actions and customization remain core-owned.
- Execution views expose resolved settings and witness values. Batch preflight and apply revalidate thread state, route, registration/catalog facts and token expiry before applying overrides; changes invalidate the affected execution projections.
- Participant watermarks avoid rebuilding unchanged projections. This is a derived read optimization, not a second authority for accepted authorship.

### Responsibility

- DB facet owner generations/relations and execution overrides are durable state.
- Server thread-facet-query owns read assembly, cursor signing and participant projection checks.
- Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts.
- Native sidebar arrangement owns rendering; plugins supply layout/presentation data.

### Database model

- **Adds participant input-watermark projection cache.**
  - Why: Skip unchanged attribution projection while binding cached output to exact source inputs and projector version.
  - State/API identities: `p6r_participant_watermarks`
  - Source: `apps/server/src/services/p6r/drizzle/0003_participant_watermarks.sql`
- **Compares current participant-source watermarks with retained watermarks and publishes profiles/watermarks together; projector version invalidates changed projection semantics.**
  - Why: Skip unchanged derived work without treating a cached participant projection as accepted-source or provider-readiness authority.
  - State/API identities: `P6R_PARTICIPANT_PROJECTOR_VERSION`, `readP6rParticipantInputWatermarks`, `readStoredP6rParticipantWatermarks`, `p6rParticipantWatermarksEqual`, `writeP6rParticipantWatermarkInTransaction`
  - Source: `apps/server/src/services/p6r/participant-projection.ts`
- **Adds only p6r_participant_watermarks: thread ID, latest request sequence/ID, contribution count/max accepted time, projector version and update time. No new index or metadata table is added by this capability.**
  - Why: Bind cached participant output to its exact input watermark and projector version; the identity capability owns the preexisting P6R metadata/receipt tables.
  - State/API identities: `p6r_participant_watermarks`, `p6r_participant_watermarks.thread_id`, `p6r_participant_watermarks.request_sequence`, `p6r_participant_watermarks.request_event_id`, `p6r_participant_watermarks.contribution_count`, `p6r_participant_watermarks.contribution_accepted_at`, `p6r_participant_watermarks.projector_version`, `p6r_participant_watermarks.updated_at`
  - Source: `apps/server/src/services/p6r/sidecar-schema.ts`
- **Adds force-refresh validation to the existing model catalog and carries an explicit refresh success/failure result. No schema or external-route fingerprint is added here.**
  - Why: Execution preflight must not present a retained catalog as verified readiness when its required fresh validation failed.
  - State/API identities: `forceRefresh`, `RefreshResult`, `createProviderModelCatalogStore`
  - Source: `apps/server/src/services/providers/provider-model-catalog-store.ts`
- **Adds a variable-bounded batch read for each thread’s latest retained client turn/start request, using the existing events_thread_type_sequence_idx. No event authority rule or index DDL is introduced here.**
  - Why: Execution/participant read models need the latest request evidence across many threads without repeating independent per-thread reads.
  - State/API identities: `ListLastStoredTurnRequestEventsByThreadIdsArgs`, `listLastStoredTurnRequestEventsByThreadIds`, `events_thread_type_sequence_idx`
  - Source: `packages/db/src/data/events.ts`
- **Reexports the capability-owned database operations or ID constructors: ListLastStoredTurnRequestEventsByThreadIdsArgs, listLastStoredTurnRequestEventsByThreadIds, listThreadsWithPendingInteractionStateByIds. This support boundary adds no independent table or migration.**
  - Why: Keep the database package entrypoint coherent with the owning state/query implementation and its consumers.
  - State/API identities: `ListLastStoredTurnRequestEventsByThreadIdsArgs`, `listLastStoredTurnRequestEventsByThreadIds`, `listThreadsWithPendingInteractionStateByIds`
  - Source: `packages/db/src/data/index.ts`
- **Broadens reads to DbQueryConnection for shared transaction/read context; no added table, column or persisted setting.**
  - Why: Allow coherent/batched execution/admission reads without inventing another settings authority.
  - State/API identities: `getProjectExecutionDefaults`, `listProjectExecutionDefaultsByProjectIds`
  - Source: `packages/db/src/data/project-execution-defaults.ts`
- **Batches listCoreParticipantProfilesByThreadIds into groups of 500 thread IDs while retaining per-thread member-position order. Reuses the existing participant profile table.**
  - Why: Sidebar participant reads must stay within SQLite variable limits as the thread set grows; no new declaration or cursor model is introduced here.
  - State/API identities: `listCoreParticipantProfilesByThreadIds`, `thread_facet_principal_profiles`
  - Source: `packages/db/src/data/thread-facets.ts`
- **Adds listThreadsWithPendingInteractionStateByIds to reuse the native pending-interaction projection for a deduplicated selected thread set. No schema or thread-create behavior changes here.**
  - Why: Execution/sidebar views should read coherent native state for the requested IDs rather than reconstructing it or reading every thread.
  - State/API identities: `listThreadsWithPendingInteractionStateByIds`
  - Source: `packages/db/src/data/threads.ts`
- **Generated state or contract artifacts accompany the owning schema/API change; repeated snapshots are not separate product capabilities.**
  - Why: Keep source, generated consumers and persisted-state receipts in one coherent cohort.
  - Source: `apps/server/src/services/p6r/drizzle/meta/0003_snapshot.json`, `apps/server/src/services/p6r/drizzle/meta/_journal.json`

### Core SDK and APIs

- **Implements POST /api/v1/threads/facet-query, GET /api/v1/threads/:id/facet-participants and POST /api/v1/threads/execution-overrides/{preflight,apply}.**
  - Why: The server owns bounded facet projection reads and witness/token-guarded execution updates. Participant pageSize is1..100; SDK consumers include thread-manager, identity-boundaries, inbox-sidebar-nerd and bb-identity.
  - Visibility: public
  - State/API identities: `registerThreadBaseRoutes`
  - Source: `apps/server/src/routes/threads/base.ts`
- **Adds execution-options-changed thread invalidation kind.**
  - Why: Invalidate execution detail/list summaries when batch override changes rather than leave cached old model/reasoning. Contract obligations: Wire enum addition coupled to invalidation consumers; not an inference-routing change. Consumers: apps/app/src/lib/thread-invalidation.ts, apps/server/src/services/threads/thread-execution-batch.ts.
  - Visibility: public
  - State/API identities: `THREAD_CHANGE_KINDS`
  - Source: `packages/domain/src/change-kinds.ts`
- **Adds optional p6rParticipants presentation to threadListEntrySchema.**
  - Why: Native sidebars and plugin thread lists receive canonical participant previews without building their own identity index. This field grants no mutation authority.
  - Visibility: public
  - State/API identities: `threadListEntrySchema`
  - Source: `packages/domain/src/thread.ts`
- **Adds PluginSidebarThread.p6rParticipants and the data-only experimental_sidebarLayoutProvider slot with publish(layout|null) and subscribeChanges.**
  - Why: sidebar-defaults supplies order/visibility while BB retains sidebar rendering, navigation and interaction ownership. The first provider in deterministic slot order wins; publish(null) withdraws its layout. Composer operation identity is a separate capability.
  - Visibility: public
  - State/API identities: `PluginSidebarThread.p6rParticipants`, `P6rParticipantProfile`, `ExperimentalSidebarLayout`, `ExperimentalSidebarLayoutProviderProps`, `ExperimentalSidebarLayoutProviderRegistration`, `PluginAppSlots.experimental_sidebarLayoutProvider`
  - Source: `packages/plugin-sdk/src/app-contract.ts`
- **Adds experimental_facets with opaque native target grants and owner-bound enum handles; optional experimental_p6rRoutes.p6rThreadPath and HTTP experimental_p6rExternalOrigin supply presentation-only links.**
  - Why: thread-progress declares shared-thread one/many facets, thread-manager queries them, and agent-connect constructs native links. replace/clear/listPriorTargets/markReady operate only through declared handles and SDK-read target grants. External origin carries no actor, credential or forwarded-header authority; CORS ownership is separate.
  - Visibility: public
  - State/API identities: `P6rPluginRequestContext`, `PluginHttpHandler`, `P6rExperimentalPluginRoutes`, `ExperimentalThreadFacetCardinality`, `ExperimentalThreadFacetTargetGrant`, `ExperimentalThreadFacetTarget`, `ExperimentalThreadFacetReplacement`, `ExperimentalThreadFacetTargetPage`, `ExperimentalThreadFacetHandle`, `ExperimentalThreadFacets`, `BbPluginApi.experimental_p6rRoutes`, `BbPluginApi.experimental_facets`
  - Source: `packages/plugin-sdk/src/backend-contract.ts`
- **Collects/validates unique IDs and components for the new sidebar layout provider slot.**
  - Why: Integrate the data-only seam into existing deterministic slot ownership. Contract obligations: No new independent public endpoint. Consumers: packages/plugin-sdk/src/app-contract.ts.
  - Visibility: internal
  - State/API identities: `CollectedPluginAppRegistrations.experimentalSidebarLayoutProviders`, `collectPluginAppRegistrations`
  - Source: `packages/plugin-sdk/src/internal/plugin-app-collector.ts`
- **Adds queryFacets, facetParticipants, experimental_preflightExecutionOverrides and experimental_applyExecutionOverrides plus their argument/result types.**
  - Why: thread-manager consumes preflight/apply and bounded facet queries; inbox-sidebar-nerd, identity-boundaries and bb-identity consume shared views. Requests propagate AbortSignal and preserve server cursor/witness/token semantics. No admission journal or context-magnet read is part of these methods.
  - Visibility: public
  - State/API identities: `ThreadFacetQueryArgs`, `ThreadFacetParticipantsArgs`, `ExperimentalThreadExecutionPreflightArgs`, `ExperimentalThreadExecutionApplyArgs`, `ThreadsArea.queryFacets`, `ThreadsArea.facetParticipants`, `ThreadsArea.experimental_preflightExecutionOverrides`, `ThreadsArea.experimental_applyExecutionOverrides`
  - Source: `packages/sdk/src/areas/threads.ts`
- **Adds bounded facet query/participant responses and resolved/unresolved execution summaries. Batch preflight returns ready/stale/unavailable; apply returns applied/unchanged/stale/rejected/failed.**
  - Why: Use one typed evidence model before changing execution settings. Each batch has1..5000 unique threads, a64-hex current witness and bounded applyToken; preview profiles<=3 and facetStates<=5. Facet query schema comes from domain. Message acceptance/preparing outcomes are separate contracts.
  - Visibility: public
  - State/API identities: `experimentalThreadExecutionSummarySchema`, `experimentalThreadExecutionOverridePatchSchema`, `experimentalThreadExecutionPreflightRequestSchema`, `experimentalThreadExecutionPreflightResultSchema`, `experimentalThreadExecutionPreflightResponseSchema`, `experimentalThreadExecutionApplyRequestSchema`, `experimentalThreadExecutionApplyResultSchema`, `experimentalThreadExecutionApplyResponseSchema`, `EXPERIMENTAL_THREAD_EXECUTION_BATCH_LIMIT`, `threadFacetParticipantSummarySchema`, `threadFacetQueryThreadSchema`, `threadFacetQueryRequestSchema`, `threadFacetQueryResponseSchema`, `threadFacetParticipantsQuerySchema`, `threadFacetParticipantsResponseSchema`
  - Source: `packages/server-contract/src/api/threads.ts`
- **Adds POST /api/v1/threads/facet-query, GET /api/v1/threads/:id/facet-participants, POST /api/v1/threads/execution-overrides/preflight and POST /api/v1/threads/execution-overrides/apply.**
  - Why: The typed route registry binds SDK transport to the facet and optimistic execution request/response validators. Plugins receive shared server-owned views instead of scanning or mutating host state independently.
  - Visibility: public
  - State/API identities: `publicApiRoutes.threads.facetQuery`, `publicApiRoutes.threads.experimentalExecutionPreflight`, `publicApiRoutes.threads.experimentalExecutionApply`, `publicApiRoutes.threads.facetParticipants`
  - Source: `packages/server-contract/src/public-api.ts`

### Other affected areas

- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `apps/app/src/components/sidebar/AppNavRail.test.tsx`, `apps/app/src/hooks/realtime-cache-effects.test.ts`, `apps/app/src/lib/plugin-sidebar-threads.test.ts`, `apps/server/test/providers/provider-model-catalog-store.test.ts`, `apps/server/test/public/public-thread-facets.test.ts`, `apps/server/test/services/p6r/native-acceptance.test.ts`, `apps/server/test/services/p6r/participant-watermarks.test.ts`, `apps/server/test/services/p6r/sidecar-built-artifact.test.ts`, `apps/server/test/services/p6r/sidecar-store.test.ts`, `apps/server/test/services/plugins/plugin-authoring-docs.test.ts`, `apps/server/test/services/plugins/plugin-presentation-context.test.ts`, `apps/server/test/services/plugins/thread-manager-native-parity.test.ts`, `apps/server/test/services/plugins/thread-progress-native-facet.test.ts`, `apps/server/test/services/threads/thread-execution-batch.test.ts`, `apps/server/test/services/threads/thread-execution-override.test.ts`, `apps/server/test/services/threads/thread-runtime-display.test.ts`, `packages/plugin-sdk/src/__tests__/frontend-exports.test.ts`, `packages/plugin-sdk/src/__tests__/public-types.test.ts`, `packages/plugin-sdk/src/testing/fake-plugin-host.ts`, `packages/sdk/test/public-types.test.ts`
- **Native client presentation and cache lifecycle. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `apps/app/src/components/sidebar/SidebarNavigationModel.tsx`, `apps/app/src/components/sidebar/useSidebarNavigationArrangement.ts`, `apps/app/src/hooks/cache-owners/realtime-cache-registry.ts`, `apps/app/src/lib/plugin-sidebar-threads.ts`, `apps/app/src/lib/plugin-slots.ts`
- **Dependency and package/export metadata needed by this capability.**
  - Why: Bind consumers and native/runtime prerequisites to the selected implementation rather than an unrelated ambient version.
  - Source: `apps/server/package.json`, `packages/plugin-sdk/package.json`, `pnpm-lock.yaml`
- **Server effect and read owners. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `apps/server/src/services/plugins/plugin-api.ts`, `apps/server/src/services/plugins/plugin-service.ts`, `apps/server/src/services/system/execution-options.ts`, `apps/server/src/services/threads/thread-execution-batch.ts`, `apps/server/src/services/threads/thread-execution-override.ts`, `apps/server/src/services/threads/thread-facet-query.ts`, `apps/server/src/services/threads/thread-runtime-display.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `apps/server/src/services/skills/builtin-skills/bb-plugin-authoring/references/identity-and-native-projections.md`, `docs/api_to_audit.md`, `plugins/bb-guide/skills/bb-plugin-authoring/SKILL.md`, `plugins/bb-guide/skills/bb-plugin-authoring/references/frontend-api-index.md`, `plugins/bb-guide/skills/bb-plugin-authoring/references/frontend-core-slots.md`, `plugins/bb-guide/skills/bb-plugin-authoring/references/identity-and-native-projections.md`
- **Native plugin-api-docs plugin. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `plugins/plugin-api-docs/src/surfaces.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- public-thread-facets.test.ts
- thread-execution-batch.test.ts
- thread-execution-override.test.ts
- participant-watermarks.test.ts
- thread-manager-native-parity.test.ts
- thread-progress-native-facet.test.ts
- plugin-presentation-context.test.ts
- AppNavRail.test.tsx
- realtime-cache-effects.test.ts

### Known limitations

- 0002 is a broad retained-feature port, not a single identity change. Its main surviving product capability is facets plus execution controls.
- 0006 preserves real plugin routes/presentation seams, despite the historical compatibility title; it is not evidence that arbitrary legacy shims are required.
- 0049 detects supported append/version changes; changing projector semantics must bump its version. A watermark is not immutable source evidence.

### Retirement condition

Retire the downstream implementation when upstream exposes equivalent server-owned facet/query/execution contracts and native sidebar composition, with plugin-consumer parity and retained projection migration. Remove watermarks only with an equally bounded read path or upstream equivalent.

<details><summary>Selected patches (7) and source binding</summary>

- [0002-feat-identity-retain-facets-and-execution-behavior.patch](patches/0002-feat-identity-retain-facets-and-execution-behavior.patch)
- [0003-test-identity-add-consumer-compatibility-witnesses.patch](patches/0003-test-identity-add-consumer-compatibility-witnesses.patch)
- [0006-fix-plugins-preserve-presentation-compatibility.patch](patches/0006-fix-plugins-preserve-presentation-compatibility.patch)
- [0007-feat-sidebar-expose-participants-and-guidance.patch](patches/0007-feat-sidebar-expose-participants-and-guidance.patch)
- [0008-fix-execution-invalidate-stale-execution-caches.patch](patches/0008-fix-execution-invalidate-stale-execution-caches.patch)
- [0018-feat-sidebar-add-native-layout-provider-seam.patch](patches/0018-feat-sidebar-add-native-layout-provider-seam.patch)
- [0049-perf-p6r-skip-participant-projection-rebuilds-for-un.patch](patches/0049-perf-p6r-skip-participant-projection-rebuilds-for-un.patch)

Reviewed source digest: `2163a09c633379f4a4df369065f45097cb5070cd810ab25a387b2ea457bce3f9`

</details>

<a id="message-acceptance-delivery"></a>
## Accept, queue, edit and retry messages without losing their original meaning

A slow, restarted or ambiguous operation must not silently change what the user accepted, duplicate a one-use effect, or erase the record needed to recover.

### What this delivers

- Native create/send/queue/edit/correction flows evaluate submissions under published message policies and retain operation identities, evaluations, immutable accepted originals, acknowledgements, advice and preparation state.
- Core admission owns acceptance and delivery transitions; plugins own evaluator logic within the published protocol. Accepted retries reuse the same operation; a separately evaluated correction has a distinct submission/revision.
- Queued external contributions retain their immutable reservation and turn-link history. Explicit queued delivery mode remains authoritative instead of being overwritten by frozen semantic intent.
- Reprovisioning retains accepted authors/editors and correlation. Cancelled historical revisions remain retained and are not accidentally revived. UI/CLI/SDK expose preparations and explicit repair/correction actions.
- Selected token/data-directory-bound test fault barriers can pause queue/parent-notification effect boundaries for restart tests; they are testing instrumentation, not a production workflow engine.

### Responsibility

- NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
- packages/db/src/data/message-admission.ts owns operations, publications, evaluations, originals and transition transactions.
- Thread queue/send/edit/provision owners perform the concrete effect under frozen accepted data; client submission-identity store preserves retry identity.

### Database model

- **Routes P6R input through native admission with stable operation/provenance and authored input, reuses retained P6R receipts, and reports accepted/evaluating/unresolved native outcomes as indeterminate after ambiguous failure.**
  - Why: An external contribution must use the same durable native admission owner rather than bypass policy or repeat a possibly accepted effect.
  - State/API identities: `createP6rNativeAcceptance`, `getMessageAdmissionService`, `lookupP6rOperationReceipt`
  - Source: `apps/server/src/services/p6r/native-acceptance.ts`
- **Preserves the execution group index when promoting an existing queued P6R reservation and exposes whether a retained attempt still awaits its native turn link. Reuses identity-owned sidecar tables without new DDL.**
  - Why: Active queued contributions and response-loss history must remain linked to their exact original operation/group while native execution catches up.
  - State/API identities: `promoteP6rQueuedOperationInTransaction`, `isP6rAttemptAwaitingNativeTurnLink`, `p6r_attempt_inputs.group_index`, `p6r_attempts.native_turn_id`
  - Source: `apps/server/src/services/p6r/sidecar-store.ts`
- **Restart/timer/wakeup recovery runner; in-memory singleflight maps and attempted-feedback set consume durable pending records.**
  - Why: Known, possible and uncertain effects must reconcile existing operations rather than repeat blindly.
  - State/API identities: `MessageAdmissionRecovery`, `preparations`, `feedback`, `attemptedFeedback`, `pendingAdmissionRecovery`
  - Source: `apps/server/src/services/threads/message-admission-recovery.ts`
- **Connects native runtime prepare/feedback ports to durable recovery; per-DB process runtime ownership.**
  - Why: Recover the same native preparation after service restart while preserving effect outcome uncertainty.
  - State/API identities: `configureNativeMessageAdmissionRuntime`
  - Source: `apps/server/src/services/threads/message-admission-runtime.ts`
- **Creates seven native-admission policy/operation/feedback/original/recheck tables and their indexes; extends queue rows with frozen intent/original metadata and threads with acceptance activity fields. Existing queue rows are frozen and scheduled_for is copied from send_at.**
  - Why: Durable operation identity, accepted originals and separate preparation/effect knowledge must survive retries, queueing and service restarts.
  - State/API identities: `message_admission_feedback`, `message_admission_feedback_recovery_idx`, `message_admission_feedback_assessment_idx`, `message_admission_operations`, `message_admission_operation_key_idx`, `message_admission_activity_idx`, `message_admission_accepted_original_idx`, `message_admission_recovery_idx`, `message_admission_providers`, `message_admission_publications`, `message_admission_publication_operation_idx`, `message_admission_rechecks`, `message_admission_request_originals`, `message_admission_request_thread_idx`, `message_admission_slots`, `message_admission_slots_project_idx`, `queued_thread_messages`, `threads`, `queued_thread_messages.join_state`, `queued_thread_messages.requested_intent`, `queued_thread_messages.effective_intent`, `queued_thread_messages.admission_ref`, `queued_thread_messages.original_manifest`, `queued_thread_messages.scheduled_for`, `threads.message_acceptance_sequence`, `threads.last_visible_human_accepted_at`, `threads.last_visible_human_original_id`, `threads.last_visible_human_revision`
  - Source: `packages/db/drizzle/0147_gorgeous_zarda.sql`
- **Adds message_admission_feedback_parent_state_idx over parent_operation_id, state and id.**
  - Why: Bound parent-scoped feedback recovery without rescanning unrelated feedback.
  - State/API identities: `message_admission_feedback_parent_state_idx`
  - Source: `packages/db/drizzle/0148_message_admission_feedback_parent.sql`
- **Creates message_admission_thread_creates with namespace/operation primary key and unique reserved thread ID, exact input fingerprint, owner token, native operation identity and retained outcome.**
  - Why: A lost first-create response must reconcile the reserved thread/operation rather than create another paid first turn.
  - State/API identities: `message_admission_thread_creates`, `message_admission_thread_create_thread_idx`
  - Source: `packages/db/drizzle/0149_black_lady_bullseye.sql`
- **Adds message_admission_preparation_thread_idx over thread_id, preparation_state and acceptance_sequence.**
  - Why: Bound thread-scoped pending preparation reads while preserving accepted sequence order.
  - State/API identities: `message_admission_preparation_thread_idx`
  - Source: `packages/db/drizzle/0150_condemned_morph.sql`
- **Broadens reads to DbQueryConnection for shared transaction/read context; no added table, column or persisted setting.**
  - Why: Allow coherent/batched execution/admission reads without inventing another settings authority.
  - State/API identities: `getAppSettings`
  - Source: `packages/db/src/data/app-settings.ts`
- **Reexports the capability-owned database operations or ID constructors: ./message-admission.js, ClaimedQueuedThreadMessageMutationArgs, CreateQueuedThreadMessageInput, CreateQueuedThreadMessageWithPlacementResult, QueuedThreadMessagePlacementWitness, captureQueuedThreadMessagePlacement, createQueuedThreadMessageWithPlacement, createQueuedThreadMessageWithPlacementInTransaction, deleteQueuedThreadMessageInTransaction, failClaimedQueuedThreadMessageGroup, listThreadQueueIncludingClaims, releaseQueuedMessageGroupClaim, updateQueuedThreadMessageInTransaction. This support boundary adds no independent table or migration.**
  - Why: Keep the database package entrypoint coherent with the owning state/query implementation and its consumers.
  - State/API identities: `./message-admission.js`, `ClaimedQueuedThreadMessageMutationArgs`, `CreateQueuedThreadMessageInput`, `CreateQueuedThreadMessageWithPlacementResult`, `QueuedThreadMessagePlacementWitness`, `captureQueuedThreadMessagePlacement`, `createQueuedThreadMessageWithPlacement`, `createQueuedThreadMessageWithPlacementInTransaction`, `deleteQueuedThreadMessageInTransaction`, `failClaimedQueuedThreadMessageGroup`, `listThreadQueueIncludingClaims`, `releaseQueuedMessageGroupClaim`, `updateQueuedThreadMessageInTransaction`
  - Source: `packages/db/src/data/index.ts`
- **Transactional operation/publication/acceptance/preparation/feedback/create-reservation data primitives.**
  - Why: Identity, exact input fingerprint, frozen policy basis and accepted originals survive client loss/restart; known versus possible effects remain distinct.
  - State/API identities: `reserveAdmissionOperation`, `acceptAdmissionOperation`, `transitionAdmissionPreparation`, `transitionAdmissionFeedback`, `reserveAdmissionThreadCreate`
  - Source: `packages/db/src/data/message-admission.ts`
- **Owns atomic queue placement, original-batch acceptance/edit/cancel and claim release/failure under retained admission references. Persists requested intent separately from effective delivery and preserves existing p6r_authors.**
  - Why: Queue joins, corrections and explicit queued delivery must retain original identity and authored intent across dispatch/retry.
  - State/API identities: `queued_thread_messages.join_state`, `queued_thread_messages.requested_intent`, `queued_thread_messages.effective_intent`, `queued_thread_messages.admission_ref`, `queued_thread_messages.original_manifest`, `queued_thread_messages.scheduled_for`, `queued_thread_messages.p6r_authors`, `createQueuedThreadMessageWithPlacementInTransaction`, `updateQueuedThreadMessageInTransaction`, `deleteQueuedThreadMessageInTransaction`, `releaseQueuedMessageGroupClaim`
  - Source: `packages/db/src/data/queued-thread-messages.ts`
- **Allows createThread to receive the thread ID already reserved by durable first-create admission. Existing callers still generate an ID when none is supplied. No execution-revision change is introduced here.**
  - Why: The acknowledged/recovered creation must identify the exact same thread as its retained first-create reservation.
  - State/API identities: `CreateThreadInput.id`, `createThread`
  - Source: `packages/db/src/data/threads.ts`
- **Reexports the capability-owned database operations or ID constructors: createThreadId. This support boundary adds no independent table or migration.**
  - Why: Keep the database package entrypoint coherent with the owning state/query implementation and its consumers.
  - State/API identities: `createThreadId`
  - Source: `packages/db/src/index.ts`
- **Adds eight message_admission_* tables and their indexes, six queued_thread_messages intent/admission/original/scheduling columns, and four threads acceptance/activity columns. Execution revision and P6R authorship already belong to shared-identity.**
  - Why: Persist accepted originals, policy basis, feedback, preparation/effect knowledge and first-create reservations under one native admission authority.
  - State/API identities: `message_admission_feedback`, `message_admission_operations`, `message_admission_providers`, `message_admission_publications`, `message_admission_rechecks`, `message_admission_request_originals`, `message_admission_slots`, `message_admission_thread_creates`, `message_admission_feedback_recovery_idx`, `message_admission_feedback_assessment_idx`, `message_admission_feedback_parent_state_idx`, `message_admission_operation_key_idx`, `message_admission_activity_idx`, `message_admission_accepted_original_idx`, `message_admission_recovery_idx`, `message_admission_preparation_thread_idx`, `message_admission_publication_operation_idx`, `message_admission_request_thread_idx`, `message_admission_slots_project_idx`, `message_admission_thread_create_thread_idx`, `threads.message_acceptance_sequence`, `threads.last_visible_human_accepted_at`, `threads.last_visible_human_original_id`, `threads.last_visible_human_revision`, `queued_thread_messages.join_state`, `queued_thread_messages.requested_intent`, `queued_thread_messages.effective_intent`, `queued_thread_messages.admission_ref`, `queued_thread_messages.original_manifest`, `queued_thread_messages.scheduled_for`
  - Source: `packages/db/src/schema.ts`
- **Generated state or contract artifacts accompany the owning schema/API change; repeated snapshots are not separate product capabilities.**
  - Why: Keep source, generated consumers and persisted-state receipts in one coherent cohort.
  - Source: `packages/db/drizzle/meta/0147_snapshot.json`, `packages/db/drizzle/meta/0148_snapshot.json`, `packages/db/drizzle/meta/0149_snapshot.json`, `packages/db/drizzle/meta/0150_snapshot.json`, `packages/db/drizzle/meta/_journal.json`

### Core SDK and APIs

- **Cross-thread queue now uses readThreadQueuedMessage(db,row).**
  - Why: Expose original-aware content/initialForkSeed consistently on global and per-thread queue reads. Contract obligations: No endpoint addition/removal; payload schema obligation belongs to domain/thread. Consumers: apps/server/src/services/threads/thread-queued-messages.ts.
  - Visibility: public
  - State/API identities: `registerQueueRoutes`
  - Source: `apps/server/src/routes/queue.ts`
- **Adds GET /api/v1/threads/:id/admission-operations, GET /api/v1/threads/:id/admission-operations/:admissionId and POST /api/v1/threads/:id/admission-operations/:admissionId/cancel. Existing send/edit/queue mutations use native acceptance and final dispositions.**
  - Why: Make accepted future work inspectable without replaying possible effects. Lists are bounded25 with response-byte limits; oversized items advise exact lookup. :admissionId is a thread-scoped journal ID. Cancellation requires matching pending/failed/uncertain state and never undoes earlier possible effects; claimed/busy delivery is refused.
  - Visibility: public
  - State/API identities: `registerThreadActionRoutes`
  - Source: `apps/server/src/routes/threads/actions.ts`
- **Existing per-thread queue reads reconstruct original-aware queued messages through readThreadQueuedMessage(db,row).**
  - Why: Return accepted originals and the initialForkSeed content rule consistently with the cross-thread queue. The context-magnet contributions endpoint is owned by context-prompts; this capability adds no new data-read route here.
  - Visibility: public
  - State/API identities: `registerThreadDataRoutes`
  - Source: `apps/server/src/routes/threads/data.ts`
- **Private P6rRawProtocol acceptance/lookup carries stable operation identity, submitted/rejected/indeterminate outcomes and native delivery references; externalContributions v1 preserves accepted-and-queued originals.**
  - Why: Connect integration identity evidence to the native acceptance owner without converting an unknown/pending operation into safe replay. This is a private Phosphor specialization, not a public Plugin SDK or REST addition.
  - Visibility: private
  - State/API identities: `P6rSendInput`, `P6rAcceptanceReceipt`, `P6rAcceptanceOutcome`, `P6rOperationLookup`, `P6rRawProtocol`
  - Source: `apps/server/src/services/p6r/identity-protocol.ts`
- **Implements injected NativeAdmissionProtocolV1: describe,registerEvaluator,unregisterEvaluator,publish,readActivePublication,lookupOperation,recheckOperation,previewPlacement,readOriginalManifest,readThreadActivity,listAcceptedActivity,submitFeedback.**
  - Why: One native owner reserves stable operations, evaluates once, commits accepted originals and records delivery/failure/uncertainty across replay/restart. Contract obligations: describe advertises protocol bb-message-admission versions[1], publication/operations/placement/originalManifest/activity and feedback only when recovery configured. Lookup does not replay evaluation/effects; restart marks interrupted evaluating records unresolved. No current evaluator plugin consumer was found by source rg in organization/community plugin trees; this audit establishes native implementation/injection and published contract, not live usage. Consumers: @phosphorco/bb-message-admission@0.1.0-alpha.2/protocol, apps/server/src/services/plugins/plugin-api.ts, apps/server/src/routes/threads/actions.ts.
  - Visibility: private
  - State/API identities: `MESSAGE_ADMISSION_LIMITS`, `NativeAdmissionInput`, `PreparedAdmissionTicket`, `PrepareAdmissionResult`, `AdmissionSinkResult`, `CommitAdmissionResult`, `MessageAdmissionService`, `getMessageAdmissionService`
  - Source: `apps/server/src/services/threads/message-admission.ts`
- **Exports createSubmissionIdentityStore from the client-core barrel.**
  - Why: Native/embedded/new-thread composer surfaces share one durable operation-identity implementation; the barrel adds no independent transport or effect authority.
  - Visibility: internal
  - State/API identities: `createSubmissionIdentityStore`
  - Source: `packages/client-core/src/index.ts`
- **New durable client operation store with prepare and settled; canonicalizes requests, isolates per-operation storage keys, bounds unresolved records128 and preserves exact authored/request transport identity.**
  - Why: Lost responses/cross-tab retries must reconcile the same operation rather than silently send a new message. Contract obligations: Storage failure/invalid/conflicting/ambiguous pending records fail clearly; old retained journal formats are read for browser-state migration, not public protocol shims. Consumers: apps/app/src/views/thread-detail/ThreadDetailPromptArea.tsx:530, packages/plugin-sdk/src/internal/composer-handle.ts.
  - Visibility: internal
  - State/API identities: `createSubmissionIdentityStore`
  - Source: `packages/client-core/src/prompt/submission-identity.ts`
- **Adds immutable original/revision/operation input manifest, explicit requested/effective delivery intent and shared queue placement/selection algebra.**
  - Why: Keep each authored input/source/identity distinct when acceptance, scheduling, batching and dispatch happen at different times. Contract obligations: Manifest1..256 originals, unique originalId; each contains rawInput, author/editor/source, acceptedAt and requested/effective intent. Modes send/steer/queue/queue-batched/schedule; ordinary/scheduled/legacy-unknown timing basis. A queue batch requires compatible execution and no scheduled/system/claimed/divider ambiguity. Queue helper functions are internal shared algebra exported by domain, not REST endpoints. Consumers: packages/domain/src/thread-events.ts, apps/server/src/services/threads/message-admission-placement.ts, apps/server/src/services/threads/message-originals.ts.
  - Visibility: public
  - State/API identities: `messageDeliveryIntentSchema`, `MessageDeliveryIntent`, `messageOriginalSchema`, `MessageOriginal`, `messageOriginalManifestSchema`, `MessageOriginalManifest`, `QueuePlacementMember`, `QueuePlacementCandidate`, `queueExecutionMatches`, `queueMemberTimingBasis`, `isScheduledQueueMember`, `partitionQueuePlacementMembers`, `isValidQueuePlacementGroup`, `QueuePlacementSelection`, `selectQueueBatchPlacement`, `selectAutomaticQueueGroup`
  - Source: `packages/domain/src/message-originals.ts`
- **Reexports message-originals models and shared queue placement algebra.**
  - Why: Queue and dispatch consumers use the same accepted-original/intent model. The optional p6rAuthors/p6rEditors fields on inline payloads are documented under shared-identity.
  - Visibility: public
  - State/API identities: `MessageOriginal`, `MessageOriginalManifest`, `MessageDeliveryIntent`, `selectQueueBatchPlacement`, `selectAutomaticQueueGroup`
  - Source: `packages/domain/src/queued-message.ts`
- **turnRequestEventDataSchema gains optional originalManifest containing each accepted original, revision, source and requested/effective intent.**
  - Why: Retain the original inputs behind a grouped provider request so retries/corrections cannot silently change accepted meaning. Actor/editor/mention array changes are described under shared-identity.
  - Visibility: public
  - State/API identities: `turnRequestEventDataSchema`
  - Source: `packages/domain/src/thread-events.ts`
- **ComposerSubmitOptions accepts optional stable operationId in either existing sendAt/experimental_data arm; submit retains opaque plugin data with canonical native input for reconciliation.**
  - Why: The caller can choose identity before a request is refused or its reply is lost. IDs must be nonblank<=200 and reused only for the same authored submission; feature-detect native admission before relying on reconciliation. Options still require sendAt or experimental_data, not operationId alone.
  - Visibility: public
  - State/API identities: `ComposerSubmitOptions.operationId`, `PluginComposerApi.submit`
  - Source: `packages/plugin-sdk/src/app-contract.ts`
- **Adds optional experimental_messageAdmission and dispatch-hook experimental_admission with phase prepared|accepted and preserved SubmissionV1 originals.**
  - Why: One native owner records acceptance and immutable publication; plugins evaluate the versioned contract rather than duplicate delivery state. experimental_submission still describes the initial plugin attempt; accepted retries use experimental_admission. The injected type comes from @phosphorco/bb-message-admission@0.1.0-alpha.2, not upstream BB.
  - Visibility: public
  - State/API identities: `BbPluginApi.experimental_messageAdmission`, `MessageDispatchHookContext.experimental_admission`
  - Source: `packages/plugin-sdk/src/backend-contract.ts`
- **Type-reexports NativeAdmissionProtocolV1 from @phosphorco/bb-message-admission/protocol.**
  - Why: The SDK depends on pinned Phosphor contract0.1.0-alpha.2 instead of copying its protocol declaration. This is an optional downstream injection capability; SDK version0.6.52 alone does not imply it exists.
  - Visibility: public
  - State/API identities: `NativeAdmissionProtocolV1`
  - Source: `packages/plugin-sdk/src/index.ts`
- **Captures submit options/plugin submission before awaiting; validates and forwards stable operationId.**
  - Why: Keep exactly the authored attempt when mutable caller objects or retries exist. Contract obligations: No additional public method; preserves existing composer availability and future-send validation. Consumers: packages/plugin-sdk/src/app-contract.ts.
  - Visibility: internal
  - State/API identities: `createComposerHandleBinding`
  - Source: `packages/plugin-sdk/src/internal/composer-handle.ts`
- **Adds experimental_listAdmissionPreparations, experimental_getAdmissionOperation and experimental_cancelAdmissionPreparation; existing sends forward operationId and correctionOf.**
  - Why: Native clients can reconcile exact accepted work before choosing a correction/cancellation. journalId maps to URL :admissionId, not authored operationId; cancel requires expectedState. Read AbortSignal is forwarded. Facet/execution and context-magnet methods are separate APIs.
  - Visibility: public
  - State/API identities: `ThreadsArea.experimental_listAdmissionPreparations`, `ThreadsArea.experimental_getAdmissionOperation`, `ThreadsArea.experimental_cancelAdmissionPreparation`
  - Source: `packages/sdk/src/areas/threads.ts`
- **Create/send/queue-create/queue-update requests accept operationId; send adds correctionOf. Send/edit/retry responses add delivery=preparing with a validated accepted native record; preparation reads/cancel use explicit state/journal models.**
  - Why: A caller must distinguish accepted preparation from sent/queued and reconcile the same authored operation after an ambiguous response. IDs are nonempty<=200; correctionOf binds exact OperationKey/OriginalRef from pinned Phosphor contract0.1.0-alpha.2. Preparing requires accepted status plus nonnull acceptedOriginal. States are pending,effect-possible,completed,failed,uncertain,cancelled; cancel accepts expected pending/failed/uncertain. Old exhaustive sent/queued clients must handle the new arm.
  - Visibility: public
  - State/API identities: `createThreadRequestSchema.operationId`, `sendMessageRequestSchema.operationId`, `messageCorrectionOfSchema`, `sendMessageDeliverySchema`, `sendMessageResponseSchema`, `editMessageResponseSchema`, `retryTurnResponseSchema`, `createQueuedMessageRequestSchema.operationId`, `updateQueuedMessageRequestSchema.operationId`, `threadAdmissionPreparationStateSchema`, `threadAdmissionOperationListQuerySchema`, `cancelThreadAdmissionPreparationRequestSchema`, `ThreadAdmissionOperationResponse`, `ThreadAdmissionOperationListResponse`
  - Source: `packages/server-contract/src/api/threads.ts`
- **Adds GET /api/v1/threads/:id/admission-operations, GET /api/v1/threads/:id/admission-operations/:admissionId and POST /api/v1/threads/:id/admission-operations/:admissionId/cancel.**
  - Why: Bind bounded list, exact journal lookup and expected-state cancellation to one typed REST contract. These paths inspect/cancel future accepted preparation; they do not replay evaluation or undo earlier effects.
  - Visibility: public
  - State/API identities: `publicApiRoutes.threads.admissionOperations`, `publicApiRoutes.threads.admissionOperation`, `publicApiRoutes.threads.cancelAdmissionPreparation`
  - Source: `packages/server-contract/src/public-api.ts`

### Other affected areas

- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `apps/app/src/components/plugin/PluginNewThreadComposer.test.tsx`, `apps/app/src/components/thread/ThreadAdmissionPreparations.test.tsx`, `apps/app/src/components/thread/embedded-chat/EmbeddedThreadChat.test.tsx`, `apps/app/src/hooks/mutations/thread-runtime-mutations.test.ts`, `apps/app/src/views/thread-detail/ThreadDetailPromptArea.keystrokes.test.tsx`, `apps/app/src/views/thread-detail/ThreadDetailPromptArea.test.tsx`, `apps/cli/src/__tests__/command-output/thread-correction.test.ts`, `apps/cli/src/__tests__/command-output/thread-organization.test.ts`, `apps/cli/src/__tests__/command-output/thread-tell.test.ts`, `apps/host-daemon/test/command/thread-dispatch.test.ts`, `apps/server/src/testing/test-fault-barriers.ts`, `apps/server/test/environments/environment-provisioning.test.ts`, `apps/server/test/helpers/seed.ts`, `apps/server/test/providers/provider-model-catalog-store.test.ts`, `apps/server/test/public/public-thread-compaction.test.ts`, `apps/server/test/public/public-thread-data.test.ts`, `apps/server/test/public/public-thread-fork.test.ts`, `apps/server/test/public/public-thread-offline-followup.test.ts`, `apps/server/test/public/public-thread-queued-steer-admission.p6r.test.ts`, `apps/server/test/services/p6r/external-contribution.test.ts`, `apps/server/test/services/p6r/identity-protocol.test.ts`, `apps/server/test/services/p6r/native-acceptance-admission.p6r.test.ts`, `apps/server/test/services/p6r/native-acceptance.test.ts`, `apps/server/test/services/p6r/native-message-authorship.test.ts`, `apps/server/test/services/plugins/plugin-authoring-docs.test.ts`, `apps/server/test/services/threads/message-admission.test.ts`, `apps/server/test/services/threads/message-originals.p6r.test.ts`, `apps/server/test/services/threads/test-fault-barriers.test.ts`, `apps/server/test/services/threads/thread-runtime-display.test.ts`, `apps/server/test/threads/deferred-first-turn-context.p6r.test.ts`, `apps/server/test/threads/dispatch-hooks.test.ts`, `apps/server/test/threads/environment-providers.test.ts`, `apps/server/test/threads/message-admission-permission.p6r.test.ts`, `apps/server/test/threads/message-admission-preparations.test.ts`, `apps/server/test/threads/message-admission-runtime.p6r.test.ts`, `apps/server/test/threads/message-correction.p6r.test.ts`, `apps/server/test/threads/message-original-delivery.p6r.test.ts`, `apps/server/test/threads/queued-message-admission.test.ts`, `apps/server/test/threads/queued-message-ingress-recovery.p6r.test.ts`, `apps/server/test/threads/queued-message-readiness.test.ts`, `apps/server/test/threads/requested-queue-drain.test.ts`, `apps/server/test/threads/thread-checkpoint-identity.test.ts`, `apps/server/test/threads/thread-create-idempotency.p6r.test.ts`, `apps/server/test/threads/thread-edit-message.test.ts`, `apps/server/test/threads/thread-send-dispatch.test.ts`, `apps/server/test/threads/thread-turn-dispatch.test.ts`, `apps/server/test/threads/turn-failed-retry.test.ts`, `packages/client-core/test/submission-identity.test.ts`, `packages/db/test/data/message-admission-thread-create.test.ts`, `packages/db/test/data/message-admission.test.ts`, `packages/db/test/data/queued-message-atomic-batch.p6r.test.ts`, `packages/db/test/data/queued-thread-messages.test.ts`, `packages/db/test/environment-classification-migration.test.ts`, `packages/db/test/helpers/rewind.ts`, `packages/db/test/migrate.test.ts`, `packages/db/test/thread-drafts-migration.test.ts`, `packages/domain/test/message-originals.p6r.test.ts`, `packages/plugin-build/src/zod-resolution.test.ts`, `packages/plugin-sdk/scripts/runtime-entries.test.mjs`, `packages/plugin-sdk/src/__tests__/public-types.test.ts`, `packages/plugin-sdk/src/internal/composer-handle.test.ts`, `packages/sdk/test/public-types.test.ts`, `packages/sdk/test/sdk.test.ts`, `packages/server-contract/test/contract.test.ts`, `packages/templates/test/plugin-scaffold-external.test.ts`, `packages/thread-view/test/message-originals.p6r.test.ts`
- **Native client presentation and cache lifecycle. Native create/send/queue/edit/correction flows evaluate submissions under published message policies and retain operation identities, evaluations, immutable accepted originals, acknowledgements, advice and preparation state.**
  - Why: NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle. packages/db/src/data/message-admission.ts owns operations, publications, evaluations, originals and transition transactions. Thread queue/send/edit/provision owners perform the concrete effect under frozen accepted data; client submission-identity store preserves retry identity.
  - Source: `apps/app/src/components/promptbox/NewThreadComposer.tsx`, `apps/app/src/components/thread/ThreadAdmissionPreparations.tsx`, `apps/app/src/components/thread/embedded-chat/EmbeddedThreadChat.tsx`, `apps/app/src/components/thread/thread-admission-correction.ts`, `apps/app/src/hooks/cache-owners/cache-invalidation-groups.ts`, `apps/app/src/hooks/cache-owners/thread-runtime-cache-owner.ts`, `apps/app/src/hooks/mutations/thread-runtime-mutations.ts`, `apps/app/src/hooks/queries/query-keys.ts`, `apps/app/src/views/thread-detail/ThreadDetailPromptArea.tsx`
- **CLI operations and output. Native create/send/queue/edit/correction flows evaluate submissions under published message policies and retain operation identities, evaluations, immutable accepted originals, acknowledgements, advice and preparation state.**
  - Why: NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle. packages/db/src/data/message-admission.ts owns operations, publications, evaluations, originals and transition transactions. Thread queue/send/edit/provision owners perform the concrete effect under frozen accepted data; client submission-identity store preserves retry identity.
  - Source: `apps/cli/src/commands/thread/actions.ts`, `apps/cli/src/commands/thread/organization.ts`
- **Dependency and package/export metadata needed by this capability.**
  - Why: Bind consumers and native/runtime prerequisites to the selected implementation rather than an unrelated ambient version.
  - Source: `apps/server/package.json`, `packages/plugin-sdk/package.json`, `packages/server-contract/package.json`, `pnpm-lock.yaml`
- **Server effect and read owners. Native create/send/queue/edit/correction flows evaluate submissions under published message policies and retain operation identities, evaluations, immutable accepted originals, acknowledgements, advice and preparation state.**
  - Why: NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle. packages/db/src/data/message-admission.ts owns operations, publications, evaluations, originals and transition transactions. Thread queue/send/edit/provision owners perform the concrete effect under frozen accepted data; client submission-identity store preserves retry identity.
  - Source: `apps/server/src/services/plugins/plugin-api.ts`, `apps/server/src/services/plugins/plugin-runtime.ts`, `apps/server/src/services/threads/child-thread-notifications.ts`, `apps/server/src/services/threads/deferred-first-turn-context.ts`, `apps/server/src/services/threads/dispatch-attempt.ts`, `apps/server/src/services/threads/dispatch-hooks.ts`, `apps/server/src/services/threads/message-admission-capture.ts`, `apps/server/src/services/threads/message-admission-create-binding.ts`, `apps/server/src/services/threads/message-admission-dispatch.ts`, `apps/server/src/services/threads/message-admission-input.ts`, `apps/server/src/services/threads/message-admission-placement.ts`, `apps/server/src/services/threads/message-admission-queue-edit.ts`, `apps/server/src/services/threads/message-originals.ts`, `apps/server/src/services/threads/queue-drain-failure.ts`, `apps/server/src/services/threads/queue-waits.ts`, `apps/server/src/services/threads/queued-message-dispatch.ts`, `apps/server/src/services/threads/queued-messages.ts`, `apps/server/src/services/threads/thread-commands.ts`, `apps/server/src/services/threads/thread-create-helpers.ts`, `apps/server/src/services/threads/thread-create-request.ts`, `apps/server/src/services/threads/thread-create.ts`, `apps/server/src/services/threads/thread-edit-message.ts`, `apps/server/src/services/threads/thread-events.ts`, `apps/server/src/services/threads/thread-execution-plan.ts`, `apps/server/src/services/threads/thread-lifecycle.ts`, `apps/server/src/services/threads/thread-provisioning.ts`, `apps/server/src/services/threads/thread-queued-messages.ts`, `apps/server/src/services/threads/thread-send-request.ts`, `apps/server/src/services/threads/thread-send.ts`, `apps/server/src/services/threads/thread-turn-dispatch.ts`, `apps/server/src/services/threads/turn-retry.ts`, `apps/server/src/start-server.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `docs/api_to_audit.md`, `packages/templates/src/templates/bb-guide-thread-messaging.md`, `plugins/bb-guide/skills/bb-cli/references/command-index.md`, `plugins/bb-guide/skills/bb-plugin-authoring/SKILL.md`
- **plugin-sdk package integration. Native create/send/queue/edit/correction flows evaluate submissions under published message policies and retain operation identities, evaluations, immutable accepted originals, acknowledgements, advice and preparation state.**
  - Why: NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle. packages/db/src/data/message-admission.ts owns operations, publications, evaluations, originals and transition transactions. Thread queue/send/edit/provision owners perform the concrete effect under frozen accepted data; client submission-identity store preserves retry identity.
  - Source: `packages/plugin-sdk/scripts/build-bundled-dts.mjs`, `packages/plugin-sdk/scripts/runtime-entries.mjs`
- **thread-view package integration. Native create/send/queue/edit/correction flows evaluate submissions under published message policies and retain operation identities, evaluations, immutable accepted originals, acknowledgements, advice and preparation state.**
  - Why: NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle. packages/db/src/data/message-admission.ts owns operations, publications, evaluations, originals and transition transactions. Thread queue/send/edit/provision owners perform the concrete effect under frozen accepted data; client submission-identity store preserves retry identity.
  - Source: `packages/thread-view/src/event-projection-message.ts`, `packages/thread-view/src/user-message-parsing.ts`
- **Native plugin-api-docs plugin. Native create/send/queue/edit/correction flows evaluate submissions under published message policies and retain operation identities, evaluations, immutable accepted originals, acknowledgements, advice and preparation state.**
  - Why: NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle. packages/db/src/data/message-admission.ts owns operations, publications, evaluations, originals and transition transactions. Thread queue/send/edit/provision owners perform the concrete effect under frozen accepted data; client submission-identity store preserves retry identity.
  - Source: `plugins/plugin-api-docs/src/surfaces.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- message-admission.test.ts
- message-admission-runtime.p6r.test.ts
- message-original-delivery.p6r.test.ts
- message-correction.p6r.test.ts
- queued-message-admission.test.ts
- queued-message-ingress-recovery.p6r.test.ts
- public-thread-queued-steer-admission.p6r.test.ts
- thread-create-idempotency.p6r.test.ts
- ThreadAdmissionPreparations.test.tsx
- test-fault-barriers.test.ts

### Known limitations

- 0073 is the largest cross-cutting patch: 149 paths, including migrations, protocol package integration, native effects and composer surfaces. A catalog should not hide it under a generic identity label.
- 0036 adds runtime code, but it is selected test instrumentation. 0043 is a dispatch-result contract test, not a new dispatch feature.
- Acceptance, provider admission and model consumption are separate facts. No catalog sentence should equate them.

### Retirement condition

Retire only after upstream has one equivalent durable native admission/delivery owner, all ingress surfaces use it, accepted originals/revisions are preserved, and restart/uncertain-effect/queue correction tests pass against migrated history.

<details><summary>Selected patches (8) and source binding</summary>

- [0010-fix-agent-connect-preserve-active-external-queues.patch](patches/0010-fix-agent-connect-preserve-active-external-queues.patch)
- [0011-fix-agent-connect-retain-pending-call-history.patch](patches/0011-fix-agent-connect-retain-pending-call-history.patch)
- [0036-test-perspectives-add-live-restart-fault-barriers.patch](patches/0036-test-perspectives-add-live-restart-fault-barriers.patch)
- [0043-test-host-retain-dispatch-result-contract.patch](patches/0043-test-host-retain-dispatch-result-contract.patch)
- [0064-fix-p6r-preserve-acceptance-during-reprovisioning.patch](patches/0064-fix-p6r-preserve-acceptance-during-reprovisioning.patch)
- [0073-feat-native-message-admission-and-original-delivery.patch](patches/0073-feat-native-message-admission-and-original-delivery.patch)
- [0074-fix-retain-cancelled-historical-revision-identity.patch](patches/0074-fix-retain-cancelled-historical-revision-identity.patch)
- [0078-fix-honor-explicit-queued-delivery-mode.patch](patches/0078-fix-honor-explicit-queued-delivery-mode.patch)

Reviewed source digest: `405f0c7958a511b6a9dfc9c72504f6e68aa694ec61cbdadb724d009f83edf0d1`

</details>

<a id="context-prompts"></a>
## Explain and customize the context sent to an agent

Context assembly should be inspectable and customizable at named producer boundaries, with evidence that says precisely what was constructed, accepted or consumed.

### What this delivers

- Context Magnet retains explicit bounded host-supplied contribution declarations, trace records, immutable pagination bounds and model receipt-tool consumption evidence.
- Host-created attempt IDs and append-only constructed/accepted/failed-settlement observations preserve provider admission without claiming model consumption. Nonempty validated provider IDs establish acceptance; later bookkeeping cannot contradict it.
- Synchronous plugin prompt middleware and observers share the same renderer as adapted server-owned instruction, message/template, tool-description and schema-description producers. Structured request context stays separate from rendered text.
- Contribution lookup selects metadata first and decodes only matched physical rows, preserving replacement semantics and row ordering. It still performs global metadata work; it is not an indexed all-purpose history engine.

### Responsibility

- DB Context Magnet trace/history functions own retained evidence and bounded reads.
- Agent runtime/provider bridge owns construction/admission observations; server combines these without promoting evidence strength.
- Prompt renderer/plugin generation registry owns synchronous rendering, disposal, middleware order and observations.
- P6R sidecar-store owns exact contribution lookup and payload decoding.

### Database model

- **Changes listP6rContributions to scan contribution/replacement metadata once, then decode only selected physical rows while preserving replacement filtering and row order. No schema or receipt/namespace lifecycle changes are introduced here.**
  - Why: Avoid decoding unrelated retained payloads for exact-reference reads; global metadata work remains and is not an indexed history lookup.
  - State/API identities: `listP6rContributions`, `p6r_contributions.id`, `p6r_contributions.thread_id`, `p6r_contributions.replaces_contribution_id`
  - Source: `apps/server/src/services/p6r/sidecar-store.ts`
- **Owns seven Context Magnet evidence tables, stable snapshot high-watermark reads capped at 100 rows with 15-minute cursors, and newest-16 admission attempts per contribution with explicit prune counts.**
  - Why: Explain constructed/accepted/settled evidence without equating transport acceptance with model consumption; retain pagination/retention gaps. The separately stated multi-thread observation-sequence constraint defect remains unresolved.
  - State/API identities: `context_magnet_contribution_trace_receipts`, `context_magnet_contribution_trace_snapshots`, `context_magnet_contribution_traces`, `context_magnet_provider_admission_attempts`, `context_magnet_provider_admission_observations`, `context_magnet_provider_admission_retention`, `context_magnet_provider_admission_sequences`, `appendContextMagnetContributionTrace`, `recordContextMagnetContributionReceipt`, `createContextMagnetProviderAdmission`, `appendContextMagnetProviderAdmissionObservations`, `listContextMagnetContributionTracePage`, `pruneContextMagnetContributionTraces`, `PAGE_SIZE_MAX`, `SNAPSHOT_MAX_AGE_MS`
  - Source: `packages/db/src/data/context-magnet-contribution-traces.ts`
- **Reexports the capability-owned database operations or ID constructors: appendContextMagnetContributionTrace, appendContextMagnetProviderAdmissionObservations, createContextMagnetProviderAdmission, listContextMagnetContributionTracePage, pruneContextMagnetContributionTraces, recordContextMagnetContributionReceipt. This support boundary adds no independent table or migration.**
  - Why: Keep the database package entrypoint coherent with the owning state/query implementation and its consumers.
  - State/API identities: `appendContextMagnetContributionTrace`, `appendContextMagnetProviderAdmissionObservations`, `createContextMagnetProviderAdmission`, `listContextMagnetContributionTracePage`, `pruneContextMagnetContributionTraces`, `recordContextMagnetContributionReceipt`
  - Source: `packages/db/src/data/index.ts`
- **Defines the cmct contribution-trace and cmad provider-admission ID constructors; this file creates IDs rather than reexporting them. No table or migration is added here.**
  - Why: Distinct record identities let retained traces and admission attempts be joined without conflating their scopes.
  - State/API identities: `createContextMagnetContributionTraceId`, `createContextMagnetProviderAdmissionId`
  - Source: `packages/db/src/ids.ts`
- **Reexports the capability-owned database operations or ID constructors: createContextMagnetContributionTraceId. This support boundary adds no independent table or migration.**
  - Why: Keep the database package entrypoint coherent with the owning state/query implementation and its consumers.
  - State/API identities: `createContextMagnetContributionTraceId`
  - Source: `packages/db/src/index.ts`
- **Adds seven context_magnet_* trace/receipt/snapshot/admission/retention/sequence tables and eight explicit indexes. Existing threads is an FK target, not a model changed by this capability.**
  - Why: Keep contribution, receipt and provider-admission evidence with snapshot and retention bounds, independently of native message acceptance.
  - State/API identities: `context_magnet_contribution_trace_receipts`, `context_magnet_contribution_trace_snapshots`, `context_magnet_contribution_traces`, `context_magnet_provider_admission_attempts`, `context_magnet_provider_admission_observations`, `context_magnet_provider_admission_retention`, `context_magnet_provider_admission_sequences`, `context_magnet_trace_receipt_contribution_idx`, `context_magnet_trace_snapshot_thread_idx`, `context_magnet_trace_thread_sequence_idx`, `context_magnet_trace_thread_operation_idx`, `context_magnet_admission_attempt_contribution_idx`, `context_magnet_admission_attempt_thread_sequence_idx`, `context_magnet_admission_observation_thread_idx`, `context_magnet_admission_retention_thread_idx`
  - Source: `packages/db/src/schema.ts`

### Core SDK and APIs

- **Adds GET /api/v1/threads/:id/context-magnet/contributions with validated cursor and limit.**
  - Why: Return a retained, snapshot-bound diagnostic page after checking the public thread. Completeness, gaps and consumption evidence remain explicit; original-aware queue projection changes belong to message-acceptance-delivery.
  - Visibility: public
  - State/API identities: `registerThreadDataRoutes`
  - Source: `apps/server/src/routes/threads/data.ts`
- **Forwards contextMagnetAdmissionAttempts on start/resume/fork provider construction.**
  - Why: Preserve host-created admission attempt/contribution references across the adapter without treating successful transport as model consumption. This is implementation forwarding of the changed bridge contract, not a new public method.
  - Visibility: internal
  - State/API identities: `createBridgeProtocolAdapter`
  - Source: `packages/agent-runtime/src/bridge-protocol-adapter.ts`
- **Exports new settlement result type.**
  - Why: Allow host daemon to consume runtime admission outcome shape. Consumers: packages/agent-runtime/src/types.ts.
  - Visibility: internal
  - State/API identities: `StartThreadSettlementResult`
  - Source: `packages/agent-runtime/src/index.ts`
- **AdapterCommand thread/start,resume,fork variants accept optional contextMagnetAdmissionAttempts.**
  - Why: Keep trace attempt identity attached to provider construction through the existing command owner. Resume constructionDeadlineAtMs is a separate provider-budget change.
  - Visibility: internal
  - State/API identities: `AdapterCommand`
  - Source: `packages/agent-runtime/src/provider-adapter.ts`
- **StartThreadArgs gains optional contextMagnetAdmissionAttempts. AgentRuntime adds optional startThreadWithSettlement returning started/failed plus admission observations; existing startThread remains.**
  - Why: Observe provider construction/acceptance explicitly without forcing every runtime caller onto a new method. Started may include sessionRestorable; failed has no providerThreadId. Env secret provenance is a separate runtime contract.
  - Visibility: internal
  - State/API identities: `StartThreadArgs.contextMagnetAdmissionAttempts`, `StartThreadSettlementResult`, `AgentRuntime.startThreadWithSettlement`
  - Source: `packages/agent-runtime/src/types.ts`
- **Adds versioned context-magnet trace carrier and provider admission receipts, operation attachment, provenance, outcome, consumption evidence, retention gaps and high-watermark snapshot pagination.**
  - Why: Distinguish contribution delivery, provider construction/acceptance, model consumption and absence of evidence instead of asserting one from another. Contract obligations: Wire versions context-magnet.trace-carrier/v1 and context-magnet.provider-admission/v1; admissions<=16, observations<=3 per attempt. Constructed/accepted is not consumed; consumption requires its own model-owned receipt or host-observed evidence. Traces preserve safe evidence with explicit redactions/unknown fields and bounded arrays/text; no body capture is implied. No current organization/community plugin caller of experimental_contextMagnetTrace or contributions read was found outside guide references in this checkout; native provider code is instrumented. Consumers: packages/server-contract/src/api/threads.ts, packages/plugin-sdk/src/backend-contract.ts, apps/server/src/routes/threads/data.ts, apps/server/src/services/p6r/provider-admission.ts.
  - Visibility: public
  - State/API identities: `contextMagnetContributionKeySchema`, `contextMagnetOperationKeySchema`, `contextMagnetOperationAttachmentSchema`, `contextMagnetTriggerProvenanceSchema`, `contextMagnetInclusionReasonSchema`, `contextMagnetContributionOutcomeSchema`, `contextMagnetConsumptionEvidenceSchema`, `contextMagnetPreservedEvidenceSchema`, `contextMagnetProviderAdmissionSchema`, `contextMagnetContributionTraceSchema`, `contextMagnetRetainedFromSchema`, `contextMagnetTraceGapSchema`, `contextMagnetContributionTracePageSchema`, `contextMagnetContributionTraceDeclarationSchema`, `ContextMagnetContributionTrace`, `ContextMagnetContributionTraceDeclaration`, `ContextMagnetContributionTracePage`, `ContextMagnetProviderAdmission`, `ContextMagnetAdmissionObservation`
  - Source: `packages/domain/src/context-magnet-contribution-trace.ts`
- **Exports the new context-magnet-contribution-trace models from the domain barrel.**
  - Why: Plugin configuration, native bridge/daemon receipts and retained diagnostic readers share the versioned trace schemas; the barrel adds no independent endpoint.
  - Visibility: public
  - State/API identities: `ContextMagnetContributionTrace`, `ContextMagnetContributionTraceDeclaration`, `ContextMagnetContributionTracePage`, `ContextMagnetProviderAdmission`, `ContextMagnetAdmissionObservation`
  - Source: `packages/domain/src/index.ts`
- **thread.start accepts up to16 contextMagnetAdmissionAttempts and returns a started/failed union with up to32 constructed/accepted/failed-settlement observations. thread.rewind.prepare retains its separate bare providerThreadId result.**
  - Why: The server needs honest provider admission receipts even when construction fails. The old bare thread.start result no longer meets this daemon schema. This is protocol240 cohort work; secret provenance and required external model catalog are documented under their own capabilities.
  - Visibility: internal
  - State/API identities: `threadStartCommandSchema`, `threadStartAdmissionObservationSchema`, `threadStartResultSchema`, `threadRewindPrepareResultSchema`, `hostDaemonCommandRegistry`
  - Source: `packages/host-daemon-contract/src/commands.ts`
- **Adds experimental_p6rPrompts (registerMiddleware,observe,render,renderTemplate), typed prompt context/slots/observations and optional PluginAgentConfiguration.experimental_contextMagnetTrace.**
  - Why: Prompt Rules transforms/samples the same synchronous native renderer. Middleware failure falls back to original text and protected slots remain intact; an observation does not prove consumption. Trace declarations identify selected receipt tools and bounded evidence; they do not grant actor or routing authority.
  - Visibility: public
  - State/API identities: `PluginAgentConfiguration.experimental_contextMagnetTrace`, `P6rPromptContext`, `P6rPromptSlot`, `P6rPromptRequest`, `P6rPromptMiddleware`, `P6rPromptObservation`, `ExperimentalP6rPrompts`, `BbPluginApi.experimental_p6rPrompts`
  - Source: `packages/plugin-sdk/src/backend-contract.ts`
- **normalizePluginAgentConfiguration accepts and validates experimental_contextMagnetTrace.**
  - Why: A declaration must select its receiptTool, use an unmatched/null-target operation witness and avoid provider/request-body evidence. Current body-key collection restrictions are distinct from authentication-secret masking. Provider env validation is owned by diagnostic-environment.
  - Visibility: internal
  - State/API identities: `normalizePluginAgentConfiguration`
  - Source: `packages/plugin-sdk/src/internal/host-policy.ts`
- **New synchronous renderer behind ./internal/p6r-prompt-rendering: ordered middleware, observers, protected slots, immutable observations, recursion/next-once validation and logged default fallback.**
  - Why: Centralize prompt transformation rules so native producers and plugins share semantics. Contract obligations: Non-string/async middleware fails to original text; observer failure logs without changing rendered text. A rendering observation is not a receipt that provider consumed the text. Consumers: apps/server/src/services/plugins/plugin-api.ts, apps/server/src/services/prompts/render-prompt.ts:21.
  - Visibility: internal
  - State/API identities: `P6rPromptProvider`, `validateP6rPromptRequest`, `createP6rPromptRenderer`
  - Source: `packages/plugin-sdk/src/internal/p6r-prompt-rendering.ts`
- **Start/resume/fork construction requests gain optional contextMagnetAdmissionAttempts; threadConstructionResultSchema accepts structured started/failed settlements plus the original bare threadIdentityResultSchema.**
  - Why: Carry up to16 attempts and32 observations without discarding failed admission facts. Constructed/accepted is not consumed. Structured started includes providerThreadId and optional sessionRestorable; failed includes observations. The bare bridge result remains supported, unlike the stricter daemon thread.start result.
  - Visibility: internal
  - State/API identities: `threadStartParamsSchema`, `threadResumeParamsSchema`, `threadForkParamsSchema`, `threadConstructionResultSchema`
  - Source: `packages/provider-bridge-protocol/src/requests.ts`
- **Adds experimental_contextMagnetContributions({threadId,cursor?,limit?,signal?}) and its ContextMagnetContributionsArgs/result type.**
  - Why: Read retained context evidence through the shared versioned carrier rather than infer it from prompt rendering. The SDK forwards AbortSignal and query paging. Facet/execution/admission journal APIs do not belong to this method.
  - Visibility: public
  - State/API identities: `ContextMagnetContributionsArgs`, `ThreadsArea.experimental_contextMagnetContributions`
  - Source: `packages/sdk/src/areas/threads.ts`
- **Adds strict contextMagnetContributionTraceQuerySchema with optional cursor<=512 and numeric limit1..100.**
  - Why: Bound the retained trace-page read independently of thread events or operation recovery. Responses use the shared ContextMagnetContributionTracePage carrier; this query adds no admission/execution mutation.
  - Visibility: public
  - State/API identities: `contextMagnetContributionTraceQuerySchema`
  - Source: `packages/server-contract/src/api/threads.ts`
- **Adds GET /api/v1/threads/:id/context-magnet/contributions with validated optional query and ContextMagnetContributionTracePage response.**
  - Why: Keep SDK and runtime trace pagination bound to the same versioned evidence schema, including explicit completeness/retention/consumption gaps.
  - Visibility: public
  - State/API identities: `publicApiRoutes.threads.contextMagnetContributions`
  - Source: `packages/server-contract/src/public-api.ts`
- **Exports the new raw/body renderer alongside existing renderTemplate.**
  - Why: Allow native producers and plugin prompt seam to use one renderer. Consumers: packages/templates/src/render-template.ts.
  - Visibility: internal
  - State/API identities: `getTemplateBody`, `renderTemplateText`
  - Source: `packages/templates/src/index.ts`
- **Adds raw template lookup and pure arbitrary Handlebars rendering with noEscape/trim.**
  - Why: Let native prompt producers enter the common synchronous prompt middleware without duplicating templates. Contract obligations: Existing renderTemplate remains; no template ID removal. Consumers: packages/templates/src/index.ts, apps/server/src/services/prompts/render-prompt.ts:21.
  - Visibility: internal
  - State/API identities: `getTemplateBody`, `renderTemplateText`
  - Source: `packages/templates/src/render-template.ts`

### Other affected areas

- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB Context Magnet trace/history functions own retained evidence and bounded reads.
  - Source: `apps/host-daemon/src/command-dispatch.test.ts`, `apps/server/src/services/prompts/render-prompt.test.ts`, `apps/server/test/helpers/commands.ts`, `apps/server/test/prompts/render-tool-prompts.test.ts`, `apps/server/test/public/public-thread-data.test.ts`, `apps/server/test/services/p6r/contribution-lookup.test.ts`, `apps/server/test/services/plugins/plugin-agent-tools.test.ts`, `apps/server/test/services/plugins/plugin-authoring-docs.test.ts`, `apps/server/test/services/plugins/plugin-sdk.test.ts`, `apps/server/test/services/plugins/plugin-service.test.ts`, `apps/server/test/services/prompts/producer-adapters.test.ts`, `apps/server/test/threads/prompt-message-rendering.test.ts`, `apps/server/test/threads/thread-lifecycle-admission.test.ts`, `apps/server/test/threads/thread-ownership-debounce.test.ts`, `apps/server/test/threads/thread-runtime-config.test.ts`, `apps/server/test/threads/thread-send-dispatch.test.ts`, `packages/db/test/data/context-magnet-contribution-traces.test.ts`, `packages/domain/test/context-magnet-contribution-trace.test.ts`, `packages/host-daemon-contract/test/contract.test.ts`, `packages/plugin-sdk/src/__tests__/context-magnet-host-policy.test.ts`, `packages/plugin-sdk/src/__tests__/package-exports.test.ts`, `packages/plugin-sdk/src/__tests__/public-types.test.ts`, `packages/plugin-sdk/src/testing/__tests__/fake-plugin-host.test.ts`, `packages/plugin-sdk/src/testing/fake-plugin-host.ts`, `packages/sdk/test/node-entry.test.ts`, `packages/sdk/test/public-types.test.ts`, `packages/templates/test/templates.test.ts`, `plugins/provider-codex/src/bridge/app-server-connection.test.ts`, `plugins/provider-codex/src/bridge/bridge.admission.test.ts`, `plugins/provider-codex/src/bridge/bridge.archive-idempotency.test.ts`, `plugins/provider-codex/src/bridge/bridge.recovery.test.ts`, `plugins/provider-codex/src/bridge/bridge.writer-lock.test.ts`, `plugins/provider-codex/src/bridge/bridge.zero-work-turn.test.ts`
- **Host execution and server/daemon transport. Context Magnet retains explicit bounded host-supplied contribution declarations, trace records, immutable pagination bounds and model receipt-tool consumption evidence.**
  - Why: DB Context Magnet trace/history functions own retained evidence and bounded reads. Agent runtime/provider bridge owns construction/admission observations; server combines these without promoting evidence strength. Prompt renderer/plugin generation registry owns synchronous rendering, disposal, middleware order and observations. P6R sidecar-store owns exact contribution lookup and payload decoding.
  - Source: `apps/host-daemon/src/command-handlers/thread.ts`
- **Server effect and read owners. Context Magnet retains explicit bounded host-supplied contribution declarations, trace records, immutable pagination bounds and model receipt-tool consumption evidence.**
  - Why: DB Context Magnet trace/history functions own retained evidence and bounded reads. Agent runtime/provider bridge owns construction/admission observations; server combines these without promoting evidence strength. Prompt renderer/plugin generation registry owns synchronous rendering, disposal, middleware order and observations. P6R sidecar-store owns exact contribution lookup and payload decoding.
  - Source: `apps/server/src/internal/tool-calls.ts`, `apps/server/src/server.ts`, `apps/server/src/services/ai/commit-message.ts`, `apps/server/src/services/plugins/plugin-agent-contributions.ts`, `apps/server/src/services/plugins/plugin-api.ts`, `apps/server/src/services/plugins/plugin-mentions.ts`, `apps/server/src/services/plugins/plugin-service-internal.ts`, `apps/server/src/services/plugins/plugin-service.ts`, `apps/server/src/services/prompts/render-instruction-prompts.ts`, `apps/server/src/services/prompts/render-prompt.ts`, `apps/server/src/services/prompts/render-tool-prompts.ts`, `apps/server/src/services/threads/child-thread-notifications.ts`, `apps/server/src/services/threads/parent-system-messages.ts`, `apps/server/src/services/threads/thread-commands.ts`, `apps/server/src/services/threads/thread-edit-message.ts`, `apps/server/src/services/threads/thread-lifecycle.ts`, `apps/server/src/services/threads/thread-ownership.ts`, `apps/server/src/services/threads/thread-runtime-config.ts`, `apps/server/src/services/threads/thread-send.ts`, `apps/server/src/services/threads/title-generation.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `docs/api_to_audit.md`, `plugins/bb-guide/skills/bb-plugin-authoring/references/backend-api-index.md`
- **agent-runtime package integration. Context Magnet retains explicit bounded host-supplied contribution declarations, trace records, immutable pagination bounds and model receipt-tool consumption evidence.**
  - Why: DB Context Magnet trace/history functions own retained evidence and bounded reads. Agent runtime/provider bridge owns construction/admission observations; server combines these without promoting evidence strength. Prompt renderer/plugin generation registry owns synchronous rendering, disposal, middleware order and observations. P6R sidecar-store owns exact contribution lookup and payload decoding.
  - Source: `packages/agent-runtime/src/runtime.ts`
- **Dependency and package/export metadata needed by this capability.**
  - Why: Bind consumers and native/runtime prerequisites to the selected implementation rather than an unrelated ambient version.
  - Source: `packages/plugin-sdk/package.json`
- **Native plugin-api-docs plugin. Context Magnet retains explicit bounded host-supplied contribution declarations, trace records, immutable pagination bounds and model receipt-tool consumption evidence.**
  - Why: DB Context Magnet trace/history functions own retained evidence and bounded reads. Agent runtime/provider bridge owns construction/admission observations; server combines these without promoting evidence strength. Prompt renderer/plugin generation registry owns synchronous rendering, disposal, middleware order and observations. P6R sidecar-store owns exact contribution lookup and payload decoding.
  - Source: `plugins/plugin-api-docs/src/surfaces.ts`
- **Native provider-codex plugin. Context Magnet retains explicit bounded host-supplied contribution declarations, trace records, immutable pagination bounds and model receipt-tool consumption evidence.**
  - Why: DB Context Magnet trace/history functions own retained evidence and bounded reads. Agent runtime/provider bridge owns construction/admission observations; server combines these without promoting evidence strength. Prompt renderer/plugin generation registry owns synchronous rendering, disposal, middleware order and observations. P6R sidecar-store owns exact contribution lookup and payload decoding.
  - Source: `plugins/provider-codex/src/bridge/app-server-connection.ts`, `plugins/provider-codex/src/bridge/bridge.ts`, `plugins/provider-codex/src/bridge/fake-codex-app-server.mjs`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- context-magnet-contribution-traces.test.ts
- thread-lifecycle-admission.test.ts
- bridge.admission.test.ts
- render-prompt.test.ts
- render-tool-prompts.test.ts
- producer-adapters.test.ts
- prompt-message-rendering.test.ts
- contribution-lookup.test.ts

### Known limitations

- The fork does not claim capture of every possible prompt or proof that a model read every supplied token. Only selected named producers and explicit evidence are covered.
- 0068 removes duplicate/unrelated payload decoding but retains metadata scans and selected payload work. Do not describe it as removing all projection cost.
- Known defect: the selected migration declares admission_observation_sequence as a global primary key while the allocator numbers observations per thread. An isolated SQLite test of two threads' first observation reproduces a uniqueness collision. This is a constraint/allocator characterization, not a live or full-handler reproduction; the catalog task does not change that behavior.

### Retirement condition

Retire when upstream/public plugin surfaces cover the same producer and evidence boundaries, preserve receipt strength and pagination, and equivalent query-growth/prompt-parity tests prove removal safe.

<details><summary>Selected patches (5) and source binding</summary>

- [0025-feat-context-magnet-add-contribution-trace-API.patch](patches/0025-feat-context-magnet-add-contribution-trace-API.patch)
- [0026-feat-context-magnet-add-provider-admission.patch](patches/0026-feat-context-magnet-add-provider-admission.patch)
- [0046-feat-p6r-expose-synchronous-plugin-prompt-rendering.patch](patches/0046-feat-p6r-expose-synchronous-plugin-prompt-rendering.patch)
- [0047-feat-p6r-adapt-owned-runtime-and-message-prompt-prod.patch](patches/0047-feat-p6r-adapt-owned-runtime-and-message-prompt-prod.patch)
- [0068-fix-p6r-bound-contribution-payload-decoding.patch](patches/0068-fix-p6r-bound-contribution-payload-decoding.patch)

Reviewed source digest: `d1326133bc67e631de49bf0764086c2993a86c863676f42a32be39133f3a9c72`

</details>

<a id="shared-inference-providers"></a>
## Use the required shared inference route and retain native provider facts

BB must use the company inference route without silently falling back to a host login. Failures and native response identity must survive the bridge so diagnostics can explain what happened.

### What this delivers

- Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.
- Server-authenticated external model catalogs are validated and route-scoped facts are invalidated when routing changes, then transported to workers without sending the upstream key.
- Codex resume shares the remaining configured construction deadline and cleanup reserve; optional usage telemetry does not block resume. Correlated provider rejection diagnostics remain available on refusal paths.
- Codex optional agent-message phase is preserved as a provider declaration without inferring finality. Claude actual response IDs are retained through a bounded existing extension item with exact-turn or explicitly unbound coverage and bounded enrichment.

### Responsibility

- Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
- Host command/runtime adapters own per-attempt construction deadlines and provider process state.
- Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.

### Database model

- **Extends the existing catalog fingerprint with required external mode, URL and a token digest; obtains the authenticated external catalog before the host model query. No table, column or force-refresh API is added by this capability.**
  - Why: Changing required inference route credentials or endpoint must invalidate retained catalog readiness without sending the upstream credential to the worker.
  - State/API identities: `catalogFingerprint`, `readRequiredExternalModelCatalog`, `BB_ACCOUNT_POOL_EXTERNAL_REQUIRED`, `BB_ACCOUNT_POOL_EXTERNAL_URL`, `BB_ACCOUNT_POOL_EXTERNAL_TOKEN`
  - Source: `apps/server/src/services/providers/provider-model-catalog-store.ts`

### Core SDK and APIs

- **Reads bounded gateway /v1/models through operator-held required relay/key; returns provider-appropriate model facts and selectedOnlyModels.**
  - Why: Keep model discovery on the same mandatory inference path while workers receive catalog facts, not gateway keys. Contract obligations: Opt-in BB_ACCOUNT_POOL_EXTERNAL_REQUIRED=1, HTTPS ts.net root origin and nonblank token; errors fail without native direct-provider fallback. This is an outbound gateway consumption contract, not a new public BB REST endpoint. Consumers: packages/host-daemon-contract/src/commands.ts, apps/server/src/services/providers/provider-model-catalog-store.ts.
  - Visibility: private
  - State/API identities: `readRequiredExternalModelCatalog`
  - Source: `apps/server/src/services/providers/required-external-model-catalog.ts`
- **Forwards constructionDeadlineAtMs specifically on thread/resume into the bridge request.**
  - Why: A resumed provider gets the full native construction budget rather than an accidental shorter per-attempt budget. Context-magnet attempt forwarding is a separate obligation; no external API is added by this adapter.
  - Visibility: internal
  - State/API identities: `createBridgeProtocolAdapter`
  - Source: `packages/agent-runtime/src/bridge-protocol-adapter.ts`
- **AdapterCommand thread/resume gains optional constructionDeadlineAtMs.**
  - Why: Carry the native resume construction deadline through the existing adapter command. The bridge schema accepts the optional field on construction requests; current adapter emission is specific to resume.
  - Visibility: internal
  - State/API identities: `AdapterCommand`
  - Source: `packages/agent-runtime/src/provider-adapter.ts`
- **Exports commentary|final_answer phase schema/type and adds optional nullable phase to agentMessage event items.**
  - Why: Preserve supported native Codex response phase through parser, delta assembler and persisted events without requiring it from other providers. Historical authentication-slot masking belongs to diagnostic-environment.
  - Visibility: public
  - State/API identities: `threadEventAgentMessagePhaseSchema`, `ThreadEventAgentMessagePhase`, `threadEventItemSchema`
  - Source: `packages/domain/src/provider-event.ts`
- **provider.list_models accepts optional requiredExternalCatalog:{models,selectedOnlyModels}; models must be nonempty.**
  - Why: The server reads model facts using its required inference relay/key and sends facts to workers through authenticated BB commands, not the key. The response shape remains models/selectedOnlyModels; thread.start settlements and secret provenance are separate changes.
  - Visibility: internal
  - State/API identities: `providerListModelsCommandSchema`
  - Source: `packages/host-daemon-contract/src/commands.ts`
- **The selected native server/daemon cohort uses HOST_DAEMON_PROTOCOL_VERSION240 (net baseline238). This file adds no separate model-catalog method.**
  - Why: Required-relay workers must run the matching native cohort; do not infer wire compatibility from SDK version. Specific changed command fields belong to commands.ts, and the protocol version must remain synchronized across server/daemon.
  - Visibility: internal
  - State/API identities: `HOST_DAEMON_PROTOCOL_VERSION`
  - Source: `packages/host-daemon-contract/src/protocol.ts`
- **Preserves agentMessage phase on both immediate close and incremental completion assembly.**
  - Why: Prevent accepted wire field disappearing before event persistence/UI. Contract obligations: No new public callable; data-loss prevention for an extended wire shape. Consumers: packages/domain/src/provider-event.ts.
  - Visibility: internal
  - State/API identities: `createDeltaAssembler`
  - Source: `packages/provider-bridge-protocol/src/assembler/delta-assembler.ts`
- **Start/resume/fork construction request schemas accept optional positive integer constructionDeadlineAtMs.**
  - Why: Share an absolute construction budget with first-party bridges. Current runtime adapter emits it on resume; context-magnet attempt and settlement fields are documented under context-prompts.
  - Visibility: internal
  - State/API identities: `threadStartParamsSchema`, `threadResumeParamsSchema`, `threadForkParamsSchema`
  - Source: `packages/provider-bridge-protocol/src/requests.ts`
- **agentMessage delta shape adds optional nullable phase commentary|final_answer.**
  - Why: Preserve Codex native semantics without forcing phase on other providers. Contract obligations: Domain/provider delta/assembler must all preserve the same field. Consumers: plugins/provider-codex/src/schemas.ts, plugins/provider-codex/src/delta-translation.ts.
  - Visibility: internal
  - State/API identities: `deltaItemShapeSchema`
  - Source: `packages/provider-bridge-protocol/src/thread-delta.ts`
- **New generic-extension item kind provider-claude-code/response-identity with version1 payload: binding/reason/phase,nativeSessionId,messageId,providerRequestId,parentToolUseId,aborted,supersedesSdkUuids.**
  - Why: Retain bounded native Claude response IDs for exact BB turn/request correlation instead of discarding them. Contract obligations: Existing extension carrier reused; no new upstream ProviderEvent variant/SDK callback. Bound turn_scope requires current native session/message,no parentToolUseId,reasonnull; coverage gaps emit unbound reasons rather than inventing exact lineage. At most256 tracked identities,4096 bytes/payload,supersedes<=16,two emissions for bounded enrichment. Consumers: plugins/provider-claude-code/src/delta-translation.ts, Inference report plugin retained event reader outside core.
  - Visibility: private
  - State/API identities: `CLAUDE_RESPONSE_IDENTITY_KIND`, `CLAUDE_RESPONSE_IDENTITY_LIMIT`, `CLAUDE_RESPONSE_IDENTITY_BYTES`, `claudeResponseIdentityItemSchema`, `claudeResponseIdentityStateSchema`, `ClaudeResponseIdentityTracker`
  - Source: `plugins/provider-claude-code/src/response-identity.ts`
- **Accepts optional nullable commentary/final_answer phase on native Codex agent messages; unknown phase catches to undefined.**
  - Why: Preserve supported native phase without rejecting forward-compatible messages. Consumers: plugins/provider-codex/src/delta-translation.ts, packages/provider-bridge-protocol/src/thread-delta.ts.
  - Visibility: private
  - State/API identities: `codexHandledThreadItemSchema`
  - Source: `plugins/provider-codex/src/schemas.ts`

### Other affected areas

- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `apps/host-daemon/src/command-dispatch.test.ts`, `apps/server/test/providers/provider-model-catalog-store.test.ts`, `apps/server/test/providers/required-external-model-catalog.test.ts`, `apps/server/test/public/public-thread-data.test.ts`, `packages/agent-runtime/src/runtime.codex-topology.test.ts`, `packages/agent-runtime/src/runtime.lifecycle.test.ts`, `packages/domain/test/stored-thread-event.test.ts`, `packages/host-daemon-contract/test/contract.test.ts`, `packages/provider-bridge-protocol/src/assembler/delta-assembler.test.ts`, `packages/provider-bridge-protocol/src/contract-tests/provider-bridge-grammar.v2.snapshot.json`, `packages/provider-bridge-protocol/src/thread-delta.test.ts`, `packages/sdk/test/sdk.test.ts`, `plugins/account-pool/src/required-external-pool.test.ts`, `plugins/provider-claude-code/src/bridge/__tests__/bridge.calibration.test.ts`, `plugins/provider-claude-code/src/bridge/__tests__/bridge.test.ts`, `plugins/provider-claude-code/src/bridge/__tests__/sdk-session.test.ts`, `plugins/provider-claude-code/src/bridge/required-external-maintenance.test.ts`, `plugins/provider-claude-code/src/delta-translation.test.ts`, `plugins/provider-claude-code/src/response-identity.test.ts`, `plugins/provider-codex/src/bridge/app-server-connection.test.ts`, `plugins/provider-codex/src/bridge/app-server-launch.test.ts`, `plugins/provider-codex/src/bridge/bridge.admission.test.ts`, `plugins/provider-codex/src/bridge/bridge.archive-idempotency.test.ts`, `plugins/provider-codex/src/bridge/bridge.recovery.test.ts`, `plugins/provider-codex/src/bridge/bridge.writer-lock.test.ts`, `plugins/provider-codex/src/bridge/bridge.zero-work-turn.test.ts`, `plugins/provider-codex/src/bridge/provider-maintenance.test.ts`, `plugins/provider-codex/src/delta-translation.test.ts`
- **Host execution and server/daemon transport. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `apps/host-daemon/src/command-dispatch.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `docs/p6r-required-inference-upstreaming.md`, `plugins/account-pool/PLUGIN_OVERVIEW.md`, `plugins/account-pool/skills/account-pool/SKILL.md`, `plugins/account-pool/skills/account-pool/references/accounts-and-routing.md`, `plugins/account-pool/skills/account-pool/references/required-external-inference.md`
- **agent-runtime package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/agent-runtime/src/runtime.ts`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/claude-code/approval-allow/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/approval-deny/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/auth-failure/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/compaction/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/fork/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/plan-mode/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/resume/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/steer/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/stop-interrupt/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/subagent/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/turn-tools/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/user-question/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/claude-code/web-search/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/approval-allow/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/approval-deny/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/archived-resume/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/compaction/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/empty-rollout/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/fork/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/missing-rollout/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/plan-mode/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/resume/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/steer/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/stop-interrupt/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/subagent/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/turn-tools/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/user-question/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/codex/web-search/bridge→runtime.current.ndjson`, `packages/provider-bridge-protocol/recordings/row-counts.json`
- **Native account-pool plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/account-pool/src/required-external-pool.ts`, `plugins/account-pool/src/server.ts`
- **Native provider-claude-code plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/provider-claude-code/server.ts`, `plugins/provider-claude-code/src/bridge/model-list.ts`, `plugins/provider-claude-code/src/bridge/provider-maintenance.ts`, `plugins/provider-claude-code/src/bridge/sdk-session.ts`, `plugins/provider-claude-code/src/delta-translation.ts`
- **Native provider-codex plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/provider-codex/src/bridge/app-server-connection.ts`, `plugins/provider-codex/src/bridge/bridge.ts`, `plugins/provider-codex/src/bridge/fake-codex-app-server.mjs`, `plugins/provider-codex/src/bridge/provider-maintenance.ts`, `plugins/provider-codex/src/delta-translation.ts`
- **Build and repository integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `scripts/provider-literal-baseline.json`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- required-external-pool.test.ts
- required-external-model-catalog.test.ts
- required-external-maintenance.test.ts
- runtime.codex-topology.test.ts
- response-identity.test.ts
- bridge.admission.test.ts
- app-server-connection.test.ts
- delta-translation.test.ts
- recorded replay row-count expectations

### Known limitations

- The actual fleet account selection, home affinity, quota switching, Manager reports and Grafana exporters are outside this BB patch queue. This category supplies required-route/native-evidence seams rather than reimplementing those services.
- 0044 currently adds a regression witness/fake provider stall, not an independent production timeout implementation. 0038 and 0080 are test/recording ports.
- Claude response identity is limited to 256 retained identities per resident SDK lifetime and 4096-byte records; unbound/conflicting/subagent/settled evidence stays explicitly limited.

### Retirement condition

For 0058 specifically: move the adapter into Account Pooler when provider SDK admits required external model catalogs and route-scoped cache invalidation; preserve child credential isolation and fail-closed start/resume. Retire native identity/deadline translations only when upstream emits equivalent facts and the recorded/provider tests pass.

<details><summary>Selected patches (9) and source binding</summary>

- [0019-feat-provider-codex-preserve-agent-message-phase.patch](patches/0019-feat-provider-codex-preserve-agent-message-phase.patch)
- [0038-test-agent-runtime-accept-protocol-error-without-field-detail.patch](patches/0038-test-agent-runtime-accept-protocol-error-without-field-detail.patch)
- [0044-fix-runtime-allow-full-construction-deadline-for-resume.patch](patches/0044-fix-runtime-allow-full-construction-deadline-for-resume.patch)
- [0045-fix-codex-share-the-resume-construction-deadline.patch](patches/0045-fix-codex-share-the-resume-construction-deadline.patch)
- [0058-feat-p6r-require-BB-external-inference-relay.patch](patches/0058-feat-p6r-require-BB-external-inference-relay.patch)
- [0066-feat-claude-preserve-bounded-native-response-identities.patch](patches/0066-feat-claude-preserve-bounded-native-response-identities.patch)
- [0067-fix-claude-retain-bounded-response-identity-enrichment.patch](patches/0067-fix-claude-retain-bounded-response-identity-enrichment.patch)
- [0079-fix-preserve-codex-rejection-diagnostics.patch](patches/0079-fix-preserve-codex-rejection-diagnostics.patch)
- [0080-test-retain-provider-identity-replay-expectations.patch](patches/0080-test-retain-provider-identity-replay-expectations.patch)

Reviewed source digest: `0b528b589c8b2f64370cfa60d3c86f6e3df836177f509c47c18cce5e6e3cf513`

</details>

<a id="diagnostic-environment"></a>
## Keep diagnostics useful while masking only actual authentication secrets

This is a trusted single-company deployment. Debugging needs concrete IDs, URLs, paths and ordinary environment values, while real authentication bytes must not become retained diagnostic output.

### What this delivers

- Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.
- Secret classification survives synchronization, overrides, runtime preparation and retained-event reads. Missing/invalid classification or failed required contributions stop preparation instead of silently dropping route/credential entries.
- Managed-shell provenance is retained immutably and diagnostic projection uses source-attested credential slots; actual provider environment bytes are unchanged. Populated unclassified historical stores fail before migration mutation.

### Responsibility

- Machine environment storage/settings and host sync own explicit classification.
- Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance.
- Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.

### Database model

- **In-memory immutable environment contribution/provenance snapshot; no new on-disk store.**
  - Why: Environment synchronization and per-command diagnostics must share the exact classification/source bytes.
  - State/API identities: `MachineEnvironment`, `original`, `originalShell`, `entries`, `shellEnvironmentSnapshot`
  - Source: `apps/host-daemon/src/machine-environment.ts`
- **Projects ordinary environment values visibly and secret values by presence without changing stored/provider bytes.**
  - Why: Classification determines diagnostic visibility; broad masking is not a substitute for provenance.
  - State/API identities: `environment_variables.secret`, `machineEnvironmentView`, `projectMachineEnvironmentView`
  - Source: `apps/server/src/services/machines/environment-settings.ts`
- **Extends encrypted row envelope with explicit secret provenance; keeps existing AES-GCM encryption/key ownership.**
  - Why: Ordinary values can be shown, actual secret values masked; backup must retain existing encryption key with ciphertext. No new secret-store file is introduced.
  - State/API identities: `environment_variables.secret`
  - Source: `apps/server/src/services/machines/environment-storage.ts`
- **Adds required, no-default environment_variables.secret integer classification.**
  - Why: Mask actual credentials only, keep ordinary diagnostics visible, refuse guessed classification of populated old state.
  - State/API identities: `environment_variables`, `environment_variables.secret`
  - Source: `packages/db/drizzle/0146_environment_secret_classification.sql`
- **Adds a pre-mutation classification guard for populated environment_variables and legacy app_settings_values machineEnvironment:* records; requires explicit valid secret classification. Does not create the identity bridge/staging tables.**
  - Why: An operator must classify retained values using provenance before the new diagnostic policy is applied; the migration must not guess or silently mask every ordinary value.
  - State/API identities: `assertEnvironmentSecretClassification`, `environment_variables.secret`, `app_settings_values`
  - Source: `packages/db/src/migrate.ts`
- **Adds only the required, no-default environment_variables.secret Boolean integer column beside existing encrypted environment rows.**
  - Why: The stored provenance determines diagnostic visibility while actual environment bytes and existing encryption ownership remain unchanged.
  - State/API identities: `environment_variables.secret`
  - Source: `packages/db/src/schema.ts`
- **Generated state or contract artifacts accompany the owning schema/API change; repeated snapshots are not separate product capabilities.**
  - Why: Keep source, generated consumers and persisted-state receipts in one coherent cohort.
  - Source: `packages/db/drizzle/meta/0146_snapshot.json`, `packages/db/drizzle/meta/_journal.json`

### Core SDK and APIs

- **Project environment read and all write responses use dataDir-aware provenance view.**
  - Why: Resolve plain values while continuing to suppress protected secret values. Contract obligations: No route addition; shared secret-discriminated request/read schemas changed. Consumers: packages/server-contract/src/api/machine-environment.ts.
  - Visibility: public
  - State/API identities: `registerProjectRoutes`
  - Source: `apps/server/src/routes/projects.ts`
- **Machine environment read and write responses use dataDir-aware provenance view.**
  - Why: Match system settings visibility to explicit credential classification. Contract obligations: New /system/p6rIdentity implementation is in services/p6r/native-request.ts, not this route file. Consumers: packages/server-contract/src/api/machine-environment.ts.
  - Visibility: public
  - State/API identities: `registerSystemRoutes`
  - Source: `apps/server/src/routes/system.ts`
- **AgentRuntimeContributedEnvEntry now requires secret:boolean; AgentRuntimeOptions gains shellEnvContributions preserving per-entry provenance.**
  - Why: Runtime diagnostic masking must use explicit credential role while leaving ordinary environment values visible and actual provider input unchanged. Env producers and daemon transport must agree; this entry adds no construction settlement behavior.
  - Visibility: internal
  - State/API identities: `AgentRuntimeContributedEnvEntry`, `AgentRuntimeOptions.shellEnvContributions`
  - Source: `packages/agent-runtime/src/types.ts`
- **Internal retained-event parsing masks specific legacy account-pool/subscription-router authentication slot values using plugin/name provenance.**
  - Why: Prevent real historical token values from being returned in diagnostics while preserving field names, source and ordinary values. unscopedProviderEventSchema is an unexported implementation helper; exported threadEventSchema incorporates the changed parsing behavior. Codex message phase is a separate public event extension.
  - Visibility: internal
  - State/API identities: `unscopedProviderEventSchema`, `threadEventSchema`
  - Source: `packages/domain/src/provider-event.ts`
- **hostDaemonContributedEnvEntrySchema now requires secret:boolean on every contributed provider environment entry.**
  - Why: Carry explicit credential classification across the authenticated server/daemon boundary so native masking does not guess from names. Producers without secret no longer satisfy the strict command schema; preserve actual values for provider execution. This requires the matching protocol240 cohort.
  - Visibility: internal
  - State/API identities: `hostDaemonContributedEnvEntrySchema`
  - Source: `packages/host-daemon-contract/src/commands.ts`
- **HOST_DAEMON_PROTOCOL_VERSION changes238→240 in the selected fork cohort.**
  - Why: Fence incompatible native command/result/provenance assumptions, including required contributed-env secret:boolean. Deploy matching server and daemon; a version bump alone adds no inference routing behavior.
  - Visibility: internal
  - State/API identities: `HOST_DAEMON_PROTOCOL_VERSION`
  - Source: `packages/host-daemon-contract/src/protocol.ts`
- **ExperimentalPluginProviderEnvEntry now requires experimental_secret:boolean.**
  - Why: Every plugin environment contributor must declare whether its value is an API key or equivalent authentication secret. subscription-router marks the gateway URL nonsecret and token secret. Preserve nonsecret diagnostics and actual provider input; do not infer redaction from unfamiliar field names.
  - Visibility: public
  - State/API identities: `ExperimentalPluginProviderEnvEntry.experimental_secret`
  - Source: `packages/plugin-sdk/src/backend-contract.ts`
- **validatePluginProviderEnvEntries and validateProviderEnvContribution enforce required experimental_secret:boolean alongside the existing env name/value bounds.**
  - Why: Reject env contributions missing explicit credential provenance before they reach native execution. This validation does not broaden masking or collect provider bodies; context-magnet configuration validation belongs to context-prompts.
  - Visibility: internal
  - State/API identities: `validatePluginProviderEnvEntries`, `validateProviderEnvContribution`
  - Source: `packages/plugin-sdk/src/internal/host-policy.ts`
- **Forwards the newly required input.secret in project environment writes.**
  - Why: Preserve explicit credential role across SDK -> REST -> protected storage -> daemon. Contract obligations: Existing endpoint/method; input shape is changed by its shared contract, not a new settings endpoint. Consumers: packages/server-contract/src/api/machine-environment.ts.
  - Visibility: public
  - State/API identities: `ProjectsArea.setMachineEnvironmentVariable`
  - Source: `packages/sdk/src/areas/projects.ts`
- **Writes now require secret:boolean. Reads are discriminated: secret=true returns value=null, secret=false returns actual string.**
  - Why: Mask actual credentials while keeping ordinary diagnostic environment values visible. Contract obligations: Old writes without secret no longer meet the strict schema; every writer must select provenance deliberately. Authentication values remain protected; this does not change the actual provider environment. Consumers: packages/sdk/src/areas/projects.ts, packages/sdk/src/areas/system.ts, apps/server/src/routes/projects.ts, apps/server/src/routes/system.ts.
  - Visibility: public
  - State/API identities: `machineEnvironmentSetSchema`, `machineEnvironmentVariableSchema`, `MachineEnvironmentSet`, `MachineEnvironmentVariable`
  - Source: `packages/server-contract/src/api/machine-environment.ts`

### Other affected areas

- **Native client presentation and cache lifecycle. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `apps/app/src/components/settings/MachineEnvironmentImportDialog.tsx`, `apps/app/src/components/settings/MachineEnvironmentSettings.stories.tsx`, `apps/app/src/components/settings/MachineEnvironmentSettings.tsx`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/app/src/components/settings/MachineEnvironmentSettings.test.tsx`, `apps/cli/src/__tests__/command-output/machine-environment.test.ts`, `apps/host-daemon/src/app.test.ts`, `apps/host-daemon/src/machine-environment.test.ts`, `apps/host-daemon/src/operation-environment.test.ts`, `apps/host-daemon/src/plugin-host-manager.test.ts`, `apps/host-daemon/src/runtime-manager.test.ts`, `apps/host-daemon/src/terminals/terminal-manager.test.ts`, `apps/host-daemon/test/command/environment-dispatch.test.ts`, `apps/host-daemon/test/command/environment-hook.test.ts`, `apps/host-daemon/test/command/project-clone-private-env.test.ts`, `apps/server/src/services/hosts/host-environment-sync.test.ts`, `apps/server/src/services/hosts/host-environment.test.ts`, `apps/server/src/services/machines/environment-storage.test.ts`, `apps/server/src/services/machines/git-credentials.test.ts`, `apps/server/test/hosts/live-command.test.ts`, `apps/server/test/public/machine-environment.test.ts`, `apps/server/test/public/public-project-clone-sources.test.ts`, `apps/server/test/public/public-terminals.test.ts`, `apps/server/test/public/public-thread-diagnostic-events.test.ts`, `apps/server/test/services/environments/project-environment-hooks.test.ts`, `apps/server/test/services/plugins/plugin-agent-contributions.test.ts`, `packages/agent-runtime/src/integration.env-isolation.test.ts`, `packages/agent-runtime/src/runtime.lifecycle.test.ts`, `packages/agent-runtime/src/runtime.recovery.test.ts`, `packages/agent-runtime/src/thread-shell-environment.test.ts`, `packages/db/test/environment-classification-migration.test.ts`, `packages/db/test/helpers/rewind.ts`, `packages/db/test/migrate.test.ts`, `packages/db/test/pane-focus-bindings-migration.test.ts`, `packages/db/test/queued-message-state-migration.test.ts`, `packages/db/test/sidebar-installation-defaults.test.ts`, `packages/db/test/thread-drafts-migration.test.ts`, `packages/domain/test/environment-credential-projection.test.ts`, `packages/host-daemon-contract/test/contract.test.ts`, `packages/host-daemon-contract/test/environment-classification.test.ts`, `packages/plugin-sdk/src/testing/__tests__/fake-plugin-host.test.ts`, `packages/plugin-sdk/src/testing/fake-plugin-host.ts`, `plugins/account-pool/src/required-external-pool.test.ts`, `plugins/account-pool/src/server.test.ts`
- **CLI operations and output. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `apps/cli/src/commands/machine-environment.ts`
- **Host execution and server/daemon transport. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `apps/host-daemon/src/app.ts`, `apps/host-daemon/src/runtime-manager.ts`
- **Server effect and read owners. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `apps/server/src/services/machines/git-credentials.ts`, `apps/server/src/services/plugins/plugin-agent-contributions.ts`, `apps/server/src/services/plugins/plugin-service.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `docs/api_to_audit.md`, `docs/configuration.md`, `docs/environment-diagnostic-classification.md`, `packages/templates/src/templates/bb-guide-machines.md`, `plugins/bb-guide/skills/bb-plugin-authoring/references/providers.md`
- **agent-runtime package integration. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `packages/agent-runtime/src/runtime.ts`, `packages/agent-runtime/src/thread-shell-environment.ts`
- **Native account-pool plugin. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `plugins/account-pool/src/required-external-pool.ts`, `plugins/account-pool/src/server.ts`
- **Native plugin-api-docs plugin. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `plugins/plugin-api-docs/src/surfaces.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- environment-credential-projection.test.ts
- environment-classification-migration.test.ts
- environment-classification.test.ts
- public-thread-diagnostic-events.test.ts
- thread-shell-environment.test.ts
- machine-environment.test.ts
- plugin-agent-contributions.test.ts

### Known limitations

- This is not a general PII-redaction feature. No blanket URL/email/ID/environment masking and no mutation of live provider authentication are intended.

### Retirement condition

Retire only when upstream carries equivalent explicit role/provenance classification end to end and native diagnostic readers mask exactly those values while retaining nonsecret detail; migrate historical classification deliberately.

<details><summary>Selected patches (1) and source binding</summary>

- [0065-fix-env-preserve-explicit-credential-provenance.patch](patches/0065-fix-env-preserve-explicit-credential-provenance.patch)

Reviewed source digest: `d712aa8e7ac0a29f264259d743c9c698c2b18b91d1f8004c2f45415195cf5e74`

</details>

<a id="data-upgrades"></a>
## Upgrade existing BB state without rewriting or guessing its history

The fork has real historical databases and sidecar state. Refreshing upstream must preserve their exact identities/history and reject unrecognized ledgers before accepting traffic.

### What this delivers

- Built server distributions include sidecar migrations and can initialize them without listeners. Main DB and P6R sidecar migrations retain separate owners.
- Known historical identity/Context Magnet branch prefixes and prior bridge receipts are admitted through exact schema/hash/time checks and an atomic bridge marker, rather than broadly adopting any similar database.
- Queued author state survives the exact supported migration rebuilds. Generated snapshots and migration-fixture rewinds align downstream state with the current upstream chain.

### Responsibility

- packages/db/src/migrate.ts owns recognized historical ledger admission and main DB transition.
- P6R sidecar-migrate owns sidecar tables/versioning; server build owner packages those files.
- Generated Drizzle snapshots/journal describe the selected schema; tests must use the real migration path.

### Database model

- **Canonical identity/facet and Context Magnet DDL; runtime bridge completes columns and validates exact retained shapes.**
  - Why: Replace historical migration collisions without rewriting applied receipts or losing accepted identity/evidence.
  - State/API identities: `context_magnet_contribution_trace_receipts`, `context_magnet_trace_receipt_contribution_idx`, `context_magnet_contribution_trace_snapshots`, `context_magnet_trace_snapshot_thread_idx`, `context_magnet_contribution_traces`, `context_magnet_trace_thread_sequence_idx`, `context_magnet_trace_thread_operation_idx`, `context_magnet_provider_admission_attempts`, `context_magnet_admission_attempt_contribution_idx`, `context_magnet_admission_attempt_thread_sequence_idx`, `context_magnet_provider_admission_observations`, `context_magnet_admission_observation_thread_idx`, `context_magnet_provider_admission_retention`, `context_magnet_admission_retention_thread_idx`, `context_magnet_provider_admission_sequences`, `thread_facet_cursor_keys`, `thread_facet_declarations`, `thread_facet_members`, `thread_facet_members_rank_idx`, `thread_facet_owners`, `thread_facet_principal_profiles`, `thread_facet_principal_profiles_position_idx`, `thread_facet_reconciliation_targets`, `thread_facet_reconciliation_targets_pending_idx`, `thread_facet_relations`, `thread_facet_relations_member_thread_idx`, `thread_facet_snapshots`, `thread_facet_snapshots_generation_thread_idx`
  - Source: `packages/db/drizzle/0145_identity_context_bridge.sql`
- **Owns exact legacy migration-prefix/hash/schema checks, persistent bb_schema_bridge_completions receipt, runtime completion columns and temporary durable bb_p6r_migration_queued_authors staging across the supported queue rebuild.**
  - Why: Retain accepted authorship through migration/reopen, validate schema/FK integrity before recording completion, and preserve historical ledger identities. The environment classification preflight is separately owned by diagnostic-environment.
  - State/API identities: `bb_schema_bridge_completions`, `identity-context-0131`, `bb_p6r_migration_queued_authors`, `__drizzle_migrations`, `stageP6rQueuedAuthors`, `restoreP6rQueuedAuthors`, `applyTargetMigrationsSkippedByLegacyIdentityHistory`, `completeIdentityAndContextMagnetSchemaBridge`, `queued_thread_messages.p6r_authors`, `threads.execution_revision`
  - Source: `packages/db/src/migrate.ts`
- **Generated state or contract artifacts accompany the owning schema/API change; repeated snapshots are not separate product capabilities.**
  - Why: Keep source, generated consumers and persisted-state receipts in one coherent cohort.
  - Source: `packages/db/drizzle/meta/0145_snapshot.json`, `packages/db/drizzle/meta/_journal.json`

### Other affected areas

- **Dependency and package/export metadata needed by this capability.**
  - Why: Bind consumers and native/runtime prerequisites to the selected implementation rather than an unrelated ambient version.
  - Source: `apps/server/package.json`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. packages/db/src/migrate.ts owns recognized historical ledger admission and main DB transition.
  - Source: `apps/server/test/services/p6r/sidecar-built-artifact.test.ts`, `packages/db/test/data/events.test.ts`, `packages/db/test/fixtures/legacy-identity-context-magnet/0119_soft_pandemic.sql`, `packages/db/test/fixtures/legacy-identity-context-magnet/0120_early_virginia_dare.sql`, `packages/db/test/fixtures/legacy-identity-context-magnet/0121_sticky_king_bedlam.sql`, `packages/db/test/fixtures/legacy-identity-context-magnet/0122_living_quasimodo.sql`, `packages/db/test/migrate.test.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- migrate.test.ts
- sidecar-built-artifact.test.ts
- sidecar-startup-migration.test.ts
- events.test.ts legacy fixtures

### Known limitations

- Old patch preambles call the bridge 0142 after upstream 0141. In the CURRENT net tree its actual file is 0145_identity_context_bridge.sql, followed by later environment/admission migrations. Use the current journal and generated snapshot chain.
- A generated snapshot/test rewind is not a new product capability; it supports this upgrade guarantee.

### Retirement condition

Retire a historical bridge only when no supported retained production/restore dataset needs it, or a separately tested explicit migration converts that history. Upstream schema convergence alone does not authorize deleting old receipt readers.

<details><summary>Selected patches (6) and source binding</summary>

- [0005-fix-migrations-include-built-sidecar-migrations.patch](patches/0005-fix-migrations-include-built-sidecar-migrations.patch)
- [0013-test-identity-rewind-downstream-migrations-in-fixtur.patch](patches/0013-test-identity-rewind-downstream-migrations-in-fixtur.patch)
- [0033-fix-migrations-bridge-legacy-identity-and-context-hi.patch](patches/0033-fix-migrations-bridge-legacy-identity-and-context-hi.patch)
- [0040-fix-migrations-accept-verified-bb-machine-legacy-history.patch](patches/0040-fix-migrations-accept-verified-bb-machine-legacy-history.patch)
- [0041-fix-db-regenerate-downstream-snapshot.patch](patches/0041-fix-db-regenerate-downstream-snapshot.patch)
- [0042-fix-db-preserve-prior-fork-bridge-history.patch](patches/0042-fix-db-preserve-prior-fork-bridge-history.patch)

Reviewed source digest: `ca735e01769a022e4e1f2e0ee8517c7c2b19a96c58eaeb123331aa50298ca5d4`

</details>

<a id="plugin-artifacts-transport"></a>
## Load plugin frontends coherently and keep plugin network policy explicit

A plugin UI must load one coherent generation even during rebuild/reload, and foreign-origin plugin routes must explicitly own their CORS policy without weakening core APIs.

### What this delivers

- Plugin builds emit manifest-listed content-hashed JS/CSS generations, including lazy chunks. Server reads validate path/type/size/hash and retain bounded generation history so reload races do not mix files.
- Expired generations report expiration rather than selecting arbitrary newer chunks. Packaged/scaffold test consumers read the same artifact format and allow a generation with no optional lazy chunks.
- Exact plugin HTTP routes can supply foreign-origin preflight/response CORS. Core CORS remains authoritative for core and near-miss paths; route authentication is independent.
- External scaffold pack failures retain bounded sanitized child-process diagnostics.

### Responsibility

- Plugin build artifact metadata owns emitted file list/generation.
- Server app-bundle/plugin runtime owns validation, generation retention and serving.
- Core server middleware delegates only the exact plugin route namespace; each plugin route owns its own CORS response.

### Core SDK and APIs

- **Removes GET /api/v1/plugin-app-assets/:hash/:file; adds GET /api/v1/plugins/:id/assets/g/:generation/* for verified immutable generation bytes. Existing /api/v1/plugins/:id/assets/app.js and app.css routes remain.**
  - Why: Lazy plugin imports must load one coherent retained generation. Invalid/expired/undeclared generation assets return410; generation manifest, hashes, declared content types and frozen bytes agree with the builder/loader. This is an actual route removal, not an alias. RPC401/503 mapping belongs to shared-identity.
  - Visibility: public
  - State/API identities: `registerPluginRoutes`
  - Source: `apps/server/src/routes/plugins.ts`
- **Builder accepts appArtifact generation and declared files(path,bytes,sha256,JS/CSS contentType). Emits artifactFormatVersion2 when present; otherwise retains format1.**
  - Why: Bind lazy JS/CSS chunks to one verified immutable plugin generation. Contract obligations: Format1 remains accepted/emitted without appArtifact; do not describe this as a total format1 removal. Generation/files/digests must match host artifact reader and app loader. Consumers: packages/plugin-build/src/build-plugin-app.ts, apps/server/src/routes/plugins.ts.
  - Visibility: internal
  - State/API identities: `createPluginArtifactMeta`
  - Source: `packages/plugin-build/src/plugin-artifact-meta.ts`
- **PluginHttp.route documents plugin ownership of HTTP OPTIONS and exact browser CORS headers.**
  - Why: Host CORS handling no longer supplies an incorrect generic response for a plugin route. Browser-callable plugins must register OPTIONS and their GET/POST CORS headers; non-OPTIONS route authentication stays independent. This changes transport behavior, not the route method signature or identity/env/facet APIs.
  - Visibility: public
  - State/API identities: `PluginHttp.route`
  - Source: `packages/plugin-sdk/src/backend-contract.ts`

### Other affected areas

- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Plugin build artifact metadata owns emitted file list/generation.
  - Source: `apps/cli/src/__tests__/packaged-plugin-build.test.ts`, `apps/cli/src/__tests__/plugin-build.test.ts`, `apps/server/test/services/plugins/builtin-plugins.test.ts`, `apps/server/test/services/plugins/plugin-app-bundle.test.ts`, `apps/server/test/services/plugins/plugin-install.test.ts`, `apps/server/test/services/plugins/plugin-wire.test.ts`, `packages/plugin-build/src/build-plugin-app.test.ts`, `packages/templates/test/plugin-scaffold-external.test.ts`
- **Build and repository integration. Plugin builds emit manifest-listed content-hashed JS/CSS generations, including lazy chunks. Server reads validate path/type/size/hash and retain bounded generation history so reload races do not mix files.**
  - Why: Plugin build artifact metadata owns emitted file list/generation. Server app-bundle/plugin runtime owns validation, generation retention and serving. Core server middleware delegates only the exact plugin route namespace; each plugin route owns its own CORS response.
  - Source: `apps/demo-server/scripts/build-assets.ts`
- **Server effect and read owners. Plugin builds emit manifest-listed content-hashed JS/CSS generations, including lazy chunks. Server reads validate path/type/size/hash and retain bounded generation history so reload races do not mix files.**
  - Why: Plugin build artifact metadata owns emitted file list/generation. Server app-bundle/plugin runtime owns validation, generation retention and serving. Core server middleware delegates only the exact plugin route namespace; each plugin route owns its own CORS response.
  - Source: `apps/server/src/server.ts`, `apps/server/src/services/plugins/app-bundle.ts`, `apps/server/src/services/plugins/plugin-runtime.ts`, `apps/server/src/services/plugins/plugin-service.ts`
- **plugin-build package integration. Plugin builds emit manifest-listed content-hashed JS/CSS generations, including lazy chunks. Server reads validate path/type/size/hash and retain bounded generation history so reload races do not mix files.**
  - Why: Plugin build artifact metadata owns emitted file list/generation. Server app-bundle/plugin runtime owns validation, generation retention and serving. Core server middleware delegates only the exact plugin route namespace; each plugin route owns its own CORS response.
  - Source: `packages/plugin-build/src/build-plugin-app.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- build-plugin-app.test.ts
- plugin-app-bundle.test.ts
- plugin-install.test.ts
- plugin-wire.test.ts
- plugin-build.test.ts
- packaged-plugin-build.test.ts
- plugin-scaffold-external.test.ts

### Known limitations

- 0032 is diagnostic test infrastructure and does not fix all scaffold infrastructure failures. 0037/0039 adapt tests to the generation contract.
- The catalog should describe current generation semantics, not promise unlimited historical asset availability.

### Retirement condition

Retire when upstream plugin artifact/asset serving and route middleware provide the same generation coherence, bounded validation/history, explicit expiry and exact CORS separation; retain packaged/external-consumer contract tests.

<details><summary>Selected patches (5) and source binding</summary>

- [0023-fix-plugins-defer-external-CORS-to-plugin-routes.patch](patches/0023-fix-plugins-defer-external-CORS-to-plugin-routes.patch)
- [0028-feat-plugins-serve-versioned-lazy-frontend-artifacts.patch](patches/0028-feat-plugins-serve-versioned-lazy-frontend-artifacts.patch)
- [0032-test-templates-retain-bounded-pack-failure-diagnosti.patch](patches/0032-test-templates-retain-bounded-pack-failure-diagnosti.patch)
- [0037-test-cli-allow-scaffold-without-optional-chunks.patch](patches/0037-test-cli-allow-scaffold-without-optional-chunks.patch)
- [0039-test-cli-read-packaged-app-from-versioned-artifact.patch](patches/0039-test-cli-read-packaged-app-from-versioned-artifact.patch)

Reviewed source digest: `22d809f88eab60e1b24ef9aee354fe3b9018e116c34c4287df5f6ae2cc8d3a2b`

</details>

<a id="bounded-runtime-responsiveness"></a>
## Keep realtime, long-thread reads and lifecycle waits bounded

A busy thread, stalled browser or slow startup must not create repeated wasted reads, unbounded queues or indefinite waits for every other user.

### What this delivers

- Shared sidebar dirty events coalesce within the existing flush and let an active read finish, followed by a bounded trailing catch-up. Overlapping-tail and inactive-remount races retain eventual freshness; explicit status replacement and terminal cancellation remain separate authorities.
- Realtime client payloads and heartbeat replies share one backlog bound: stalled peers are dropped without blocking healthy peers or daemons. SDK socket close is idempotent under reentrant errors.
- Long-thread delegating-item reads use the intended partial index. Timeline ordering reuses an incremental ordering context only when rewrite generation/data version permit, with retained-row limits.
- Optional config reload waits are bounded; server health readiness permits a finite 180-second slow startup and validates expected launch identity. Configured HTTP listeners bind transactionally before detached recovery starts.

### Responsibility

- realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects.
- NotificationHub owns realtime write bounds and client cleanup; terminal/daemon policies remain distinct.
- DB event lookup and server timeline-context-order own their query/cache invariants.
- bb-app launcher owns config/readiness deadlines; start-server owns listener admission before recovery.

### Database model

- **Changes delegating-item lookup to use existing events_delegating_item_lookup_idx and the SQL projection that bounds inline output. No new index, event authority rule or latest-request batch API is added here.**
  - Why: Use the intended partial lookup index to avoid scanning unrelated retained event payloads in long threads.
  - State/API identities: `listStoredDelegatingItemRowsByItemIds`, `events_delegating_item_lookup_idx`
  - Source: `packages/db/src/data/events.ts`

### Core SDK and APIs

- **Makes close() idempotent after a close request or already-closing socket.**
  - Why: Avoid repeated transport close calls during heartbeat/backpressure cleanup. Contract obligations: No new websocket message shape, subscribe semantics, method or public type. Consumers: apps/server/src/ws/client-protocol.ts.
  - Visibility: public
  - State/API identities: `createRealtimeSocketAdapter`
  - Source: `packages/sdk/src/realtime-client.ts`

### Other affected areas

- **Native client presentation and cache lifecycle. Shared sidebar dirty events coalesce within the existing flush and let an active read finish, followed by a bounded trailing catch-up. Overlapping-tail and inactive-remount races retain eventual freshness; explicit status replacement and terminal cancellation remain separate authorities.**
  - Why: realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects. NotificationHub owns realtime write bounds and client cleanup; terminal/daemon policies remain distinct. DB event lookup and server timeline-context-order own their query/cache invariants. bb-app launcher owns config/readiness deadlines; start-server owns listener admission before recovery.
  - Source: `apps/app/src/hooks/cache-owners/realtime-cache-registry.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects.
  - Source: `apps/app/src/hooks/cache-owners/sidebar-refetch-lifecycle.test.ts`, `apps/server/test/app/client-protocol.test.ts`, `apps/server/test/app/hub-backpressure-native.test.ts`, `apps/server/test/app/hub-backpressure.test.ts`, `apps/server/test/app/startup-diagnostics.test.ts`, `apps/server/test/public/public-thread-context-clear-dispatch.test.ts`, `apps/server/test/server-move/imported-daemon-sessions.test.ts`, `apps/server/test/services/plugins/thread-progress-native-facet.test.ts`, `apps/server/test/services/threads/timeline-context-order-cache.test.ts`, `packages/bb-app/test/index.test.ts`, `packages/bb-app/test/server-health-identity.test.ts`, `packages/db/test/query-plans.test.ts`, `packages/sdk/test/realtime-client.test.ts`
- **Server effect and read owners. Shared sidebar dirty events coalesce within the existing flush and let an active read finish, followed by a bounded trailing catch-up. Overlapping-tail and inactive-remount races retain eventual freshness; explicit status replacement and terminal cancellation remain separate authorities.**
  - Why: realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects. NotificationHub owns realtime write bounds and client cleanup; terminal/daemon policies remain distinct. DB event lookup and server timeline-context-order own their query/cache invariants. bb-app launcher owns config/readiness deadlines; start-server owns listener admission before recovery.
  - Source: `apps/server/scripts/generate-bb-official-marketplace.ts`, `apps/server/src/services/threads/timeline-context-order.ts`, `apps/server/src/start-server.ts`, `apps/server/src/ws/client-protocol.ts`, `apps/server/src/ws/hub.ts`
- **bb-app package integration. Shared sidebar dirty events coalesce within the existing flush and let an active read finish, followed by a bounded trailing catch-up. Overlapping-tail and inactive-remount races retain eventual freshness; explicit status replacement and terminal cancellation remain separate authorities.**
  - Why: realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects. NotificationHub owns realtime write bounds and client cleanup; terminal/daemon policies remain distinct. DB event lookup and server timeline-context-order own their query/cache invariants. bb-app launcher owns config/readiness deadlines; start-server owns listener admission before recovery.
  - Source: `packages/bb-app/src/launcher.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- sidebar-refetch-lifecycle.test.ts
- realtime-cache-effects.test.ts
- hub-backpressure-native.test.ts
- hub-backpressure.test.ts
- client-protocol.test.ts
- realtime-client.test.ts
- query-plans.test.ts
- timeline-context-order-cache.test.ts
- server-health-identity.test.ts
- startup-diagnostics.test.ts

### Known limitations

- 0014 is mixed: deterministic integration witnesses/marketplace timestamps plus a real SDK reentrant socket-close fix.
- 0051 bounds retained raw ordering rows; it does not establish a universal bound on every folded context/cache across all connections.
- 0085 fixes the measured generic sidebar cancellation loop; it intentionally preserves purposeful status-fetch replacement. This is not a claim that all BB server or UI slowness is fixed.
- Live profiling established partial improvement of generic sidebar refresh churn; preserved status/mutation cancellation and multi-second diagnostic waits remain open. Upstream replacement candidates are documented in the workspace upstream-first audit; this current catalog does not claim they have been adopted.

### Retirement condition

Retire each optimization only with upstream-equivalent bounded behavior and measured/query-plan/lifecycle proof. Preserve sidebar status-fence semantics, exact query scope, rewrite/data-version invalidation, stalled-peer isolation and finite waits.

<details><summary>Selected patches (9) and source binding</summary>

- [0014-fix-tests-preserve-deterministic-downstream-integrat.patch](patches/0014-fix-tests-preserve-deterministic-downstream-integrat.patch)
- [0029-fix-bb-app-bound-optional-config-reload.patch](patches/0029-fix-bb-app-bound-optional-config-reload.patch)
- [0035-fix-server-bind-ingress-before-detached-recovery.patch](patches/0035-fix-server-bind-ingress-before-detached-recovery.patch)
- [0050-perf-db-look-up-delegating-item-rows-through-their-p.patch](patches/0050-perf-db-look-up-delegating-item-rows-through-their-p.patch)
- [0051-perf-server-extend-the-timeline-ordering-context-inc.patch](patches/0051-perf-server-extend-the-timeline-ordering-context-inc.patch)
- [0075-fix-bound-realtime-client-write-backlogs.patch](patches/0075-fix-bound-realtime-client-write-backlogs.patch)
- [0076-fix-allow-bounded-slow-server-startup.patch](patches/0076-fix-allow-bounded-slow-server-startup.patch)
- [0077-fix-guard-realtime-heartbeat-replies.patch](patches/0077-fix-guard-realtime-heartbeat-replies.patch)
- [0085-fix-coalesce-shared-sidebar-refresh.patch](patches/0085-fix-coalesce-shared-sidebar-refresh.patch)

Reviewed source digest: `a47920307e546a80572a75637a8e8aaee99cac83a7a429975102df38ecec3cd8`

</details>

<a id="safe-host-desktop"></a>
## Run remote and local agents with explicit network and browser prerequisites

New sandbox/desktop workflows should work with scoped machine identity and native browser protections, not silently disable those protections or assume the wrong binary.

### What this delivers

- Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.
- Selected Electron pin takes the XML security backport and its native SQLite validation follows the actually selected Electron version.
- Plugin-owned local/headless Chromium retains namespace sandboxing; a host lacking support fails startup. An isolated packaged-desktop profile changes profile selection without adding --no-sandbox. Desktop attachment does not alter an already running browser.

### Responsibility

- Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config.
- Desktop package/release launcher owns Electron pin/native validation/profile arguments.
- Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.

### Other affected areas

- **Dependency and package/export metadata needed by this capability.**
  - Why: Bind consumers and native/runtime prerequisites to the selected implementation rather than an unrelated ambient version.
  - Source: `apps/desktop/package.json`, `pnpm-lock.yaml`
- **Desktop process and browser lifecycle. Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.**
  - Why: Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config. Desktop package/release launcher owns Electron pin/native validation/profile arguments. Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.
  - Source: `apps/desktop/scripts/packaged-app-launch.mjs`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config.
  - Source: `apps/desktop/test/electron-builder-config.test.ts`, `apps/desktop/test/packaged-app-launch.test.ts`, `plugins/browser-automation/runtime.test.ts`, `plugins/environment-modal-sandbox/configuration.test.ts`, `plugins/environment-modal-sandbox/providers/modal/image.test.ts`, `plugins/environment-modal-sandbox/server.test.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/browser-automation/README.md`, `plugins/browser-automation/skills/browser-automation/SKILL.md`, `plugins/environment-modal-sandbox/README.md`, `plugins/environment-modal-sandbox/skills/modal-sandboxes/SKILL.md`
- **Native browser-automation plugin. Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.**
  - Why: Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config. Desktop package/release launcher owns Electron pin/native validation/profile arguments. Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.
  - Source: `plugins/browser-automation/runtime.ts`
- **Native environment-modal-sandbox plugin. Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.**
  - Why: Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config. Desktop package/release launcher owns Electron pin/native validation/profile arguments. Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.
  - Source: `plugins/environment-modal-sandbox/Dockerfile`, `plugins/environment-modal-sandbox/configuration.ts`, `plugins/environment-modal-sandbox/debug-sandbox.ts`, `plugins/environment-modal-sandbox/providers/modal/backend.ts`, `plugins/environment-modal-sandbox/providers/modal/client.ts`, `plugins/environment-modal-sandbox/providers/modal/tailnet.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- configuration.test.ts
- image.test.ts
- environment-modal-sandbox/server.test.ts
- electron-builder-config.test.ts
- packaged-app-launch.test.ts
- browser-automation/runtime.test.ts optional real Chrome witness

### Known limitations

- Modal support does not provide general UDP routing or mutate global Tailnet policy.
- Browser integration tests are conditional on real Chrome/runtime inputs; their existence is not proof they ran on every host.

### Retirement condition

Retire when upstream supplies equivalent Modal workload identity/network support and sandbox-preserving browser/desktop launch behavior, with actual selected native binary validation. Security pin advances are replaced by a reviewed newer pin rather than removed blindly.

<details><summary>Selected patches (5) and source binding</summary>

- [0024-feat-modal-join-sandboxes-to-tailnets-with-OIDC.patch](patches/0024-feat-modal-join-sandboxes-to-tailnets-with-OIDC.patch)
- [0069-fix-desktop-electron44-xml-security-backport.patch](patches/0069-fix-desktop-electron44-xml-security-backport.patch)
- [0070-test-desktop-selected-electron-native-validation.patch](patches/0070-test-desktop-selected-electron-native-validation.patch)
- [0071-fix-browser-automation-preserve-chromium-sandbox.patch](patches/0071-fix-browser-automation-preserve-chromium-sandbox.patch)
- [0072-fix-desktop-retain-sandbox-with-isolated-profile.patch](patches/0072-fix-desktop-retain-sandbox-with-isolated-profile.patch)

Reviewed source digest: `463aa9d9348cc7ae61a8489db9e71300c3a636c841f728cd8022a86d7673685a`

</details>

<a id="authoring-maintenance"></a>
## Keep planning files readable and downstream verification reproducible

The team works in Pkl plans and repeatedly rebases downstream behavior. Syntax support and deterministic, bounded native fixtures reduce false failures without inventing product behavior.

### What this delivers

- Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.
- ACP/ACP-next native-root tests isolate ambient workspaces; loaded workflow-shell and virtualized path-browser teardown fixtures tolerate their intended lifecycle.
- First-party recorded replay uses bounded concurrency while preserving recorded cells/order/deadlines; its test allows either worker start order. Downstream ports follow current lint/comment and fixture policies.

### Responsibility

- Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting.
- Provider native-root fixtures own their temporary workspace boundaries.
- Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract.
- Repository tests/lint own maintenance witnesses, not runtime policy.

### Other affected areas

- **Build and repository integration. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `.oxlintrc.json`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting.
  - Source: `apps/app/src/components/dialogs/RemotePathBrowser.createFolder.test.tsx`, `apps/app/src/components/ui/markdown-code-highlight.test.ts`, `packages/provider-bridge-protocol/src/testing/first-party-replay.ts`, `packages/provider-bridge-protocol/src/testing/parity.test.ts`, `packages/provider-bridge-protocol/src/testing/parity.ts`, `packages/scripts/test/pr-approval-workflows.test.ts`, `plugins/provider-acp-next/src/native-roots/native-roots.test.ts`, `plugins/provider-acp/src/native-roots/native-roots.test.ts`
- **Native client presentation and cache lifecycle. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `apps/app/src/components/ui/markdown-code-highlight.ts`
- **Dependency and package/export metadata needed by this capability.**
  - Why: Bind consumers and native/runtime prerequisites to the selected implementation rather than an unrelated ambient version.
  - Source: `packages/shared-ui/package.json`
- **shared-ui package integration. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `packages/shared-ui/src/lib/pkl-highlight.ts`
- **Native account-pool plugin. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `plugins/account-pool/src/required-external-pool.ts`
- **Native monaco-editor plugin. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `plugins/monaco-editor/lib/languages.ts`, `plugins/monaco-editor/lib/pkl-highlight.ts`, `plugins/monaco-editor/lib/pkl-language.ts`, `plugins/monaco-editor/monaco-bundle/editor.js`
- **Native provider-codex plugin. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `plugins/provider-codex/src/bridge/app-server-connection.ts`, `plugins/provider-codex/src/bridge/bridge.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- markdown-code-highlight.test.ts
- native-roots.test.ts
- pr-approval-workflows.test.ts
- RemotePathBrowser.createFolder.test.tsx
- parity.test.ts

### Known limitations

- 0061 spans lint configuration, local Monaco tokenizer and comment cleanup in provider/account-pool files. Its primary catalog home is maintenance/authoring; cross-links must acknowledge the touched runtime areas.
- 0017/0020/0021/0062/0081/0082 are tests/fixture policy, not new live user features. 0031 constrains only first-party recorded replay; it is not an inference concurrency limit.

### Retirement condition

Drop maintenance-only ports when their corresponding upstream fixture/CI behavior is equivalent. Retire Pkl support only if upstream provides equivalent syntax support or the team deliberately stops supporting it; preserve source-character/state tests.

<details><summary>Selected patches (9) and source binding</summary>

- [0012-feat-editor-add-Pkl-syntax-highlighting.patch](patches/0012-feat-editor-add-Pkl-syntax-highlighting.patch)
- [0017-test-provider-acp-isolate-native-roots-workspace.patch](patches/0017-test-provider-acp-isolate-native-roots-workspace.patch)
- [0020-test-scripts-allow-loaded-workflow-shell-cases.patch](patches/0020-test-scripts-allow-loaded-workflow-shell-cases.patch)
- [0021-test-app-settle-virtualized-path-browser-cleanup.patch](patches/0021-test-app-settle-virtualized-path-browser-cleanup.patch)
- [0031-fix-provider-bridge-protocol-bound-first-party-recor.patch](patches/0031-fix-provider-bridge-protocol-bound-first-party-recor.patch)
- [0061-chore-upstream-align-downstream-ports-with-CI-policy.patch](patches/0061-chore-upstream-align-downstream-ports-with-CI-policy.patch)
- [0062-test-upstream-allow-concurrent-replay-worker-start-order.patch](patches/0062-test-upstream-allow-concurrent-replay-worker-start-order.patch)
- [0081-test-isolate-acp-next-native-roots-fixture.patch](patches/0081-test-isolate-acp-next-native-roots-fixture.patch)
- [0082-test-follow-native-fixture-lint-policy.patch](patches/0082-test-follow-native-fixture-lint-policy.patch)

Reviewed source digest: `37f6330b5063a9cbc23fc3275d24046db69c88cef10644e46bee83fd331f75f8`

</details>
