# K kernel / acceptance-history source export manifest

Source reference: clean commit `960255b98ce3dccdcb5754eb67a7f989236602a1`.
Candidate reference: dirty `fork/build/proof-bb` at the same `HEAD`.

This is a read-only reconstruction input, not a patch, commit, materialization,
or completeness claim. “New” means absent from that clean commit and currently
untracked in the candidate. SHA-256 values are bytes in the candidate at export
time. Mixed files are represented by exact symbol spans rather than copied.

## Pure selected-new-file archive

Archive: `/home/ubuntu/.bb/thread-storage/thr_mh2gfcm8c8/k-kernel-pure-new-files-960255b98.tar.gz`  
SHA-256: `1d5cf0ae598903a1b89173d415de2949afa861384b3582e4f15ac4d896a6e5ee`

The archive deliberately excludes mixed `sidecar-schema.ts`, `sidecar-store.ts`,
and `sidecar-migrate.ts`; it does not copy their ordinary-native-write/migration
WIP. It contains only these relative paths:

| New file | SHA-256 |
| --- | --- |
| `apps/server/src/services/p6r/identity-protocol.ts` | `4d91d6487b620925c836fb3b6ba34e58acde3dcc9d4235bfee4b3415ffd3d18e` |
| `apps/server/src/services/p6r/invocation-registry.ts` | `0d126f8742e32bd7b303e241aad1b1b88fa722e3cc723733b4c9194a7b7f5495` |
| `apps/server/src/services/p6r/provider-contract.ts` | `fe97d8f624effea96c2069c69b3a719d1715d98f7fb2b7e2f8abee469da6a125` |
| `apps/server/src/services/p6r/provider-registry.ts` | `8b3bec4a46821c9053ef8039ec4580fbf4da74f178e7ca33d34e34424239785f` |
| `apps/server/src/services/p6r/provider-admission.ts` | `b44f1dd637a7f6412b32b5ed4399fd8ec3bea74fe62fe54a8a7a8bb2c6a626a8` |
| `apps/server/src/services/p6r/receipt-outcome.ts` | `241d2724cdbe0fbbd63cbb349f2fba77ea96295a5e25c5b0799b777e1db9910b` |
| `apps/server/src/services/p6r/tool-correlation-registry.ts` | `32d56318c1696c1f9b96cb71f9f19a6d31530fe66868d3b0e8ca6bd63f88bda4` |
| `apps/server/src/services/p6r/native-acceptance.ts` | `e548aba591b2158ab30800b538748c19605a75091564ea4450e4a1819813a846` |
| `apps/server/src/services/plugins/plugin-p6r-dispatch.ts` | `6f2da2e3221c096d511edda713616a895b52142bad5853fa3ff5abe47ed0b702` |
| `apps/server/src/services/plugins/plugin-p6r-http.ts` | `87d4a4f714ad898c298b5a700a1e601961299c64e5feb3ce6087fae72652cd11` |
| `packages/plugin-sdk/src/experimental-p6r-identity.ts` | `58e62fa3afd94f77b1c48f1a9b95ed0258aa00a3949b7d9a1c833ca3e829a7ea` |

Required mixed new files, intentionally not in the archive:

| File | Candidate SHA-256 | Selected symbol boundary | Excluded boundary |
| --- | --- | --- | --- |
| `apps/server/src/services/p6r/sidecar-schema.ts` | `029d476e6e348ef10720587ad4844dae308d4cf5869a7d5cb29ce53bd7f7c667` | Attempts, inputs, contributions, receipts, provider/instance and pending-dispatch tables used by acceptance/history. | `p6rPendingNativeWrites`. |
| `apps/server/src/services/p6r/sidecar-store.ts` | `ee3e89e603149e485a39d6c5668d16df50c98c55c5eb3dfc342c00c2228020b1` | Acceptance receipt/attempt/contribution operations; `linkP6rNativeTurnForRequest`; list/history operations. | `P6rNativeWriteOrigin`, `recordP6rNativeWriteInTransaction`, and queued-native-write reserve/promote/update/delete operations. |
| `apps/server/src/services/p6r/sidecar-migrate.ts` | `d5fb874215b00f9fa8645cc0f53551c76830832534a0e5f85b0d5dc4240ef172` | Migration runner only after an explicitly selected migration directory is supplied. | Current directory-wide migration discovery, which would include deferred `drizzle/0003_native_queued_writes.sql`. |

