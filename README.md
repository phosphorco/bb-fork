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

The current base is exact upstream commit `01affc197dc621cddc7343e09b1c5c10a5b9efcb` (BB 0.46.1, SDK 0.6.52). The lock records a reviewed source receipt rather than a moving branch or inferred release tag.

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

The fifty-five patches listed in `patches/series` form the current implementation
candidate. Queue numbers 0022, 0027, 0030, 0048 and 0052 are intentionally absent: 0022 is a
historical gap, 0052 was retired in favor of native `parentNotifications: "stuck"`,
and the former 0027 Monaco routing backport is supplied by
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
retains the native sidebar layout-provider data seam in the current rail.
Removed upstream navigation and header slots are not restored. Patch 19 preserves the additive Codex agent-message
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
0141; the identity/context bridge now follows upstream 0144 as migration 0145. Patch 42
recognizes the exact preceding fork bridge receipts (including the selected BB 0.45 receipt) when
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

Patch 52 is retired. Use native `--parent-notifications stuck` for strict child
threads; interruptions, failures, and blockers notify the parent while successful
completion stays silent. Reparenting notices remain. See the
[retirement and rollout notes](docs/no-automatic-parent-followups.md).

## Parent notification policy — 2026-10-30

Cole selected native `stuck` as sufficient and approved removing patch 0052.
The CLI flag and API/SDK `noAutomaticParentFollowups` field are removed from the
selected source. Existing reserved metadata becomes inert; review affected threads
before activation, adopt native `stuck` where appropriate, and preserve deliberate
`off` settings. This source change does not migrate live threads or restart the
service.

The preceding 53-patch queue's historical verification receipt records tree
`5789e7b1c5405f4bd85b372bc6827716dec8f7a9`. Frozen install, queue/namespace
verification, full typecheck (105 tasks) and full build (57 tasks) passed in a
temporary verification checkout. Generated CLI help, guide and SDK declarations
omit the retired option. Native parent outcome/blocker/creation/update tests passed.
The full test graph (73 tasks cached) completed with failures in three packages;
serial/scratch reruns cleared the PR-workflow, Side Chat and fault-barrier failures. Two installer
fixture assertions about `~/.local/bin/bb` still fail on isolated rerun and also
reproduce on the original selected source (`40719526c2a5b268588064dcc7b7ae99c890d3eb`)
under the same minimal test environment. Their underlying cause is not diagnosed;
the installer source and tests are unchanged by this retirement. This is not a fully
green broad-test receipt. Test scratch requires `/tmp` for fault barriers and
file-heavy Side Chat fixtures; `/var/tmp` avoids this host's unrelated `/tmp/.git`
ancestor marker in command-discovery fixtures. Test with no inherited provider
authentication. No workspace gitlink or active runtime was changed.

## Previous source verification receipt — 2026-10-16

The 223-commit upstream refresh retains all 49 selected logical patches, narrows
0018 to its existing layout data seam, and adds fixture-only follow-up 0060 and CI portability correction 0061.
The queue replays to `a957cedd611da0eab516375628a5b45ee8ff8a67`.
Frozen install, 164 typecheck/build tasks, and 106 test-graph tasks passed.
The app passed 5,932 tests and the server 3,757; the bridge migration suite
passed 88 cases. A separate sequential integration run passed 74 tests.
Desktop tests are excluded. Earlier timing failures remain separate observations;
the final stable graph passed. Queue replay and namespace verification are required
by `scripts/verify`.

The bridge follows upstream 0144 as 0145 and preserves exact historical bridge
receipts. It stages queued-message attribution durably across upstream 0143's
queue rebuild and restores it after success or on reopen. Upstream parent
notification settings coexist with 0052 because neither `stuck` nor `off`
implements the selected failure-only opt-out. Required inference uses downstream
host protocol 239 after upstream's 238. SDK artifacts must bind to the result tree.
See [refresh dispositions](DOWNSTREAM.md#upstream-refresh--2026-10-16).

This is a source receipt. The normal materialization and running service have
not been replaced or restarted; plugin and combined-host acceptance remain
separate gates before promotion.

## Previous source verification receipt — parent followups

Patch 52 now allows failed child outcomes through the opt-out. The updated queue
replays to `2371fec864b822532f71ce52069301f13d36b820`. The server/CLI
build and typecheck, 17 policy tests, 45 CLI tests, and queue replay passed.
See [behavior and maintenance](docs/no-automatic-parent-followups.md).

The initial implementation passed full typecheck, build, database tests and
focused feature suites. The broad test graph
reported six failures; reruns isolated environmental/timing failures, with the
existing child-outcome failures also reproduced against the original notification
implementation. See [the complete verification boundary](docs/no-automatic-parent-followups.md#verification--2026-10-09).
The running server has not been restarted for this source change.

## Earlier source verification receipt

The preceding source (tree `81da17d778dcf19648c77a726b7f5cd41ec2d3f0`) passed
workspace typecheck and build (165 tasks), a per-patch typecheck of every
exported commit in order, and the package test graph run with an isolated
`HOME`, disk-backed temporary storage and BB session variables removed:
20,357 tests passed across 92 packages, with the fault-barrier suite run under
`/tmp` as it requires. The database package passed 660 tests. The 0142 bridge
passed a migration rehearsal on a private copy of bb-machine state through the
database entrypoint only; its receipt is in the 2026-10-08 refresh notes in
DOWNSTREAM.md. Electron desktop tests are excluded. Runtime, host policy, and
browser acceptance are checked at activation.

The CI follow-up 0061 removes seven comments rejected by provider lint policy, makes Monaco’s Pkl tokenizer self-contained using an identical local implementation, and scopes the forkable-import test exception to the Claude bridge acceptance fixture that intentionally composes Account Pool. No production cross-plugin import is exempted. SDK declarations and executable behavior are unchanged. Full lint passes all 48 tasks; Monaco typecheck passes. The existing SDK archive remains bound to its original 975e38f02f1a source receipt and identical SDK source tree.

## Explicit environment diagnostic classification — 2026-11-05

Patch 65 requires core `secret: boolean` and plugin `experimental_secret: boolean`,
preserves ordinary diagnostics and actual provider environment bytes, and rejects
invalid or failed routing/authentication contributions before provider launch.
Managed shell values retain their immutable provenance across synchronization.
Host-daemon protocol 240 and native migration 0146 are a coupled source cohort;
populated unclassified environment stores stop before any migration mutation.

The 54-patch candidate replays to tree `9441a1e0da4ff55072b4f5b68a00f08b649251d3`. Native
build/typecheck passed 66 tasks across the selected product scopes, with focused
runtime, recovery, daemon, SDK, account-pool and public-read tests. The prior
53-patch receipt above remains historical evidence. This source candidate is not
a deployment or workspace-gitlink promotion receipt. See the materialized
`docs/environment-diagnostic-classification.md` for the finite source-attested
credential-slot read policy, operator cutover obligation and upstream removal
boundary.
