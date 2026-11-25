# Upstream-first release — November 13, 2026

Base: `05199007ecad513b714b244e46b0ab2a9a06279f` (BB 0.49.0). The current eight capability groups and exact affected surfaces are documented in [CAPABILITIES.md](CAPABILITIES.md).

The prior 75-patch queue is preserved under [__archived/01aff-overlay/](__archived/01aff-overlay/). Its chronological descriptions are historical, not an active release definition.

## Retirements

- Artifact format 2 and its compatibility copies: use the native upstream plugin artifact format and rebuild plugins with the matched CLI/SDK.
- Runtime prompt rendering/replacement and Prompt Rules: authored guide wording changes live in their own source patch; interpolated user bodies are not rewritten.
- Old Context Magnet native trace APIs: the Workbench-backed panel remains the supported presentation.
- The custom native admission runtime: upstream's sender hook supplies accept/reject semantics. Message Rules is retired; there is no consumer port or compatibility obligation.
- Obsolete sidebar/timeline cache backports and outdated fixtures: accept the native upstream implementation first.

## Retained database history

The identity and environment bridge SQL bytes and historical receipt timestamps remain unchanged. Unknown migration ledger timestamps now fail before writes instead of receiving branch-specific recognition or replay. The supported identity/context bridges remain. Retired tables/columns are retained and unused; unsupported receipts require an explicitly reviewed offline copy conversion. See [the retirement record](MESSAGE-RULES-RETIREMENT.md).

## Qualification and deployment

The selected source passed 64 typecheck tasks, 63 build tasks on both Mac and Linux, 93 migration tests, 19 authorship tests, two plugin identity-boundary tests and 40 native sender-hook cases. These are source checks; live prompts, plugins, matched daemon protocol and inference still require deployment verification.

# Upstream refresh — November 19, 2026

Base: `df9619d8e8aac4aff00c0c3ff9b8ef4e2823e4f2` (BB 0.50.1 plus 38 main commits; 150 commits after `05199007ec`). The nine-patch queue, including the realtime compression, missed queue wake and optimistic authorship fixes merged after the November 13 release, replays exactly to tree `a126efa48b58ca6b86ef17e226a9da201defbc1b`. Draft PR #29 (`da3e60b81d`) was the process reference; this candidate supersedes it as a base and carries its two CI prerequisites.

## Decisions

- **Migration journal:** native `0157_thread_run_state`, `0158_resume_threads_general_setting` and `0159_machine_teardown_recovery` keep their positions. The downstream `0145_identity_context_bridge` and `0146_environment_secret_classification` entries follow at idx 160/161 with unchanged tags, `when` values and hashes, so installed receipts stay valid; native migrations are newer than both and apply on upgrade. The latest Drizzle snapshot is `0161_snapshot.json`, a three-way merge of the native 0159 snapshot with the downstream schema delta.
- **Persisted thread lifecycle (#7561):** attributed dispatch and provisioning adopt the native lifecycle transaction and `messageSequence`. Native `server.restarted` recovery is not idempotent, so it now runs once before ingress is admitted; the remaining startup recovery stays detached after transactional listener binding and skips the lifecycle step.
- **Provider CLI environment builder (#7722):** the downstream Codex app-server allow-list (`appServerLaunchEnv`/`buildAppServerEnv`) is retired in favor of `buildProviderCliEnv`. Bridge workers start without inherited `BB_*` names and the required Account Pool contribution blanks the central URL/token, so the central credential still cannot reach the app-server. The required-route launch guard and `env_key` selection remain; required-mode usage suppression now reads the probe env.
- **Plugin SDK transport:** the native per-plugin RPC-caller SDK is wrapped once, using the caller SDK that already applies producer message rendering to sends.
- **Removed connect-next (#7809):** downstream shutdown no longer closes the retired tunnel ingress; `@bb/frp-client` is no longer a server dependency.
- **Generated SDK API indexes (#7552):** the handwritten index edits and docs-test changes are retired; upstream generates both.
- **Lint configuration:** the oxlint change is reduced to its single semantic override; the former whole-file reformatting is dropped.
- **SDK version:** `0.6.164+phosphor.df9619d8.upgrade1`. Publishing the matching fork SDK release and repinning plugins are separate delivery steps.

## Qualification

- Exact replay: `scripts/verify` passes; the catalog check reports exact net source coverage for 8 capabilities and 9 patches.
- Install (`--frozen-lockfile`), typecheck plus lint (179/179 tasks), SDK build (4/4) and production build (63/63) pass. The regenerated lockfile only carries the queue's existing Electron 44.11.1 and `@bb/client-core` dependency changes.
- Installed state: a consistent read-only backup of the live `svc:bb` database (126 threads, 23,951 events, upstream through 0156 plus both downstream receipts) migrated through the candidate `initDb` in 103 ms. Native 0157–0159 were applied, history validation passed, `quick_check` was ok, and there were 0 foreign-key violations. A second start was a no-op. The current `main` build also opened the migrated copy, so binary rollback is mechanically possible; it does not maintain native lifecycle rows while running.
- Isolated fresh state (no inherited `BB_*` environment, ports 41886/41887): health was 200 within 2 s, 40 plugins loaded (30 running, 10 disabled built-in defaults), the local host connected, and no error-level logs were written.
- Broad suite: the 15 packages that fail on the current `main` materialization were rerun on both trees without the inherited service environment. The candidate had 52 failed and 17,316 passed tests; the baseline had 56 failed and 16,213 passed. After the refresh fixes, every candidate failure either reproduces on the baseline (identical test names: migration bridge/classification fixtures, contract allowlist, provider parity, CLI index, queue/clear races, fault barriers and others) or passes on both trees in isolation (load-sensitive app, daemon and timeline cases). No candidate-only deterministic failure remains.
- Not established: full CI success (the test jobs were already red on `main`), live behavior of every installed direct plugin, publication of the matching fork SDK artifact, and an observed live activation.
