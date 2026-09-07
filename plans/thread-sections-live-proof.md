# Thread Sections live proof proposal

## Purpose and boundary

This is a planning-only proposal for the first actual Thread Progress / Thread
Sections consumer proof. It does not authorize a build, install, profile edit,
runtime reload, service operation, state reset, or another checkout.

The existing temporary proof authorization covers only the visible fork
candidate at `/home/ubuntu/bb/fork/build/proof-bb`, ports `39886` through
`39888`, and `/home/ubuntu/.local/share/bb-fork-proof`. It leaves the normal
runtime and its state untouched.

The proposed base comparison below is deliberately separate. It needs a new
environment decision before it is created or launched. This document records a
candidate path and ports after read-only checks only; it does not reserve them.

## Immutable compatibility target

The fork Git baseline is `960255b98ce3dccdcb5754eb67a7f989236602a1`. Its
`packages/plugin-sdk/package.json` declares SDK `0.4.47`. It is not the whole
fork implementation under test: the P6R runtime, dispatch, SDK and sidecar
work are dirty/untracked proof-worktree inputs. The fork receipt must therefore
contain the exact proof worktree HEAD, SHA-256 of `git diff --binary HEAD`, and
one SHA-256 per untracked source path, following the existing proof-runtime
source-fingerprint rule.

The matching base target is a clean worktree at the same
`960255b98ce3dccdcb5754eb67a7f989236602a1` commit. Fork is that exact Git
baseline plus its separately receipted changes; base is that exact baseline
with an empty tracked diff and no untracked source. This is the direct
base-versus-fork comparison and avoids treating either the installed Thread
Progress `dist` metadata (`0.4.15`) or SDK-major compatibility alone as proof.

The earlier parent `44cc2292dff443bb626866171708801a904bf45a` is not the
proposed base. It is upstream `#3105`, while `960255b` is upstream `Prepare
bb-app 0.42.0 (#3106)`; selecting it would introduce an unrelated upstream
delta. The base receipt must record the clean `960255b` worktree/commit and
empty source fingerprint at launch.

The current plugin repository HEAD,
`1cfafeda7f772a41d9379d4374c95ac10886a920`, is likewise only a baseline. It
excludes dirty Thread Sections adoption and the dirty/untracked
`packages/bb-identity` consumer dependency. The consumer input is therefore a
source receipt, not a commit shorthand:

1. Plugin repository HEAD plus SHA-256 of `git diff --binary HEAD`.
2. A sorted map of every untracked, nonignored path to SHA-256.
3. The resolved bundle-input graph for both server and app, with each source or
   generated input's repository-relative path and SHA-256.
4. The workspace manifests and lockfile used to resolve that graph, plus the
   resolved build-tool and SDK version/digest inputs.

At planning time the relevant closure begins with `plugins/thread-progress`,
the dirty/untracked `packages/bb-identity` package, root `package.json`,
`bun.lock`, generated SDK declarations consumed by the build, and every actual
input discovered by the two bundlers. The receipt must capture the discovered
graph, not a hand-maintained approximation. A later selected set of committed
revisions may replace these dirty receipts, but a local proof must not discard,
stash, or require committing authored work.

## Required sealed artifact

Build one artifact from the recorded consumer source receipt with SDK `0.4.47`,
then mount the byte-identical result in both isolated hosts. The sealed artifact
root has only a generated manifest plus:

| Required file | Reason |
| --- | --- |
| `package.json` | Declares `thread-progress`, version `0.1.0`, and entries `./dist/server.js` and `./dist/app.js`. |
| `dist/server.js` and `dist/server.meta.json` | Actual factory code and SDK/version identity. |
| `dist/app.js`, `dist/app.css`, and `dist/app.meta.json` | Actual ProgressInbox bundle and its served asset receipt. |

