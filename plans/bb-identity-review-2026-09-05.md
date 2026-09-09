# BB identity and Thread Sections review — 2026-09-05

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Review scope: the current authored package, Thread Sections adoption, related proof-core boundaries, packaging, and isolated-proof preparation. This is not a review of every unrelated dirty change in the workspace. No implementation, normal runtime, proof runtime, plugin installation, checkout, or promotion was changed by this review.

The core/package/feature ownership split remains appropriate. Core owns admitted identity and durable native attribution; the package owns portable binding and synchronization; Thread Progress owns its schema, SQLite, IndexedDB, migration, and recovery UI. The defects below do not justify transferring feature storage or UI into core. They do prevent an adoption-complete or deployment-ready verdict.

## Findings

### 1. P1 — The public server binding does not connect enhanced directory or participant readers

`createBbIdentityServerBinding` constructs the host adapter without a directory. The adapter initializes `unsupportedDirectory()` and `unsupportedParticipants()` and returns those same readers in the enhanced branch. It never consumes the enhanced protocol's `directorySources()` or `participants()`.

Evidence: [binding construction](/home/ubuntu/bb/plugins/packages/bb-identity/bb-binding-runtime.ts:178), [reader defaults](/home/ubuntu/bb/plugins/packages/bb-identity/host-runtime.ts:288), [enhanced return](/home/ubuntu/bb/plugins/packages/bb-identity/host-runtime.ts:384), [foreign target resolution](/home/ubuntu/bb/plugins/packages/bb-identity/server-runtime.ts:88).

A bounded public-binding probe supplied enhanced directory/participant methods and dispatched the registered native search, profiles, and participants routes. All returned `unsupported`; both supplied method counters remained zero. Thus real collaborator lookup and subsequent collaborator target resolution cannot work through this binding, even if bootstrap advertises the capabilities. The controlled browser supplies those route responses directly and therefore misses the gap.

Correction: implement package-owned provider-directory normalization/composition and participant adaptation, preserving bounds, validation, coverage, and capability absence behavior. Add a connected test from public native client requests through the actual public server binding to provider callbacks and collaborator state reads. Existing foreign-write rejection is not a substitute for the positive read path.

### 2. P1 — Disposing an enhanced binding still permits new external sends and provider registration

The public binding forwards `sendExternal` and `registerProvider` without a disposed check. The server and enhanced host also forward these operations after their local disposal flags are set. Disposing the binding does not necessarily retire the enclosing core plugin generation.

Evidence: [external forwarding](/home/ubuntu/bb/plugins/packages/bb-identity/bb-binding-runtime.ts:233), [registration and disposal](/home/ubuntu/bb/plugins/packages/bb-identity/bb-binding-runtime.ts:298), [enhanced acceptance](/home/ubuntu/bb/plugins/packages/bb-identity/host-runtime.ts:394).

An isolated public-binding probe called `dispose()` first, then sent a valid new external operation. The enhanced protocol's acceptance counter increased and the binding returned `submitted`. A later registration also reached the raw provider-registration method. These were newly initiated operations, not completions of work dispatched before disposal.

Correction: gate new lifecycle-owned operations before they reach the protocol. Test disposal before dispatch, reentrant disposal, and provider setup after disposal. Preserve valid durable receipts for work already dispatched; disposal cannot undo an accepted operation.

### 3. P2 — The provenance decoder accepts incomplete evidence as `known`

`provenanceCodec` verifies array presence, but not required correlation, individual source/contribution shape, or causal completeness. A direct runtime probe returned `ok: true` for `status: known` with no correlation and an input group referencing a contribution absent from the empty contributions array. The enhanced tool-provenance adapter uses this decoder.

Evidence: [decoder](/home/ubuntu/bb/plugins/packages/bb-identity/model-runtime.ts:89), [adapter call](/home/ubuntu/bb/plugins/packages/bb-identity/host-runtime.ts:380), [known-evidence contract](/home/ubuntu/bb/plugins/packages/bb-identity/model.d.ts:146).

The history adapter also passes `historyAttempts` and `historyContributions` results through `asResult` without decoding the evidence page or its entries. A bounded adapter probe accepted a known attempts page containing an attempt without required correlation. This is a separate entry path to the same validation gap, not evidence that an empty contribution page is invalid.

Correction: validate the complete discriminated evidence shape, page metadata, entries, and stated reference-completeness invariant before assigning public types. Malformed evidence must not acquire `known` status merely because two arrays exist. This is rated P2: malformed host evidence crosses the contract boundary, but no authorization bypass was demonstrated.