## Direct import closure

Classifications: **S** selected new source/symbol; **U** clean-960 upstream
module or package dependency; **X** required but unavailable in clean 960 or
currently mixed/unselected; **D** deferred native HTTP/WS/timeline/provenance.
Every direct TypeScript module specifier in the selected-new source set appears
below. Node built-ins and third-party libraries are U.

| Importer | Direct module specifier(s) | Classification |
| --- | --- | --- |
| `identity-protocol.ts` | `node:crypto`; `@bb/db`; `@get-bb/plugin-sdk`; `./invocation-registry.js`; `./provider-contract.js`; `./receipt-outcome.js`; `./sidecar-store.js`; `./tool-correlation-registry.js` | U; U (type only); S (SDK declaration spans below); S; S; S; X (mixed selected operations); S. |
| `invocation-registry.ts` | none | No direct imports. |
| `provider-contract.ts` | none | No direct imports. |
| `provider-registry.ts` | `./provider-contract.js` | S. |
| `provider-admission.ts` | `node:crypto`; `@get-bb/plugin-sdk`; `./identity-protocol.js`; `./invocation-registry.js`; `./provider-contract.js` | U; S; S; S; S. |
| `receipt-outcome.ts` | `./identity-protocol.js`; `./sidecar-store.js` | S; X (mixed selected receipt type). |
| `sidecar-schema.ts` | `drizzle-orm/sqlite-core` | U, but source itself is X until the selected tables are extracted from ordinary-write WIP. |
| `sidecar-store.ts` | `node:crypto`; `drizzle-orm`; `@bb/domain`; `@bb/db`; `./sidecar-schema.js`; `./identity-protocol.js`; `./invocation-registry.js` | U; U; U; U; X; S; S. |
| `sidecar-migrate.ts` | `node:path`; `node:url`; `@bb/db`; `drizzle-orm/better-sqlite3/migrator` | U; U; U; U. It is X until migration discovery is restricted to selected 0000--0002 files. |
| `tool-correlation-registry.ts` | none | No direct imports. |
| `native-acceptance.ts` | `@bb/db`; `@bb/domain`; `@bb/server-contract`; `../../types.js`; `../threads/thread-command-environment.js`; `../threads/dispatch-attempt.js`; `../threads/thread-provisioning.js`; `../threads/thread-send.js`; `./identity-protocol.js`; `./receipt-outcome.js`; `./sidecar-store.js`; `./sidecar-schema.js`; `zod`; `drizzle-orm` | X for named `replaceCoreParticipantProfilesInTransaction`; U; U; U for imported type; U; U; X for named `appendThreadProvisionRequestInTransaction`; U; S; S; X; X; U; U. |
| `plugin-p6r-dispatch.ts` | `node:async_hooks`; `@get-bb/plugin-sdk`; `../p6r/identity-protocol.js` | U; S; S. |
| `plugin-p6r-http.ts` | `../p6r/invocation-registry.js` | S. |
| `experimental-p6r-identity.ts` | none | No direct imports. |

Primary gate result: none of the archived pure selected-new files directly
imports `native-http-admission`, `native-websocket-admission`, `native-presence`,
`browser-lineage`, `timeline-attribution`, `ordinary-write-attribution`,
`native-attribution`, provider-bridge provenance transport, or
`provenanceGroups`. The kernel is **not** closure-ready because the X edges
listed below remain.

## Shared-file export fragments

Each SHA-256 is computed from the listed current line fragments, with a stable
`@@ start-end` delimiter before each fragment. These are detection hashes for
review, not permission to copy any complete mixed file.

