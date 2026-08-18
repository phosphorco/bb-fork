# Downstream patch contract

## Patch queue

1. **Identity and attribution foundations** adds claimed-identity contracts, collaborator storage, additive attribution columns, and Connect membership storage.
2. **Membership admission and request actors** verifies server membership and carries the resolved actor through HTTP and WebSocket request boundaries.
3. **Attributed messaging and presence** stamps user-originated events and interactions, projects authors into timeline data, emits presence, and supplies provider-facing speaker context.
4. **App, CLI, and SDK surfaces** adds identity claiming, author avatars, presence indicators, member administration, and additive SDK methods.
5. **Current-upstream hardening** folds in race fixes, regenerated migration 0099, generated declarations/templates, and fixtures for upstream timeline changes.
6. **Phosphor namespace boundary** prefixes downstream contracts, UI props, wire fields, routes, persistence, CLI commands, and SDK surfaces with `p6r` while retaining migration support for the earlier unprefixed experimental schema.
7. **React hook naming** keeps downstream hooks visibly namespaced as `useP6r...` while preserving the `use` prefix required by React tooling and the compiler.

## Compatibility boundaries

- Existing HTTP and SDK behavior remains available; new request/response fields are additive and nullable or optional where legacy data can lack attribution.
- SQLite changes are additive: one new table and nullable columns. Migration 0099 is generated from the `desktop-v0.38.0` migration chain.
- Installs that ran the experimental branch's conflicting `0079_multiplayer-collaborators` migration are staged through canonical upstream migrations and restored without losing collaborator or attribution data.
- Existing stored events remain readable with `actorHandle: null`.
- New downstream contracts follow [P6R_NAMESPACE.md](P6R_NAMESPACE.md), preventing plugins from silently depending on APIs absent from upstream bb.
- The provider speaker payload extends the host-daemon wire contract. The server and host daemon must therefore deploy together at protocol version 124. This queue is source/API-compatible with existing clients, but it intentionally does **not** claim mixed-version server/daemon compatibility.
- Claimed identity is not authentication by itself. The Connect membership gate establishes admission; the claimed identity selects an admitted member for attribution.
- Upstream's removed native side-chat UI is not restored. Identity rendering is integrated into the current native timeline/header/sidebar components and remains compatible with plugin-owned side chat.

The patch queue is the canonical downstream delta. A convenience branch may be regenerated for review, but it is not a release input.
