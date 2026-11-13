# Compact sidebar evidence (2026-11-13)

Candidate: patch85 on published overlay main `e16b908f9`; upstream remains
`01affc197dc621cddc7343e09b1c5c10a5b9efcb`. Selected materialized tree:
`8e0660cb6c515efc89c89f6013fa8c1a2113ce9e`. Both legacy projects.ts and
sidebar-navigation-query.ts have zero diff against that base. The live checkout's
unpublished queue-recovery and Copy details patches are excluded.

No live source, materialized build, service, plugin activation or credentials
were changed. No profiling, merge, deployment or restart was performed.

## Matched measurements

The saved machine-identity bootstrap contains 2,711 rows, including children,
32 pinned rows, 479 non-null environment IDs and 47 distinct participant records.
The production codec round-trips every field exactly; no rows are removed.

| Same snapshot / compression | Legacy | Compact |
|---|---:|---:|
| JSON bytes | 3,916,876 | 1,297,863 |
| Node default gzip bytes | 293,273 | 212,340 |
| Node default Brotli bytes | 168,537 | 154,907 |
| Sample one-row delta JSON / gzip | — | 2,090 / 1,469 |
| Encode + stringify median (30 measured iterations after 5 warmups) | 9.74 ms | 17.51 ms |
| Parse + reconstruct median | 7.84 ms | 16.36 ms |

The new encoder/decoder adds CPU per baseline read. This is a byte and repeated
work reduction, not a demonstrated reduction in baseline-route CPU. Database
hydration still returns every legacy row. String interning uses full-value
comparison so changed participant/environment metadata cannot be merged away.

The actual production app was served from an isolated read-only replay on port
39906. GET responses were frozen/cached, writes and plugin RPCs were refused,
and both paths received the same 200 ms API delay and 12 thread-title notifications
at 2.32, 3.68, 7.25, 10.5, 14, 18, 22, 26, 30, 34, 38 and 42 seconds. Viewport
1440×1000, browser cache disabled. Counts include only requests started within
45 seconds of navigation, even when artifact collection ran a few seconds later.

| Browser replay, same 45 s event stream | Legacy | Compact |
|---|---:|---:|
| Full sidebar requests | 13 | 1 |
| Targeted row requests | 0 | 12 |
| Sidebar request aborts | 0 | 0 |
| All browser requests | 420 | 420 |
| Decoded sidebar bytes across requests | 50,919,388 | 1,322,943 |
| Encoded sidebar transfer incl. HTTP headers | 3,815,487 | 232,882 |
| Inbox-controls DOM proxy | 7.192 s | 7.242 s |

The proxy's 200 ms delay did not overlap invalidations, so cancellation resistance
is established by held-read/cancellation-storm tests, not by the zero-abort replay.
A separate live 45.051 s baseline had 13 full reads, 11 completed and two cancelled;
430 total requests. Its real event stream and compression differ from the replay.
Do not compare its encoded bytes directly with this gzip fixture.

The controls proxy does not establish a usable populated sidebar. Identity and
layout-preference plugin RPCs were deliberately blocked in the replay, so both
runs retained the saved-navigation warning and an empty machine Inbox. No
populated-person acceptance or improvement in sidebar-usable time is claimed.
That needs an authorized deployed check or equivalent verified-person fixture.

## Thread view

On one fixed thread, three alternating cold-page samples per mode, with cached
backend fixtures and browser asset cache disabled, measured target timeline-row
appearance plus two animation frames. Median: **1.417 s legacy → 1.103 s trial**;
ranges 1.385–2.424 s and 1.086–2.381 s. Detail, timeline and interactions each
made one GET in both modes; tabs consistently fell from two GETs to one. These
small machine samples are not real-user latency estimates or a causal proof of
the whole median difference.

Four already-warm history navigations per mode, using strict target-thread row
selectors and two frames, measured median **310 ms → 268 ms**. Request counts in
the 500 ms post-paint window were 42/22/18/15 versus 39/21/15/15. Browser long tasks
during the switches were 211–245 ms versus 171–213 ms. This includes client work
and does not isolate React commit cost or a specific component. Broader render
attribution remains worthwhile; the thread view is not yet instantaneous.

The earlier fresh live sample was 980 ms on hard open and 236–302 ms on four warm
switches. It reproduced tabs×2, but not the historical detail×4/timeline×3 burst.
Historical HAR4 attributed three identical timeline reads to Turn Results, not
the core timeline observer. Raw HAR1–3 exceeded the remote file-read size limit;
no unsupported inference about their initiators is made.

## Behavior parity and remaining acceptance

The new transport restores the complete domain row into the existing cache.
Section metadata, pin sort keys, parent/child links, project/environment data,
participant snapshots, all five activity counters, runtime, read/attention and
queue/interaction state remain exact. Existing selectors, search/filters, core
controls, thread-list and inbox-sidebar-nerd receive their existing data shape.
No new collapse/grouping decisions or archives are introduced. SQLite route tests
compare both full routes exactly, including personal/public projects, hidden and
archived exclusion and child coverage. Row tests exercise creations, moves,
tombstones, bounded reads, held optimistic edits and concurrent changes.

