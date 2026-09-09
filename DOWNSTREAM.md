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
4. **Capability-authenticated routes** adds bounded authenticated plugin HTTP
   and RPC surfaces.
5. **Verified mention targets** adds authenticated mention recipients without
   conflating recipients and authors.
6. **Built sidecar migrations** includes the generated P6R migration payloads.
7. **Plugin presentation compatibility** preserves the existing plugin-facing
   identity presentation contracts.
8. **Sidebar participants and guidance** integrates participant presentation
   with the current sidebar behavior.
9. **Execution cache invalidation** rejects stale execution projections.
10. **Transport error mapping** retains HTTP/RPC error compatibility. Its former
    person-only admission gate is removed by consolidated patch 16.
11. **Active external queues** preserves queued Agent Connect work across the
    reviewed identity boundary.
12. **Pending call history** retains exact operation history until turn linkage
    is complete.
13. **Pkl highlighting** adds shared Markdown and Monaco syntax coloring.
14. **Migration-fixture rewind** keeps upstream replay tests valid after the downstream identity migrations.
15. **Integration determinism** updates renamed mention seams and canonicalizes Git timestamps in downstream witnesses.
16. **Best-effort native attribution** consolidates the former patches 16–23.
    It supplies stable machine fallback, retains original authors and later
    editors, presents identity in settings/timeline/CLI, and emits only minimal
    sender wrappers. It removes signed browser lineage and native person-gate
    validation plumbing. Provider enrichment remains bounded; durable history,
    receipts, queue/retry semantics and independent access controls remain.

## Exact source receipt

- Upstream: `960255b98ce3dccdcb5754eb67a7f989236602a1`.
- Materialized package: `bb-app@0.42.0` plus the reviewed downstream queue.
- Patch queue: sixteen candidate patches in `patches/series`; not yet activated.
- Result tree: recorded in `result-tree.lock` and verified by `scripts/verify`.

## Compatibility boundaries

- Native operations capture verified people when available and otherwise use
  stable machine attribution. Invalid or missing person evidence does not block
  native work. Accepted snapshots remain separate from message text; historical
  unknown messages remain unknown.
- Queued native input uses the existing nullable `p6r_authors` column and
  generated migration `0116_p6r_native_message_authors`. Consolidated patch 16
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
