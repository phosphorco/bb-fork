# Identity provider kernel upstream-sync boundary

Status: a source review composition is committed and reproducibly replayed.
This document does not approve a full-host release or normal promotion. It records the smallest
authority-preserving core boundary to re-express against a later upstream
revision. Existing candidate files are authored work and remain preserved until
the fork owner selects a patch queue.

## Decision

Upstream synchronization ease takes priority over further native product work.
The first patch family is a trusted plugin-provider kernel, not native
multiplayer completion. It must preserve these properties:

- one operator-selected boundary and trusted ingress mapping;
- host-derived ingress facts and selected credential bytes only;
- immutable normalized issuer and subject, with presentation separate from
  authority;
- bounded resolver work, generation-safe prepare/publish/retire, and request
  scope invalidation; and
- absent boundary distinct from configured rejection or outage. A configured
  failure blocks identity-dependent work and never becomes a singleton or
  loopback default.

The current normal materialization cannot be reused as this kernel. Its
[`services/identity.ts`](../build/bb/apps/server/src/services/identity.ts)
contains a loopback local-operator fallback after provider resolution. That is
incompatible with the selected-boundary rule above. The upstream submodule has
no `experimental_p6rIdentity` or equivalent provider-boundary implementation.

## Exact upstream hook map

The locations in the `Upstream anchor` column are in the pinned `upstream/`
source at `5205d98a74ed5a22469e521cf1f86b00b8232827`. They are anchors for a
semantic re-port, not instructions to apply the current candidate diff.

| Kernel concern | Candidate module boundary | Upstream anchor | Required outcome |
| --- | --- | --- | --- |
| Public opt-in | [`packages/plugin-sdk/src/backend-contract.ts`](../build/proof-bb/packages/plugin-sdk/src/backend-contract.ts) | `packages/plugin-sdk/src/backend-contract.ts:1064` (`BbPluginApi`) | Add one optional, experimental protocol member. A host without it remains a truthful unsupported provider host. |
| Operator trust selection | [`packages/config/src/env-vars.ts`](../build/proof-bb/packages/config/src/env-vars.ts), [`packages/config/src/server.ts`](../build/proof-bb/packages/config/src/server.ts), [`apps/server/src/start-server.ts`](../build/proof-bb/apps/server/src/start-server.ts) | No current upstream identity-config hook | Parse one startup-only selected-boundary descriptor. Keep it narrow; do not add a generalized provider registry configuration API. |
| Existing trusted request fact | [`apps/server/src/request-context.ts`](../build/proof-bb/apps/server/src/request-context.ts) | `apps/server/src/request-context.ts:29` and `apps/server/src/server.ts:288-291` | Reuse the existing server-captured remote address. Never accept a forwarded or browser-provided identity header as an ingress fact. |
| Provider lifecycle | [`apps/server/src/services/p6r/provider-contract.ts`](../build/proof-bb/apps/server/src/services/p6r/provider-contract.ts), [`provider-registry.ts`](../build/proof-bb/apps/server/src/services/p6r/provider-registry.ts) | `apps/server/src/services/plugins/plugin-runtime.ts:1376` (`loadOne`) | Stage a candidate, validate it, publish it as one generation, then retire the predecessor. Failed reload retains the active generation. |
| Request admission | [`apps/server/src/services/p6r/provider-admission.ts`](../build/proof-bb/apps/server/src/services/p6r/provider-admission.ts), [`invocation-registry.ts`](../build/proof-bb/apps/server/src/services/p6r/invocation-registry.ts) | `apps/server/src/server.ts:271` (`createApp`) and `:417` (`createPluginService`) | Resolve only from actual Hono request facts plus host-captured ingress lineage, issue an abortable request scope, and invalidate it on expiry, provider replacement, or configuration change. |
| Plugin protocol | [`apps/server/src/services/p6r/identity-protocol.ts`](../build/proof-bb/apps/server/src/services/p6r/identity-protocol.ts), [`services/plugins/plugin-p6r-dispatch.ts`](../build/proof-bb/apps/server/src/services/plugins/plugin-p6r-dispatch.ts) | `apps/server/src/services/plugins/plugin-api.ts:415` (`createPluginApi`) | Supply a generation-bound protocol to a plugin factory, not an ambient actor or a raw resolver. Keep provider setup possible before a person is resolved. |
| Plugin route dispatch | [`apps/server/src/services/plugins/plugin-service.ts`](../build/proof-bb/apps/server/src/services/plugins/plugin-service.ts), [`plugin-service-internal.ts`](../build/proof-bb/apps/server/src/services/plugins/plugin-service-internal.ts), [`plugin-runtime.ts`](../build/proof-bb/apps/server/src/services/plugins/plugin-runtime.ts) | `plugin-service.ts:973`, `plugin-runtime.ts:1461`, and `plugin-runtime.ts:1703` | Capture the issued scope at the actual RPC/HTTP handler boundary, retain it through handler completion, and retire it when the plugin generation retires. |
| Server assembly | [`apps/server/src/server.ts`](../build/proof-bb/apps/server/src/server.ts) | `apps/server/src/server.ts:417-440` | Construct the provider kernel once and pass only its explicit dependencies to plugin runtime/service. Do not change the existing global websocket at `:508-525`. |

