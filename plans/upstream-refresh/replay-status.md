# Upstream refresh replay status

Target: `78804e79d280998a3b4c3c965ec1b5845703bc0e`.

The exact preimage is retained in `preimage-2026-09-22/`, including the full
patch queue, checksums, current locks, and downstream narrative. The replay is
an isolated authoring worktree at `/tmp/bb-upstream-refresh.84BJxg/bb`; it is
not a runtime source.

## Current ordered replay

| Patch | Disposition | Evidence / required follow-up |
| --- | --- | --- |
| 0001 identity kernel | Applied after semantic merge | Target evolved plugin tool streaming, dispatch admission, and provisioning. The replay retained target plugin round-trip cancellation and admission behavior while retaining P6r correlation, provider types, sidecars, and public SDK export. Focused typecheck/tests remain required. |
| 0002 identity facets and execution | Applied after semantic merge | Target thread-facet/execution-preflight and lifecycle-deduper implementations supersede the conflicting older variants. Non-overlapping P6r execution/facet additions remain. This requires focused behavior verification, not a claim of upstream equivalence for the custom protocol. |
| 0003 consumer witnesses | Applied cleanly | Target accepted the preserved compatibility witnesses without a source conflict. |
| 0004 verified mention targets | Conflicted | Target protocol/SDK changes overlap P6r mention targets in plugin service, dispatch, SDK backend contract, API audit, and SDK map. Preserve the bounded verified mention contract and reconcile every target public-surface change. |
| 0005 sidecar migration build | Applied after target-native merge | Target core journal already owns migrations `0119`–`0130`, so its journal remains authoritative. The P6R sidecar migration build/copy path and witness remain; target `zod` runtime build remains included. |
| 0006 plugin presentation compatibility | Conflicted | Target adds overlapping plugin route/presentation context behavior in plugin API and service. Merge must retain the P6R presentation contract and target lifecycle behavior. |
| 0007–0024 | Applied, with target-native conflict merges | The replay preserves target sidebar, queue lifecycle, SDK `0.5.9`, CORS health handling, and modal behavior while retaining the downstream sidebar, P6R, provider-phase, and Tailnet additions. The broad 0015 attribution merge requires focused typecheck and migration review. |
| 0027 editor thread-storage host routing | Drop as upstream-equivalent | `283e6d7` is an ancestor of the target (`merge-base --is-ancestor` exited `0`) and reverse application of this exact patch on the replay candidate passed (`git apply --check -R` exited `0`). The target contains the upstream PR as `fa3e09043236f88e5c50ae2a875f3bdffa380573`. |
| 0025–0026 | Applied after target-native merge | Context Magnet contributions and provider admission remain required compatibility ports; target has no equivalent contribution API. Their schema now enters through the target-native `0131` bridge rather than by retaining an out-of-order downstream journal. |
| 0028 versioned lazy frontend artifacts | Retain semantics; rewrite/rebase | Target still uses artifact format v1 and plain `dist/app.js` reads. Upstream `a5a81ce` shrinks bundled plugin artifacts but has no immutable generation manifest, per-chunk hash validation, retention, or expired-generation recovery. Preserve that upstream groundwork and rebase the downstream v2 design without reintroducing bundle bloat. |

## Replay verification, 2026-09-22

The disposable replay has clean Git whitespace and no unresolved conflict
markers after all logical patches except upstream-equivalent 0027. A frozen
`pnpm@9.15.0` install completed in the replay worktree. The bounded
`turbo run typecheck --concurrency=2 --filter=@bb/plugin-build
--filter=@get-bb/plugin-sdk --filter=@bb/server` check passes for plugin build
and SDK but still fails for server. The first run found a P6R dispatch syntax
error; it was repaired locally and a second run reduced the failure set.

The remaining errors establish that this is not a valid lock/receipt candidate:

- 0002 retained call sites for a missing DB event helper and does not yet map
  the target thread-facet identity-kind schema.
- 0015 needs its queued/retry test witnesses and producer rendering transport
  rewritten to target interfaces, rather than retained as a source-level
  helper.