### 4. P2 — Malformed browser settings initialize defaults without a usable recovery action

When owner-scoped browser JSON cannot be decoded, the reader retains the raw bytes but returns `status: available` with a null candidate. The planner treats that as absence. The ready UI offers retained-byte export only when there is a decoded recovery draft.

Evidence: [browser classification](/home/ubuntu/bb/plugins/plugins/thread-progress/lib/thread-sections-browser-candidate.ts:132), [ready recovery gate](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:1879).

This was reproduced in real Chromium with the actual ProgressInbox/public facade and controlled SDK host: seed the exact actor-scoped key with `{broken`, then mount. The component became ready and made one initialization save. The malformed bytes remained unchanged, but there was no alert or export/recovery action; only the ordinary section controls and saved-checkpoint lookup appeared. Raw legacy bytes are not an IndexedDB checkpoint, so that lookup does not recover them.

Correction: represent malformed-but-present input separately from verified absence and make its exact retained bytes accessible. Define an explicit initialization/start-fresh decision where necessary. Test malformed scoped and unmarked input with the actual UI, not just raw-byte retention in a helper.

### 5. P2 — Mounted recovery evidence is narrower than the reported actor A→B→A completion

The mounted host keeps `issuer:progress-user` as its actor. `replaceRpcIncarnation()` changes the RPC object and session stamp; the runner calls it once. This proves same-actor session replacement and old-control removal, not a visit to another authenticated actor and return to A. Integration independently confirmed that no other mounted ProgressInbox actor-ABA test exists.

The fresh `Recover draft` click is followed by a 100 ms wait and a save-count assertion, without asserting recovery success, errors, or restored draft completion. That interval is shorter than the controller's default 300 ms debounce. A rejected or stalled recovery can satisfy a no-save assertion.

Evidence: [fixture replacement](/home/ubuntu/bb/plugins/packages/bb-identity/type-tests/browser/progress-inbox-browser-app.tsx:146), [runner assertions](/home/ubuntu/bb/plugins/packages/bb-identity/type-tests/browser/progress-inbox-lost-response-browser-run.mts:43), [controller debounce](/home/ubuntu/bb/plugins/packages/bb-identity/state-controller-runtime.ts:23).

Correction: retain the useful session-replacement test under its accurate name; add actual actor A→B→A with distinct owner records/checkpoints. Assert recovery reaches a defined successful result and observe through completion of all relevant scheduled work. Keep direct obsolete-token rejection in a focused executable binding test. Public DOM removal should not be described as invocation of an unmounted React closure.

### 6. P2 — Read-only preview loses valid server legacy settings

When the selected collaborator has legacy KV settings but no canonical SQLite value, preparation returns the decoded legacy value with `readOnly: true`. The migration planner immediately returns only `{ kind: 'read-only' }`. The binding's initial value consequently falls back to feature defaults, while initialization is correctly disabled. The later canonical read is empty, so the saved legacy configuration is not available to the preview.

Evidence: [legacy preparation](/home/ubuntu/bb/plugins/plugins/thread-progress/server.ts:2226), [planner early return](/home/ubuntu/bb/plugins/plugins/thread-progress/lib/thread-sections-migration.ts:70), [initial value and binding](/home/ubuntu/bb/plugins/plugins/thread-progress/components/thread-sections-identity-state.tsx:279).

A bounded planner probe confirmed the value is dropped; the complete UI consequence is source-derived, not a new mounted run. Existing preview tests cover canonical/empty state and do not close this legacy case. Correction: preserve the server legacy value as a read-only projection without importing it or enabling writes. This defect remains relevant after the missing real directory path is fixed.

### 7. P2 — Invalid server legacy data has no usable recovery path

Preparation drops malformed legacy contents from its response and returns only `invalid-legacy`. The UI says the data is retained for explicit recovery, but its `retained` payload contains browser bytes only. With no browser data, the user has neither the server bytes to export nor an explicit resolution action; retry reads the same invalid KV and blocks again.

Evidence: [invalid source DTO](/home/ubuntu/bb/plugins/plugins/thread-progress/server.ts:2233), [blocked presentation](/home/ubuntu/bb/plugins/plugins/thread-progress/components/thread-sections-identity-state.tsx:362), [recovery export](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:1835).

