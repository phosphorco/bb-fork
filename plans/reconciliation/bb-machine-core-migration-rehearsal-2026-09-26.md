# bb-machine core migration rehearsal, 2026-09-26

The normal `bb.service` was stopped while SQLite copied its core database to
`/home/ubuntu/.local/share/bb-reconcile-migration-rehearsal-20260926/` (mode
0700; database mode 0600), then restarted against the unchanged old runtime.
The first copy revealed missing historical ledger and table-order support in the
candidate bridge. Patch 0040 adds only the observed four branch ledger identities,
the exact published `0119_soft_pandemic` hash, and the observed column order.

The fresh, transaction-consistent copy had SHA-256
`25d854081bcb3067cb0f111b87d967bd09b5665b3128e7a45030b31b1707975e`.
Its 124-row migration ledger ended at `1789175706080`; `quick_check` returned
`ok`. The source tree tested was `045c543f6da18c402f13415c9ee367458a98e1a2`.
The target migrator completed and an immediate second run succeeded. The ledger
then held 137 rows, ending at `1790103658751`, with the
`identity-context-0131` bridge completion marker. `quick_check` returned `ok`,
`foreign_key_check` returned zero violations, and row counts remained equal for
threads (76,740), events (1,571,694), thread facet principal profiles (76,848),
and app settings values (10). The private rehearsal logs remain beside the copy.

This core copy establishes the observed database migration path and its retry.
Live activation still requires a final pre-upgrade state backup, canonical
materialization/build, and runtime and selected plugin acceptance.
