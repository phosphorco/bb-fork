# bb-identity plugin closeout

Updated 2026-09-06. This is a release-readiness audit of existing plugin
consumers. It does not authorize an upstream sync, a registry publication, a
host feature, or a replacement for a feature's durable data.

## Boundary used by this audit

Every reviewed consumer imports only the public package root or one of its
declared entries: `/model`, `/host`, `/server`, `/state`, `/bb`, `/client`, and
`/react`. No reviewed feature imports package implementation files or raw
identity-adapter scopes.

The organization plugins use `workspace:*`, which is correct for their
monorepo build and is rewritten by the existing Bun pack path. A fresh
`bun pm pack` of Agent Connect produced a manifest dependency of
`"@phosphorco/bb-identity": "0.1.0"`; it did not retain `workspace:*`.
That is a packed-manifest fact, not a direction to hand-edit consumer manifests.
An external installer must be able to resolve that emitted version through the
selected release source. The package has a checked tarball and public export
surface, but no registry publication has occurred.

## Consumer closeout

| Consumer | Public interface in authored source | Preserved behavior/data boundary | Checked evidence | Concrete delivery blocker and smallest action |
| --- | --- | --- | --- | --- |
| Thread Progress — Thread Sections | `/bb`, `/model`, `/state`, `/client`, `/react`, `/server` | Owner-separated drafts, view-as/read-only projection, legacy recovery, collaborator state and existing ProgressInbox controls remain feature-owned. | 319 passed/1 skipped plus typecheck; controlled component/browser recovery and actor A→B→A evidence; sealed installed artifact serves exact app bytes on a candidate loopback host. | No source-interface blocker. Its packed manifest will carry the resolved identity version; prove the existing sealed install against the selected release source. |
| Agent Connect | `/bb`, `/model`, `/host` | Existing cast/call/deprecated send, chat/stream, rotate/revoke and mode behavior are retained. Immutable external author/input fingerprint, durable reservation and final replay remain feature-owned. | 54 feature tests and typecheck, including corruption uncertainty, first-send/restart, final replay and receipt/row matching. A fresh `bun pm pack` emitted `@phosphorco/bb-identity: 0.1.0` in its archive manifest and included the durable submission sources. | No package API blocker. Baseline exact call-to-turn correlation is explicitly unavailable and remains visible uncertainty; it is not a reason to block cast/read/stream delivery or add a fallback matcher. The selected release source must satisfy the packed `0.1.0` dependency. |
| Notifications | `/bb`, `/model`, `/server` | Inbox/read/handled/snooze/follow, durable delivery leases and initiating-tool author stay in the feature store. Credential delivery remains credential-scoped. | 63 passed/1 skipped with leaf typecheck; candidate PluginService composition covers public person forwarding, current profile, route registration and credential claim/rejection. | No consumer source blocker. It targets published SDK 0.4.47 declarations; release must keep that declared SDK target and resolve the identity package outside the workspace. |
| ntfy | `/bb`, `/model`, `/server` | Actor-specific link/begin/complete/unlink and durable retry/credential behavior remain in the feature. | 17 passing source tests and leaf typecheck; the composed Notifications/ntfy route witness covers forwarding and credential rejection. | No consumer source blocker; same published identity-package and declared SDK target boundary as Notifications. |
| Rosetta Slack | `/bb`, `/model` | Existing inbound/send/reply/thread mapping, recovery and source formatting remain feature-owned. Slack author/input facts are immutable per durable submission. | 156 feature tests, including unsupported lookup on first send, concurrent reservation, restart uncertainty, changed input rejection and final replay. | No consumer source blocker. Delivery requires the common external package-resolution proof; it must not use a live Slack send as installation evidence. |
| Identity Boundaries | `/bb`, `/model` | Configured provider evidence, activation/refresh/expiry, directory lookup and exact historical recovery remain feature behavior. | 36 leaf tests, typecheck and build for the public provider flow. | No source blocker; common external package-resolution proof only. |
| Agentation (organization) | `/bb`, `/model` | Feedback capture/stage/send and explicit unavailable/profile fallback remain independent of a provider name. | **89/89** current leaf tests pass; the closure ledger's typecheck evidence remains current. | No source blocker; common packed-package resolution proof only. |
| Agentation → Mentions (community) | package root, `/bb` | Queued feedback delivery retains a capture-time source label and historical author marker; it does **not** represent later delivery as a live native verified action. | **95/95** current leaf tests pass. The earlier local npm-installed public-artifact, community typecheck/build and full-rerun evidence remains available. The cold archive witness loads the packed community closure while the reviewed identity archive is supplied at the temporary consumer top level; this is compatibility evidence, not shipped-package resolution. | **Direct dependency selected:** add exact `@phosphorco/bb-identity: 0.1.0` only after that version is available from the selected registry, then generate the registry-derived lock resolution and run the isolated install proof. The shared manifest and lock remain unchanged until then. |

