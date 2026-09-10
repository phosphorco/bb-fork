# Integration and compatibility lane — milestone 1

> Historical milestone/design record. For current implementation, owners and
> acceptance gaps, use [the completion ledger](../bb-identity-completion.md)
> and [package status](../../../plugins/packages/bb-identity/STATUS.md).
> Use public declarations for current signatures. The original lane restrictions
> below describe that milestone; current user authorization and workspace
> preservation rules govern ongoing work.

**Owner:** Integration and compatibility lane (`thr_psaevc6ixy`)

**Status:** contract inputs prepared; declaration-only consumer witnesses are
added against the package lane's announced Draft 4 surface and the full strict
declaration compile passes. No runtime source, generated SDK output, host
materialization, plugin installation, or reload is part of this milestone.

## Source authority and delta

There are three deliberately separate evidence graphs:

| Graph | Authority and use | Do not infer |
| --- | --- | --- |
| Exact implementation target | `fork/upstream` Git object `960255b98ce3dccdcb5754eb67a7f989236602a1` | That the dirty `fork/upstream` checkout or `fork/build/bb` represents it |
| Review target | direct parent `44cc2292dff443bb626866171708801a904bf45a`, the Draft 3 closure review target | That the current target has a different SDK capability without an exact diff |
| Installed compatibility graph | plugins' installed `@get-bb/plugin-sdk` `0.4.15` | Exact-target API support, runtime parity, or packaged-artifact behavior |

`960255…` is the direct child of `44cc…`. Its complete diff has eight files:
release/CI/desktop metadata and changelog only. In particular, it changes none
of `packages/plugin-sdk`, server, host daemon, or app contract sources; both
objects declare `@get-bb/plugin-sdk` `0.4.47`. The Draft 3 closure gaps are
therefore still present at the kickoff pin. Target inspection nevertheless
confirms useful existing facilities: a content script receives only
`pluginId`, `generation`, and a teardown abort signal; app code can observe a
shared realtime connection and receive realtime signals; backend plugins can
mount authenticated HTTP/WebSocket routes. Those facilities do **not** provide
request actor provenance, an imperative plugin channel in content scripts, an
identity endpoint, transactional acceptance, or causal native history.

The target facts above come from `git -C fork/upstream show/grep
960255…`, never the dirty source trees. The current materialization and both
child repositories are authored-dirty and remain in place. They are not an
input to the separately authorized temporary proof worktree below.

## Source authority: concrete audit and handoff

### Observed authority is split; only a temporary proof may bypass canonical reconciliation

| Surface | Observed receipt/worktree | Authority conclusion |
| --- | --- | --- |
| Overlay release receipt | `fork/upstream.lock` is `5205d98…`; `patches/series` has 51 entries; `result-tree.lock` is `69e8e51…` | This is an old, dirty overlay artifact set—not the `960255…` candidate receipt. |
| Pinned upstream reference | `fork/upstream` is detached at `5205d98…`, has three authored entries, and its Git store has only `origin` | It is the base reference, not a writable target source branch. `960255…` is an available unreferenced commit object here. |
| Visible runtime path | `fork/build/bb` is at `02ee59…` with 87 authored entries | This is the active `bb.service` working directory and is not a worktree of `fork/upstream`. Its `.git` points to a Rosetta-machine deployment receipt under `~/.local/share/rosetta-machine/...`, whose receipt still locks `5205d98…` and only 24 patches. |
| Requested exact target | `960255b98ce3dccdcb5754eb67a7f989236602a1` is a commit object with parent `44cc…` and no local branch/tag/ref containing it | It is valid review/implementation evidence, but no current checkout or release receipt selects it. |

The active systemd unit confirms this is not a harmless disposable path:
`bb.service` runs from `/home/ubuntu/bb/fork/build/bb`. Existing
`scripts/materialize` also correctly refuses to overwrite that path and only
knows how to replay the old `upstream.lock` plus patch queue. The current
`scripts/verify` and `delta-report` create temporary replay worktrees; they do
not establish a durable editable source. Running any of them is unnecessary
for this audit and cannot resolve the split.

### Authored-change inventory and preservation boundary

This inventory is metadata only: Git status code, path, owning Git store and
receipt identity. It intentionally does not copy file contents, diff payloads,
environment files, `~/.bb`, plugin data, databases, artifacts, or process
state.

