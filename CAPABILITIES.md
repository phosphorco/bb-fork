# Current downstream capabilities

<!-- Generated from capabilities.json by scripts/check-capability-catalog.mjs. Do not edit by hand. -->

This is the selected source delta: **8 capabilities / 8 patches**. It is not a deployment or live-test receipt.

- Reviewed upstream: `05199007ecad513b714b244e46b0ab2a9a06279f`
- Reviewed result tree: `0a48067e944b48caf193d96f736553b96d7ad504`

The checker enforces explicit source coverage and review freshness. Each capability digest binds its primary patches and all selected patches touching the same source files, requiring shared-source dependency review. Human review establishes whether explanations and state/API identities are semantically complete. Historical notes remain in [DOWNSTREAM.md](DOWNSTREAM.md).

| Capability | Motivation | Patches |
| --- | --- | --- |
| [Retain existing state through native upstream migrations](#retained-state-and-migrations) | Existing team history must survive an upstream upgrade without discarding applied receipts or silently skipping newer native schema changes. | 1 |
| [Preserve trusted authorship through native dispatch](#trusted-authorship-and-dispatch) | Native send, queue and restart paths must preserve accepted authors and execution intent while upstream owns scheduling. | 1 |
| [Expose bounded team plugin contracts](#shared-plugin-contracts) | Team plugins need explicit identity, facets and execution contracts without reviving retired prompt rendering or admission APIs. | 1 |
| [Preserve the external inference relay and provider evidence](#inference-relay-and-provider-evidence) | Company inference must continue through the configured relay and retain exact provider response identities for attribution. | 1 |
| [Keep team navigation and useful diagnostics](#team-navigation-and-diagnostics) | Shared-team navigation, mentions and copyable errors must survive native upstream UI changes without retaining obsolete cache implementations. | 1 |
| [Preserve native transport and diagnose startup failures](#service-lifecycle-and-transport) | Company startup policy must preserve valid native realtime traffic while avoiding premature restart loops. | 1 |
| [Integrate and verify the selected upstream cohort](#integration-and-verification) | The selected native server, CLI, daemon and SDK must build as one cohort and retain native sandbox and dependency policy. | 1 |
| [Maintain reviewed BB Guide wording in source](#prompt-wording) | Company guide wording belongs in a focused source patch before interpolation; runtime rewriting must not touch user message bodies. | 1 |

<a id="retained-state-and-migrations"></a>
## Retain existing state through native upstream migrations

Existing team history must survive an upstream upgrade without discarding applied receipts or silently skipping newer native schema changes.

### What this delivers

- Existing team history must survive an upstream upgrade without discarding applied receipts or silently skipping newer native schema changes.

### Responsibility

- Native database migration owns schema transitions; the P6R sidecar owns retained team identity evidence.

### Database model

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
- **Adds participant input-watermark projection cache.**
  - Why: Skip unchanged attribution projection while binding cached output to exact source inputs and projector version.
  - State/API identities: `p6r_participant_watermarks`
  - Source: `apps/server/src/services/p6r/drizzle/0003_participant_watermarks.sql`
- **Generated state or contract artifacts accompany the owning schema/API change; repeated snapshots are not separate product capabilities.**
  - Why: Keep source, generated consumers and persisted-state receipts in one coherent cohort.
  - Source: `apps/server/src/services/p6r/drizzle/meta/0000_snapshot.json`
- **Generated state or contract artifacts accompany the owning schema/API change; repeated snapshots are not separate product capabilities.**
  - Why: Keep source, generated consumers and persisted-state receipts in one coherent cohort.
  - Source: `apps/server/src/services/p6r/drizzle/meta/0001_snapshot.json`
- **Generated state or contract artifacts accompany the owning schema/API change; repeated snapshots are not separate product capabilities.**
  - Why: Keep source, generated consumers and persisted-state receipts in one coherent cohort.
  - Source: `apps/server/src/services/p6r/drizzle/meta/0002_snapshot.json`
- **Generated state or contract artifacts accompany the owning schema/API change; repeated snapshots are not separate product capabilities.**
  - Why: Keep source, generated consumers and persisted-state receipts in one coherent cohort.
  - Source: `apps/server/src/services/p6r/drizzle/meta/0003_snapshot.json`
- **Generated state or contract artifacts accompany the owning schema/API change; repeated snapshots are not separate product capabilities.**
  - Why: Keep source, generated consumers and persisted-state receipts in one coherent cohort.
  - Source: `apps/server/src/services/p6r/drizzle/meta/_journal.json`
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
- **Canonical identity/facet and Context Magnet DDL; runtime bridge completes columns and validates exact retained shapes.**
  - Why: Replace historical migration collisions without rewriting applied receipts or losing accepted identity/evidence.
  - State/API identities: `context_magnet_contribution_trace_receipts`, `context_magnet_trace_receipt_contribution_idx`, `context_magnet_contribution_trace_snapshots`, `context_magnet_trace_snapshot_thread_idx`, `context_magnet_contribution_traces`, `context_magnet_trace_thread_sequence_idx`, `context_magnet_trace_thread_operation_idx`, `context_magnet_provider_admission_attempts`, `context_magnet_admission_attempt_contribution_idx`, `context_magnet_admission_attempt_thread_sequence_idx`, `context_magnet_provider_admission_observations`, `context_magnet_admission_observation_thread_idx`, `context_magnet_provider_admission_retention`, `context_magnet_admission_retention_thread_idx`, `context_magnet_provider_admission_sequences`, `thread_facet_cursor_keys`, `thread_facet_declarations`, `thread_facet_members`, `thread_facet_members_rank_idx`, `thread_facet_owners`, `thread_facet_principal_profiles`, `thread_facet_principal_profiles_position_idx`, `thread_facet_reconciliation_targets`, `thread_facet_reconciliation_targets_pending_idx`, `thread_facet_relations`, `thread_facet_relations_member_thread_idx`, `thread_facet_snapshots`, `thread_facet_snapshots_generation_thread_idx`
  - Source: `packages/db/drizzle/0145_identity_context_bridge.sql`
- **Adds required, no-default environment_variables.secret integer classification.**
  - Why: Mask actual credentials only, keep ordinary diagnostics visible, refuse guessed classification of populated old state.
  - State/API identities: `environment_variables`, `environment_variables.secret`
  - Source: `packages/db/drizzle/0146_environment_secret_classification.sql`
- **Retain existing state through native upstream migrations: meta/0158_snapshot.json**
  - Why: Existing team history must survive an upstream upgrade without discarding applied receipts or silently skipping newer native schema changes.
  - Source: `packages/db/drizzle/meta/0158_snapshot.json`
- **Generated state or contract artifacts accompany the owning schema/API change; repeated snapshots are not separate product capabilities.**
  - Why: Keep source, generated consumers and persisted-state receipts in one coherent cohort.
  - Source: `packages/db/drizzle/meta/_journal.json`
- **Refuses client/turn/requested events from daemon append batches; native accepted request events remain server-owned. No schema or index is added here.**
  - Why: A daemon must not forge the authoritative request event used to establish native accepted authorship and participant targets.
  - State/API identities: `appendDaemonEventsInTransaction`, `client/turn/requested`
  - Source: `packages/db/src/data/events.ts`
- **Reexports the capability-owned database operations or ID constructors: CoreParticipantProfile, CoreParticipantSummary, SetThreadExecutionOverrideBatchInput, ThreadExecutionOverrideRow, ThreadExecutionProjectionRow, ThreadFacetDeclaration, ThreadFacetGeneration, ThreadFacetIdPage, ThreadFacetInvariantError, ThreadFacetInvariantErrorCode, ThreadFacetQueryPosition, activatePluginThreadFacetDeclarations, getOrCreateThreadFacetCursorSigningKey, listCoreParticipantProfilePage, listCoreParticipantProfilesByThreadIds, listCoreParticipantSummariesByThreadIds, listPriorThreadFacetSnapshotTargets, listThreadExecutionOverridesByThreadIds, listThreadExecutionProjectionRowsByIds, listThreadFacetOwnerProjections, listThreadIdsMissingCoreParticipantProjection, markThreadFacetOwnerGenerationReady, markThreadFacetOwnerGenerationUnavailable, queryThreadFacetThreadIds, recordThreadFacetCensusExhausted, replaceCoreParticipantProfiles, replaceCoreParticipantProfilesBatch, replaceCoreParticipantProfilesInTransaction, replaceThreadFacetRelationsInGeneration, setThreadExecutionOverridesBatch. This support boundary adds no independent table or migration.**
  - Why: Keep the database package entrypoint coherent with the owning state/query implementation and its consumers.
  - State/API identities: `CoreParticipantProfile`, `CoreParticipantSummary`, `SetThreadExecutionOverrideBatchInput`, `ThreadExecutionOverrideRow`, `ThreadExecutionProjectionRow`, `ThreadFacetDeclaration`, `ThreadFacetGeneration`, `ThreadFacetIdPage`, `ThreadFacetInvariantError`, `ThreadFacetInvariantErrorCode`, `ThreadFacetQueryPosition`, `activatePluginThreadFacetDeclarations`, `getOrCreateThreadFacetCursorSigningKey`, `listCoreParticipantProfilePage`, `listCoreParticipantProfilesByThreadIds`, `listCoreParticipantSummariesByThreadIds`, `listPriorThreadFacetSnapshotTargets`, `listThreadExecutionOverridesByThreadIds`, `listThreadExecutionProjectionRowsByIds`, `listThreadFacetOwnerProjections`, `listThreadIdsMissingCoreParticipantProjection`, `markThreadFacetOwnerGenerationReady`, `markThreadFacetOwnerGenerationUnavailable`, `queryThreadFacetThreadIds`, `recordThreadFacetCensusExhausted`, `replaceCoreParticipantProfiles`, `replaceCoreParticipantProfilesBatch`, `replaceCoreParticipantProfilesInTransaction`, `replaceThreadFacetRelationsInGeneration`, `setThreadExecutionOverridesBatch`
  - Source: `packages/db/src/data/index.ts`
- **Broadens reads to DbQueryConnection for shared transaction/read context; no added table, column or persisted setting.**
  - Why: Allow coherent/batched execution/admission reads without inventing another settings authority.
  - State/API identities: `getProjectExecutionDefaults`, `listProjectExecutionDefaultsByProjectIds`
  - Source: `packages/db/src/data/project-execution-defaults.ts`
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
- **Adds a pre-mutation classification guard for populated environment_variables and legacy app_settings_values machineEnvironment:* records; requires explicit valid secret classification. Does not create the identity bridge/staging tables.**
  - Why: An operator must classify retained values using provenance before the new diagnostic policy is applied; the migration must not guess or silently mask every ordinary value.
  - State/API identities: `assertEnvironmentSecretClassification`, `environment_variables.secret`, `app_settings_values`
  - Source: `packages/db/src/migrate.ts`
- **Adds eight thread-facet tables and their indexes, queued_thread_messages.p6r_authors and threads.execution_revision. The cursor signing secret belongs to thread_facet_cursor_keys; environment classification belongs to diagnostic-environment.**
  - Why: Persist queryable owner-scoped facets and accepted queue attribution, with revision fencing for execution changes. These are the model additions made by this capability’s patches.
  - State/API identities: `thread_facet_cursor_keys`, `thread_facet_declarations`, `thread_facet_members`, `thread_facet_owners`, `thread_facet_principal_profiles`, `thread_facet_reconciliation_targets`, `thread_facet_relations`, `thread_facet_snapshots`, `thread_facet_members_rank_idx`, `thread_facet_principal_profiles_position_idx`, `thread_facet_reconciliation_targets_pending_idx`, `thread_facet_relations_member_thread_idx`, `thread_facet_snapshots_generation_thread_idx`, `thread_facet_cursor_keys.secret`, `thread_facet_principal_profiles.identity_kind`, `threads.execution_revision`, `queued_thread_messages.p6r_authors`
  - Source: `packages/db/src/schema.ts`

### Other affected areas

- **Source generator configuration for the sidecar schema/migration directory.**
  - Why: Keep generated DDL and schema authoritative under one generator configuration.
  - Source: `apps/server/src/services/p6r/sidecar-drizzle.config.mjs`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `apps/server/test/services/p6r/sidecar-built-artifact.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/p6r/sidecar-startup-migration.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/p6r/sidecar-store.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. packages/db/src/migrate.ts owns recognized historical ledger admission and main DB transition.
  - Source: `packages/db/test/data/events.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/db/test/data/queued-thread-messages.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/db/test/data/threads.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `packages/db/test/environment-classification-migration.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. packages/db/src/migrate.ts owns recognized historical ledger admission and main DB transition.
  - Source: `packages/db/test/fixtures/legacy-identity-context-magnet/0119_soft_pandemic.sql`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. packages/db/src/migrate.ts owns recognized historical ledger admission and main DB transition.
  - Source: `packages/db/test/fixtures/legacy-identity-context-magnet/0120_early_virginia_dare.sql`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. packages/db/src/migrate.ts owns recognized historical ledger admission and main DB transition.
  - Source: `packages/db/test/fixtures/legacy-identity-context-magnet/0121_sticky_king_bedlam.sql`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. packages/db/src/migrate.ts owns recognized historical ledger admission and main DB transition.
  - Source: `packages/db/test/fixtures/legacy-identity-context-magnet/0122_living_quasimodo.sql`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `packages/db/test/helpers/rewind.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/db/test/migrate.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `packages/db/test/pane-focus-bindings-migration.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `packages/db/test/queued-message-state-migration.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `packages/db/test/sidebar-installation-defaults.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `packages/db/test/thread-drafts-migration.test.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- Migration tests cover fresh, historical, retired-admission and repeat-start cohorts.

### Known limitations

- Build and controlled tests do not substitute for deployed workflow verification.

### Retirement condition

Remove bridge logic only when no supported retained database has its exact historical receipts.

<details><summary>Selected patches (1) and source binding</summary>

- [0001-retained-state-and-migrations.patch](patches/0001-retained-state-and-migrations.patch)

Reviewed source digest: `92e939e01cf8cb5d0ae3872d87ffa49d5973bf0d50e3a2882dbe96029f598e30`

</details>

<a id="trusted-authorship-and-dispatch"></a>
## Preserve trusted authorship through native dispatch

Native send, queue and restart paths must preserve accepted authors and execution intent while upstream owns scheduling.

### What this delivers

- Native send, queue and restart paths must preserve accepted authors and execution intent while upstream owns scheduling.

### Responsibility

- P6R captures verified actors and native dispatch owns execution and cancellation.

### Core SDK and APIs

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

### Other affected areas

- **Owns DB startup: migrate core, migrate sidecar, then seed personal project; closes DB on failure.**
  - Why: Neither sidecar objects nor retained schema are usable before both migration owners finish.
  - Source: `apps/server/src/db.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/p6r/invocation-registry.ts`
- **Coordinates core request event/queue writes and P6R acceptance receipts in native acceptance transactions.**
  - Why: An accepted message must not lose its original attribution or create duplicate dispatch on retry.
  - Source: `apps/server/src/services/p6r/native-acceptance.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/p6r/native-authorship.ts`
- **Projects accepted contribution authors/editors and native request participant targets into the existing core participant relation/profile/snapshot model.**
  - Why: Preserve person, machine and integration-asserted external identity kinds in participant reads; projection evidence does not establish provider readiness.
  - Source: `apps/server/src/services/p6r/participant-projection.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/p6r/provider-registry.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/p6r/receipt-outcome.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/p6r/tool-correlation-registry.ts`
- **Server effect and read owners. Native create/send/queue/edit/correction flows evaluate submissions under published message policies and retain operation identities, evaluations, immutable accepted originals, acknowledgements, advice and preparation state.**
  - Why: NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle. packages/db/src/data/message-admission.ts owns operations, publications, evaluations, originals and transition transactions. Thread queue/send/edit/provision owners perform the concrete effect under frozen accepted data; client submission-identity store preserves retry identity.
  - Source: `apps/server/src/services/threads/child-thread-notifications.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/dispatch-attempt.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/queue-waits.ts`
- **Owns automatic queued dispatch and revisits host-offline waits for currently connected hosts during periodic idle recovery; reconnect and periodic recovery share the same attempt path. Failed attempts include resulting row state/wait/retry and connection evidence.**
  - Why: An interrupted reconnect or lost claim must not leave an accepted row parked indefinitely after its host is back. This repairs the native-admission overlay recovery gap without new state, public APIs or daemon wire fields.
  - Source: `apps/server/src/services/threads/queued-message-dispatch.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/queued-messages.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/thread-create.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/thread-edit-message.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/thread-events.ts`
- **Server effect and read owners. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `apps/server/src/services/threads/thread-execution-batch.ts`
- **Server effect and read owners. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `apps/server/src/services/threads/thread-execution-override.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/thread-facet-query.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/thread-fork.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/thread-provisioning.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/thread-queued-messages.ts`
- **Server effect and read owners. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `apps/server/src/services/threads/thread-runtime-display.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/thread-send-request.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/thread-send.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/threads/thread-turn-dispatch.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB Context Magnet trace/history functions own retained evidence and bounded reads.
  - Source: `apps/server/test/services/p6r/contribution-lookup.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/p6r/external-contribution.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/p6r/identity-protocol.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/p6r/invocation-registry.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/p6r/mention-target-service-paths.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/p6r/mention-targets.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/p6r/native-acceptance.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/p6r/native-message-authorship.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `apps/server/test/services/p6r/participant-watermarks.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/p6r/provider-admission.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/p6r/provider-registry.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `apps/server/test/services/threads/test-fault-barriers.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `apps/server/test/services/threads/thread-execution-batch.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `apps/server/test/services/threads/thread-execution-override.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/threads/thread-queued-messages.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/threads/thread-runtime-display.test.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- Native authorship and delayed sender rejection tests exercise cold start and queued dispatch.

### Known limitations

- Message Rules uses native static sender accept/reject; paid evaluation and delivery changes refuse explicitly. Native hook bypass and edited-resend boundaries remain upstream behavior.

### Retirement condition

Retire custom authorship plumbing when upstream exposes equivalent provenance and lifetime semantics.

<details><summary>Selected patches (1) and source binding</summary>

- [0002-trusted-authorship-and-dispatch.patch](patches/0002-trusted-authorship-and-dispatch.patch)

Reviewed source digest: `cb44ada47bea0c109e8ea39b6e71f8977a7dcb5d015ddcf648fe05d794419f16`

</details>

<a id="shared-plugin-contracts"></a>
## Expose bounded team plugin contracts

Team plugins need explicit identity, facets and execution contracts without reviving retired prompt rendering or admission APIs.

### What this delivers

- Team plugins need explicit identity, facets and execution contracts without reviving retired prompt rendering or admission APIs.

### Responsibility

- Plugin runtime owns generation lifetimes; SDK exposes bounded contracts and cancellation.

### Core SDK and APIs

- **Adds execution-options-changed thread invalidation kind.**
  - Why: Invalidate execution detail/list summaries when batch override changes rather than leave cached old model/reasoning. Contract obligations: Wire enum addition coupled to invalidation consumers; not an inference-routing change. Consumers: apps/app/src/lib/thread-invalidation.ts, apps/server/src/services/threads/thread-execution-batch.ts.
  - Visibility: public
  - State/API identities: `THREAD_CHANGE_KINDS`
  - Source: `packages/domain/src/change-kinds.ts`
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
- **Exports commentary|final_answer phase schema/type and adds optional nullable phase to agentMessage event items.**
  - Why: Preserve supported native Codex response phase through parser, delta assembler and persisted events without requiring it from other providers. Historical authentication-slot masking belongs to diagnostic-environment.
  - Visibility: public
  - State/API identities: `threadEventAgentMessagePhaseSchema`, `ThreadEventAgentMessagePhase`, `threadEventItemSchema`
  - Source: `packages/domain/src/provider-event.ts`
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
- **thread.start accepts up to16 contextMagnetAdmissionAttempts and returns a started/failed union with up to32 constructed/accepted/failed-settlement observations. thread.rewind.prepare retains its separate bare providerThreadId result.**
  - Why: The server needs honest provider admission receipts even when construction fails. The old bare thread.start result no longer meets this daemon schema. This is protocol240 cohort work; secret provenance and required external model catalog are documented under their own capabilities.
  - Visibility: internal
  - State/API identities: `threadStartCommandSchema`, `threadStartAdmissionObservationSchema`, `threadStartResultSchema`, `threadRewindPrepareResultSchema`, `hostDaemonCommandRegistry`
  - Source: `packages/host-daemon-contract/src/commands.ts`
- **Adds PluginSidebarThread.p6rParticipants and the data-only experimental_sidebarLayoutProvider slot with publish(layout|null) and subscribeChanges.**
  - Why: sidebar-defaults supplies order/visibility while BB retains sidebar rendering, navigation and interaction ownership. The first provider in deterministic slot order wins; publish(null) withdraws its layout. Composer operation identity is a separate capability.
  - Visibility: public
  - State/API identities: `PluginSidebarThread.p6rParticipants`, `P6rParticipantProfile`, `ExperimentalSidebarLayout`, `ExperimentalSidebarLayoutProviderProps`, `ExperimentalSidebarLayoutProviderRegistration`, `PluginAppSlots.experimental_sidebarLayoutProvider`
  - Source: `packages/plugin-sdk/src/app-contract.ts`
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
- **normalizePluginAgentConfiguration accepts and validates experimental_contextMagnetTrace.**
  - Why: A declaration must select its receiptTool, use an unmatched/null-target operation witness and avoid provider/request-body evidence. Current body-key collection restrictions are distinct from authentication-secret masking. Provider env validation is owned by diagnostic-environment.
  - Visibility: internal
  - State/API identities: `normalizePluginAgentConfiguration`
  - Source: `packages/plugin-sdk/src/internal/host-policy.ts`
- **Expose bounded team plugin contracts: internal/plugin-app-registration-collector.ts**
  - Why: Team plugins need explicit identity, facets and execution contracts without reviving retired prompt rendering or admission APIs.
  - Visibility: internal
  - State/API identities: `plugin-app-registration-collector`
  - Source: `packages/plugin-sdk/src/internal/plugin-app-registration-collector.ts`
- **Adds unauthenticated and unavailable error-code arms.**
  - Why: Represent request identity failures at RPC boundary instead of generic internal failures. Contract obligations: HTTP maps these to 401 and 503 respectively; invalid_input remains 400. Consumers: apps/server/src/routes/plugins.ts.
  - Visibility: public
  - State/API identities: `PluginRpcErrorCode`
  - Source: `packages/plugin-sdk/src/rpc-contract.ts`
- **Forwards the newly required input.secret in project environment writes.**
  - Why: Preserve explicit credential role across SDK -> REST -> protected storage -> daemon. Contract obligations: Existing endpoint/method; input shape is changed by its shared contract, not a new settings endpoint. Consumers: packages/server-contract/src/api/machine-environment.ts.
  - Visibility: public
  - State/API identities: `ProjectsArea.setMachineEnvironmentVariable`
  - Source: `packages/sdk/src/areas/projects.ts`
- **Adds abortable p6rIdentity read for GET /api/v1/system/p6rIdentity.**
  - Why: Resolve native attribution presentation through a server-owned request boundary. Contract obligations: P6rIdentityResponse type is imported from server-contract; this method is fork-only despite living under existing SystemArea. Consumers: apps/app/src/components/settings/P6rIdentitySettingsSection.tsx:12.
  - Visibility: public
  - State/API identities: `SystemArea.p6rIdentity`
  - Source: `packages/sdk/src/areas/system.ts`
- **Adds queryFacets, facetParticipants, experimental_preflightExecutionOverrides and experimental_applyExecutionOverrides plus their argument/result types.**
  - Why: thread-manager consumes preflight/apply and bounded facet queries; inbox-sidebar-nerd, identity-boundaries and bb-identity consume shared views. Requests propagate AbortSignal and preserve server cursor/witness/token semantics. No admission journal or context-magnet read is part of these methods.
  - Visibility: public
  - State/API identities: `ThreadFacetQueryArgs`, `ThreadFacetParticipantsArgs`, `ExperimentalThreadExecutionPreflightArgs`, `ExperimentalThreadExecutionApplyArgs`, `ThreadsArea.queryFacets`, `ThreadsArea.facetParticipants`, `ThreadsArea.experimental_preflightExecutionOverrides`, `ThreadsArea.experimental_applyExecutionOverrides`
  - Source: `packages/sdk/src/areas/threads.ts`
- **Makes close() idempotent after a close request or already-closing socket.**
  - Why: Avoid repeated transport close calls during heartbeat/backpressure cleanup. Contract obligations: No new websocket message shape, subscribe semantics, method or public type. Consumers: apps/server/src/ws/client-protocol.ts.
  - Visibility: public
  - State/API identities: `createRealtimeSocketAdapter`
  - Source: `packages/sdk/src/realtime-client.ts`
- **Writes now require secret:boolean. Reads are discriminated: secret=true returns value=null, secret=false returns actual string.**
  - Why: Mask actual credentials while keeping ordinary diagnostic environment values visible. Contract obligations: Old writes without secret no longer meet the strict schema; every writer must select provenance deliberately. Authentication values remain protected; this does not change the actual provider environment. Consumers: packages/sdk/src/areas/projects.ts, packages/sdk/src/areas/system.ts, apps/server/src/routes/projects.ts, apps/server/src/routes/system.ts.
  - Visibility: public
  - State/API identities: `machineEnvironmentSetSchema`, `machineEnvironmentVariableSchema`, `MachineEnvironmentSet`, `MachineEnvironmentVariable`
  - Source: `packages/server-contract/src/api/machine-environment.ts`
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
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `packages/domain/test/environment-credential-projection.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/domain/test/p6r-message-author.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `packages/domain/test/stored-thread-event.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/domain/test/thread.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB Context Magnet trace/history functions own retained evidence and bounded reads.
  - Source: `packages/host-daemon-contract/test/contract.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `packages/host-daemon-contract/test/environment-classification.test.ts`
- **Dependency and package/export metadata needed by this capability.**
  - Why: Bind consumers and native/runtime prerequisites to the selected implementation rather than an unrelated ambient version.
  - Source: `packages/plugin-sdk/package.json`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `packages/plugin-sdk/src/__tests__/frontend-exports.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/plugin-sdk/src/__tests__/public-types.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB Context Magnet trace/history functions own retained evidence and bounded reads.
  - Source: `packages/plugin-sdk/src/testing/__tests__/fake-plugin-host.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `packages/plugin-sdk/src/testing/fake-plugin-host.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/plugin-sdk/src/testing/fixtures.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/sdk/test/public-types.test.ts`
- **Expose bounded team plugin contracts: test/realtime-adapter-close.test.ts**
  - Why: Team plugins need explicit identity, facets and execution contracts without reviving retired prompt rendering or admission APIs.
  - Source: `packages/sdk/test/realtime-adapter-close.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `packages/sdk/test/sdk.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/server-contract/test/contract.test.ts`
- **test-helpers package integration. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `packages/test-helpers/src/domain-fixtures.ts`
- **thread-view package integration. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `packages/thread-view/src/build-thread-timeline.ts`
- **thread-view package integration. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `packages/thread-view/src/event-projection-message.ts`
- **thread-view package integration. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `packages/thread-view/src/user-message-parsing.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/thread-view/test/user-message-parsing.test.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- Plugin identity-boundary tests exercise registration, disposal and abort propagation.

### Known limitations

- Build and controlled tests do not substitute for deployed workflow verification.

### Retirement condition

Retire individual seams as equivalent native SDK contracts become available.

<details><summary>Selected patches (1) and source binding</summary>

- [0003-shared-plugin-contracts.patch](patches/0003-shared-plugin-contracts.patch)

Reviewed source digest: `724eb46e6a74852306398929439f701cd3cfa9183f0653a6cdc89ebf723258f8`

</details>

<a id="inference-relay-and-provider-evidence"></a>
## Preserve the external inference relay and provider evidence

Company inference must continue through the configured relay and retain exact provider response identities for attribution.

### What this delivers

- Company inference must continue through the configured relay and retain exact provider response identities for attribution.

### Responsibility

- Provider launch/configuration owns the relay; provider adapters retain response evidence without changing routing.

### Core SDK and APIs

- **Forwards contextMagnetAdmissionAttempts on start/resume/fork provider construction.**
  - Why: Preserve host-created admission attempt/contribution references across the adapter without treating successful transport as model consumption. This is implementation forwarding of the changed bridge contract, not a new public method.
  - Visibility: internal
  - State/API identities: `createBridgeProtocolAdapter`
  - Source: `packages/agent-runtime/src/bridge-protocol-adapter.ts`
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
- **Preserves agentMessage phase on both immediate close and incremental completion assembly.**
  - Why: Prevent accepted wire field disappearing before event persistence/UI. Contract obligations: No new public callable; data-loss prevention for an extended wire shape. Consumers: packages/domain/src/provider-event.ts.
  - Visibility: internal
  - State/API identities: `createDeltaAssembler`
  - Source: `packages/provider-bridge-protocol/src/assembler/delta-assembler.ts`
- **Start/resume/fork construction requests gain optional contextMagnetAdmissionAttempts; threadConstructionResultSchema accepts structured started/failed settlements plus the original bare threadIdentityResultSchema.**
  - Why: Carry up to16 attempts and32 observations without discarding failed admission facts. Constructed/accepted is not consumed. Structured started includes providerThreadId and optional sessionRestorable; failed includes observations. The bare bridge result remains supported, unlike the stricter daemon thread.start result.
  - Visibility: internal
  - State/API identities: `threadStartParamsSchema`, `threadResumeParamsSchema`, `threadForkParamsSchema`, `threadConstructionResultSchema`
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
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/host-daemon/src/app.test.ts`
- **Host execution and server/daemon transport. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `apps/host-daemon/src/app.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB Context Magnet trace/history functions own retained evidence and bounded reads.
  - Source: `apps/host-daemon/src/command-dispatch.test.ts`
- **Host execution and server/daemon transport. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `apps/host-daemon/src/command-dispatch.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/host-daemon/src/machine-environment.test.ts`
- **In-memory immutable environment contribution/provenance snapshot; no new on-disk store.**
  - Why: Environment synchronization and per-command diagnostics must share the exact classification/source bytes.
  - Source: `apps/host-daemon/src/machine-environment.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/host-daemon/src/operation-environment.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/host-daemon/src/plugin-host-manager.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/host-daemon/src/runtime-manager.test.ts`
- **Host execution and server/daemon transport. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `apps/host-daemon/src/runtime-manager.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/host-daemon/src/terminals/terminal-manager.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/host-daemon/test/command/environment-dispatch.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/host-daemon/test/command/environment-hook.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/host-daemon/test/command/project-clone-private-env.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `apps/host-daemon/test/command/thread-dispatch.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `packages/agent-runtime/src/integration.env-isolation.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `packages/agent-runtime/src/runtime.codex-topology.test.ts`
- **Preserve the external inference relay and provider evidence: src/runtime.command-contract.test.ts**
  - Why: Company inference must continue through the configured relay and retain exact provider response identities for attribution.
  - Source: `packages/agent-runtime/src/runtime.command-contract.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `packages/agent-runtime/src/runtime.lifecycle.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `packages/agent-runtime/src/runtime.recovery.test.ts`
- **agent-runtime package integration. Context Magnet retains explicit bounded host-supplied contribution declarations, trace records, immutable pagination bounds and model receipt-tool consumption evidence.**
  - Why: DB Context Magnet trace/history functions own retained evidence and bounded reads. Agent runtime/provider bridge owns construction/admission observations; server combines these without promoting evidence strength. Prompt renderer/plugin generation registry owns synchronous rendering, disposal, middleware order and observations. P6R sidecar-store owns exact contribution lookup and payload decoding.
  - Source: `packages/agent-runtime/src/runtime.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `packages/agent-runtime/src/thread-shell-environment.test.ts`
- **agent-runtime package integration. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `packages/agent-runtime/src/thread-shell-environment.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/config/test/config.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `packages/config/test/tailnet-default.test.ts`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/approval-allow/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/approval-deny/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/archived-resume/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/compaction/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/empty-rollout/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/fork/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/missing-rollout/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/plan-mode/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/resume/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/steer/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/stop-interrupt/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/subagent/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/turn-tools/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/user-question/bridge→runtime.current.ndjson`
- **provider-bridge-protocol package integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `packages/provider-bridge-protocol/recordings/codex/web-search/bridge→runtime.current.ndjson`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `packages/provider-bridge-protocol/src/assembler/delta-assembler.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `packages/provider-bridge-protocol/src/contract-tests/provider-bridge-grammar.v2.snapshot.json`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting.
  - Source: `packages/provider-bridge-protocol/src/testing/first-party-replay.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting.
  - Source: `packages/provider-bridge-protocol/src/testing/parity.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting.
  - Source: `packages/provider-bridge-protocol/src/testing/parity.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `packages/provider-bridge-protocol/src/thread-delta.test.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/account-pool/PLUGIN_OVERVIEW.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/account-pool/skills/account-pool/SKILL.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/account-pool/skills/account-pool/references/accounts-and-routing.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/account-pool/skills/account-pool/references/required-external-inference.md`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `plugins/account-pool/src/required-external-pool.test.ts`
- **Native account-pool plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/account-pool/src/required-external-pool.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `plugins/account-pool/src/server.test.ts`
- **Native account-pool plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/account-pool/src/server.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting.
  - Source: `plugins/provider-acp/src/native-roots/native-roots.test.ts`
- **Native provider-claude-code plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/provider-claude-code/server.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `plugins/provider-claude-code/src/bridge/__tests__/bridge.calibration.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `plugins/provider-claude-code/src/bridge/__tests__/bridge.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `plugins/provider-claude-code/src/bridge/__tests__/sdk-session.test.ts`
- **Native provider-claude-code plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/provider-claude-code/src/bridge/model-list.ts`
- **Native provider-claude-code plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/provider-claude-code/src/bridge/provider-maintenance.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `plugins/provider-claude-code/src/bridge/required-external-maintenance.test.ts`
- **Native provider-claude-code plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/provider-claude-code/src/bridge/sdk-session.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `plugins/provider-claude-code/src/delta-translation.test.ts`
- **Native provider-claude-code plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/provider-claude-code/src/delta-translation.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `plugins/provider-claude-code/src/response-identity.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `plugins/provider-codex/src/bridge/app-server-launch.test.ts`
- **Native provider-codex plugin. Context Magnet retains explicit bounded host-supplied contribution declarations, trace records, immutable pagination bounds and model receipt-tool consumption evidence.**
  - Why: DB Context Magnet trace/history functions own retained evidence and bounded reads. Agent runtime/provider bridge owns construction/admission observations; server combines these without promoting evidence strength. Prompt renderer/plugin generation registry owns synchronous rendering, disposal, middleware order and observations. P6R sidecar-store owns exact contribution lookup and payload decoding.
  - Source: `plugins/provider-codex/src/bridge/bridge.ts`
- **Native provider-codex plugin. Context Magnet retains explicit bounded host-supplied contribution declarations, trace records, immutable pagination bounds and model receipt-tool consumption evidence.**
  - Why: DB Context Magnet trace/history functions own retained evidence and bounded reads. Agent runtime/provider bridge owns construction/admission observations; server combines these without promoting evidence strength. Prompt renderer/plugin generation registry owns synchronous rendering, disposal, middleware order and observations. P6R sidecar-store owns exact contribution lookup and payload decoding.
  - Source: `plugins/provider-codex/src/bridge/fake-codex-app-server.mjs`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `plugins/provider-codex/src/bridge/provider-maintenance.test.ts`
- **Native provider-codex plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/provider-codex/src/bridge/provider-maintenance.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `plugins/provider-codex/src/delta-translation.test.ts`
- **Native provider-codex plugin. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `plugins/provider-codex/src/delta-translation.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- Provider adapter and configuration tests cover relay requirements, response identity and diagnostic provenance.

### Known limitations

- Build and controlled tests do not substitute for deployed workflow verification.

### Retirement condition

Retire relay patches only when native provider configuration enforces the same deployment requirement.

<details><summary>Selected patches (1) and source binding</summary>

- [0004-inference-relay-and-provider-evidence.patch](patches/0004-inference-relay-and-provider-evidence.patch)

Reviewed source digest: `140f89b143a4d25a082a3addf315e4bd300c81cf78e82874faf9bd61a9f89e2a`

</details>

<a id="team-navigation-and-diagnostics"></a>
## Keep team navigation and useful diagnostics

Shared-team navigation, mentions and copyable errors must survive native upstream UI changes without retaining obsolete cache implementations.

### What this delivers

- Shared-team navigation, mentions and copyable errors must survive native upstream UI changes without retaining obsolete cache implementations.

### Responsibility

- Native navigation owns reads and subscriptions; the team layout seam owns presentation inputs.

### Other affected areas

- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting.
  - Source: `apps/app/src/components/dialogs/RemotePathBrowser.createFolder.test.tsx`
- **Native client presentation and cache lifecycle. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `apps/app/src/components/settings/MachineEnvironmentImportDialog.tsx`
- **Native client presentation and cache lifecycle. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `apps/app/src/components/settings/MachineEnvironmentSettings.stories.tsx`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/app/src/components/settings/MachineEnvironmentSettings.test.tsx`
- **Native client presentation and cache lifecycle. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `apps/app/src/components/settings/MachineEnvironmentSettings.tsx`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/app/src/components/settings/P6rIdentitySettingsSection.test.tsx`
- **Native client presentation and cache lifecycle. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/app/src/components/settings/P6rIdentitySettingsSection.tsx`
- **Native client presentation and cache lifecycle. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/app/src/components/settings/settings-search.ts`
- **Native client presentation and cache lifecycle. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/app/src/components/settings/settings-sections.ts`
- **Native client presentation and cache lifecycle. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `apps/app/src/components/sidebar/SidebarNavigationModel.tsx`
- **Keep team navigation and useful diagnostics: sidebar/SidebarNavigationRail.test.tsx**
  - Why: Shared-team navigation, mentions and copyable errors must survive native upstream UI changes without retaining obsolete cache implementations.
  - Source: `apps/app/src/components/sidebar/SidebarNavigationRail.test.tsx`
- **Native client presentation and cache lifecycle. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `apps/app/src/components/sidebar/useSidebarNavigationArrangement.ts`
- **Keep team navigation and useful diagnostics: composer/useQueuedMessageActions.ts**
  - Why: Shared-team navigation, mentions and copyable errors must survive native upstream UI changes without retaining obsolete cache implementations.
  - Source: `apps/app/src/components/thread/composer/useQueuedMessageActions.ts`
- **Native client presentation and cache lifecycle. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/app/src/components/thread/timeline/ConversationMessageContent.tsx`
- **Native client presentation and cache lifecycle. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/app/src/components/thread/timeline/P6rMessageAuthorLabel.tsx`
- **Native client presentation and cache lifecycle. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting.
  - Source: `apps/app/src/components/ui/markdown-code-highlight.test.ts`
- **Native client presentation and cache lifecycle. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `apps/app/src/components/ui/markdown-code-highlight.ts`
- **Native client presentation and cache lifecycle. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `apps/app/src/hooks/cache-owners/realtime-cache-registry.ts`
- **Keep team navigation and useful diagnostics: cache-owners/thread-entity-store.ts**
  - Why: Shared-team navigation, mentions and copyable errors must survive native upstream UI changes without retaining obsolete cache implementations.
  - Source: `apps/app/src/hooks/cache-owners/thread-entity-store.ts`
- **Native client presentation and cache lifecycle. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/app/src/hooks/cache-owners/thread-runtime-cache-owner.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `apps/app/src/hooks/realtime-cache-effects.test.ts`
- **Checks copied fields, non-HTTP failures, clipboard action behavior and the queue-edit toast action.**
  - Why: Keep the failure-copy capability and its queue UI integration consistent; these are instrument references rather than live-test claims.
  - Source: `apps/app/src/lib/mutation-errors.test.ts`
- **Formats bb-error-details version1 JSON and adds the existing Copy details toast action. Preserves transport errors and structured HTTP status/code/body when supplied.**
  - Why: The user can report actionable evidence without altering mutation acceptance, retry behavior or toast lifetime. This is an internal app helper and clipboard format, not a core SDK or server API.
  - Source: `apps/app/src/lib/mutation-errors.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `apps/app/src/lib/plugin-sidebar-threads.test.ts`
- **Native client presentation and cache lifecycle. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `apps/app/src/lib/plugin-sidebar-threads.ts`
- **Native client presentation and cache lifecycle. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `apps/app/src/lib/plugin-slots.ts`
- **Native client presentation and cache lifecycle. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/app/src/views/SettingsView.tsx`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `apps/app/src/views/thread-detail/ThreadDetailPromptArea.test.tsx`
- **Dependency and package/export metadata needed by this capability.**
  - Why: Bind consumers and native/runtime prerequisites to the selected implementation rather than an unrelated ambient version.
  - Source: `packages/shared-ui/package.json`
- **shared-ui package integration. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `packages/shared-ui/src/lib/pkl-highlight.ts`
- **Native monaco-editor plugin. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `plugins/monaco-editor/lib/languages.ts`
- **Native monaco-editor plugin. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `plugins/monaco-editor/lib/pkl-highlight.ts`
- **Native monaco-editor plugin. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `plugins/monaco-editor/lib/pkl-language.ts`
- **Native monaco-editor plugin. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `plugins/monaco-editor/monaco-bundle/editor.js`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- App and server typechecks plus focused navigation/error-action tests validate integration.

### Known limitations

- Build and controlled tests do not substitute for deployed workflow verification.

### Retirement condition

Retire individual UI seams when native SDK surfaces supply the same information.

<details><summary>Selected patches (1) and source binding</summary>

- [0005-team-navigation-and-diagnostics.patch](patches/0005-team-navigation-and-diagnostics.patch)

Reviewed source digest: `1b5c94fd15343e421ab1cddb1af2fdf5dac9ea8bd05a317331b63708a4a5cfbf`

</details>

<a id="service-lifecycle-and-transport"></a>
## Preserve native transport and diagnose startup failures

Company startup policy must preserve valid native realtime traffic while avoiding premature restart loops.

### What this delivers

- Company startup policy must preserve valid native realtime traffic while avoiding premature restart loops.

### Responsibility

- Native WebSocket delivery owns compression and buffering; the launcher owns readiness deadlines. Downstream isolates failed sockets and guards heartbeat replies.

### Core SDK and APIs

- **Existing POST /api/v1/plugins/:id/rpc/:method captures a host-owned HTTP ingress/request scope. Identity failures return unauthenticated→401 or unavailable→503; invalid_input remains400.**
  - Why: Preserve identity failure semantics at the existing plugin RPC route. This capability does not own the asset-generation endpoint change; see plugin-artifacts-transport.
  - Visibility: public
  - State/API identities: `registerPluginRoutes`
  - Source: `apps/server/src/routes/plugins.ts`
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
- **Reads bounded gateway /v1/models through operator-held required relay/key; returns provider-appropriate model facts and selectedOnlyModels.**
  - Why: Keep model discovery on the same mandatory inference path while workers receive catalog facts, not gateway keys. Contract obligations: Opt-in BB_ACCOUNT_POOL_EXTERNAL_REQUIRED=1, HTTPS ts.net root origin and nonblank token; errors fail without native direct-provider fallback. This is an outbound gateway consumption contract, not a new public BB REST endpoint. Consumers: packages/host-daemon-contract/src/commands.ts, apps/server/src/services/providers/provider-model-catalog-store.ts.
  - Visibility: private
  - State/API identities: `readRequiredExternalModelCatalog`
  - Source: `apps/server/src/services/providers/required-external-model-catalog.ts`

### Other affected areas

- **Dependency and package/export metadata needed by this capability.**
  - Why: Bind consumers and native/runtime prerequisites to the selected implementation rather than an unrelated ambient version.
  - Source: `apps/desktop/package.json`
- **Desktop process and browser lifecycle. Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.**
  - Why: Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config. Desktop package/release launcher owns Electron pin/native validation/profile arguments. Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.
  - Source: `apps/desktop/scripts/packaged-app-launch.mjs`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config.
  - Source: `apps/desktop/test/packaged-app-launch.test.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/internal/events.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/internal/tool-calls.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/server.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/server/src/services/hosts/host-environment-sync.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/server/src/services/hosts/host-environment.test.ts`
- **Projects ordinary environment values visibly and secret values by presence without changing stored/provider bytes.**
  - Why: Classification determines diagnostic visibility; broad masking is not a substitute for provenance.
  - Source: `apps/server/src/services/machines/environment-settings.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/server/src/services/machines/environment-storage.test.ts`
- **Extends encrypted row envelope with explicit secret provenance; keeps existing AES-GCM encryption/key ownership.**
  - Why: Ordinary values can be shown, actual secret values masked; backup must retain existing encryption key with ciphertext. No new secret-store file is introduced.
  - Source: `apps/server/src/services/machines/environment-storage.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/server/src/services/machines/git-credentials.test.ts`
- **Server effect and read owners. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `apps/server/src/services/machines/git-credentials.ts`
- **Server effect and read owners. Context Magnet retains explicit bounded host-supplied contribution declarations, trace records, immutable pagination bounds and model receipt-tool consumption evidence.**
  - Why: DB Context Magnet trace/history functions own retained evidence and bounded reads. Agent runtime/provider bridge owns construction/admission observations; server combines these without promoting evidence strength. Prompt renderer/plugin generation registry owns synchronous rendering, disposal, middleware order and observations. P6R sidecar-store owns exact contribution lookup and payload decoding.
  - Source: `apps/server/src/services/plugins/plugin-agent-contributions.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/plugins/plugin-api.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/plugins/plugin-mentions.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/plugins/plugin-p6r-dispatch.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/plugins/plugin-p6r-http.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/plugins/plugin-runtime.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/plugins/plugin-service-internal.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/services/plugins/plugin-service.ts`
- **Adds force-refresh validation to the existing model catalog and carries an explicit refresh success/failure result. No schema or external-route fingerprint is added here.**
  - Why: Execution preflight must not present a retained catalog as verified readiness when its required fresh validation failed.
  - Source: `apps/server/src/services/providers/provider-model-catalog-store.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `apps/server/src/services/skills/builtin-skills/bb-plugin-authoring/references/identity-and-native-projections.md`
- **Server effect and read owners. Thread facet declarations have owner/generation state, cardinality, member types and opaque target grants. Server queries resolve bounded filter/order/cursor requests and distinguish ready, reconciling and unavailable projections.**
  - Why: DB facet owner generations/relations and execution overrides are durable state. Server thread-facet-query owns read assembly, cursor signing and participant projection checks. Server thread-execution-batch/override owns validation and application; provider catalog owns route-scoped model facts. Native sidebar arrangement owns rendering; plugins supply layout/presentation data.
  - Source: `apps/server/src/services/system/execution-options.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/start-server.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `apps/server/src/testing/test-fault-barriers.ts`
- **Server effect and read owners. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/server/src/types.ts`
- **Server effect and read owners. Shared sidebar dirty events coalesce within the existing flush and let an active read finish, followed by a bounded trailing catch-up. Overlapping-tail and inactive-remount races retain eventual freshness; explicit status replacement and terminal cancellation remain separate authorities.**
  - Why: realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects. NotificationHub owns realtime write bounds and client cleanup; terminal/daemon policies remain distinct. DB event lookup and server timeline-context-order own their query/cache invariants. bb-app launcher owns config/readiness deadlines; start-server owns listener admission before recovery.
  - Source: `apps/server/src/ws/client-protocol.ts`
- **Native compressed delivery and failed-socket isolation**
  - Why: Valid native realtime bursts must not be rejected by unsupported downstream thresholds. Native upstream owns buffering; tests preserve delivery and isolate failed peers.
  - Source: `apps/server/src/ws/hub.ts`
- **bb-app package integration. Shared sidebar dirty events coalesce within the existing flush and let an active read finish, followed by a bounded trailing catch-up. Overlapping-tail and inactive-remount races retain eventual freshness; explicit status replacement and terminal cancellation remain separate authorities.**
  - Why: realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects. NotificationHub owns realtime write bounds and client cleanup; terminal/daemon policies remain distinct. DB event lookup and server timeline-context-order own their query/cache invariants. bb-app launcher owns config/readiness deadlines; start-server owns listener admission before recovery.
  - Source: `packages/bb-app/src/launcher.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects.
  - Source: `packages/bb-app/test/index.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects.
  - Source: `packages/bb-app/test/server-health-identity.test.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/browser-automation/README.md`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config.
  - Source: `plugins/browser-automation/runtime.test.ts`
- **Native browser-automation plugin. Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.**
  - Why: Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config. Desktop package/release launcher owns Electron pin/native validation/profile arguments. Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.
  - Source: `plugins/browser-automation/runtime.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/browser-automation/skills/browser-automation/SKILL.md`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- Real negotiated-compression bursts deliver 12000 notifications above 1 MiB pending; failed-socket and launcher tests exercise isolation and startup.

### Known limitations

- Ordinary realtime buffering follows native upstream. No downstream message-count or 1 MiB eviction threshold remains; terminal-specific native limits are unchanged.

### Retirement condition

Retire residual failure isolation and launcher adjustments when upstream supplies the same required behavior.

<details><summary>Selected patches (1) and source binding</summary>

- [0006-service-lifecycle-and-transport.patch](patches/0006-service-lifecycle-and-transport.patch)

Reviewed source digest: `e15cad5a2c775e058fa44e667bb8122c2de672c19757f939728f7a5dac857f56`

</details>

<a id="integration-and-verification"></a>
## Integrate and verify the selected upstream cohort

The selected native server, CLI, daemon and SDK must build as one cohort and retain native sandbox and dependency policy.

### What this delivers

- The selected native server, CLI, daemon and SDK must build as one cohort and retain native sandbox and dependency policy.

### Responsibility

- Workspace build owns artifacts and dependency locks; test fixtures follow current native contracts.

### Other affected areas

- **Build and repository integration. Markdown code fences and Monaco support Pkl tokenization, including raw/multiline strings, interpolation and nested comments. The current Monaco plugin carries a local tokenizer rather than relying on an unavailable shared-UI runtime export.**
  - Why: Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting. Provider native-root fixtures own their temporary workspace boundaries. Provider-bridge first-party replay caller owns its concurrency bound; the generic helper retains its default contract. Repository tests/lint own maintenance witnesses, not runtime policy.
  - Source: `.oxlintrc.json`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/cli/src/__tests__/command-output/machine-environment.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/cli/src/__tests__/command-output/thread-organization.test.ts`
- **Integrate and verify the selected upstream cohort: command-output/thread-wait.test.ts**
  - Why: The selected native server, CLI, daemon and SDK must build as one cohort and retain native sandbox and dependency policy.
  - Source: `apps/cli/src/__tests__/command-output/thread-wait.test.ts`
- **CLI operations and output. Core machine/project entries and plugin environment contributions carry explicit authentication-secret classification with the chosen value, provenance and reason. Ordinary environment values remain visible.**
  - Why: Machine environment storage/settings and host sync own explicit classification. Plugin contribution resolver and host/runtime command preparation carry winning value plus provenance. Domain diagnostic projection owns masking at shared readers; raw retained source records are not rewritten.
  - Source: `apps/cli/src/commands/machine-environment.ts`
- **CLI operations and output. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `apps/cli/src/commands/settings.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/demo-server/src/fixtures/world.ts`
- **Dependency and package/export metadata needed by this capability.**
  - Why: Bind consumers and native/runtime prerequisites to the selected implementation rather than an unrelated ambient version.
  - Source: `apps/server/package.json`
- **Server effect and read owners. Shared sidebar dirty events coalesce within the existing flush and let an active read finish, followed by a bounded trailing catch-up. Overlapping-tail and inactive-remount races retain eventual freshness; explicit status replacement and terminal cancellation remain separate authorities.**
  - Why: realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects. NotificationHub owns realtime write bounds and client cleanup; terminal/daemon policies remain distinct. DB event lookup and server timeline-context-order own their query/cache invariants. bb-app launcher owns config/readiness deadlines; start-server owns listener admission before recovery.
  - Source: `apps/server/scripts/generate-bb-official-marketplace.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects.
  - Source: `apps/server/test/app/client-protocol.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects.
  - Source: `apps/server/test/app/hub-backpressure-native.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects.
  - Source: `apps/server/test/app/hub-backpressure.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects.
  - Source: `apps/server/test/app/startup-diagnostics.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/helpers/p6r-authorship.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/helpers/test-app.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/server/test/hosts/live-command.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/internal/daemon-forged-mention-http.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `apps/server/test/providers/provider-model-catalog-store.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts.
  - Source: `apps/server/test/providers/required-external-model-catalog.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/server/test/public/machine-environment.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/server/test/public/public-project-clone-sources.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/server/test/public/public-terminals.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/public/public-thread-compaction.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/public/public-thread-data.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/server/test/public/public-thread-diagnostic-events.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/public/public-thread-facets.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/public/public-thread-fork.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/public/public-thread-offline-followup.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. realtime-cache-registry owns invalidation/trailing reads; existing realtime effects owns dirty batches/reconnects.
  - Source: `apps/server/test/server-move/imported-daemon-sessions.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/server/test/services/environments/project-environment-hooks.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/plugins/heroes-phase2.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Machine environment storage/settings and host sync own explicit classification.
  - Source: `apps/server/test/services/plugins/plugin-agent-contributions.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/plugins/plugin-authoring-docs.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/plugins/plugin-mention-providers.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/plugins/plugin-p6r-admission-boundary.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `apps/server/test/services/plugins/plugin-presentation-context.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/services/plugins/plugin-sdk.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Plugin build artifact metadata owns emitted file list/generation.
  - Source: `apps/server/test/services/plugins/plugin-wire.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `apps/server/test/services/plugins/thread-manager-native-parity.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. DB facet owner generations/relations and execution overrides are durable state.
  - Source: `apps/server/test/services/plugins/thread-progress-native-facet.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/threads/environment-providers.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `apps/server/test/threads/queue-drain-failure.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/threads/thread-edit-message.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `apps/server/test/threads/thread-provisioning-recovery.test.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `apps/server/test/threads/thread-turn-dispatch.test.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `docs/api_to_audit.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `docs/configuration.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `docs/environment-diagnostic-classification.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `docs/p6r-required-inference-upstreaming.md`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Shared UI/Markdown and Monaco tokenizer owners provide Pkl highlighting.
  - Source: `packages/scripts/test/pr-approval-workflows.test.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `packages/templates/src/templates/bb-guide-customization.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `packages/templates/src/templates/bb-guide-machines.md`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. NativeMessageAdmission/message-admission.ts and its capture/input/placement/runtime/dispatch/recovery modules own the lifecycle.
  - Source: `packages/templates/test/plugin-scaffold-external.test.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/bb-guide/skills/bb-cli/SKILL.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/bb-guide/skills/bb-cli/references/command-index.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/bb-guide/skills/bb-plugin-authoring/SKILL.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/bb-guide/skills/bb-plugin-authoring/references/backend-api-index.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/bb-guide/skills/bb-plugin-authoring/references/frontend-api-index.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/bb-guide/skills/bb-plugin-authoring/references/frontend-core-slots.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/bb-guide/skills/bb-plugin-authoring/references/identity-and-native-projections.md`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/bb-guide/skills/bb-plugin-authoring/references/providers.md`
- **Native environment-modal-sandbox plugin. Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.**
  - Why: Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config. Desktop package/release launcher owns Electron pin/native validation/profile arguments. Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.
  - Source: `plugins/environment-modal-sandbox/Dockerfile`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/environment-modal-sandbox/README.md`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config.
  - Source: `plugins/environment-modal-sandbox/configuration.test.ts`
- **Native environment-modal-sandbox plugin. Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.**
  - Why: Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config. Desktop package/release launcher owns Electron pin/native validation/profile arguments. Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.
  - Source: `plugins/environment-modal-sandbox/configuration.ts`
- **Native environment-modal-sandbox plugin. Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.**
  - Why: Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config. Desktop package/release launcher owns Electron pin/native validation/profile arguments. Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.
  - Source: `plugins/environment-modal-sandbox/debug-sandbox.ts`
- **Native environment-modal-sandbox plugin. Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.**
  - Why: Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config. Desktop package/release launcher owns Electron pin/native validation/profile arguments. Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.
  - Source: `plugins/environment-modal-sandbox/providers/modal/backend.ts`
- **Native environment-modal-sandbox plugin. Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.**
  - Why: Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config. Desktop package/release launcher owns Electron pin/native validation/profile arguments. Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.
  - Source: `plugins/environment-modal-sandbox/providers/modal/client.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config.
  - Source: `plugins/environment-modal-sandbox/providers/modal/image.test.ts`
- **Native environment-modal-sandbox plugin. Modal sandboxes can exchange scoped workload OIDC for preauthorized ephemeral Tailnet nodes and use the userspace SOCKS/HTTP/proxychains TCP path. Operators must configure matching workload claims/tags/ACLs and reachable BB ingress.**
  - Why: Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config. Desktop package/release launcher owns Electron pin/native validation/profile arguments. Browser automation runtime owns browser launch flags; host provisioning owns namespace prerequisites.
  - Source: `plugins/environment-modal-sandbox/providers/modal/tailnet.ts`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Modal environment plugin owns sandbox lifecycle/network command wrapping and opt-in config.
  - Source: `plugins/environment-modal-sandbox/server.test.ts`
- **Guides and references describe the capability and its consumer/maintenance obligations.**
  - Why: Make the owning contract and recovery/retirement requirements discoverable without treating historical receipts as current runtime proof.
  - Source: `plugins/environment-modal-sandbox/skills/modal-sandboxes/SKILL.md`
- **Native plugin-api-docs plugin. A configured identity provider enriches request-scoped actors; configured Serve ownership can select the Tailnet provider automatically. A dedicated loopback Tailnet ingress keeps that route distinct from local CLI ingress.**
  - Why: Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes. Native request/authorship and external-contribution capture accepted snapshots; sidecar-store retains contributions/attempts; thread events retain native author/editor arrays. Plugin runtime owns registration, activation, retirement and transport error mapping.
  - Source: `plugins/plugin-api-docs/src/surfaces.ts`
- **Dependency and package/export metadata needed by this capability.**
  - Why: Bind consumers and native/runtime prerequisites to the selected implementation rather than an unrelated ambient version.
  - Source: `pnpm-lock.yaml`
- **Build and repository integration. Required external mode routes Claude/Codex through Account Pooler with server-held upstream credentials and scoped host invocation tokens. Local credential/login maintenance is disabled in that mode; invalid route configuration fails start/resume.**
  - Why: Account Pooler required-external-pool owns relay/token/env contribution; server provider-model catalog owns authenticated facts. Host command/runtime adapters own per-attempt construction deadlines and provider process state. Native Claude/Codex bridges own translation of provider phase/IDs/rejections; durable event contracts carry resulting facts.
  - Source: `scripts/provider-literal-baseline.json`
- **Regression/fixture coverage for the behavior above. These paths identify the relevant instruments, not a claim that every suite or live scenario has passed.**
  - Why: Protect the accepted behavior and its failure cases across source refreshes. Server P6R provider-admission/provider-registry resolve actors; invocation-registry owns request/generation lifetimes.
  - Source: `tests/integration/fake/smoke/dynamic-acp-agent.test.ts`
- **Integrate and verify the selected upstream cohort: helpers/harness.ts**
  - Why: The selected native server, CLI, daemon and SDK must build as one cohort and retain native sandbox and dependency policy.
  - Source: `tests/integration/helpers/harness.ts`
- **Integrate and verify the selected upstream cohort: turbo.json**
  - Why: The selected native server, CLI, daemon and SDK must build as one cohort and retain native sandbox and dependency policy.
  - Source: `turbo.json`
- **Integrate and verify the selected upstream cohort: plugins/plugin-rpc-caller.ts**
  - Why: The selected native server, CLI, daemon and SDK must build as one cohort and retain native sandbox and dependency policy.
  - Source: `apps/server/src/services/plugins/plugin-rpc-caller.ts`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- 64 typecheck tasks and 63 build tasks pass; selected migration, authorship and plugin tests qualify retained behavior.

### Known limitations

- Build and controlled tests do not substitute for deployed workflow verification.

### Retirement condition

Reevaluate every integration adjustment on the next upstream upgrade rather than porting it mechanically.

<details><summary>Selected patches (1) and source binding</summary>

- [0007-integration-and-verification.patch](patches/0007-integration-and-verification.patch)

Reviewed source digest: `4588a55afc193885325cc36a711205d7deb1c115975cbb63fb0aabd249647e3a`

</details>

<a id="prompt-wording"></a>
## Maintain reviewed BB Guide wording in source

Company guide wording belongs in a focused source patch before interpolation; runtime rewriting must not touch user message bodies.

### What this delivers

- Maintain source-level delegation and return-route wording without rewriting interpolated user content.
- Omit blocking guidance from BB agent introductions and the bundled CLI skill while preserving the complete CLI guide and command help.

### Responsibility

- BB Guide owns its introduction and bundled skill; Phosphor Guide owns its separately enabled native instruction contribution. The CLI reference and execution semantics remain unchanged.

### Other affected areas

- **BB agent introduction and CLI skill guidance**
  - Why: BB agents coordinate asynchronously; full blocking-command reference belongs to deliberate CLI discovery rather than supplied agent guidance.
  - Source: `plugins/bb-guide/introduction.ts`, `plugins/bb-guide/skills/bb-cli/SKILL.md`, `plugins/bb-guide/skills/bb-cli/references/command-index.md`

### Verification references

These identify relevant checks; listing them does not assert that they passed for a deployment.

- Production instruction assembler fixture checks effective contributions, selected skill files, reload and preserved unrelated instructions. CLI guide templates and commands are unchanged.

### Known limitations

- Build and controlled tests do not substitute for deployed workflow verification.

### Retirement condition

Retire this wording patch when native guide configuration supports the same text directly.

<details><summary>Selected patches (1) and source binding</summary>

- [0008-prompt-wording.patch](patches/0008-prompt-wording.patch)

Reviewed source digest: `4588a55afc193885325cc36a711205d7deb1c115975cbb63fb0aabd249647e3a`

</details>
