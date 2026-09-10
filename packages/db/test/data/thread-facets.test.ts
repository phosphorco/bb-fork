import { eq } from "drizzle-orm";
import {
  CORE_PARTICIPANTS_FACET_TYPE_ID,
  p6rPrincipalKeyForActorSnapshot,
  serializeThreadFacetTypeId,
  threadScope,
  type P6rActorSnapshot,
} from "@bb/domain";
import { describe, expect, it } from "vitest";
import { noopNotifier } from "../../src/notifier.js";
import { insertEvents } from "../../src/data/events.js";
import { upsertHost } from "../../src/data/hosts.js";
import { createProject } from "../../src/data/projects.js";
import {
  activatePluginThreadFacetDeclarations,
  type ActivatePluginThreadFacetDeclarationsArgs,
  declarePluginThreadFacet,
  ensureCoreParticipantsProjection,
  getThreadFacetDeclaration,
  listCoreParticipantProfilePage,
  listCoreParticipantProfilesByThreadIds,
  listPriorThreadFacetSnapshotTargets,
  listThreadIdsForFacetProjection,
  listThreadFacetOwnerProjections,
  markAllPluginThreadFacetOwnersUnavailable,
  markThreadFacetOwnerGenerationReady,
  markThreadFacetOwnerGenerationUnavailable,
  queryThreadFacetThreadIds,
  recordThreadFacetCensusExhausted,
  replaceThreadFacetRelationsInGeneration,
  ThreadFacetInvariantError,
  waiveThreadFacetReconciliationTargetIfIneligible,
} from "../../src/data/thread-facets.js";
import {
  createThread,
  markThreadDeleted,
  updateThread,
} from "../../src/data/threads.js";
import { threads } from "../../src/schema.js";
import { createMigratedConnection } from "../helpers/migrated-connection.js";

function setup() {
  const db = createMigratedConnection();
  const host = upsertHost(db, noopNotifier, {
    name: `facet-host-${crypto.randomUUID()}`,
    type: "persistent",
  });
  const { project } = createProject(db, noopNotifier, {
    name: "Facet project",
    source: {
      type: "local_path",
      hostId: host.id,
      path: `/tmp/facet-${crypto.randomUUID()}`,
    },
  });
  const createVisibleThread = () =>
    createThread(db, noopNotifier, {
      projectId: project.id,
      providerId: "codex",
    });
  return { db, project, createVisibleThread };
}

const progressTypeId = serializeThreadFacetTypeId({
  scope: "plugin",
  owner: "thread-progress",
  localName: "phase",
});

const progressDeclaration = {
  assignmentScope: "shared-thread" as const,
  cardinality: "one" as const,
  localName: "phase",
  memberKind: "enum" as const,
  members: ["requested", "fulfilled"] as const,
};

function finishEmptyCensus(
  db: ReturnType<typeof createMigratedConnection>,
  generation: number,
): void {
  expect(
    listPriorThreadFacetSnapshotTargets(db, {
      typeId: progressTypeId,
      generation,
      limit: 100,
    }),
  ).toEqual({ threadIds: [], nextAfterThreadId: null });
  recordThreadFacetCensusExhausted(db, { typeId: progressTypeId, generation });
}

