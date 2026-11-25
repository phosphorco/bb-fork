# Message Rules and Prompt Rules retirement

The selected queue contains no retired native-admission migration recognition,
replay, policy runtime, or Prompt Rules renderer. Native dispatch hooks remain
upstream-owned. The direct authored guide wording patch is independent and stays.

`packages/db/src/migrate.ts` rejects unsupported ledger timestamps before any
writes. The rationale is explicit: Drizzle's greatest-timestamp selection can
silently suppress native migrations. Supported identity/context migration bridges
and their exact-history validation remain; retirement adds no branch-specific
receipt allowlist or runtime repair path. Four obsolete receipts in the installed
ledger are intentionally unsupported even when all native receipts exist.

The Message Rules-specific host-offline polling/recovery delta from historical
0083 is removed from patch 0002, together with its old tests in 0007. The existing
native automatic failure path records a failure and books a retry. The unrelated
interaction/workspace wake reconciliation in patch 0006 stays. A regression
injects `queued_message_claim_lost` at the native send boundary during reconnect,
then checks real SQLite retry booking. Before the booked retry, it restores real
native send and asserts queue removal and exactly one `client/turn/requested`
event, including after repeated due-retry and reconnect wakes. This bounded
witness does not recreate the original reconnect race, establish general
exactly-once delivery, qualify every retained queue state or cancellation, or
claim a live deployment test.

## Offline operator preparation

`scripts/convert-offline-migration-ledger.py` is a standalone operator tool, never
loaded by BB. It accepts a source snapshot opened read-only, a **new** output
path, an explicit reviewed receipt manifest, and the selected migration directory:

```sh
python3 scripts/convert-offline-migration-ledger.py \
  /offline/installed.snapshot.db /offline/converted.db \
  /offline/reviewed-receipts.json /qualified/source/packages/db/drizzle \
  > /offline/conversion-audit.json
```

The manifest contains `retired_receipts` objects with exact `hash` and
`created_at` fields. The tool refuses missing, duplicate, or changed reviewed
receipts; missing/mismatched selected migration receipts; removing a selected
receipt; and existing output paths. It copies the database, removes only the
reviewed ledger rows in that new copy, preserves all tables/data and unrelated
receipts, checks integrity, and returns an audit. Output permissions are 0600.
It does not infer schema or apply skipped migrations. A database with a native
receipt hole requires separate investigation, not conversion by this tool.

Qualify the output with this release and repeat startup before any separately
authorized cutover. This source change authorizes no live database write,
activation, restart, or replacement of operator state.

## Source review and proof

Fresh upstream main was inspected at
`fb045a046653cc127656ca3c7243d44ae4c94f3f` (November 24, 2026); latest desktop
release tag `desktop-v0.50.1` resolves to
`a08e116566d1785bc04578a866df8a0359157dd4`. Both have native failure booking and
post-migration ledger validation, without this fork's retired admission replay.
The selected upstream pin remains `df9619d8e8aac4aff00c0c3ff9b8ef4e2823e4f2`.
This retirement is not an upstream refresh.

Qualification includes synthetic refusal tests and a SQLite-consistent backup
of this host's real retained core database. The real copy contains all 162
selected native receipts, one supported identity/context historical receipt and
the four obsolete receipts. The original cohort refuses without logical changes.
Explicit copy conversion removes only the four reviewed receipt rows; all 88
table schemas and payloads remain identical, including 44 retired history rows
in eight tables. Both the old release and final candidate migrate the converted
copy twice, retaining 163 receipts and passing integrity/foreign-key checks.
The existing identity/context completion timestamp refreshes at startup; its
payload and schema are unchanged. Full exports, backup digests and comparisons
are recorded in the retirement steward's private host evidence. Copy qualification
alone neither activates state nor establishes deployed user-job behavior.

For this exact fully-applied ledger, an authorized one-time `BEGIN IMMEDIATE`
transaction may remove just the four reviewed live receipt rows after a fresh
consistent backup, durable history export, full-ledger equality check under the
write lock, and successful old/candidate qualification of the fresh converted
copy. This avoids replacing a live core database and preserves concurrent
payload writes. It is a separate operator cutover, never startup behavior.
Changed receipts, missing native history or uncertain commit outcome require
inspection rather than automatic adoption, replay or retry.

The central historical archive is
[`../plugins/__archive/bb-message-rules/fork/`](../plugins/__archive/bb-message-rules/fork/).
Its `__archived/patch-prompt-rewriting/` contains both runtime prompt patches and
their dedicated notes/candidate verification script. Its
`__archived/01aff-overlay/patches/` contains 0046, 0047, 0073, 0074, 0078 and 0083.
Mixed historical manifests stay byte-for-byte in the fork, with relocation
provenance maintained by the steward. Nothing from those archives is selected.