The owner shares requests across observers, absorbs pending rows into a requested
baseline, and leaves physical reads running when observers retire or legacy
invalidation calls cancel queries. Repeated invalidations become one queued
operation; ID sets larger than 200 require bounded sequential batches. Project
notifications refresh only metadata. Reconnect/resume/manual refresh restore a
baseline. Hidden pages defer reads; failures retain data and back off.

Roll back by removing `bb.p6r.compact-sidebar` from localStorage and reloading.
Both enabling and rollback are browser-local and need no deploy. No automatic
fallback hides failures. Global rollout/kill-switch orchestration is not supplied.
Plugin-specific person identity, pin/section interaction and Inbox acceptance
remain a deployment check. This is a named verification gap, not proof of a gap
in decoded data.

## Other work ranked by expected user-visible gain

1. **Event-loop freezes:** owner evidence shows 74 freezes of 13.5–14.6 s in seven
   hours and ~92% of one Node core busy. Highest severity for all API/UI work;
   cause unproven. This task's timing-only 10 s sample saw p99 223 ms / max 443 ms,
   so it did not reproduce the freeze. Correlate timing/GC/build/query events
   before choosing a repair. No live CPU/allocation profiler was used.
2. **Plugin asset waterfall/cache churn:** 58 plugins, 192 fresh-sample script/style
   requests, 2.60 MB encoded, finishing at 5.07 s on loopback; supplied real-user
   evidence finished at 8.6 s. Source has three activation lanes and discovers CSS
   after JS import. Production does not await CSS completion before advancing.
   Each build chooses a random generation embedded in imports and metadata, so
   unchanged rebuilds still invalidate URLs/hashes. Plain reuse on restart would
   preserve them. Independent patch86 fixes the missing-legacy-entry freshness
   trigger behind its own server flag; it does not change lane policy or cache
   addressing. Those larger changes need separate evaluation.
3. **Thread render work / large timeline repetition:** warm-navigation long tasks
   above remain. Owner HARs show repeated 558 KB timelines; HAR4 attributes three
   to Turn Results. The November 8 Gallery settling/metadata-invalidation fixes
   already exist in community main (`5c4634fa`); current Turn Results is disabled,
   so person-session behavior could not be verified. Timeline server timing in
   owner evidence: 48 calls / 6.0 s aggregate, max 1.75 s; events 118 / 3.0 s.
4. **Provider CLI fan-out:** 13 per-host requests, slowest 6.32 s in fresh sample;
   owner HAR observed one at 30 s. Likely gain for machine/provider controls and
   cold startup; critical-path dependence and replacement semantics unmeasured.
5. **Unfiltered thread catalogue:** read-only sample returned 5,329 rows including
   2,618 archived, 7,463,455 raw bytes / 431,051 encoded in 2.435 s. It was absent
   from the fresh home waterfall. Find and bound the actual consumer; do not
   attribute all traffic or promise home-load gain without that caller evidence.
6. **Queued-message burst and Gallery RPC loop:** historical 78-thread Inbox
   detail probes and repeated Gallery work are plugin-owned. Inbox's November 8
   batched-summary fix is already in organization main (`c6bc38ec`, typing follow-up
   `44e6b8b`); Gallery's is above. Forty-nine relevant existing regression cases
   passed. No duplicate fix PR was warranted; current person-session acceptance
   remains unverified, especially with Gallery disabled.
7. **Environment polling / subscription-router cadence:** owner observed 610
   environment GETs/10 s; fresh timing-only capture counted 1,493 / 279 ms aggregate.
   Each is cheap, but aggregate events can matter. Thread Progress's five-second
   observed-plan scan is a source candidate, not proven attribution of that burst.
   Identical subscription-router request/response every 15 s is historical evidence;
   freshness obligations need investigation before removing it.

## Verification record

Frozen installs, production app/server build, relevant typecheck/lint, independent
queue replay/checksums/namespace checks passed. Final frozen full app: **5,962
passed / 3 skipped**, 630 files passed / one skipped. Full server: **4,038 passed /
8 skipped**. Contract suite: **83 passed**. Focused final owner/rollout: 13 passed;
final nine-file consumer rerun: 78 passed; separate six-file regression cohort:
105 passed. Earlier broad runs overlapped source changes and retained failures;
the continuous-change regression demonstrated failure against the earlier owner
and passed with fieldwise merging. The final full app run used the exact selected
tree with no concurrent edits; do not treat the earlier broad runs as green.

The independent artifact-freshness branch passed server typecheck/build and 17
filesystem/loader/packaging cases. Workspace composition checking reports all
three checkout gitlinks differ from the inherited receipt. That is expected in
this isolated source-review workspace; no workspace promotion receipt was changed.
