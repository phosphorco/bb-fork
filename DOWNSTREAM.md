# Upstream-first release — November 13, 2026

Base: `05199007ecad513b714b244e46b0ab2a9a06279f` (BB 0.49.0). The current eight capability groups and exact affected surfaces are documented in [CAPABILITIES.md](CAPABILITIES.md).

The prior 75-patch queue is preserved under [__archived/01aff-overlay/](__archived/01aff-overlay/). Its chronological descriptions are historical, not an active release definition.

## Retirements

- Artifact format 2 and its compatibility copies: use the native upstream plugin artifact format and rebuild plugins with the matched CLI/SDK.
- Runtime prompt rendering/replacement and Prompt Rules: authored guide wording changes live in their own source patch; interpolated user bodies are not rewritten.
- Old Context Magnet native trace APIs: the Workbench-backed panel remains the supported presentation.
- The custom native admission runtime: upstream's sender hook supplies accept/reject semantics. The Message Rules consumer port remains a separate integration obligation; passing core sender-hook tests does not prove that plugin.
- Obsolete sidebar/timeline cache backports and outdated fixtures: accept the native upstream implementation first.

## Retained database history

The identity and environment bridge SQL bytes and historical receipt timestamps remain unchanged. Exact retired-admission receipts are recognized so missing native migrations 145–156 are applied transactionally, once, rather than silently skipped because of historical timestamp ordering. Retired tables/columns are retained and unused. Tests cover fresh, historical and repeated-start migration cohorts.

## Qualification and deployment

The selected source passed 64 typecheck tasks, 63 build tasks on both Mac and Linux, 93 migration tests, 19 authorship tests, two plugin identity-boundary tests and 40 native sender-hook cases. These are source checks; live prompts, plugins, matched daemon protocol and inference still require deployment verification.


## 2026-11-15 upstream refresh candidate

The candidate advances the base from `05199007ec` to `da3e60b81d` (five upstream commits). Native query improvements and sequence-aware optimistic sends remain upstream-owned. The replay retains native `TurnStartDeadlineCandidate` exports together with downstream execution exports, carries native `messageSequence` through attributed dispatch/provisioning, and removes handwritten API indexes and their competing docs test in favor of upstream generation. SDK package metadata keeps native `0.6.144` compatibility.

Downstream database operations join the upstream query-cost harness with growing persisted thread/facet/profile populations and bounded request IDs, plus the long-history latest-request lookup. The complete query-cost check passes on both growth axes. Exact queue replay, production build and typecheck pass; 138 targeted server tests, the SDK version witness and the external plugin scaffold pass. An isolated fresh-state server answered health successfully and loaded its built-in plugins. This does not prove migration from the installed database or compatibility of all installed direct plugins.

The broad test run is not green. Old-materialization comparison reproduces migration journal/schema/handoff failures, contract fixture failures, CLI index failures and queue/fault-barrier/provider-catalog failures. Other broad-suite failures remain unclassified, including compression, provider replay, app, daemon and tooling cases. Full-suite success and live installed-plugin/migration acceptance remain publication-to-main/promotion gaps; no normal service restart or workspace composition promotion is part of this candidate.