describe("thread facet persistence and queries", () => {
  it("bounds both projection census and facet pages by latest attention", () => {
    const { db, createVisibleThread } = setup();
    try {
      const oldThread = createVisibleThread();
      const recentThread = createVisibleThread();
      db.update(threads)
        .set({ latestAttentionAt: 1_000, updatedAt: 1_000 })
        .where(eq(threads.id, oldThread.id))
        .run();
      db.update(threads)
        .set({ latestAttentionAt: 3_000, updatedAt: 3_000 })
        .where(eq(threads.id, recentThread.id))
        .run();

      const scope = {
        experimental_latestAttentionAtOrAfter: 2_000,
        includeHidden: false,
      } as const;
      expect(listThreadIdsForFacetProjection(db, scope)).toEqual([
        recentThread.id,
      ]);
      expect(
        queryThreadFacetThreadIds(db, {
          ...scope,
          filters: [],
          pageSize: 10,
        }).threadIds,
      ).toEqual([recentThread.id]);
    } finally {
      db.$client.close();
    }
  });

  it("evolves declarations only by identical-or-append and activates atomically", () => {
    const { db } = setup();
    try {
      expect(
        declarePluginThreadFacet(db, {
          ...progressDeclaration,
          ownerPluginId: "thread-progress",
          members: ["requested"],
        }).members,
      ).toEqual(["requested"]);
      expect(
        declarePluginThreadFacet(db, {
          ...progressDeclaration,
          ownerPluginId: "thread-progress",
        }).members,
      ).toEqual(["requested", "fulfilled"]);
      expect(() =>
        declarePluginThreadFacet(db, {
          ...progressDeclaration,
          ownerPluginId: "thread-progress",
          members: ["fulfilled", "requested"],
        }),
      ).toThrowError(
        expect.objectContaining<Partial<ThreadFacetInvariantError>>({
          code: "incompatible_declaration",
        }),
      );

      expect(
        activatePluginThreadFacetDeclarations(db, {
          ownerPluginId: "thread-progress",
          declarations: [progressDeclaration, progressDeclaration],
        }).quarantined,
      ).toEqual([{ localName: "phase", code: "incompatible_declaration" }]);
      expect(listThreadFacetOwnerProjections(db, [progressTypeId])).toEqual([
        {
          typeId: progressTypeId,
          generation: 0,
          ownerState: "unavailable",
          projectionRevision: 0,
        },
      ]);

      const firstDirectoryPage = Array.from(
        { length: 64 },
        (_, index) => `member-${index}`,
      );
      const secondDirectoryPage = Array.from(
        { length: 64 },
        (_, index) => `member-${index + 64}`,
      );
      const directoryDeclaration = {
        assignmentScope: "shared-thread" as const,
        cardinality: "many" as const,
        localName: "large-directory",
        memberKind: "enum" as const,
        ownerPluginId: "directory-test",
      };
      expect(
        declarePluginThreadFacet(db, {
          ...directoryDeclaration,
          members: firstDirectoryPage,
        }).members,
      ).toHaveLength(64);
      expect(
        declarePluginThreadFacet(db, {
          ...directoryDeclaration,
          members: [...firstDirectoryPage, ...secondDirectoryPage],
        }).members,
      ).toHaveLength(128);
      expect(() =>
        declarePluginThreadFacet(db, {
          ...directoryDeclaration,
          localName: "oversized-append",
          members: Array.from({ length: 65 }, (_, index) => `member-${index}`),
        }),
      ).toThrowError(
        expect.objectContaining<Partial<ThreadFacetInvariantError>>({
          code: "incompatible_declaration",
        }),
      );

      const partitioned = activatePluginThreadFacetDeclarations(db, {
        ownerPluginId: "partition-test",
        declarations: [
          {
            assignmentScope: "shared-thread",
            cardinality: "many",
            localName: "lawful",
            memberKind: "enum",
            members: ["member"],
          },
          {
            assignmentScope: "shared-thread",
            cardinality: "many",
            localName: "oversized",
            memberKind: "enum",
            members: Array.from(
              { length: 65 },
              (_, index) => `member-${index}`,
            ),
          },
          {
            assignmentScope: "shared-thread",
            cardinality: "many",
            localName: "malformed",
            memberKind: "enum",
            members: ["not valid"],
          },
        ],
      });
      expect(
        partitioned.activated.map(({ declaration }) => declaration.typeId),
      ).toEqual([
        serializeThreadFacetTypeId({
          scope: "plugin",
          owner: "partition-test",
          localName: "lawful",
        }),
      ]);
      expect(partitioned.quarantined).toEqual([
        { localName: "oversized", code: "incompatible_declaration" },
        { localName: "malformed", code: "invalid_member" },
      ]);
      for (const localName of ["oversized", "malformed"] as const) {
        expect(
          getThreadFacetDeclaration(
            db,
            serializeThreadFacetTypeId({
              scope: "plugin",
              owner: "partition-test",
              localName,
            }),
          ),
        ).toBeNull();
      }

      const lkgTypeId = serializeThreadFacetTypeId({
        scope: "plugin",
        owner: "lkg-test",
        localName: "marker",
      });
      const [{ generation: lkgGeneration }] =
        activatePluginThreadFacetDeclarations(db, {
          ownerPluginId: "lkg-test",
          declarations: [
            {
              assignmentScope: "shared-thread",
              cardinality: "many",
              localName: "marker",
              memberKind: "enum",
              members: ["kept"],
            },
          ],
        }).activated;
      expect(
        listPriorThreadFacetSnapshotTargets(db, {
          typeId: lkgTypeId,
          generation: lkgGeneration,
          limit: 100,
        }).nextAfterThreadId,
      ).toBeNull();
      recordThreadFacetCensusExhausted(db, {
        typeId: lkgTypeId,
        generation: lkgGeneration,
      });
      markThreadFacetOwnerGenerationReady(db, {
        typeId: lkgTypeId,
        generation: lkgGeneration,
      });
      const mixedReload = activatePluginThreadFacetDeclarations(db, {
        ownerPluginId: "lkg-test",
        declarations: [
          {
            assignmentScope: "shared-thread",
            cardinality: "one",
            localName: "marker",
            memberKind: "enum",
            members: ["kept"],
          },
          {
            assignmentScope: "shared-thread",
            cardinality: "many",
            localName: "lawful",
            memberKind: "enum",
            members: [],
          },
        ],
      });
      expect(mixedReload.activated).toHaveLength(1);
      expect(mixedReload.quarantined).toEqual([
        { localName: "marker", code: "incompatible_declaration" },
      ]);
      expect(getThreadFacetDeclaration(db, lkgTypeId)).toMatchObject({
        cardinality: "many",
        members: ["kept"],
      });
      expect(
        listThreadFacetOwnerProjections(db, [lkgTypeId])[0]?.ownerState,
      ).toBe("unavailable");
    } finally {
      db.$client.close();
    }
  });

  it("quarantines unsupported and malformed plugin declarations without partial rows", () => {
    const { db } = setup();
    try {
      const declarations = [
        {
          assignmentScope: "shared-thread",
          cardinality: "many",
          localName: "lawful",
          memberKind: "enum",
          members: ["marker"],
        },
        {
          assignmentScope: "shared-thread",
          cardinality: "many",
          localName: "principals",
          memberKind: "principal-key",
          members: [],
        },
        {
          assignmentScope: "private-principal",
          cardinality: "many",
          localName: "private-principal",
          memberKind: "principal-key",
          members: [],
        },
        {
          assignmentScope: "shared-thread",
          cardinality: "many",
          localName: 42,
          memberKind: "enum",
          members: [],
        },
        null,
        {
          assignmentScope: "shared-thread",
          cardinality: "many",
          localName: "null-members",
          memberKind: "enum",
          members: null,
        },
        {
          assignmentScope: "shared-thread",
          cardinality: "many",
          localName: "non-array-members",
          memberKind: "enum",
          members: { marker: true },
        },
      ] as unknown as ActivatePluginThreadFacetDeclarationsArgs["declarations"];
      const result = activatePluginThreadFacetDeclarations(db, {
        ownerPluginId: "boundary-test",
        declarations,
      });

      expect(
        result.activated.map(({ declaration }) => declaration.typeId),
      ).toEqual([
        serializeThreadFacetTypeId({
          scope: "plugin",
          owner: "boundary-test",
          localName: "lawful",
        }),
      ]);
      expect(result.quarantined).toEqual([
        { localName: "principals", code: "incompatible_declaration" },
        {
          localName: "private-principal",
          code: "incompatible_declaration",
        },
        { localName: "<invalid>", code: "incompatible_declaration" },
        { localName: "<invalid>", code: "incompatible_declaration" },
        { localName: "null-members", code: "invalid_member" },
        { localName: "non-array-members", code: "invalid_member" },
      ]);
      expect(
        db.$client
          .prepare<[], { count: number }>(
            `SELECT COUNT(*) AS count
             FROM thread_facet_declarations
             WHERE type_scope = 'plugin' AND type_owner = 'boundary-test'`,
          )
          .get(),
      ).toEqual({ count: 1 });
      expect(
        db.$client
          .prepare<[], { count: number }>(
            `SELECT COUNT(*) AS count
             FROM thread_facet_owners
             WHERE type_scope = 'plugin' AND type_owner = 'boundary-test'`,
          )
          .get(),
      ).toEqual({ count: 1 });
    } finally {
      db.$client.close();
    }
  });

  it("distinguishes complete-empty from unknown while positives survive owner state", () => {
    const { db, createVisibleThread } = setup();
    try {
      const requested = createVisibleThread();
      const completeEmpty = createVisibleThread();
      const unknown = createVisibleThread();
      const [{ generation: firstGeneration }] =
        activatePluginThreadFacetDeclarations(db, {
          ownerPluginId: "thread-progress",
          declarations: [progressDeclaration],
        }).activated;
      finishEmptyCensus(db, firstGeneration);
      replaceThreadFacetRelationsInGeneration(db, {
        typeId: progressTypeId,
        generation: firstGeneration,
        threadId: requested.id,
        members: ["requested"],
      });
      replaceThreadFacetRelationsInGeneration(db, {
        typeId: progressTypeId,
        generation: firstGeneration,
        threadId: completeEmpty.id,
        members: [],
      });
      markThreadFacetOwnerGenerationReady(db, {
        typeId: progressTypeId,
        generation: firstGeneration,
      });

      expect(
        queryThreadFacetThreadIds(db, {
          filters: [{ typeId: progressTypeId, operator: "absent" }],
          includeHidden: false,
          pageSize: 10,
        }).threadIds,
      ).toEqual([completeEmpty.id]);
      expect(
        queryThreadFacetThreadIds(db, {
          filters: [
            {
              typeId: progressTypeId,
              operator: "contains",
              member: "requested",
            },
          ],
          includeHidden: false,
          pageSize: 10,
        }).threadIds,
      ).toEqual([requested.id]);
      expect(unknown.id).not.toBe(completeEmpty.id);

      const [{ generation: secondGeneration }] =
        activatePluginThreadFacetDeclarations(db, {
          ownerPluginId: "thread-progress",
          declarations: [progressDeclaration],
        }).activated;
      expect(
        listThreadFacetOwnerProjections(db, [progressTypeId])[0],
      ).toMatchObject({
        generation: secondGeneration,
        ownerState: "reconciling",
      });
      markThreadFacetOwnerGenerationUnavailable(db, {
        typeId: progressTypeId,
        generation: firstGeneration,
      });
      expect(
        listThreadFacetOwnerProjections(db, [progressTypeId])[0],
      ).toMatchObject({
        generation: secondGeneration,
        ownerState: "reconciling",
      });
      expect(
        queryThreadFacetThreadIds(db, {
          filters: [
            {
              typeId: progressTypeId,
              operator: "contains",
              member: "requested",
            },
          ],
          includeHidden: false,
          pageSize: 10,
        }).threadIds,
      ).toEqual([requested.id]);
      expect(
        queryThreadFacetThreadIds(db, {
          filters: [{ typeId: progressTypeId, operator: "absent" }],
          includeHidden: false,
          pageSize: 10,
        }).threadIds,
      ).toEqual([]);

      markAllPluginThreadFacetOwnersUnavailable(db);
      expect(
        listThreadFacetOwnerProjections(db, [progressTypeId])[0]?.ownerState,
      ).toBe("unavailable");
      expect(
        queryThreadFacetThreadIds(db, {
          filters: [{ typeId: progressTypeId, operator: "present" }],
          includeHidden: false,
          pageSize: 10,
        }).threadIds,
      ).toEqual([requested.id]);
      expect(
        queryThreadFacetThreadIds(db, {
          filters: [{ typeId: progressTypeId, operator: "absent" }],
          includeHidden: false,
          pageSize: 10,
        }).threadIds,
      ).toEqual([]);

      const [{ generation: recoveredGeneration }] =
        activatePluginThreadFacetDeclarations(db, {
          ownerPluginId: "thread-progress",
          declarations: [progressDeclaration],
        }).activated;
      const census = listPriorThreadFacetSnapshotTargets(db, {
        typeId: progressTypeId,
        generation: recoveredGeneration,
        limit: 100,
      });
      expect(new Set(census.threadIds)).toEqual(
        new Set([requested.id, completeEmpty.id]),
      );
      for (const threadId of census.threadIds) {
        replaceThreadFacetRelationsInGeneration(db, {
          typeId: progressTypeId,
          generation: recoveredGeneration,
          threadId,
          members: threadId === requested.id ? ["requested"] : [],
        });
      }
      recordThreadFacetCensusExhausted(db, {
        typeId: progressTypeId,
        generation: recoveredGeneration,
      });
      markThreadFacetOwnerGenerationReady(db, {
        typeId: progressTypeId,
        generation: recoveredGeneration,
      });
      expect(
        queryThreadFacetThreadIds(db, {
          filters: [{ typeId: progressTypeId, operator: "absent" }],
          includeHidden: false,
          pageSize: 10,
        }).threadIds,
      ).toEqual([completeEmpty.id]);
    } finally {
      db.$client.close();
    }
  });

  it("normalizes malformed enum and principal replacements to invalid_member", () => {
    const { db, createVisibleThread } = setup();
    try {
      const thread = createVisibleThread();
      const [{ generation: enumGeneration }] =
        activatePluginThreadFacetDeclarations(db, {
          ownerPluginId: "thread-progress",
          declarations: [progressDeclaration],
        }).activated;
      expect(() =>
        replaceThreadFacetRelationsInGeneration(db, {
          typeId: progressTypeId,
          generation: enumGeneration,
          threadId: thread.id,
          members: ["not valid"],
        }),
      ).toThrowError(
        expect.objectContaining<Partial<ThreadFacetInvariantError>>({
          code: "invalid_member",
        }),
      );

      ensureCoreParticipantsProjection(db, [thread.id]);
      expect(() =>
        replaceThreadFacetRelationsInGeneration(db, {
          typeId: CORE_PARTICIPANTS_FACET_TYPE_ID,
          generation: 1,
          threadId: thread.id,
          members: ["not a principal"],
        }),
      ).toThrowError(
        expect.objectContaining<Partial<ThreadFacetInvariantError>>({
          code: "invalid_member",
        }),
      );
    } finally {
      db.$client.close();
    }
  });

  it("pages an immutable prior-target census and cannot ready early or wedge on hidden targets", () => {
    const { db, createVisibleThread } = setup();
    try {
      const first = createVisibleThread();
      const second = createVisibleThread();
      const [{ generation: firstGeneration }] =
        activatePluginThreadFacetDeclarations(db, {
          ownerPluginId: "thread-progress",
          declarations: [progressDeclaration],
        }).activated;
      finishEmptyCensus(db, firstGeneration);
      for (const thread of [first, second]) {
        replaceThreadFacetRelationsInGeneration(db, {
          typeId: progressTypeId,
          generation: firstGeneration,
          threadId: thread.id,
          members: [],
        });
      }
      markThreadFacetOwnerGenerationReady(db, {
        typeId: progressTypeId,
        generation: firstGeneration,
      });

      const [{ generation }] = activatePluginThreadFacetDeclarations(db, {
        ownerPluginId: "thread-progress",
        declarations: [progressDeclaration],
      }).activated;
      expect(() =>
        markThreadFacetOwnerGenerationReady(db, {
          typeId: progressTypeId,
          generation,
        }),
      ).toThrowError(
        expect.objectContaining<Partial<ThreadFacetInvariantError>>({
          code: "census_not_exhausted",
        }),
      );
      const firstPage = listPriorThreadFacetSnapshotTargets(db, {
        typeId: progressTypeId,
        generation,
        limit: 1,
      });
      expect(firstPage.threadIds).toHaveLength(1);
      replaceThreadFacetRelationsInGeneration(db, {
        typeId: progressTypeId,
        generation,
        threadId: firstPage.threadIds[0] ?? "",
        members: ["fulfilled"],
      });
      const finalPage = listPriorThreadFacetSnapshotTargets(db, {
        typeId: progressTypeId,
        generation,
        limit: 1,
        afterThreadId: firstPage.nextAfterThreadId ?? undefined,
      });
      expect(finalPage.threadIds).toHaveLength(1);
      expect(finalPage.nextAfterThreadId).toBeNull();
      recordThreadFacetCensusExhausted(db, {
        typeId: progressTypeId,
        generation,
      });
      updateThread(db, noopNotifier, finalPage.threadIds[0] ?? "", {
        visibility: "hidden",
      });
      expect(() =>
        replaceThreadFacetRelationsInGeneration(db, {
          typeId: progressTypeId,
          generation,
          threadId: finalPage.threadIds[0] ?? "",
          members: [],
        }),
      ).toThrowError(
        expect.objectContaining<Partial<ThreadFacetInvariantError>>({
          code: "thread_unavailable",
        }),
      );
      updateThread(db, noopNotifier, finalPage.threadIds[0] ?? "", {
        visibility: "visible",
      });
      expect(() =>
        replaceThreadFacetRelationsInGeneration(db, {
          typeId: progressTypeId,
          generation: firstGeneration,
          threadId: first.id,
          members: [],
        }),
      ).toThrowError(
        expect.objectContaining<Partial<ThreadFacetInvariantError>>({
          code: "stale_generation",
        }),
      );
      expect(() =>
        markThreadFacetOwnerGenerationReady(db, {
          typeId: progressTypeId,
          generation,
        }),
      ).not.toThrow();
      expect(
        queryThreadFacetThreadIds(db, {
          filters: [{ typeId: progressTypeId, operator: "absent" }],
          includeHidden: false,
          pageSize: 10,
        }).threadIds,
      ).not.toContain(finalPage.threadIds[0]);
    } finally {
      db.$client.close();
    }
  });

  it("advances immutable census pages across waived targets without restoring completeness", () => {
    const { db, createVisibleThread } = setup();
    try {
      const targets = [
        createVisibleThread(),
        createVisibleThread(),
        createVisibleThread(),
      ].sort((left, right) => left.id.localeCompare(right.id));
      const [{ generation: firstGeneration }] =
        activatePluginThreadFacetDeclarations(db, {
          ownerPluginId: "thread-progress",
          declarations: [progressDeclaration],
        }).activated;
      finishEmptyCensus(db, firstGeneration);
      for (const target of targets) {
        replaceThreadFacetRelationsInGeneration(db, {
          typeId: progressTypeId,
          generation: firstGeneration,
          threadId: target.id,
          members: [],
        });
      }
      markThreadFacetOwnerGenerationReady(db, {
        typeId: progressTypeId,
        generation: firstGeneration,
      });

      const [{ generation }] = activatePluginThreadFacetDeclarations(db, {
        ownerPluginId: "thread-progress",
        declarations: [progressDeclaration],
      }).activated;
      updateThread(db, noopNotifier, targets[0]?.id ?? "", {
        visibility: "hidden",
      });
      markThreadDeleted(db, noopNotifier, {
        threadId: targets[1]?.id ?? "",
      });

      const waivedPage = listPriorThreadFacetSnapshotTargets(db, {
        typeId: progressTypeId,
        generation,
        limit: 2,
      });
      expect(waivedPage).toEqual({
        threadIds: [],
        nextAfterThreadId: targets[1]?.id,
      });

      updateThread(db, noopNotifier, targets[0]?.id ?? "", {
        visibility: "visible",
      });
      expect(
        listPriorThreadFacetSnapshotTargets(db, {
          typeId: progressTypeId,
          generation,
          limit: 2,
        }),
      ).toEqual(waivedPage);

      const terminalPage = listPriorThreadFacetSnapshotTargets(db, {
        typeId: progressTypeId,
        generation,
        limit: 2,
        afterThreadId: waivedPage.nextAfterThreadId ?? undefined,
      });
      expect(terminalPage).toEqual({
        threadIds: [targets[2]?.id],
        nextAfterThreadId: null,
      });
      replaceThreadFacetRelationsInGeneration(db, {
        typeId: progressTypeId,
        generation,
        threadId: targets[2]?.id ?? "",
        members: [],
      });
      recordThreadFacetCensusExhausted(db, {
        typeId: progressTypeId,
        generation,
      });
      expect(() =>
        markThreadFacetOwnerGenerationReady(db, {
          typeId: progressTypeId,
          generation,
        }),
      ).not.toThrow();
      expect(
        queryThreadFacetThreadIds(db, {
          filters: [{ typeId: progressTypeId, operator: "absent" }],
          includeHidden: false,
          pageSize: 10,
        }).threadIds,
      ).toEqual([targets[2]?.id]);
    } finally {
      db.$client.close();
    }
  });

  it("atomically waives a captured target only while it is ineligible", () => {
    const { db, createVisibleThread } = setup();
    try {
      const target = createVisibleThread();
      const uncaptured = createVisibleThread();
      const [{ generation: firstGeneration }] =
        activatePluginThreadFacetDeclarations(db, {
          ownerPluginId: "thread-progress",
          declarations: [progressDeclaration],
        }).activated;
      finishEmptyCensus(db, firstGeneration);
      replaceThreadFacetRelationsInGeneration(db, {
        typeId: progressTypeId,
        generation: firstGeneration,
        threadId: target.id,
        members: [],
      });
      markThreadFacetOwnerGenerationReady(db, {
        typeId: progressTypeId,
        generation: firstGeneration,
      });

      const [{ generation }] = activatePluginThreadFacetDeclarations(db, {
        ownerPluginId: "thread-progress",
        declarations: [progressDeclaration],
      }).activated;
      expect(
        listPriorThreadFacetSnapshotTargets(db, {
          typeId: progressTypeId,
          generation,
          limit: 1,
        }),
      ).toEqual({ threadIds: [target.id], nextAfterThreadId: null });
      expect(
        waiveThreadFacetReconciliationTargetIfIneligible(db, {
          typeId: progressTypeId,
          generation,
          threadId: target.id,
        }),
      ).toBe(false);

      updateThread(db, noopNotifier, target.id, { visibility: "hidden" });
      updateThread(db, noopNotifier, uncaptured.id, { visibility: "hidden" });
      expect(
        waiveThreadFacetReconciliationTargetIfIneligible(db, {
          typeId: progressTypeId,
          generation,
          threadId: uncaptured.id,
        }),
      ).toBe(false);
      expect(
        waiveThreadFacetReconciliationTargetIfIneligible(db, {
          typeId: progressTypeId,
          generation,
          threadId: target.id,
        }),
      ).toBe(true);

      updateThread(db, noopNotifier, target.id, { visibility: "visible" });
      recordThreadFacetCensusExhausted(db, {
        typeId: progressTypeId,
        generation,
      });
      expect(() =>
        markThreadFacetOwnerGenerationReady(db, {
          typeId: progressTypeId,
          generation,
        }),
      ).not.toThrow();
      expect(
        queryThreadFacetThreadIds(db, {
          filters: [{ typeId: progressTypeId, operator: "absent" }],
          includeHidden: false,
          pageSize: 10,
        }).threadIds,
      ).not.toContain(target.id);
    } finally {
      db.$client.close();
    }
  });

  it("orders a single enum by directory rank with explicit absent and unknown states", () => {
    const { db, createVisibleThread } = setup();
    try {
      const requested = createVisibleThread();
      const fulfilled = createVisibleThread();
      const absent = createVisibleThread();
      const unknown = createVisibleThread();
      const [{ generation }] = activatePluginThreadFacetDeclarations(db, {
        ownerPluginId: "thread-progress",
        declarations: [progressDeclaration],
      }).activated;
      finishEmptyCensus(db, generation);
      for (const [threadId, members] of [
        [requested.id, ["requested"]],
        [fulfilled.id, ["fulfilled"]],
        [absent.id, []],
      ] as const) {
        replaceThreadFacetRelationsInGeneration(db, {
          typeId: progressTypeId,
          generation,
          threadId,
          members,
        });
      }
      markThreadFacetOwnerGenerationReady(db, {
        typeId: progressTypeId,
        generation,
      });
      const page = queryThreadFacetThreadIds(db, {
        filters: [],
        includeHidden: false,
        pageSize: 2,
        order: {
          typeId: progressTypeId,
          direction: "asc",
          absent: "last",
          unknown: "last",
        },
      });
      expect(page.threadIds).toEqual([requested.id, fulfilled.id]);
      expect(page.hasMore).toBe(true);
      const after = page.positions.at(-1);
      if (after === undefined) {
        throw new Error("Expected a facet query continuation position");
      }
      const continuation = queryThreadFacetThreadIds(db, {
        filters: [],
        includeHidden: false,
        pageSize: 2,
        order: {
          typeId: progressTypeId,
          direction: "asc",
          absent: "last",
          unknown: "last",
        },
        after,
      });
      expect(continuation.threadIds).toEqual([absent.id, unknown.id]);
    } finally {
      db.$client.close();
    }
  });
});