The compact kernel is therefore seven logical patch modules: SDK declaration,
narrow configuration, provider contract/registry, admission/invocation,
protocol/dispatch, plugin lifecycle dispatch, and server assembly. These are
the unavoidable upstream touch points. The existing remote-address middleware
is already upstream behavior and should be reused rather than forked.

## Provider kernel versus acceptance and history

For today's plugin delivery, select both the provider kernel and the required
acceptance/history family. Separating patch ownership is not permission to
disable features already used by Agent Connect, Slack, or other consumers.
A provider-only build is a narrower test target, not the completed plugin
composition. Avoid adding a new public capability/version solely to make the
patch families independently installable; an internal dependency boundary may
provide the needed review and synchronization separation.

Provider registration and request admission do not require native thread
acceptance, persisted provenance, or participant history. The current
[`identity-protocol.ts`](../build/proof-bb/apps/server/src/services/p6r/identity-protocol.ts)
mixes both domains and must be split before calling a patch minimal:

| Boundary | Keep in first provider-kernel patch family | Separate follow-up when package behavior requires it |
| --- | --- | --- |
| Provider setup | Selected configuration, evidence resolution, normalized session, directory/profile callbacks, generation lifecycle | Nothing native. |
| Plugin request work | Issued invocation scope, synchronous validity fence, bounded background/profile reads | Feature-owned storage and commits remain in the public package binding. |
| Structured acceptance | No native send or queue integration | [`native-acceptance.ts`](../build/proof-bb/apps/server/src/services/p6r/native-acceptance.ts), [`receipt-outcome.ts`](../build/proof-bb/apps/server/src/services/p6r/receipt-outcome.ts), and their transaction witnesses. |
| Durable history | No sidecar schema or migrations in the first patch | [`sidecar-schema.ts`](../build/proof-bb/apps/server/src/services/p6r/sidecar-schema.ts), [`sidecar-store.ts`](../build/proof-bb/apps/server/src/services/p6r/sidecar-store.ts), correlation, contribution, attempt, and participant readers. |

Acceptance/history is not disposable: the public enhanced package promises
structured external contributions, final receipts, history, and participants
where supported. It is simply a second, independently reviewable patch family.
Until it is selected and proven, the provider kernel must report those
capabilities as unsupported rather than advertising accepted-but-unimplemented
operations.

## Explicitly deferred native product work

Do not carry these modules into the provider-kernel sync patch family:

- [`native-http-admission.ts`](../build/proof-bb/apps/server/src/services/p6r/native-http-admission.ts), native HTTP lineage in
  [`browser-lineage.ts`](../build/proof-bb/apps/server/src/services/p6r/browser-lineage.ts), and system native-identity routes;
- ordinary native write attribution, timeline attribution, native queue/send
  integration, and any core thread-route contract changes;
- [`native-websocket-admission.ts`](../build/proof-bb/apps/server/src/services/p6r/native-websocket-admission.ts),
  [`native-presence.ts`](../build/proof-bb/apps/server/src/services/p6r/native-presence.ts), and
  [`ws/native-presence-protocol.ts`](../build/proof-bb/apps/server/src/ws/native-presence-protocol.ts);
- app presence/identity settings surfaces, SDK native status/realtime surfaces,
  CLI presentation, and all global/sidebar feeds.

When omitted, these routes and capabilities are absent or explicitly
unsupported. They must not use a browser claim, inferred actor, or default user
as a substitute.

## Upstream-update procedure

Follow the fork overlay contract in [`README.md`](../README.md), not a branch
merge or edits under a materialized runtime.

The sequence below describes a future authorized upstream update. It does not
authorize advancing today's dirty upstream/normal trees or creating another
runtime checkout. Apply the workspace preservation rules and use only tooling-
owned disposable verification paths allowed by that contract. During today's
closeout, inspect and prepare the selection first; preserve the candidate WIP.

1. Inspect the current overlay first: `git status`, `./scripts/delta-report`,
   [`patches/series`](../patches/series), [`patches/sha256`](../patches/sha256),
   [`upstream.lock`](../upstream.lock), and [`result-tree.lock`](../result-tree.lock).
   Freeze and attribute the dirty queue before advancing the submodule.
2. Advance `upstream/` only to a reviewed immutable commit, copy its full SHA
   to `upstream.lock`, and inspect the seven anchors above in that exact source.
   The upstream submodule is the only source base; do not create a second
   source checkout or alter `build/bb`.
3. Re-express the provider kernel as small logical commits in a temporary
   upstream worktree. Do not replay the current mixed candidate mechanically.
   In particular, split `identity-protocol.ts` before export, leave native
   routes out, and retain `prepare -> publish -> retire` rather than the old
   direct-registration model.
4. Regenerate only generator-owned artifacts required by the selected upstream
   revision. Generate database migrations only if the separately selected
   acceptance/history family needs persistence; never hand-edit Drizzle
   snapshots or generated SDK declarations.
