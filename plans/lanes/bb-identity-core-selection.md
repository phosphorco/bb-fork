# Core identity selection: evidence and required supersession decision

## Scope and evidence boundary

This is a read-only decision artifact for the dirty candidate at
`fork/build/proof-bb`, inspected on 2026-09-06. It does not authorize changes
to that candidate, `fork/build/bb`, `fork/upstream`, a runtime, or a service.
It must not be used to reset, clean, stash, rebase, or overwrite authored work.

The correction to the earlier draft is material: no minimal append-only core
composition is established yet. The tools merely observed, not run, are:

- `fork/scripts/materialize`: creates a new detached worktree from
  `fork/upstream.lock`, applies every patch in `fork/patches/series`, then
  compares the result with `fork/result-tree.lock`.
- `fork/scripts/verify`: invokes that materializer in a temporary directory,
  then checks the result's diff and namespace.

Neither tool was executed during this review. Their existence does not prove
the current 53-patch queue, any candidate source slice, or a future selection.

## Exact ancestry and conflict finding

Read-only ancestry evidence:

| Item | Observed value | Consequence |
| --- | --- | --- |
| Candidate proof `HEAD` | `960255b98ce3dccdcb5754eb67a7f989236602a1` (`desktop-v0.42.0`) | This is the current upstream-shaped source carrying the dirty candidate work. |
| Queue base | `fork/upstream.lock` and `fork/upstream`: `5205d98a74ed5a22469e521cf1f86b00b8232827` | This is proof HEAD's merge base. Proof contains many upstream commits after the pin. |
| Queue | `fork/patches/series` has 53 entries beginning with `0001-feat-multiplayer-port-identity-and-presence-onto-cur.patch` | The queue is a different composition from the dirty proof candidate; it is not an already-selected representation of it. |
| Patch 0001 | Modifies identity, actors, presence, routes, websockets, CLI, SDK/UI, `packages/domain/src/p6r-identity.ts`, and DB migration `0107_p6r_identity_authorship.sql` | It is a broad claimed identity/presence authority, not a neutral prerequisite for the new plugin kernel. |
| Patch 0002 | Defines facets and projects `PrincipalKey` participants on the patch-0001 identity model | It depends on the old identity vocabulary/authority and cannot be carried verbatim if 0001 is superseded. |

Appending new K patches to a materialization of the 53-patch series would
retain patch 0001's claimed identity/presence authority alongside the newer
P6R acceptance/history authority. That is competing authority, not a
demonstrated minimum. The same issue propagates into patch 0002 and later
patches consuming its participant projection. No append route is selected by
this document.

## Selected baseline before reconstruction

Root selected supersession: the trusted plugin kernel replaces the old claimed
identity/presence authority. A future composition starts from the selected
source base plus newly ported kernel/acceptance/history commits, omits queue
patch 0001, and re-ports or replaces each required facet participant behavior
from 0002 against the P6R sidecar/projection contract. Patch 0002 is not reused
verbatim.

## Chosen coherent source base

For the supersession direction, the smallest coherent source base is the
clean tree at proof's exact upstream commit
`960255b98ce3dccdcb5754eb67a7f989236602a1`, not the old pinned tree
`5205d98a74ed5a22469e521cf1f86b00b8232827`.

This is a source-selection conclusion, not permission to change
`fork/upstream.lock`, move `fork/upstream`, or create a worktree. The proof
head is a descendant of the old pin, but that graph relation does **not** prove
API compatibility with the old queue. Every retained behavior below must be
ported and compiled against `960255b98`; no old mail patch is designated as
safe to apply verbatim.

The minimum parity for this **identity selection** to evaluate against that
base is:

