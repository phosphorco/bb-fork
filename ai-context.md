---
# Workbench context guidance for bb-fork. Workbench injects the matching
# messages below when an agent touches a matching file. `files` globs and
# `include` paths are relative to this directory; the markdown body below the
# closing delimiter is never injected.
docs:
  - files: ["build/**", "patches/**", "upstream/**", "scripts/**", "upstream.lock", "result-tree.lock"]
    message: |
      bb-fork is Phosphor's patch overlay on get-bb/bb, and fork changes are a last resort. Deliver features through native BB and plugins first: bb-plugins or bb-community-plugins, the public Plugin SDK, existing surfaces (composer banners, panel and header actions, anchored overlays, thread storage, host watchers, plugin storage) and shared packages such as bb-identity. Prefer a somewhat worse design, such as an overlay instead of a reflowed layout or a documented DOM dependency, to a patch.

      Propose a fork change only in a plan that proves no usable experience at all is possible without it: name the missing capability, show why each native and plugin alternative cannot work at all (not merely less well), give the smallest patch with its upstream-sync cost and removal or upstreaming path, and get Cole's explicit approval before writing it. "Cleaner", "more robust", "better UX" and "first-class slot" do not qualify.

      Read before planning or changing a patch (paths relative to the bb-fork root, ~/bb/fork in the BB workspace):
      - README.md#fork-changes-are-a-last-resort: the policy and the required justification.
      - ../AGENTS.md#fork-changes-are-a-last-resort: the same rule in the workspace contract.
      - DOWNSTREAM.md: what each existing patch is for and its compatibility boundary.
      - plans/bb-fork-first-principles.md: the target shape, a core delta sized to its invariants.
      - plans/bb-fork-plugin-catalog.md: which plugins rely on which fork surfaces.
      Alternatives to a patch: the bb-plugin-contracts skill (cross-plugin extension points instead of fork slots) and the proposing-improvements-to-bb skill (an upstream core proposal).
  - files: ["build/**"]
    message: |
      build/ holds disposable checkouts made by scripts/materialize; edits there are not durable. Export reviewed changes as patches in patches/ following README.md "Updating upstream".
  - files: ["patches/**", "upstream.lock", "result-tree.lock", "DOWNSTREAM.md"]
    message: |
      Keep the overlay consistent: patches/series, patches/sha256, upstream.lock, result-tree.lock and DOWNSTREAM.md change together (README.md "Updating upstream"). Prefer shrinking or folding an existing patch over adding one, and record each patch's intent and removal path in DOWNSTREAM.md.
commands:
  - files: ["patches/**", "upstream.lock", "result-tree.lock"]
    command: "./scripts/verify"
    label: "verify overlay"
  - files: ["patches/**", "DOWNSTREAM.md"]
    command: "./scripts/delta-report"
    label: "downstream footprint"
---

# bb-fork agent context

The frontmatter above is read by Workbench context's builtin `AiContext`
contributor (selected by `../workbench-context.pkl`). It points agents at the
fork policy and its tradeoff documents whenever they touch the overlay, the
upstream source or a materialized checkout.
