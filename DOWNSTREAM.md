# Downstream patch contract

## Patch queue

1. **Identity and attribution foundations** adds claimed-identity contracts, collaborator storage, additive attribution columns, and Connect membership storage.
2. **Membership admission and request actors** verifies server membership and carries the resolved actor through HTTP and WebSocket request boundaries.
3. **Attributed messaging and presence** stamps user-originated events and interactions, projects authors into timeline data, emits presence, and supplies provider-facing speaker context.
4. **App, CLI, and SDK surfaces** adds identity claiming, author avatars, presence indicators, member administration, and additive SDK methods.
5. **Current-upstream hardening** folds in race fixes, generated declarations/templates, and fixtures for upstream timeline changes.
6. **Phosphor namespace boundary** prefixes downstream contracts, UI props, wire fields, routes, persistence, CLI commands, and SDK surfaces with `p6r` while retaining migration support for the earlier unprefixed experimental schema.
7. **React hook naming** keeps downstream hooks visibly namespaced as `useP6r...` while preserving the `use` prefix required by React tooling and the compiler.
8. **Verified identity and durable authorship kernel** replaces client-claimed transport identity with one bounded, provider-qualified resolver; carries separate resolver request and durable turn-author facets; and preserves queued authored units through edit, grouping, reorder, delay, and dispatch into timeline rows.
9. **Exact-tag contract and migration receipt** regenerates the overlay contracts and templates, records the current `0101_p6r_identity_authorship` migration, and pins the exact `desktop-v0.39.0` source receipt.
10. **Exact workspace and provider-input contract receipt** carries the candidate-only fixture and generated declaration updates required by the exact `bb-app@0.39.0` workspace gate environment, plus the ready-turn authorship handoff and its canonical provider-input witnesses.
11. **Sparse multiplayer migration staging** preserves only explicit legacy attribution values and restores them through indexed event-id lookups, leaving unknown historical authorship null.
12. **Managed daemon deployment and update guidance** advances the host-daemon protocol to 136 so enrolled auto-update daemons fetch the server's exact distribution and restart, while Settings and `bb updates` direct primary-server replacement through Rosetta machine deployment instead of npm latest.
13. **Provider-qualified identity foundation extension** carries an additive PrincipalKey value through p6r identity and presence contracts while retaining reader-tolerant legacy records.
14. **Attributed presence preservation** groups sockets by exact PrincipalKey, keeps same-key coalescing, and applies exact viewer-relative suppression without presentation-field equality.
15. **Principal-aware typing surface** projects resolved display labels into human typing copy and uses the existing browser-safe client-id constructor.
16. **Server-authored p6r PrincipalKeys** derives local and provider-qualified keys at the identity boundary and strips client-supplied key claims before presence publication.
17. **Durable thread participant projection** derives ordered participants from stored authored events without joining on presentation.
18. **Sidebar plugin participant projection** exposes the same ordered PrincipalKeys through the plugin thread contract.
19. **Claimed WebSocket presentation** carries the server-issued claimed principal through the shared realtime resolver while rejecting client-authored keys.
20. **Sidebar presence principal preservation** retains provider-qualified presence identity at the sidebar boundary.
21. **Plugin request principal context** carries the server-authored PrincipalKey beside the authenticated actor and gives a registered identity provider a provider-scoped subject denotation handle.
22. **Participant overflow tooltip lint repair** retains the accessible participant names while removing the redundant native tooltip rejected by the application lint boundary.

## Exact 0.39 receipt

- Upstream: `desktop-v0.39.0` at `b33abbff098ac4c857578e7350d492dcaa65d489`.
- Materialized package: `bb-app@0.39.0`.
- Patch queue: twenty-two patches in `patches/series`.
- Result tree: `465b8e1bfff7c7074d5ee3f81f8c6856e0391be0`.

## Compatibility boundaries

- Existing HTTP and SDK behavior remains available; new request/response fields are additive and nullable or optional where legacy data can lack attribution.
- SQLite changes are additive: the current downstream identity migration is `0101_p6r_identity_authorship`, adding the provider-qualified actor and collaborator snapshots plus nullable actor facets on events, pending interactions, queued messages, and threads.
- Installs that ran the experimental branch's conflicting `0079_multiplayer-collaborators` migration are staged through canonical upstream migrations and restored without losing collaborator or attribution data.
- Existing stored events remain readable with `actorHandle: null`.
- Migration `0101_p6r_identity_authorship` adds the nullable `p6r_actors` and
  `p6r_collaborators` snapshot tables and nullable canonical actor columns to
  events and queued messages. Old rows and no-provider installations remain
  readable with nullable structured actor data; historical actor reads use the
  stored snapshot without a live provider.
- The exclusive plugin provider boundary composes `pluginId/registrationId`
  ids and fails closed on rejection, throw, malformed output, or timeout.
  No-provider and provider-not-applicable resolve to an anonymous nullable
  principal so ordinary reads and plugin `auth:none`/`auth:token` policy can
  run; authored mutations require an authenticated actor. Loopback
  local-operator fallback is available only after no-provider or
  not-applicable resolution, and never rescues provider rejection. Client
  URL/query/body/header claims are never accepted on provider-owned paths.
- Plugin HTTP/RPC handlers receive nullable `p6rRequestPrincipal` and its
  server-authored `p6rRequestPrincipalKey` from the shared HTTP/WebSocket
  resolver. Registered identity providers may denote another subject only
  inside their core-composed provider namespace. Agent tools receive nullable
  `p6rTurnAuthor` only from the durable accepted authored unit; the transport
  principal is not an author fallback and transcript `[from=...]` is write-only
  presentation.
- Queue edits by another authenticated actor re-stamp the queued actor, and
  canonical provider/subject keys prevent cross-actor grouping. The accepted
  timeline user row carries the same nullable structured actor as the queued
  authored unit.
- New downstream contracts follow [P6R_NAMESPACE.md](P6R_NAMESPACE.md), preventing plugins from silently depending on APIs absent from upstream bb.
- The server and host daemon deploy together at protocol version 136. Existing auto-update-enabled enrolled daemons on 135 fetch the server's exact `/install/bb-app.tgz` artifact and restart; the updater still refuses insecure non-loopback HTTP and never downgrades a newer daemon. The system-version ViewModel replaces `upgradeCommand` with `upgradeGuidance` alongside every in-tree app, CLI, SDK, fixture, and generated-contract consumer, so this queue intentionally does **not** claim mixed-version client or server/daemon compatibility.
- Claimed identity is not authentication by itself. The Connect membership gate establishes admission; the claimed identity selects an admitted member for attribution.
- Upstream's removed native side-chat UI is not restored. Identity rendering is integrated into the current native timeline/header/sidebar components and remains compatible with plugin-owned side chat.

The patch queue is the canonical downstream delta. A convenience branch may be regenerated for review, but it is not a release input.
