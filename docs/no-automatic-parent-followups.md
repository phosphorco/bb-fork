# Native parent notifications: retirement of patch 0052

Cole selected native `--parent-notifications stuck` as sufficient on 2026-10-30.
Patch 0052 is removed from the selected queue, including its CLI option,
`noAutomaticParentFollowups` request field, metadata writer/reader and custom
tests. No replacement fork patch is needed.

For new strict children, use:

```sh
bb thread spawn --project PROJECT_ID --parent-self \
  --parent-notifications stuck --prompt-file /absolute/path/task.md
```

SDK callers use `parentThreadId` and `parentNotifications: "stuck"` with
`threads.spawn`. Existing threads support:

```sh
bb thread update CHILD_ID --parent-notifications stuck
```

`stuck` suppresses successful completion notices and allows failures,
interruptions and approval/question blockers to notify the parent. Reparenting
assigned/removed notices remain. This is an accepted behavior change from the
former failure-only policy. Explicit tells and plugin/workflow deliveries retain
their own behavior. The native default remains `auto`; request `stuck` explicitly.
Lifecycle ownership remains independent and need not be changed. Lifecycle-only
delegation remains compatible and provides no native parent escalation: `stuck`
notices require an actual `parentThreadId`. Choose strict parentage when native
blocker/failure escalation is wanted; lifecycle ownership can still be retained
for archive/delete behavior. Explicit result tells remain useful in either model.
This retirement does not change existing delegation guidance or thread topology.

## Rollout for existing opted-out threads

Removing the patch does not convert existing `_p6r-core-parent-policy` metadata
into native notification settings. Those rows become inert; preserve them and
never reuse the reserved namespace. Before activating the retired-patch build,
inventory affected nondeleted threads with a read-only query on an
operator-authorized database connection or snapshot:

```sql
SELECT t.id, t.parent_thread_id, t.parent_notifications
FROM threads AS t
JOIN thread_plugin_metadata AS m ON m.thread_id = t.id
WHERE t.deleted_at IS NULL
  AND m.plugin_id = '_p6r-core-parent-policy'
  AND CASE WHEN json_valid(m.metadata_json)
    THEN json_extract(m.metadata_json, '$.noAutomaticParentFollowups') = 1
      AND json_type(m.metadata_json, '$.noAutomaticParentFollowups') = 'true'
    ELSE 0 END;
```

Review each thread's native policy and use the supported update command above
for threads that should adopt `stuck`. Include lifecycle-only roots if they may
later acquire a strict parent. A deliberately selected `off` should remain
`off`; there is no blind bulk conversion. Update while the old build still runs
so there is no intervening `auto` delivery window when it stops reading metadata.
Read back each changed thread with `bb thread show CHILD_ID --json` and verify
its `parentNotifications` value. Updating the policy does not require reparenting
or a lifecycle-owner change. Already accepted or queued parent notices are not
retroactively cancelled.

This source retirement does not execute that inventory or modify operator runtime
state, rebuild the active materialization, restart BB, or promote workspace
revisions. CLI/server artifacts and any separately published SDK declarations
must be regenerated from the new selected tree during their normal release.
Remove the old CLI flag and request field from external integrations before
activation, and explicitly send native `parentNotifications: "stuck"` where
wanted. Repository caller searches do not cover every external client; an older
client sending the retired field is not a policy handshake. Verify the stored
native policy rather than assuming that the old field still selects suppression.

## Rollback

Before activation, record the actual deployed revision and reviewed native policy
updates. The previous materialization inspected for this receipt is commit
`40719526c2a5b268588064dcc7b7ae99c890d3eb`, tree
`b5e5c287fa11b6f0275baeeee59cc404d628aeb8`; confirm the deployment rather than
assuming every host uses it. Follow the normal authorized runtime rollout path
when restoring a prior build; publishing this source does not authorize a restart.

Preserve native policy updates and legacy metadata during rollback; do not reset
policies to `auto` or blindly restore a database snapshot. Restoring code with
0052 reactivates legacy suppression for old opted-out threads, so their
interruptions/blockers become silent again unless native `off` already suppresses
all outcomes. New native-`stuck` threads without legacy metadata retain native
behavior. These are different notification behaviors, not an exact inverse
migration.

## Retirement verification — 2026-10-30

