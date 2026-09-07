# Building the replacement fork alongside the current release

> Consolidated into the [BB fork master plan](bb-fork-master-plan.md).
> Retained as supporting review and source evidence; the master plan governs
> replacement implementation.

Status: execution recommendation, 2026-09-04. This reviews revision 3 of
[the principles plan](bb-fork-first-principles.md), committed as `7b5c8e27c`.
It does not change the active release, database, workspace gitlinks, or the
principles document. Source findings below use its exact upstream target,
`ee4a5777bf1efb255a87cd9dc91fd3ae92830268`.

## Recommendation

Augment `phosphorco/bb-fork`. Start the replacement source history from the
pinned upstream commit and implement only the justified capabilities. Keep
the current release available while proving the replacement. A new repository
does not reduce the semantic coupling that makes this fork expensive.

Use two tracks in the existing remote:

- The current overlay release remains the shipping receipt until replacement
  cutover. Essential fixes can continue there.
- A replacement overlay branch, such as `redesign/identity-first`, records
  candidate locks, generated patches, and tooling. Full-tree source branches
  such as `source/identity-first/desktop-v0.41.0` carry the actual implementation
  commits. These names are proposed, not created by this review.

The candidate overlay branch and source branch have different jobs. The source
branch is the editing authority; the overlay commit is the release receipt.
Do not hand-edit exported patches and source independently. Pin exact source
and upstream commits plus the result tree, and verify that replay produces the
source tree. This builds on the existing materializer and verifier instead of
introducing an unrelated build system.

Mixing overlay and full-tree histories in one remote is workable, but CI must
select the appropriate checks by branch family. Default-branch automation must
not assume that a source branch contains overlay tooling. A separate source
repository becomes worthwhile only if permissions, CI, or release ownership
need that boundary; no such requirement has been established here.

## What parallel development means operationally

The workspace contract already defines the useful isolation: the normal host
keeps running the old tested composition while staging builds the candidate at
`/home/ubuntu/bb/fork/build/bb`. Plugin sources stay in the canonical plugin
repositories on each host. There is no second default runtime on either host.

This thread is on Rosetta, and the fork, runtime, and plugin checkouts contain
authored changes. The connected BB machine list did not identify `bb-machine`
by that name; that does not prove the staging machine is absent. Establish its
actual availability and role before assigning implementation there. Do not
switch the dirty Rosetta checkout to make room for the candidate.

CI can replay and test disposable artifacts without becoming a deployment
source. If another simultaneously running candidate is desired on the same
host, define that as a deliberate change to the workspace topology first;
putting a second checkout in a new repository does not resolve the conflict.

Candidate state must be isolated as well as code. Early boot tests use empty
state and no external producers. Import rehearsals use consistent copies with
schedulers, queued execution, Slack delivery, and other external effects
disabled. Do not start a fully active server merely to initialize a schema;
provide a migration/import-only entrypoint. Candidate agent tests use explicitly
selected test threads and producers.

## What to retain from revision 3

The strongest decisions are explicit actors at acceptance, separate principal
and external-author operations, durable per-input-group attribution, fork-owned
schema migrations, transactional sidecars, rebuildable participant state, and
exact source/release receipts. Keep provider activation safe across reload.
Do not return to ambient actor lookup or a naive resolver reference swap to
save lines.

Keep JSON extensions and sidecars as the default. They remove migration-journal
collisions, but they still depend on upstream transaction and event semantics.
The governing criterion is preserving facts atomically with a maintainable
integration. Treat file counts and bans on existing test changes as review
signals, not proofs of correctness or absolute reasons to reject a necessary
change. A conflict-free patch can still be behaviorally wrong after a rebase.

## Corrections before implementation

### 1. Make model-visible attribution an explicit requirement

Revision 3 specifies timeline attribution and tool contexts but omits the
provider-input seam. The current first patch carries `p6rSpeaker` into the host
daemon and generates a `[from @handle]` prefix. On the proposed upstream target,
`groupedInputForRuntime` in `thread-send.ts` simply flattens groups with blank
lines. Persisting `p6rActors` alone does not make the model see them.

Specify three consumers of one durable actor record: the human transcript,
provider input, and tool context. The provider formatter must label each group
from its accepted snapshot, preserve attachment-only inputs, identify external
sources, and avoid wrapping retries twice. Text that resembles an attribution
marker remains user content and must never be parsed back into identity.

Prefer one formatter at the last common point that retains group boundaries.
The implementation spike must determine whether this also requires a structured
server-to-daemon field; count those contract and daemon changes in the footprint.
Test the actual provider input for initial send, steer, queue batch, retry, and
resume. UI screenshots and event-schema tests cannot establish this property.

### 2. Separate authorship, editing, and execution origin

The draft says queue edits transfer authorship, while its motivation promises
durable authorship from acceptance. Choose one precise queue contract. My
default is to retain the queued creator and record the latest content editor;
the pending UI can show both. Dispatch preserves both facts. If ownership
transfer is preferred, state it as product behavior and retain provenance
separately. Do not make changing a typo erase who submitted the draft.

On the pinned target, `resolveEditableTurnCandidate` explicitly rejects grouped
messages. Initially preserve that upstream restriction. Support author/editor
preservation for the edits upstream actually permits, without inventing group
editing as a hidden prerequisite.