5. Export reviewed commits with `git format-patch --full-index --binary`,
   replace `patches/series`, refresh `patches/sha256`, and give each patch a
   narrow purpose. Use [`scripts/check-p6r-namespace`](../scripts/check-p6r-namespace)
   to prevent the exception from leaking into unrelated APIs.
6. Materialize to a new, empty disposable path with
   [`scripts/materialize`](../scripts/materialize); it intentionally refuses
   to overwrite an existing materialization. Record the resulting
   `HEAD^{tree}` in `result-tree.lock` only after the patch order is final.
7. Run [`scripts/verify`](../scripts/verify), which independently materializes,
   checks patch hashes, runs the namespace test, and checks the recorded tree.
   Then run the exact upstream install/typecheck/test/build gates in the fresh
   materialization. Do not treat a candidate proof worktree or normal runtime
   as sync evidence.

## Focused regression gates for the first patch family

Before acceptance/history or native product work returns, retain or add focused
tests for:

- `provider-registry.test.ts`: preparation, publication, replacement, failed
  reload retention, and retirement;
- `provider-admission.test.ts` and `invocation-registry.test.ts`: trusted
  ingress only, malformed/rejected/unavailable resolution, expiry, selected
  configuration changes, and generation invalidation;
- `identity-protocol.test.ts`, `plugin-p6r-dispatch.test.ts`, and
  `plugin-p6r-api-integration.test.ts`: factory registration, actual public
  protocol binding, request-scope lifetime, directory/profile behavior, and
  disposal;
- the SDK public-types witness for optional protocol visibility, plus a
  baseline-host witness that returns unsupported instead of fabricating a
  provider; and
- configuration parse tests for the exact selected-boundary descriptor.

Run those through Turbo in the materialization, including
`pnpm exec turbo run typecheck --filter=@bb/server --filter=@bb/config --filter=@get-bb/plugin-sdk`.
The native acceptance, native HTTP, presence, app, SDK realtime, and browser
matrices are deliberately not release gates for this first kernel patch.

## Current friction and non-claims

The present candidate is mixed: it contains provider work, acceptance/history,
native HTTP status, native attribution, websocket presence, and app-facing
changes in one dirty composition. It also has concurrent typecheck work outside
this boundary. It is evidence for individual experiments only, not a minimal
patch queue, an upstream-sync rehearsal, or a releasable artifact.

The practical friction is the protocol split. The provider lifecycle is small,
but current `identity-protocol.ts` reads sidecar-backed history and calls native
acceptance. Keeping that coupling would drag database and native-route conflicts
into every upstream update. The selected review families make this separation explicit while delivering
the promised acceptance/history contract together. Do not introduce temporary
unsupported results for capabilities already promised by the public package.

## Selected-source receipt

The ordered kernel/04–08 selection is committed in `443925687` on review branch
`bb/identity-review-composition-thr_csw7br3yff`. `scripts/verify-selected-kernel`
fetches the exact upstream source and verifies all patch hashes, intermediate
trees, and final tree `8e2356517b37bcfe1384c9df53fa6ff3b39f0cce`. All 104 changed
source files match the independently tested archive. This is a reproducibility
witness against one base, not a rehearsal against a future upstream release.

The selected tree passes 121 focused regressions, 12 typecheck tasks, actual
create/live/queued mention paths, built migration cold start, and the two native
consumer factory witnesses. Remaining host compatibility families and legacy
feature preservation remain explicit in `review-composition.json`. Public URL
and sidebar projection contracts must be reproduced by the selected SDK type
generator before consumer source closure; old declaration files cannot stand
in for missing implementation.

An independent bounded footprint review of that exact tree found 21 new source
or configuration files, 44 modified source/configuration files, 23 test files,
14 migration artifacts, and two documentation changes. Authority/lifecycle
logic is primarily encapsulated in `services/p6r`; existing integration hooks
remain explicit at server construction, plugin lifecycle/dispatch, daemon
ingress, event append/projection, and facet/execution services. The review found
no concrete safe simplification worth adding to this slice. This supports a
bounded source-footprint assessment; it does not prove that future upstream
synchronization will be conflict-free or that the full host fork is minimal.

## Final compatibility receipt (2026-09-06)

The current review selection ends at tree
`66a21cab13b65c6e2b4333ce76926529b9b9430b`. Families 09–11 preserve optional
canonical plugin URLs, persisted sidebar participants, generated SDK contracts,
and execution-cache invalidation. The source contains 117 changed files against
the exact base; all match the checked selection. `verify-selected-kernel`
fresh-fetch replay passes every predecessor and result hash.

Server regressions pass 154/154 with explicit packed identity input and no skips.
App cache tests pass 66/66; app, server, DB and SDK typechecks pass. This proves
the recorded selection and current-base replay, not future upstream conflict
freedom or full-host promotion. Keep lifecycle hooks and compatibility families
separate during semantic upstream review; do not regenerate consumer declarations
from an official SDK having the same version but lacking these fork extensions.
