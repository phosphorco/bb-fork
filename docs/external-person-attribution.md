# External person attribution V1

Cole approved this narrow change in thread thr_2ychidby82: “Let's do it! And let's update the plugin as well”, following the API compatibility review. Identity remains convenience attribution, not security.

## Missing capability and alternatives

The selected requirement is to persist a Slack sender as the canonical person author of a native BB message, alongside external origin. Public plugin sends cannot set native `p6rAuthors`. `sendExternal` stores only external sidecar authorship. Producer envelopes can identify the sender to the model but cannot populate structured native history. Directory lookups and presentation overrides do not change author identity. A plugin panel, composer banner, DOM overlay, or thread-storage annotation can display an association but cannot create the required native author record or preserve it through native queue/retry processing. Thus no plugin/native API alternative implements this specific structured-authorship requirement. The existing manual-link experience remains useful independently.

## Smallest extension

Extend the existing outer identity protocol1 with an optional versioned contribution subprotocol. Reuse its acceptance transaction, JSON evidence, operation hashes, queue reservations, and history tables. Add canonical integration-asserted person projection to native authors. Preserve external origin and legacy send/lookup bytes. Core contains no Slack mapping, directory matching, UI, or new admission machinery. The shared package validates and negotiates; Rosetta owns mappings and immutable transport/snapshot reservations.

## Sync and removal cost

One additional patch touches the identity protocol, native acceptance, sender rendering, and person schema, with focused tests and an installed-package witness. It adds no tables or migrations. Upstream updates must replay these seams and rerun legacy hashes, mixed queues, receipts/history, and both rendering policies. Replace the extension and retire this patch when upstream offers external canonical-person attribution with equivalent durable receipts and queue/history preservation.

## Runtime boundary

V1 writes require a capable native reader permanently, including after queues drain. The previous person schema cannot parse integration-asserted person authors; never select it as rollback. Record the exact capable fork revision as the minimum runtime before activation. Package rollback alone does not restore old native readability. This source change does not select a normal-service restart; current runtime and activation must be verified separately.

## Verification

Run native p6r tests and server typecheck; the installed public-binding witness is gated by `P6R_IDENTITY_PACKAGE_ROOT` pointing at an ordinarily npm-installed package root. Explicitly forward it through Turbo (`--env-mode=loose`) or run the targeted investigation directly and check zero skipped witnesses. It covers immediate acceptance, lost-response lookup, fresh database/service reconstruction, mixed queues, external origin, person projection and producer/host rendering. Set `P6R_ROSETTA_SOURCE_ROOT` to the canonical Rosetta Slack plugin directory to run its actual durable reservation/send/recovery helper against that binding and native host. The fixture also locks the historical legacy payload hash. Full fork replay and workspace checks remain delivery gates.

## Follow-up review: reprovisioning acceptance

The reviewed acceptance guarantee also applies when an idle provider-backed thread needs environment reprovisioning. Existing public sends cannot recover structured authorship or atomically attach a receipt after that native request has already committed; a plugin retry may instead duplicate executable input. The bounded correction forwards the existing authors/editors and acceptance callback through dispatch/reprovisioning and invokes the callback inside the native request transaction. This repairs the already approved native acceptance path; it adds no new product capability, storage schema, provider policy or security mechanism. Upstream replay cost is three existing thread-dispatch seams, retired when upstream carries the same callback and metadata. A composed witness explicitly requires both package and Rosetta roots and reopens both stores after response loss, before final-outcome recovery, including the reprovisioning case.
