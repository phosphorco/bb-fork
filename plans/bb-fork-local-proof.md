# Temporary local BB fork proof

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Cole's 2026-09-05 instruction selects the current Rosetta machine with different
ports as the temporary deployment proof. This supersedes the earlier requirement
to reach `bb-machine` before candidate development. It authorizes this visible
proof worktree alongside the normal runtime; it does not change the default
service, machine role, CLI target or promotion receipt.

## Exact target

| Item | Selection |
| --- | --- |
| Host | Rosetta, `host_3tv3r7y2dp` |
| Workspace | `/home/ubuntu/bb` |
| Candidate source | `/home/ubuntu/bb/fork/build/proof-bb` |
| Source branch | `proof/identity-first` in the canonical upstream Git store |
| Starting commit | `960255b98ce3dccdcb5754eb67a7f989236602a1` |
| Server/API | `127.0.0.1:39886` |
| Host daemon | `127.0.0.1:39887` |
| Development UI | `127.0.0.1:39888` |
| Proof state | `/home/ubuntu/.local/share/bb-fork-proof` |
| Normal source/state | Existing `fork/build/bb` and `~/.bb`, retained in place |

Coordinator created the candidate worktree at the starting commit and installed
its frozen dependencies. Bootstrap launch/cleanup is now exercised independently
of the identity implementation; no identity behavior is implied by a startup.
Port inspection found no listeners on the three selected ports;
recheck and refuse collisions at every launch rather than selecting another
port silently or stopping its owner.

## Source and process isolation

The candidate worktree shares Git objects with `fork/upstream`, not its working
files, index, dependencies or generated output. The three dirty upstream entries
and 87 active-runtime entries remain in their existing stores. They are neither
copied into the candidate nor discarded. Their ownership and eventual receipt
reconciliation remains a promotion task, not a prerequisite to this proof.

All agents start from the workspace root and follow disjoint lane assignments.
Core source edits and builds target `fork/build/proof-bb`; package/plugin edits
remain in their canonical child repositories. No child retargets `upstream`,
`build/bb`, overlay locks, patches, normal plugin installations or workspace
gitlinks. Existing materialize scripts still target normal `build/bb`; do not run
them to create or refresh this proof worktree.

Launch with an explicitly scoped environment using the pinned core's supported
configuration names:

```dotenv
BB_DATA_DIR=/home/ubuntu/.local/share/bb-fork-proof
BB_SERVER_BIND_HOST=127.0.0.1
BB_SERVER_PORT=39886
BB_SERVER_URL=http://127.0.0.1:39886
BB_HOST_DAEMON_PORT=39887
BB_DEV_APP_PORT=39888
BB_APP_URL=http://127.0.0.1:39888
```

The launch owner verifies native startup respects all selected ports/data paths,
including daemon discovery, before allowing proof clients to connect. Build a
clean environment for the process: inherited BB thread/project/auth/connection
variables and `.env` files must not redirect it to the normal server. Invoke the
candidate's explicit executable for proof CLI operations; inherited `BB_CLI` or
the default `bb` wrapper must not select the normal executable. Ordinary lane
coordination continues through the existing normal BB connection.

Start with new empty proof state and explicit test plugin registrations. Do not
copy normal configuration, credentials, schedulers, outboxes, provider sessions
or database into it. Provider verification uses test identities; external-send
proofs use controlled fixtures/sinks. Compatibility proofs later use separately
identified fixtures with production producers disabled. Plugin builds and loads
must not overwrite artifacts currently executing in normal BB; record selected
artifact digests and use separately scoped build outputs when required.

The proof process has its own logs and exact process identity. Teardown targets
only that process and its children, without broad process-name kills or default
service stop/restart commands. Browser access initially uses loopback or an
explicit SSH port forward; this does not change `svc:bb` or Tailnet ingress.

## Proof and promotion boundaries

### Executable bootstrap recipe

Use `fork/scripts/proof-runtime` from the workspace root:

```sh
fork/scripts/proof-runtime check
fork/scripts/proof-runtime prepare
fork/scripts/proof-runtime start
fork/scripts/proof-runtime verify
fork/scripts/proof-runtime status
fork/scripts/proof-runtime stop
```

