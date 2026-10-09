# Downstream patch contract

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


## Patch queue

1. **Selected identity kernel** establishes the reviewed provider, authorship,
   admission, history, and native-event foundation on the current upstream.
2. **Retained facets and execution** composes the still-required Thread Facet,
   execution, sidebar, appearance, recovery, and provider behavior.
3. **Consumer compatibility witnesses** pins the plugin and host-facing seams.
4. **Verified mention targets** adds authenticated mention recipients without
   conflating recipients and authors.
5. **Built sidecar migrations** includes the generated P6R migration payloads.
6. **Plugin presentation compatibility** preserves the existing plugin-facing
   identity presentation contracts.
7. **Sidebar participants and guidance** integrates participant presentation
   with the current sidebar behavior.
8. **Execution cache invalidation** rejects stale execution projections.
9. **Transport error mapping** retains HTTP/RPC error compatibility. Its former
    person-only admission gate is removed by consolidated patch 15.
10. **Active external queues** preserves queued Agent Connect work across the
    reviewed identity boundary.
11. **Pending call history** retains exact operation history until turn linkage
    is complete.
12. **Pkl highlighting** adds shared Markdown and Monaco syntax coloring.
13. **Migration-fixture rewind** keeps upstream replay tests valid after the
    downstream identity migrations.
14. **Integration determinism** updates renamed mention seams and canonicalizes
    Git timestamps in downstream witnesses.
15. **Best-effort native attribution** consolidates the former native identity patches.
    It supplies stable machine fallback, retains original authors and later
    editors, presents identity in settings/timeline/CLI, and emits only minimal
    sender wrappers. It removes signed browser lineage and native person-gate
    validation plumbing. Provider enrichment remains bounded; durable history,
    receipts, queue/retry semantics and independent access controls remain.

16. **Tailnet provider auto-selection** chooses the installed Tailnet identity
    provider when the configured Serve-owned host matches, while preserving
    explicit boundary configuration and machine fallback.
17. **ACP native-root isolation** keeps provider tests independent of the
    caller's workspace roots.
18. **Sidebar layout provider** adds the native layout-provider seam while
    retaining plugin sidebar composition, native behavior, and the generic
    Plugins/Skills resource helper.
19. **Codex agent-message phase** preserves optional provider-declared phase
    through bridge and durable event contracts without inferring finality.
20. **Workflow-shell isolation** keeps shell tests independent of ambient loaded
    state.
21. **Path-browser cleanup** makes virtualized test teardown deterministic.
23. **Plugin-route external CORS delegation** lets plugin routes provide their
    own foreign-origin preflight and response headers without granting that
    access through the core browser-CORS middleware.
24. **Modal Tailnet workload identity** lets Modal sandboxes exchange scoped
    OIDC tokens for preauthorized ephemeral Tailscale nodes and routes their
    TCP workloads through the userspace network stack.
25. **Context Magnet contribution trace API** retains only explicit, bounded
    host-supplied contribution evidence, with immutable pagination boundaries,
    redactions, and model-owned receipt-tool consumption evidence. Its Node and
    plugin-wrapped SDK paths send bounded decimal page limits through the same
    validated public transport.
26. **Context Magnet provider admission** retains host-created attempt IDs and
    append-only constructed, accepted, or failed-settlement observations without
    treating provider admission as model consumption. Provider acceptance is
    checkpointed only after a validated non-empty provider ID: JSON-RPC
    rejection, malformed response, and unavailable bridge settlement remain
    bounded, while later local bookkeeping cannot contradict an acceptance.
28. **Versioned lazy frontend artifacts** emit manifest-listed, content-hashed
    JavaScript and CSS chunks in immutable generations. The server validates
    every path and file hash, keeps a bounded in-memory generation history for
    reload races, and reports an expired generation instead of mixing chunks.
29. **Bounded optional config reload** limits best-effort launcher config reload
    waits while preserving required-refresh failures and existing no-server
    fallback behavior.
30. **Template registry metadata** makes the external scaffold contract request
    current public registry metadata without changing declared versions,
    lockfiles, or install-save behavior.
31. **Bounded first-party conformance replay** limits only the first-party
    recorded-replay caller, retaining default helper behavior, all recorded
    cells, per-cell deadlines, and deterministic result order.
32. **Template pack diagnostics** retain bounded, sanitized child-process
    receipts for the separately unresolved scaffold-pack infrastructure failure.
33. **Legacy identity and Context Magnet migration bridge** admits only exact
    supported historical ledger/schema prefixes, validates the complete target
    structural contract, and commits bridge schema plus completion state
    atomically before normal service use.
