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
