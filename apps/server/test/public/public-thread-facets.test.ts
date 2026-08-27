import {
  activatePluginThreadFacetDeclarations,
  archiveThread,
  createThreadSection,
  insertEvents,
  markThreadDeleted,
  markThreadFacetOwnerUnavailable,
  replaceThreadFacetRelationsInGeneration,
  setThreadExecutionOverride,
  upsertProjectExecutionDefaults,
  updateThread,
} from "@bb/db";
import {
  CORE_PARTICIPANTS_FACET_TYPE_ID,
  p6rPrincipalKeyForActorSnapshot,
  serializeThreadFacetTypeId,
  threadScope,
  type P6rActorSnapshot,
} from "@bb/domain";
import {
  apiErrorSchema,
  threadFacetParticipantsResponseSchema,
  threadFacetQueryResponseSchema,
  type ThreadFacetQueryRequest,
} from "@bb/server-contract";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server.js";
import { p6rCreateLocalOperatorIdentity } from "../../src/services/actors.js";
import { executeThreadFacetQuery } from "../../src/services/threads/thread-facet-query.js";
import { readJson } from "../helpers/json.js";
import {
  seedHostSession,
  seedProjectWithSource,
  seedThread,
} from "../helpers/seed.js";
import { withTestHarness, type TestAppHarness } from "../helpers/test-app.js";

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

function localActor(): P6rActorSnapshot {
  const identity = p6rCreateLocalOperatorIdentity();
  return {
    p6rProviderId: "p6r-local-operator",
    p6rSubject: identity.p6rHandle,
    p6rHandle: identity.p6rHandle,
    p6rDisplayName: identity.p6rDisplayName,
    p6rImageUrl: identity.p6rImageUrl,
  };
}

function addParticipantEvent(
  harness: TestAppHarness,
  args: { actor: P6rActorSnapshot; sequence: number; threadId: string },
): void {
  insertEvents(harness.db, harness.hub, [
    {
      threadId: args.threadId,
      scope: threadScope(),
      sequence: args.sequence,
      type: "client/turn/requested",
      itemId: null,
      itemKind: null,
      parentToolCallId: null,
      p6rActorProviderId: args.actor.p6rProviderId,
      p6rActorSubject: args.actor.p6rSubject,
      p6rActorHandle: args.actor.p6rHandle,
      p6rActorDisplayName: args.actor.p6rDisplayName,
      p6rActorImageUrl: args.actor.p6rImageUrl,
      data: "{}",
    },
  ]);
}

async function postFacetQuery(
  app: {
    request(input: string, init?: RequestInit): Promise<Response> | Response;
  },
  request: ThreadFacetQueryRequest,
  url = "/api/v1/threads/facet-query",
): Promise<Response> {
  return await app.request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
}