Tree `5789e7b1c5405f4bd85b372bc6827716dec8f7a9` replays with 53 selected patches.
The source delta is exactly the inverse of patch 0052: 15 files, 542 lines removed
and four original upstream lines restored. No later patch needed a semantic port.
Frozen install, standard queue and namespace verification, full typecheck and
full build passed. Built CLI help, server bundle, guide and SDK declarations no
longer contain the opt-out option, field or metadata policy. No plugin callers
were found in either plugin repository, including untracked source files.

Native child-outcome (9 tests), blocker (14), public parenting (19) and parent
policy (11) suites passed. The broad graph completed 105 of 108 tasks successfully
(73 cached); PR-workflow and Side Chat suites passed separate reruns (244 and 26 tests), and
fault barriers passed under their required `/tmp` scratch root. Two installer
assertions about the fixture's `~/.local/bin/bb` link still fail on isolated
rerun. The exact two UID-501 cases also fail on the original selected source
`40719526c2a5b268588064dcc7b7ae99c890d3eb` under the same minimal environment
(one case passes, two fail, 50 unrelated tests are skipped in that targeted
baseline run). This establishes that the failures predate removal, without
diagnosing their cause; neither installer code nor its tests changed. Full test
success is not claimed. Use a minimal test environment without inherited
authentication; `/tmp` and `/var/tmp` have different fixture constraints on this host.

The inventory query above was checked on an in-memory fixture for literal true,
numeric/string lookalikes, false, malformed and missing metadata. Live metadata
was neither queried nor converted. The canonical materialization and service
remain on their previous source; normal activation and any SDK publication are
separate from this receipt.

### Credential-safe focused reproduction

From a temporary materialization with locked dependencies installed, run the
native policy suites with only the required environment. The empty GitHub config
and scratch directory are task-owned; neither `HOME` nor `CODEX_HOME` is redirected.
Do not reuse an environment-inheriting launcher or print unredacted failure logs.

```sh
parent_policy_tmp=$(mktemp -d /tmp/bb-parent-policy-check.XXXXXX)
trap 'rm -rf -- "$parent_policy_tmp"' EXIT
mkdir "$parent_policy_tmp/empty-gh"
env -i PATH="$PATH" LANG=C.UTF-8 CI=true VITEST_MAX_WORKERS=2 \
  TMPDIR="$parent_policy_tmp" GH_CONFIG_DIR="$parent_policy_tmp/empty-gh" \
  pnpm exec turbo run test --filter=@bb/server --concurrency=1 --env-mode=loose -- \
  test/threads/thread-parent.test.ts \
  test/threads/child-outcome-gaps.test.ts \
  test/public/public-thread-parenting.test.ts \
  test/internal/internal-interactive-requests.test.ts
```

Inspect bounded, redacted excerpts on failure. The command above covers native
policy behavior; it does not claim full-graph success or runtime activation.

## Historical implementation and verification

The following records describe the retired patch and its own source receipts;
they are not current usage instructions or deployment evidence.

Cole approved this implementation on 2026-10-09 after the metadata-based plan
and four-lens review in thread `thr_ubmxu5kq62`. Cole subsequently requested
that child failures propagate even when the opt-out is enabled.

```sh
bb thread spawn --parent-self --no-automatic-parent-followups --prompt 'Do the work'
```

SDK callers pass `noAutomaticParentFollowups: true` to `threads.spawn`.
The optional boolean is also accepted by `POST /api/v1/threads`. Both CLI and
server must include this change. An older server may discard the unknown field;
this flag is not a compatibility handshake.

## Behavior and storage

The new thread retains its actual parent relationship. Automatic completed,
interrupted, needs-attention, assigned, and removed parent notices are suppressed.
Failed outcomes still notify the parent, including failed turns, workspace setup
failures, and exhausted queued-message retries. Failure delivery bypasses the
opt-out check and uses the existing batching and delivery path. Explicit sends
and workflow/tool deliveries use their existing paths. Suppressing attention notices means the parent will not be alerted when
this child needs a decision.

Creation inserts a separate `thread_plugin_metadata` row under
`_p6r-core-parent-policy`, with `metadata_json` containing
`{"noAutomaticParentFollowups":true}`. The row and thread commit in the existing
creation transaction before creation notifications, observers, and dispatch.
Native origin attribution is retained. No schema, migration, shared Thread
field, or daemon protocol change is needed.