- Context Magnet needs target-era migrations after upstream `0119`–`0130`,
  then cold and upgrade checks against disposable databases. Historical
  `0120`–`0122` snapshots were intentionally not overwritten.
- The lazy-artifact patch is replayed but requires its focused manifest,
  traversal, generation-expiry, and emitted-graph tests after the server is
  type-correct.

No durable queue, lock, result-tree receipt, materialization, runtime, or live
database was changed while these checks are failing.

## Migration bridge repair, 2026-09-22

The target `0119`–`0130` journal and snapshots were restored as the canonical
prefix in the disposable replay. Running the target generator then produced
`0131_zippy_reavers` and its generated snapshot from the combined current
schema. The previous out-of-order downstream `0120`–`0122` journal/snapshot
chain is not retained. The rejected `0123_mute_infant_terrible` SQL remains
only in the replay-local `generator-evidence/` directory.

The deployed old-fork timeline is forward compatible without rewriting its
ledger rows. Its preserved `0119_soft_pandemic`, `0120_early_virginia_dare`,
`0121_sticky_king_bedlam`, and `0122_living_quasimodo` timestamps remain extra
applied history. Since the last of those timestamps falls after target
`0127_thread_image_metadata`, a pre-Drizzle bridge explicitly applies and
records only missing target migrations from `0119_provider_model_catalogs`
through `0127_thread_image_metadata` when that legacy history would otherwise
make Drizzle skip them. Normal clean target databases do not enter this bridge.

`0131` creates its tables and indexes idempotently. A post-Drizzle bridge adds
only missing P6R and Context Magnet columns, validates the required tables,
all named indexes and declared foreign-key actions plus a canonical generated
0131 table contract (every feature-table column name/order/type/null/default
and composite primary-key order). Only the two documented old-fork append
orders for receipt/snapshot bridge columns are permitted; all other shape
drift fails closed. The bridge runs `foreign_key_check`, and
records `identity-context-0131` in `bb_schema_bridge_completions` only within
the same SQLite transaction. A Drizzle `0131` row by itself is deliberately
not completion: `migrate()` will fail closed until the bridge validates and
records completion. It does not delete, rebuild, truncate, or overwrite
tables, rows, or old ledger entries. The resulting schema admits the existing
`machine` principal identity kind.

The replay DB migration tests now include disposable cases for:

- Clean target initialization through target `0131`.
- A target-common base with the four exact preserved old-fork migration SQL
  fixtures and their historical ledger timestamps. It retains a machine facet
  profile and Context Magnet trace, receipt, snapshot, and provider-admission
  rows across upgrade and a repeat migration.
- Each supported ordered legacy prefix, holes, unknown old hashes, later
  target rows with wrong hashes, unrelated future rows, absent legacy schema,
  and a same-named wrong index. These states abort rather than being guessed.
- Fresh-process recovery after a forced failure after the Drizzle batch, during
  a guarded column add, and after validation before bridge completion. The
  retry must record the durable bridge completion before it succeeds.

After the completion-protocol changes, `corepack pnpm exec turbo run typecheck
--filter=@bb/db` passed and `corepack pnpm exec turbo run test --filter=@bb/db
-- test/migrate.test.ts` passed 79 migration tests. The focused suite now also
forces target `0123`'s non-idempotent settings move to fail on a unique
conflict, proves its ledger/table/source rows roll back, then closes/reopens and
retries after repair. The previously reported
611-test full DB result predates this review remediation. A fresh bounded
`corepack pnpm exec turbo run test --concurrency=1 --filter=@bb/db` run after
the full contract changes passed 631 tests in 46 files. The full DB suite had exposed a
stale event barrel export and a target test that sent a server-only client
request through the daemon path; both were reconciled in the replay.

This is an upgrade-only bridge. It provides no in-place downgrade path. The
current focused contract intentionally fails closed for unknown legacy ledger
or schema combinations; the remaining acceptance work is data-conservation and
fault coverage for the remaining manually replayed target `0119`--`0127`
migrations, plus the remaining P6R behavioral acceptance gate.

### Manual target-migration evidence adjudication, 2026-09-22