describe("public thread facet queries", () => {
  it("projects next-turn execution state in one opt-in facet page", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/public-thread-facet-execution",
      });
      const inherited = seedThread(harness.deps, { projectId: project.id });
      const overridden = seedThread(harness.deps, { projectId: project.id });
      upsertProjectExecutionDefaults(harness.db, {
        projectId: project.id,
        providerId: inherited.providerId,
        model: "project-model",
        reasoningLevel: "medium",
        permissionMode: "full",
        serviceTier: "default",
      });
      setThreadExecutionOverride(harness.db, {
        threadId: overridden.id,
        modelOverride: "override-model",
        reasoningLevelOverride: "high",
      });

      const response = await postFacetQuery(harness.app, {
        scope: { projectId: project.id },
        filters: [],
        pageSize: 10,
        experimental_includeExecution: true,
      });
      expect(response.status, await response.clone().text()).toBe(200);
      const entries = threadFacetQueryResponseSchema.parse(
        await readJson(response),
      ).threads;
      expect(
        entries.find(({ id }) => id === inherited.id)?.experimental_execution,
      ).toMatchObject({
        state: "resolved",
        effectiveModel: "project-model",
        effectiveReasoningLevel: "medium",
        modelSource: "project-default",
        reasoningSource: "project-default",
        latestRequestSequence: null,
      });
      expect(
        entries.find(({ id }) => id === overridden.id)?.experimental_execution,
      ).toMatchObject({
        state: "resolved",
        effectiveModel: "override-model",
        effectiveReasoningLevel: "high",
        modelSource: "thread-override",
        reasoningSource: "thread-override",
      });

      const withoutProjection = await postFacetQuery(harness.app, {
        scope: { projectId: project.id },
        filters: [],
        pageSize: 10,
      });
      expect(
        threadFacetQueryResponseSchema
          .parse(await readJson(withoutProjection))
          .threads.every(
            (thread) => thread.experimental_execution === undefined,
          ),
      ).toBe(true);
    });
  });

  it("seals stable restart cursors and binds principal, perspective, projection, and canonical filters", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/public-thread-facet-cursors",
      });
      const first = seedThread(harness.deps, { projectId: project.id });
      const second = seedThread(harness.deps, { projectId: project.id });
      const actor = localActor();
      for (const thread of [first, second]) {
        addParticipantEvent(harness, {
          actor,
          sequence: 1,
          threadId: thread.id,
        });
      }
      const principalKey = p6rPrincipalKeyForActorSnapshot(actor);
      const filters: ThreadFacetQueryRequest["filters"] = [
        { typeId: CORE_PARTICIPANTS_FACET_TYPE_ID, operator: "present" },
        {
          typeId: CORE_PARTICIPANTS_FACET_TYPE_ID,
          operator: "contains",
          member: principalKey,
        },
      ];
      const request: ThreadFacetQueryRequest = {
        scope: { projectId: project.id },
        filters,
        pageSize: 1,
      };
      const firstResponse = await postFacetQuery(harness.app, request);
      expect(firstResponse.status).toBe(200);
      const firstPage = threadFacetQueryResponseSchema.parse(
        await readJson(firstResponse),
      );
      expect(firstPage.threads).toHaveLength(1);
      expect(firstPage.nextCursor).toEqual(expect.any(String));

      const restartedApp = createApp(harness.deps).app;
      const continuedResponse = await postFacetQuery(restartedApp, {
        ...request,
        filters: [...filters].reverse(),
        cursor: firstPage.nextCursor ?? undefined,
      });
      expect(continuedResponse.status).toBe(200);
      const continued = threadFacetQueryResponseSchema.parse(
        await readJson(continuedResponse),
      );
      expect(continued.threads).toHaveLength(1);
      expect(continued.threads[0]?.id).not.toBe(firstPage.threads[0]?.id);

      const cursor = firstPage.nextCursor ?? "";
      const tampered = `${cursor.startsWith("A") ? "B" : "A"}${cursor.slice(1)}`;
      const tamperedResponse = await postFacetQuery(harness.app, {
        ...request,
        cursor: tampered,
      });
      expect(tamperedResponse.status).toBe(400);
      expect(
        apiErrorSchema.parse(await readJson(tamperedResponse)),
      ).toMatchObject({ code: "invalid_cursor" });

      const otherActor: P6rActorSnapshot = {
        p6rProviderId: "fixture",
        p6rSubject: "other",
        p6rHandle: "other",
        p6rDisplayName: "Other",
        p6rImageUrl: null,
      };
      expect(() =>
        executeThreadFacetQuery(harness.deps, {
          actor: otherActor,
          request: { ...request, cursor: firstPage.nextCursor ?? undefined },
        }),
      ).toThrowError(
        expect.objectContaining({
          body: expect.objectContaining({ code: "invalid_cursor" }),
        }),
      );
      const perspectiveMismatch = await postFacetQuery(harness.app, {
        ...request,
        filters: [
          { typeId: CORE_PARTICIPANTS_FACET_TYPE_ID, operator: "present" },
          {
            typeId: CORE_PARTICIPANTS_FACET_TYPE_ID,
            operator: "contains",
            member: p6rPrincipalKeyForActorSnapshot(otherActor),
          },
        ],
        cursor: firstPage.nextCursor ?? undefined,
      });
      expect(perspectiveMismatch.status).toBe(400);

      addParticipantEvent(harness, {
        actor: otherActor,
        sequence: 2,
        threadId: second.id,
      });
      const changedProjection = await postFacetQuery(harness.app, {
        ...request,
        cursor: firstPage.nextCursor ?? undefined,
      });
      expect(changedProjection.status).toBe(400);
      expect(
        apiErrorSchema.parse(await readJson(changedProjection)),
      ).toMatchObject({ code: "invalid_cursor" });
    });
  });

  it("reports reconciling and unavailable last-known state without making negatives false", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/public-thread-facet-states",
      });
      const thread = seedThread(harness.deps, { projectId: project.id });
      const [{ generation }] = activatePluginThreadFacetDeclarations(
        harness.db,
        {
          ownerPluginId: "thread-progress",
          declarations: [progressDeclaration],
        },
      ).activated;
      replaceThreadFacetRelationsInGeneration(harness.db, {
        typeId: progressTypeId,
        generation,
        threadId: thread.id,
        members: ["requested"],
      });

      const positiveRequest: ThreadFacetQueryRequest = {
        scope: { projectId: project.id },
        filters: [
          {
            typeId: progressTypeId,
            operator: "contains",
            member: "requested",
          },
        ],
        pageSize: 10,
      };
      const reconcilingResponse = await postFacetQuery(
        harness.app,
        positiveRequest,
      );
      expect(reconcilingResponse.status).toBe(200);
      expect(
        threadFacetQueryResponseSchema.parse(
          await readJson(reconcilingResponse),
        ),
      ).toMatchObject({
        threads: [{ id: thread.id }],
        facetStates: [{ typeId: progressTypeId, ownerState: "reconciling" }],
      });

      markThreadFacetOwnerUnavailable(harness.db, { typeId: progressTypeId });
      const unavailableResponse = await postFacetQuery(
        harness.app,
        positiveRequest,
      );
      expect(unavailableResponse.status).toBe(200);
      expect(
        threadFacetQueryResponseSchema.parse(
          await readJson(unavailableResponse),
        ),
      ).toMatchObject({
        threads: [{ id: thread.id }],
        facetStates: [{ typeId: progressTypeId, ownerState: "unavailable" }],
      });
      const negativeResponse = await postFacetQuery(harness.app, {
        ...positiveRequest,
        filters: [
          {
            typeId: progressTypeId,
            operator: "notContains",
            member: "fulfilled",
          },
        ],
      });
      expect(negativeResponse.status).toBe(200);
      expect(
        threadFacetQueryResponseSchema.parse(await readJson(negativeResponse))
          .threads,
      ).toEqual([]);
    });
  });

  it("continues equal-rank enum ordering by ThreadId before absent or unknown", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/public-thread-facet-equal-rank",
      });
      const equalRank = [
        seedThread(harness.deps, { projectId: project.id }),
        seedThread(harness.deps, { projectId: project.id }),
      ];
      seedThread(harness.deps, { projectId: project.id });
      const [{ generation }] = activatePluginThreadFacetDeclarations(
        harness.db,
        {
          ownerPluginId: "thread-progress",
          declarations: [progressDeclaration],
        },
      ).activated;
      for (const thread of equalRank) {
        replaceThreadFacetRelationsInGeneration(harness.db, {
          typeId: progressTypeId,
          generation,
          threadId: thread.id,
          members: ["requested"],
        });
      }
      const request: ThreadFacetQueryRequest = {
        scope: { projectId: project.id },
        filters: [],
        order: {
          typeId: progressTypeId,
          direction: "asc",
          absent: "last",
          unknown: "last",
        },
        pageSize: 1,
      };
      const firstResponse = await postFacetQuery(harness.app, request);
      const first = threadFacetQueryResponseSchema.parse(
        await readJson(firstResponse),
      );
      const secondResponse = await postFacetQuery(harness.app, {
        ...request,
        cursor: first.nextCursor ?? undefined,
      });
      const second = threadFacetQueryResponseSchema.parse(
        await readJson(secondResponse),
      );
      expect([first.threads[0]?.id, second.threads[0]?.id].sort()).toEqual(
        equalRank.map(({ id }) => id).sort(),
      );
      expect(first.threads[0]?.id).not.toBe(second.threads[0]?.id);
    });
  });

  it("applies the full legacy list scope before facets and validates named scope", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/public-thread-facet-scope",
      });
      const parent = seedThread(harness.deps, { projectId: project.id });
      const child = seedThread(harness.deps, {
        projectId: project.id,
        parentThreadId: parent.id,
      });
      const fork = seedThread(harness.deps, {
        projectId: project.id,
        sourceThreadId: parent.id,
        originKind: "fork",
        originPluginId: "fixture-plugin",
      });
      seedThread(harness.deps, { projectId: project.id });
      const createdSection = createThreadSection(harness.db, harness.hub, {
        name: "Facet section",
      });
      if (createdSection.status !== "created") {
        throw new Error("Expected a new facet test section");
      }
      updateThread(harness.db, harness.hub, child.id, {
        sectionId: createdSection.section.id,
      });

      const response = await postFacetQuery(harness.app, {
        scope: {
          projectId: project.id,
          parentThreadId: parent.id,
          sectionId: createdSection.section.id,
          hasParent: true,
        },
        filters: [],
        pageSize: 10,
      });
      expect(response.status).toBe(200);
      expect(
        threadFacetQueryResponseSchema
          .parse(await readJson(response))
          .threads.map(({ id }) => id),
      ).toEqual([child.id]);
      const forkResponse = await postFacetQuery(harness.app, {
        scope: {
          projectId: project.id,
          sourceThreadId: parent.id,
          originKind: "fork",
          originPluginId: "fixture-plugin",
        },
        filters: [],
        pageSize: 10,
      });
      expect(forkResponse.status).toBe(200);
      expect(
        threadFacetQueryResponseSchema
          .parse(await readJson(forkResponse))
          .threads.map(({ id }) => id),
      ).toEqual([fork.id]);

      for (const scope of [
        { projectId: "prj_missing" },
        { sectionId: "section_missing" },
      ]) {
        const missing = await postFacetQuery(harness.app, {
          scope,
          filters: [],
          pageSize: 10,
        });
        expect(missing.status).toBe(404);
      }
      const contradictory = await postFacetQuery(harness.app, {
        scope: { sectionId: createdSection.section.id, unsectioned: true },
        filters: [],
        pageSize: 10,
      });
      expect(contradictory.status).toBe(400);
    });
  });

  it("keeps archived threads out of active saved facet views", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/public-thread-facet-archived-scope",
      });
      const active = seedThread(harness.deps, { projectId: project.id });
      const archived = seedThread(harness.deps, { projectId: project.id });
      const actor = localActor();
      addParticipantEvent(harness, {
        actor,
        sequence: 1,
        threadId: active.id,
      });
      addParticipantEvent(harness, {
        actor,
        sequence: 1,
        threadId: archived.id,
      });
      archiveThread(harness.db, harness.hub, archived.id);

      for (const [archivedScope, expectedId] of [
        [false, active.id],
        [true, archived.id],
      ] as const) {
        const response = await postFacetQuery(harness.app, {
          scope: { projectId: project.id, archived: archivedScope },
          filters: [
            { typeId: CORE_PARTICIPANTS_FACET_TYPE_ID, operator: "present" },
          ],
          pageSize: 10,
        });
        expect(response.status).toBe(200);
        expect(
          threadFacetQueryResponseSchema
            .parse(await readJson(response))
            .threads.map(({ id }) => id),
        ).toEqual([expectedId]);
      }
    });
  });

  it("keeps participant identity exact and continuation public/nondeleted", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/public-thread-facet-participants",
      });
      const visible = seedThread(harness.deps, { projectId: project.id });
      const hidden = seedThread(harness.deps, {
        projectId: project.id,
        visibility: "hidden",
      });
      const deleted = seedThread(harness.deps, { projectId: project.id });
      for (let index = 0; index < 70; index += 1) {
        addParticipantEvent(harness, {
          actor: {
            p6rProviderId: "fixture",
            p6rSubject: `subject-${index}`,
            p6rHandle: `handle-${index}`,
            p6rDisplayName: "Same presentation",
            p6rImageUrl: null,
          },
          sequence: index + 1,
          threadId: visible.id,
        });
      }
      for (let index = 0; index < 5; index += 1) {
        addParticipantEvent(harness, {
          actor: {
            p6rProviderId: "hidden-fixture",
            p6rSubject: `subject-${index}`,
            p6rHandle: `hidden-${index}`,
            p6rDisplayName: `Hidden ${index}`,
            p6rImageUrl: null,
          },
          sequence: index + 1,
          threadId: hidden.id,
        });
      }
      addParticipantEvent(harness, {
        actor: localActor(),
        sequence: 1,
        threadId: deleted.id,
      });

      const query = await postFacetQuery(harness.app, {
        scope: { projectId: project.id },
        filters: [
          { typeId: CORE_PARTICIPANTS_FACET_TYPE_ID, operator: "present" },
        ],
        pageSize: 10,
      });
      expect(query.status).toBe(200);
      const visibleEntry = threadFacetQueryResponseSchema
        .parse(await readJson(query))
        .threads.find(({ id }) => id === visible.id);
      expect(visibleEntry?.participantSummary).toMatchObject({
        totalCount: 70,
        profiles: [
          { p6rDisplayName: "Same presentation", p6rImageUrl: null },
          { p6rDisplayName: "Same presentation", p6rImageUrl: null },
          { p6rDisplayName: "Same presentation", p6rImageUrl: null },
        ],
      });
      expect(
        new Set(
          visibleEntry?.participantSummary.profiles.map(
            ({ p6rPrincipalKey }) => p6rPrincipalKey,
          ),
        ).size,
      ).toBe(3);

      const firstPageResponse = await harness.app.request(
        `/api/v1/threads/${visible.id}/facet-participants?pageSize=64`,
      );
      expect(firstPageResponse.status).toBe(200);
      const firstPage = threadFacetParticipantsResponseSchema.parse(
        await readJson(firstPageResponse),
      );
      expect(firstPage.profiles).toHaveLength(64);
      expect(firstPage.nextCursor).toEqual(expect.any(String));
      const finalPageResponse = await harness.app.request(
        `/api/v1/threads/${visible.id}/facet-participants?pageSize=64&cursor=${encodeURIComponent(
          firstPage.nextCursor ?? "",
        )}`,
      );
      expect(finalPageResponse.status).toBe(200);
      expect(
        threadFacetParticipantsResponseSchema.parse(
          await readJson(finalPageResponse),
        ).profiles,
      ).toHaveLength(6);

      const hiddenQuery = await postFacetQuery(harness.app, {
        scope: { projectId: project.id, includeHidden: true },
        filters: [
          { typeId: CORE_PARTICIPANTS_FACET_TYPE_ID, operator: "present" },
        ],
        pageSize: 10,
      });
      const hiddenEntry = threadFacetQueryResponseSchema
        .parse(await readJson(hiddenQuery))
        .threads.find(({ id }) => id === hidden.id);
      expect(hiddenEntry?.participantSummary).toMatchObject({
        totalCount: 5,
        profiles: expect.any(Array),
        nextCursor: expect.any(String),
      });
      const hiddenContinuation = await harness.app.request(
        `/api/v1/threads/${hidden.id}/facet-participants?pageSize=3&cursor=${encodeURIComponent(
          hiddenEntry?.participantSummary.nextCursor ?? "",
        )}`,
      );
      expect(hiddenContinuation.status).toBe(200);
      expect(
        threadFacetParticipantsResponseSchema.parse(
          await readJson(hiddenContinuation),
        ).profiles,
      ).toHaveLength(2);
      markThreadDeleted(harness.db, harness.hub, {
        threadId: deleted.id,
      });
      expect(
        (
          await harness.app.request(
            `/api/v1/threads/${deleted.id}/facet-participants`,
          )
        ).status,
      ).toBe(404);
    });
  });

  it("refuses an unauthenticated request-principal perspective", async () => {
    await withTestHarness(async (harness) => {
      const response = await postFacetQuery(
        harness.app,
        {
          scope: {},
          filters: [
            {
              typeId: CORE_PARTICIPANTS_FACET_TYPE_ID,
              operator: "contains",
              member: { perspective: "request-principal" },
            },
          ],
          pageSize: 10,
        },
        "http://remote.example/api/v1/threads/facet-query",
      );
      expect(response.status).toBe(401);
      expect(apiErrorSchema.parse(await readJson(response))).toMatchObject({
        code: "authentication_required",
      });
    });
  });
});