`prepare` is first-use only: it refuses an existing ownership marker rather than
resetting state. It checks ports and native effective configuration before
migration and seeds every bundled plugin disabled. Repeated starts validate
that disabled inventory. Without a fixture profile, the launcher admits no active
plugin. The optional proof-state `fixture-profile.json` now permits only
`p6r-proof-signed-idp` and `p6r-proof-identity-probe`, with visible source roots
under `plugins/packages/bb-identity/examples/local-proof/` and SHA-256 receipts for
their package manifests and executable artifacts. The profile has `version: 1`,
`plugins: [{ id, root, files: { relativePath: sha256 } }]`, and `boundary` containing
the validated `BB_P6R_IDENTITY_BOUNDARY` value. Only local loopback ingress is
allowed by this proof launcher; native config validation also runs before boot.
It also requires `publicKeyPath` beneath the proof state's `p6r-fixture-keys/`
directory and `publicKeySha256`. The loader verifies a regular non-symlink RSA
public PEM with that digest, then injects `BB_P6R_PROOF_PUBLIC_KEY_PATH`. Private
fixture keys stay outside source and are never passed to the provider process.

The launcher does not create the profile or install/enable plugins. Coordinator
creates the profile only after fixture sources/builds are reviewed. All builtins
remain disabled. Startup records the exact profile, verification refuses changed
profile/artifact bytes, and inherited normal identity configuration is discarded.
The fixture profile code has unit coverage; no fixture activation or running
identity proof is established merely by those checks.
It never imports normal plugin rows or credentials.

The launcher bypasses `pnpm dev` and its legacy migration/derived-port behavior.
It starts source server/daemon entrypoints and Vite with strict port selection,
using a filtered environment. It verifies the exact server launch ID before
requesting a fresh local host enrollment; enrollment material is passed only to
the daemon and remains in proof state. The candidate CLI runtime must be built
with `pnpm exec turbo run build --filter=@bb/cli --concurrency=2` in the proof
worktree before daemon startup.

The transient user unit is `bb-fork-proof.service`, with control-group cleanup,
no restart policy and a 15-second stop bound. Logs are read with
`journalctl --user -u bb-fork-proof.service`. It is separate from `bb.service`.
Any child failure ends the whole proof unit. Unit ownership is verified inside
the supervisor before starting children; all ports must be free before startup.

Credential isolation at this stage is operational: a clean environment, empty
proof state and all real provider plugins disabled. It is not a filesystem
sandbox. An attempted user-unit inaccessible-path check did not prevent access
to the normal Codex path on this host; the launcher does not rely on that
unverified mechanism. Fixture tests must not activate real providers or claim
that a shared Unix user cannot read operator files.

The launcher tests exercise environment filtering and port-collision cleanup:
`node --test fork/scripts/proof-runtime.test.mjs`. Failed boot already exposed
and cleaned up missing daemon enrollment and CLI build prerequisites. Complete
healthy-start, normal-stop and forced-supervisor-stop evidence is recorded after
those checks run, not inferred from unit configuration.

On 2026-09-05 the bootstrap reached all three health endpoints with 28 disabled
plugins and verified every live proof-cgroup process's selected routing. A normal
stop removed every witnessed process and released all three ports. A subsequent
restart succeeded; killing only the supervisor with SIGKILL caused systemd to
stop the daemon/server/UI children. The follow-up process/port check found none
remaining and the original normal service PID 3019942 still active. Receipts are in the isolated
data directory (`verified-receipt.json`, `verified-source.diff`, and
`forced-stop-receipt.json`), with startup/teardown logs in its transient unit's
journal. These are bootstrap/isolation witnesses, not identity-feature proofs.

The proof was then restarted after additive sidecar initialization landed. All
three endpoints passed again. Its pre-existing 113-row native migration ledger
was byte-for-value unchanged; the four `p6r_*` tables and one independent
`__p6r_migrations` row were added. See `sidecar-boot-receipt.json` in proof state.
The bootstrap is currently running with every plugin disabled. This verifies
the additive startup path on populated proof state, not native-session round
trips or integrated identity acceptance.

`verify` reads all three health endpoints, confirms no plugins are enabled, and
checks actual cgroup children for selected BB data/server/daemon routing and
absence of inherited thread/CLI/API-key variables. It compares the normal
service's PID/source/state with this launch's startup baseline and saves a proof-local receipt plus
tracked diff and untracked source hashes. These checks do not trace every
filesystem access or establish a sandbox against intentionally misbehaving code.