34. **Owned Tailnet listener with machine fallback** provides a dedicated
    loopback listener for the host's Serve route. Verified people retain their
    identities; requests without usable person evidence keep a stable machine
    actor, as required by the approved identity ADR. Local CLI remains on its
    loopback listener, and independent network and plugin checks still apply.
35. **Transactional ingress startup** validates the optional Tailnet port before
    binding, closes the primary listener after a secondary bind failure, and
    gates detached recovery on both configured listeners being ready.

36. **Perspectives restart fault barriers** add test-only barriers that hold
    persisted work at restart-sensitive points.
37. **Scaffold without optional chunks** lets the CLI scaffold test accept a
    generation that emits no lazy chunks.
38. **Protocol error without field detail** accepts agent-runtime protocol
    errors that omit Zod field detail.
39. **Packaged app from versioned artifact** reads the packaged plugin app from
    its artifact generation in CLI tests.
40. **Verified bb-machine legacy history** admits the observed bb-machine
    ledger branch identities, the published `0119_soft_pandemic` hash and its
    column order.
41. **Downstream schema snapshot** is the generator-produced snapshot that
    chains the downstream schema to upstream migration 0141 (as `0142`).
42. **Prior fork bridge receipts** accept exactly the BB 0.43 (`1790103658751`)
    and BB 0.44 (`1790230932026`) bridge receipts, both with the same SQL hash,
    when upgrading an already-bridged database. Any other timestamp or hash
    fails closed.
43. **Host dispatch result contract** keeps host dispatch tests on the
    downstream thread-start result shape.
44. **Resume construction deadline** gives Codex thread resume the configured
    thread construction deadline.
45. **Codex resume construction deadline** carries the remaining deadline into
    the child resume request with a cleanup reserve.
46. **Synchronous prompt rendering** exposes `experimental_p6rPrompts`.
47. **Owned prompt producers** adapt selected server-owned prompt producers.
49. **Participant projection watermarks** record, per thread, the latest
    client/turn/requested event sequence and id, contribution count, latest
    acceptance time and projector version in a fork-owned sidecar table
    (`p6r_participant_watermarks`, one CREATE TABLE, no backfill). The facet
    query rebuilds a thread's participant projection only when its watermark
    differs or is missing; output is byte-identical to a full rebuild.
50. **Delegating item lookup index hint** reads delegating item rows through
    the existing partial index instead of walking every event of the thread,
    matching the sibling lookups; identical rows, no schema change. Proposed
    upstream.
51. **Incremental timeline ordering context** extends upstream's split ordering
    cache with only the ordering rows appended since a retained entry when the
    rewrite generation and data version are unchanged, bounded to 120,000
    retained rows per process. Exact by construction; proposed upstream.

Number 22 is intentionally absent: it was a historical queue gap. Number 27 is
intentionally absent because upstream commit `283e6d7` already supplies the
former Monaco routing change; it is not replayed downstream. Numbers 30 and 48
were retired at the 2026-10-08 refresh; their retirement receipts are below.

## Exact source receipt

- Upstream: `c9649eae71edd2a9da097f8325dde25d8260e5b1`.
- Patch queue: forty-seven logical patches in `patches/series`; numbers 22,
  27, 30 and 48 are intentionally absent as described above. This queue is the current
  implementation candidate, while
  running deployments may remain on earlier historical compositions until root-owned
  integration and activation.
- Result tree: recorded in `result-tree.lock` and verified by `scripts/verify`.

## Refresh notes for patches 0049-0051

These notes come from a four-lens review of the performance patches
(perspectives run `thr_rtbdi5iz67`). Read them before every upstream refresh.

- **0049 participant watermarks.** The watermark (latest client/turn/requested
  sequence and event id, contribution count, max acceptedAt, projector
  version) assumes that every supported writer appends or bumps one of those
  inputs; an in-place change that preserves all four is not detected. Inputs
  are read before the replacement transaction, so a second writer committing
  between the read and the replacement could have its newer projection
  overwritten by an older rebuild. No supported writer with that behavior is
  known; a second-connection interleaving test is the follow-up before any
  in-transaction recheck is added. Any change to attribution or parser
  semantics must bump `P6R_PARTICIPANT_PROJECTOR_VERSION`; the version
  mismatch regression test enforces the rebuild.