| Git store/worktree | Tracked index | Tracked worktree | Untracked source paths | Generated/runtime classification |
| --- | ---: | ---: | --- | --- |
| `fork/.git/modules/upstream` → `fork/upstream` | 0 | 1 (`apps/app/src/components/AppErrorBoundary.tsx`) | 2 (`apps/app/src/lib/chunk-load-recovery.{ts,test.ts}`) | None of the three matches known generated/runtime patterns; all require an owner disposition. |
| Rosetta receipt `.../ff7a…/.git/modules/upstream` → `fork/build/bb` | 8 | 71 | 8: `apps/recovery-mobile/`, recovery route/test, background-command activity data/test, Recovery SDK and server-contract sources/tests | No dirty path lies under `dist/`, `build/`, `node_modules/`, coverage, or a build-info file. Treat all 87 as authored/unclassified until their owner says otherwise. |

The runtime's tracked changes span 48 `apps/` paths, one `docs/` path, 20
`packages/` paths, plus `pnpm-lock.yaml` and `turbo.json`; its eight staged
paths include the timeline, configuration docs, and feature flags. That overlap
with the old release receipt makes it especially unsafe to classify by file
name or copy only a subset.

Before any canonical-path transition, the coordinator-owned reconciliation
records an owner, intended receipt/branch, and preservation reference for every
inventory group. A preservation reference is a committed source ref, reviewed
patch export, or explicitly retained existing worktree—not an ad-hoc snapshot.
Capturing a diff, tarball, or file list never authorizes resetting or removing
the original. The old overlay's 51-patch series, hashes, upstream lock and
result-tree lock are separately retained as the current release baseline;
they are neither silently folded into nor overwritten by the 960 candidate.

### Authorized temporary proof: isolated, visible, and non-promotional

Cole's temporary-proof authorization permits one additional visible worktree,
`/home/ubuntu/bb/fork/build/proof-bb`, but does not alter the normal runtime or
the canonical promotion model. It is attached to the new
`proof/identity-first` branch in the canonical `fork/.git/modules/upstream`
object store, at exact starting commit
`960255b98ce3dccdcb5754eb67a7f989236602a1`. It is not a patch replay, does
not select the old 51-patch receipt, and starts at the exact target tree with
an empty status. [Temporary local BB fork proof](../bb-fork-local-proof.md) is
the normative source/port/data/process-isolation target for this exception:
API `39886`, daemon `39887`, dev UI `39888`, and proof state
`/home/ubuntu/.local/share/bb-fork-proof`.

The completed registration and remaining launch constraints are:

1. Root created `proof-bb` attached to `proof/identity-first` in the canonical
   upstream store, pinned at `960255…`. It created no overlay receipt, moved
   neither `fork/upstream`'s detached HEAD nor `fork/build/bb`'s independent
   receipt, and copied no dirty files from either existing tree. Any future
   recreate/retarget attempt must refuse an existing destination rather than
   remove, stash, reset, or clean a path.
2. Root selected inspected-free non-normal ports and proof-only native data
   configuration; no install, launch, or proof validation has occurred yet. The
   proof process must use new empty proof-owned data and plugin directories,
   never `~/.bb`, the normal service data, `plugins/plugins`, or
   `community-plugins/plugins`. Its listeners remain distinct from normal
   ports; ingress and test traffic are limited to the temporary proof.
3. Root verifies that the proof has no live external integration, identity,
   plugin, or deployment side effect beyond the deliberately scoped proof
   traffic. It must not install/reload/replace the normal service, modify
   machine role, write release receipts, or treat proof output as promotion
   evidence.

This lane makes no such worktree/runtime/tooling change. The sequence is a
bounded proof proposal for the coordinator/root to execute under the new
authorization. It intentionally leaves `fork/upstream`, `fork/build/bb`, the
old overlay locks/patches, and all authored dirty content untouched.

### Required authority model for canonical source and promotion

The durable writable authority must be a full-tree commit on the
`phosphorco/bb-fork` remote, based exactly on `960255…`, with a source family
name such as `source/identity-first/960255b98ce3d`. The precise branch name is
only navigation: a new `source-tip.lock` containing its full commit SHA is the
receipt. The candidate overlay branch records derived `upstream.lock`,
`source-tip.lock`, ordered patches, hashes, and `result-tree.lock`. It is not
the edit location, and exported patches must never be hand-edited alongside
the source commits.