| Parity | Why it is in the minimum | Required current candidate boundary |
| --- | --- | --- |
| Trusted kernel and external acceptance/history | Existing identity-aware plugins require one admitted identity/provenance source and public attempt history. | The prospective kernel, acceptance/correlation, plugin integration, and public-read rows in section A. |
| Facet participant projection | Thread Progress consumes facet/thread participant behavior. Current query projection reads `p6rContributions`, so it follows the trusted sidecar kernel. | `thread-facet-query.ts` `ensureNativeParticipantProjection`, `packages/db/src/data/thread-facets.ts`, facet 0114/0115. |
| Execution preflight/apply | Thread Manager's existing dashboard flow needs revision/CAS-safe execution changes. | `thread-execution-batch.ts`, execution revision 0113 and narrow route/contract/SDK declarations. |
| Authenticated plugin routes | Existing plugin route handling needs capability-checked request authority, but not old claimed `PrincipalKey` authority. | A small re-port of 0031's route capability mechanism using the trusted kernel's admitted context. |
| Mention-to-participant bridge | Existing mention behavior writes core participant facets. | 0050's event/participant logic, re-expressed against the new facet projection. |

This is not a declaration of the minimum full-host release. Existing
appearance, recovery, mobile, sidebar, and other independent fork behavior is
outside this identity-patch selection and must receive a separate explicit
retain/re-port/release-parity review. If clean `960255b98` lacks any of it,
that is unresolved full-host release parity, not permission to remove it.

## 0001 dependency and supersession ledger

`Decision` is intentionally either **supersede/omit**, **re-port**, or
**retain/review separately**. The last designation means the behavior is not
being selected as part of this identity patch family, but remains required for
full-host release parity until an owner explicitly retains, re-ports, or
retires it. `Re-port` means preserve the named user-visible behavior after a
fresh source/API comparison; it does not mean apply the existing mail patch.
`Keep` is not used because no old patch has been compiled against the selected
`960255b98` base.

