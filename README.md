# bb-fork

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


This is a thin, auditable deployment overlay for [get-bb/bb](https://github.com/get-bb/bb). It does not carry a second copy of upstream source and it does not treat a long-lived Git branch as the release definition.

The current base is exact upstream commit `10bacbc0fb1ead6c1f1a728b395bdb1f60e52f93` (`Skip pnpm install in env setup when node_modules already matches (#3433)`, bb-app 0.42.1). The lock records a reviewed source receipt rather than a moving branch or inferred release tag.

The deployable source is exactly:

1. the commit in `upstream.lock`, also pinned by the `upstream/` submodule;
2. the ordered mail patches in `patches/series`;
3. the resulting Git tree in `result-tree.lock`.

Materialize a disposable checkout with:

```sh
git submodule update --init
./scripts/verify
./scripts/materialize
./scripts/check-p6r-namespace build/bb "$(cat upstream.lock)"
cd build/bb
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

`scripts/materialize` refuses to overwrite an existing checkout. The materialized tree is disposable; make durable changes as patches in this repository instead.

Run `./scripts/delta-report` to see the complete downstream footprint. See [DOWNSTREAM.md](DOWNSTREAM.md) for patch intent and compatibility boundaries.

## Updating upstream

1. Advance the submodule to a reviewed upstream commit and copy its full SHA to `upstream.lock`.
2. Replay the logical downstream commits in a temporary bb worktree, resolving against current behavior rather than preserving obsolete component locations.
3. Regenerate DB migrations, bundled SDK declarations, and templates using upstream's generators.
4. Export the reviewed commits with `git format-patch --full-index --binary`, replace `patches/series`, and refresh `patches/sha256`.
5. Materialize with `--committer-date-is-author-date`, then record `git rev-parse HEAD^{tree}` in `result-tree.lock`.
6. Run `./scripts/verify` and the full CI suite before tagging this overlay repository.

The twenty patches form the current implementation candidate. Patch 4 was
removed: plugins use upstream `auth: "none"` for routes that validate their own
connection tokens. Remaining patch filenames retain their stable numbers. Patch 16
consolidates the previous native identity patches 16–23, including the authored
minimal sender wrapper. It adds machine attribution and removes native person
admission callbacks and signed browser lineage while preserving accepted
original authors, later editors, queue/retry history and native command dispatch.
The preceding patches retain the independent facet, execution, plugin, Agent
Connect and editor changes.

The transcript amendment also stays in patch 16. Native messages use minimal
`[sender=…]` frames and group-local `<attached>` context. Producer integrations
opt into a plugin-generation rendering policy through the existing identity
extension. Their SDK sends and explicit queues carry a presentation hint so
core preserves the producer frames without adding a synthetic machine wrapper.
The hint is not a credential. Accepted producer input survives normal queue and
retry handling; ordinary native requests retain person or machine attribution.
This adds one optional public experimental protocol member, with no new storage
field or additional patch.

This queue is the current implementation candidate for the trusted shared
deployment. The supported source replay is the authoring and verification path;
it does not change a running deployment. A normal deployment may remain on an
earlier historical composition until root completes integration and activation.
Plugin invocation expiry, obsolete host session-age configuration, and
issuance-only checks have been removed under the approved ADR. The delivery
plan records the remaining integration and runtime gates. The queue replays to
the exact tree in `result-tree.lock`; historical deployments and review
artifacts are evidence of their own composition, not proof that this candidate
is active.

Patch 17 automatically selects the installed Tailnet identity provider when
`BB_TAILNET_IDENTITY_OWNED_HOST` already declares the Serve authority. Custom
`BB_P6R_IDENTITY_BOUNDARY` configuration takes precedence. Ordinary requests
without person evidence retain machine attribution.

Patch 18 isolates ACP native-root tests from the caller workspace. Patch 23
adds the native sidebar layout-provider seam while retaining the existing
plugin layout contract. Patch 24 preserves the additive Codex agent-message
phase. Patch 25 restores the original generic resource-sidebar helper that the
native Plugins and Skills entries retain.