| ID | File and exact line fragments | SHA-256 | State |
| --- | --- | --- | --- |
| `events.p6r-turn-link` | `apps/server/src/internal/events.ts` lines `61`, `326-345`, `984` | `ba99e4c4e6a270402d75aa8a1dc898c79af960da9adf3aa132b3110eda5e917e` | Select: exact accepted request → native turn link. |
| `tool-calls.p6r-correlation` | `apps/server/src/internal/tool-calls.ts` lines `11`, `71-124` | `e524a985cef1c77a28557ecdc9fde860f23b71a42aeffb64c4dcf8240398e48b` | Select: validated daemon/session/thread correlation captured before plugin context. |
| `plugin-api.p6r-protocol-lifecycle` | `apps/server/src/services/plugins/plugin-api.ts` lines `52`, `279-281`, `528-531`, `559`, `1729-1731`, `1776-1779`, `1816-1818` | `9e291d5ecfa3e7d96f1f825e0a0bec77dd2d883f9b5b9ba402690ac544d10627` | Select. |
| `plugin-service-internal.p6r-deps` | `apps/server/src/services/plugins/plugin-service-internal.ts` lines `33-36`, `90-99`, `175-177` | `080b9ecd21c4e086a6dc6de60660a336d13857ef3c4e8354595c3569ca455cfc` | Select. |
| `plugin-service.p6r-http-rpc` | `apps/server/src/services/plugins/plugin-service.ts` lines `3`, `139-140`, `341-351`, `2203-2230`, `2289-2330`, `2351-2388` | `deb818fb1d39d228aa5a625e4db9263f9e7a3c09a0014280a12626a4b1d841fd` | Select, but review separately from unrelated staged-NPM work in the same file. |
| `plugin-runtime.p6r-lifecycle-mixed` | `apps/server/src/services/plugins/plugin-runtime.ts` lines `90`, `1236`, `1335-1346`, `1510`, `1584-1669`, `1726` | `c47265b44e269d85523ea2c1e802e31a43347fbc29ee7df65bf70029f7493bed` | X: mixed with root-owned SDK fetch/carrier and artifact lifecycle changes; extract only after owner resolves that boundary. |
| `server.p6r-root-mixed` | `apps/server/src/server.ts` lines `88-95`, `601-693`, `724-726` | `d7623fbbd2147c50936cde2f85c73ae837f0684cb8bc6ad827dd6fdd4926c2a2` | X: see deferred direct edges below; not in export. |
| `types.p6r-boundary` | `apps/server/src/types.ts` lines `2`, `39` | `24d9c80c3c7701e784ed15ac9c26976fc3727a30d1e86079d081f2127f53f4b9` | Select with config boundary. |
| `types.deferred-native-reader` | `apps/server/src/types.ts` line `49` | `1cc40216eef06426217fb3e8a925c28122592aa29200f90d0aee6d0e7e0b15df` | D: omit. |
| `plugin-sdk.backend-p6r` | `packages/plugin-sdk/src/backend-contract.ts` lines `37`, `1737` | `076b9a97f7429bdbdfca9a8d05524ba62b6f04b15730baf7b8095293f59c5188` | Select. |
| `plugin-sdk.index-p6r` | `packages/plugin-sdk/src/index.ts` line `12` | `13140ffc0bac190cb6cc6a2331759dbfcfa6756bd7d44f9b0d06fd0db9bb2ae0` | Select. |
| `config.server-boundary` | `packages/config/src/server.ts` lines `24`, `64`, `73-86`, `188-193` | `516cdd1d6f655efa8507474bcb2284514ddd3d647ca511a9ee029b2d86521287` | Select prerequisite; absent from clean 960. |
| `config.env-boundary` | `packages/config/src/env-vars.ts` lines `182-295`, `345-350` | `fa27b642b2873944bb9103f62481620b5e865cdb2385edafa5854a88afc76713` | Select prerequisite; absent from clean 960. |
| `start-server.p6r-config` | `apps/server/src/start-server.ts` line `86` | `4154aa50125e0fcd1bbb972d7ebef4130154ae27085af98685413913ac0eca75` | Select with config prerequisite. |

## Exact unresolved edges for root