The generated manifest must have no TypeScript/source entry fallback. The
profile records SHA-256 for all six files and a whole-root content hash. The
artifact builder writes outside the canonical Thread Progress root; it must not
refresh `plugins/plugins/thread-progress/dist`, which may be observed by the
normal runtime.

The isolated-output prerequisite is landed in the actual current API:
`buildPluginServer(rootDir, bbVersion, toolchain, { outputDir? })` and
`buildPluginApp(rootDir, bbVersion, toolchain, { minify?, outputDir? })` retain
`join(rootDir, "dist")` as their default, keep all configuration and source
resolution rooted at `rootDir`, and stage/publish inside the selected output
directory. Focused Turbo tests prove the default paths, custom artifact paths,
artifact emission, and byte-identical canonical `dist` sentinels:

```sh
cd /home/ubuntu/bb/fork/build/proof-bb
pnpm exec turbo run test --filter=@bb/plugin-build -- --run src/build-plugin-server.test.ts src/build-plugin-app.test.ts
pnpm exec turbo run typecheck --filter=@bb/plugin-build
```

Both passed on 2026-09-05 (18 focused tests and typecheck). This enables a
future proof-only assembler to write outside the dirty canonical Thread
Progress root, but does not itself build an artifact or alter the CLI/runtime
loader.

Complete input provenance is still missing. Neither current compatibility
`*.meta.json` nor an esbuild metafile alone is a sealed source receipt: server
does not request a metafile, app requests one only for dependency Tailwind
scanning, and CSS/manifests/generated runtime shims contribute separate inputs.
The separately scoped receipt work must add server/app sidecars and result
`receiptPath` values that hash package manifests and entries, the complete
esbuild graph, authored CSS, exact own/dependency Tailwind scan files and
patterns plus dependency manifests, generated Tailwind/theme and runtime-shim
sources/export manifest, toolchain/SDK identities, artifact metadata inputs,
and final output bytes. It must prove that a dirty or untracked closure change
changes the receipt before a proof assembler atomically publishes a sealed
directory beneath proof state. This remains a routine source/tooling change
within existing fork-proof authority, not a machine-role decision.

Use a managed or explicitly sealed artifact registration, never an ordinary
`path:` registration of the canonical plugin source. In the current runtime a
path source resolves its server entry from the manifest source and may rebuild
the frontend when it considers source newer than `dist/app.js`; that is not a
same-artifact witness.

## Minimal profile and launcher delta

Upgrade `fixture-profile.json` and `fork/scripts/proof-runtime.mjs` from the
current version-1, exactly-two, server-only fixture schema to version 2:

```json
{
  "version": 2,
  "plugins": [
    { "id": "p6r-proof-signed-idp", "kind": "server-fixture", "root": "...", "files": {} },
    { "id": "p6r-proof-identity-probe", "kind": "server-fixture", "root": "...", "files": {} },
    {
      "id": "thread-progress",
      "kind": "sealed-app-artifact",
      "root": "<proof-state>/plugins/cache/npm/@phosphor/bb-plugin-thread-progress/0.1.0/node_modules/@phosphor/bb-plugin-thread-progress",
      "source": {
        "sourceReceipt": "<sha256 of head/diff/untracked/closure receipt>",
        "baseSdkVersion": "0.4.47",
        "forkSdkVersion": "0.4.47"
      },
      "files": {
        "package.json": "<sha256>",
        "dist/server.js": "<sha256>",
        "dist/server.meta.json": "<sha256>",
        "dist/app.js": "<sha256>",
        "dist/app.css": "<sha256>",
        "dist/app.meta.json": "<sha256>"
      },
      "contentSha256": "<sha256>",
      "sealedManifestSha256": "<sha256 of retained receipt manifest>",
      "tarballSha256": "<sha256 of packed artifact>",
      "npmIntegrity": "sha512-<base64>",
      "preActivationSettings": {
        "summariesEnabled": false,
        "summariesForChildThreads": false,
        "idleDelaySeconds": "3600",
        "summaryMinUserTurns": "1"
      }
    }
  ],
  "boundary": "<existing selected P boundary>",
  "publicKeyPath": "<existing confined proof key>",
  "publicKeySha256": "<existing digest>"
}
```