| Queue patch | Decision | User-visible behavior | Actual old code dependency | Supersession / re-port boundary |
| --- | --- | --- | --- | --- |
| 0001 `multiplayer-port-identity-and-presence` | Supersede/omit | Claimed identity, presence, identity settings, member/CLI/SDK/UI identity display, and old authored-message wiring. | Defines `apps/server/src/services/{identity,actors,presence}.ts`, `packages/domain/src/p6r-identity.ts`, DB `0107_p6r_identity_authorship.sql`, and changes server/routes/websocket/thread/plugin paths. | Trusted P6R kernel is the sole new authority. No claimed-identity server, presence, or 0107 schema is carried. |
| 0002 `facets` | Re-port | Thread/member facets, participant lists, Thread Progress/My Progress query behavior. | Uses 0001's `services/identity.ts`, `packages/domain/{claimed-identity,p6r-identity}.ts`, PrincipalKey participant models, and 0108 facet storage. | Rebuild the required facet contract on A's sidecar contribution projection; use current facet 0114/0115 rather than 0108. |
| 0003 `facet quarantine fixture` | Re-port with 0002 | Plugin-SDK facet fixture isolation. | Only `packages/plugin-sdk/src/testing/__tests__/thread-facets.test.ts`; tests 0002's fixture naming. | Recreate after the replacement facet SDK fixture exists. |
| 0004 `sidebar participant presentation` | Retain/review separately | Condensed web/mobile participant chips. | Reads `p6rPrincipalKey` participant rows from 0002 facet/mobile models. | Not selected for identity closeout; full-host UI parity needs a replacement facet participant DTO before it can be retained or re-ported. |
| 0007 `server-authored principals to plugins` | Supersede/omit | Old plugin request context exposes authenticated provider PrincipalKeys. | `services/identity.ts` `p6rPrincipalKeyForActor`; plugin API/service/route and plugin SDK backend/fake host. | Replace only any needed plugin read with A's normalized admitted identity/provenance contract; do not port old PrincipalKey authority. |
| 0008 `provider avatar fallback` | Retain/review separately | Avatar fallback for old claimed/provider identities. | `P6rAvatar`, claimed-identity store, old presence/sidebar views from 0001. | Not selected for identity closeout; full-host UI parity needs a new trusted/external display decision. |
| 0009 `interrupted identity staging` | Supersede/omit | Recovery for old 0107 identity migration staging. | `packages/db/src/migrate.ts` and migration test assume 0001 schema staging. | New sidecar migration path has its own state; do not preserve recovery for omitted schema. |
| 0013 `identity staging after ledger` | Supersede/omit | Additional old identity migration recovery. | Same `migrate.ts`/test ownership and 0001 staging model as 0009. | Omit with 0107/0009. |
| 0014 `Tailnet out of claimed mode` | Retain/review separately | Settings/dialog distinction between trusted Tailnet and claimed identity. | Claim dialog/store, old system route/config, and `services/identity.ts`. | Not selected for identity closeout; release parity needs a trusted-kernel UI/config equivalent, not revived claimed mode. |
| 0017 `no-provider identity modes` | Re-port | Different outcomes for absent provider, request principal, and trusted actor. | `server.ts`, `services/actors.ts`, websocket actor resolution, old `P6rPrincipalKey` constructors. | Preserve fail-closed mode distinctions as trusted-kernel admission tests, without old key creation. |
| 0022 `identity and event witnesses` | Re-port | Regression proof that browser claims cannot choose authorship and event identities are encoded correctly. | Old actor/PrincipalKey fixtures plus `internal-events-tool-calls` and plugin-wire tests. | Retain the security assertions, recast them for A's exact request/turn/tool evidence. |
| 0023 `provider/request keys` | Re-port | Provider subject and request principal remain distinct. | `plugin-wire.test.ts` old wire PrincipalKey serialization. | Replace with normalized actor/subject and P6R attempt correlation checks. |
| 0024 `unify plugin/server principal keys` | Supersede/omit | Old serializer alignment between plugin and server PrincipalKeys. | `services/identity.ts` and fake plugin host's `P6rPrincipalKey`. | A's normalized identity contract replaces this serialization authority. |
| 0027 `per-person palette` | Retain/review separately | Appearance override keyed by old person PrincipalKey. | `p6r-principal-appearance` service/data and system API. | Existing appearance parity remains required; it needs a separate stable preference-key decision. |
| 0028 `prompt stacks` | Retain/review separately | Prompt-stack UI/config, including 0027 appearance calls. | Imports `p6r-principal-appearance` through system/configuration paths and touches My Progress/facet UI. | Existing prompt-stack parity remains required; review after the appearance and replacement facet contracts are known. |
| 0031 `capability-authenticated plugin routes` | Re-port | Plugins may expose capability-authenticated routes and SDK callers cannot forge a claimed identity header. | Plugin service/API/runtime, `routes/plugins.ts`, thread send/queue paths, plugin SDK contract; old actor payload uses 0001 PrincipalKey. | Keep the capability route mechanism; replace old actor payload with trusted admitted context. This is required parity. |
| 0034 `recovery-mobile baseline` | Retain/review separately | Mobile recovery app, including sidebar facet views. | Imports 0002 facet models and old identity/recovery namespace setup. | Existing mobile parity is outside identity closeout; clean-base absence is an unresolved release gap, not omission authority. |
| 0036 `recovery cached reads` | Retain/review separately | Persistent recovery namespaces per old principal. | `p6rPrincipalKey` feeds recovery namespace ownership. | Existing recovery parity needs a separate durable identity/profile migration. |
| 0037 `recovery snapshot` | Retain/review separately | Recovery snapshots isolate owner/read-only namespace. | Recovery route derives owner with `p6rPrincipalKeyForActor`. | Existing recovery parity needs the same replacement namespace decision as 0036. |
| 0038 `execution reassignment` | Re-port | Batch execution preflight/apply and Thread Manager execution controls. | Depends on 0002 facet query/projection (`thread-facet-query.ts`, contracts/SDK) though its execution state is separate. | Port after replacement facet base; use candidate execution revision 0113 and current preflight/CAS service. |
| 0039 `execution lookup index` | Re-port with 0038 | Execution lookup stays indexed. | Adds DB/query-plan support for 0038 execution lookups. | Port only with the replacement execution DB schema/query. |
| 0040 `facet participant projection` | Re-port with 0002 | Avoids stable participant-projection work. | `packages/db/src/data/thread-facets.ts` from 0002. | Reapply the performance property to the replacement facet store. |
| 0041 `reuse participant projection` | Re-port with 0002 | Server reuses participant projection rather than recomputing it. | `thread-runtime-display.ts` imports old `p6rPrincipalKeyForActor` and 0002 projection. | Replace with selected sidecar-derived participant projection. |
| 0042 `execution catalogs` | Re-port with 0038 | Catalog validation and execution summaries. | `thread-execution-batch.ts` depends on `thread-facet-query.ts` and old actor snapshot parsing. | Port against replacement facet query and selected provider catalog contract. |
| 0043 `provider-scoped execution fallback` | Re-port with 0038 | Native fallback stays provider scoped. | `thread-execution-override.ts` from execution stack. | Preserve only after execution provider catalog is revalidated on 960. |
| 0044 `execution contract tests` | Re-port with 0038 | Contract coverage for execution boundaries. | Server-contract tests for 0038 public execution DTO. | Recreate against replacement execution declarations. |
| 0045 `legacy participant projection` | Re-port with 0002 | Existing participant profile rows remain visible. | `thread-facets.ts` tests call old `p6rPrincipalKeyForActorSnapshot`. | Translate legacy rows only through explicit recovery; no key reassignment. |
| 0046 `execution validation timing` | Re-port with 0038 | Execution apply rechecks time-sensitive validation. | `thread-execution-batch.ts` and its tests. | Carry the property into current CAS implementation. |
| 0047 `recovery cache ownership` | Retain/review separately | Mobile recovery cache/attachment ownership per principal. | Recovery namespace/principal-key persistence from 0034--0037. | Existing recovery parity remains required; it depends on replacement recovery identity. |
| 0048 `hidden workers in switched personal envs` | Retain/review separately | Worker eligibility when personal environment changes. | Thread create eligibility and plugin SDK tests; no direct old identity symbol, but relies on switched-personal-environment behavior from old stack. | Existing worker behavior is outside identity closeout and needs its own source/API review. |
| 0050 `mentions participants/notify` | Re-port | Mentioned people become facet participants and plugins receive notification behavior. | Plugin mentions/service and thread event/send paths write 0002 `thread-facets`; actor snapshots use old `p6rPrincipalKeyForActorSnapshot`. | Required existing-plugin parity; port after replacement facets, preserving explicit unresolved/legacy recovery. |
| 0051 `active My Progress visibility` | Retain/review separately | Sidebar keeps the active thread visible during facet loading/error. | App My Progress rows and 0002 facet participant summary DTO. | Existing UI parity remains required; it can be re-ported after the replacement facet contract is checked. |

