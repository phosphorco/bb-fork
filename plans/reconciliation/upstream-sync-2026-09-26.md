# Upstream refresh, 2026-09-26

Base: `9c9bae7f36a237c7e1b96de3d4c2186d13967686` (BB 0.44.0).
Result tree: `e6a0b1f19b32d7234e32a0a0c833a8c4d210b719`.

The 38-patch queue was replayed, retaining upstream plugin build caching and
atomic startup-context creation alongside downstream attribution. Upstream's
retired Monaco language test was kept retired. The identity/context migration
now follows upstream retention migration 0131 as 0132, with a freshly generated
schema snapshot. Patch 42 accepts only the exact preceding fork bridge receipt
(timestamp and SQL hash), retaining ledger history.

Queue verification, 99-task typecheck, 52-task build, and all 623 database tests
passed. The private previously upgraded core copy also upgraded and retried:
139 ledger rows, latest 1790230932026, quick_check ok, zero foreign key errors.
The copy is a schema rehearsal, not a complete host restore proof.

The first broad test run hit /tmp inode exhaustion. A disk-backed scratch run
with lower concurrency is in progress; activation and publication are pending.