The literal boundary/key values remain the existing reviewed P fixture values;
they are not duplicated or relaxed for Thread Progress.

Validation changes are deliberately narrow:

1. Retain exact P/F roots, public-key confinement, loopback-only ingress, and
   all-disabled-builtin checks.
2. Permit `thread-progress` only as `sealed-app-artifact`, only under
   `<proof-state>/plugins/cache/npm/@phosphor/bb-plugin-thread-progress/0.1.0/node_modules/@phosphor/bb-plugin-thread-progress`, with precisely the six files
   above, no symlinks, and matching individual plus whole-root hashes.
3. Parse both metadata files and reject anything except plugin ID
   `thread-progress`, version `0.1.0`, format version 1, SDK major 0 and SDK
   version `0.4.47`.
4. Verify generated manifest entries are exactly the two `dist` JavaScript
   entries and reject host entry, schedules, additional executables, or source
   fallback entries.
5. Use the internal managed-NPM `stageNpmInstall` operation to register disabled
   and write the four non-secret values through the core settings service. Its
   explicit descriptor/value input is reviewed against the selected feature source
   and included in the proof receipt. It is operator preconfiguration, not runtime
   discovery of a manifest settings schema. Validate descriptor/value keys and
   types, reject secrets and unsets, and never load a factory to discover settings.
   The core seam and offline launcher composition pass isolated real-artifact
   tests. Stopped live execution remains a separate gate.
6. Record the artifact root hash, every file hash, effective settings and
   installed plugin root in startup and verification receipts. Refuse profile,
   byte, setting, or active-root drift.

These are ordinary, reviewable launcher/profile and artifact-tooling changes
under the existing proof authority. They must have tests beside
`fork/scripts/proof-runtime.test.mjs`; none requires a user decision merely
because it touches a profile, cache, or package source.

## Supported sealed-artifact route

The existing managed npm installer is the only approved registration route for
the sealed Thread Progress artifact. A `path:` installation is not suitable:
it invokes the app builder during install, and the mutable-path runtime may
rebuild when source timestamps are newer than `dist/app.js`. Do not seed an
installed-plugin or artifact row directly.

The proof-only assembler writes a sealed root outside canonical plugin source,
packs it to a tarball, and serves that tarball from a loopback-only ephemeral
registry for the existing `npm:` install flow. The installer owns atomic
promotion and registration. For package `@phosphor/bb-plugin-thread-progress`
version `0.1.0`, the profile root is exactly:

```
<proof-data>/plugins/cache/npm/@phosphor/bb-plugin-thread-progress/0.1.0/node_modules/@phosphor/bb-plugin-thread-progress
```

The profile records the selected tarball SHA-256 and SHA-512 integrity, the
managed artifact content hash, the installed-root content hash, all six served
file hashes, and the full server/app build receipts retained in the sealed
manifest. Staging verifies those values after the normal installer returns;
it does not infer an installed root or manufacture registry/DB metadata.

The eventual reviewed command sequence is: build the sealed root to a fresh
proof-local staging directory; pack and hash its tarball; run the loopback
registry only for the installation transaction; install the exact
`npm:@phosphor/bb-plugin-thread-progress@0.1.0` source through the normal
plugin service against that registry; close the registry; compare the uploaded,
downloaded and installed receipts; then write the profile while the isolated unit
remains stopped. The disabled stage operation writes validated settings through
the core settings service; the launcher never writes settings rows directly. These are
implementation commands to be reviewed, not commands to run during planning.

The sealed package retains every actual non-host server external from its
compiled server bundle as a pinned runtime dependency. The two host SDK bare
imports are recorded in the receipt and are resolved by BB's server SDK alias.

## No-fallback evidence