`fork/upstream` remains a detached base reference at the candidate
`upstream.lock`. The one canonical candidate working location is
`/home/ubuntu/bb/fork/build/bb`, but only after tooling has reattached that
path—on a confirmed staging host—to the fetched full-tree source commit in the
canonical `fork/.git/modules/upstream` store. The worktree may be used to make
and test source commits; its durable truth is the pushed source commit, not a
dirty materialization. It remains the only candidate runtime path and never
becomes a second deployment checkout.

### Tooling changes required before canonical source edits

1. Add `source-tip.lock` and an atomic `scripts/export`. Export accepts the
   exact full-tree source commit, verifies its first parent/base is the locked
   upstream commit, writes the ordered patch series/hashes and all three locks
   to a temporary directory, replays them, compares both result and source-tip
   trees, then atomically replaces the overlay artifacts.
2. Change `scripts/verify` to fetch/read `source-tip.lock`, prove the source
   commit exists on the configured `downstream` remote, verify subject/count
   order and replay/tree equality. Its temporary worktree remains verification
   only. Add a source-status check that prints base SHA, source-tip SHA,
   worktree Git common directory, attached ref, and dirty state.
3. Change `scripts/materialize` from patch replay into an explicit source-tip
   attach operation: validate clean `fork/upstream` at `upstream.lock`, fetch
   the configured `downstream` remote, validate the locked source commit and
   tree, and attach only `build/bb` to that commit's source branch. It must
   reject a pre-existing path, a worktree whose common directory is not the
   canonical submodule store, any dirty source/base/worktree, an active runtime
   on the host, or a source/base mismatch. It must never force-remove, stash,
   reset, clean, or retarget an existing worktree.
4. Extend `bin/status`/`bin/check --runtime` to report and enforce that
   `build/bb` is registered in the canonical upstream Git store and agrees
   with `source-tip.lock`; merely finding `package.json` is insufficient. The
   existing Rosetta-machine receipt/worktree must fail this check rather than
   being silently adopted.

The attach operation needs an explicit durable journal in the overlay Git
store, with `prepared`, `old-canonical-detached`, `new-canonical-attached`, and
`verified` phases. Before touching the canonical path it records the old
worktree Git directory/HEAD and the requested base/source-tip/tree. A restart
can resume only when the journal exactly matches those identities and the path
is absent or is the newly registered clean worktree. Any unknown path, changed
Git directory, active runtime, or dirty state fails closed for operator review.
It never uses `worktree remove --force`; after owner preservation and a clean
preflight, the final old-worktree removal is an explicit, exact-path operation.
If a crash follows removal, the retained old receipt/ref remains recoverable and
the journal permits only reattachment of the locked source; if it follows
attachment, verification checks common-dir, ref, tree and clean status before
the runtime can be selected later.

### Safe sequence for eventual canonical promotion

1. Keep the current normal/runtime receipt and every dirty tree intact. Record
   full status and have the owners preserve the three dirty upstream entries
   and 87 runtime entries in their current stores (commit/export/review as
   appropriate); do not infer that either set belongs to the candidate.
2. This reconciliation gate does not block the isolated temporary
   `proof-bb` worktree described above. It remains mandatory before an
   attach/replacement of canonical `fork/build/bb`, an overlay export, a
   workspace receipt, or a normal-host promotion.
3. `bb-machine` is the selected normal staging host under workspace and
   `rosetta-machine` role policy; Rosetta remains normal. This temporary proof
   instead runs on Rosetta under Root's separately selected ports and isolated
   data/plugin configuration; it is not a normal staging or promotion action.
4. On a clean normal staging host, fetch the exact `960255…` object, create and
   push the full-tree source branch from it, record the returned immutable
   source-tip SHA, and only then update the candidate overlay locks/tooling.
   `fork/upstream` moves to the target only after its current dirty state is
   resolved by its owner.
5. Run the new source-status/materialize preflight. It creates or attaches the
   single staging `fork/build/bb` worktree only when all conditions above are
   true. Build/test there; core lanes commit logical changes on the source
   branch. They do not write `upstream/`, patch files, locks, or deployment
   receipts directly.
6. After tests and the required vertical proofs, push the source commits,
   export and verify the receipt, commit/push the overlay and workspace
   receipts, and only then perform the separately authorized staging reload and
   normal-host promotion. This audit authorizes none of those state changes.

### Core-lane collision boundaries after reconciliation