Patches not listed above have no direct old-identity symbol/path finding in this
read-only scan. They are not implicitly kept **or omitted**: the selected
`960255b98` base requires a separate source/API and full-host release-parity
comparison before any of them can enter a new queue or be retired.

## Candidate source selection ledger

A path below is not approval to take every current hunk in that file.

### A. Prospective plugin kernel, external acceptance, and public history

| Layer | Exact paths | Retain only these boundaries | Exclude |
| --- | --- | --- | --- |
| Protocol and registry | `apps/server/src/services/p6r/identity-protocol.ts`, `invocation-registry.ts`, `provider-contract.ts`, `provider-registry.ts`, `receipt-outcome.ts` | Normalized provenance parsing, scoped invocation registry, provider admission and receipt contracts. | Ordinary-native-writer-only origin expansion. |
| Durable acceptance record | `apps/server/src/services/p6r/sidecar-schema.ts`, `sidecar-store.ts`, `sidecar-migrate.ts`, `sidecar-drizzle.config.mjs`; `drizzle/0000_lying_energizer.sql`, `0001_aromatic_leopardon.sql`, `0002_pending_queued_dispatch.sql`; matching snapshots and `_journal.json` | Attempts, final inputs, contributions, receipts, provider records, and pending dispatch needed for accepted external requests/history. | `p6rPendingNativeWrites`; native queued-write reserve/promote/update/delete helpers; migration `0003_native_queued_writes.sql` and its journal entry. |
| Exact acceptance/correlation | `apps/server/src/services/p6r/native-acceptance.ts`, `tool-correlation-registry.ts`; `apps/server/src/internal/events.ts`, `apps/server/src/internal/tool-calls.ts` | Exact client-request-id/scope-turn/native-event joins and daemon-validated tool correlation. | Text/position/copied-client matching and ordinary send/queue attribution. |
| Plugin integration | `apps/server/src/services/plugins/plugin-p6r-dispatch.ts`, `plugin-p6r-http.ts`; P6R-only hunks in `plugin-api.ts`, `plugin-registration.ts`, `plugin-service-internal.ts`, `plugin-service.ts`, `plugin-runtime.ts`; `apps/server/src/routes/plugins.ts` | Registration, dispatch, plugin-bound HTTP, and dependencies required for external plugin acceptance. | General artifact/runtime fallback work and native ordinary HTTP admission. |
| Server/public reads | P6R-only hunks in `apps/server/src/server.ts`, `types.ts`; `packages/plugin-sdk/src/experimental-p6r-identity.ts`; P6R-only pieces of `packages/plugin-sdk/src/backend-contract.ts`, `index.ts`, `testing/fake-plugin-host.ts`; binding-history declarations in `packages/sdk/src/areas/threads.ts`, `packages/server-contract/src/api/threads.ts`, `public-api.ts`, `index.ts` | Read-only `binding.server.history.attempts` and attempt/operation correlation. | Native request admission, request `WeakMap` carrier, native presence, facets/execution fields, and ordinary `provenanceGroups` transport. |
| Core witnesses | `apps/server/test/services/p6r/{identity-protocol,invocation-registry,native-acceptance,sidecar-store,tool-correlation-registry}.test.ts`; `apps/server/test/internal/{internal-events-tool-calls,internal-tool-call-regressions}.test.ts`; `apps/server/test/services/plugins/{plugin-p6r-api-integration,plugin-p6r-dispatch,plugin-p6r-http}.test.ts` | Actual admitted external acceptance, exact event/tool correlation, and public attempt history. | `timeline-attribution.ts` and `timeline-attribution.test.ts`, which are ordinary timeline attribution/rendering and are deferred. |