Before enabling the plugin on either host, require all of the following:

1. Artifact assembler test: independently rebuilds from the selected source
   receipt and its actual dependency closure, verifies the six-file manifest,
   and demonstrates no write below `plugins/plugins/thread-progress` or the
   dirty `packages/bb-identity` source.
2. Launcher profile test: rejects a missing app/server metadata file, a source
   entry, a symlink, wrong SDK version, altered content hash, altered setting,
   and an active plugin whose root differs from the sealed root.
3. Runtime test: the installed row resolves `dist/server.js`; app asset serving
   returns the sealed `app.js`/`app.css` hash; no frontend-build invocation is
   attempted. This test must fail if the runtime falls back to `server.ts` or
   calls the app builder.
4. Live receipts: plugin list reports `thread-progress` running from the sealed
   root; server/app metadata report SDK `0.4.47`; server and app asset hashes
   equal the profile hashes; the base and fork receipts have equal artifact
   hashes.

## Cold and drained activation

Thread Sections must not overlap an older legacy writer. Before first
activation on each host:

1. Stop only the selected isolated proof unit; verify its three ports are free
   and the normal service identity/source/state are unchanged.
2. With the selected isolated database closed to writers, inspect that there is
   no enabled/running `thread-progress` row, no old Thread Progress generation
   or request in flight, and no `plugins/thread-progress/data.db` work queue.
   The relevant empty tables are `notification_outbox`, `summary_jobs`, and
   `sticker_jobs`.
3. Verify there are no visible primary-host threads with an environment. A
   no-environment idle fixture thread is allowed for the initial Inbox display;
   it avoids plan observation.
4. Provision the reviewed sealed registration and pre-activation settings,
   start the isolated unit, enable only P, F and Thread Progress, then run the
   normal proof verification plus the no-fallback checks above.
5. After the proof, disable Thread Progress, drain/confirm its background
   service has stopped and its outbox/jobs are empty, stop the isolated unit,
   verify its ports are free, and rerun normal service identity/state checks.

The proof launcher currently does not install or enable fixtures. The
coordinator performs the reviewed registration/activation; the launcher only
validates it. Do not add direct database seeding outside the explicit,
validated pre-activation setting port.

## Bounded launch, health, drain and cleanup commands

These commands are the proposed execution envelope after the documented
implementation reviews pass. They are not commands to run while this proposal
is under review.

```sh
# Before and after every isolated proof action: normal is observed, never stopped.
systemctl --user show bb.service -p ActiveState -p MainPID -p WorkingDirectory

# Existing fork proof only.
fork/scripts/proof-runtime check
fork/scripts/proof-runtime status
fork/scripts/proof-runtime verify
fork/scripts/proof-runtime stop
ss -ltn '( sport = :39886 or sport = :39887 or sport = :39888 )'
systemctl --user show bb.service -p ActiveState -p MainPID -p WorkingDirectory
```

Add two bounded launcher subcommands rather than using ad-hoc SQLite mutation:

```sh
# Proposed, after review: validates profile bytes, sealed artifact and the
# approved pre-activation settings while no Thread Progress factory is live.
fork/scripts/proof-runtime fixture-stage thread-progress <proof-artifact-root> <prospective-profile-path>

# Proposed, after stop and before enable: reports only the proof-local rows,
# active generation count and the three producer queues named above.
fork/scripts/proof-runtime fixture-drain-check thread-progress
```

`fixture-stage` refuses a running proof unit, any existing Thread
Progress registration, mismatched artifact/profile bytes, or values outside the profile's
four-setting allowlist. `fixture-drain-check` fails on an active request,
generation, visible primary-host environment thread, notification outbox row,
summary job, or sticker job. The drain command is strictly read-only; only the stage command mutates state. Both commands include the normal-service identity
in their receipts.

After a user authorizes the base environment, give its parallel launcher the
same verbs and substitute its own selected unit/path/ports:

