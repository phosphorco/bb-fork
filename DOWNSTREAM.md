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

Number 22 is intentionally absent: it was a historical queue gap. Number 27 is
intentionally absent because upstream commit `283e6d7` already supplies the
former Monaco routing change; it is not replayed downstream.

## Exact source receipt

- Upstream: `9c9bae7f36a237c7e1b96de3d4c2186d13967686`.
- Patch queue: forty-five logical patches in `patches/series`; numbers 22 and
  27 are intentionally absent as described above. This queue is the current
  implementation candidate, while
  running deployments may remain on earlier historical compositions until root-owned
  integration and activation.
- Result tree: recorded in `result-tree.lock` and verified by `scripts/verify`.

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

The replay receipt covers the server-scoped candidate: the migration/database
suite, server/daemon/CLI typechecks, P6R queue and attribution behavior,
artifact-v2 CLI behavior, and capped provider conformance suites. It is not a
claim that the full workspace graph is green. In particular, desktop SQLite
testing is host-ineligible without GTK, templates retain a separately diagnosed
pack-infrastructure failure, and Context Magnet's direct-plugin full suite has
an external Codex router launcher-generation digest mismatch. Those limitations
remain release-qualification work; none was skipped, regenerated, or treated as
evidence that a running deployment has changed.
The patch-35 successor additionally passed focused real-socket startup tests
and server typecheck; the prior broad receipt must be rebound to its new tree
before normal deployment qualification.

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
