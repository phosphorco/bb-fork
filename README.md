# bb-fork

This is a thin, auditable deployment overlay for [get-bb/bb](https://github.com/get-bb/bb). It does not carry a second copy of upstream source and it does not treat a long-lived Git branch as the release definition.

The current base is exact upstream commit `c942421a454ee4157004274053eec5f36c81d7eb`, the canonical protocol-147 deployment base. The overlay retains the `bb-app@0.39.0` package contract while replaying the reviewed identity work against that shipped protocol and migration lineage.

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

The thirty-four patches are organized by product capability and receipt boundary. Patches one through fourteen establish the reviewed protocol-147 deployment base; patches fifteen through thirty carry the provider-qualified identity, participant, migration-recovery, and packaged-runtime work; and the final four patches adapt its generated, migration, namespace, and interrupted-ledger witnesses to the canonical upstream layout. Implementation-only workflow files are excluded.
