# Identity/plugin completion ledger

Started 2026-09-06 by Cole's instruction to finish implementation, preserve
existing features, improve agent guidance from friction, and simplify after
verification. Governing scope: [master plan](bb-fork-master-plan.md), including
its Prompt Stacks exclusion and high-trust ownership model. The
[2026-09-05 review](bb-identity-review-2026-09-05.md) remains a historical finding
record; completion evidence belongs here rather than rewriting that history.

## Current handoff

The selected review composition replays from upstream commit `960255b98` to
`66a21cab13b65c6e2b4333ce76926529b9b9430b`. All 117 changed files match the
tested source, and fresh full replay passes. Families 09–10 add optional
server-owned URL presentation, persisted sidebar participant projection, and
built-in authoring guidance; family 11 closes execution-change cache invalidation.
They preserve existing consumer behavior without
adding a second identity authority. The final replay manifest records exact
patch hashes and predecessor/result trees.

Independent frozen-dependency verification now passes 154 focused server tests
(18 files, no skips, explicit reviewed identity archive), including actual
create/live/queued mention paths, the schema-valid daemon authority guard,
capability routes, and thread lists above SQLite's parameter limit. Built P6R
migration cold start and missing-migration failure also pass. Thread Manager
and Thread Progress factory witnesses use the built SDK runtime.

The packed Identity Boundaries factory passes a request test on this selected
host with controlled ingress and directory evidence. It does not establish live
Tailnet admission. Existing proof runtime remains the local signed P/F fixture.
Agent Connect's missing URL contract is restored as optional presentation-only
host capability. The selected CLI now reproduces its SDK declarations; its
54 runtime tests, typecheck, and build pass. Sidebar consumer declarations use the same supported generator, with no restored
stale types. App, server, DB, and SDK typechecks pass; app cache tests pass 66/66.

The selected source closeout is committed and pushed on review branches:

- Fork: `bb/identity-review-composition-thr_csw7br3yff` (compatibility source
  receipts through `7acff4c53`, linked plan closure `27b5de596`).
- Organization plugins: `bb/identity-source-thr_csw7br3yff`, commit
  `1bce7bbb7a84a18971578679aaca58fecfbaa991`; all 253 changed source files
  byte-match the checked isolated composition. This includes library source,
  seven consumers, generator/lock closure and actual generated SDK declarations.
- Workspace guidance: `bb/identity-guidance-thr_csw7br3yff`, `6f81549`.
  This docs-only commit changes no gitlinks and is not a composition promotion.

Final org metadata checks pass: synchronized generator outputs, pinned references,
SDK type checks, and 8 generator tests. Agent Connect passes 54/54 runtime tests;
Thread Progress passes 317 with one explicitly skipped test. Library runtime
checks pass 139 and its real browser-fixture typecheck passes. The unrelated
Phosphor Checkouts packaging hunk was removed. All selected commits are distinct
from the remaining authored working-tree changes, which were preserved.

Remaining gates are explicit: real Tailnet ingress/session plus a usable directory
snapshot on an approved isolated host; full-host retained-feature composition and
promotion; and deferred npm/community registry distribution. Source and artifact
preparation does not require npm publication, but an honest registry-backed
community dependency lock does. The normal runtime and workspace gitlinks remain
unchanged. The old active patch queue was preserved, not silently replaced.

Cole deferred npm publication and its dependent community manifest/registry
lockfile/cold-install work until tomorrow. The approved archive remains unchanged.
The library source manifest now has a direct SDK development dependency; a new
archive therefore requires a new byte-specific release review.

This is a reviewable identity selection, not the active canonical patch queue or
a full-host release. Remaining independent host parity must be preserved before
queue replacement. No normal deployment or workspace gitlink advancement is
claimed. New ordinary native attribution/UI/presence stays deferred. Source
commit receipts are recorded separately from runtime promotion.

The sections below retain chronological evidence. Earlier “active” lane notes
are historical; this handoff and the selected reconstruction checkpoint govern
current status.

## Agent entry and coordination

### Current closeout priority (Cole, 2026-09-06)

This priority supersedes the earlier broad implementation ordering below:

1. Minimize and document upstream integration hooks, with a reproducible patch
   selection and focused synchronization regression procedure.
2. Deliver existing identity-aware plugins through the public bb-identity
   interface, preserving their existing behavior and durable data.
3. Verify the selected composition and document package distribution/proof
   boundaries accurately. Passing the current mixed candidate is insufficient.

