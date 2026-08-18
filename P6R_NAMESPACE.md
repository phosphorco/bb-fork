# Phosphor downstream namespace

Every reusable or externally observable identifier introduced by this overlay
must identify itself as downstream-owned:

- values, functions, methods, fields, and props use `p6r...`;
- types and components use `P6r...`;
- constants use `P6R_...`;
- HTTP paths, WebSocket discriminators, headers, CLI commands, persistence
  keys, tables, and columns contain `p6r`.

This includes internal contracts shared between bb packages, even when they are
not currently exported by `@get-bb/plugin-sdk`. Ordinary implementation locals
such as `request`, `response`, or `rows` do not become a contract merely because
they occur in a downstream implementation.

The purpose is compatibility hygiene. A plugin author should never mistake a
Phosphor-only API for an upstream bb API. For example, the overlay exposes
`bb.sdk.p6rMembers`, `p6rShowAuthor`, and `p6rActorHandle`; it must never expose
those additions as `bb.sdk.members`, `showAuthor`, or `actorHandle`.

Legacy unprefixed database names may appear only in migration compatibility
code that upgrades checkouts of the earlier experimental multiplayer branch.
All newly written storage uses the `p6r_` schema.

`scripts/check-p6r-namespace` enforces the exported-symbol rule from the Git
diff and guards the public SDK and wire-level names most likely to leak into a
plugin. Additions to the downstream contract should extend that checker in the
same patch.
