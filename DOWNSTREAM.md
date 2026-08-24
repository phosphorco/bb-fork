# Downstream patch contract

## Patch queue

1. **Current-upstream multiplayer reconciliation** ports the verified-identity, provider-qualified PrincipalKey, durable-authorship, presence, attributed messaging, and managed-deployment guarantees onto exact current upstream behavior.
2. **Extensible Thread Facets revision 1** adds the generic namespaced Thread–Member relation, one-or-many cardinality, authoritative completeness and generation lifecycle, stable public query/CLI, attenuated plugin capability, core participant projection, and saved web/mobile My progress views.
3. **Namespace-neutral facet quarantine fixture** keeps the forbidden principal-member-kind declaration witness within the bounded generic facet namespace exception.
4. **Condensed sidebar participant presentation** makes ordinary web and native rows use ordered avatar groups with lawful initials, accessible name disclosure, and `+N` overflow without visible full-name row text.
5. **Structured compact command preservation** classifies an authenticated standalone built-in `/compact` selection before host-daemon sender presentation, retaining the existing provider compaction path without executing quoted, raw, attachment-bearing, agent-authored, plugin-origin, surrounding-text, or other slash inputs.
6. **Deployment fixture contract alignment** updates the demo and provider-parity fixtures to carry the merged nullable authorship fields and managed Rosetta upgrade guidance required by the production TypeScript gate.
7. **Plugin principal authority** exposes the server-authored PrincipalKey seam needed by downstream plugins without accepting a client-selected key.
8. **Safe provider avatars** preserve HTTPS-only, anonymous image loading with an accessible initials fallback across presence and the condensed participant stack.
9. **Interrupted identity staging recovery** preserves deployed multiplayer migration state while the current additive identity migration takes ownership.
10. **Unbounded supervised server startup** lets production-sized migrations finish while retaining bounded health requests, launch-id identity, and child-exit failure.
11. **Packaged runtime entrypoints** makes the immutable bb-app artifact contain the launcher, CLI, server, and daemon from one revision.
12. **Current-protocol witness alignment** keeps public identity proofs and DB exports aligned with the coordinated daemon protocol base.
13. **Completed-ledger staging recovery** restores staged identity tables even when the prior migration ledger had already advanced.
14. **Trusted Tailnet admission** keeps authenticated Tailnet browser identity out of untrusted claimed-presentation mode.
15. **Singular generalized event-query export** resolves the protocol witness port against the current shared Thread Facet query primitive without duplicating its public DB export.
16. **Unified plugin principal imports** resolves the live SDK authority port against the current contract header without duplicate type declarations.
17. **Distinct no-provider claimed principals** lets remote no-provider clients carry untrusted presentation while the server authors stable, distinct claimed PrincipalKeys; configured providers and loopback keep their own authority.
18. **Deterministic unbounded-startup witness** drives more than sixty seconds of health-check intervals through an injected delay without fake-timer deadlock, preserving executable proof that long migrations have no launcher deadline.
19. **Validation contract alignment** records the intentional optional speaker field and gives the lifecycle-heavy plugin-update scheduler witness the same bounded timeout as its neighboring regression.
20. **Unbounded health witness alignment** removes obsolete timeout arguments from launcher-health tests and proves foreign responders remain rejected until the supervised child exits, without restoring a product startup deadline.

## Exact source receipt

- Upstream: `5205d98a74ed5a22469e521cf1f86b00b8232827`.
- Materialized package: `bb-app@0.39.0`.
- Patch queue: twenty patches in `patches/series`.
- Result tree: recorded in `result-tree.lock` and verified by `scripts/verify`.

## Compatibility boundaries

- Existing HTTP and SDK behavior remains available; new request/response fields are additive and nullable or optional where legacy data can lack attribution.
- SQLite changes are additive: `0107_p6r_identity_authorship` adds provider-qualified actor and collaborator snapshots plus nullable authorship columns, and `0108_thread_facets` adds declarations, members, owner generations, reconciliation obligations, relations, exact participant profiles, and the stable cursor key.
- Installs that ran the experimental branch's conflicting `0079_multiplayer-collaborators` migration are staged through canonical upstream migrations and restored without losing collaborator or attribution data.
- Existing stored events remain readable with `actorHandle: null`.
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
