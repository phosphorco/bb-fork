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
12. **Managed daemon deployment and update guidance** keeps enrolled daemons on the code-owned protocol and directs primary-server replacement through Rosetta machine deployment instead of npm latest.
13. **Canonical protocol-147 base replay** rebases the reviewed overlay onto upstream's shipped protocol and migration lineage.
14. **Shipped migration-ledger adoption** records the canonical upstream migration IDs before downstream identity migrations resume.
15. **Provider-qualified identity extension** carries an additive PrincipalKey through identity and presence contracts while retaining reader-tolerant legacy records.
16. **Attributed presence preservation** groups sockets by exact PrincipalKey and applies viewer-relative suppression without presentation-field equality.
17. **Principal-aware typing** projects resolved display labels into typing copy.
18. **Server-authored PrincipalKeys** derives local and provider-qualified keys at the identity boundary and strips client-supplied key claims.
19. **Durable thread participants** derives ordered participants from stored authored events.
20. **Sidebar participant profiles** exposes the same ordered PrincipalKeys through the plugin thread contract.
21. **Claimed WebSocket presentation** carries only the server-issued claimed principal through realtime resolution.
22. **Sidebar presence principals** retains provider-qualified presence identity at the sidebar boundary.
23. **Plugin principal context** carries the server-authored PrincipalKey beside the authenticated actor and supports provider-scoped subject denotation.
24. **Participant overflow accessibility** retains accessible participant names without a redundant native tooltip.
25. **Distinct no-provider modes** keeps loopback on the local operator while remote no-provider requests may carry only claimed presentation with a server-authored key.
26. **Provider avatar fallback** keeps provider presentation resilient when an avatar source is absent or invalid.
27. **Bounded participant queries** batches participant reads within SQLite binding limits.
28. **Interrupted identity staging recovery** reconciles durable actor and collaborator staging before the canonical migration resumes.
29. **Production-shaped startup supervision** permits production-sized migrations to reach health within the bounded deployment window.
30. **Packaged runtime identity** exposes the exact launcher, server, and daemon paths required by immutable process receipts.
31. **Protocol-147 batching adaptation** aligns participant fixtures and batched events with the canonical base.
32. **Canonical identity witnesses** aligns generated, migration-ledger, and protocol witnesses with upstream protocol 147.
33. **Namespaced participant batching** keeps the new batched query surface inside the p6r downstream namespace boundary.
34. **Post-ledger staging recovery** idempotently merges and removes interrupted actor/collaborator staging even when canonical 0105 was already recorded.

## Exact protocol-147 receipt

- Upstream: `c942421a454ee4157004274053eec5f36c81d7eb`.
- Materialized package: `bb-app@0.39.0`.
- Patch queue: thirty-four patches in `patches/series`.
- Result tree: `8f5d2f61584e9dbcfc7ef9051c44cf5fc2678e98`.

## Compatibility boundaries

- Existing HTTP and SDK behavior remains available; new request/response fields are additive and nullable or optional where legacy data can lack attribution.
- SQLite changes are additive: the current downstream identity migration is canonical `0105_p6r_identity_authorship`, adding the provider-qualified actor and collaborator snapshots plus nullable actor facets on events, pending interactions, queued messages, and threads.
- Installs that ran the experimental branch's conflicting `0079_multiplayer-collaborators` migration are staged through canonical upstream migrations and restored without losing collaborator or attribution data.
- Existing stored events remain readable with `actorHandle: null`.
- Migration `0105_p6r_identity_authorship` adds the nullable `p6r_actors` and
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
- The server and every recorded host daemon deploy together at protocol version 147. The updater still refuses insecure non-loopback HTTP and never downgrades a newer daemon. The system-version ViewModel uses Rosetta-owned `upgradeGuidance` across in-tree app, CLI, SDK, fixture, and generated-contract consumers, so this queue intentionally does **not** claim mixed-version client or server/daemon compatibility.
- Claimed identity is not authentication by itself. The Connect membership gate establishes admission; the claimed identity selects an admitted member for attribution.
- Upstream's removed native side-chat UI is not restored. Identity rendering is integrated into the current native timeline/header/sidebar components and remains compatible with plugin-owned side chat.

The patch queue is the canonical downstream delta. A convenience branch may be regenerated for review, but it is not a release input.
