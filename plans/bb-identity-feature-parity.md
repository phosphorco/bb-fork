# Feature preservation for identity adoption

Current implementation scope and checked results are recorded in the
[identity completion ledger](bb-identity-completion.md). This document preserves
planning requirements and historical inventory; it does not broaden the selected
closeout or claim current runtime acceptance.

Working inventory, 2026-09-06. This supplements the
[existing plugin catalog](bb-fork-plugin-catalog.md); a listed witness is required
work, not evidence that it already passed. Each implementation owner must refine
its rows against actual current source before removing an old path. Preserve
authored changes independently of whether they have been committed.

| Consumer | Existing behavior to preserve | Replacement and evidence required |
| --- | --- | --- |
| Thread Sections | Personal sections; add/edit/reorder/filter; view-as read-only; current-owner writes; browser legacy; conflict and recovery; singleton behavior | Public binding + SQLite/IDB already adopted. Finish valid legacy preview, malformed recovery, connected directory, real actor A/B/A and completed recovery controls. Preserve exact source bytes and original operations. |
| Remaining Thread Progress | Comments; named participants and filters; sidebar view state; grouping/order; facets; summaries/stickers; notification producer | Inventory identity-dependent RPCs separately from ordinary product logic. Migrate current identity/directory/participant paths to normalized package access without losing menus, background behavior or unrelated data. Test product behavior without live worker side effects. |
| Agent Connect | Capability credentials; cast/call/deprecated send; AUTO/STEER/QUEUE; reading/streaming; rotate/revoke; identical-text concurrent calls | Add immutable durable reservation and additive caller idempotency IDs. Preserve legacy callers. Separate accepted operation from observer completion; use operation-to-turn evidence and current native event APIs. Prove all modes and uncertainty semantics. |
| Notifications | Inbox/read/handled/snooze; follow routes; grouping; delivery leases/retry; notify_user durable initiating author; directory addressing | Binding-issued person requests and normalized directory/provenance. Keep notification policy/ledger in feature. No ambient browser actor substitution for tool provenance; no live delivery during tests. |
| ntfy | Link correct actor's phone destination; begin/complete; lost response; credentials; unlink/delivery | Request-bound nested calls and feature-owned one-use registration/receipt. Preserve old route data and avoid duplicate linking. Network transport remains a mock/loopback in acceptance. |
| Identity Boundaries | Configured Tailnet evidence verification; directory/lookup; mentions and mention notifications; activation/refresh/expiry | Public provider registration and canonical issuer/subject normalization. Preserve actual evidence and directory semantics. Do not silently replace configured outage with singleton. |
| Rosetta Slack | Read/send/reply/thread mapping; source context; capability/auth checks; delivery recovery; optional progress context | External-author package acceptance using immutable Slack author/input facts. Retain existing message formats and response/receipt behavior; no real Slack sends for implementation tests. |
| Agentation + community mentions | Capture/stage/send feedback; optional captured author names/avatars; operation without provider | Public normalized identity/profile path where supported, explicit historical capture and unavailable fallback. Do not make feedback depend on a provider plugin name. |
| Thread Manager and other consumers | Existing facet/person filters, participant pagination and ordinary thread controls | Preserve native facet/execution APIs and their own participant key domain; duplicate identity reads are not needed. Normal materialization has these APIs; selected proof core currently lacks them, so target-host facet/execution parity remains open. Bulk execution is an independent host-capability disposition, not a reason to add it to identity. |
| Native contribution/session paths | Author/editor through send/queue/grouping/retry/restart/provider input/tool context, native content and sessions | Existing core proof plus full native round-trip witnesses. Preserve baseline grouped-edit restrictions. No new host seam without a supported-API counterexample. |
| Shared identity presentation/presence | Existing attribution, avatars, mentions and coordination behavior | Inventory native supported surfaces and old feature parity. Shared presentation remains package/native responsibility; product conflict/retry stays feature-owned. Avoid per-plugin duplicated pickers or a global identity singleton. |

Prompt Stacks remains excluded by Cole's governing scope clarification. This
inventory does not delete or change it. Unrelated plugins without identity
behavior use ordinary supported BB APIs; they do not need an artificial identity
dependency merely to satisfy an “all plugins” label.

## Acceptance record per owner

Record source paths, prior API/data contract, replacement, feature tests,
connected/packed/browser/host evidence, remaining limitations and friction.
Unknown support is not a passed portability test. Existing working features
must not be removed just to make a declaration honest; implement a supported
path or bring the exact unresolved product/platform decision to root.

A bounded authored-source SDK scan confirms that the direct `bb.sdk.threads`
method names used by organization plugins otherwise exist on the candidate's
ThreadsArea. The missing direct methods are the facet query/participant methods
and execution preflight/apply assigned to the native lanes. This is a method
inventory, not behavioral compatibility evidence for every argument or nested API.
