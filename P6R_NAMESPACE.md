# Phosphor downstream namespace

Every reusable or externally observable multiplayer identity, authorship,
presentation, or provider identifier introduced by this overlay must identify
itself as downstream-owned:

- values, functions, methods, fields, and props contain the explicit `p6r`
  namespace (for example `p6r...`, `createP6r...`, or `getP6r...`);
- React hooks use `useP6r...`, preserving React's required `use` prefix while
  keeping the downstream namespace explicit;
- types and components use `P6r...`;
- constants use `P6R_...`;
- HTTP paths, WebSocket discriminators, headers, CLI commands, persistence
  keys, tables, and columns contain `p6r`.

Thread Facets, execution selection, and Pkl highlighting are independently
named generic features in the reviewed first-principles composition. Their
contracts do not masquerade as upstream identity APIs. Identity modules and
symbols retain the explicit `p6r` namespace, while additive facet storage keeps
the `thread_facet_*` namespace.

Identity kernel actors carry opaque provider-issued identity keys and frozen
presentation snapshots. Native request events use `p6rAuthors`; neither that
field nor a plugin invocation actor is reconstructed from transcript text or
client claims. Plugin consumers use the public bb-identity binding. Native
identity inspection is explicitly `system.p6rIdentity` and
`/api/v1/system/p6rIdentity`.

This includes internal contracts shared between bb packages, even when they are
not currently exported by `@get-bb/plugin-sdk`. Ordinary implementation locals
such as `request`, `response`, or `rows` do not become a contract merely because
they occur in a downstream implementation.

The purpose is compatibility hygiene. A plugin author should never mistake a
Phosphor-only API for an upstream bb API. For example, the overlay exposes
`bb.experimental_p6rIdentity`; it must never expose the same authority as a
generic `bb.identity` member or through legacy `showAuthor` or `actorHandle`
fields.

The operator selects the exclusive provider boundary. Provider rejection,
throw, malformed output, and timeout are terminal for configured native sends.
An unconfigured host retains ordinary native behavior without claiming a person.

Legacy unprefixed database names may appear only in migration compatibility
code that upgrades checkouts of the earlier experimental multiplayer branch.
All newly written storage uses the `p6r_` schema.

`scripts/check-p6r-namespace` enforces identity-module export names from the Git
diff, guards the committed canonical Plugin SDK and server identity inputs, and
rejects the wire-level legacy names most likely to leak into a plugin. Its
adversarial witness proves a `createP6r...` export passes while an unprefixed
identity-module export fails. Additions to the identity contract must extend
the checker and witness in the same patch.
