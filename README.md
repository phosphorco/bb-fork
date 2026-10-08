# bb-fork

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs attribution in this trusted shared deployment. Use verified people when
> available, applicable carried attribution next, and a stable machine actor
> otherwise. The owned Tailnet listener also retains machine attribution when
> person evidence is missing or unusable.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.

## Fork changes are a last resort

Do not add or grow a patch here when native BB can deliver the feature. Build
it as a plugin in `bb-plugins` or `bb-community-plugins` using the public
Plugin SDK, existing surfaces (composer banners, panel and header actions,
overlays anchored the way Sticky Notes does, thread storage, host watchers,
plugin storage), and shared packages such as `bb-identity`. Accept a somewhat
worse design, an overlay instead of a reflowed layout, or a documented
dependency on current DOM structure rather than patching BB.

A plan may propose a fork change only when it proves that **no usable
experience at all** can be delivered without one. The plan must:

1. name the exact capability that is missing, not merely less convenient;
2. list each native and plugin approach considered and show concretely why
   each one cannot deliver any working experience, not just a worse one;
3. state the smallest possible patch, its upstream-sync cost, and how it
   would be removed or upstreamed;
4. receive Cole's explicit approval before any patch is written.

"Cleaner", "more robust", "better UX", or "would be nice as a first-class
slot" are not sufficient reasons. Reviewers must reject plans that skip this
justification.

This is a thin, auditable deployment overlay for [get-bb/bb](https://github.com/get-bb/bb). It does not carry a second copy of upstream source and it does not treat a long-lived Git branch as the release definition.

The current base is exact upstream commit `c9649eae71edd2a9da097f8325dde25d8260e5b1`. The lock records a reviewed source receipt rather than a moving branch or inferred release tag.

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

The forty-seven patches listed in `patches/series` form the current implementation
candidate. Queue numbers 0022, 0027, 0030 and 0048 are intentionally absent: 0022 is a
historical gap, the former 0027 Monaco routing backport is supplied by
upstream commit `283e6d7`, and 0030 and 0048 were retired at the 2026-10-08
refresh because upstream #4976 and #5127 supersede them (see DOWNSTREAM.md). Obsolete
compatibility-only follow-ups were folded into the logical patches they verify,
and the old timeout-only Pi provider patch was dropped because upstream removed
that test. Plugins use upstream `auth: "none"` for routes that validate their own
connection tokens. Patch 15 consolidates the native identity work, including
the authored minimal sender wrapper. It adds machine attribution and removes
native person admission callbacks and signed browser lineage while preserving accepted
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

Patch 16 automatically selects the installed Tailnet identity provider when
`BB_TAILNET_IDENTITY_OWNED_HOST` already declares the Serve authority. Custom
`BB_P6R_IDENTITY_BOUNDARY` configuration takes precedence. Ordinary requests
without person evidence retain machine attribution.

Patch 17 isolates ACP native-root tests from the caller workspace. Patch 18
adds the native sidebar layout-provider seam while retaining the existing
plugin layout contract, native behavior, and generic Plugins/Skills resource
helper. Patch 19 preserves the additive Codex agent-message
phase. Patch 20 keeps workflow-shell tests independent of ambient loaded state,
and patch 21 settles virtualized path-browser cleanup.
Patch 34 adds the configured owned Tailnet listener and preserves the approved
machine fallback when person evidence is absent or unusable. Plugin HTTP and
RPC routes retain their own checks; local CLI and unconfigured instances also
retain machine attribution.
Patch 35 validates the Tailnet port before binding either listener, closes the
primary listener if the second bind fails, and starts detached recovery only
after the configured listeners are ready.
Patch 36 adds restart fault barriers for Perspectives. Patches 37–39 keep CLI
and agent-runtime tests aligned with the current artifact and error contracts.
Patch 40 bridges the exact historical bb-machine core migration ledger and
identity column order observed in the private migration rehearsal.
Patch 41 regenerates the downstream schema snapshot after upstream migration
0141; the identity/context bridge now follows it as migration 0142. Patch 42
recognizes the exact preceding fork bridge receipts (BB 0.43 and BB 0.44) when
upgrading an already bridged database, without rewriting its migration history. Patch 43 aligns
host dispatch tests with the downstream result contract.
Patch 44 gives Codex thread resume the configured thread construction deadline,
covering bridge initialization and router startup before the native resume reply.
Patch 45 carries that remaining deadline into the Codex child request and leaves
time for cleanup; upstream no longer issues optional usage reads during resume.

Patches 46–47 expose the downstream `experimental_p6rPrompts` synchronous
renderer and adapt selected server-owned prompt producers. They retain the
native identity and sender behavior already carried by this queue. The generated
plugin-command skill adapter and prototype example are excluded. See the
[prompt maintainer map](plans/p6r-prompts-maintainer-map.md) for stable IDs,
producer boundaries, replay assumptions and verification limits. The source-only
receipt does not activate prompt customization in a running deployment.

Patches 49–51 are performance changes: participant projection watermarks, the
delegating-item partial-index hint, and incremental extension of the timeline
ordering context on top of upstream's split ordering cache.

## Verification boundary for this source receipt

The locked source (tree `81da17d778dcf19648c77a726b7f5cd41ec2d3f0`) passed
workspace typecheck and build (165 tasks), a per-patch typecheck of every
exported commit in order, and the package test graph run with an isolated
`HOME`, disk-backed temporary storage and BB session variables removed:
20,357 tests passed across 92 packages, with the fault-barrier suite run under
`/tmp` as it requires. The database package passed 660 tests. The 0142 bridge
passed a migration rehearsal on a private copy of bb-machine state through the
database entrypoint only; its receipt is in the 2026-10-08 refresh notes in
DOWNSTREAM.md. Electron desktop tests are excluded. Runtime, host policy, and
browser acceptance are checked at activation.