- **0050 delegating item index hint.** `INDEXED BY events_delegating_item_lookup_idx`
  fails statement preparation if that partial index (predicate
  `item_kind IN ('toolCall', 'delegation')`) is renamed, dropped, or its
  predicate changes upstream, or if the hint lands on a query without that
  predicate. Check the index and the hinted function at every refresh; at the
  2026-10-08 refresh a clean `git am` placed the hint on the wrong function
  (see defect 5 below). The query selects through `storedEventRowSqlFields`;
  add an equality test with a finite `maxInlineOutputChars` and oversized
  output at the next touch.
- **0051 incremental ordering context.** Replaced at the 2026-10-08 refresh by
  the reshaped commit from `phosphor/perf-incremental-ordering-context`, an
  extension of upstream #4716's split cache that keeps upstream's
  child-streaming, older-snapshot and late-steer regressions alongside the
  incremental-read and eviction tests. Memory note: the 120,000-row cap bounds
  retained raw rows per connection cache, not folded contexts (acceptedTurnIds
  maps) nor the total across up to four versions of 128 keys; folding cost is
  proportional to the accumulated context, not to the incremental read.
  Budgeting folded entries is a proposed amendment, not shipped.
- **0048 teardown sweep split.** Retired at the 2026-10-08 refresh; upstream
  #5127 supersedes it (receipt below).

## Refresh to upstream c9649eae7 (2026-10-08)

Base moved from `9c9bae7f3` (desktop-v0.44.0) to `c9649eae71edd2a9da097f8325dde25d8260e5b1`
(main, 465 commits later, last fully green CI commit; Plugin SDK 0.6.29, upstream
migrations 0132–0141). The 49-patch queue replays as 47 logical patches. The
steward's per-patch resolution log, per-patch interdiff audit
(`placement-audit.txt`), lost-upstream-test audit and verification evidence are
kept in thread storage `thr_px9i8ajvcy/upstream-sync/`.

### Retired patches

- **0030 test(templates): prefer online registry metadata.** Retired. Upstream
  #4976 (`9f4ee4d0b`) rewrote `installPackedSdk` to `npm install --offline` from
  a local cache and local package roots. No registry metadata is consulted, and
  `--prefer-online` would contradict `--offline`.
- **0048 fix(db): stop the archived-teardown sweep from walking the archive.**
  Retired. Upstream #5127 (`aff039015`) rewrote `listArchivedThreadsPendingTeardown`
  as a UNION of the status arm and the non-terminal terminal-session arm.
  Retirement receipt:
  - 0048's own regression tests pass unchanged against upstream's code (8/8).
  - EXPLAIN QUERY PLAN on a private copy of bb-machine state (134,342 archived
    threads), using the exact SQL upstream issues: the status arm searches
    `threads_active_maintenance_idx (status=?)`, and the terminal arm searches
    `threads` by primary key from a covering-index scan of `terminal_sessions`.
    Nothing walks the archive. Warm cost is 3.6–4.1 ms for 22 rows.
- **0045 narrowed** to "fix(codex): share the resume construction deadline".
  Upstream #4477 (`7a0a53c9d`) fetches Codex quota only during failure recovery
  and issues no post-initialize optional usage reads, so the former
  deferred-usage half had nothing to defer. The shared resume deadline and its
  stalled-rate-limit regression remain.
