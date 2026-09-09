# Downstream patch contract

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
10. **Admission boundary** fails closed before dispatch for non-ready providers.
11. **Active external queues** preserves queued Agent Connect work across the
    reviewed identity boundary.
12. **Pending call history** retains exact operation history until turn linkage
    is complete.
13. **Pkl highlighting** adds shared Markdown and Monaco syntax coloring.
14. **Migration-fixture rewind** keeps upstream replay tests valid after the downstream identity migrations.
15. **Integration determinism** updates renamed mention seams and canonicalizes Git timestamps in downstream witnesses.
16. **Native identity settings and authorship** exposes the current connection’s verified identity and retains native send authors across queueing, retry, model input, and timeline presentation.

17. **Directory refresh authority** preserves admitted requests across directory-only invalidations; fresh verified admissions update presentation without rewriting prior snapshots. Targeted authentication revocation and expiry remain enforced.

18. **Edit attribution** preserves the original author and records the latest editor through queued edits, accepted edit/resend, restart, drain, retry, model input, and timeline labels.

## Exact source receipt

- Upstream: `960255b98ce3dccdcb5754eb67a7f989236602a1`.
- Materialized package: `bb-app@0.42.0` plus the reviewed downstream queue.
- Patch queue: eighteen patches in `patches/series`.
- Result tree: recorded in `result-tree.lock` and verified by `scripts/verify`.

## Compatibility boundaries

- Unconfigured installations preserve native local behavior. With an identity
  provider configured, native send/create/edit/retry routes require ready
  provider admission and do not fall back to client claims. Sender identity is
  captured from the request, validated at acceptance, and stored separately
  from message text. Historical messages without that evidence stay unknown.
- Queued native input adds one nullable `p6r_authors` column through generated
  migration `0116_p6r_native_message_authors`. Patch 18 reuses that column,
  reading legacy author arrays and writing strict author/editor envelopes on
  edit. It preserves the stored author atomically; an edit without editor
  evidence clears the prior editor. Corrupt metadata rejects the edit. Drain
  and retry preserve both roles, including different people in grouped input.
  Older readers do not understand new envelopes: rolling back below patch 18
  requires an explicit data compatibility procedure, not just a source swap.
- Native author context is added only to model-bound input after native command
  recognition. Structured `/compact` reaches the existing command path
  unchanged. This patch adds no daemon command field or protocol requirement;
  existing command-schema parsing and compact regression tests cover the wire.
- `/settings/p6rIdentity`, `GET /api/v1/system/p6rIdentity`,
  `sdk.system.p6rIdentity()`, and `bb settings p6r-identity --json` describe the
  identity of that request. A CLI connection need not represent the browser's
  person. The settings page labels Appearance as shared; personal theme
  overrides from the older experimental branch are not restored.
- Plugin identity uses the public bb-identity binding and selected provider
  admission. The old claimed-identity editor, request-principal fields, and
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
