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

## Exact source receipt

- Upstream: `960255b98ce3dccdcb5754eb67a7f989236602a1`.
- Materialized package: `bb-app@0.42.0` plus the reviewed downstream queue.
- Patch queue: fifteen patches in `patches/series`.
- Result tree: recorded in `result-tree.lock` and verified by `scripts/verify`.

## Compatibility boundaries

- Existing HTTP and SDK behavior remains available; new request/response fields are additive and nullable or optional where legacy data can lack attribution.
- SQLite changes are additive: `0107_p6r_identity_authorship` adds provider-qualified actor and collaborator snapshots plus nullable authorship columns, and `0108_thread_facets` adds declarations, members, owner generations, reconciliation obligations, relations, exact participant profiles, and the stable cursor key.
- Installs that ran the experimental branch's conflicting `0079_multiplayer-collaborators` migration are staged through canonical upstream migrations and restored without losing collaborator or attribution data.
- Existing stored events remain readable with `actorHandle: null`.
- The background-command start timestamp is additive and optional for older clients; servers emit null when no provider-backgrounded shell command is active.
- Recovery is an independently identified native package. Its snapshot read is
  capped at 12 distinct thread IDs and 40 timeline segments per thread, adds no
  server/daemon wire field, and cannot claim whole-bundle coherence while the
  sidebar lacks an authoritative revision. The client rejects cache-owner
  mismatches and persists related observations atomically.
- Provider-runtime environment resolution is host-local and changes no server/daemon wire contract; a workspace shell-probe failure retains the existing daemon-login `PATH` fallback.
- Old rows and no-provider installations remain readable with nullable
  structured actor data; historical actor reads use the stored snapshot
  without a live provider. Facet declarations and last-known positive
  relations survive owner unavailability, while absence is definite only for
  a complete current-generation snapshot.
- The exclusive plugin provider boundary composes `pluginId/registrationId`
  ids and fails closed on rejection, throw, malformed output, or timeout.
  No-provider and provider-not-applicable resolve to an anonymous nullable
  principal so ordinary reads and plugin `auth:none`/`auth:token` policy can
  run; authored mutations require an authenticated actor. Loopback
  local-operator fallback is available only after no-provider or
  not-applicable resolution, and never rescues provider rejection. Client
  URL/query/body/header claims are never accepted on provider-owned paths.
- Plugin HTTP/RPC handlers receive nullable `p6rRequestPrincipal` from the
  shared HTTP/WebSocket resolver. Agent tools receive nullable
  `p6rTurnAuthor` only from the durable accepted authored unit; the transport
  principal is not an author fallback and transcript `[from=...]` is write-only
  presentation.
- Queue edits by another authenticated actor re-stamp the queued actor, and
  canonical provider/subject keys prevent cross-actor grouping. The accepted
  timeline user row carries the same nullable structured actor as the queued
  authored unit.
- Multiplayer identity, authorship, presentation, and provider contracts
  follow [P6R_NAMESPACE.md](P6R_NAMESPACE.md), preventing plugins from silently
  depending on downstream APIs. Revision 1's exact generic Thread Facet
  surfaces and `thread_facet_*` persistence names are the bounded core
  infrastructure exception; an explicit path-and-symbol checker allowlist
  prevents that exception from admitting unrelated exports.
- The server and host daemon deploy together at protocol version 153. Enrolled execution machines fetch the server's exact `/install/bb-app.tgz` artifact and restart; the updater still refuses insecure non-loopback HTTP and never downgrades a newer daemon. The system-version ViewModel replaces `upgradeCommand` with `upgradeGuidance` alongside every in-tree app, CLI, SDK, fixture, and generated-contract consumer, so this queue intentionally does **not** claim mixed-version client or server/daemon compatibility.
- Claimed identity is presentation only. HTTP and WebSocket claims are
  accepted only when no provider owns the remote path; the server authors a
  stable claimed PrincipalKey per client. Configured providers and loopback
  local-operator identity remain authoritative, and client-selected keys are
  stripped or rejected.
- Facets are namespaced Thread–Member relations. A `many` value is a finite
  duplicate-free member set; `one` is the same relation with an at-most-one
  law. Missing legacy, reconciling, or unavailable projection state is unknown,
  not false. Tag assignment scope remains explicitly reserved rather than
  inferred from marker representation.
- Sidebar sections are saved bounded facet queries over visible active threads,
  not alternate ownership or copied membership. Ordinary web and native thread
  rows use compact avatar groups rather than visible participant-name text;
  participant avatars preserve canonical PrincipalKey order and cardinality
  even when names or images match.
- An authenticated human's exact structured built-in `/compact` request is
  persisted with its actor attribution and reaches the existing provider
  compaction control path before sender presentation can alter its mention
  range. Raw or pasted text, quotes and code, attachments, surrounding text,
  plugin-origin commands, agent-authored messages, and other slash commands
  remain ordinary provider input.
- The companion `phosphorco/bb-plugins` branch publishes Thread Progress phase
  through the plugin facet capability while its SQLite record remains the sole
  authority; transactional outbox and census reconciliation make reload and
  retry behavior durable.
- Upstream's removed native side-chat UI is not restored. Identity rendering is integrated into the current native timeline/header/sidebar components and remains compatible with plugin-owned side chat.

The patch queue is the canonical downstream delta. A convenience branch may be regenerated for review, but it is not a release input.