The parent accepted a risk-driven evidence boundary for the manually replayed
target migrations `0119`--`0127`. Apart from `0123`, those migrations only add
tables, nullable columns, indexes, or constraints; their relevant evidence is
the per-migration transaction plus ledger marker, final schema/FK validation,
and the clean/legacy upgrade fixtures. `0123` is the sole data-transforming
step (copying then deleting machine-environment settings), and has an explicit
unique-conflict rollback, close/reopen, retry, source/destination-count, and
value-preservation witness. This adjudication removes the request for
representative-row fixtures for every merely adjacent pre-existing table. It
does **not** establish universal data-conservation, live-database behavior,
backup/restore coverage, or an in-place downgrade path; upgrades remain
backup-first and upgrade-only.

### Partial full-test inventory, 2026-09-22

At replay `ecd4538d3` (target `78804e79`, Node `22.19.0`, pnpm `9.15.0`), the
following command was started from the disposable replay root:

```
corepack pnpm exec turbo run test --concurrency=1 --continue=always
```

Its temporary complete output was retained at
`/tmp/bb-upstream-refresh.84BJxg/full-test-inventory-after-contract.log`.
The job ended after 21m33s with the scheduler close reason `daemon-disconnect`,
not a confirmed timeout, cancellation, reboot, or OOM; therefore this is a
partial inventory, not a complete graph result.

Completed passing packages included DB (631 tests), host-daemon-contract (61),
browser automation (77), and plugin SDK (353). Reached failures included:

- provider-bridge-acp: 16 failures and one unhandled `spawn ... EAGAIN`
  (`errno -11`) while starting fake Node ACP workers. This also caused fake
  CLI-model fallback, MCP closure, and conformance failures; isolated replay
  and exact-target frozen package runs each passed 325/325.
- provider-parity: 38 recorded replay failures after the same ACP process
  exhaustion.
- server-contract: the optional-field allowlist is missing six replayed P6R
  output fields (`p6rAuthors`, `p6rEditors`, `p6rAuthor`, `p6rEditor` across
  queued/timeline schemas), 1/79.
- bb-app: 11 config-persistence tests timed out at five seconds; that lane is
  separately diagnosed as an environment/harness issue.
- plugin-build: five builtin-host-artifact tests failed after esbuild reported
  OS-thread creation `errno=11`, followed by worker-termination timeouts.

No failed assertion was skipped or weakened. This inventory cannot waive any
candidate gate; it records the next scoped diagnoses only.

No upstream lock or result-tree lock has been changed. Analytics remains
disabled and no runtime, deployment checkout, reload, migration, commit, or
publication has occurred.

### Capped process-heavy verification, 2026-09-22

At replay `15af1b4d9e6ff48d336daa938f0a9b6d90620ed9`, a new Turbo dry-run
inventory recorded 100 `#test` tasks in the disposable replay. Its JSON and
sorted task list are retained at
`/tmp/bb-upstream-refresh.84BJxg/test-inventory-15af1b4d9.json` and
`/tmp/bb-upstream-refresh.84BJxg/test-task-ids-15af1b4d9.txt`. The three
process-heavy tasks are `@bb/plugin-build`, `@bb/provider-bridge-acp`, and
`@bb/provider-parity`; the intended remaining graph excludes only those
three tasks.

The one-worker ACP probe canary passed 4/4:

```
corepack pnpm --dir packages/provider-bridge-acp exec vitest run \
  --config vitest.config.ts src/probe.test.ts --maxWorkers=1 \
  --maxConcurrency=1 --no-file-parallelism
```

The full capped plugin-build suite passed 13 files, 147 tests, with one
existing skipped test under the same Vitest caps. Its log is
`/tmp/bb-upstream-refresh.84BJxg/test-plugin-build-capped-15af1b4d9.log`.

The full capped ACP suite is still a failing diagnostic gate: 324/325 tests
passed, while `bridge.recorded-conformance.test.ts` reached its pre-existing
240-second timeout after a child provider bridge's esbuild process reported
Go OS-thread creation failure and the bridge service stopped. Its command was
the approved one-worker, one-concurrency, no-file-parallelism Vitest command;
its log is
`/tmp/bb-upstream-refresh.84BJxg/test-provider-bridge-acp-capped-15af1b4d9.log`.
No timeout, assertion, host limit, product source, lock, or runtime behavior
was changed in response. Provider parity and the 97-task remainder have not
yet run; the failed capped ACP gate requires diagnosis first.

