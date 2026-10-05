# Experimental P6R prompts: source integration and maintainer map

This is source-only fork integration of the authorized prompt prototype. Queue
patches 46–47 do not activate the runtime, move upstream HEAD or workspace
gitlinks, restart services or deploy. Sampling and the rule editor belong to the
separate organization plugin `prompt-rules`, with its SDK dependency updates
owned by the coordinating integration lane. These mail patches are the durable
fork delivery; `/tmp/bb-prompts-authoring` is temporary authoring/build scratch,
never runtime.

## Exact base and replay

- Locked upstream: `9c9bae7f36a237c7e1b96de3d4c2186d13967686`.
- Preceding fork queue result: commit `ef11be7c6325789fc9258e4794b4e62b5cc8832f`.
- Prototype reference: original upstream `ca5fe0ba9f1337f6c8e40f897a4492c0f7e3b188`.
  That prototype patch is not an apply target for this older fork composition.
- Patches 46–47 are full-index binary mail patches exported from logical commits
  on the exact existing queue, with `patches/series`, `patches/sha256` and
  `result-tree.lock` as the source receipt. Run `scripts/verify` to reproduce it.
  Do not use fuzzy apply, copy newer upstream producer files, or replay onto a
  guessed revision. The supported materializer refuses existing output paths.

Patch 46 owns the API, pure engine, plugin lifecycle, server bridge, fake host,
pure template accessors and API docs. Patch 47 owns selected producer adapters
and integrity tests. Upstream conflicts were ported at their semantic boundary,
preserving fork attribution, group-local mention context, participant targets,
retry snapshots and the existing minimal sender template. Existing host-policy
exports and identity/facet implementation formatting remain unchanged.

## Public and internal contract

`BbPluginApi.experimental_p6rPrompts: ExperimentalP6rPrompts` exposes
`registerMiddleware(name, callback)`, `observe(name, callback)`, `render(request)`
and pure `renderTemplate(template, inputs)`. Public types are `P6rPromptContext`,
`P6rPromptSlot`, `P6rPromptRequest`, `P6rPromptMiddleware` and
`P6rPromptObservation`. Names are unique within each plugin/surface; disposal,
unload and failed load remove registrations. Middleware order is lexical plugin
ID then insertion order. Calls must return synchronous strings. Invalid results,
exceptions, duplicate continuation calls and damaged slots fall back to the
original request text with diagnostics. Observers cannot change results.
Requests/samples are cloned and frozen. Recursion with the same ID is rejected.
No core corpus, persistent sample storage, timers or collection plugin is added.

The pure engine has its own manifest-derived runtime/declaration export,
`@get-bb/plugin-sdk/internal/p6r-prompt-rendering`; it does not use an unrelated
host-policy barrel. Existing SDK builders discover this explicit package export.
The real and fake hosts share this engine; fake template rendering requires
`experimental_p6rRenderPromptTemplate` injection.

## Touched producer map

All source paths below are relative to the materialized BB root.