## Native Thread Manager is not an identity-package consumer

Thread Manager deliberately has no `@phosphorco/bb-identity` import or
manifest dependency. Its participant facet keys, continuation/paging and batch
execution use native host contracts and their own key domain. Adding a
normalized identity reader would duplicate the authoritative host projection
and risk crossing that domain boundary.

Thread Progress has both kinds of work: Thread Sections is the public-package
consumer above; native Thread Manager facets/execution are host parity work.
The latter must be evaluated by its native acceptance witnesses, not added to
today's plugin publication checklist.

## Today's concrete distribution boundary

1. **Provide the version emitted by the packer.** The checked review tarball is
   `@phosphorco/bb-identity@0.1.0` and passes `npm publish --dry-run`; no
   registry publication occurred. Agent Connect's existing Bun pack path emits
   that exact version automatically. The release owner must make it resolvable
   through the selected registry/artifact channel, then run one cold
   packed-consumer install. No manual `workspace:*` replacement is indicated.
2. **Add the selected community direct dependency after publication.**
   Agentation → Mentions will use exact `@phosphorco/bb-identity: 0.1.0`, not
   intentional bundling. Keep the shared manifest and lockfile unchanged until
   a registry can supply that version. Then generate the lockfile normally so
   its `resolved` URL and `integrity` come from npm; do not invent an integrity
   or commit a local `file:` reference.

There are no other concrete plugin-source blockers in this audit. In
particular, native Thread Manager facet/execution work, the known baseline
Agent Connect exact-correlation limitation, and ordinary native attribution
work are not package publication blockers and should not be expanded here.

## Cold archive witness and pending community diff

This bounded temporary-consumer check did not publish, alter a shared
`node_modules`, or change either authored manifest. It used:

- identity archive
  `/tmp/bb-identity-react-peer-receipt.KeV10c/phosphorco-bb-identity-0.1.0.tgz`, SHA-256
  `9f79f473ffb6e4c16db7bd25cc29be66cd8ab8dacc1f5b0980c113cca75ac48c`;
- freshly packed community archive
  `/tmp/bb-identity-community-release-witness.d5KjIU/phosphorco-bb-plugin-agentation-mentions-0.1.0.tgz`, SHA-256
  `e1d76e05e97d15462489483d36eb51e3a33d046ee07b5c6c044ac06cb3584c26`.

`npm pack --pack-destination … --json` produced the community archive. A new
temporary consumer declared the reviewed identity archive directly and the
community archive, with the documented fixture pins `@get-bb/plugin-sdk@0.4.47`
and `react`/`react-dom@19.2.1`; `npm install --ignore-scripts
--package-lock=false --no-audit --no-fund` then loaded the packed public
closures. It was rerun with the fresh archive after the peer correction.

The witness dynamically imported every declared identity runtime entry (root,
`/model`, `/host`, `/server`, `/testing`, `/state`, `/bb`, `/client`, `/react`)
from the archive. It then loaded the packed community `lib/identity.ts`,
`server.ts`, and `dist/server.js`. The packed app reached its explicit BB host
injection requirement (`definePluginApp` from `globalThis.__bbPluginRuntime`),
which is expected for a plugin app and is not an unresolved identity import or
a claim that a generic npm process is a BB app host.

