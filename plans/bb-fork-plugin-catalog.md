# Existing plugin connections to the BB fork

Source inventory, 2026-09-04. This describes the authored organization and
community plugin checkouts and the current fork patch series. It is not an
installed-plugin inventory or proof of the running release. The repositories
contain visible authored changes. Generated SDK declarations and ordinary
`experimental_` API names alone do not establish a fork connection.

The entries describe the fork surfaces a plugin uses or benefits from and their
user value. They do not judge whether a fork change was necessary. Scope for the
replacement remains governed by the [master plan](bb-fork-master-plan.md).
Prompt Stacks is explicitly out of scope; other entries are available for scope
decisions, not an automatic feature-port commitment.

Subsequent architecture decision: replacement consumers use the shared
`@phosphorco/bb-identity` package across UI, state, and server layers. The direct
connections below describe today's implementation; they are not proposed
per-plugin fork contracts. Core remains unaware of custom sidebar, progress,
and notification product models.

## Direct connections

### Identity Boundaries

**Fork connection:** Registers a Tailnet identity resolver through
`bb.p6rIdentity.registerProvider`. The fork attaches the resolved principal to
HTTP/RPC requests and records authors with accepted thread and queue content.
The plugin supplies the people directory and mention resolution. The mention
patch persists selected people and includes them in participant projections;
the plugin produces notifications from those durable events.

**Value:** A collaborator's name/avatar follows their contributions, agents can
distinguish speakers, and other plugins can select that person's preferences.
Mentioning a colleague can bring the thread into their participant views and
notify them without requiring them to have spoken first.

Evidence: [provider registration](../../plugins/plugins/identity-boundaries/server.ts),
[identity contract](../../plugins/plugins/identity-boundaries/README.md),
[mention notification producer](../../plugins/plugins/identity-boundaries/mention-notifications.ts),
[identity patch](../patches/0001-feat-multiplayer-port-identity-and-presence-onto-cur.patch),
[mention patch](../patches/0050-feat-mentions-add-participants-and-notify.patch).

### Thread Progress

**Fork connection:** Reads the current principal and native participant data;
stores identity-specific section/view configuration; publishes its phase through
the fork's Thread Facets API. It also consumes the added background-command
start time to distinguish a command already covered by a summary from new work.
Its notification producer feeds the identity-aware Notifications plugin.

**Value:** Personal sections and participation filters, a Needs Attention view
that distinguishes whose input is needed, recognizable participant avatars,
phase information available to other thread views, and quieter status
presentation after background work has been accounted for. Completion/failure
updates reach people following the thread. Ordering, summaries, stickers, and
most display controls are plugin-owned product logic.

Evidence: [server](../../plugins/plugins/thread-progress/server.ts),
[product behavior](../../plugins/plugins/thread-progress/README.md),
[background presentation](../../plugins/plugins/thread-progress/lib/background-command-presentation.ts),
[facets patch](../patches/0002-feat-facets-add-extensible-thread-facets-revision-1.patch),
[background timing patch](../patches/0032-feat-quiet-covered-background-commands.patch).

### Thread Manager

**Fork connection:** Uses thread-facet queries and participant pagination for
person-based filtering. Fork extensions project effective provider/model/
reasoning and recent attention into those bounded queries. Execution preflight
and apply APIs validate bulk model/reasoning changes against the actual
host/workspace catalogs and concurrent thread state.

**Value:** Find recent work or exclude a collaborator's threads; inspect model
and reasoning across a large selection; change execution settings in bulk for
subsequent turns without interrupting active work. These execution controls are
a substantial connection beyond identity. The table, previews, selection UI,
and ordinary bulk actions remain plugin logic.

Evidence: [implementation](../../plugins/plugins/thread-manager/server.ts),
[behavior and limits](../../plugins/plugins/thread-manager/README.md),
[execution patch](../patches/0038-feat-threads-add-bounded-execution-reassignment.patch).

### Notifications

**Fork connection:** Uses request-bound principal keys for inbox state,
subscriptions, and browser delivery. Its `notify_user` tool uses the durable
turn author supplied by the fork; recipient lookup uses Identity Boundaries.
The notification ledger, grouping, delivery leases, and routing live in the
plugin.

**Value:** Each person gets their own read/handled/snoozed state, follows chosen
threads, and receives addressed updates. Agent-originated notification requests
retain the initiating contribution's authorship rather than borrowing whichever
browser happens to be connected later.

Evidence: [server](../../plugins/plugins/notifications/server.ts),
[turn-author handling](../../plugins/plugins/notifications/notify-user.ts),
[product contract](../../plugins/plugins/notifications/README.md).