Startup now records its unique server launch ID and a fingerprint of HEAD,
tracked changes and untracked source contents before children start. Verification
requires the same launch ID and unchanged fingerprint. An already-running boot
without that receipt must restart before it can validate current source; its
earlier bootstrap receipts remain historical evidence. This prevents edits made
after boot from being attributed to the running process. Generated/ignored build
artifacts are outside this source fingerprint and still require the separate
artifact-digest proof. Concurrent edits during loading are not supported: finish
lane edits, rebuild, restart, and verify an unchanged candidate.

The same-machine target is sufficient for the first preferences and external
contribution vertical proofs, provider lifecycle tests, state/reconnect recovery,
packed-plugin checks, and upstream/fork session compatibility fixtures. Keep the
existing integration matrix: changing location does not reduce behavioral gates.
Record source commit plus dirty diff, package revisions/artifact digests, config,
isolated state fixture and results for each proof. A fresh upstream baseline
boot is infrastructure evidence, not evidence that the identity fork works.

Verify normal service health and selection before and after each proof run;
verify proof requests, subscriptions, writes and shutdown stay within its own
ports/state. Shared-machine resource contention is a limitation of this temporary
proof. It does not prove independent-host availability, normal-host cutover,
receipt replay or live-data migration.

After the implementation proofs, reconcile authored normal source and derive
the authoritative source/overlay receipts before any canonical promotion. The
normal/staging machine-role policy remains the eventual deployment contract.

### Signed HTTP admission proof — 2026-09-05

The coordinator activated the two receipted offline fixtures on the isolated
proof runtime. Launch `29d3fb59-6c0b-4e57-9296-1de429e18f76` passed the launch/source,
ports, data-path, fixture-byte and enabled-plugin checks. All 28 bundled plugins
remain disabled. Normal `bb.service` remained active with PID 3019942.

An actual HTTP RPC through the signed-lineage middleware and selected provider
verified unsigned denial, valid assertion admission and self-profile, stable
repeated-session stamps, A→B→A session replacement, forged-signature denial, and
fresh-session recovery after rejection. The persisted instance namespace was
stable across these calls. The local receipt is
`/home/ubuntu/.local/share/bb-fork-proof/http-identity-proof.json`; it records no
assertion, cookie or private key. Startup/source and fixture receipts remain in
the same proof-state directory.

This is live identity/session evidence. It does not establish live state writes,
live native sends, UI behavior, or authored-session roundtrip compatibility.
Separately, the core native-acceptance test traverses real `sendThreadMessage`
and queues `turn.submit` against an offline ready-thread fixture, without a
model launch or dispatch override. Live cold-start acceptance remains unavailable.

### Signed HTTP state and restart proof — 2026-09-05

The next receipted feature fixture adds a preferences collection through the
internal state RPC bridge and feature-owned better-sqlite3 storage. Actual HTTP
requests cross selected signed provider admission, native dotted RPC dispatch,
issued request targets, and immediate SQLite record/receipt transactions.
Two separately authenticated clients of the same person observe one saved
outcome and one conflict. Exact operation replay, changed-payload rejection,
foreign owner/instance rejection, and second-client final receipt lookup passed.
The receipt is `http-state-proof.json` in the isolated proof-state directory;
its launch is `8b77d6c5-6a26-48c7-8466-2d6d1a325014`.

After a proof-only restart, launch `50604008-2a75-4714-b78c-6cd135975aa6`
passed source/artifact, health, cgroup environment, and enabled-fixture checks.
A fresh signed session read the unchanged value/version and recovered the prior
operation's final receipt. The persisted instance namespace remained identical.
See `http-state-restart-proof.json` and the matching `verified-receipt.json`.
Normal service PID 606208, source and active state were unchanged over this
restart and verification. Earlier preparation and identity-proof receipts retain
their historical normal-service identities; verification compares the baseline
captured for each proof launch rather than rewriting those earlier receipts.

This proves live fixture state persistence and receipt recovery, including
process restart. It does not establish a portable consumer API, browser view/UI
behavior, live realtime delivery, native cold-start sends, or authored-session
roundtrips. The feature fixture deliberately imports internal composition
modules; real consumers must use the eventual complete public binding. Expired
receipt safety is separately covered by actual SQLite tombstone tests. Current
source-only endpoint/controller corrections have separate test evidence and are
not attributed to an older fixture bundle.