The community archive's own manifest still lacks the direct dependency, so the
temporary top-level archive resolution is **evidence of import compatibility,
not evidence that the shipped community archive can resolve it by itself**.
After publication, the reviewable authored manifest change is exactly:

```diff
 "dependencies": {
+  "@phosphorco/bb-identity": "0.1.0",
   "@hugeicons/core-free-icons": "4.2.3",
```

The subsequent release command must be run only after the registry contains
that version, from `community-plugins/`: generate the normal npm lockfile,
inspect the generated identity package `version`, registry `resolved` URL and
`integrity`, run `npm ci`, pack the plugin, and repeat a fresh temporary
consumer install. That sequence leaves no local archive path or fabricated
registry metadata in tracked files.

## Final package receipt check

The fresh identity archive was extracted and compared by SHA-256 for every
packaged file against the current package's `files` contract: 24 archive files
and 24 current intended files. All runtime bundles, declarations, README and
license match. The sole raw mismatch is `package.json`: Bun pack resolves the
current workspace `catalog:` entries to concrete versions. After resolving the
current manifest through the workspace catalog, it equals the archived manifest
exactly (normalized manifest SHA-256
`6fbbfde316d70a14903a7fff89b90bdcbd6ce29379f8802e130da39fb90c59cd`).

The newest current runtime TypeScript source was `react-runtime.ts` at
2026-09-06 10:59:52; the earliest rebuilt runtime bundle is
`dist/index-runtime.js` at 12:53:02. Declarations compare content-identically
with the archive. This establishes that no current source edit observed after
the build invalidates the reviewed archive. The package directory is presently
untracked in its containing repository, so this is a content/build-order
receipt, not an independent VCS-history assertion.

The former archive with exact React 19.2.1 is superseded: root verified the
candidate host resolves React 19.2.4, while the organization and community
workspaces resolve 19.2.1. The exact peer came from the generator copying the
workspace catalog value, not from a public API requirement. The public React
entry uses React's stable context, element, state/effect/memo/ref/callback and
`useSyncExternalStore` APIs; it does not use a React 19.2-only API. The public
SDK and candidate app manifests declare React `^19.0.0`. The smallest supported
React-19 peer range consistent with those facts is therefore `^19.0.0`.

The generated library definition, current manifest and fresh archive now use:

```json
"peerDependencies": {
  "@get-bb/plugin-sdk": "^0.4.15",
  "react": "^19.0.0"
}
```

The narrow generator test, `sync:check`, package build, package typecheck and
139 Bun + 3 Node package tests pass after regeneration. Two isolated temporary
consumers each installed the fresh archive with SDK 0.4.47 and React/React DOM
19.2.1 or 19.2.4, respectively. In both, every public React component and hook
export was present and `IdentityAvatar` rendered through `react-dom/server`.
This proves the published React entry loads and executes against both current
consumer and candidate-host patch versions; hooks that require a BB app remain
covered by the package's existing bound/browser fixtures rather than a false
generic-host simulation.

`npm publish --dry-run --ignore-scripts --access public` against the fresh
archive passed (24 files; npm shasum
`b86e02b5dc8c9bc219e6ecef6a5d20e9da8ee3d9`). No publication occurred.

## Audit sources

- `plugins/packages/bb-identity/package.json`, `STATUS.md`, `PACKAGING.md`, and
  `type-tests/package-tarball.runtime.test.mjs` for the public entry points,
  139 Bun + 3 Node package check, Bun packing semantics, tarball dry run, and
  current release boundary.
- Fresh bounded witness: `bun pm pack` for Agent Connect, with its archive
  manifest inspected without publishing or installing, emitted
  `@phosphorco/bb-identity: 0.1.0`.
- Consumer `package.json` files and authored imports under `plugins/plugins/`
  and `community-plugins/plugins/agentation-mentions/` for public-entry and
  manifest inspection.
- `fork/plans/bb-identity-completion.md` and
  `fork/plans/bb-identity-feature-parity.md` for retained behavior and latest
  feature-specific evidence. Those plans remain the canonical detailed ledger;
  this file only turns their current state into a small publication checklist.