describe("core participants facet", () => {
  it("preserves first occurrence, latest presentation, exact identity, and bounded continuation", () => {
    const { db, createVisibleThread } = setup();
    try {
      const thread = createVisibleThread();
      const actor = (
        subject: string,
        displayName: string,
        imageUrl: string | null = null,
      ): P6rActorSnapshot => ({
        p6rProviderId: "test-provider",
        p6rSubject: subject,
        p6rHandle: `handle-${subject}`,
        p6rDisplayName: displayName,
        p6rImageUrl: imageUrl,
      });
      const oldA = actor("a", "A old", "same.png");
      const b = actor("b", "Same", null);
      const newA = { ...oldA, p6rHandle: "renamed-a", p6rDisplayName: "A new" };
      const c = actor("c", "Same", null);
      const d = actor("d", "Same", null);
      const participants = [oldA, b, newA, c, d];
      for (let index = 0; index < 66; index += 1) {
        participants.push(actor(`extra-${index}`, `Extra ${index}`));
      }
      insertEvents(
        db,
        noopNotifier,
        participants.map((entry, index) => ({
          threadId: thread.id,
          scope: threadScope(),
          sequence: index + 1,
          type: "client/turn/requested" as const,
          itemId: null,
          itemKind: null,
          parentToolCallId: null,
          p6rActorProviderId: entry.p6rProviderId,
          p6rActorSubject: entry.p6rSubject,
          p6rActorHandle: entry.p6rHandle,
          p6rActorDisplayName: entry.p6rDisplayName,
          p6rActorImageUrl: entry.p6rImageUrl,
          data: "{}",
        })),
      );
      insertEvents(db, noopNotifier, [
        {
          threadId: thread.id,
          scope: threadScope(),
          sequence: participants.length + 1,
          type: "client/turn/start",
          itemId: null,
          itemKind: null,
          parentToolCallId: null,
          p6rActorProviderId: "test-provider",
          p6rActorSubject: null,
          p6rActorHandle: "incomplete",
          p6rActorDisplayName: "Incomplete",
          p6rActorImageUrl: null,
          data: "{}",
        },
        {
          threadId: thread.id,
          scope: threadScope(),
          sequence: participants.length + 2,
          type: "client/turn/requested",
          itemId: null,
          itemKind: null,
          parentToolCallId: null,
          p6rActorProviderId: "test-provider",
          p6rActorSubject: "handle-only",
          p6rActorHandle: "Legacy handle",
          p6rActorDisplayName: null,
          p6rActorImageUrl: null,
          data: "{}",
        },
        {
          threadId: thread.id,
          scope: threadScope(),
          sequence: participants.length + 3,
          type: "client/turn/requested",
          itemId: null,
          itemKind: null,
          parentToolCallId: null,
          p6rActorProviderId: "test-provider",
          p6rActorSubject: "display-only",
          p6rActorHandle: null,
          p6rActorDisplayName: "Legacy display",
          p6rActorImageUrl: null,
          data: "{}",
        },
      ]);

      ensureCoreParticipantsProjection(db, [thread.id]);
      const all = listCoreParticipantProfilesByThreadIds(db, [thread.id]).get(
        thread.id,
      );
      expect(all).toHaveLength(72);
      expect(all?.slice(0, 4)).toEqual([
        {
          p6rPrincipalKey: p6rPrincipalKeyForActorSnapshot(oldA),
          p6rDisplayName: "A new",
          p6rImageUrl: "same.png",
        },
        {
          p6rPrincipalKey: p6rPrincipalKeyForActorSnapshot(b),
          p6rDisplayName: "Same",
          p6rImageUrl: null,
        },
        {
          p6rPrincipalKey: p6rPrincipalKeyForActorSnapshot(c),
          p6rDisplayName: "Same",
          p6rImageUrl: null,
        },
        {
          p6rPrincipalKey: p6rPrincipalKeyForActorSnapshot(d),
          p6rDisplayName: "Same",
          p6rImageUrl: null,
        },
      ]);
      expect(
        new Set(all?.map(({ p6rPrincipalKey }) => p6rPrincipalKey)).size,
      ).toBe(72);
      expect(all?.slice(-2)).toEqual([
        {
          p6rPrincipalKey: p6rPrincipalKeyForActorSnapshot({
            p6rProviderId: "test-provider",
            p6rSubject: "handle-only",
          }),
          p6rDisplayName: "Legacy handle",
          p6rImageUrl: null,
        },
        {
          p6rPrincipalKey: p6rPrincipalKeyForActorSnapshot({
            p6rProviderId: "test-provider",
            p6rSubject: "display-only",
          }),
          p6rDisplayName: "Legacy display",
          p6rImageUrl: null,
        },
      ]);

      const firstPage = listCoreParticipantProfilePage(db, {
        threadId: thread.id,
        pageSize: 64,
      });
      expect(firstPage.profiles).toHaveLength(64);
      expect(firstPage.nextPosition).toBe(63);
      const finalPage = listCoreParticipantProfilePage(db, {
        threadId: thread.id,
        pageSize: 64,
        afterPosition: firstPage.nextPosition ?? undefined,
      });
      expect(finalPage.profiles).toHaveLength(8);
      expect(finalPage.nextPosition).toBeNull();

      db.update(threads)
        .set({ visibility: "hidden" })
        .where(eq(threads.id, thread.id))
        .run();
      ensureCoreParticipantsProjection(db, [thread.id]);
      expect(
        listCoreParticipantProfilesByThreadIds(db, [thread.id]).get(thread.id),
      ).toHaveLength(72);
    } finally {
      db.$client.close();
    }
  });

  it("refreshes only when participant-bearing history advances", () => {
    const { db, createVisibleThread } = setup();
    try {
      const thread = createVisibleThread();
      const participantEvent = (sequence: number, displayName: string) => ({
        threadId: thread.id,
        scope: threadScope(),
        sequence,
        type: "client/turn/requested" as const,
        itemId: null,
        itemKind: null,
        parentToolCallId: null,
        p6rActorProviderId: "test-provider",
        p6rActorSubject: "participant",
        p6rActorHandle: "participant",
        p6rActorDisplayName: displayName,
        p6rActorImageUrl: null,
        data: "{}",
      });
      insertEvents(db, noopNotifier, [participantEvent(1, "Before")]);
      ensureCoreParticipantsProjection(db, [thread.id]);
      expect(
        listCoreParticipantProfilesByThreadIds(db, [thread.id]).get(thread.id),
      ).toEqual([
        expect.objectContaining({ p6rDisplayName: "Before" }),
      ]);

      insertEvents(db, noopNotifier, [
        {
          threadId: thread.id,
          scope: threadScope(),
          sequence: 2,
          type: "system/error",
          itemId: null,
          itemKind: null,
          parentToolCallId: null,
          data: "{}",
        },
      ]);
      ensureCoreParticipantsProjection(db, [thread.id]);
      expect(
        listCoreParticipantProfilesByThreadIds(db, [thread.id]).get(thread.id),
      ).toEqual([
        expect.objectContaining({ p6rDisplayName: "Before" }),
      ]);

      insertEvents(db, noopNotifier, [participantEvent(3, "After")]);
      ensureCoreParticipantsProjection(db, [thread.id]);
      expect(
        listCoreParticipantProfilesByThreadIds(db, [thread.id]).get(thread.id),
      ).toEqual([
        expect.objectContaining({ p6rDisplayName: "After" }),
      ]);
    } finally {
      db.$client.close();
    }
  });
});
