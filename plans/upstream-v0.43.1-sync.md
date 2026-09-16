# Upstream bb 0.43.1 synchronization ledger

Status: target selected and replay rehearsed; source receipt not advanced

Target release: `desktop-v0.43.1`

Target commit: `267938526dfcbc0edb228ce827b5bec202c1af97`

Current locked base: `10bacbc0fb1ead6c1f1a728b395bdb1f60e52f93`
(`bb-app@0.42.1` plus 133 post-release commits)

The target is the immutable 0.43.1 release commit, 100 commits after the
current lock. The upstream range changes 1,980 paths. This ledger selects the
target for porting; it does not change `upstream.lock`, the submodule gitlink,
the patch queue, or `result-tree.lock` before the complete queue is reviewed
and verified.

## Reproducible replay result

Run from the overlay repository:

```sh
./scripts/probe-upstream-replay desktop-v0.43.1
```

The probe verifies patch hashes, creates a disposable detached upstream
worktree, and replays the canonical series with three-way merge semantics. It
does not modify the overlay or an existing materialization.

The 2026-09-15 rehearsal stops in patch 0001 after zero completed patches. Its
13 conflicted paths are:

```text
apps/server/src/server.ts
apps/server/src/services/plugins/plugin-api.ts
apps/server/src/services/plugins/plugin-service-internal.ts
apps/server/src/services/plugins/plugin-service.ts
apps/server/src/services/threads/dispatch-attempt.ts
apps/server/src/services/threads/queued-messages.ts
apps/server/src/services/threads/thread-provisioning.ts
apps/server/test/services/plugins/plugin-authoring-docs.test.ts
packages/config/src/env-vars.ts
packages/db/src/data/index.ts
packages/db/test/data/threads.test.ts
packages/plugin-sdk/src/__tests__/public-types.test.ts
packages/plugin-sdk/src/backend-contract.ts
```

Patch 0001 touches 65 paths; 26 of them also changed in the selected upstream
range. Across the rest of the queue, the largest static overlap is patch 0016
(50 of 90 touched paths), followed by patch 0005 (16 of 26), patch 0002 (14 of
21), and patch 0007 (9 of 10). Static overlap is a routing signal, not a merge
result.

## Semantic port boundaries

Resolve the first patch as a current-architecture port, not by choosing the old
patch side wholesale:

1. Preserve upstream 0.43's machine APIs and plugin API keys while adding the
   optional P6R protocol surface.
2. Integrate P6R accepted-operation commits with the new durable
   thread-provisioning lifecycle. Upstream renamed and reworked pending-start
   state; do not restore the 0.42 pending-start implementation.
3. Preserve upstream plugin service exports, update scheduling, provider
   lifecycle, and RPC boundary errors while binding P6R invocation scope around
   handlers that explicitly use the protocol.
4. Keep upstream queue input flattening and merge the immutable P6R receipt
   checks at the accepted-operation transaction boundary.
5. Preserve all current config, database, and public SDK exports. The conflicts
   in these files are additive export/key collisions, not reasons to remove new
   upstream APIs.

The high-risk follow-up is patch 0016 because it crosses native authorship,
timeline, settings, queueing, and the same provisioning lifecycle. Port and
test it only after patches 0001–0015 form a coherent intermediate tree.

## Execution sequence

1. Re-express patch 0001 on the exact target as a logical commit and run its
   focused P6R, plugin SDK, database, and provisioning tests.
2. Port patches 0002–0015 in order, folding only corrections whose independent
   review boundary is obsolete on 0.43.1. Record every old patch in
   `Ported-From` trailers.
3. Port patch 0016 against the resulting lifecycle and verify native send,
   edit, queue, retry, command, identity settings, and timeline invariants.
4. Port patches 0017, 0018, and 0023, retaining upstream machine and sidebar
   layout behavior.
5. Regenerate only generator-owned migrations, SDK declarations, bundles, and
   lockfile changes required by the selected source.
6. Export the reviewed commits with full-index binary patches, refresh
   `patches/series` and `patches/sha256`, and then update the upstream submodule,
   `upstream.lock`, and `result-tree.lock` together.
7. Run `./scripts/verify`, namespace verification, frozen install, typecheck,
   tests, and build in a fresh materialization. The upstream lock remains at
   0.42.1 until all gates pass.

## Completion criteria

- All 18 canonical logical patches have an explicit 0.43.1 disposition.
- The new queue replays from the exact target without conflict or dirty state.
- Generated database and SDK artifacts are source-consistent.
- Focused identity, queue, provisioning, plugin, sidebar, and ACP regressions
  pass before the full repository gates.
- `README.md`, `DOWNSTREAM.md`, locks, hashes, and submodule gitlinks describe
  one exact verified composition.