### ntfy Delivery

**Fork connection:** Resolves the request principal when linking a phone
endpoint, then registers that person's route with Notifications. Transport and
retry behavior are plugin-owned.

**Value:** Link a phone to the correct collaborator's notification stream and
receive push summaries with links back to BB. Other collaborators' phone routes
do not accidentally become the current person's destination.

Evidence: [endpoint implementation](../../plugins/plugins/ntfy/server.ts),
[delivery contract](../../plugins/plugins/ntfy/README.md).

### Agent Connect

**Fork connection:** Uses upstream `auth: "none"` HTTP routes with plugin-owned
connection-token validation. The shared identity binding supplies external
contributions with a connection-specific subject and nickname. Reads actor fields from thread events to display senders
and correlate connected calls with accepted work.

**Value:** A remote connected client can read and contribute to a BB thread,
including steering or queueing messages, under its own recognizable identity
rather than looking like the local operator.

Evidence: [server](../../plugins/plugins/agent-connect/server.ts),
[event correlation](../../plugins/plugins/agent-connect/call-events.ts),
[approved transport-mode decision](../../docs/adrs/2026-09-identities-and-multiplayer.md#prefer-upstream-plugin-transport-modes).

## Indirect connections and shared runtime benefits

### Agentation and community Agentation Mentions

**Connection:** Both optionally read Identity Boundaries' current profile and
look up captured annotation authors. They add author presentation to feedback
sent to agents. Feedback continues working without that identity service.

**Value:** An agent can tell whose UI feedback it is addressing when several
people annotate the same application. Capture, staging, annotation lifecycle,
and delivery remain plugin-owned.

Evidence: [Agentation identity adapter](../../plugins/plugins/agentation/lib/identity.ts),
[community adapter](../../community-plugins/plugins/agentation-mentions/lib/identity.ts).

### Rosetta Slack

**Connection:** The inspected implementation sends through ordinary
`bb.sdk.threads.send`, carrying Slack source context in its inputs. It does not
currently call Agent Connect's structured external-author API. It optionally
reads Thread Progress context, including participant names, for richer thread
presentation in Slack.

**Value:** Work can move between Slack and BB with Slack-author context intact
in the content; shared BB links can show progress and participant context.
Structured fork-native Slack authorship is a possible future integration, not
a current direct dependency established by this inventory.

Evidence: [dispatch implementation](../../plugins/plugins/rosetta-slack/server.ts),
[optional progress adapter](../../plugins/plugins/rosetta-slack/thread-progress-context.ts).

### Perspectives (organization and community versions)

**Connection:** Spawns hidden workers that reuse the caller's environment. The
fork permits these workers to follow a personal thread whose directory was
switched to an unmanaged checkout. This is a shared runtime correction rather
than a Perspectives-specific API.

**Value:** Expert consultations and panels can investigate the actual checkout
the caller is using, including after a directory switch.

Evidence: [organization orchestration](../../plugins/plugins/perspectives/Perspectives.ts),
[community orchestration](../../community-plugins/plugins/perspectives/Perspectives.ts),
[hidden-worker patch](../patches/0048-fix-threads-allow-hidden-plugin-workers-in-switched-personal-envs.patch).

### Subscription Router

**Connection:** Installs a Codex executable shim selected through the machine's
PATH. The fork resolves provider shell environments per workspace. That is a
shared runtime benefit relevant to finding the intended executable; the router
does not invoke a special identity API for subscription selection.

**Value:** BB can launch the configured router in the correct environment, so
its plugin-owned account selection and session continuity behavior takes effect.
This is an architectural connection, not evidence that the PATH patch was
written exclusively for this plugin.

Evidence: [router launch model](../../plugins/plugins/subscription-router/README.md),
[workspace shell patch](../patches/0030-fix-host-daemon-resolve-shell-PATH-per-workspace.patch).

## Scope and interpretation notes

- **Prompt Stacks:** Current custom host routes store catalogs/project overrides
  and support native queue integration. Cole explicitly excluded the entire
  feature from the replacement effort. It supplies no implementation gate.
- **Presence, per-person palettes, and Recovery:** Current native fork features,
  not separate plugin dependencies in this catalog. Espresso Theme supplies a
  theme; the native per-person palette feature selects individual overrides.
  Recovery has its own native patch family and needs its own scope decision.
- **Other plugins:** Ordinary SDK usage, named UI slots, and generated fork SDK
  files were not counted as direct fork connections. For example, Analytics
  currently reads through thread/event SDK calls. The Sticky Notes notification
  integration described in Notifications' README was not found in the current
  community Sticky Notes implementation, so it is not listed as an implemented
  dependency here.