The ACP harness diagnosis found that Vitest's worker caps do not constrain the
recorded-conformance harness's internal `Promise.all`: it starts eight eligible
ACP recorded cells concurrently, and every TypeScript bridge child imports
`tsx`, which starts its own Go esbuild service. The launcher copies
`process.env` into each child. An independent read-only review confirmed that
`GOMAXPROCS=1` therefore reaches each Go esbuild process; it caps Go scheduling
but does not cap child-process count or change any replay input, assertion, or
deadline. The replay cgroup at observation had `pids.current=896`,
`pids.peak=1791`, `pids.max=69847`, no pids-max events, and no memory OOM
events.

With parent approval, one full ACP rerun used that command-scoped environment
plus the existing Vitest caps. It passed all 18 files and 325 tests in 37.42
seconds; recorded conformance itself passed in 13.448 seconds and the log has
no Go OS-thread or `EAGAIN` error. The exact log is
`/tmp/bb-upstream-refresh.84BJxg/test-provider-bridge-acp-gomaxprocs1-15af1b4d9.log`.
No source, global environment, host limit, timeout, assertion, fixture, lock,
or runtime changed.

The subsequent capped provider-parity run, with the same command-scoped Go
cap, has no process-exhaustion error but is a real semantic failure: 41/56
tests pass and 15 Codex recordings fail in `src/parity.self.test.ts`. Across
the reported examples, current replay emits `agentMessage` events with
`phase: "final_answer"` while the recording lacks that field. The exact log is
`/tmp/bb-upstream-refresh.84BJxg/test-provider-parity-gomaxprocs1-15af1b4d9.log`.
The remaining graph is deliberately still unscheduled pending source-level
diagnosis; no assertion was relaxed or recording regenerated.

### Codex phase fixture repair and parity receipt, 2026-09-22

The semantic parity failure was traced to replay commit `be17466e2`, which
removed `agentMessage.phase` from precisely the 15 Codex
`bridge→runtime.current.ndjson` lanes while the accepted phase producer and
consumer contract remained present. The phase contract distinguishes
intermediate commentary from final answers; removing it would weaken the
accepted provider contract rather than reconcile the recording.

Using clean pre-conflict reference `fece0d5c047e32879d5af279dc1dafda4b672905`,
the replay-only fixup `02020cdb16610da1baf732ce95b2b43c1a0529bd`
(`fixup! feat(provider-codex): preserve agent message phase`) restores only
72 `agentMessage.phase` values in those 15 paths. A semantic NDJSON validator
matched every event identity and proved that recursively removing `phase` from
each repaired record makes it structurally identical to its pre-repair form.
It rejected ambiguous alignment; `git diff --check` and conflict-marker scans
were clean. Independent read-only review confirmed the 15 paths, all 72 values,
and exact reference provenance. The evidence report is
`/tmp/bb-upstream-refresh.84BJxg/codex-phase-fixture-repair-15af1b4d9.json`.
No comparator or producer changed. The commit was created with explicit
path-only selection; the pre-existing migration index/worktree state was
preserved and is not part of this fixup.

At `02020cdb1`, the unchanged full provider-parity command with
`GOMAXPROCS=1`, `--maxWorkers=1`, `--maxConcurrency=1`, and
`--no-file-parallelism` passed 56/56 in 197.10 seconds. Its durable log is
`/tmp/bb-upstream-refresh.84BJxg/test-provider-parity-phase-restored-gomaxprocs1-02020cdb1.log`.
The command preserves the original 56-case recording corpus, setup, assertions,
and deadlines; the scoped Go cap is only the previously-reviewed esbuild
scheduling containment. The remaining 97-task graph is now running separately
with `--continue=always --concurrency=1`; it has not yet been counted as a pass.

### Sequential remainder inventory interruption, 2026-09-22