- **0051 replaced** by the reshaped commit from `phosphor/perf-incremental-ordering-context`
  (an extension of upstream #4716's split cache). Measured on the heaviest
  thread of the private copy (167,437 events):
  - First build after a new ordering row: 22.1–22.5 ms → 0.84–0.95 ms median.
  - Cold miss build: unchanged within noise (30.8–34.1 ms vs 33.0–36.0 ms).
- **0050** is unchanged in intent. The hint now sits on
  `listStoredDelegatingItemRowsByItemIds` (see defect 5).

### Defects corrected during refresh

These change what the 0.44 composition actually shipped. The next refresh must
not reintroduce them.

1. **Deleted upstream Codex tests.** At 0.44, patch 0026 removed four upstream
   tests from `plugins/provider-codex/src/bridge/app-server-connection.test.ts`
   (stdin shutdown cleanup, forced termination, late approval replies during
   shutdown, SIGTERM cleanup on EOF). Upstream's implementation was intact. The
   tests are restored alongside 0026's two new tests.
2. **Deleted RPC discovery route.** At 0.44, patch 0028 removed upstream's
   `GET /api/v1/plugins/rpc` route and its query import, while
   `sdk.plugins.experimental_discoverRpc` and the service still used it, which
   left a broken endpoint. The route is restored exactly. The replacement of the
   hash-addressed asset route by the generation route is 0028's intended design
   and is kept.
3. **Lost 0029 regression test.** "Bounds an optional reload until the server
   response completes" was lost in a conflict region. It is restored, so the
   stalled-reload helper is exercised again.
4. **Dead legacy SQL and relaxed journal checks.**
   - 0015, 0025 and 0026 added unreferenced copies of the legacy
     `0119_soft_pandemic`–`0122_living_quasimodo` SQL under `drizzle/`, plus
     journal entries that 0033 later removed, and a trailing-newline edit to
     `0116_snapshot.json`.
   - 0005 relaxed upstream's migration-journal integrity tests to tolerate
     those entries.
   - All of this is removed. The byte-exact fixtures under
     `packages/db/test/fixtures/legacy-identity-context-magnet/` remain the only
     copies, and upstream's strict journal checks apply unchanged.
5. **Misplaced index hint caught during replay.** A clean `git am` placed
   0050's `INDEXED BY events_delegating_item_lookup_idx` in
   `listStoredItemLifecycleRowsByItems`. That query lacks the partial-index
   predicate, so statement preparation would fail. 0050's own query-plan test
   caught it, and the hint now sits on `listStoredDelegatingItemRowsByItemIds`.
   Clean application is not evidence of correct placement; run the interdiff
   audit at every refresh.

### Relocations (each exported patch now typechecks on its own, in order)

| Change | Moved from | Moved to |
| --- | --- | --- |
| `listLastStoredTurnRequestEventsByThreadIds` (db events helper) | 0033 | 0002 |
| `execution-options-changed` change kind and its notify loop | 0002 / 0004 | 0008 |
| Original mention-request lookup (now upstream `listStoredClientTurnRequestRowsByKeys`; the 0.44 helper was never defined) | — | 0004 |
| Unused `PLUGIN_INTERACTION_MAX_*`, `JsonValue`, `GENERIC_AGENT_TOOL_GLYPH` | 0006 | removed |
| RPC `caller` / `publication` updates in witness tests | 0004 / 0015 | 0003 / 0009 |
| `machine` identity-kind TS type on principal profiles | 0033 | 0015 |
| Context Magnet db exports | 0015 | 0025 (traces) / 0026 (admission) |
| `appArtifactGenerations` runtime retention | 0015 | 0028 |

Subjects are unchanged except 0045.

### Migration bridge (G1)

- The identity/Context Magnet bridge moves from `0132_zippy_reavers` to
  **`0142_zippy_reavers`**. The SQL is byte-identical (sha256 `75a11b641e07…`).
  The journal entry and `0142_snapshot.json` come from upstream drizzle-kit
  (when `1791422663905`, chaining to 0141).
- Generator proof: the generated SQL equals the bridge with IF NOT EXISTS,
  minus the two ALTER ADDs that `migrate.ts` guards (`p6r_authors`,
  `execution_revision`).
- Patch 0042 admits both exact prior bridge receipts, 1790103658751 (BB 0.43)
  and 1790230932026 (BB 0.44, the live bb-machine receipt), each with hash
  `75a11b64…`. Committed negative-control tests show that any other timestamp
  or hash fails closed with the ledger untouched.
- The completion marker keeps its recorded name `identity-context-0131`.
- Rehearsal on a second private copy of bb-machine state, through the
  migration entrypoint only (`initDb`):
  - 9.9 s; ledger 138 → 149 with every original row retained; immediate rerun
    is a no-op (7.1 s, dominated by the full foreign-key check).
  - quick_check ok; zero FK violations.
  - Peak file family +0.42 GB; 543,148 `thread_pruning_work` rows from
    upstream 0138.
  - 78 plugins before and after. The only change is upstream 0135's
    `provider-usage` → `bb--provider-usage`; no enabled flag changed.

### Verification notes for the next refresh

- Run tests with an isolated `HOME`. `background-task-reconciliation` reads
  host gh credentials under the real HOME.
- When verifying from inside a BB thread, unset its session variables first:
  `BB_CLI BB_ENVIRONMENT_ID BB_HOST_DAEMON_PORT BB_PROJECT_ID BB_SERVER_URL
  BB_THREAD_ID BB_THREAD_STORAGE`. They otherwise leak into tests; run-cli
  picked up `BB_SERVER_URL` at this refresh.
- Fault-barrier tests require a data directory under `/tmp`. Run them with
  `TMPDIR=/tmp` and everything else on disk-backed scratch.
- Upstream #4761 rejects unconfigured DNS-name Hosts with 403. The Tailscale
  Serve hostname must equal `BB_APP_URL`'s host.

## Compatibility boundaries

- Producer bindings may enable the optional identity-protocol
  `experimental_useProducerMessageRendering` hook. The per-plugin SDK evaluates
  its policy on each send/queue request, including retained SDK references. The
  HTTP presentation hint omits redundant native batch authorship; actual
  producer authors stay in producer records. It does not change explicit queue
  semantics, introduce authorization, or infer ownership from message text.

- Native operations capture verified people when available and otherwise use
  stable machine attribution. Invalid or missing person evidence does not block
  native work. Accepted snapshots remain separate from message text; historical
  unknown messages remain unknown.
- Queued native input uses the existing nullable `p6r_authors` column and
  generated migration `0119_p6r_downstream_schema`. Consolidated patch 15
  reads legacy author arrays and author/editor envelopes, adding machine actors
  without a new column. Edits preserve original authors atomically; corrupt
  metadata rejects the edit. Drain and retry preserve roles across grouped input.
  Rollback after machine writes must retain machine-capable readers; an older
  source checkout alone is not a compatible rollback.
- Native author context is added only to model-bound input after native command
  recognition. Structured `/compact` reaches the existing command path
  unchanged. This patch adds no daemon command field or protocol requirement;
  existing command-schema parsing and compact regression tests cover the wire.
- `/settings/p6rIdentity`, `GET /api/v1/system/p6rIdentity`,
  `sdk.system.p6rIdentity()`, and `bb settings p6r-identity --json` describe the
  identity of that request. A CLI connection need not represent the browser's
  person. The settings page labels Appearance as shared; personal theme
  overrides from the older experimental branch are not restored.
- Plugin identity uses the shared bb-identity binding and optional provider
  enrichment. Invocation expiry and obsolete host age fields are removed;
  cancellation, disposal and captured ownership checks remain. The old claimed-identity editor, request-principal fields, and
  transcript-parsed actor fallback are not the selected contract. Mention
  targets are verified recipients, never evidence of who sent the message.
- External operations retain immutable receipts and exact request/turn links.
  Agent Connect retry does not resend; transient delta retention can compact,
  with completed messages and terminal events providing canonical results.
- Thread Facets, execution selection, plugin presentation compatibility, and
  Pkl highlighting remain the independently named features in patches 1–15.
  Identity APIs and storage use the downstream P6R namespace.

See [the native identity maintenance note](plans/native-identity-settings-and-authorship.md)
for the integration footprint and validation limits. The ordered patch queue
and result tree are canonical; historical review artifacts are supporting
evidence, not a second deployment source.

## Candidate verification boundary

The 2026-10-08 receipt is summarised in README.md ("Verification boundary for
this source receipt") and in the refresh notes above. It is a source and
migration receipt: workspace typecheck/build, per-patch typecheck, the package
test graph (Electron desktop excluded), namespace verification, and an
entrypoint-only migration rehearsal on a private copy of bb-machine state. It is
not evidence that a running deployment has changed. Runtime, plugin activation,
host policy and browser acceptance are activation gates.

## Experimental prompt rendering (patches 46–47)

The downstream API is `bb.experimental_p6rPrompts`, with public `P6rPrompt*`
request/observation types and `ExperimentalP6rPrompts`. The shared pure engine
uses its own `internal/p6r-prompt-rendering` SDK export. Middleware and observers
follow plugin load/disposal, with deterministic plugin order, synchronous string
results, default fallback and immutable observations. Core stores no samples.

Selected producers render native tool/schema descriptions, instruction sections
and their aggregate, title/commit templates, structured child/ownership/agent
messages, and mention context headers. The aggregate intentionally sees already
customized sections; matching both stages can apply a rule twice. Observations
are render receipts, not evidence of provider consumption or reconstructed stock
defaults. Opaque resolved mention content and native attribution remain intact.
Generated-command skills are excluded until a coherent settings/sync lifecycle
exists. No example plugin, lockfile importer, DB migration, host transport,
provider wrapper or service activation is included. The
[maintainer map](plans/p6r-prompts-maintainer-map.md) records exact source and
coverage boundaries.

## Automatic parent followups (patch 52)

`bb thread spawn --no-automatic-parent-followups` and SDK/API
`noAutomaticParentFollowups: true` retain the native parent link while suppressing
automatic completion, interruption, attention, and ownership notices. Child
failures always use normal parent delivery, including setup failures and exhausted
message retries. A reserved metadata row is seeded in the existing creation
transaction; omitted settings preserve normal
delivery. No migration, Thread field, or daemon protocol change is introduced.
The setting is creation-only. Explicit delivery remains available.

[Design and maintenance](docs/no-automatic-parent-followups.md) records the
authorized fork justification, storage/default/error behavior, test boundaries,
and upstream retirement path. Both server and CLI need this patch. Source
publication and build do not activate it in an already-running server.
