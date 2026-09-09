# bb-fork

This is a thin, auditable deployment overlay for [get-bb/bb](https://github.com/get-bb/bb). It does not carry a second copy of upstream source and it does not treat a long-lived Git branch as the release definition.

The current base is exact upstream commit `960255b98ce3dccdcb5754eb67a7f989236602a1` (`Prepare bb-app 0.42.0 (#3106)`). The lock records a reviewed source receipt rather than a moving branch or inferred release tag.

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

The nineteen patches are the reviewed first-principles composition previously
verified as an isolated candidate. They establish the selected identity kernel,
retain the required facet and execution behavior, add consumer witnesses and
capability-authenticated routes, complete mention targets and sidecar
migrations, preserve plugin/sidebar compatibility, harden execution and
authentication boundaries, retain Agent Connect queue/history behavior, and
include the reviewed Pkl syntax-highlighting change. Patch 16 adds
`/settings/p6rIdentity` and provider-verified native message authorship while
preserving upstream command dispatch. Patch 17 keeps directory refresh separate
from authentication revocation and refreshes presentation on verified admission.
Patch 18 preserves original authors through edits and records the latest editor
separately. Patch 19 aligns the public contract test expectations with those
additions. The queue replays to
the exact tree recorded in `result-tree.lock`; the historical review artifacts
under `plans/artifacts/` remain supporting evidence rather than a second build
path.