At the same replay commit, the intended 97-task remainder command used
`GOMAXPROCS=1`, `--continue=always`, and Turbo `--concurrency=1`, excluding
only plugin-build, provider-bridge-acp, and provider-parity. It stopped after
7m28s without a Turbo footer or durable scheduler/daemon cause, while a
workflow plugin task was still printing successful test output. This is an
incomplete failure inventory, not a completed remainder run. The durable log is
`/tmp/bb-upstream-refresh.84BJxg/test-remainder-gomaxprocs1-02020cdb1.log`.

Observed failures remain open: CLI tests have five artifact-v2 expectation
drifts plus resource-caused Vitest worker `EAGAIN`; Claude Code recorded
conformance reached its unchanged 240-second deadline after child esbuild
`EAGAIN`; desktop native/AppImage checks lack host GUI-library prerequisites;
and the external template fixture could not resolve the registry version of
`@hugeicons/core-free-icons`. No assertion, timeout, or fixture was weakened,
and no repair or rerun was started pending scoped triage.

The job-inspection API was unavailable to this child after completion, and the
durable log has no Turbo footer or terminal scheduler diagnostic, so the
interruption cause remains unknown. Of the 100 dry-run `#test` tasks, 68 were
reached: `@bb/cli`, `@bb/client-core`, `@bb/config`, `@bb/connect`,
`@bb/connect-client`, `@bb/connect-db`, `@bb/core-ui`, `@bb/db`,
`@bb/demo-server`, `@bb/desktop`, `@bb/desktop-contract`, `@bb/domain`,
`@bb/fuzzy-match`, `@bb/hono-typed-routes`, `@bb/host-daemon-contract`,
`@bb/host-watcher`, `@bb/host-workspace`, `@bb/local-open-targets`,
`@bb/logger`, `@bb/mobile`, `@bb/mobile-bridge`, `@bb/plugin-api-map`,
`@bb/plugin-interaction-contracts`, `@bb/plugin-registry`,
`@bb/process-utils`, `@bb/provider-bridge-protocol`, `@bb/qa`, `@bb/sdk`,
`@bb/secret-storage`, `@bb/server-archive`, `@bb/server-contract`,
`@bb/templates`, `@bb/test-helpers`, `@bb/text-utils`, `@bb/thread-view`,
`@bb/tunnel-client`, `@bb/tunnel-contract`, `@bb/web`, `@get-bb/plugin-sdk`,
`bb-app`, `bb-plugin-ask-user-question`, `bb-plugin-bb-guide`,
`bb-plugin-browser-automation`, `bb-plugin-concurrency-limit`,
`bb-plugin-connect`, `bb-plugin-custom-instructions`, `bb-plugin-drafts`,
`bb-plugin-echo-provider`, `bb-plugin-environment-git-worktree`,
`bb-plugin-environment-project-checkout`, `bb-plugin-github`,
`bb-plugin-inline-vis`, `bb-plugin-keep-awake`, `bb-plugin-monaco-editor`,
`bb-plugin-pdf-preview`, `bb-plugin-plugin-api-tester`,
`bb-plugin-provider-acp`, `bb-plugin-provider-claude-code`,
`bb-plugin-provider-codex`, `bb-plugin-provider-usage`,
`bb-plugin-push-notifications`, `bb-plugin-scripted-echo-provider`,
`bb-plugin-simple-notes`, `bb-plugin-slack-bot`, `bb-plugin-tasks`,
`bb-plugin-theme-preview`, `bb-plugin-thread-list`, and
`bb-plugin-workflows`.