The underscore-prefixed namespace is outside the public plugin-ID grammar, so
public plugin metadata APIs cannot select it. This is an internal namespace
reservation, not protection from trusted code with direct database access.
For non-failure notices, only literal boolean true suppresses delivery. Missing
metadata, false, malformed JSON, invalid values, and lookup errors retain normal
delivery. Invalid storage
and lookup errors are logged without repair; suppression emits a debug record.

The setting is creation-only and persists across restarts, scheduled startup,
and reparenting. New children and forks default to normal delivery. There is no
supported live toggle or retroactive cancellation of already-queued notices.
Existing thread deletion cleanup owns the metadata row's lifetime.

## Why a fork patch is required

The missing capability is a veto over core automatic parent notices while
retaining the native parent-child relationship:

- Ordinary spawning always enables these notices; hiding a child does not stop
  them. Creating a root with lifecycle ownership loses the requested hierarchy.
- Plugin lifecycle listener results are ignored; listeners cannot cancel the
  core delivery.
- The message.dispatch checkpoint is bypassed by core system notices.
- Prompt customization changes text and falls back to native rendering; it
  cannot prevent delivery or the parent's wake-up.
- UI overlays and plugin-local state cannot prevent these server-owned sends.

Patch 0052 adds one creation field, seeds existing metadata, and checks one
shared policy reader at the outcome, attention, and ownership notice paths.
It deliberately keeps the general parent-message transport untouched.
The production changes span ten small source files, plus tests and CLI docs.
Replay overlap is concentrated in the spawn option block, creation request
forwarding, the DB creation transaction, and three notification entrypoints.
Changes to their upstream shape will require a small semantic port. Existing
patches 36 and 47 also touch child notifications, so queue order matters.

If upstream supplies an equivalent opt-out, translate persisted true values to
that policy before retiring this patch. Keep this namespace permanently reserved
so existing rows cannot gain an unrelated meaning. SDK declarations and guide
modules are regenerated by the existing build tasks and remain gitignored.

## Error propagation update verification

Candidate source commit `cb0ae80de`, locked tree
`2371fec864b822532f71ce52069301f13d36b820`:

- All 17 policy integration tests passed. Failed outcomes with ordinary, setup,
  and exhausted-retry contexts are delivered with or without the opt-out;
  completion/interruption/attention/ownership suppression still holds. Metadata
  fallback tests use non-failure outcomes to exercise the policy reader.
- All 45 CLI spawn tests passed.
- Server and CLI typecheck/build passed through Turbo (eight tasks).
- Full patch-queue replay and downstream namespace verification passed.

The broad suite was not repeated for this one-condition behavior change. Its
previous baseline limitations remain recorded below. No server restart or
workspace promotion is included.

## Verification — 2026-10-09

Candidate source commit `4341ad7c6`, locked tree
`49cf6254c49aa92253aa4d875b237c3bc4ce5efa`:

- Frozen dependency install, full typecheck (104 tasks), and full build
  (56 tasks) passed. SDK declarations and CLI guide modules regenerated through
  the existing build graph. Built CLI help advertises the flag.
- All 663 database tests passed, including atomic creation/rollback, default
  behavior, noninheritance, and close/reopen persistence.
- Focused server suites passed 71 tests, including 16 new cases covering API
  creation with scheduled startup, native attribution, namespace protection,
  outcome/attention/ownership suppression, preserved ownership events, mixed
  batches, explicit delivery, malformed metadata, and query failure.
- CLI spawn tests passed 45 cases, contract tests passed 41, and SDK metadata
  transport tests passed 3. The CLI tests traverse SDK spawn serialization.
- The complete non-desktop package test graph reported 20,376 passed and six
  failures. Provider replay ordering and command-palette cold-open failures
  passed on isolated rerun. Three credential-sensitive server failures passed
  with an empty test-only GH_CONFIG_DIR passed through Turbo in loose environment
  mode; no host configuration was changed.
- The remaining child-outcome timing failure is in an existing test file. A
  focused run reproduced five failures with both the candidate and original
  notification implementation under the same invocation. Those tests have not
  been changed in this patch; the full graph is not claimed entirely green.
- Full patch-queue replay and downstream namespace verification passed and
  reproduced the locked tree.

Detailed logs are retained under this thread's `parent-followups/` storage.
This is a source/build receipt. The server has not been restarted, so the live
server does not yet honor the flag. No workspace promotion is included.