```sh
fork/scripts/base-proof-runtime check
fork/scripts/base-proof-runtime fixture-stage thread-progress
fork/scripts/base-proof-runtime start
fork/scripts/base-proof-runtime verify
fork/scripts/base-proof-runtime fixture-drain-check thread-progress
fork/scripts/base-proof-runtime stop
ss -ltn '( sport = :39986 or sport = :39987 or sport = :39988 )'
```

The base launcher is proposed only; it does not exist and must not be created
before the environment decision below.

## Producer and scheduler limits

Thread Progress's factory begins `progress-sweep` immediately. The selected
consumer receipt must show the factory still reconciles visible threads and
facets, drains notification outbox, sweeps every five seconds, and refreshes
observed plans before this plan is used; those facts must not be inferred from
the committed pre-adoption baseline alone.

| Source behavior | Proof control |
| --- | --- |
| Summary sweep can fork/spawn hidden model threads after idle delay. | Frozen `summariesEnabled=false`; do not change it while live. |
| Sticker action spawns a hidden worker. | Do not expose or invoke sticker actions in this proof. |
| `thread.idle` / `thread.failed` enqueue and drain Notifications work. | No turn execution or state-transition events; empty outbox before/after. Notifications remains disabled. |
| Observed-plan refresh executes `git` and `bun` in every visible primary-host environment. | No visible thread with a primary-host environment; no environment provisioning. |
| Summary/sticker cleanup archives workers. | No pre-existing jobs; verify empty job tables before/after. |
| P/F identity provider and probe are needed by the enhanced fork. | Keep existing offline signed P boundary; no real provider, model, scheduler, or external sink. |

The first live scope is therefore ProgressInbox and Thread Sections state
read/write under signed P admission, using a no-environment fixture thread. It
does not prove summaries, stickers, notification delivery, observed-plan
execution, or provider/model execution.

## Base runtime decision and proposed coordinates

Read-only checks found these paths absent and these ports without TCP listeners:

| Proposed only | Read-only fact |
| --- | --- |
| `/home/ubuntu/bb/fork/build/base-bb` | Absent. |
| `/home/ubuntu/.local/share/bb-base-proof` | Absent. |
| `127.0.0.1:39986`, `:39987`, `:39988` | No listener at inventory time. |

If and only if the user authorizes an additional isolated base runtime, use
those paths and ports, a separate user unit, a separate state marker, a clean
worktree at exact `960255b98ce3dccdcb5754eb67a7f989236602a1`, and the same
sealed artifact bytes. Repeat the proof launcher's port collision, normal-health,
source-fingerprint, cgroup-environment, enablement, drain and cleanup checks
for that unit. Do not create the checkout, state directory, unit, artifact copy
or listener before that decision.

The existing AGENTS contract authorizes only the current visible proof checkout
exception. The added base checkout/runtime is the sole environment expansion
here that requires a new user decision.

## Risks retained in this proposal

- The current artifact builder has an isolated output-root option, but lacks a
  complete source-input receipt; a custom output directory alone cannot prove
  the sealed artifact's dirty/untracked closure.
- Base/fork same-artifact proof is invalid if either host silently recompiles or
  accepts a source fallback. The runtime and live receipts above are mandatory.
- A cold start alone does not make scheduler behavior safe. The frozen settings,
  empty queues and no-environment precondition are required together.
- This proof establishes one constrained live consumer path only. It does not
  establish hidden summary/sticker workers, Notifications delivery, plan-tool
  execution, model work, generic browser portability, or normal-host promotion.

Build-receipt output identities are relative to the authored source root, so a
custom output directory may appear as `../../.../dist/app.js`. Sealed verification
retains those original records but never dereferences them: it matches each
expected output uniquely by filename and independently hashes the sealed bytes.
The fixture uses this real path shape. A bare `dist/app.js` assumption previously
rejected a valid actual artifact and was corrected before offline staging.