The 32 unrun tasks are `@bb/agent-runtime`, `@bb/app`, `@bb/bundled-plugins`,
`@bb/host-daemon`, `@bb/integration-tests`, `@bb/plugin-build`,
`@bb/provider-bridge-acp`, `@bb/provider-parity`, `@bb/scripts`, `@bb/server`,
`@bb/shared-ui`, `@bb/tsconfig`, `bb-environment-provider-host`,
`bb-plugin-account-pool`, `bb-plugin-agent-annotations`,
`bb-plugin-agent-enrichment`, `bb-plugin-automations`,
`bb-plugin-composer-customization`, `bb-plugin-content-script-example`,
`bb-plugin-environment-modal-sandbox`, `bb-plugin-environment-personal-workspace`,
`bb-plugin-memory`, `bb-plugin-plugin-api-docs`, `bb-plugin-provider-pi`,
`bb-plugin-provider-retry`, `bb-plugin-replacement-lab-alpha`,
`bb-plugin-replacement-lab-beta`, `bb-plugin-scheduled-send`,
`bb-plugin-secrets`, `bb-plugin-side-chat`, `bb-plugin-sidebar-navigation`, and
`bb-plugin-thread-chat-demo`. The three process-heavy tasks intentionally
excluded from this remainder are included in that unrun list but have separate
passing receipts; plugin-build has its separate passing receipt with one
existing skip.

### CLI artifact-v2 triage, 2026-09-22

Read-only comparison confirms that target `78804e79` and the replay's
`apps/cli/src/__tests__/plugin-build.test.ts` are identical. The retained
artifact-v2 commit changes `buildPluginApp` from direct `dist/app.js`/`app.css`
output to a generation-addressed `.bb-artifacts/<generation>` manifest with
`artifactFormatVersion: 2`, hashed files, splitting, and required esbuild
metafile output, but it did not update this CLI consumer test. The five CLI
failures therefore split into four stale test expectations (metadata, root
directory contents, returned entry path, and the obsolete no-metafile stub)
and one resource-sensitive registry warning assertion.

The proposed repair is intentionally test-only in
`apps/cli/src/__tests__/plugin-build.test.ts`: assert stable v2 manifest and
returned-generation invariants rather than random hashes/generation values;
assert that a failed rebuild preserves the published manifest and old
generation; and make the scaffold toolchain stub require the now-contractual
`metafile: true` while delegating to real esbuild. Existing lower-level
plugin-build tests already exercise chunk separation, no legacy root entry,
full manifest behavior, and three-generation retention.

The registry-warning assertion in `plugin-new.test.ts` must remain strict. Its
fake npm defaults to a published SDK response, while command code correctly
maps an actual child-process failure to the conservative `unknown` warning.
The observed warning coincides with seven Node `EAGAIN` Vitest fork failures,
so it is not evidence that the expected user-facing warning contract changed.

The approved test-only repair is replay commit
`f5ab9d1899378b258aeae64cf369248b0e9c34f4`
(`fixup! feat(plugins): serve versioned lazy frontend artifacts`) and contains
only `apps/cli/src/__tests__/plugin-build.test.ts`. It verifies v2 metadata,
generation confinement, emitted-file sizes/content types/SHA-256 values, the
absence of legacy root entries, old-generation byte preservation after a real
failed rebuild, and required metafile pass-through. The scaffold assertion now
verifies emitted browser-served generation chunks and their public URL; a Node
`file:` import cannot resolve a correct `/api/.../assets/g/.../chunks/...`
browser URL. This preserves the end-to-end build test without simulating a
different runtime. The capped focused command passed 10/10 in 1.02 seconds;
log: `/tmp/bb-upstream-refresh.84BJxg/test-cli-plugin-build-v2-02020cdb1.log`.

### Bounded first-party replay harness, 2026-09-22

Replay commit `cb327e20d14f31eb8d86507928c39b05c77501e2`
(`fix(provider-bridge-protocol): bound first-party recorded replays`) contains
only the three provider-bridge-protocol testing paths. The public internal
replay helper keeps its prior unbounded `Promise.all` behavior when the new
optional limit is omitted, rejects non-positive/non-integral limits, and uses
source-indexed results when a limit is supplied. The first-party conformance
caller alone opts into cap one, retaining the 60-second per-cell and
240-second suite deadlines. Tests prove capped peak, exact-once starts,
deterministic result order, omitted-option unbounded behavior, invalid-limit
rejection, and no new cell claim after a replay failure.

Focused parity tests passed 5/5 and protocol typecheck passed. The full capped
provider-bridge-protocol suite passed 21 files / 290 tests in 9.72 seconds;
log: `/tmp/bb-upstream-refresh.84BJxg/test-provider-bridge-protocol-full-capped-c227c9cb6.log`.
The change requires re-verification of first-party provider conformance suites
before candidate acceptance.

