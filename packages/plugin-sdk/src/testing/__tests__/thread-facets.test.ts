import { describe, expect, it } from "vitest";
import { createFakePluginHost, makeThreadResponse } from "../index.js";

const REFUSAL = "Thread facet capability refused";

describe("experimental thread facets", () => {
  it("attenuates only exact live SDK objects and uniformly refuses invalid writes", async () => {
    const thread = makeThreadResponse({ id: "thread-a" });
    const host = createFakePluginHost({
      pluginId: "progress",
      sdk: {
        threads: {
          get: async () => ({ ...thread }),
          list: async () => [{ ...thread }],
        },
      },
    });
    const phase = host.bb.experimental_facets.declare({
      assignmentScope: "shared-thread",
      cardinality: "one",
      localName: "phase",
      memberKind: "enum",
      members: ["defining", "working"] as const,
    });
    host.harness.experimental_commitFacets();

    const exact = await host.bb.sdk.threads.get({ threadId: thread.id });
    const grant = host.bb.experimental_facets.target(exact);
    await phase.replace(grant, ["working"]);
    expect(host.harness.experimental_threadFacets[0]?.snapshots).toEqual({
      "thread-a": ["working"],
    });

    expect(() => host.bb.experimental_facets.target({ ...exact })).toThrow(
      REFUSAL,
    );
    const changed = await host.bb.sdk.threads.get({ threadId: thread.id });
    changed.id = "changed";
    expect(() => host.bb.experimental_facets.target(changed)).toThrow(REFUSAL);
    const hostile = await host.bb.sdk.threads.get({ threadId: thread.id });
    Object.defineProperty(hostile, "id", {
      get() {
        throw new Error("hostile getter detail");
      },
    });
    expect(() => host.bb.experimental_facets.target(hostile)).toThrow(REFUSAL);
    expect(() =>
      Reflect.apply(
        host.bb.experimental_facets.target,
        host.bb.experimental_facets,
        [thread.id],
      ),
    ).toThrow(REFUSAL);
    await expect(
      Reflect.apply(phase.replace, phase, [grant, ["missing"]]),
    ).rejects.toThrow(REFUSAL);
    await expect(
      Reflect.apply(phase.replace, phase, [grant, ["working", "working"]]),
    ).rejects.toThrow(REFUSAL);
    await expect(
      Reflect.apply(phase.replace, phase, [grant, ["working", "defining"]]),
    ).rejects.toThrow(REFUSAL);

    exact.visibility = "hidden";
    await expect(phase.clear(grant)).resolves.toBeUndefined();
    exact.deletedAt = 1;
    await expect(phase.replace(grant, ["working"])).resolves.toBeUndefined();
    host.harness.experimental_setThreadFacetTargetEligibility(
      thread.id,
      "hidden",
    );
    await expect(phase.clear(grant)).rejects.toThrow(REFUSAL);
    host.harness.experimental_setThreadFacetTargetEligibility(
      thread.id,
      "project-deleted",
    );
    await expect(phase.clear(grant)).rejects.toThrow(REFUSAL);
    host.harness.experimental_setThreadFacetTargetEligibility(
      thread.id,
      "visible",
    );

    const foreign = createFakePluginHost({
      pluginId: "foreign",
      sdk: { threads: { get: async () => thread } },
    });
    const foreignThread = await foreign.bb.sdk.threads.get({
      threadId: thread.id,
    });
    const foreignGrant = foreign.bb.experimental_facets.target(foreignThread);
    await expect(phase.clear(foreignGrant)).rejects.toThrow(REFUSAL);

    await host.harness.dispose();
    await expect(phase.clear(grant)).rejects.toThrow(REFUSAL);
    await foreign.harness.dispose();
  });

  it("partitions malformed optional declarations without aborting a valid one", async () => {
    const host = createFakePluginHost({ pluginId: "mixed" });
    host.bb.experimental_facets.declare({
      assignmentScope: "shared-thread",
      cardinality: "many",
      localName: "valid",
      memberKind: "enum",
      members: ["requested", "fulfilled"] as const,
    });
    const malformed = [
      {
        assignmentScope: "shared-thread",
        cardinality: "many",
        localName: "principal-member-kind",
        memberKind: "principal-key",
        members: [],
      },
      {
        assignmentScope: "private-principal",
        cardinality: "many",
        localName: "private",
        memberKind: "enum",
        members: ["mine"],
      },
      {
        assignmentScope: "shared-thread",
        cardinality: "many",
        localName: "null-members",
        memberKind: "enum",
        members: null,
      },
    ];
    for (const declaration of malformed) {
      Reflect.apply(
        host.bb.experimental_facets.declare,
        host.bb.experimental_facets,
        [declaration],
      );
    }
    const nullRecordHandle = Reflect.apply(
      host.bb.experimental_facets.declare,
      host.bb.experimental_facets,
      [null],
    );
    const hostileRecordHandle = Reflect.apply(
      host.bb.experimental_facets.declare,
      host.bb.experimental_facets,
      [
        new Proxy(
          {},
          {
            get: () => {
              throw new Error("hostile getter");
            },
          },
        ),
      ],
    );

    expect(() => host.harness.experimental_commitFacets()).not.toThrow();
    expect(host.harness.experimental_threadFacets).toMatchObject([
      { localName: "valid", ownerState: "reconciling" },
    ]);
    expect(
      host.harness.logEntries.filter(({ message }) =>
        message.includes("quarantined"),
      ),
    ).toHaveLength(5);
    await expect(nullRecordHandle.markReady()).rejects.toThrow(REFUSAL);
    await expect(hostileRecordHandle.markReady()).rejects.toThrow(REFUSAL);
  });

  it("keeps reload reconciliation sequential, retryable, and generation-safe", async () => {
    const first = makeThreadResponse({ id: "thread-a" });
    const second = makeThreadResponse({ id: "thread-b" });
    const third = makeThreadResponse({ id: "thread-c" });
    const threads = new Map([
      [first.id, first],
      [second.id, second],
      [third.id, third],
    ]);
    let failNext: string | null = null;
    let hideDuringGet: string | null = null;
    let heldThread: string | null = null;
    let releaseHeld: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      releaseHeld = resolve;
    });
    const host = createFakePluginHost({
      pluginId: "progress",
      sdk: {
        threads: {
          get: async ({ threadId }) => {
            if (failNext === threadId) {
              failNext = null;
              throw new Error("transient SDK failure");
            }
            if (hideDuringGet === threadId) {
              hideDuringGet = null;
              activeReplacement?.harness.experimental_setThreadFacetTargetEligibility(
                threadId,
                "hidden",
              );
              throw new Error("thread became hidden during hydration");
            }
            if (heldThread === threadId) await held;
            const thread = threads.get(threadId);
            if (thread === undefined || thread.deletedAt !== null) {
              throw new Error("not found");
            }
            return thread;
          },
          list: async () => [first, second, third],
        },
      },
    });
    let activeReplacement: typeof host | null = null;
    const phase = host.bb.experimental_facets.declare({
      assignmentScope: "shared-thread",
      cardinality: "one",
      localName: "phase",
      memberKind: "enum",
      members: ["defining", "working"] as const,
    });
    host.harness.experimental_commitFacets();
    const listed = await host.bb.sdk.threads.list();
    const firstGrant = host.bb.experimental_facets.target(listed[0]!);
    await phase.replace(firstGrant, ["working"]);
    await phase.clear(host.bb.experimental_facets.target(listed[1]!));
    await phase.clear(host.bb.experimental_facets.target(listed[2]!));
    expect((await phase.listPriorTargets()).nextCursor).toBeNull();
    await phase.markReady();

    const nextHandles: Array<typeof phase> = [];
    const replacement = await host.harness.reload((bb) => {
      nextHandles.push(
        bb.experimental_facets.declare({
          assignmentScope: "shared-thread",
          cardinality: "one",
          localName: "phase",
          memberKind: "enum",
          members: ["defining", "working"] as const,
        }),
      );
    });
    activeReplacement = replacement;
    const next = nextHandles[0]!;
    expect(replacement.harness.experimental_threadFacets[0]).toMatchObject({
      generation: 2,
      ownerState: "reconciling",
      snapshots: {
        "thread-a": ["working"],
        "thread-b": [],
        "thread-c": [],
      },
    });
    await expect(phase.clear(firstGrant)).rejects.toThrow(REFUSAL);
    await expect(next.markReady()).rejects.toThrow(REFUSAL);
    await expect(
      next.listPriorTargets({ cursor: "forged", pageSize: 1 }),
    ).rejects.toThrow(REFUSAL);

    failNext = first.id;
    await expect(next.listPriorTargets({ pageSize: 1 })).rejects.toThrow(
      REFUSAL,
    );

    heldThread = first.id;
    const firstPagePending = next.listPriorTargets({ pageSize: 1 });
    await expect(next.listPriorTargets({ pageSize: 1 })).rejects.toThrow(
      REFUSAL,
    );
    releaseHeld();
    const firstPage = await firstPagePending;
    expect(firstPage.targets.map(({ id }) => id)).toEqual([first.id]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    const deliveredGrant = replacement.bb.experimental_facets.target(
      firstPage.targets[0]!,
    );
    replacement.harness.experimental_setThreadFacetTargetEligibility(
      first.id,
      "hidden",
    );
    await expect(next.clear(deliveredGrant)).rejects.toThrow(REFUSAL);
    replacement.harness.experimental_setThreadFacetTargetEligibility(
      first.id,
      "visible",
    );
    await expect(next.listPriorTargets()).rejects.toThrow(REFUSAL);

    replacement.harness.experimental_setThreadFacetTargetEligibility(
      second.id,
      "deleted",
    );
    const secondPage = await next.listPriorTargets({
      cursor: firstPage.nextCursor ?? undefined,
      pageSize: 1,
    });
    expect(secondPage.targets).toEqual([]);
    expect(secondPage.nextCursor).toEqual(expect.any(String));
    hideDuringGet = third.id;
    const terminal = await next.listPriorTargets({
      cursor: secondPage.nextCursor ?? undefined,
      pageSize: 1,
    });
    expect(terminal).toEqual({ targets: [], nextCursor: null });
    replacement.harness.experimental_setThreadFacetTargetEligibility(
      third.id,
      "visible",
    );
    await next.markReady();
    expect(replacement.harness.experimental_threadFacets[0]?.ownerState).toBe(
      "ready",
    );
    await replacement.harness.dispose();
  });
});
