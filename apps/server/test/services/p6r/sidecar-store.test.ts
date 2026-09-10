import { expect, describe, it } from "vitest";
import {
  appendDaemonEventsInTransaction,
  createConnection,
  createProject,
  createThread,
  migrate,
  noopNotifier,
  upsertHost,
} from "@bb/db";
import { turnScope } from "@bb/domain";
import {
  p6rAttemptInputs,
  p6rAttempts,
  p6rContributions,
  p6rPendingNativeWrites,
  p6rOperationReceipts,
} from "../../../src/services/p6r/sidecar-schema.js";
import { migrateP6rSidecars } from "../../../src/services/p6r/sidecar-migrate.js";
import {
  acceptP6rOperationInTransaction,
  initializeP6rInstanceNamespace,
  linkP6rNativeTurnForRequest,
  listP6rAttempts,
  lookupP6rOperationReceipt,
  promoteP6rNativeQueuedWritesInTransaction,
  recordP6rNativeWriteInTransaction,
  reserveP6rNativeQueuedWriteInTransaction,
  updateP6rNativeQueuedWriteInTransaction,
  type P6rAcceptanceDraft,
  type P6rNativeWriteDraft,
  type P6rNativeWriteOrigin,
} from "../../../src/services/p6r/sidecar-store.js";

function createMigratedDb() {
  const db = createConnection(":memory:");
  migrate(db);
  migrateP6rSidecars(db);
  return db;
}

function createStoredThread(db: ReturnType<typeof createMigratedDb>): string {
  const host = upsertHost(db, noopNotifier, {
    id: "host-1",
    name: "Host",
    type: "persistent",
  });
  const { project } = createProject(db, noopNotifier, {
    name: "Project",
    source: { hostId: host.id, path: "/project", type: "local_path" },
  });
  const thread = createThread(db, noopNotifier, {
    environmentId: null,
    projectId: project.id,
    providerId: "provider",
    status: "idle",
    title: "Thread",
    titleFallback: "Thread",
  });
  return thread.id;
}

function draft(
  overrides: Partial<P6rAcceptanceDraft> = {},
): P6rAcceptanceDraft {
  return {
    assertLive: () => ({ ok: true }),
    contribution: {
      acceptedAt: 100,
      acceptedAuthorship: { kind: "external", subject: "author-1" },
      currentProjection: { text: "original" },
      id: "contribution-1",
      initialInput: { text: "original" },
      latestEditor: { subject: "author-1" },
      nativeRequestId: "request-1",
      threadId: "thread-1",
    },
    operationId: "operation-1",
    operationNamespace: "plugin-a",
    payloadHash: "hash-1",
    receipt: {
      acceptedAt: 100,
      acceptedRequestSequence: 9,
      nativeRequestId: "request-1",
      retentionDeadline: 1_000,
      threadId: "thread-1",
    },
    ...overrides,
  };
}

function nativeWriteDraft(
  overrides: Partial<P6rNativeWriteDraft> = {},
): P6rNativeWriteDraft {
  return {
    acceptedAt: 100,
    attemptId: "native-attempt-1",
    contributionIds: ["native-contribution-0", "native-contribution-1"],
    inputGroups: [[{ text: "first" }], [{ text: "second" }]],
    nativeRequestId: "native-request-1",
    threadId: "thread-1",
    ...overrides,
  };
}

function nativeWriteOrigin(
  overrides: Partial<P6rNativeWriteOrigin> = {},
): P6rNativeWriteOrigin {
  return {
    acceptedAuthorship: {
      evidence: "local-user",
      identity: {
        issuer: "bb",
        key: "person:operator",
        kind: "person",
        subject: "operator",
      },
      presentation: { avatarUrl: null, displayName: "Operator", handle: null },
    },
    validate: () => ({ ok: true }),
    ...overrides,
  };
}

function publicPersonOrigin() {
  return {
    actor: {
      evidence: "local-user" as const,
      identity: {
        issuer: "bb",
        key: "person:operator",
        kind: "person" as const,
        subject: "operator",
      },
      presentation: {
        avatarUrl: null,
        displayName: "Operator",
        handle: null,
      },
    },
    kind: "person" as const,
  };
}

