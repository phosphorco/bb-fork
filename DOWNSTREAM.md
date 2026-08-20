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

## Exact 0.39 receipt

- Upstream: `desktop-v0.39.0` at `b33abbff098ac4c857578e7350d492dcaa65d489`.
- Materialized package: `bb-app@0.39.0`.
- Patch queue: eleven patches in `patches/series`.
- Result tree: `28461279ba3383862b2166fb545d0e5cb052ccb9`.

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
- Plugin HTTP/RPC handlers receive nullable `p6rRequestPrincipal` from the
  shared HTTP/WebSocket resolver. Agent tools receive nullable
  `p6rTurnAuthor` only from the durable accepted authored unit; the transport
  principal is not an author fallback and transcript `[from=...]` is write-only
  presentation.
- Queue edits by another authenticated actor re-stamp the queued actor, and
  canonical provider/subject keys prevent cross-actor grouping. The accepted
  timeline user row carries the same nullable structured actor as the queued
  authored unit.
- New downstream contracts follow [P6R_NAMESPACE.md](P6R_NAMESPACE.md), preventing plugins from silently depending on APIs absent from upstream bb.
- The provider speaker payload extends the host-daemon wire contract. The server and host daemon must therefore deploy together at protocol version 124. This queue is source/API-compatible with existing clients, but it intentionally does **not** claim mixed-version server/daemon compatibility.
- Claimed identity is not authentication by itself. The Connect membership gate establishes admission; the claimed identity selects an admitted member for attribution.
- Upstream's removed native side-chat UI is not restored. Identity rendering is integrated into the current native timeline/header/sidebar components and remains compatible with plugin-owned side chat.

The patch queue is the canonical downstream delta. A convenience branch may be regenerated for review, but it is not a release input.