Also settle the local-tool inconsistency: the plan attributes loopback SDK
traffic to `local-tool` but says plugin background work must persist `null`.
The acceptance adapter must distinguish a local CLI submission from plugin or
agent background execution. A surface header cannot establish that distinction
as an authorization boundary. Use the existing trusted origin mechanisms and
explicit internal operations; prove the concrete plugin SDK path in a test.

### 3. Prove the write boundary with a vertical slice

Do not assume that requiring an actor argument guarantees coverage: a new
caller can still pass `null`. Inventory the actual producers and constrain the
internal acceptance API to explicit variants for direct human, external,
queued/retry, and agent/system input. Keep this internal representation separate
from the optional JSON fields needed to read legacy records.

The first slice must show two people and one Agent Connect nickname moving
through send, mixed-author queue dispatch, restart, provider input, and timeline.
Include a background send that cannot acquire the initiating person's identity.
Exercise failures around the existing queue claim and acceptance transactions.
This establishes whether the proposed small core is feasible before filling out
all its surfaces.

### 4. Start import and plugin discovery immediately

A fresh database is a reasonable default for avoiding old migration receipts.
A full logical import is still a substantial migration project. The source
inventory and one representative imported thread belong beside the first
vertical slice, not after all consumer ports.

Inventory plugin state owners and identity-key mappings early. Changing principal
encoding must not detach Notifications or Thread Progress data from its owner.
Preserve provider sessions, attachment references, thread storage, and machine
associations where required; copying event rows does not prove resumability.
Record ambiguous historical identities instead of manufacturing correspondences.

Do not transplant live worker leases, active process state, or pending external
deliveries as though these were ordinary historical records. Each such domain
needs a resume, reconcile, or retire rule. Rehearsal must never replay production
side effects.

Plugin relocation is a hypothesis to validate. Port one real producer and one
state-owning consumer early to test whether the SDK and UI surfaces suffice.
Feature removals such as native Recovery or palette behavior require an explicit
parity disposition; putting something in a plugin does not by itself preserve
the experience.

### 5. Bound actual read and write costs

Retain the no-extra-timeline-query and batched participant-read goals. Also
measure event bytes, roster bytes, fan-out, and SQLite writer-lock duration.
A full participant rebuild inside an edit transaction can stall other writers
on a long thread. Benchmark that case before deciding whether it needs an
incremental strategy.

The complete-roster approach may be sufficient, but 10,000 actors is an arbitrary
switch point without measurement. Agent Connect can create external identities
more quickly than human accounts grow. Establish a payload/latency budget and
measure it with external actors included. Avoid new pagination infrastructure
until a real budget is exceeded.

## Delivery sequence and evidence

| Step | Reviewable result | What it establishes |
| --- | --- | --- |
| 1. Baseline and placement | Verified target commit, staging availability, producer/consumer inventory, empty-state boot | The candidate has a reproducible place to run independently |
| 2. First vertical slice | Principal and external send, mixed queue, restart, provider-input and timeline checks | Attribution survives the real lifecycle |
| 3. Early import slice, alongside step 2 | One representative historical thread, queued item, and identity-owned plugin record imported and validated | Data and identity mappings are viable |
| 4. Complete durability | Supported edits, forks, interactions, retries, reload races, participant rebuild equivalence | Every acceptance and rewrite path obeys the contract |
| 5. Product completion | Required consumers, presence, rendering, and explicit parity decisions | The replacement supports the workflows people use |
| 6. Full rehearsal and maintenance exercise | Production-sized isolated import; measured costs; rebase onto a second pinned upstream revision | Cutover and ongoing maintenance work in practice |
| 7. Promotion | Pushed child commits, tested workspace receipt, normal-host pin update | Production moves to the exact tested composition |

Steps 2 and 3 are parallel workstreams, not instructions to launch agents.
Current-release receipt reconciliation can proceed independently; a known
rollback point is required before cutover, not before candidate investigation.

Begin with the smallest source export/replay path that proves reproducibility.
Add richer reports and automation as actual integration points settle. Export
into a staged artifact set and validate it before publication; several separate
file renames do not make all locks and patches atomic. Consumers should use a
committed overlay receipt, or another explicitly atomic selection mechanism.

Keep the documented target for the first proof rather than silently chasing
upstream. The second-revision rebase exercise is mandatory before claiming the
new maintenance approach works. Assess semantic fixes, manual conflict work,
and retired seams as well as changed files.

## Evidence inspected for this recommendation

- [Principles revision 3](bb-fork-first-principles.md), especially §§3, 5, 8, 9.
- [Existing materializer](../scripts/materialize) and
  [verifier](../scripts/verify): detached linked worktree, patch replay, result
  tree check; source-tip export is proposed, not implemented there.
- Current `patches/0001*`: host-daemon `p6rAnnotateSpeakerInput`, structured
  speaker command data, and speaker tests.
- Pinned target Git objects: `packages/domain/src/thread-events.ts`,
  `packages/db/src/data/queued-thread-messages.ts`,
  `apps/server/src/services/threads/thread-send.ts`,
  `apps/server/src/services/threads/thread-edit-message.ts`, and
  `apps/server/src/services/plugins/plugin-api.ts`.
- [Workspace contract](../../AGENTS.md), `./bin/status`, and the connected BB
  machine list. No staging availability or performance result is inferred
  from the architecture document.