| Owner | Exclusive initial source paths on the `960…` source branch | Shared seam rule |
| --- | --- | --- |
| Core lifecycle | `apps/server/src/services/plugins/plugin-activation.ts`, `plugin-runtime.ts`, `plugin-service.ts`, `plugin-service-internal.ts`, and their direct tests | Owns activation/reload generation and dispatcher lifetime. It is the sole initial editor of `packages/plugin-sdk/src/backend-contract.ts` for the generic registration surface, after accepting the Package's structural signature. |
| Core identity and provenance | New `apps/server/src/services/p6r/**`; `apps/server/src/services/threads/thread-send-request.ts`, `thread-send.ts`, `queued-messages.ts`; `packages/db/src/schema.ts`, `packages/db/src/data/events.ts`; and their direct tests | Owns acceptance-time sidecars keyed to existing native IDs, evidence readers, and partial/unknown semantics. It does not edit plugin lifecycle files or daemon sources in slice one. |
| Coordinator | Source/overlay receipt and tooling paths: `upstream.lock`, future `source-tip.lock`, `result-tree.lock`, `patches/**`, `scripts/{export,verify,materialize}`, `bin/{status,check}` | Names the one editor if a change crosses the two rows. No lane independently attaches `build/bb`, moves `fork/upstream`, or changes any receipt. |

`apps/server/src/services/plugins/plugin-api.ts` is a held shared boundary: no
lane edits it until the coordinator assigns its one implementation owner after
the raw structural probe and exact handler placement are accepted. This avoids
two incompatible scope models being introduced through adjacent plugin API and
activation changes.

The first implementation slice is deliberately server-owned provenance
sidecars over existing native execution IDs. It must prove the precise missing
boundary before introducing daemon fields or incrementing daemon protocol.
Unknown/partial mapping remains explicit throughout; lifecycle work does not
turn it into synthetic evidence.

### Current canonical-promotion dependencies

There is one owner-disposition fact that cannot safely be guessed from Git:

1. Which owners and destination receipts preserve the dirty `fork/upstream`
   and active `fork/build/bb` work. Those changes may be ongoing authored work
   for the old release, a candidate, or both.

The staging role itself is resolved: `bb-machine` is staging and Rosetta is
normal. The concrete remaining normal-staging access dependency is that
read-only SSH to `ubuntu@bb-machine` times out from this server (with
`BatchMode` and an eight-second bound), and `bb-machine` is absent from its
machine list. This does not block the explicitly authorized Rosetta
`proof-bb` worktree under different ports, but it does block normal promotion.

Until owner dispositions are supplied, `960255…` may be used for the isolated
proof only. It is not authority to edit either dirty existing worktree, advance
their receipts, or perform canonical promotion.

## Contract closure adopted for Draft 4

The package lane's pre-edit proposal closes the four Draft 3 blockers rather
than adding feature-owned models to core:

1. `IdentityConnection` is the single owner of request transport, realtime
   invalidation, health state, authoritative `revalidate()`, and disposal.
   `createIdentityClient({ connection })` and
   `createStateTransport({ connection, resource })` borrow that one owner.
   Native React obtains it through `useBbIdentityConnection()` using supported
   SDK hooks; independent roots explicitly construct a fetch connection from
   endpoint/fetch/signal. Neither path discovers an endpoint from `BbContext`.
   Health must allow the state feed to be unavailable while a previously
   authenticated identity session remains ready; writes stay suspended until
   authoritative revalidation.
2. `ConflictToken` identifies one reviewable conflict. `ConflictContext` must
   surface that token plus owner session and exact base/local/remote values.
   `resolveConflict(ownerSession, token, decision)` rejects a decision made for
   R1 after R2 supersedes it, even when controller incarnation is unchanged.
   A blocked snapshot exposes the review payload; the UI must not reconstruct
   it from mutable local state.
3. `ContributionQuery` gains bounded `cursor` and `limit`. A caller feeds an
   `EvidencePage.nextCursor` back into the same native-reference query. A
   result remains known/partial/pending/unavailable; duplicate text and
   "latest author" are never correlation substitutes.
4. `/bb` normalizes a provider registration: stable `person(issuer, subject)`
   result, read-only generation-bound configuration snapshot, staged/active/
   retired lifecycle and generation-bound lease. Request-aware self-profile is
   added to client/server/endpoint. The enhanced-only lease does not turn an
   upstream singleton into a configured-boundary fallback.

Provider-local `validateReadiness` is deliberately optional: a resolver-only
provider remains `{ issuers, resolve }`. Host structural/configuration
readiness remains mandatory when activation requires it. Directory and lookup
remain independently optional, and registration disposal is scoped to the
registration. The existing `ResolverOnly` declaration assertion is retained as
the compile witness for that portability requirement.