| Producer | Stable IDs | Integrity and upstream assumption |
| --- | --- | --- |
| `apps/server/src/services/threads/thread-runtime-config.ts`, `services/prompts/render-tool-prompts.ts` | `bb.tool.<registered-name>.description`, `bb.tool.<name>.schema<escaped-JSON-Pointer>/description` | Render after conditional selection; clone schema, rewrite only known schema annotation locations. Preserve tool name, handler, validator, selection and literal `enum`/`const`/`default`/`examples`/extension data. Local `$defs`, combinators, tuple/items and escaped paths are traversed; remote refs/custom vocabularies are not resolved. |
| `thread-runtime-config.ts`, `services/prompts/render-instruction-prompts.ts` | `bb.tool.<name>.instructions`, `.instructions.attribution`; `bb.plugin.<id>.instructions`, `.instructions.attribution`, `.dynamic-instructions`, `.dynamic-instructions.attribution`; `bb.instructions.data-dir.attribution`, `bb.instructions.workspace.attribution`; `bb.instructions.assembly` | Preserve existing section order, plugin caps before rendering, and opaque AGENTS bodies at section adapters. The aggregate deliberately sees already-rendered sections and can replace the entire string, including AGENTS bodies. A broad rule matching both section and aggregate can apply twice. Use ID-specific rules for one-stage changes. Existing sessions retain configured prose until runtime reconstruction. |
| `services/ai/commit-message.ts` | `generateCommitMessage` | Wrap existing pure builder, expose the stock template and string inputs; preserve sanitization/task dispatch. |
| `services/threads/title-generation.ts` | `generateThreadMetadata` | Preserve this fork base's fallback and clamping behavior, command context and sanitization; do not import newer upstream title behavior. |
| `services/threads/thread-send.ts` | `agentThreadMessage` | Render the complete first text block through the existing fork sender template. Preserve other inputs/resources/visibility, validate structured UTF-16 mentions and rebuild offsets. Native sender/authorship wrapping remains separate and unchanged. Retries reuse already accepted input and original attribution/participant targets, without re-rendering the agent message. |
| `services/threads/child-thread-notifications.ts` | `systemMessageChildThreadOutcomeBatch`, `systemMessageChildThreadNeedsAttention` | Render complete assembled status, output and guidance, rather than the opaque intermediate `updates` sentinel. Preserve queue kind/subject/status semantics and structured thread references. |
| `services/threads/thread-ownership.ts` | `systemMessageThreadOwnershipAssigned`, `systemMessageThreadOwnershipRemoved` | Render complete prose while retaining structured references, existing ownership changes and debounce/queue behavior. |
| `services/threads/parent-system-messages.ts` | Receives the preceding message IDs | Share collision-checked random mention slots, require each exactly once and rebuild offsets/resources in output order. Samples expand slots to visible text. Reject malformed, overlapping, non-integer or out-of-bounds ranges; clip mentions crossing stock trailing whitespace, reject mentions entirely removed by trimming. This fixes preexisting stale offsets while preserving default visible bytes. |
| `services/plugins/plugin-mentions.ts` | `bb.mention.context-header` | Render only the BB-owned header. Preserve resolver text/images/visibility, verified participant targets, group association, deduplication and existing limits. Resolver content remains opaque. |
| Owning plugins via public `render` | Plugin-chosen semantic IDs | Opt-in route; sourcePluginId is assigned by the host, not inferred from text. No third-party producer is automatically covered. |

Infrastructure paths: `server.ts` binds the service renderer; `plugin-api.ts`
stages registrations; `plugin-service.ts` enumerates committed live plugins;
`services/prompts/render-prompt.ts` bridges the engine/templates. SDK changes are
`backend-contract.ts`, `internal/p6r-prompt-rendering.ts`, `testing/fake-plugin-host.ts`
and the explicit package export. `packages/templates/src/render-template.ts` and
`index.ts` add pure template access and replacement rendering with existing
Handlebars `noEscape` and trim semantics. API audit docs, Guide backend symbol
index, plugin API doc surfaces and exhaustive public-symbol tests move together.

## Coverage and sample limits

Semantic IDs are retained from the prototype and existing template registry;
public API symbol renaming does not rename prompt IDs. Tool IDs assume registered
names stay stable; schema IDs use JSON Pointer escaping, not source locations.
Changes to producer semantics/IDs require explicit review during upstream sync.

Samples describe one render invocation. Aggregate `defaultText` already contains
section customizations. A sample is not a reconstructed untouched stock prompt,
proof of provider consumption, or sufficient evidence to reproduce arbitrary
code-generated defaults. Template requests expose body/string inputs; structured
message requests expose assembled text/slots. This API permits trusted plugins to
replace aggregate prose and exceed prior section limits after customization.

Excluded: generated plugin-command skill adapter (settings/disposal do not
regenerate existing bytes until lifecycle synchronization); prototype example,
its lockfile importer and loader test; skill tree/file materialization, host-local
skills, CLI help/guide transport, frontend drafts, provider bridge wrappers,
provider-native hidden tools/prompts, general tool-result rewriting and future
plugin families. No refresh mechanism, DB migration or daemon protocol is added.