### Corrected candidate receipt, 2026-09-23

The final replay candidate is commit
`c9b533cce8e3eecfe4f48a8c63ee7c779dea4c94`, with Git tree
`4f309f5652aa29a17ff671f889dab10723375933`, in the disposable authoring
worktree `/tmp/bb-upstream-refresh.84BJxg/bb`. The worktree and index were
clean immediately before this receipt. It adds the scoped Context Magnet Codex
repair only: raw app-server error bodies are reduced at receipt time to a
finite, method-bound kind; recovery is projected only from a retained session
identity during a rebuild; ordinary archived-looking starts stay generic and
contain neither recovery data nor provider error text. The path-only commit
contains eight Codex bridge/test files and no recordings, fixtures, comparator,
or SDK generated output.

Focused proof passed: 9 files / 56 tests in 27.58 seconds
(`/tmp/bb-upstream-refresh.84BJxg/codex-remote-semantics-focused.log`) and
the provider-Codex typecheck passed
(`/tmp/bb-upstream-refresh.84BJxg/codex-remote-semantics-typecheck.log`).
The authoritative full Codex inventory is split by the shared-worker test
configuration: explicit isolated project 18 files / 97 tests passed in 27.98
seconds (`job-mudd7csm-b6cd8155`) and explicit shared project 14 files / 236
tests passed in 35.54 seconds (`job-mudd8625-2f4fd074`). Their union is 32
files / 333 tests. An earlier opaque Turbo footer reporting 16 files / 267
tests is explicitly not used as full-suite evidence.

At this receipt, retained candidate gates also passed: DB 46 files / 631
tests (`/tmp/bb-upstream-refresh.84BJxg/test-db-final-4b7c3221b.log`),
server/daemon/CLI typechecks (`/tmp/bb-upstream-refresh.84BJxg/typecheck-server-daemon-cli-final-4b7c3221b.log`),
P6R server attribution/queue/SDK focus 3 files / 34 tests
(`job-mudd0etc-c8104344`), and artifact-v2 CLI focus 1 file / 10 tests
(`job-mudd997r-9ca0f6b0`). No result/upstream locks, runtime materialization,
restart, or Analytics activation was performed. SDK generation and approved
direct-plugin artifact integration are downstream of this source receipt.

### Proposed logical export proof, 2026-09-23

The source candidate was folded in the disposable export worktree
`/tmp/bb-upstream-export.EHtjw1/bb` without changing its verified tree. The
logical export head is `e7c4c62cf5cdeee348106b62d9ebbc98705de2bf`, whose tree
is exactly `4f309f5652aa29a17ff671f889dab10723375933`.

The proposed series is in
`/tmp/bb-upstream-export.EHtjw1/patches-proposed`. It has 31 numbered patches,
31 matching SHA-256 entries, and 31 patch files. `sha256sum -c sha256` passed.
The intentionally absent numbers are 0022 (the pre-existing historical gap)
and 0027 (the only approved exact-upstream drop). The migration bridge is its
own final compatibility patch (0033); provider replay bounding and templates
test-infrastructure changes remain separate patches (0031, 0030/0032).

The series was replayed from target
`78804e79d280998a3b4c3c965ec1b5845703bc0e` in the second disposable worktree
`/tmp/bb-upstream-export-replay.6MymIa/bb`. Its resulting head is
`a5fce7186af90c00a4bef3ea74e85b418851ef05`, with the same candidate tree.
The replay contains 31 commits, has a clean worktree, passes `git diff --check`,
and the source scan found no conflict-marker lines outside NDJSON recordings.
No durable queue files, locks, pins, upstream gitlink, runtime materialization,
or service state were changed by this proof.

Runtime qualification remains deliberately separate: Context Magnet's direct
plugin typecheck passed, but its existing full suite still has one external
Codex router launcher-generation digest mismatch. That reader qualification is
unverified; it is not an SDK, source-replay, or migration claim and was not
silenced or regenerated.