This is a source-supported recovery-usability finding. Original server bytes remain physically intact; data deletion was not demonstrated. Correction: provide an authorized, bounded feature recovery/export or explicit resolution path for those server bytes, preserving their provenance and keeping them separate from browser retention.

### 8. P2 — Public testing constructors are still unconditional stubs

`/testing` declares working `createConnectionHarness` and `createStateStorageHarness` constructors, but both runtime implementations always throw messages saying the later runtime slice is required. Those client/state slices now exist. A read-only invocation against the emitted artifact reproduced both throws.

Evidence: [public contracts](/home/ubuntu/bb/plugins/packages/bb-identity/testing.d.ts:68), [runtime stubs](/home/ubuntu/bb/plugins/packages/bb-identity/testing-runtime.ts:325).

Correction: implement the advertised harnesses or narrow the declared surface until they are implemented. Add packed runtime constructor calls. The current tarball test checks archive presence for all nine entries, but executable/type consumers cover only `/state`, `/client`, `/bb`, and `/react`; root, `/model`, `/host`, `/server`, and `/testing` lack equivalent packed consumer witnesses. See [tarball test](/home/ubuntu/bb/plugins/packages/bb-identity/type-tests/package-tarball.runtime.test.mjs:28).

### 9. P2 — Default workspace checks omit the new library

The generated root `build`, `test`, and `typecheck` scripts filter `@phosphor/bb-plugin-*`, which excludes `@phosphorco/bb-identity`. The dedicated `identity:check` exists, but ordinary workspace checks do not invoke it. A TypeScript project reference does not change those script invocations.

Evidence: [generated scripts](/home/ubuntu/bb/plugins/package.json:13), [generator](/home/ubuntu/bb/plugins/tools/workspaces-sync/definition.ts:1705).

Correction: include library compilation/build/tests in the generated normal verification path, with dependency ordering where plugin builds consume emitted library files. Keep browser checks explicit if their environment requirements warrant that. This review ran the dedicated package check successfully, so the finding concerns future gate coverage rather than a missing current package test run.

### 10. P2 — Core JSON snapshotting can collapse distinct operation payloads

The proof core snapshots generic JSON records into `{}` using assignment. An own enumerable `__proto__` property changes the new object's prototype instead of becoming an own property; hashing therefore omits it. Through the actual `createP6rIdentityService` public accept path and an in-memory sidecar, two otherwise identical requests using the same operation ID but different own `__proto__` values recovered the same receipt rather than rejecting changed payload. The native callback ran once. An ordinary changed extra key does produce `invalid-operation`.

Evidence: [generic input and snapshot/hash](/home/ubuntu/bb/fork/build/proof-bb/apps/server/src/services/p6r/identity-protocol.ts:83), [native JSON copying](/home/ubuntu/bb/fork/build/proof-bb/apps/server/src/services/p6r/native-acceptance.ts:24).

Important limit: the native PromptInput schema strips these extra fields. This does not demonstrate different effective native prompts, global prototype pollution, or an authorization bypass. It violates the raw generic JSON operation-fingerprint contract. Correction: preserve own JSON keys when snapshotting, or explicitly normalize input before defining its immutable fingerprint. Add a public accept regression. No live daemon was involved in the probe.

### 11. P3 — Publication documentation contradicts the generated exports

The main package introduction and local-proof README still state that `/bb` is not exported, while the generated package now exports `/bb`, `/client`, and `/react`. The local-proof README consequently describes manual adapter assembly as a current missing runtime feature.

Evidence: [package introduction](/home/ubuntu/bb/plugins/packages/bb-identity/README.md:10), [proof instructions](/home/ubuntu/bb/plugins/packages/bb-identity/examples/local-proof/README.md:49).

Correction: update publication status while retaining the accurate distinction between existing exports, controlled/packed tests, and unfinished same-artifact native-host proof.

The [Thread Progress section documentation](/home/ubuntu/bb/plugins/plugins/thread-progress/README.md:142) also describes the retired Identity Boundaries ID/revisioned-save/localStorage fallback model. It should describe canonical package owner keys, SQLite state, IndexedDB drafts, and unavailable-identity write suspension. This is documentation drift, not evidence that the old section writer remains active.

### 12. P2 — Ordinary package typechecking depends on an ignored proof-checkout artifact

