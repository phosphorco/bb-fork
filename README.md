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

The twenty-four patches are deliberately reduced onto current upstream behavior. The first six establish the current identity/presence spine, Thread Facets, condensed participant presentation, structured `/compact` preservation, and deployment fixtures. The next eight forward-port the installed identity-coherence guarantees that remain behaviorally relevant: plugin PrincipalKey authority, safe avatar fallback, migration recovery, supervised long-running startup, coherent packaged runtime entrypoints, current-protocol witness alignment, completed-ledger recovery, and trusted Tailnet admission. Two patches close the generalized-query export and SDK type-import collisions revealed by the current topology. The final eight preserve server-authored, distinct claimed principals for remote no-provider clients, adapt the unbounded-startup witness to the current deterministic test seam, align the remaining optional-field and scheduler validation checks, remove obsolete test-only startup deadlines without restoring a product deadline, keep the expanded background-task SQL plan witness on the complete prepared statement rather than its intentionally truncated log form, align identity serialization plus deterministic event-order assertions with those contracts, expose the provider/request serialization mismatch, and then supersede it with one canonical actor key shared by provider handles, HTTP/RPC resolution, and the fake SDK host. Later structure supersedes only the obsolete name-row tooltip and participant-query naming patches rather than resurrecting them. Implementation-only workflow files are excluded.