The retained mandatory HTTP `changes`/replay endpoint is removed. A connection
may use supported native signals to wake an authoritative reload, while explicit
fetch configuration remains the independent-root portability path. Provider
configuration remains operator-owned, ingress evidence remains host-established,
and external authors remain `pluginId + subject`, never collaborator aliases.

## Compile-only consumer witnesses

The integration test suite typechecks actual calls, JSX composition, and
cleanup ownership—not only conditional assignability. Its positive Draft 4
witnesses include:

- A native preferences root calls `useBbIdentityConnection()`, composes
  `BbIdentity.Provider` and `BbIdentity.Context` in JSX, then calls
  `useIdentityStateBinding` with a feature `StateResource`, state transport,
  draft store, target and edit policy. The feature supplies conflict policy and
  recovery sink; it supplies neither actor resolution nor a private endpoint.
- An independent content-script owner constructs one explicit connection from
  its abort signal, creates one identity client and two resource transports,
  starts it once, and disposes the connection once on its cleanup. Two mounted
  roots borrow it and own separate views. There is no global singleton and no
  double-dispose path.
- A state UI reads the blocked conflict review, preserves R1 for display,
  receives R2, and invokes resolution with R1's token. The compile witness
  requires the token argument; the vertical runtime proof establishes that it
  returns stale/conflict rather than applying R1's decision to R2.
- History starts from a native message ID, follows every contribution page by
  its cursor, and queries each contribution's attempt pages. It deliberately
  has no text-based lookup fallback.
- A BYO IdP factory reads only its normalized registration/configuration
  snapshot, starts resolver-only, and disposes the staged generation. Equal
  subjects at different issuers are passed separately; no cross-issuer key
  construction is available to the consumer.

Typechecking is limited to source declarations plus test source. It proves API
composition against a graph; it cannot prove route lifetime, a real SDK
dispatcher, transactionality, generated package exports, or packed bytes.

`type-tests/raw-host-contract.test.tsx` is the separate raw-core construction
witness, distinct from the consumer calls above. It defines every core-side
signature without indexing, `Parameters`, or `ReturnType` extraction from
`ForkIdentityProtocolV1`, then assigns a concrete successful core object to
that target. Its values include a ready session, self profile, request handle,
both scoped and external acceptance sources, and a raw provider registration
whose `person(issuer, subject)` success returns ordinary string identity fields.
It also inspects only `experimental_p6rIdentity`, binds an invocation and uses
its registration/handler, and forwards through a `ForkInvocationScope`. This
is structural feasibility only; it makes no runtime implementation claim.

## Required vertical proofs before broad migration

| Slice | Runtime setup and stimulus | Required observations |
| --- | --- | --- |
| Preferences/state | Two resources share one connection. Drop only the state feed, then reconnect. Create conflict R1, show it, deliver R2, submit the R1 token. Edit dirty A → B → A around an invalidation. | Identity can remain ready while writes suspend; revalidation fences stale writes; R1 decision is rejected; A→B→A retains the final dirty intent and does not erase a newer checkpoint. |
| Native external history | Submit two same-text external messages with distinct durable operation IDs; start/continue native provider work; page mappings/attempts by native IDs. | Both contributions and continuations keep distinct authorship and fixed execution snapshots; all pages are traversed; unavailable upstream mappings remain unavailable rather than fabricated. |
| BYO IdP lifecycle | Register resolver-only, Tailscale, and a gateway provider. Reload/replace while resolving; expire a socket/session; use equal subjects under different issuers. | One normalized key per issuer/subject, read-only configuration snapshot, late results fenced, candidate failure preserves predecessor, old disposal cannot retire successor, socket goes through authenticated reentry rather than replaying stale evidence. |
| Roots and session compatibility | Pack two independently built consumers using the identical released identity artifact. Mount roots separately; run upstream → fork → upstream native sessions. | No source-tree/private import fallback, separate views with bounded connection ownership, native content and provider sessions continue, upstream stays singleton only when identity capability is truly absent. |

Prompt Stacks is excluded from every witness. Personal preferences and external
integrations remain feature-owned; core carries only authority/provenance and
native continuation seams.

## Implementation handoff and diagnostics

