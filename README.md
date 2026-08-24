# bb-fork

This is a thin, auditable deployment overlay for [get-bb/bb](https://github.com/get-bb/bb). It does not carry a second copy of upstream source and it does not treat a long-lived Git branch as the release definition.

The current base is exact upstream commit `5205d98a74ed5a22469e521cf1f86b00b8232827` (`Scroll the desktop model picker as one region (#2310)`). The lock records a reviewed source receipt rather than a moving branch or inferred release tag.

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

The six patches are deliberately reduced onto current upstream behavior. The first reconciles the verified-identity, durable-authorship, presence, and managed-deployment guarantees from the earlier multiplayer queue. The second adds the revision 1 generic thread-facet spine, plugin capability, bounded public query/CLI, and saved web/mobile projections. The third keeps the facet quarantine fixture namespace-neutral under the bounded generic Thread Facet exception. The fourth applies the revision-bound faces-only participant presentation to ordinary web and native sidebar rows. The fifth preserves an authenticated standalone built-in `/compact` selection through sender presentation so the provider bridge executes compaction rather than receiving ordinary prose. The sixth aligns deployment fixtures with the merged authorship and managed-upgrade contracts so the production TypeScript gate covers the complete queue. Implementation-only workflow files are excluded.