## Verification receipt

Logs are retained under
`/home/ubuntu/.bb/thread-storage/thr_dfirty56w6/fork-prompts-*.log`.
Final source HEAD is `72159b78ccc9789575647d2b0dbdb8d4e8367eea`; final
result tree is `006c86feb52ca604f23b4d422562d635500306ad`. The SDK was built
and packed by the coordinator from preceding clean tree
`d6efcf412592028e07642ef7d3dc4e498432d315`; the server retry fixture,
SDK package-export test and Guide surface copy/order changed afterward. Production SDK source remains
identical; the coordinator will repack against the final clean source receipt
for exact provenance. The final SDK test now includes the explicit prompt export
snapshot and checks both runtime-file and declaration-file existence for every
package export.

- `scripts/verify`: passed exact full queue replay, diff integrity and P6R
  namespace/adversarial witness checks (`fork-prompts-replay.log`).
- Frozen-lockfile `pnpm install`: passed in scratch (`fork-prompts-install.log`).
- `pnpm exec turbo run typecheck --cache-dir=/tmp/bb-prompts-turbo-cache
  --filter=@bb/server --filter=@get-bb/plugin-sdk --filter=@bb/templates
  --filter=bb-plugin-plugin-api-docs --output-logs=errors-only`: **9/9 tasks**
  passed on final source (`fork-prompts-typecheck.log`).
- `pnpm exec turbo run build:types build:runtime` with that scratch cache and
  `--filter=@get-bb/plugin-sdk --output-logs=errors-only`: **4/4 tasks** passed
  (`fork-prompts-sdk-build.log`). Dedicated internal runtime/declaration entry
  was built and public symbols verified in the bundle.
- Server Vitest final run: **216/216 tests across 9 files** passed
  (`fork-prompts-server-tests-final.log`): renderer, tool/schema adapters,
  authoring docs, real plugin lifecycle, mention producer, structured message
  adapters, ownership debounce, runtime config and send/queue/retry dispatch.
- SDK Vitest selected run: **110/110 tests across 2 files** passed
  (`fork-prompts-sdk-tests-final.log`): exhaustive public types/declarations and
  fake host lifecycle/API contracts. After broader integration found the missing
  package-export snapshot entry, it was folded into patch 46. Full SDK `pnpm test`
  then passed **369/369 tests across 31 files** (`fork-prompts-sdk-tests-all.log`),
  including runtime and declaration export existence for the new internal entry.
- Guide/API-docs full `pnpm test`: **82/82 tests across 13 files** passed
  (`fork-prompts-guide-tests-all.log`) after correcting prompt surface order to
  match section flattening and its lead/bullets copy contract in patch 46.
- Templates Vitest: **8/8 tests** passed (`fork-prompts-templates-tests.log`),
  including stock/replacement pure template equivalence.
- Targeted `pnpm exec turbo run build` with that scratch cache and
  `--filter=@bb/server --output-logs=errors-only`: **5/5 tasks** passed
  (`fork-prompts-server-build.log`).
- `git diff --check ef11be7c6..HEAD`: passed. Active `build/bb` stays clean at
  `ef11be7c6325789fc9258e4794b4e62b5cc8832f`; upstream remains clean/pinned.

Initial tests exposed missing declaration build outputs, one overly broad import
replacement and a prototype retry fixture with a nonexistent/incomplete original
request. Those were corrected; the final combined server run above passed.
The retry fixture now seeds a valid original receipt and confirms accepted prose
is not rendered twice, without weakening native attribution/participant checks.

This owner verified the selected source boundaries, not the full monorepo,
provider sessions, browser behavior or production deployment. The coordinator
owns broader core checks and external plugin integration. No deployment,
restart, push, workspace gitlink change or active-runtime installation occurred.
The authoring tree is retained for the coordinator's ongoing verification and
packing; retire it with supported Git worktree removal only after that work ends.
The task-specific Turbo scratch cache is retained for those ongoing checks and
must be retired with this harness when it finishes.