The default package tsconfig includes `type-tests/*.runtime.test.ts`. One matching file imports `ExactTargetBbPluginApi` directly from `fork/build/proof-bb/packages/plugin-sdk/bundled-types/bb-plugin-sdk`. That declaration exists locally, but Git confirms its directory is ignored and contains no tracked files. The ordinary package typecheck therefore implicitly requires the temporary proof checkout and its generated SDK declarations, beyond the installed public SDK dependencies.

Evidence: [relative exact-target import](/home/ubuntu/bb/plugins/packages/bb-identity/type-tests/bb-upstream-sdk-contract.runtime.test.ts:4), [default include](/home/ubuntu/bb/plugins/packages/bb-identity/tsconfig.json:49), [documented separation](/home/ubuntu/bb/plugins/packages/bb-identity/PACKAGING.md:38).

The dependency is confirmed by source/configuration inspection and Git ignore/tracking checks. Failure in an environment without that generated target is inferred; no checkout or declaration was removed to simulate it. Correction: keep the installed-public-SDK witness in ordinary package checks and move the exact-target witness into an explicit target check with a declared pinned SDK input. This is distinct from the workspace scripts omitting the package: even the dedicated package check currently depends on local generated proof state.

## Rejected candidate

The feature review initially reported that two preparations with the same key could replace one legacy snapshot with another. Its probe supplied arbitrary different snapshots, but no permitted production timeline was established: rollout explicitly requires cold/drained activation, new legacy saves reject, and compatibility reads no longer copy aliases. The reviewer withdrew this finding. It does not justify adding a preparation nonce or expanding the migration API.

A late proof review proposed that trimming `git diff --binary HEAD` could hide a trailing-whitespace source edit. Its synthetic diff-string collision omitted Git's changed blob hash. Root tested real tracked-file diffs in an isolated temporary Git repository: changing the final added line from `value` plus three spaces to `value` changed the `index` hash, and the trimmed diffs remained different. No actual fingerprint collision was established, so this is not accepted as a proof-integrity defect.

## Verification performed during this review

- `bun run identity:check`: passed package typecheck/build, 127 Bun tests and 3 Node SQLite tests.
- `bun run identity:browser-check`: passed the full current Chromium aggregate, including actual wrapper and ProgressInbox controlled-SDK lanes.
- Thread Progress ordinary `bun run test`: 313 passed, 1 skipped, 0 failed; ordinary typecheck passed.
- Plugin manifest sync and diff checks passed. Fork and proof-worktree diff checks passed.
- Additional bounded probes reproduced malformed-browser recovery behavior and incomplete-known provenance. Independent review reproduced public binding reader and post-disposal operation defects.

These checks establish the tested scopes. They do not establish live core admission through the actual SDK for every feature route or same-plugin-artifact portability across hosts.

## Completion and release boundaries

The existing controlled-browser work is useful: ordinary editing, initialization races, exact losing-candidate export, accepted-response-loss reconciliation, preview UI behavior, and IndexedDB transaction scheduling now have concrete tests. The real SQLite public-route test separately demonstrates rollback, receipt retry, and denied foreign writes. Neither test layer connects the currently missing real directory path.

Live same-artifact base/fork proof remains open. The current plan correctly requires sealed outputs, complete input/output receipts, verified absence of source fallback/rebuild, preactivation settings, and a cold/drained migration boundary. Output-directory support alone does not prove that artifact chain. The new isolated base checkout/runtime remains a separate environment decision; normal and dirty upstream must remain untouched.

Agent Connect is still a planned consumer, not a completed migration. Its durable reservation, immutable external author, lost-response reconciliation, and exact call correlation should follow the package correctness fixes. Exposing existing history through `/bb` does not by itself validate its payloads or prove queued/grouped execution correlation. Notifications and authored-session round trips remain later gates.

Whole-plugin Thread Progress identity portability is also incomplete beyond the bounded Thread Sections cutover. Existing [profile and participant helpers](/home/ubuntu/bb/plugins/plugins/thread-progress/server.ts:961) still call the fixed `identity-boundaries` namespace; directory/participant enrichment can return unavailable or empty without that plugin. Current self-profile handling also has a request-actor fallback, so it is inaccurate to claim all current identity disappears. These adjacent paths were deliberately left outside the sections migration. Record their later migration through normalized package readers before claiming provider independence for the entire plugin; do not conflate them with the missing package directory composition in finding 1.

The reviewed implementation includes substantial authored untracked files. HEAD identifiers alone do not describe it. A promotion receipt must include the selected committed child sources and tested artifact closure; no promotion is recommended from the current dirty composition.
