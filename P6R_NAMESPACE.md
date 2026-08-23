# Phosphor downstream namespace

Every reusable or externally observable multiplayer identity, authorship,
presentation, or provider identifier introduced by this overlay must identify
itself as downstream-owned:

- values, functions, methods, fields, and props use `p6r...`;
- React hooks use `useP6r...`, preserving React's required `use` prefix while
  keeping the downstream namespace explicit;
- types and components use `P6r...`;
- constants use `P6R_...`;
- HTTP paths, WebSocket discriminators, headers, CLI commands, persistence
  keys, tables, and columns contain `p6r`.

Thread Facets are the one bounded exception. Revision 1 establishes them as
generic core organization/query infrastructure rather than multiplayer
identity vocabulary. The exact facet-owned domain, DB, SDK, public API, CLI,
route, and saved-view exports named in `scripts/check-p6r-namespace` may use
their generic contract names, and the additive facet tables use the
`thread_facet_*` namespace. The exception is an explicit path-and-symbol
allowlist: neither a directory nor a spelling such as `Facet` exempts a new
surface. Plugin-specific features built on facets remain downstream-owned and
must use their own lawful namespace; the exception does not rename or weaken
PrincipalKey identity, authorship, presentation, or provider boundaries.

Identity kernel additions follow the same rule: the immutable principal key is
`(p6rProviderId, p6rSubject)`, while `p6rHandle`, `p6rDisplayName`, and
`p6rImageUrl` are mutable presentation snapshot fields. Agent tools receive
only nullable `p6rTurnAuthor` from durable accepted-unit data. Plugin HTTP/RPC
handlers receive only nullable `p6rRequestPrincipal` from the shared inbound
resolver; neither carrier is reconstructed from transcript `[from=...]`
presentation or from a client claim.

This includes internal contracts shared between bb packages, even when they are
not currently exported by `@get-bb/plugin-sdk`. Ordinary implementation locals
such as `request`, `response`, or `rows` do not become a contract merely because
they occur in a downstream implementation.

The purpose is compatibility hygiene. A plugin author should never mistake a
Phosphor-only API for an upstream bb API. For example, the overlay exposes
`bb.sdk.p6rMembers`, `p6rShowAuthor`, and `p6rActorHandle`; it must never expose
those additions as `bb.sdk.members`, `showAuthor`, or `actorHandle`.

The identity provider registration is exclusive and core-composed as
`pluginId/registrationId`. Provider rejection, throw, malformed output, and
timeout are terminal for provider-owned paths; the local operator is an
explicit loopback fallback only after no-provider or not-applicable resolution.

Legacy unprefixed database names may appear only in migration compatibility
code that upgrades checkouts of the earlier experimental multiplayer branch.
All newly written storage uses the `p6r_` schema.

`scripts/check-p6r-namespace` enforces the exported-symbol rule from the Git
diff and guards the committed canonical inputs to the generated SDK plus the
wire-level names most likely to leak into a plugin. Its adversarial witness
proves an exact approved facet export passes while an unrelated export—even
one containing `Facet`—still fails. Additions to either downstream contract
must extend the checker and witness in the same patch.
