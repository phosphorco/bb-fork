# bb-fork

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs attribution in this trusted shared deployment. Use verified people when
> available, applicable carried attribution next, and a stable machine actor
> otherwise. The owned Tailnet listener also retains machine attribution when
> person evidence is missing or unusable.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.

## Fork changes are a last resort

Do not add or grow a patch here when native BB can deliver the feature. Build
it as a plugin in `bb-plugins` or `bb-community-plugins` using the public
Plugin SDK, existing surfaces (composer banners, panel and header actions,
overlays anchored the way Sticky Notes does, thread storage, host watchers,
plugin storage), and shared packages such as `bb-identity`. Accept a somewhat
worse design, an overlay instead of a reflowed layout, or a documented
dependency on current DOM structure rather than patching BB.

A plan may propose a fork change only when it proves that **no usable
experience at all** can be delivered without one. The plan must:

1. name the exact capability that is missing, not merely less convenient;
2. list each native and plugin approach considered and show concretely why
   each one cannot deliver any working experience, not just a worse one;
3. state the smallest possible patch, its upstream-sync cost, and how it
   would be removed or upstreamed;
4. receive Cole's explicit approval before any patch is written.

"Cleaner", "more robust", "better UX", or "would be nice as a first-class
slot" are not sufficient reasons. Reviewers must reject plans that skip this
justification.

This is a thin, auditable deployment overlay for [get-bb/bb](https://github.com/get-bb/bb). It does not carry a second copy of upstream source and it does not treat a long-lived Git branch as the release definition.

The [current capability catalog](CAPABILITIES.md) explains what the downstream
changes deliver, why they remain, and which database models, SDK/API contracts
and other areas they affect. [capabilities.json](capabilities.json) is the sole
editable current catalog; the Markdown view is generated. Keep it current in the
same commit as changing the selected queue or its upstream base. See
[the contributor contract](AGENTS.md) for the checks and review obligation.

The current base is upstream `05199007ecad513b714b244e46b0ab2a9a06279f` (BB 0.49.0). The selected queue contains eight consolidated capability patches, renumbered from 0001. Numbers describe this release's replay order, not permanent patch identities.

The deployable source is the upstream submodule and `upstream.lock`, the ordered `patches/series` with its checksums, and the exact `result-tree.lock`. Run `scripts/verify`, then `scripts/materialize` to create a fresh build checkout. Build and test from that checkout using the pinned native package manager.

## Retired source

The complete preceding queue and rationale are in [`__archived/01aff-overlay/`](__archived/01aff-overlay/). Runtime prompt interception patches and their design notes are in [`__archived/patch-prompt-rewriting/`](__archived/patch-prompt-rewriting/). These folders are tracked history, outside every selected patch/build path. Do not load or port them automatically.

The [prompt policy](PROMPT-POLICY.md) records the intended behavior, rationale,
producer ownership and verification requirements for future prompt and CLI guide
changes. Cite its relevant section when reviewing wording patches.

Prompt wording is now the focused `0008-prompt-wording.patch`, applied to authored BB Guide template source before interpolation. The retired Prompt Rules plugin lives in the organization plugin repository's tracked `__archive/plugins/prompt-rules/`.

## Updating upstream

Prefer native upstream fixes. Reproduce the remaining need for every capability against the new base before porting it. Retire superseded code, consolidate logical changes, renumber the selected queue, regenerate its catalog, and prove exact replay. Preserve historical migration receipts and data; removal of runtime capabilities does not authorize removal of retained history.

See [CAPABILITIES.md](CAPABILITIES.md) for the current contract and [DOWNSTREAM.md](DOWNSTREAM.md) for this upgrade's decisions.