Mandatory source-split files are `sidecar-store.ts`, `server.ts`, and
`types.ts`: selection must be a reviewed symbol-level commit, never a whole
file import.

### B. Facets and execution: coupled candidate parity

The candidate facet completion is not P6R-free. In
`apps/server/src/services/threads/thread-facet-query.ts`,
`ensureNativeParticipantProjection` imports `p6rContributions` from
`../p6r/sidecar-schema.js` and reads accepted P6R contribution evidence. The
candidate facet/query work therefore depends on A's sidecar schema; it cannot
be selected as an independent zero-P6R append.

| Concern | Exact paths and corrected boundary |
| --- | --- |
| Execution revision | `packages/db/drizzle/0113_execution_override_revision.sql` adds `threads.execution_revision`; its snapshot and journal hunk are execution. |
| Facet persistence | `packages/db/drizzle/0114_dark_mach_iv.sql` creates facet tables/cursor key; `0115_dazzling_ender_wiggin.sql` adds facet profile `identity_kind`. Their snapshots and journal hunks are facets, not execution. |
| Facet query/projection | `packages/db/src/data/thread-facets.ts`, `packages/domain/src/thread-facet.ts`, `apps/server/src/services/threads/thread-facet-query.ts`. Select the sidecar participant projection only after A and its legacy-identity replacement are selected. |
| Execution service | `apps/server/src/services/threads/thread-execution-batch.ts`, execution-only hunks in `packages/db/src/data/{project-execution-defaults,threads}.ts`, `schema.ts`, `apps/server/src/services/threads/thread-execution-override.ts`, plus its routes/contracts/SDK. |
| Shared declarations | `apps/server/src/routes/threads/base.ts`, `packages/server-contract/src/api/threads.ts`, `public-api.ts`, and `packages/sdk/src/areas/threads.ts`. Stage facet base, execution preflight/apply, then the narrow `experimental_includeExecution` attachment. |

`experimental_includeExecution` lives in the current facet-query service that
loads P6R evidence. Root must either retain that dependency with A or split it
through a documented projection boundary; it must not claim the lane is
independent.