describe("P6r sidecar storage", () => {
  it("retains queued authorship and editor evidence until one aligned native attempt is appended", () => {
    const db = createMigratedDb();
    const author = nativeWriteOrigin();
    const editor = nativeWriteOrigin({
      acceptedAuthorship: { kind: "system", reason: "plugin-sdk" },
    });

    db.transaction((tx) => {
      reserveP6rNativeQueuedWriteInTransaction(tx, {
        acceptedAt: 100,
        input: [{ text: "original" }],
        origin: author,
        queuedMessageId: "queued-attributed",
        threadId: "thread-1",
      });
      updateP6rNativeQueuedWriteInTransaction(tx, {
        editor,
        input: [{ text: "edited" }],
        queuedMessageId: "queued-attributed",
      });
    });

    expect(db.select().from(p6rPendingNativeWrites).all()).toMatchObject([
      {
        queuedMessageId: "queued-attributed",
        acceptedAuthorship: JSON.stringify(author.acceptedAuthorship),
        latestEditor: JSON.stringify({ kind: "system", reason: "plugin-sdk" }),
        input: JSON.stringify([{ text: "edited" }]),
      },
    ]);

    db.transaction((tx) => {
      expect(
        promoteP6rNativeQueuedWritesInTransaction(tx, {
          attemptId: "native-attempt-queued",
          inputGroups: [[{ text: "edited" }], [{ text: "unattributed" }]],
          nativeRequestId: "native-request-queued",
          queuedMessageIds: ["queued-attributed", "queued-baseline"],
          threadId: "thread-1",
        }),
      ).toBe(true);
    });

    expect(db.select().from(p6rPendingNativeWrites).all()).toEqual([]);
    expect(db.select().from(p6rContributions).all()).toMatchObject([
      {
        id: "native-attempt-queued:contribution:0",
        initialInput: JSON.stringify([{ text: "edited" }]),
        currentProjection: JSON.stringify([{ text: "edited" }]),
        latestEditor: JSON.stringify({ kind: "system", reason: "plugin-sdk" }),
        nativeRequestId: "native-request-queued",
      },
    ]);
    expect(db.select().from(p6rAttemptInputs).all()).toMatchObject([
      {
        attemptId: "native-attempt-queued",
        contributionId: "native-attempt-queued:contribution:0",
        groupIndex: 0,
        sourceIndex: 0,
      },
      {
        attemptId: "native-attempt-queued",
        contributionId: null,
        groupIndex: 1,
        sourceIndex: 0,
      },
    ]);
  });

  it("records one frozen contribution source for each input group in its exact order", () => {
    const db = createMigratedDb();

    db.transaction((tx) =>
      recordP6rNativeWriteInTransaction(
        tx,
        nativeWriteOrigin({ acceptedAuthorship: publicPersonOrigin() }),
        nativeWriteDraft(),
      ),
    );

    expect(db.select().from(p6rContributions).all()).toMatchObject([
      {
        acceptedAuthorship: JSON.stringify(publicPersonOrigin().actor),
        id: "native-contribution-0",
        nativeRequestId: "native-request-1",
        threadId: "thread-1",
      },
      {
        id: "native-contribution-1",
        nativeRequestId: "native-request-1",
        threadId: "thread-1",
      },
    ]);
    expect(db.select().from(p6rAttempts).all()).toMatchObject([
      {
        id: "native-attempt-1",
        nativeRequestId: "native-request-1",
        threadId: "thread-1",
      },
    ]);
    expect(db.select().from(p6rAttemptInputs).all()).toMatchObject([
      {
        attemptId: "native-attempt-1",
        contributionId: "native-contribution-0",
        groupIndex: 0,
        snapshot: JSON.stringify([{ text: "first" }]),
        sourceIndex: 0,
        sourceKind: "contribution",
      },
      {
        attemptId: "native-attempt-1",
        contributionId: "native-contribution-1",
        groupIndex: 1,
        snapshot: JSON.stringify([{ text: "second" }]),
        sourceIndex: 0,
        sourceKind: "contribution",
      },
    ]);
  });

  it("rejects an invalidated origin before creating any attribution rows", () => {
    const db = createMigratedDb();

    expect(() =>
      db.transaction((tx) =>
        recordP6rNativeWriteInTransaction(
          tx,
          nativeWriteOrigin({
            validate: () => ({ code: "invalidated", ok: false }),
          }),
          nativeWriteDraft(),
        ),
      ),
    ).toThrow("P6r acceptance rejected: invalidated");

    expect(db.select().from(p6rContributions).all()).toEqual([]);
    expect(db.select().from(p6rAttempts).all()).toEqual([]);
    expect(db.select().from(p6rAttemptInputs).all()).toEqual([]);
  });

  it("rolls back native attribution when its surrounding native write is interrupted", () => {
    const db = createMigratedDb();

    expect(() =>
      db.transaction((tx) => {
        recordP6rNativeWriteInTransaction(
          tx,
          nativeWriteOrigin({
            acceptedAuthorship: { kind: "system", reason: "plugin-sdk" },
          }),
          nativeWriteDraft(),
        );
        throw new Error("ordinary write failed after attribution");
      }),
    ).toThrow("ordinary write failed after attribution");

    expect(db.select().from(p6rContributions).all()).toEqual([]);
    expect(db.select().from(p6rAttempts).all()).toEqual([]);
    expect(db.select().from(p6rAttemptInputs).all()).toEqual([]);
  });

  it("adds independent receipts after a populated native migration and replays safely", () => {
    const db = createConnection(":memory:");
    migrate(db);
    db.$client
      .prepare(
        "INSERT INTO app_settings_values (key, value, updated_at) VALUES (?, ?, ?)",
      )
      .run("p6r-upgrade-witness", "preserved", 10);

    migrateP6rSidecars(db);
    migrateP6rSidecars(db);

    expect(
      db.$client
        .prepare("SELECT value FROM app_settings_values WHERE key = ?")
        .get("p6r-upgrade-witness"),
    ).toEqual({ value: "preserved" });
    expect(
      db.$client
        .prepare("SELECT COUNT(*) AS count FROM __p6r_migrations")
        .get(),
    ).toEqual({ count: 4 });
    expect(
      db.$client
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('p6r_contributions', 'p6r_attempts', 'p6r_attempt_inputs', 'p6r_operation_receipts', 'p6r_pending_queued_dispatches', 'p6r_pending_native_writes', 'p6r_metadata')",
        )
        .get(),
    ).toEqual({ count: 7 });
  });

  it("persists one instance namespace independently of its data directory path", () => {
    const db = createMigratedDb();
    expect(initializeP6rInstanceNamespace(db, () => "first")).toBe("p6r:first");
    expect(initializeP6rInstanceNamespace(db, () => "second")).toBe(
      "p6r:first",
    );
  });

  it("rolls back every sidecar write when the surrounding acceptance transaction is interrupted", () => {
    const db = createMigratedDb();

    expect(() =>
      db.transaction((tx) => {
        acceptP6rOperationInTransaction(tx, draft());
        throw new Error("interrupted after sidecar write");
      }),
    ).toThrow("interrupted after sidecar write");

    expect(lookupP6rOperationReceipt(db, "plugin-a", "operation-1")).toBeNull();
    expect(db.select().from(p6rContributions).all()).toEqual([]);
    expect(db.select().from(p6rOperationReceipts).all()).toEqual([]);
  });

  it("keeps operation receipts durable across a later expired observation", () => {
    const db = createMigratedDb();
    const first = db.transaction((tx) =>
      acceptP6rOperationInTransaction(tx, draft()),
    );
    const repeated = db.transaction((tx) =>
      acceptP6rOperationInTransaction(
        tx,
        draft({ assertLive: () => ({ ok: false, code: "expired" }) }),
      ),
    );

    expect(first).toMatchObject({ created: true });
    expect(repeated).toMatchObject({ created: false, receipt: first.receipt });
    expect(lookupP6rOperationReceipt(db, "plugin-a", "operation-1")).toEqual(
      first.receipt,
    );
    expect(first.receipt.contributionId).toBe("contribution-1");
    expect(() =>
      db.transaction((tx) =>
        acceptP6rOperationInTransaction(tx, draft({ payloadHash: "hash-2" })),
      ),
    ).toThrow('P6r operation "operation-1" payload mismatch');
  });

  it("links an attempt only to its exact accepted native request and turn", () => {
    const db = createMigratedDb();
    const threadId = createStoredThread(db);
    db.transaction((tx) =>
      acceptP6rOperationInTransaction(
        tx,
        draft({
          attempt: {
            createdAt: 100,
            id: "attempt-1",
            inputs: [
              {
                contributionId: "contribution-1",
                groupIndex: 0,
                snapshot: { text: "original" },
                sourceIndex: 0,
                sourceKind: "contribution",
              },
            ],
            nativeRequestId: "request-1",
            threadId,
          },
          contribution: { ...draft().contribution, threadId },
          receipt: { ...draft().receipt, threadId },
        }),
      ),
    );
    db.transaction((tx) =>
      appendDaemonEventsInTransaction(tx, [
        {
          data: "{}",
          environmentId: null,
          itemId: null,
          itemKind: null,
          parentToolCallId: null,
          providerThreadId: "provider-1",
          scope: turnScope("turn-1"),
          threadId,
          type: "turn/started",
        },
        {
          data: JSON.stringify({ clientRequestId: "request-1" }),
          environmentId: null,
          itemId: null,
          itemKind: null,
          parentToolCallId: null,
          providerThreadId: "provider-1",
          scope: turnScope("turn-1"),
          threadId,
          type: "turn/input/accepted",
        },
        {
          data: JSON.stringify({ clientRequestId: "other-request" }),
          environmentId: null,
          itemId: null,
          itemKind: null,
          parentToolCallId: null,
          providerThreadId: "provider-1",
          scope: turnScope("turn-1"),
          threadId,
          type: "turn/input/accepted",
        },
      ]),
    );

    expect(
      listP6rAttempts(db, "plugin-a", { operationId: "operation-1" }),
    ).toMatchObject([
      { id: "attempt-1", nativeRequestId: "request-1", nativeTurnId: "turn-1" },
    ]);
    expect(
      linkP6rNativeTurnForRequest(db, {
        nativeRequestId: "request-1",
        threadId,
        turnId: "turn-other",
      }),
    ).toBe(false);
    expect(
      linkP6rNativeTurnForRequest(db, {
        nativeRequestId: "request-1",
        threadId,
        turnId: "turn-1",
      }),
    ).toBe(true);
    expect(
      listP6rAttempts(db, "plugin-a", { operationId: "operation-1" }),
    ).toMatchObject([{ id: "attempt-1", nativeTurnId: "turn-1" }]);
  });

  it("isolates equal operation identifiers by their stable plugin namespace", () => {
    const db = createMigratedDb();
    const first = db.transaction((tx) =>
      acceptP6rOperationInTransaction(tx, draft()),
    );
    const second = db.transaction((tx) =>
      acceptP6rOperationInTransaction(
        tx,
        draft({ operationNamespace: "plugin-b", payloadHash: "hash-b" }),
      ),
    );
    expect(first.receipt.operationId).toBe(second.receipt.operationId);
    expect(
      lookupP6rOperationReceipt(db, "plugin-a", "operation-1"),
    ).toMatchObject({ payloadHash: "hash-1" });
    expect(
      lookupP6rOperationReceipt(db, "plugin-b", "operation-1"),
    ).toMatchObject({ payloadHash: "hash-b" });
  });

  it("retains copied authorship and prior attempt snapshots through a replacement edit", () => {
    const db = createMigratedDb();
    db.transaction((tx) => acceptP6rOperationInTransaction(tx, draft()));
    const copied = draft({
      attempt: {
        createdAt: 120,
        id: "attempt-copy",
        inputs: [
          {
            contributionId: "contribution-1",
            groupIndex: 0,
            snapshot: { author: "author-1", text: "original" },
            sourceIndex: 0,
            sourceKind: "contribution",
          },
          {
            groupIndex: 0,
            snapshot: { purpose: "mention", text: "generated" },
            sourceIndex: 1,
            sourceKind: "generated",
          },
        ],
        nativeRequestId: "request-copy",
        threadId: "thread-1",
      },
      contribution: {
        ...draft().contribution,
        acceptedAt: 120,
        copiedFromContributionId: "contribution-1",
        id: "contribution-copy",
        nativeRequestId: "request-copy",
      },
      operationId: "operation-copy",
      payloadHash: "hash-copy",
      receipt: {
        ...draft().receipt,
        acceptedAt: 120,
        nativeRequestId: "request-copy",
      },
    });
    db.transaction((tx) => acceptP6rOperationInTransaction(tx, copied));
    const replacement = draft({
      contribution: {
        ...draft().contribution,
        acceptedAt: 130,
        currentProjection: { text: "edited" },
        id: "contribution-edit",
        latestEditor: { subject: "editor-2" },
        replacesContributionId: "contribution-1",
      },
      operationId: "operation-edit",
      payloadHash: "hash-edit",
      receipt: { ...draft().receipt, acceptedAt: 130 },
    });
    db.transaction((tx) => acceptP6rOperationInTransaction(tx, replacement));

    expect(db.select().from(p6rContributions).all()).toMatchObject([
      {
        id: "8:plugin-a14:contribution-1",
        acceptedAuthorship: JSON.stringify({
          kind: "external",
          subject: "author-1",
        }),
        currentProjection: JSON.stringify({ text: "original" }),
      },
      {
        id: "8:plugin-a17:contribution-copy",
        copiedFromContributionId: "8:plugin-a14:contribution-1",
      },
      {
        id: "8:plugin-a17:contribution-edit",
        acceptedAuthorship: JSON.stringify({
          kind: "external",
          subject: "author-1",
        }),
        currentProjection: JSON.stringify({ text: "edited" }),
        latestEditor: JSON.stringify({ subject: "editor-2" }),
        replacesContributionId: "8:plugin-a14:contribution-1",
      },
    ]);
    expect(db.select().from(p6rAttemptInputs).all()).toMatchObject([
      {
        attemptId: "8:plugin-a12:attempt-copy",
        contributionId: "8:plugin-a14:contribution-1",
        snapshot: JSON.stringify({ author: "author-1", text: "original" }),
      },
      {
        attemptId: "8:plugin-a12:attempt-copy",
        contributionId: null,
        snapshot: JSON.stringify({ purpose: "mention", text: "generated" }),
      },
    ]);
  });
});
