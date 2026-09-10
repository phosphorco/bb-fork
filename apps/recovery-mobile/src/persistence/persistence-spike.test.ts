import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  migrateRecoveryDatabase,
  readRecoverySchemaVersion,
} from "./migrations";
import { NodeRecoverySqlDatabase } from "./node-sqlite";
import { RecoveryRepository } from "./repository";

const temporaryDirectories: string[] = [];

async function temporaryDatabasePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "bb-recovery-sqlite-"));
  temporaryDirectories.push(directory);
  return join(directory, "recovery.db");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Recovery SQLite persistence spike", () => {
  it("migrates a file database in WAL mode and reopens committed data", async () => {
    const path = await temporaryDatabasePath();
    const first = new RecoveryRepository(NodeRecoverySqlDatabase.open(path));
    await expect(first.initialize()).resolves.toEqual({
      integrity: "not-checked",
      journalMode: "wal",
      schemaVersion: 4,
    });
    await expect(first.checkIntegrity()).resolves.toBe("ok");
    await first.ensureNamespace({
      namespaceId: "server-a/profile-a/principal-a",
      serverProfileKey: "profile-a",
      ownerKey: "provider-a:subject-a",
      ownerState: "resolved",
    });
    await first.putObservedRecord({
      namespaceId: "server-a/profile-a/principal-a",
      recordKey: "thread:one",
      payload: { title: "Cached thread" },
      revision: 4,
      updatedAt: 100,
    });
    await first.putOutboxItem({
      namespaceId: "server-a/profile-a/principal-a",
      outboxId: "outbox-one",
      threadId: "thread-one",
      body: "Survives a process restart",
      state: "awaiting-context",
      createdAt: 101,
      updatedAt: 101,
    });
    await first.close();

    const reopened = new RecoveryRepository(NodeRecoverySqlDatabase.open(path));
    await expect(reopened.initialize()).resolves.toMatchObject({
      integrity: "not-checked",
      journalMode: "wal",
      schemaVersion: 4,
    });
    await expect(reopened.checkIntegrity()).resolves.toBe("ok");
    await expect(
      reopened.getObservedRecord(
        "server-a/profile-a/principal-a",
        "thread:one",
      ),
    ).resolves.toMatchObject({
      payload: { title: "Cached thread" },
      revision: 4,
    });
    await expect(
      reopened.getOutboxItem("server-a/profile-a/principal-a", "outbox-one"),
    ).resolves.toMatchObject({
      body: "Survives a process restart",
      state: "awaiting-context",
    });
    await reopened.close();
  });

  it("rolls back a failed migration without advancing its version", async () => {
    const path = await temporaryDatabasePath();
    const database = NodeRecoverySqlDatabase.open(path);
    await expect(
      migrateRecoveryDatabase(database, {
        afterDdl: async (version) => {
          if (version === 2) throw new Error("injected after migration DDL");
        },
      }),
    ).rejects.toThrow("injected after migration DDL");
    await expect(readRecoverySchemaVersion(database)).resolves.toBe(1);
    await expect(
      database.getFirst<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'attachment_payloads'",
      ),
    ).resolves.toBeNull();
    await expect(migrateRecoveryDatabase(database)).resolves.toBe(4);
    await expect(migrateRecoveryDatabase(database)).resolves.toBe(4);
    await database.close();
  });

  it("migrates version 3 identity rows to origin-scoped keys", async () => {
    const path = await temporaryDatabasePath();
    const database = NodeRecoverySqlDatabase.open(path);
    await expect(
      migrateRecoveryDatabase(database, {
        afterDdl: async (version) => {
          if (version === 4) throw new Error("stop at version 3");
        },
      }),
    ).rejects.toThrow("stop at version 3");
    await expect(readRecoverySchemaVersion(database)).resolves.toBe(3);
    await database.run(
      `INSERT INTO namespaces (
        namespace_id, server_profile_key, owner_key, owner_state
      ) VALUES (?, ?, ?, ?)`,
      ["namespace-a", "server-profile-a", "principal-a", "resolved"],
    );
    await database.run(
      `INSERT INTO profile_identity_contexts (
        profile_id, server_url, namespace_id, principal_key,
        provider_id, subject, owner_state, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "profile-a",
        "https://a.example",
        "namespace-a",
        "principal-a",
        "tailnet",
        "subject-a",
        "resolved",
        60,
      ],
    );
    await expect(migrateRecoveryDatabase(database)).resolves.toBe(4);
    const repository = new RecoveryRepository(database);
    await expect(
      repository.getProfileIdentityContext("profile-a", "https://a.example"),
    ).resolves.toMatchObject({
      namespaceId: "namespace-a",
      principalKey: "principal-a",
    });
    await repository.close();
  });

  it("serializes concurrent work outside a rolling-back transaction", async () => {
    const path = await temporaryDatabasePath();
    const database = NodeRecoverySqlDatabase.open(path);
    await database.exec("CREATE TABLE witness (value TEXT NOT NULL)");
    let releaseFirst!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstStarted!: () => void;
    const firstDidStart = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const first = database.transaction(async (tx) => {
      await tx.run("INSERT INTO witness (value) VALUES (?)", ["rolled-back"]);
      firstStarted();
      await firstCanFinish;
      throw new Error("injected rollback");
    });
    await firstDidStart;
    const concurrent = database.run("INSERT INTO witness (value) VALUES (?)", [
      "committed",
    ]);
    releaseFirst();
    await expect(first).rejects.toThrow("injected rollback");
    await concurrent;
    await expect(
      database.getAll<{ value: string }>("SELECT value FROM witness"),
    ).resolves.toEqual([{ value: "committed" }]);
    await database.close();
  });

  it("notifies only the committed namespace and record key", async () => {
    const path = await temporaryDatabasePath();
    const repository = new RecoveryRepository(
      NodeRecoverySqlDatabase.open(path),
    );
    await repository.initialize();
    await repository.ensureNamespace({
      namespaceId: "namespace-a",
      serverProfileKey: "profile-a",
      ownerKey: "provider:subject-a",
      ownerState: "resolved",
    });
    await repository.ensureNamespace({
      namespaceId: "namespace-b",
      serverProfileKey: "profile-b",
      ownerKey: "anonymous",
      ownerState: "read-only",
    });

    const seen: string[] = [];
    repository.subscribeObservedRecord("namespace-a", "thread:one", () =>
      seen.push("a:one"),
    );
    repository.subscribeObservedRecord("namespace-a", "thread:two", () =>
      seen.push("a:two"),
    );
    repository.subscribeObservedRecord("namespace-b", "thread:one", () =>
      seen.push("b:one"),
    );

    await repository.putObservedRecord({
      namespaceId: "namespace-a",
      recordKey: "thread:one",
      payload: { title: "A" },
      revision: 1,
      updatedAt: 1,
    });
    expect(seen).toEqual(["a:one"]);

    await expect(
      repository.putObservedRecord({
        namespaceId: "missing-namespace",
        recordKey: "thread:one",
        payload: { title: "must roll back" },
        revision: 1,
        updatedAt: 1,
      }),
    ).rejects.toThrow();
    expect(seen).toEqual(["a:one"]);
    await repository.close();
  });

  it("reopens the last server-authored principal context per profile", async () => {
    const path = await temporaryDatabasePath();
    const first = new RecoveryRepository(NodeRecoverySqlDatabase.open(path));
    await first.initialize();
    await first.putProfileIdentityContext(
      {
        profileId: "profile-a",
        serverUrl: "https://bb.example.test",
        namespaceId: '["profile-a","principal-a"]',
        principalKey: "principal-a",
        providerId: "tailnet",
        subject: "subject-a",
        ownerState: "resolved",
        source: "live",
        updatedAt: 50,
      },
      {
        serverProfileKey: '["profile-a","https://bb.example.test"]',
      },
    );
    await first.close();

    const reopened = new RecoveryRepository(NodeRecoverySqlDatabase.open(path));
    await reopened.initialize();
    await expect(
      reopened.getProfileIdentityContext(
        "profile-a",
        "https://bb.example.test",
      ),
    ).resolves.toEqual({
      profileId: "profile-a",
      serverUrl: "https://bb.example.test",
      namespaceId: '["profile-a","principal-a"]',
      principalKey: "principal-a",
      providerId: "tailnet",
      subject: "subject-a",
      ownerState: "resolved",
      source: "cached",
      updatedAt: 50,
    });
    await reopened.close();
  });

  it("does not let an older identity response replace a newer principal", async () => {
    const path = await temporaryDatabasePath();
    const repository = new RecoveryRepository(
      NodeRecoverySqlDatabase.open(path),
    );
    await repository.initialize();
    const context = {
      profileId: "profile-a",
      serverUrl: "https://bb.example.test",
      namespaceId: "namespace-b",
      principalKey: "principal-b",
      providerId: "tailnet",
      subject: "subject-b",
      ownerState: "resolved" as const,
      source: "live" as const,
      updatedAt: 60,
    };
    await repository.putProfileIdentityContext(context, {
      serverProfileKey: "server-profile-b",
    });
    await repository.putProfileIdentityContext(
      {
        ...context,
        namespaceId: "namespace-a",
        principalKey: "principal-a",
        subject: "subject-a",
        updatedAt: 50,
      },
      { serverProfileKey: "server-profile-a" },
    );
    await expect(
      repository.getProfileIdentityContext(
        "profile-a",
        "https://bb.example.test",
      ),
    ).resolves.toMatchObject({
      namespaceId: "namespace-b",
      principalKey: "principal-b",
      updatedAt: 60,
    });
    await repository.close();
  });

  it("keeps the same local profile isolated across server origins", async () => {
    const path = await temporaryDatabasePath();
    const repository = new RecoveryRepository(
      NodeRecoverySqlDatabase.open(path),
    );
    await repository.initialize();
    const base = {
      profileId: "profile-a",
      principalKey: "principal-a",
      providerId: "tailnet",
      subject: "subject-a",
      ownerState: "resolved" as const,
      source: "live" as const,
      updatedAt: 60,
    };
    await repository.putProfileIdentityContext(
      {
        ...base,
        serverUrl: "https://a.example",
        namespaceId: "namespace-a",
      },
      { serverProfileKey: "server-profile-a" },
    );
    await repository.putProfileIdentityContext(
      {
        ...base,
        serverUrl: "https://b.example",
        namespaceId: "namespace-b",
      },
      { serverProfileKey: "server-profile-b" },
    );
    await expect(
      repository.getProfileIdentityContext("profile-a", "https://a.example"),
    ).resolves.toMatchObject({ namespaceId: "namespace-a" });
    await expect(
      repository.getProfileIdentityContext("profile-a", "https://b.example"),
    ).resolves.toMatchObject({ namespaceId: "namespace-b" });
    await repository.close();
  });

  it("rejects record downgrades and notifies only accepted writes", async () => {
    const path = await temporaryDatabasePath();
    const repository = new RecoveryRepository(
      NodeRecoverySqlDatabase.open(path),
    );
    await repository.initialize();
    await repository.ensureNamespace({
      namespaceId: "namespace-a",
      serverProfileKey: "profile-a",
      ownerKey: "principal-a",
      ownerState: "resolved",
    });
    let notifications = 0;
    repository.subscribeObservedRecord("namespace-a", "timeline", () => {
      notifications += 1;
    });
    await repository.putObservedRecord({
      namespaceId: "namespace-a",
      recordKey: "timeline",
      payload: { head: 8 },
      revision: 8,
      updatedAt: 80,
    });
    await repository.putObservedRecord({
      namespaceId: "namespace-a",
      recordKey: "timeline",
      payload: { head: 7 },
      revision: 7,
      updatedAt: 90,
    });
    await expect(
      repository.getObservedRecord("namespace-a", "timeline"),
    ).resolves.toMatchObject({ payload: { head: 8 }, revision: 8 });
    expect(notifications).toBe(1);
    await repository.close();
  });

  it("does not let a throwing listener reject a committed write", async () => {
    const path = await temporaryDatabasePath();
    const repository = new RecoveryRepository(
      NodeRecoverySqlDatabase.open(path),
    );
    await repository.initialize();
    await repository.ensureNamespace({
      namespaceId: "namespace-a",
      serverProfileKey: "profile-a",
      ownerKey: "principal-a",
      ownerState: "resolved",
    });
    let laterListenerCalls = 0;
    repository.subscribeObservedRecord("namespace-a", "record", () => {
      throw new Error("listener failed");
    });
    repository.subscribeObservedRecord("namespace-a", "record", () => {
      laterListenerCalls += 1;
    });
    await expect(
      repository.putObservedRecord({
        namespaceId: "namespace-a",
        recordKey: "record",
        payload: { durable: true },
        revision: 1,
        updatedAt: 1,
      }),
    ).resolves.toBeUndefined();
    expect(laterListenerCalls).toBe(1);
    await repository.close();
  });
});