1. Package lands the agreed Draft 4 declarations and announces its revision.
   Integration updates the positive `.test.tsx` consumers and runs the strict
   declaration command against both the installed SDK graph and a later exact
   target materialization.
2. Core implements only the structural lifecycle/provenance seams. Integration
   checks target changes using exact Git objects first; a source handoff may
   then identify one writable fork-owned implementation location.
3. The first real vertical slice is preferences, followed by external/native
   history. Do not launch a broad plugin migration on a green declaration test.

Record diagnostics by graph: target-0.4.47 source error, installed-0.4.15
declaration error, package-source declaration error, or packed-artifact/runtime
error. A transitive React declaration dependency from installed SDK 0.4.15 is
an installed-graph fact, not generic-entry runtime leakage. A target probe that
cannot build due to unrelated guide/template diagnostics is likewise not a
clean target proof. Never mask either result with a private path or a cast.

## Completed declaration validation

The strict declaration command succeeded after the Draft 4 correction,
including all `packages/bb-identity/*.d.ts`, the original contract assertions,
the consumer call/JSX/cleanup witness, and the independent raw-core
construction witness with React JSX enabled. In particular it retains the
pre-existing resolver-only `IdentityProvider` assignability assertion, while
exercising the new connection, health, conflict-token, cursor, call, JSX,
cleanup, raw registration, and raw acceptance surfaces. This is declaration
validation only; the vertical runtime and packed-artifact proofs above remain
open gates.

## Bounded implementation evidence — 2026-09-05

The package-library slice now has executable integration evidence, distinct
from the declaration graph and from the proof-core runtime.

- `bun run identity:check` completes package typecheck, builds only
  `index/model/host/server/testing` runtime entries, and passes thirteen runtime
  tests. The tests cover capability absence versus malformed/outage behavior,
  resolver-only registration and an ordinary-string raw readiness generation,
  scoped/external acceptance envelopes, lookup decoding, and rejected provider
  replacement retention.
- Server tests issue a write target, accept a nonempty address with the exact
  actor/session/subject binding, reject a read target and mismatched
  actor/session/subject/empty address, then reject after the original live
  request is aborted. They also mutate every exposed target snapshot branch;
  validation remains bound to the private issuance primitives. This is a local
  adapter/server fixture proof, not native transactional acceptance evidence.
- The generated library manifest now includes `client.d.ts` and `state.d.ts`,
  which are transitively referenced by the public server/testing declarations.
  A fresh `bun pm pack` tarball test lists those declarations and precisely the
  five implemented runtime files; it rejects accidental `bb`, `client`,
  `state`, or `react` runtime exports. `bun run sync:check` and the five
  workspace-definition tests pass.
- The strict declaration command still passes the consumer and independent
  raw-core construction witnesses. The raw witness is structural feasibility:
  it is not evidence that the SDK property is constructed by core at runtime.
- `adapter-core-wire-validation.runtime.test.mjs` supplies the complementary
  negative runtime proof: malformed ready-session, self-profile, provenance,
  submitted-acceptance, and lookup values that resemble the early core DTOs
  are rejected rather than accepted. The core-side
  `package-raw-protocol-compat.test.ts` assigns actual `P6rRawProtocol` methods
  to independently mirrored package wire DTOs. The initial six-member pass was
  intentionally insufficient; the full-surface assignment now holds the core
  typecheck open on history/page, provider/directory, participant and
  invalidation DTO gaps until the core-owned provider bridge aligns them. The
  remaining gate is therefore both full raw compatibility and production
  behavioral evidence.

Proof-core startup has separate additive-ledger evidence: the temporary proof
started with its isolated state, retained the native migration ledger, and
created its independent P6R ledger/tables. It is explicitly not end-to-end
identity acceptance, request/session compatibility, or a promotion result.
The actual `experimental_p6rIdentity` factory remains pending the identity
factory export and lifecycle wiring. Its eventual runtime witness must discover
the public SDK property, use the exact `openRequest` scope for both `accept`
and `forwardRpc`, and decode real raw result envelopes without casts or
package-private brands. Until that passes, enhanced capability advertising and
the remaining preferences/history/IdP/independent-root vertical matrix stay
open.

As inspected in the proof source at this point, `createP6rIdentityService` has
only its definition and isolated test call site; `apps/server/src/server.ts`
does not yet compose it into `createPluginService`. The lifecycle candidate
code is consequently inert in a production server even before the real raw
operation DTOs are supplied. This is a specific core composition blocker, not
a package fallback or proof-launch blocker.