1. `native-acceptance.ts` imports
   `replaceCoreParticipantProfilesInTransaction` from `@bb/db`; that named
   export is absent at clean 960 and currently comes from candidate
   `packages/db/src/data/thread-facets.ts`. K must either select a narrow,
   sidecar-derived participant projection writer or make acceptance not write
   that projection. Taking all facet work is not justified by this export.
2. `native-acceptance.ts` imports
   `appendThreadProvisionRequestInTransaction`; that symbol is absent at clean
   960 and currently lives in the dirty shared
   `apps/server/src/services/threads/thread-provisioning.ts`. Its exact
   request/queue transaction hunk must be independently exported for K.
3. The present `server.ts` root fragment imports deferred
   `native-http-admission.ts`, `native-presence.ts`,
   `native-websocket-admission.ts`, and `browser-lineage.ts`. Its K provider
   admission callback also calls `getTrustedP6rLineage`. It cannot be exported
   as-is without violating the no-deferred-import gate. Root must split a
   provider-admission ingress interface from browser/native HTTP/WS plumbing.
4. `apps/server/src/types.ts` line 49 directly imports deferred
   `native-http-admission.ts`; omit that field from K. The config boundary at
   lines 2/39 is separate and is required by provider admission.
5. `sidecar-migrate.ts` currently discovers the whole sidecar migration
   directory; selecting it unchanged would include deferred 0003 native-write
   SQL. Export must use an explicit 0000--0002 migration list/directory.
6. `plugin-runtime.ts` P6R provider lifecycle is mixed with root-owned
   `createSdkFetch` request-carrier and artifact lifecycle edits. The listed
   hash preserves the review target, but no K export may copy the whole file.

## Witness source inventory

These new test files have no direct reference to deferred native HTTP/WS,
timeline, ordinary-write, or provenance-transport source paths. They are
candidate witnesses only; no test was run for this export.

| Test file | SHA-256 |
| --- | --- |
| `apps/server/test/services/p6r/identity-protocol.test.ts` | `a7455e852fcabd2cedf705a7029c85176520d0d5c5a21a3b8aa96785bf54d046` |
| `apps/server/test/services/p6r/invocation-registry.test.ts` | `91ce119b0b498df2fcf4ee0eec67764e2589c9310b1fbb653ed106793bf36c59` |
| `apps/server/test/services/p6r/native-acceptance.test.ts` | `a6d4aacb9a90a1dc1598194701fbe495fe030263df3acfb9ac7b9752fc3ebb72` |
| `apps/server/test/services/p6r/provider-admission.test.ts` | `fb54145f2dd4c61fda32cab6118e48ad80e573d7fd901502160d9f2b5ed246ef` |
| `apps/server/test/services/p6r/provider-registry.test.ts` | `0bc6d9d92463c5510c1efd8126efccf1ab0e8cc62c3971db5ab1fa4a49828871` |
| `apps/server/test/services/p6r/sidecar-store.test.ts` | `f6f8de4e8197cfdb7525b7e5e9067bed23be896b492cfc9355616299dc120912` |
| `apps/server/test/services/p6r/tool-correlation-registry.test.ts` | `9c257a6c70a4e0f8a9e19a8675e4b153cef4ab12b3560085d92a1af4f0194537` |
| `apps/server/test/services/p6r/package-raw-protocol-compat.test.ts` | `3e9cae3457ecc85a2c5938c09be4ac1944a9173c5d996979f397073e60c8e85a` |
| `apps/server/test/services/plugins/plugin-p6r-api-integration.test.ts` | `168d3b5a396522d22b17184cc588b910a5792145f090ca7206d6bf8334ad3f94` |
| `apps/server/test/services/plugins/plugin-p6r-dispatch.test.ts` | `1ca157d2968d5c553cf7bb9cc89974c114d5313f36b8e0541fbd784ce10ecc42` |
| `apps/server/test/services/plugins/plugin-p6r-http.test.ts` | `7e12a1c0298a673a9f61349e1ac857ae285d40ccc9a011a674af5fc6c3f3d150` |

No candidate source was copied into the repository and no runtime source was
changed. The archive is retained only in thread storage for root review.