### C. Deferred new native attribution, UI, and transport WIP

The following new candidate work remains intact but is excluded from this core
identity selection. This deferment does not cover the existing independent
appearance/recovery/mobile behavior listed above.

| Area | Exact paths / boundaries | Reason |
| --- | --- | --- |
| Ordinary direct/queued writes | `apps/server/src/services/p6r/ordinary-write-attribution.ts`; `apps/server/src/routes/threads/actions.ts`; `apps/server/src/services/threads/{thread-send-request,queued-messages,thread-send}.ts`; `packages/db/src/data/queued-thread-messages.ts`; native-write symbols in `sidecar-store.ts`/`sidecar-schema.ts`; migration 0003 | First direct/queue seam is WIP; no closure for edits, retries, forks, interactions, drain/restart, or final command-group alignment. |
| Native HTTP carrier/presence | `apps/server/src/services/p6r/{native-http-admission,browser-lineage,native-presence,native-websocket-admission}.ts`; `apps/server/src/ws/native-presence-protocol.ts`; related `server.ts`, `types.ts`, `request-context.ts`, `routes/system.ts`, plugin runtime/service/config hunks | Separate carrier ownership. Internal SDK trust must remain request-object based; headers, IP, and plain loopback are not trust evidence. |
| Input provenance transport | `packages/domain/src/native-attribution.ts`, `packages/server-contract/src/native-attribution.ts`, `packages/provider-bridge-protocol/src/{input-provenance,requests,index}.ts`, `packages/agent-runtime/src/{types,runtime,provider-adapter,bridge-protocol-adapter}.ts`, host-daemon/provider bridges | No checked exact persisted request-to-final-input-group join for direct, queue drain, retry, and resume. |
| Native UI/timeline | `apps/app/src/components/settings/NativeIdentitySettingsSection*`, `apps/app/src/components/thread/timeline/NativeMessageAttribution*`, native-attribution hunks in `ConversationMessageContent.tsx`, `ThreadTimelineRows.tsx`, `SettingsView.tsx`, cache/timeline/thread-view files; `apps/server/src/services/p6r/timeline-attribution.ts` and test | Ordinary product rendering is deferred. |

`P6rNativeWriteOrigin` and `recordP6rNativeWriteInTransaction` have limited
helper/rollback evidence, but are not a selected product surface.

## Current gates

The known compile failure is confined to deferred WIP. Calls around lines 239,
275, and 293 of `apps/server/src/routes/threads/actions.ts` pass a typed Hono
route context to `withP6rOrdinaryWriteAttribution`, while
`P6rNativeRequestAdmissionReader` in
`apps/server/src/services/p6r/native-http-admission.ts` uses the default
`Context<any, any, {}>` environment. The typed route context is not assignable
to that narrow type.

When the carrier owner resumes, the smallest safe fix is `Context<any, any,
any>` or a private minimal `req.raw` context shape. Keep the request-object
`WeakMap` private. Do not cast, use `as never`, add a global actor, or trust
headers/IP/plain loopback.

Additional gates are: migration 0003 lacks
`drizzle/meta/0003_snapshot.json`; ordinary provenance lacks its required
aligned final input-group lookup; and the post-helper ordinary integration has
not been re-typechecked as a whole.

## Reconstruction only after a baseline is chosen

No reconstruction is approved by this document. After the baseline choice,
the required record is:

1. candidate status/HEAD/hunk receipt, read-only;
2. an explicit replacement map for each old queue patch omitted, superseded,
   or re-ported, especially 0001 and dependent 0002;
3. logical commits: selected sidecar/protocol, acceptance correlation,
   plugin/public history, then facet projection and execution only when their
   P6R dependency is intentional;
4. focused typecheck/test results from fresh non-runtime source; and
5. only then, an updated series/checksums/result-tree lock plus a separate
   fresh materialization proof.

The existing materializer may be used after these decisions, but cannot resolve
the authority conflict or prove that the old 53-patch queue is the right base.
No candidate, normal, or upstream tree should be altered to make selection
appear simpler.
