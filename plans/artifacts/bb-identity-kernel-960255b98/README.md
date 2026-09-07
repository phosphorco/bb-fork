# Selected identity review composition

This directory preserves a reproducible source selection. It is not the active
`patches/series`, a full-host release, or a second runtime. Do not append it to the
old claimed-identity queue. Its exact upstream base is
`960255b98ce3dccdcb5754eb67a7f989236602a1`.

Run `scripts/verify-selected-kernel` from the fork repository. It fetches that
exact source commit into a disposable bare repository and verifies every patch
hash and predecessor/result tree in `composition-replay.json`. The default
verifies kernel + 04–12; `--kernel-only` checks the original 91c25 selection.
The complete result is `c30b12255a7f9f098e7bf9b6d1999410e7956785`.

The original `receipt.json` and `selection.json` describe only the kernel.
`verified-mention-targets.json`, `built-sidecar-migrations.json`, and
`composition-verification.json` record subsequent independent source/artifact
checks. Historical receipts are not claims about a different tree.

Included: trusted provider lifecycle/admission, scoped plugin RPC/HTTP, promised
acceptance/history and queue finality, exact event/tool correlation, retained
facets/execution and capability routes, verified mention targets, and built P6R
migration closure. Mention targets remain distinct from contribution authors.
New ordinary native attribution, presence/status/UI, and provider-input transport
remain outside this selection.

Follow [upstream sync guidance](../../bb-identity-upstream-sync.md) and the
[selection ledger](../../lanes/bb-identity-core-selection.md) before replacing the
canonical queue. Preserve existing sidebar/mobile/appearance/recovery and other
independent host behavior. No normal/upstream HEAD or service was changed.

Publication is deferred. The approved identity archive is immutable; changed
package bytes require another review. Controlled packed-provider tests establish
host API compatibility, not real Tailnet ingress or universal plugin coverage.

Family 12 preserves the tested preview authentication correction: configured
non-ready invocations fail before handler dispatch with structured HTTP/RPC
errors. It retains generation/abort checks and ready-request deadlines. Its
source tree is also the input to the shared SDK package recorded by the
workspace's `sdk-artifacts/` receipt. The active queue and normal-host pin are
unchanged; review-branch publication does not promote this composition.