Native ordinary-message attribution, provider presentation, native identity
status/UI, and presence expansion are paused for separate selection. Preserve
their authored source; a deferred label does not remove their dependencies from
the candidate. The core selection lane must identify shared-file dependencies
and unverified WIP before any minimal-composition claim. Existing independent
fork features such as facets/execution remain parity obligations if that host
composition is selected, not new requirements of the identity kernel.

Current execution lanes (launched at Cole's request):

- `thr_5nj9gdvv9s`: canonical core patch integration and retained-feature composition.
- `thr_tibrvcyp2t`: Tailnet through public-package consumer verification; prepare
  independently, then verify the exact selected core composition.
- `thr_8pxf2895uq`: selected plugin source/distributable closure and commit partitions,
  preserving unrelated authored changes.

All three use Codex Terra, high reasoning, fast service, with message handoffs
and no `bb wait`. Earlier PJ/W3/MH handoffs remain evidence, not active ownership.
Root owns shared decisions, skill/ledger updates, integration checks, actual Git
operations and final review. Source delivery and canonical integration remain
unfinished; npm deferral does not block them. No full-host or universal Tailnet
compatibility claim follows from the selected-kernel checks alone.
High-risk gates are authority/lifecycle, atomic acceptance and queue finality,
durable replay, and reproducible package/core composition. Defer additional native
presentation before weakening any of those gates. No live promotion is implied.

Selection direction: the trusted kernel supersedes the legacy claimed-identity
authority in the existing patch queue. Do not append a competing authority stack.
Map dependent patches and retained product behavior before reconstruction;
upstream ancestry alone does not establish API compatibility. Preserve the old
authored source for comparison and recovery. Existing facets require a reviewed
participant-evidence adaptation, not wholesale removal or a guessed key bridge.

Read [bb-identity skill](../../.agents/skills/bb-identity/SKILL.md), then only the
relevant reference, package STATUS/CONSUMERS, and affected repository contracts.
New implementation lanes use BB child threads: Codex `gpt-5.6-terra`, reasoning
`high`, service tier `fast`. Send contracts, blockers, friction and completion
via `bb thread tell`; never use `bb wait` or poll a sibling for completion.
Root owns this ledger, skill, and cross-lane documentation. Children supply
exact suggested corrections and may update feature docs in their owned files.

## Work and acceptance

| Lane | Owned work | Completion gate | Status |
| --- | --- | --- | --- |
| Guidance/root | Progressive skill; current package and feature docs; feature parity inventory; incorporate friction | Links valid, realistic agent use, no stale implementation claim | Initial pass validated; feedback ongoing |
| Package (thr_kh78dbzh8h) | Review directory/participant composition, disposed operations, strict provenance/history; public history forwarding | Connected public client/server/provider reads, lifecycle and decoder regressions | Directory/history/lifecycle/AUTO/commit/HTTP checked; package 139 Bun + 3 Node |
| Thread Progress (thr_yf7z59u2sa) | Valid legacy preview, malformed browser/server recovery; retained existing controls/workflows | Real UI/projection and transaction tests; no old section writer | 319 pass/1 skip; complete controlled recovery/preview/actor ABA/shared UI matrix passes |
| Packaging/testing (thr_a7544p6jkf) | Working public harnesses; every-export packed witnesses; normal library gates; explicit SDK target check | Isolated package consumers and generated checks without proof checkout dependency | Harness/tarball 4 pass; generator 8 pass; browser fixture static check passes |
| Core/proof (thr_mh2gfcm8c8) | JSON snapshot integrity; complete build receipts/assembler/profile/no-fallback; preserve native behavior | Focused core tests, sealed artifact validation, migration and runtime proofs | JSON/AUTO/HTTP/queued finality checked; actual sealed normal install, disabled stage and offline command integration pass; live staging remains unrun |
| Agent Connect (thr_w3byvwzf79) | Immutable operation reservation, legacy API compatibility, send/reconcile, authoritative call observation | Concurrent IDs, rotation, modes, lost response, repeated text/grouped execution | 54 tests/typecheck pass; receipt/row matching and corrupt-row uncertainty checked; native pending queue focused closure checked; broader native parity open |
| Additional consumers (provider: thr_pj6dzkbnxy) | Notifications/ntfy, Slack, remaining identity paths and shared UI requirements | Existing feature parity and public package adoption without product logic in core | Provider/Notifications/ntfy/Agentation/Slack/community source ports checked; standalone package release deferred; candidate Thread Manager native parity checked separately |
| Native app | Trusted ordinary-route admission, durable author/editor projection, native timeline and scoped presence | Real ordinary send/queue/edit/retry and UI/WS lifetime witnesses | Deferred from identity selection; authored candidate WIP preserved |
| Native facets/execution | Preserve native participant key domain, writer generations, dashboard census and signed execution CAS | Actual Thread Progress reload and Thread Manager dashboard/preflight/apply | Candidate Thread Manager pagination/notContains/stale/apply, Thread Progress reload, and three delayed catalog witnesses pass; full-host queue integration separate |
| Integration | Mounted actor A/B/A and recovery completion; connected provider path; baseline/fork same artifact | Full relevant checks and bounded real-host workflows | Controlled component matrix passes; composed native/live parity open |
| Cleanup | Remove only redundant abstractions/wrappers; update docs/status; review exact composition | Behavioral/boundary checks remain green, reproducible source receipt | Bounded wrapper cleanup checked; docs updated continuously |

Package, Thread Progress and packaging can start independently after the initial
guidance pass. External consumers depend on checked package history/directory
contracts. Integration uses exact checked-source cues; no casts, fake success,
expected-failure weakening, or duplicate implementation to bypass a lane.

For each existing in-scope feature record: prior user/API behavior, replacement
path, saved-data treatment, and witness. A missing optional host primitive must
be investigated through supported APIs; do not remove the feature or pretend a
weak text match is exact. Report actual product decisions separately from routine
implementation choices. Current no-ID external callers remain compatible while
new retry-safe callers receive additive operation handles unless source evidence
requires another decision.

## Runtime/promotion boundary

Preserve authored dirty/untracked source and normal/upstream checkouts. Candidate
core work remains in the authorized visible proof worktree. No normal reload,
promotion, external delivery, or user-data mutation is implied by a code task.
Prepare the full sealed artifact/profile/settings result for review before any
new environment decision. Existing isolated-proof authorization is unchanged;
the separate base runtime requires resolution of its explicit workspace exception.

## Friction feedback

Each handoff reports: task; exact confusing contract or failed assumption;
smallest diagnostic; correction; witness; suggested documentation location.
Root records validated recurring lessons in the task reference, not as universal
requirements. Delete stale workarounds after shared fixes. Distinguish fixture
DTO errors from runtime defects and implementation evidence from release proof.

## Verification baseline

At review: package 127 Bun + 3 Node; Thread Progress 313 passed/1 skipped;
current browser aggregate and sync checks passed. Review found real untested
boundaries despite those successes. New completion claims must cite updated
commands/results and the actual boundary they exercise.

## Checked implementation updates

- Root core JSON snapshot correction: own enumerable keys (including
  `__proto__`) are preserved using data-property creation in protocol snapshot
  and native JSON copy. The public receipt test now checks exact replay and
  changed-payload rejection for ordinary and prototype-named keys, with one
  native call. Proof-worktree Turbo focused identity/native-acceptance tests:
  11 passed; `@bb/server` typecheck passed. This is candidate source evidence;
  no live runtime, patch-series promotion or artifact activation occurred.
- Initial guidance: new progressive skill and four references validate, local
  links resolve, generic sync skill routes BB authors to the package, package
  README/CONSUMERS/proof README publication and Provider status corrected.
  [Feature parity inventory](bb-identity-feature-parity.md) is the required
  starting point for subsequent consumer owners.

- Package corrections now include unchanged native AUTO forwarding and public
  `server.commits`, the existing issued-target validator. Feature malformed-source
  resolution invokes it inside the immediate SQLite recovery transaction after
  KV preparation; failed validation inserts nothing. Full feature tests remain
  317 passed/1 skipped. Candidate native acceptance preserves all four modes
  and receipt finality: 14 focused tests and server typecheck passed.
- Controlled actual ProgressInbox now proves authenticated A/B/A with exact
  owner-separated IndexedDB records and explicit recovery completion, malformed
  browser raw export then deliberate defaults, malformed server raw export and
  resolution/reprepare, and valid read-only collaborator legacy projection.
  These are component/SDK-fixture proofs, not live provider or same-artifact proof.
- New browser-fixture static checking exposed stale required sidebar props,
  preparation DTO fields, nullable status and owner-token arguments; fixtures
  now implement the exact contracts and the check passes. Generator includes
  the new legacy recovery runner in browser acceptance.

- Root boundary cleanup: internal BB binding/server/endpoint interfaces now use
  the public declarations directly instead of duplicating three structural
  contracts. Typecheck and connected boundary tests pass. Profile lookup now
  rejects malformed/misaligned provider rows, including a profile for another
  requested subject, and handles duplicate requested keys without duplicate raw
  lookups. Focused public tests: 5 passed; rebuilt tarball plus boundary tests:
  6 passed before the type-only cleanup.
- Integrated package check and full controlled browser aggregate pass after the
  feature transaction fix. Frozen dependency install, reference check and SDK
  types check pass against the declared baseline CLI; these do not change the
  normal runtime or prove the candidate was loaded there.

- Tarball verification now has a finite 30-second budget for its isolated
  compiler/import subprocesses. The prior default 5-second test deadline expired
  under parallel compilation despite passing standalone; no assertion was
  removed. The package suite passes again with the bounded artifact witness.
- Sealed assembler is in review, not complete: full receipt content must remain
  inspectable, ignored built dependencies and transitive toolchain inputs must
  be in the stable compilation closure, and actual no-rebuild installation/load
  remains to be proved through an existing supported route.
- Agent Connect submission tests pass, but review holds call completion open:
  pending operation correlation must be awaited, stable call identity/original
  event cursor and observer state must survive response loss/restart, and partial
  host correlation must not be mislabeled as full call parity.

- Agent Connect call completion correction passes 48 leaf tests and typecheck:
  stable pre-dispatch call ID/cursor, instance-owned dispatch join, bounded
  continuation/cancellation, restartable observer, and explicit UNKNOWN/SHARED
  output scope. One turn alone never establishes exclusive authorship.
- Identity Boundaries public provider adoption passes 36 leaf tests/typecheck/
  build, with authentication invalidation, normalized participant callbacks and
  held/exportable legacy outbox recovery. Historical key parsing is explicitly
  versioned and confirmed with server-issued current identity before conversion.
- Root added public HTTP registration and fixed background invocation lifetime.
  HTTP handlers retain issued authority through body completion/cancel/disposal;
  enhanced candidate PluginService now dispatches bound HTTP handlers. Real Hono
  service test plus four core lifetime tests pass (7 total), server typecheck
  passes, package identity check passes (139 Bun + 3 Node). Notifications/ntfy
  now port against this checked surface; no live HTTP activation has occurred.
- Current parallel lanes: Notifications/ntfy; remaining Thread Progress plus
  Agentation; shared package React presentation. Org dependencies added through
  generator. Community package distribution needs its own reproducible route.
- HTTP composition review caught duplicate response ownership: an enhanced
  package wrapper releasing the core scope at its EOF could abort the host's
  outer body reader before EOF propagated. Enhanced responses now have one
  body owner (core); package invocations settle on that scope signal. Baseline
  responses use the package body owner. Actual public package -> installed
  candidate service -> Hono response consumption/cancellation passes, alongside
  the raw handler and lifetime tests (8 total). No fixture-only success claim.

- Shared React avatar/label/view picker/status are public and mounted in Thread
  Sections. Package checks pass (139 Bun + 3 Node); Thread Progress reports
  319 passed/1 skipped. Root reran the entire controlled browser matrix after
  this composition change: all phases pass without changing runner assertions.
- Notifications/ntfy source ports report 63 passed/1 skipped and 17 passed,
  with leaf typechecks. Root is reviewing commit fences and credential-only
  forwarding. Org Agentation reports 88 tests/typecheck; remaining Thread Progress
  normalized reads are implemented, with external sources kept distinct and
  actual thread identifiers decoded before public reads.
- Thread Manager is intentionally native: its facet participant summary and
  continuation API provide the authoritative filter-member keys and presentation.
  A second normalized reader would duplicate work and has no key-domain bridge.
  No artificial dependency or new wrapper was added. Other authored-source
  inventory found only already-owned identity consumers; Prompt Stacks stays out.
- Actual public package HTTP cancellation during an awaited handler now passes
  through Hono/PluginService: expired invocation cannot read identity after the
  client aborts, late response bytes are not delivered. Combined HTTP tests: 9.
- Active lanes now cover native admitted tool/operation correlation, Slack, and
  community Agentation. Community dependency 0.1.0 is not published; local packed
  verification and standalone release readiness remain separate gates.

- Actual assembly exposed gaps bypassed by synthetic fixtures: hoisted ESM
  packages, native toolchain dependencies, and a diff larger than the subprocess
  buffer were not captured. Closure traversal now resolves installed package
  manifests (including import-only exports and packages named like Node builtins)
  and snapshots transitive dependency bytes. Actual sealed assembly succeeds;
  script regressions pass 11/11. Managed install then exposed missing host SDK
  aliasing in source execution and the target core's absent native facet API.
- Source-host SDK aliasing now resolves the installed host SDK when its built
  runtime is absent; bundled hosts still use their bundled runtime first.
  Thread Progress preserves progress/phase truth and pending projection intent
  on hosts without facets, with no fake acknowledgment/retry. Returning to a
  facet-capable host reconciles retained intent (12 focused projection tests).
  This enables the required portable ordinary workflow; it does not close the
  separate target-host native facet/query parity gate.
- Notifications review adds a transaction-entry issued-target fence for legacy
  rekey and the following subscription mutation. Expiry preserves exact rows;
  a later valid attempt can migrate them. Mixed nonperson/interaction provenance
  no longer falsely selects a sole human. Focused tests and leaf typecheck pass.
- Community Agentation Mentions source port passes 93 tests, typecheck and build
  against the locally npm-installed public package artifact. It captures the
  admitted actor once, preserves existing captures on edits, retains unresolved
  historical IDs, and keeps named/avatar mention resources as historical source
  labels. Standalone dependency publication/lockfile closure remains open.
- Native provenance now has a combined public-binding witness: an actual
  accepted-event route links a seeded immutable receipt, then an admitted tool
  route reads the exact operation history and tool-call correlation. This does
  not yet exercise native acceptance of that receipt. Pending-thread admission
  is being integrated into the existing atomic dispatch/provisioning path.
- Actual Notifications/ntfy installation exposed SDK 0.4.16's tool-presentation
  rename, missed by leaf checks against installed 0.4.15 declarations. Preserve
  labels while closing this compatibility boundary before claiming composed
  request-route acceptance.
- Target SDK disposition is now explicit: the affected tool consumers compile
  against pinned published SDK 0.4.47 declarations and build through published
  bb-app 0.42.0, with engine floor 0.4.47. Other consumers retain their previous
  target. No ignored candidate declaration becomes an ordinary build dependency,
  and an ambient normal-host BB_CLI cannot override the explicit target build.
- Actual Notifications/ntfy composition now passes candidate PluginService:
  public person forwarding, current profile, route registration and credential
  claims/rejection. The modern tool labels are retained. The real sealed Thread
  Progress artifact also installs/runs and serves exact app bytes on a listening,
  SDK-bound loopback test host. Live and two-host proof remain separate.
- Organization workspace tests, typecheck and build pass after the SDK target
  changes. A pre-existing Bun-only Thread Manager test was incorrectly selected
  by Node; its generated command now routes it to Bun without changing the test.
  Full identity browser acceptance remains green. Community typecheck/build pass;
  a loaded-run analytics serialization threshold failed, then passed unchanged
  in isolation. The full community test rerun also passes unchanged.
- `./bin/check --role staging` passes with expected authored-dirty warnings for
  fork, organization plugins and community plugins. No commits, gitlinks, live
  plugin activation or normal-host state were changed by these checks.
- Final review extended the external-operation cases: Slack now has 156 passing
  tests for first-send/unsupported lookup, concurrent reservation, final replay,
  changed input, and restart uncertainty. Agent Connect's fingerprint and stored
  input decoding required corrections; those remain owned work rather than being
  hidden by prior green leaf suites. Native queued acceptance must remain pending
  through drain, never report final rejection while a queued row can still run.
- Proof profile v1 remains supported for the existing P/F-only runtime; v2 adds
  the sealed app explicitly. A read-only stopped-unit drain command now refuses
  active proof, enabled Thread Progress, environment-backed visible threads, or
  any notification/summary/sticker queue. It has refusal tests and has not been
  invoked against the active proof runtime.

### Disabled stage verification (2026-09-06)

The actual assembled Thread Progress artifact passes both managed installation
and disabled managed staging in an isolated candidate test host. Staging retains
the expected npm root/integrity/settings, leaves the factory unloaded and creates
no feature data.db. The normal install witness still starts and serves the exact
app bytes. Existing-registration refusal is under follow-up review. Offline
launcher composition and stopped live-proof execution are not yet established.
Proof script tests pass 13/13, including artifact output verification, source
mutation refusal and active-unit/queue drain refusal. No live profile changed.

Organization-wide typecheck and all plugin test suites pass again after the
Agent Connect corrections (54 leaf tests). Sealed packing now verifies its
receipt-backed inputs before and after npm pack, disables pack lifecycle scripts,
and refuses directory symlinks. The focused packing suite passes. These checks
do not close native queued acceptance or live staging.

Native queued acceptance now passes candidate typecheck and focused native/public
suites. Wait/restart/requeue preserves one durable pending operation, drain
promotes that exact reservation, and explicit deletion terminally cancels it.
The next host parity lane is native facets and batch execution: candidate absence
breaks Thread Manager dashboard entry, so it must be implemented before claiming
feature preservation. Ordinary Thread Progress controls remain available.

The review tarball `/tmp/bb-identity-release-review/phosphorco-bb-identity-0.1.0.tgz`
passes `npm publish --dry-run --ignore-scripts --access public`. Its SHA-256 is
`23ed381a5723765d9924f787fc20764d6edde6903967c6c7b94f7c44fc4f9849`.
No registry publication occurred; community standalone manifest/lockfile closure
remains a release gate. The tarball must be regenerated if package inputs change.

Offline managed staging passes all nine checks with the real artifact and temp
SQLite/loopback registry, including pre-existing registration refusal, settings
readback, environment restoration and a failed final fence. A partial receipt is
written immediately after disabled registration, before byte/settings readback,
so every later failure carries explicit retained-disabled recovery. No live
fixture profile, unit or installed plugin was changed.

## Selected kernel reconstruction checkpoint

A non-runtime source verification archive based on the exact tree of
`960255b98ce3dccdcb5754eb67a7f989236602a1` now composes the provider kernel,
required plugin acceptance/history, canonical sidecar initialization, queue
finality, and the retained participant DB projection. It excludes the new
ordinary native writer, native HTTP/WS/status/UI, and provider-input transport.
The dirty candidate and normal runtime remain unchanged by reconstruction.

Checked in that selection: 11 acceptance/startup tests; 34 provider, invocation,
protocol and sidecar tests; 27 native event/tool tests with the exact reviewed
package archive and no skips. The public correlation witness uses a seeded
receipt and does not replace the separate native acceptance witness. Final
server/config/plugin-SDK/DB source and test typecheck passes after the
test-extraction corrections.

This is not a full-host release: independent fork features remain separately
accounted for, the selected patch is not yet installed into the canonical fork
queue, and neither live promotion nor package publication has occurred.
Reconstruction exposed missing startup migration and native correlation hooks,
which were restored before claiming behavior. Green candidate tests were not
used as substitutes for selected-composition tests.

Reproducibility follow-up: the composed patch SHA-256
`f228d7e346a72fc31547d9b99472b6792384f520101dff8c3c3caf43dcaf84da`
was applied to a fresh temporary Git index from exact base tree
`0be12b66bc1d0da0e6e4efa854cacd51b80c82d6`. Its resulting tree
`91c25b9d8c78510d5bbdecfd4611daa832f05097` equals the tested selected
index. This proves source-patch replay, not a second runtime test or full-host
release. Receipt and patch remain in the reconstruction thread-storage directory.

The idle reminder created before scope refinement is historical task context.
On reminder delivery, follow the current closeout priority above; do not resume
deferred native presence/UI/provider formatting merely because that older
reminder lists them.

## Independent package release approval

Cole authorized publication after independent Codex Astra High approval.
Reviewer `thr_m3jtsjtmcx` approved only archive SHA-256
`9f79f473ffb6e4c16db7bd25cc29be66cd8ab8dacc1f5b0980c113cca75ac48c`,
including independent byte-identical rebuilds, installed public export probes,
139 Bun + 3 Node tests, and React/SDK compatibility checks. Review receipt:
`/home/ubuntu/.bb/thread-storage/thr_m3jtsjtmcx/release-approval-bb-identity-0.1.0.md`.

The earlier exact-archive publication attempt failed with npm `ENEEDAUTH`;
no publication occurred. Cole subsequently deferred publication until tomorrow,
along with the community exact dependency, registry-backed lockfile and cold
install. Do not publish today. The approval remains tied only to the unchanged
reviewed archive; the newer source manifest requires a fresh artifact review.
After the deferred release is resumed, verify registry bytes/integrity before
generating the dependent community lockfile. Core promotion remains
outside this package approval. SDK declaration consumers need the SDK's type
prerequisites; community server execution needs the host SDK alias. Temporary
archive probes do not prove standalone community or live-host installation.
